"""Persistent storage service using SQLite for CardioVision AI assessments, clinician reviews, and notifications."""

from __future__ import annotations

import hashlib
import json
import os
import secrets
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

DB_PATH = Path(os.environ.get("CARDIOVISION_DB_PATH") or Path(__file__).resolve().parents[2] / "data" / "cardiovision.db")


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def _hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000).hex()


def init_db() -> None:
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS assessments (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                patient_name TEXT,
                inputs_json TEXT NOT NULL,
                prediction_json TEXT NOT NULL,
                explanation_json TEXT,
                report_source TEXT,
                patient_session_id TEXT,
                patient_email TEXT
            )
            """
        )

        # Migration check for existing DB without patient_session_id / patient_email
        cursor = conn.execute("PRAGMA table_info(assessments)")
        existing_cols = [row["name"] for row in cursor.fetchall()]
        if "patient_session_id" not in existing_cols:
            conn.execute("ALTER TABLE assessments ADD COLUMN patient_session_id TEXT")
        if "patient_email" not in existing_cols:
            conn.execute("ALTER TABLE assessments ADD COLUMN patient_email TEXT")
        # Phase 1: link assessments to an authenticated patient account (NULL for legacy / clinician-entered rows).
        if "patient_id" not in existing_cols:
            conn.execute("ALTER TABLE assessments ADD COLUMN patient_id TEXT")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_assessments_patient_id ON assessments(patient_id)")

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS patients (
                id TEXT PRIMARY KEY,
                full_name TEXT NOT NULL,
                phone TEXT UNIQUE NOT NULL,
                age INTEGER NOT NULL,
                email TEXT,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        # Only a SHA-256 digest of each session token is stored, so a database leak does not expose live tokens.
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS patient_sessions (
                token_hash TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY (patient_id) REFERENCES patients(id)
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS clinician_reviews (
                id TEXT PRIMARY KEY,
                assessment_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                doctor_name TEXT NOT NULL,
                doctor_title TEXT NOT NULL,
                summary TEXT NOT NULL,
                advice TEXT NOT NULL,
                follow_up TEXT,
                status TEXT NOT NULL,
                FOREIGN KEY (assessment_id) REFERENCES assessments(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS doctors (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                title TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS doctor_sessions (
                token TEXT PRIMARY KEY,
                doctor_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY (doctor_id) REFERENCES doctors(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                assessment_id TEXT NOT NULL,
                recipient_email TEXT NOT NULL,
                status TEXT NOT NULL,
                provider TEXT NOT NULL,
                error_message TEXT,
                sent_at TEXT NOT NULL,
                FOREIGN KEY (assessment_id) REFERENCES assessments(id)
            )
            """
        )

        # Seed default clinician if not exists. Credentials may be overridden through environment variables
        # (CARDIOVISION_SEED_DOCTOR_EMAIL / _PASSWORD / _NAME); the defaults are a local demo account only.
        seed_email = os.environ.get("CARDIOVISION_SEED_DOCTOR_EMAIL", "doctor@cardiovision.ai").strip().lower()
        seed_password = os.environ.get("CARDIOVISION_SEED_DOCTOR_PASSWORD", "CardioVision2026!")
        seed_name = os.environ.get("CARDIOVISION_SEED_DOCTOR_NAME", "Dr. Sarah Chen, MD")
        row = conn.execute("SELECT id FROM doctors WHERE email = ?", (seed_email,)).fetchone()
        if not row:
            salt = secrets.token_hex(16)
            pwd_hash = _hash_password(seed_password, salt)
            now = datetime.now(timezone.utc).isoformat()
            conn.execute(
                """
                INSERT INTO doctors (id, name, title, email, password_hash, salt, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "DOC-CARDIO-01"
                    if not conn.execute("SELECT 1 FROM doctors WHERE id = ?", ("DOC-CARDIO-01",)).fetchone()
                    else f"DOC-{uuid.uuid4().hex[:8].upper()}",
                    seed_name,
                    "Senior Interventional Cardiologist",
                    seed_email,
                    pwd_hash,
                    salt,
                    now,
                ),
            )
        conn.commit()


# Initialize on import
init_db()


def authenticate_doctor(email: str, password: str) -> dict[str, Any] | None:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM doctors WHERE email = ?", (email.strip().lower(),)).fetchone()
        if not row:
            return None
        candidate_hash = _hash_password(password, row["salt"])
        if candidate_hash != row["password_hash"]:
            return None
        return {
            "id": row["id"],
            "name": row["name"],
            "title": row["title"],
            "email": row["email"],
        }


def create_doctor_session(doctor_id: str, duration_hours: int = 12) -> str:
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=duration_hours)
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO doctor_sessions (token, doctor_id, created_at, expires_at)
            VALUES (?, ?, ?, ?)
            """,
            (token, doctor_id, now.isoformat(), expires.isoformat()),
        )
        conn.commit()
    return token


def verify_doctor_session(token: str) -> dict[str, Any] | None:
    if not token:
        return None
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT d.id, d.name, d.title, d.email
            FROM doctor_sessions s
            JOIN doctors d ON s.doctor_id = d.id
            WHERE s.token = ? AND s.expires_at > ?
            """,
            (token, now_iso),
        ).fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "name": row["name"],
            "title": row["title"],
            "email": row["email"],
        }


def revoke_doctor_session(token: str) -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM doctor_sessions WHERE token = ?", (token,))
        conn.commit()


def save_assessment(
    inputs: dict[str, Any],
    prediction: dict[str, Any],
    explanation: dict[str, Any] | None = None,
    patient_name: str = "Anonymous Patient",
    report_source: str | None = None,
    assessment_id: str | None = None,
    patient_session_id: str | None = None,
    patient_email: str | None = None,
    patient_id: str | None = None,
) -> tuple[str, str]:
    aid = assessment_id or f"CV-{uuid.uuid4().hex[:8].upper()}"
    sess_id = patient_session_id or f"PSESS-{secrets.token_urlsafe(16)}"
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO assessments (
                id, created_at, patient_name, inputs_json, prediction_json, explanation_json, report_source, patient_session_id, patient_email, patient_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                aid,
                now,
                patient_name,
                json.dumps(inputs),
                json.dumps(prediction),
                json.dumps(explanation) if explanation else None,
                report_source,
                sess_id,
                patient_email,
                patient_id,
            ),
        )
        conn.commit()
    return aid, sess_id


def get_assessment(assessment_id: str) -> dict[str, Any] | None:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM assessments WHERE id = ?", (assessment_id,)).fetchone()
        if not row:
            return None
        review_row = conn.execute(
            "SELECT * FROM clinician_reviews WHERE assessment_id = ? ORDER BY created_at DESC LIMIT 1",
            (assessment_id,),
        ).fetchone()

        review = None
        if review_row:
            review = {
                "id": review_row["id"],
                "doctor_name": review_row["doctor_name"],
                "doctor_title": review_row["doctor_title"],
                "summary": review_row["summary"],
                "advice": review_row["advice"],
                "follow_up": review_row["follow_up"],
                "status": review_row["status"],
                "created_at": review_row["created_at"],
            }

        return {
            "id": row["id"],
            "created_at": row["created_at"],
            "patient_name": row["patient_name"],
            "patient_session_id": row["patient_session_id"],
            "patient_email": row["patient_email"],
            "patient_id": row["patient_id"],
            "inputs": json.loads(row["inputs_json"]),
            "prediction": json.loads(row["prediction_json"]),
            "explanation": json.loads(row["explanation_json"]) if row["explanation_json"] else None,
            "report_source": row["report_source"],
            "review": review,
        }


def list_patient_assessments(patient_session_id: str) -> list[dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.execute(
            """
            SELECT a.id, a.created_at, a.patient_name, a.inputs_json, a.prediction_json, a.report_source,
                   r.id AS review_id, r.doctor_name, r.status AS review_status
            FROM assessments a
            LEFT JOIN clinician_reviews r ON a.id = r.assessment_id
            WHERE a.patient_session_id = ?
            ORDER BY a.created_at DESC
            """,
            (patient_session_id,),
        )
        items = []
        for row in cursor.fetchall():
            items.append({
                "id": row["id"],
                "created_at": row["created_at"],
                "patient_name": row["patient_name"],
                "inputs": json.loads(row["inputs_json"]),
                "prediction": json.loads(row["prediction_json"]),
                "report_source": row["report_source"],
                "is_reviewed": bool(row["review_id"]),
                "doctor_name": row["doctor_name"],
                "review_status": row["review_status"] or "Pending Review",
            })
        return items


def list_assessments(limit: int = 50) -> list[dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.execute(
            """
            SELECT a.id, a.created_at, a.patient_name, a.inputs_json, a.prediction_json, a.report_source,
                   r.id AS review_id, r.doctor_name, r.status AS review_status
            FROM assessments a
            LEFT JOIN clinician_reviews r ON a.id = r.assessment_id
            ORDER BY a.created_at DESC
            LIMIT ?
            """,
            (limit,),
        )
        items = []
        for row in cursor.fetchall():
            items.append({
                "id": row["id"],
                "created_at": row["created_at"],
                "patient_name": row["patient_name"],
                "inputs": json.loads(row["inputs_json"]),
                "prediction": json.loads(row["prediction_json"]),
                "report_source": row["report_source"],
                "is_reviewed": bool(row["review_id"]),
                "doctor_name": row["doctor_name"],
                "review_status": row["review_status"] or "Pending Review",
            })
        return items


def save_clinician_review(
    assessment_id: str,
    doctor_name: str,
    doctor_title: str,
    summary: str,
    advice: str,
    follow_up: str = "",
    status: str = "Completed",
) -> dict[str, Any]:
    review_id = f"REV-{uuid.uuid4().hex[:6].upper()}"
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO clinician_reviews (id, assessment_id, created_at, doctor_name, doctor_title, summary, advice, follow_up, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (review_id, assessment_id, now, doctor_name, doctor_title, summary, advice, follow_up, status),
        )
        conn.commit()

    return {
        "id": review_id,
        "assessment_id": assessment_id,
        "doctor_name": doctor_name,
        "doctor_title": doctor_title,
        "summary": summary,
        "advice": advice,
        "follow_up": follow_up,
        "status": status,
        "created_at": now,
    }


def save_notification(
    notification_id: str,
    assessment_id: str,
    recipient_email: str,
    status: str,
    provider: str,
    error_message: str | None = None,
    sent_at: str | None = None,
) -> dict[str, Any]:
    now = sent_at or datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO notifications (id, assessment_id, recipient_email, status, provider, error_message, sent_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (notification_id, assessment_id, recipient_email, status, provider, error_message, now),
        )
        conn.commit()

    return {
        "id": notification_id,
        "assessment_id": assessment_id,
        "recipient_email": recipient_email,
        "status": status,
        "provider": provider,
        "error_message": error_message,
        "sent_at": now,
    }


def get_notifications(assessment_id: str) -> list[dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.execute(
            """
            SELECT * FROM notifications WHERE assessment_id = ? ORDER BY sent_at DESC
            """,
            (assessment_id,),
        )
        return [dict(row) for row in cursor.fetchall()]
