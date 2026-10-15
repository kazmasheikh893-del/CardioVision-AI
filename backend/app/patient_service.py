"""Patient accounts, sessions and patient-scoped assessment access for the CardioVision patient portal.

Design notes
------------
* A patient's name, age and phone number are *profile data*, never credentials. Access requires a
  password chosen at registration (PBKDF2-HMAC-SHA256, per-user salt) and a server-side session token.
* Session tokens are random, returned once, and stored only as a SHA-256 digest.
* Every patient-scoped query takes the authenticated ``patient_id`` and filters on it in SQL, so a
  browser-supplied assessment id can never reach another patient's row (IDOR protection).
* This module reuses ``storage_service`` for the SQLite connection, migrations and assessment table so
  there is a single source of truth.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from . import storage_service

SESSION_HOURS = int(os.environ.get("CARDIOVISION_PATIENT_SESSION_HOURS", "12"))
MIN_AGE = int(os.environ.get("CARDIOVISION_PATIENT_MIN_AGE", "18"))
MAX_AGE = int(os.environ.get("CARDIOVISION_PATIENT_MAX_AGE", "100"))
DEFAULT_COUNTRY_CODE = os.environ.get("CARDIOVISION_DEFAULT_COUNTRY_CODE", "").strip().lstrip("+")
MAX_FAILED_LOGINS = 5
LOCKOUT_SECONDS = 300
DUPLICATE_WINDOW_SECONDS = 60

# Holdout/CV ROC-AUC below this value means the vessel-level estimate is not shown as reliable.
VESSEL_RELIABILITY_AUC = 0.65

_NAME_RE = re.compile(r"[^\W\d_]+(?:[ .'\-]+[^\W\d_]+)*\.?", re.UNICODE)


class PatientAuthError(Exception):
    """Raised when credentials are wrong, an account is locked, or a duplicate would be created."""

    def __init__(self, message: str, status_code: int = 401):
        super().__init__(message)
        self.status_code = status_code


# --------------------------------------------------------------------------------------
# Validation / normalisation
# --------------------------------------------------------------------------------------

def normalize_phone(raw: str) -> str:
    """Return an E.164-style phone number (``+<country><number>``) or raise ``ValueError``.

    Accepts spaces, dashes, dots and brackets. A leading ``00`` is treated as ``+``. Numbers without a
    country code are accepted only when ``CARDIOVISION_DEFAULT_COUNTRY_CODE`` is configured.
    """
    text = (raw or "").strip()
    if not text:
        raise ValueError("Phone number is required.")
    if re.search(r"[^\d+\-\s().]", text):
        raise ValueError("Phone number may only contain digits, spaces, dashes, brackets and a leading +.")
    plus = text.startswith("+")
    digits = re.sub(r"\D", "", text)
    if text.startswith("00") and not plus:
        digits = digits[2:]
        plus = True
    if not plus:
        digits = digits.lstrip("0") if DEFAULT_COUNTRY_CODE else digits
        if not DEFAULT_COUNTRY_CODE:
            raise ValueError("Please include your country code, for example +91 98765 43210.")
        digits = DEFAULT_COUNTRY_CODE + digits
    if not 8 <= len(digits) <= 15:
        raise ValueError("Phone number must have between 8 and 15 digits including the country code.")
    if digits.startswith("0"):
        raise ValueError("Phone number must start with a valid country code.")
    return "+" + digits


def validate_full_name(raw: str) -> str:
    name = re.sub(r"\s+", " ", (raw or "").strip())
    if len(name) < 2:
        raise ValueError("Please enter your full name (at least 2 characters).")
    if len(name) > 100:
        raise ValueError("Name must be 100 characters or fewer.")
    if not _NAME_RE.fullmatch(name):
        raise ValueError("Name may contain letters, spaces, apostrophes, hyphens and full stops only.")
    return name


def validate_age(age: int) -> int:
    if not MIN_AGE <= age <= MAX_AGE:
        raise ValueError(f"Age must be between {MIN_AGE} and {MAX_AGE} years.")
    return age


def validate_password(raw: str) -> str:
    if len(raw or "") < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if len(raw) > 128:
        raise ValueError("Password must be 128 characters or fewer.")
    if not re.search(r"[A-Za-z]", raw) or not re.search(r"\d", raw):
        raise ValueError("Password must include at least one letter and one number.")
    return raw


def validate_email(raw: str | None) -> str | None:
    if raw is None or not raw.strip():
        return None
    email = raw.strip().lower()
    if len(email) > 254 or not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$", email):
        raise ValueError("Please enter a valid email address or leave it blank.")
    return email


# --------------------------------------------------------------------------------------
# Accounts and sessions
# --------------------------------------------------------------------------------------

def _public_profile(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "full_name": row["full_name"],
        "phone": row["phone"],
        "age": row["age"],
        "email": row["email"],
        "created_at": row["created_at"],
    }


def _digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


_failed: dict[str, tuple[int, float]] = {}
_failed_lock = threading.Lock()


def _check_lockout(phone: str) -> None:
    with _failed_lock:
        count, until = _failed.get(phone, (0, 0.0))
        if count >= MAX_FAILED_LOGINS and time.time() < until:
            raise PatientAuthError("Too many failed sign-in attempts. Please wait a few minutes and try again.", 429)
        if count >= MAX_FAILED_LOGINS and time.time() >= until:
            _failed.pop(phone, None)


def _record_failure(phone: str) -> None:
    with _failed_lock:
        count, _ = _failed.get(phone, (0, 0.0))
        _failed[phone] = (count + 1, time.time() + LOCKOUT_SECONDS)


def _clear_failures(phone: str) -> None:
    with _failed_lock:
        _failed.pop(phone, None)


def reset_login_throttle() -> None:
    """Test helper."""
    with _failed_lock:
        _failed.clear()


def register_patient(full_name: str, phone: str, age: int, password: str, email: str | None = None) -> dict[str, Any]:
    """Create an account. Inputs must already be validated/normalised; duplicates are rejected (409)."""
    patient_id = f"PAT-{uuid.uuid4().hex[:10].upper()}"
    salt = secrets.token_hex(16)
    pwd_hash = storage_service._hash_password(password, salt)
    now = datetime.now(timezone.utc).isoformat()
    try:
        with storage_service.get_connection() as conn:
            conn.execute(
                """
                INSERT INTO patients (id, full_name, phone, age, email, password_hash, salt, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (patient_id, full_name, phone, age, email, pwd_hash, salt, now),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM patients WHERE id = ?", (patient_id,)).fetchone()
    except sqlite3.IntegrityError as exc:
        raise PatientAuthError(
            "An account with this phone number already exists. Please sign in instead.", 409
        ) from exc
    return _public_profile(row)


def authenticate_patient(phone: str, password: str) -> dict[str, Any]:
    _check_lockout(phone)
    with storage_service.get_connection() as conn:
        row = conn.execute("SELECT * FROM patients WHERE phone = ?", (phone,)).fetchone()
    # Always run the hash so timing does not reveal whether the phone number is registered.
    salt = row["salt"] if row else "0" * 32
    candidate = storage_service._hash_password(password, salt)
    expected = row["password_hash"] if row else "0" * 64
    if not row or not hmac.compare_digest(candidate, expected):
        _record_failure(phone)
        raise PatientAuthError("Invalid phone number or password.", 401)
    _clear_failures(phone)
    return _public_profile(row)


def create_session(patient_id: str) -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=SESSION_HOURS)
    with storage_service.get_connection() as conn:
        conn.execute("DELETE FROM patient_sessions WHERE expires_at <= ?", (now.isoformat(),))
        conn.execute(
            "INSERT INTO patient_sessions (token_hash, patient_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (_digest(token), patient_id, now.isoformat(), expires.isoformat()),
        )
        conn.commit()
    return token, expires.isoformat()


def verify_session(token: str | None) -> dict[str, Any] | None:
    if not token:
        return None
    now_iso = datetime.now(timezone.utc).isoformat()
    with storage_service.get_connection() as conn:
        row = conn.execute(
            """
            SELECT p.* FROM patient_sessions s JOIN patients p ON p.id = s.patient_id
            WHERE s.token_hash = ? AND s.expires_at > ?
            """,
            (_digest(token), now_iso),
        ).fetchone()
    return _public_profile(row) if row else None


def revoke_session(token: str | None) -> None:
    if not token:
        return
    with storage_service.get_connection() as conn:
        conn.execute("DELETE FROM patient_sessions WHERE token_hash = ?", (_digest(token),))
        conn.commit()


# --------------------------------------------------------------------------------------
# Patient-scoped assessments
# --------------------------------------------------------------------------------------

def review_status(review: dict[str, Any] | None) -> dict[str, str]:
    """Patient-facing status derived only from persisted data (an assessment row and its review, if any)."""
    if not review:
        return {
            "code": "awaiting_review",
            "label": "Assessment submitted – awaiting clinician review",
        }
    raw = (review.get("status") or "").lower()
    if "additional" in raw or "more information" in raw or "info" in raw:
        return {"code": "info_required", "label": "Additional information required"}
    return {"code": "reviewed", "label": "Reviewed by doctor"}


def vessel_reliability() -> dict[str, dict[str, Any]] | None:
    """Real hold-out / cross-validation ROC-AUC of each vessel model, read from the evaluation artifact."""
    try:
        evaluation = json.loads(
            (storage_service.Path(__file__).resolve().parents[2] / "models" / "evaluation.json").read_text(encoding="utf-8")
        )
    except (OSError, ValueError):
        return None
    out: dict[str, dict[str, Any]] = {}
    for key, data in (evaluation.get("vessels") or {}).items():
        holdout = (data.get("holdout") or {}).get("metrics", {}).get("roc_auc")
        cv = (data.get("cross_validation") or {}).get("roc_auc", {}).get("mean")
        scores = [s for s in (holdout, cv) if isinstance(s, (int, float))]
        out[key] = {
            "holdout_roc_auc": holdout,
            "cv_roc_auc": cv,
            "reliable": bool(scores) and min(scores) >= VESSEL_RELIABILITY_AUC,
        }
    return out or None


def serialize_for_patient(assessment: dict[str, Any]) -> dict[str, Any]:
    """Whitelist the fields a patient may see. Research diagnostics and internal identifiers are excluded."""
    explanation = assessment.get("explanation")
    patient_explanation = None
    if explanation:
        patient_explanation = {
            "probability": explanation.get("probability"),
            "caution": explanation.get("caution"),
            "contributions": explanation.get("contributions", []),
        }
    review = assessment.get("review")
    return {
        "id": assessment["id"],
        "created_at": assessment["created_at"],
        "patient_name": assessment.get("patient_name"),
        "report_source": assessment.get("report_source"),
        "inputs": assessment["inputs"],
        "prediction": assessment["prediction"],
        "explanation": patient_explanation,
        "review": review,
        "status": review_status(review),
        "vessel_reliability": vessel_reliability(),
    }


def list_assessments(patient_id: str) -> list[dict[str, Any]]:
    with storage_service.get_connection() as conn:
        ids = [
            r["id"]
            for r in conn.execute(
                "SELECT id FROM assessments WHERE patient_id = ? ORDER BY created_at DESC, rowid DESC", (patient_id,)
            ).fetchall()
        ]
    out = []
    for aid in ids:
        full = storage_service.get_assessment(aid)
        if full:
            out.append(serialize_for_patient(full))
    return out


def get_assessment(patient_id: str, assessment_id: str) -> dict[str, Any] | None:
    """Return the assessment only if it belongs to ``patient_id``; otherwise ``None`` (indistinguishable from missing)."""
    with storage_service.get_connection() as conn:
        row = conn.execute(
            "SELECT id FROM assessments WHERE id = ? AND patient_id = ?", (assessment_id, patient_id)
        ).fetchone()
    if not row:
        return None
    full = storage_service.get_assessment(assessment_id)
    return serialize_for_patient(full) if full else None


def find_recent_duplicate(patient_id: str, inputs: dict[str, Any]) -> dict[str, Any] | None:
    """An identical submission by the same patient within the last minute is treated as a double-click."""
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=DUPLICATE_WINDOW_SECONDS)).isoformat()
    with storage_service.get_connection() as conn:
        rows = conn.execute(
            "SELECT id, inputs_json FROM assessments WHERE patient_id = ? AND created_at >= ? ORDER BY created_at DESC",
            (patient_id, cutoff),
        ).fetchall()
    for row in rows:
        if json.loads(row["inputs_json"]) == inputs:
            return get_assessment(patient_id, row["id"])
    return None
