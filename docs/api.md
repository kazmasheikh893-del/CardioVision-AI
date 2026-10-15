# CardioVision AI — REST API Documentation

Base URL for local development: `http://127.0.0.1:8000`

---

## 1. Machine Learning & Inference Endpoints

### `GET /health`
Returns backend health status, API version, and confirmation that the trained scikit-learn models are loaded into memory.

### `GET /model-info`
Returns the 13 feature definitions, descriptions, acceptable numerical bounds, categorical options, dataset statistics, and clinical limitations.

### `POST /predict`
Accepts 13 clinical physiological markers and computes binary coronary artery disease probability along with territory-specific stenosis predictions for the LAD, LCX, and RCA coronary branches.

**Input Payload:**
```json
{
  "age": 55,
  "sex": 1,
  "cp": 4,
  "trestbps": 140,
  "chol": 240,
  "fbs": 0,
  "restecg": 0,
  "thalach": 150,
  "exang": 1,
  "oldpeak": 1.5,
  "slope": 2,
  "ca": 0,
  "thal": 3
}
```

### `POST /explain`
Decomposes the model log-odds output into mathematical linear contributions ($w_i \cdot x_i$) for every input feature, explaining exactly why the risk score increased or decreased.

### `GET /evaluation`
Returns empirical holdout validation metrics (ROC-AUC 0.958, accuracy 86.9%, sensitivity 92.9%, specificity 81.8%), 5-fold cross-validation results, confusion matrix, calibration curve bins, and vessel model evaluations.

---

## 2. Patient Authentication & Private Portal Endpoints

### `POST /patient/register` (Status: 201)
Registers a new patient account with PBKDF2 password hashing (per-user salt).
- **Body**: `{"full_name": string, "phone": string, "age": int, "password": string, "email": string | null}`
- **Validation**: Full name (2–100 chars), E.164 phone with country code, age between 18 and 100, password min 8 characters.
- **Returns**: `{"token": string, "expires_at": string, "patient": PatientProfile}`

### `POST /patient/login` (Status: 200)
Authenticates a patient using phone number and password with constant-time verification and brute-force lockout protection.
- **Body**: `{"phone": string, "password": string}`
- **Returns**: Bearer session token and patient profile.

### `GET /patient/me` (Status: 200)
Returns current authenticated patient profile. Requires `Authorization: Bearer <token>`.

### `POST /patient/logout` (Status: 200)
Revokes the current session token from the SQLite database.

### `POST /patient/assessments` (Status: 201)
Runs a prediction for the authenticated patient and securely links the assessment record exclusively to their `patient_id`.
- Duplicate submissions within 60 seconds return the existing record with `"duplicate": true`.

### `GET /patient/assessments` (Status: 200)
Lists all assessments belonging to the authenticated patient. **Enforces IDOR protection**: query strictly filters by `patient_id` from the verified session token.

### `GET /patient/assessments/{assessment_id}` (Status: 200)
Retrieves a specific assessment for the authenticated patient. Returns 404 if the record does not exist or belongs to another patient, preventing enumeration attacks.

---

## 3. Clinician Workstation & Decision Support Endpoints

### `POST /auth/login` (Status: 200)
Clinician authentication.
- **Default Seed Account**: `doctor@cardiovision.ai` / `CardioVision2026!`
- **Returns**: Clinician session bearer token and profile.

### `GET /auth/me` (Status: 200)
Returns authenticated clinician information. Requires clinician bearer token.

### `GET /assessments` (Status: 200)
Protected endpoint: returns the complete patient assessment queue for clinician review. Unauthenticated requests are rejected with HTTP 401.

### `POST /assessments/{assessment_id}/review` (Status: 200)
Allows an authorized cardiologist to author and attach clinical advice, follow-up timeline, and validation status to an assessment.

### `POST /assessments/{assessment_id}/notify` (Status: 200)
Dispatches patient email notifications containing doctor recommendations upon verified patient consent.
- Enforces strict email format validation and consent verification before dispatch.

### `POST /upload-report` (Status: 200)
Accepts medical PDF or scanned document, extracts numerical lab parameters using regex and layout heuristics, and maps them to clinical input parameters.
