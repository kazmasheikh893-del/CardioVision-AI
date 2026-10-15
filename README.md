# CardioVision AI: Cardiovascular Risk Visualization & Prediction
### Multimodal AI Hackathon 2026 | Track A: Cardiovascular Risk Visualization & Prediction

[![Backend Pytest](https://img.shields.io/badge/Backend%20Pytest-17%2F17%20Passed%20(100%25)-teal)](backend/tests/)
[![Frontend Vitest](https://img.shields.io/badge/Frontend%20Vitest-Passed%20(100%25)-teal)](src/App.test.tsx)
[![Production Build](https://img.shields.io/badge/Vite%20Build-Success-brightgreen)](dist/)
[![Track A Compliance](https://img.shields.io/badge/Hackathon%20Track%20A-Complete-blue)](IMPLEMENTATION_CHECKLIST.md)

CardioVision AI is an end-to-end multimodal cardiovascular research platform that combines **zero-leakage multi-target machine learning**, a **premium 3D anatomical heart visualization** derived from the Human Reference Atlas (CC BY 4.0), **explainable AI (XAI)**, a **secure patient portal** with registration, authenticated sessions, IDOR protection, and private assessment history, and a **clinician workstation** with assessment triage queues, advice authoring, and privacy-preserving notifications.

---

## 🌟 Track A Key Innovations & Capabilities

1. **Multi-Target Coronary Artery Prediction (Zero Target Leakage):**
   - Independent calibrated classifiers for:
     - **Overall CAD** (Coronary Artery Disease presence)
     - **LAD Stenosis** (Left Anterior Descending artery)
     - **LCX Stenosis** (Left Circumflex artery)
     - **RCA Stenosis** (Right Coronary Artery)
   - Trained on the genuine **Z-Alizadeh Sani Extension Dataset** (303 records, 59 clinical parameters) with retrospective Cleveland fallback.
   - **Zero Leakage Guarantee:** Catheterization target labels (`Cath`, `LAD`, `LCX`, `RCA`) are strictly removed prior to feature transformation. All preprocessing steps (imputation, categorical encoding, scaling) are encapsulated strictly inside train-fitted scikit-learn `Pipeline` objects.

2. **Interactive 3D Anatomical Heart with Dynamic Vessel Risk Mapping:**
   - Real-time Three.js WebGL viewer using the **Human Reference Atlas (HRA) v1.3** female heart and coronary vasculature (`public/models/cardiovision-heart.glb`, CC BY 4.0).
   - Discrete, named coronary artery meshes for the **Left Anterior Descending (LAD)**, **Left Circumflex (LCX)**, and **Right Coronary Artery (RCA)**.
   - **Dynamic Shader Color Mapping:** Automatically transitions artery mesh colors based on model output probabilities:
     - **Cyan / Normal:** `< 30%` estimated stenosis likelihood
     - **Amber / Intermediate:** `30% – 69%` estimated stenosis likelihood
     - **Coral / Elevated:** `≥ 70%` estimated stenosis likelihood
   - Orbit controls, 6 preset anatomical camera orientations (Reset, Front, Left, Right, Back, Top, LAD focus), responsive vessel chips, and accessible text fallback for screen readers.

3. **Exactly Two Primary Landing Page Portals:**
   - **1. Patient Portal:** Dedicated patient experience with secure account registration, phone+password PBKDF2 authentication, private medical assessment history, plain-English summaries, and verified physician advice.
   - **2. Doctor Workstation:** Authenticated clinical gateway (`doctor@cardiovision.ai` / `CardioVision2026!`) with real-time patient queue, feature attribution inspection, and clinical advice authoring.
   - **Research Benchmarks & AI Explorer:** Seamlessly integrated within the Doctor Workstation rather than competing as a confusing third landing card.

4. **Robust Security & IDOR Protection:**
   - Patient authentication uses salted PBKDF2 password hashing, constant-time verification, and brute-force lockout.
   - Session tokens are stored only as SHA-256 digests.
   - All patient assessment queries strictly filter by the authenticated `patient_id` in SQL; attempts to access another patient's assessment return 404 without leaking existence.

5. **Medical Report Extraction with Human-in-the-Loop Contract:**
   - Drag-and-drop upload for PDF, JPG, JPEG, and PNG reports.
   - High-fidelity PDF text parsing and OCR image fallback scanning for clinical markers (blood pressure, cholesterol, resting heart rate, fasting glucose, ST depression).
   - **Verification Contract:** Extracted parameters are flagged as unconfirmed computational suggestions and require explicit patient review before being committed to prediction.

6. **Doctor Review Authoring & Privacy-Preserving Notifications:**
   - Doctors can author structured clinical advice (overall clinical impression, dietary/lifestyle recommendations, recommended diagnostic follow-up).
   - Advice is persistently stored in SQLite (`clinician_reviews` table) and surfaced directly to the patient's portal view.
   - **Notification Service:** Configurable email service with consent verification, email format validation, and delivery audit logging (`backend/app/notification_service.py`).

7. **Explainable AI (XAI) & Transparent Mathematics:**
   - Exact local log-odds logit decomposition ($\beta_0 + \sum \beta_i x_i = \text{logit}$).
   - Global feature importance ranking with positive/negative attribution badges.
   - Mathematical audit table demonstrating how raw clinical values translate into model probabilities.

---

## ⚕️ Important Medical Scope & Regulatory Status

> [!WARNING]
> **RESEARCH & EDUCATIONAL PROTOTYPE ONLY**
> 
> CardioVision AI is **not** an FDA/CE-cleared medical device, diagnostic tool, clinical triage system, treatment decision support software, or validated 10-year prospective cardiovascular risk calculator (such as Framingham or ASCVD estimators). It is trained strictly on historical retrospective data from angiographic databases (Z-Alizadeh Sani Extension and UCI Cleveland) to demonstrate transparent clinical AI methodologies. It must **not** be used for patient care or individual medical decisions.

---

## 🔑 Demo Doctor Credentials

For evaluator testing and hackathon review:

| Field | Value |
|---|---|
| **Doctor Email / ID** | `doctor@cardiovision.ai` |
| **Password** | `CardioVision2026!` |
| **Role** | Attending Cardiologist / Lead Investigator |

*(Patients do not require credentials; simply enter the Patient Portal from the Entry Gateway).*

---

## 🛠️ Technology Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide React
- **3D Visualization:** React Three Fiber, Three.js, Drei (`OrbitControls`, dynamic mesh materials)
- **Data Visualizations:** Recharts (ROC Curves, Calibration Quantiles, Log-Odds Decompositions, Confusion Matrices)
- **Backend API:** Python 3.13, FastAPI, Pydantic v2 (strict type validation)
- **Machine Learning & Preprocessing:** Scikit-learn, Pandas, NumPy, Joblib, PyPDF
- **Persistence:** SQLite with relational schema (`assessments`, `clinician_reviews`, `doctor_users`, `notifications`)
- **Automated Testing:** pytest (16 tests), Vitest (3 tests), AnyIO

---

## 🚀 Quick Start Guide (Windows PowerShell)

### 1. Prerequisites
- Python 3.10+ (tested on Python 3.13)
- Node.js 18+ (tested on Node.js 24)

### 2. Environment Setup

```powershell
# Navigate to repository
cd c:\Users\hp\AI_Learning\11_Projects\CardioVisionAI

# Activate Python virtual environment (if not already active)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install backend dependencies
python -m pip install -r requirements.txt

# Install frontend dependencies
npm install
```

### 3. Model Training & Preprocessing (Optional — Pre-trained artifacts included)

```powershell
python ml\train_model.py
```

### 4. Running the Application

Open two PowerShell windows:

**Terminal 1 — Backend API (Port 8000):**
```powershell
.\.venv\Scripts\Activate.ps1
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```
*Interactive Swagger API documentation: `http://127.0.0.1:8000/docs`*

**Terminal 2 — Frontend Interface (Port 5173):**
```powershell
npm run dev
```
*Application interface: `http://127.0.0.1:5173`*

---

## 🧪 Automated Testing & Verification

Run the complete test suite locally:

```powershell
# 1. Run backend unit & integration tests (16 tests)
python -m pytest backend/tests -v

# 2. Run frontend unit & workflow tests (3 tests)
npm test -- --run

# 3. Compile TypeScript & bundle production assets
npm run build
```

---

## 📊 Empirical Model Performance (Zero Leakage)

Holdout test set ($N=61$) and stratified 5-fold cross-validation results from `models/evaluation.json`:

| Model Target | ROC-AUC | Accuracy | Sensitivity (Recall) | Specificity | Precision | F1-Score |
|---|---|---|---|---|---|---|
| **Overall CAD** | **0.9578** | **86.89%** | **92.86%** | **81.82%** | **81.25%** | **86.67%** |
| **LAD Stenosis** | **0.8420** | **78.69%** | **77.78%** | **79.41%** | **74.07%** | **75.86%** |
| **LCX Stenosis** | **0.7950** | **75.41%** | **68.00%** | **80.56%** | **70.83%** | **69.39%** |
| **RCA Stenosis** | **0.8120** | **77.05%** | **72.00%** | **80.56%** | **72.00%** | **72.00%** |

*Note: 5-Fold Cross-Validation on training split for Overall CAD yielded Mean ROC-AUC of `0.9065 ± 0.0181` and Mean F1 of `0.8308 ± 0.0224`.*

---

## 📁 Repository Structure

```text
CardioVisionAI/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI routing, CORS, and endpoint definitions
│   │   ├── model_service.py         # Multi-target ML inference, log-odds XAI
│   │   ├── notification_service.py  # Email dispatch with consent & delivery logs
│   │   ├── schemas.py               # Pydantic v2 schemas for requests & responses
│   │   └── storage_service.py       # SQLite persistence, migrations & queries
│   └── tests/
│       ├── conftest.py              # Async test fixtures and test DB setup
│       ├── test_api.py              # End-to-end API integration & auth tests
│       └── test_model_service.py    # Inference, attribution math & error tests
├── data/
│   ├── raw/
│   │   ├── processed.cleveland.data        # UCI Cleveland dataset
│   │   └── z_alizadeh_sani_extension.xlsx # Ground-truth angiographic dataset
│   └── cardiovision.db              # SQLite relational database
├── docs/
│   ├── api.md                       # REST API specification
│   ├── architecture.md              # System design & architecture diagram
│   ├── asset-attribution.md         # CC0 3D heart model licensing details
│   ├── dataset-notes.md             # Dataset features & leakage prevention
│   ├── DEMO_OUTLINE.md              # 3-10 minute presentation guide
│   ├── HACKATHON_REPORT.md          # 6-page Track A comprehensive report
│   ├── model-card.md                # Clinical governance and empirical metrics
│   └── troubleshooting.md           # Setup FAQ and diagnostic steps
├── ml/
│   ├── feature_schema.py            # Clinical ranges, normal bounds & presets
│   └── train_model.py               # Zero-leakage scikit-learn training pipeline
├── models/
│   ├── cardiovision_pipeline.joblib # Trained scikit-learn pipeline artifact
│   └── evaluation.json              # Empirical evaluation metrics and ROC curves
├── public/models/
│   └── heart.glb                    # CC0 Public Domain 3D cardiovascular asset
├── src/
│   ├── components/
│   │   ├── AnatomyExplorer.tsx      # Three.js 3D viewer & dynamic vessel materials
│   │   ├── DoctorWorkstation.tsx    # Doctor review authoring & notification UI
│   │   ├── EntryPortalPage.tsx      # Gateway distinguishing patient & doctor
│   │   ├── EvaluationPanel.tsx      # Empirical ROC, calibration & confusion matrix
│   │   ├── ExplanationPanel.tsx     # Local log-odds decomposition & audit table
│   │   ├── PatientPortalView.tsx    # Plain-English patient summary & advice view
│   │   ├── PredictionPanel.tsx      # Clinical input form & multi-vessel meters
│   │   └── ReportUploadModal.tsx    # PDF/image report upload with review modal
│   ├── lib/api.ts                   # TypeScript API client & type declarations
│   ├── styles/index.css             # Tailwind design tokens & dark theme
│   ├── App.tsx                      # Main application router and state manager
│   └── App.test.tsx                 # Frontend Vitest test suite
├── package.json
├── pyproject.toml
├── requirements.txt
├── tailwind.config.js
└── vite.config.ts
```
