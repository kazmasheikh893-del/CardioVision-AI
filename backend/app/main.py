from fastapi import Depends, FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import model_service, notification_service, patient_service, report_service, storage_service
from .schemas import (
    AssessmentCreate,
    AuthTokenResponse,
    ClinicalInput,
    ClinicianReviewCreate,
    DoctorLoginRequest,
    DoctorProfile,
    ExplanationResponse,
    HealthResponse,
    NotificationRequest,
    NotificationResponse,
    PatientAssessmentCreate,
    PatientAuthResponse,
    PatientLoginRequest,
    PatientProfile,
    PatientRegisterRequest,
    PredictionResponse,
    ReportUploadResponse,
)

app = FastAPI(
    title="CardioVision AI API",
    version="1.0.0",
    description="Clinical intelligence API for UCI Heart Disease & Z-Alizadeh Sani prediction, explanation, and clinician reviews.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    """Return field-level 422 errors without echoing submitted values (which may include passwords)."""
    errors = []
    for err in exc.errors():
        msg = str(err.get("msg", "Invalid value"))
        if msg.startswith("Value error, "):
            msg = msg[len("Value error, "):]
        errors.append({"loc": list(err.get("loc", [])), "msg": msg, "type": err.get("type", "value_error")})
    return JSONResponse(status_code=422, content=jsonable_encoder({"detail": errors}))


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    try:
        model_service.load_artifact()
        loaded = True
    except model_service.ModelNotReadyError:
        loaded = False
    return HealthResponse(status="ok", model_loaded=loaded)


@app.get("/model-info")
async def model_info() -> dict:
    try:
        evaluation = model_service.load_evaluation()
        artifact = model_service.load_artifact()
    except model_service.ModelNotReadyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        "name": "CardioVision AI Heart Disease Prototype",
        "model_type": artifact["model_type"],
        "features": artifact["features"],
        "target_definition": artifact["target_definition"],
        "dataset": evaluation["dataset"],
        "split": evaluation["split"],
        "limitations": evaluation["limitations"],
    }


@app.post("/predict", response_model=PredictionResponse)
async def predict(input_data: ClinicalInput) -> dict:
    try:
        return model_service.predict(input_data.model_dump())
    except model_service.ModelNotReadyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/explain", response_model=ExplanationResponse)
async def explain(input_data: ClinicalInput) -> dict:
    try:
        return model_service.explain(input_data.model_dump())
    except model_service.ModelNotReadyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/evaluation")
async def evaluation() -> dict:
    try:
        return model_service.load_evaluation()
    except model_service.ModelNotReadyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


# --- Authentication Middleware ---

def _bearer(authorization: str | None) -> str | None:
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "", 1).strip()
    return token or None


def get_current_doctor(authorization: str | None = Header(default=None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required. Please sign in as a clinician.")
    token = authorization.replace("Bearer ", "").strip()
    doctor = storage_service.verify_doctor_session(token)
    if not doctor:
        raise HTTPException(status_code=401, detail="Session expired or invalid token. Please sign in again.")
    return doctor


def get_optional_doctor(authorization: str | None = Header(default=None)) -> dict | None:
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "").strip()
    return storage_service.verify_doctor_session(token)


def get_current_patient(authorization: str | None = Header(default=None)) -> dict:
    token = _bearer(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Please sign in to the patient portal.")
    patient = patient_service.verify_session(token)
    if not patient:
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")
    return patient


def get_optional_patient(authorization: str | None = Header(default=None)) -> dict | None:
    return patient_service.verify_session(_bearer(authorization))


# --- Patient Portal: accounts and patient-scoped data ---

def _auth_response(patient: dict) -> dict:
    token, expires_at = patient_service.create_session(patient["id"])
    return {"token": token, "expires_at": expires_at, "patient": patient}


@app.post("/patient/register", response_model=PatientAuthResponse, status_code=201)
async def patient_register(data: PatientRegisterRequest) -> dict:
    try:
        patient = patient_service.register_patient(
            full_name=data.full_name, phone=data.phone, age=data.age, password=data.password, email=data.email
        )
    except patient_service.PatientAuthError as err:
        raise HTTPException(status_code=err.status_code, detail=str(err)) from err
    return _auth_response(patient)


@app.post("/patient/login", response_model=PatientAuthResponse)
async def patient_login(data: PatientLoginRequest) -> dict:
    try:
        patient = patient_service.authenticate_patient(data.phone, data.password)
    except patient_service.PatientAuthError as err:
        raise HTTPException(status_code=err.status_code, detail=str(err)) from err
    return _auth_response(patient)


@app.get("/patient/me", response_model=PatientProfile)
async def patient_me(patient: dict = Depends(get_current_patient)) -> dict:
    return patient


@app.post("/patient/logout")
async def patient_logout(authorization: str | None = Header(default=None)) -> dict:
    patient_service.revoke_session(_bearer(authorization))
    return {"status": "Signed out"}


@app.get("/patient/assessments")
async def patient_list_assessments(patient: dict = Depends(get_current_patient)) -> list[dict]:
    return patient_service.list_assessments(patient["id"])


@app.get("/patient/assessments/{assessment_id}")
async def patient_get_assessment(assessment_id: str, patient: dict = Depends(get_current_patient)) -> dict:
    record = patient_service.get_assessment(patient["id"], assessment_id)
    if not record:
        # Same response whether the id does not exist or belongs to someone else.
        raise HTTPException(status_code=404, detail="Assessment not found.")
    return record


@app.post("/patient/assessments", status_code=201)
async def patient_create_assessment(data: PatientAssessmentCreate, patient: dict = Depends(get_current_patient)) -> dict:
    """Run the real ML pipeline and store the result for the authenticated patient only."""
    payload = data.inputs.model_dump()
    duplicate = patient_service.find_recent_duplicate(patient["id"], payload)
    if duplicate:
        return {**duplicate, "duplicate": True}
    try:
        prediction = model_service.predict(payload)
        explanation = model_service.explain(payload)
    except model_service.ModelNotReadyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    aid, _ = storage_service.save_assessment(
        inputs=payload,
        prediction=prediction,
        explanation=explanation,
        patient_name=patient["full_name"],
        report_source=data.report_source or "Manual Entry",
        patient_email=patient.get("email"),
        patient_id=patient["id"],
    )
    record = patient_service.get_assessment(patient["id"], aid)
    return {**(record or {}), "duplicate": False}


# --- Assessment persistence endpoints (clinician and legacy routes, now access-controlled) ---

@app.post("/assessments")
async def create_assessment(
    data: AssessmentCreate,
    doctor: dict | None = Depends(get_optional_doctor),
    patient: dict | None = Depends(get_optional_patient),
) -> dict:
    """Clinician workstation / research entry. Patients use `/patient/assessments`; anonymous writes are refused."""
    if not doctor and not patient:
        raise HTTPException(status_code=401, detail="Authentication required to save an assessment.")
    try:
        payload = data.inputs.model_dump()
        prediction = model_service.predict(payload)
        explanation = model_service.explain(payload)
        aid, sess_id = storage_service.save_assessment(
            inputs=payload,
            prediction=prediction,
            explanation=explanation,
            # A signed-in patient can only ever save under their own identity.
            patient_name=patient["full_name"] if patient and not doctor else data.patient_name,
            report_source=data.report_source,
            patient_session_id=data.patient_session_id,
            patient_email=patient.get("email") if patient and not doctor else data.patient_email,
            patient_id=patient["id"] if patient and not doctor else None,
        )
        return {
            "assessment_id": aid,
            "patient_session_id": sess_id,
            "prediction": prediction,
            "explanation": explanation,
            "patient_name": patient["full_name"] if patient and not doctor else data.patient_name,
            "status": "Saved",
        }
    except model_service.ModelNotReadyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/assessments")
async def list_all_assessments(
    limit: int = 50,
    doctor: dict = Depends(get_current_doctor),
) -> list[dict]:
    """Protected clinician endpoint: lists pending and completed patient assessment queue."""
    return storage_service.list_assessments(limit=limit)


@app.get("/assessments/{assessment_id}")
async def get_single_assessment(
    assessment_id: str,
    doctor: dict | None = Depends(get_optional_doctor),
    patient: dict | None = Depends(get_optional_patient),
) -> dict:
    if not doctor and not patient:
        raise HTTPException(status_code=401, detail="Authentication required.")
    assessment = storage_service.get_assessment(assessment_id)
    if doctor:
        if not assessment:
            raise HTTPException(status_code=404, detail=f"Assessment {assessment_id} not found.")
        return assessment
    # Patient caller: only their own record, in the patient-safe shape.
    record = patient_service.get_assessment(patient["id"], assessment_id) if patient else None
    if not record:
        raise HTTPException(status_code=404, detail=f"Assessment {assessment_id} not found.")
    return record


@app.get("/patients/{patient_id}/assessments")
async def get_patient_assessments(patient_id: str, patient: dict = Depends(get_current_patient)) -> list[dict]:
    """Legacy path kept for compatibility. A patient may only read their own history."""
    if patient_id != patient["id"]:
        raise HTTPException(status_code=403, detail="You can only access your own records.")
    return patient_service.list_assessments(patient["id"])


@app.post("/auth/login", response_model=AuthTokenResponse)
async def login(credentials: DoctorLoginRequest) -> dict:
    doctor = storage_service.authenticate_doctor(credentials.email, credentials.password)
    if not doctor:
        raise HTTPException(status_code=401, detail="Invalid clinician email or password.")
    token = storage_service.create_doctor_session(doctor["id"])
    return {"token": token, "doctor": doctor}


@app.get("/auth/me")
async def current_clinician(doctor: dict = Depends(get_current_doctor)) -> dict:
    return doctor


@app.post("/auth/logout")
async def logout(authorization: str | None = Header(default=None)) -> dict:
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        storage_service.revoke_doctor_session(token)
    return {"status": "Logged out successfully"}


@app.post("/assessments/{assessment_id}/review")
async def add_clinician_review(
    assessment_id: str,
    review_data: ClinicianReviewCreate,
    doctor: dict = Depends(get_current_doctor),
) -> dict:
    """Only an authenticated clinician may author advice; patients see it only through their own record."""
    assessment = storage_service.get_assessment(assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail=f"Assessment {assessment_id} not found.")

    created_review = storage_service.save_clinician_review(
        assessment_id=assessment_id,
        doctor_name=doctor["name"],
        doctor_title=doctor["title"],
        summary=review_data.summary,
        advice=review_data.advice,
        follow_up=review_data.follow_up,
        status=review_data.status,
    )
    return created_review


# --- Email & Notification Dispatch Endpoints ---

@app.post("/assessments/{assessment_id}/notify", response_model=NotificationResponse)
async def notify_patient(
    assessment_id: str,
    req: NotificationRequest,
    doctor: dict = Depends(get_current_doctor),
) -> dict:
    try:
        record = notification_service.send_patient_notification(
            assessment_id=assessment_id,
            recipient_email=req.recipient_email,
            patient_consent=req.patient_consent,
            patient_name=req.patient_name,
        )
        return record
    except notification_service.NotificationError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to dispatch notification: {exc}") from exc


@app.get("/assessments/{assessment_id}/notifications")
async def list_notifications(assessment_id: str, doctor: dict = Depends(get_current_doctor)) -> list[dict]:
    return storage_service.get_notifications(assessment_id)


# --- Medical Document Report Upload ---

@app.post("/upload-report", response_model=ReportUploadResponse)
async def upload_medical_report(file: UploadFile = File(...)) -> dict:
    filename = file.filename or "unknown_report.pdf"
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds maximum 10MB limit.")
    try:
        result = report_service.process_report_file(filename, content)
        return result
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err)) from val_err
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process document: {exc}") from exc
