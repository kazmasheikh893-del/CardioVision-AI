"""Configurable email and notification service for CardioVision AI."""

from __future__ import annotations

import os
import re
import smtplib
import uuid
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from . import storage_service

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


class NotificationError(ValueError):
    """Raised when notification parameters are invalid or consent is missing."""


def validate_email_address(email: str) -> str:
    cleaned = email.strip()
    if not EMAIL_REGEX.match(cleaned):
        raise NotificationError(f"Invalid recipient email address format: '{email}'.")
    return cleaned


def send_patient_notification(
    assessment_id: str,
    recipient_email: str,
    patient_consent: bool,
    patient_name: str = "Valued Patient",
) -> dict[str, Any]:
    """
    Sends a privacy-preserving email notification directing the patient to the secure portal.
    Medical indicators and prediction specifics are deliberately omitted from the email body
    to protect patient confidentiality.
    """
    if not patient_consent:
        raise NotificationError("Patient consent is required before dispatching email notifications.")

    clean_email = validate_email_address(recipient_email)
    assessment = storage_service.get_assessment(assessment_id)
    if not assessment:
        raise NotificationError(f"Assessment {assessment_id} was not found.")

    notification_id = f"NOTIF-{uuid.uuid4().hex[:8].upper()}"
    now_iso = datetime.now(timezone.utc).isoformat()

    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    sender_email = os.getenv("NOTIFICATION_SENDER", "noreply@cardiovision.ai")

    has_doctor_review = bool(assessment.get("review"))
    subject = f"CardioVision AI: Update Available for Assessment {assessment_id}"
    body_text = (
        f"Dear {patient_name},\n\n"
        f"An update is available regarding your CardioVision AI assessment (Reference: {assessment_id}).\n\n"
        f"Status: {'Doctor Clinical Review Completed' if has_doctor_review else 'Assessment Recorded - Awaiting Clinician Review'}\n\n"
        "To protect your privacy and sensitive health data, specific clinical findings are not included in this email.\n"
        "Please visit the secure CardioVision AI Patient Portal to review your summary, educational 3D heart visualizations, and clinician recommendations.\n\n"
        "CardioVision AI Health Intelligence Team\n"
        "Disclaimer: CardioVision AI predictions are research estimates and do not replace formal medical evaluation."
    )

    delivery_status = "Pending"
    error_msg = None
    provider = "SMTP" if smtp_host else "LocalDevDispatcher"

    if smtp_host and smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = sender_email
            msg["To"] = clean_email
            msg.attach(MIMEText(body_text, "plain"))

            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(sender_email, [clean_email], msg.as_string())
            delivery_status = "Delivered"
        except Exception as exc:
            delivery_status = "Failed"
            error_msg = str(exc)
    else:
        # Development / Demonstration dispatch ledger
        delivery_status = "Simulated / Dev Dispatched"

    # Persist in SQLite notification audit log
    record = storage_service.save_notification(
        notification_id=notification_id,
        assessment_id=assessment_id,
        recipient_email=clean_email,
        status=delivery_status,
        provider=provider,
        error_message=error_msg,
        sent_at=now_iso,
    )

    return record
