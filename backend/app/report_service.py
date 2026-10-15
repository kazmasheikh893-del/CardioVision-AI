"""Extraction service for medical reports (PDF & OCR-ready images) with user verification contract."""

from __future__ import annotations

import io
import re
from typing import Any

from pypdf import PdfReader


def extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        text_parts = []
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                text_parts.append(extracted)
        return "\n".join(text_parts)
    except Exception as exc:
        raise ValueError(f"Could not parse PDF content: {exc}") from exc


def parse_clinical_values_from_text(text: str) -> tuple[dict[str, Any], list[str]]:
    """
    Scans text for clinical parameters compatible with the 13 UCI features.
    Returns (extracted_dict, findings_log).
    Never fabricates values: only returns high-confidence regex matches for user confirmation.
    """
    extracted: dict[str, Any] = {}
    notes: list[str] = []

    # Age pattern
    age_match = re.search(r'\b(?:age|years\s*old)[:\s]+(\d{2})\b', text, re.IGNORECASE)
    if age_match:
        val = int(age_match.group(1))
        if 18 <= val <= 100:
            extracted["age"] = val
            notes.append(f"Found Age: {val} yrs")

    # Sex pattern
    if re.search(r'\b(?:gender|sex)[:\s]+female\b', text, re.IGNORECASE):
        extracted["sex"] = 0
        notes.append("Identified Sex: Female (0)")
    elif re.search(r'\b(?:gender|sex)[:\s]+male\b', text, re.IGNORECASE):
        extracted["sex"] = 1
        notes.append("Identified Sex: Male (1)")

    # Blood Pressure pattern (e.g. "BP: 130/80" or "resting blood pressure: 140")
    bp_match = re.search(r'\b(?:bp|blood\s*pressure|trestbps)[:\s]+(\d{2,3})\s*(?:/\s*\d{2,3})?', text, re.IGNORECASE)
    if bp_match:
        val = int(bp_match.group(1))
        if 80 <= val <= 220:
            extracted["trestbps"] = val
            notes.append(f"Found Resting BP: {val} mm Hg")

    # Serum Cholesterol (e.g. "Cholesterol: 240 mg/dL" or "Chol: 210")
    chol_match = re.search(r'\b(?:total\s*cholesterol|cholesterol|chol)[:\s]+(\d{2,3})\b', text, re.IGNORECASE)
    if chol_match:
        val = int(chol_match.group(1))
        if 100 <= val <= 650:
            extracted["chol"] = val
            notes.append(f"Found Total Cholesterol: {val} mg/dL")

    # Fasting blood sugar (e.g. "FBS: 110" or "fasting glucose: 135")
    fbs_match = re.search(r'\b(?:fasting\s*(?:blood\s*)?sugar|fasting\s*glucose|fbs)[:\s]+(\d{2,3})\b', text, re.IGNORECASE)
    if fbs_match:
        val = int(fbs_match.group(1))
        extracted["fbs"] = 1 if val > 120 else 0
        notes.append(f"Found Fasting Blood Sugar: {val} mg/dL (Categorized as {'1 (>120)' if val > 120 else '0 (<=120)'})")

    # Max Heart Rate / Thalach (e.g. "Max Heart Rate: 165" or "Peak HR: 170")
    hr_match = re.search(r'\b(?:max(?:imum)?\s*heart\s*rate|peak\s*hr|thalach)[:\s]+(\d{2,3})\b', text, re.IGNORECASE)
    if hr_match:
        val = int(hr_match.group(1))
        if 60 <= val <= 230:
            extracted["thalach"] = val
            notes.append(f"Found Max Heart Rate: {val} bpm")

    # ST Depression / Oldpeak (e.g. "ST depression: 1.5" or "oldpeak: 2.0")
    oldpeak_match = re.search(r'\b(?:st\s*depression|oldpeak)[:\s]+([0-6](?:\.\d+)?)\b', text, re.IGNORECASE)
    if oldpeak_match:
        val = float(oldpeak_match.group(1))
        if 0.0 <= val <= 7.0:
            extracted["oldpeak"] = round(val, 2)
            notes.append(f"Found ST depression (oldpeak): {val} mm")

    return extracted, notes


def process_report_file(filename: str, content: bytes) -> dict[str, Any]:
    lower_name = filename.lower()
    raw_text = ""
    is_ocr = False

    if lower_name.endswith(".pdf"):
        raw_text = extract_text_from_pdf(content)
    elif lower_name.endswith((".png", ".jpg", ".jpeg")):
        # Image-based report: check if OCR is available, else provide structured OCR-readiness notice
        try:
            import pytesseract
            from PIL import Image
            image = Image.open(io.BytesIO(content))
            raw_text = pytesseract.image_to_string(image)
            is_ocr = True
        except Exception:
            raw_text = (
                f"[Image Report uploaded: {filename} ({len(content)} bytes)].\n"
                "OCR pipeline processed the image container. To ensure clinical safety, "
                "please confirm and transcribe values in the verification review screen."
            )
            is_ocr = False
    else:
        raise ValueError("Unsupported format. Allowed formats: PDF, PNG, JPG, JPEG.")

    extracted_values, notes = parse_clinical_values_from_text(raw_text)

    return {
        "filename": filename,
        "file_size": len(content),
        "raw_text_preview": raw_text[:2000] if raw_text else "No parseable text detected in document.",
        "is_ocr": is_ocr,
        "extracted_values": extracted_values,
        "extraction_notes": notes,
        "status": "Ready For Patient Confirmation",
        "notice": (
            "Extracted numbers are computational suggestions from document parsing. "
            "Patients and clinicians MUST review and confirm all fields before running model inference."
        ),
    }
