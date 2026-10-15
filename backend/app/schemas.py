"""Pydantic schemas for the CardioVision API."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from . import patient_service


class ClinicalInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    age: int = Field(..., ge=18, le=100)
    sex: Literal[0, 1]
    cp: Literal[1, 2, 3, 4]
    trestbps: int = Field(..., ge=80, le=220)
    chol: int = Field(..., ge=100, le=650)
    fbs: Literal[0, 1]
    restecg: Literal[0, 1, 2]
    thalach: int = Field(..., ge=60, le=230)
    exang: Literal[0, 1]
    oldpeak: float = Field(..., ge=0, le=7)
    slope: Literal[1, 2, 3]
    # `ca` and `thal` are the only features with missing values in the training data (4 and 2 rows) and the
    # trained pipeline imputes them (median / most-frequent). `null` therefore means "unknown / not tested"
    # and is handled by that same imputer – no value is invented here.
    ca: int | None = Field(default=None, ge=0, le=3)
    thal: Literal[3, 6, 7] | None = None

    @field_validator("oldpeak")
    @classmethod
    def oldpeak_precision(cls, value: float) -> float:
        return round(float(value), 2)


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool


class VesselPrediction(BaseModel):
    vessel: str
    name: str
    probability: float
    risk_level: str
    territory: str
    clinical_note: str


class PredictionResponse(BaseModel):
    prediction: int
    probability: float
    threshold: float
    label: str
    target_definition: str
    limitations: list[str]
    vessels: dict[str, VesselPrediction] = Field(default_factory=dict)


class DoctorLoginRequest(BaseModel):
    email: str
    password: str


class DoctorProfile(BaseModel):
    id: str
    name: str
    title: str
    email: str


class AuthTokenResponse(BaseModel):
    token: str
    doctor: DoctorProfile


class Contribution(BaseModel):
    feature: str
    contribution: float
    direction: str
    absolute: float


class DetailedContribution(BaseModel):
    transformed_feature: str
    base_feature: str
    value: float
    coefficient: float
    contribution: float


class GlobalFeatureImportance(BaseModel):
    feature: str
    importance: float
    coefficients: list[float]


class ExplanationResponse(BaseModel):
    probability: float
    logit: float
    intercept: float
    method: str
    contributions: list[Contribution]
    detailed_contributions: list[DetailedContribution] = Field(default_factory=list)
    global_importance: list[GlobalFeatureImportance] = Field(default_factory=list)
    caution: str


class AssessmentCreate(BaseModel):
    patient_name: str = "Anonymous Patient"
    patient_email: str | None = None
    patient_session_id: str | None = None
    inputs: ClinicalInput
    report_source: str | None = None


class ClinicianReviewCreate(BaseModel):
    doctor_name: str = Field(..., min_length=2)
    doctor_title: str = "Cardiology Specialist"
    summary: str = Field(..., min_length=5)
    advice: str = Field(..., min_length=10)
    follow_up: str = ""
    status: str = "Completed"


class PatientRegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str
    phone: str
    age: int
    password: str
    email: str | None = None

    @field_validator("full_name")
    @classmethod
    def _name(cls, v: str) -> str:
        return patient_service.validate_full_name(v)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return patient_service.normalize_phone(v)

    @field_validator("age")
    @classmethod
    def _age(cls, v: int) -> int:
        return patient_service.validate_age(v)

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        return patient_service.validate_password(v)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str | None) -> str | None:
        return patient_service.validate_email(v)


class PatientLoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    phone: str
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return patient_service.normalize_phone(v)


class PatientProfile(BaseModel):
    id: str
    full_name: str
    phone: str
    age: int
    email: str | None = None
    created_at: str


class PatientAuthResponse(BaseModel):
    token: str
    expires_at: str
    patient: PatientProfile


class PatientAssessmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    inputs: ClinicalInput
    report_source: str | None = Field(default=None, max_length=200)


class ReportUploadResponse(BaseModel):
    filename: str
    file_size: int
    raw_text_preview: str
    is_ocr: bool
    extracted_values: dict[str, Any]
    extraction_notes: list[str]
    status: str
    notice: str


class NotificationRequest(BaseModel):
    recipient_email: str
    patient_consent: bool = True
    patient_name: str = "Valued Patient"


class NotificationResponse(BaseModel):
    id: str
    assessment_id: str
    recipient_email: str
    status: str
    provider: str
    error_message: str | None = None
    sent_at: str
