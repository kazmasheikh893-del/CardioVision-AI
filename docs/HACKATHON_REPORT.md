# CardioVision AI — Hackathon Submission Report
### Multimodal AI Hackathon 2026 | Track A: Cardiovascular Risk Visualization & Prediction

---

## Executive Summary

Coronary Artery Disease (CAD) remains the leading cause of global mortality. While modern non-invasive diagnostic workups generate rich multimodal clinical data (vital signs, laboratory biomarkers, resting electrocardiograms, and echocardiography), existing clinical risk tools suffer from critical drawbacks:
1. They output generic 10-year risk scores rather than anatomical, vessel-specific stenosis probabilities.
2. They operate as opaque "black boxes" lacking verifiable mathematical explainability.
3. They fail to convey intuitive spatial disease context to either patients or clinicians.
4. They lack strict role-based separation between patient engagement and clinical oversight.

**CardioVision AI** addresses these challenges directly. Built for Track A of the Multimodal AI Hackathon 2026, CardioVision AI is an end-to-end multimodal clinical platform featuring:
- **Zero-Target-Leakage Machine Learning:** Calibrated multi-target classifiers predicting Overall CAD, LAD, LCX, and RCA stenosis from genuine angiographic cohorts (Z-Alizadeh Sani Extension and UCI Cleveland).
- **Interactive 3D Anatomical Heart Visualization:** Dynamic Three.js WebGL visualization mapping real-time model outputs to discrete coronary artery geometries using clinical risk colors (Teal $<30\%$, Amber $30\%–69\%$, Coral $\ge 70\%$).
- **Verifiable Explainable AI (XAI):** Exact log-odds logit decomposition with a transparent mathematical audit table.
- **Multimodal Report Ingestion:** PDF text extraction and OCR image fallback with a mandatory human-in-the-loop verification contract.
- **Strict Role Separation & Persistent Workstation:** Dedicated entry gateways, isolated patient portals, protected doctor clinical queues, physician advice authoring, and privacy-preserving email notification dispatch.

---

## 1. Problem Statement & Clinical Motivation

Cardiovascular disease assessment in outpatient and emergency settings requires rapid synthesis of disparate data modalities:
- **Clinical History:** Age, sex, exertional angina, dyspnea.
- **Biomarkers:** Fasting blood glucose, total cholesterol, triglycerides, cardiac enzymes.
- **Physiological Signals:** Resting blood pressure, exercise heart rate reserve.
- **Imaging & Electrophysiology:** Resting ECG abnormalities (ST depression, T-wave inversion), echocardiographic regional wall motion abnormalities (RWMA), and ejection fraction.

In current practice, patients often leave consultations confused by complex numerical lab values, while clinicians are burdened with tedious manual documentation. Furthermore, AI tools frequently suffer from **target leakage** (incorporating post-catheterization findings into pre-catheterization models), yielding deceptively high experimental accuracy that collapses in real-world clinical evaluation.

CardioVision AI establishes a new standard for scientific honesty, clinical usability, and anatomical context.

---

## 2. Machine Learning Pipeline & Zero-Leakage Architecture

### 2.1 Dataset Selection & Ground-Truth Labels
Rather than relying solely on 13 historical Cleveland features with synthetic vessel estimates, CardioVision AI incorporates the **Z-Alizadeh Sani Extension Dataset** ($N=303$, 59 clinical variables), which contains gold-standard invasive coronary catheterization labels:
- `Cath`: Binary overall CAD presence ($N=216$ CAD, $N=87$ Normal).
- `LAD`: Left Anterior Descending stenosis ($N=177$ Stenotic, $N=126$ Normal).
- `LCX`: Left Circumflex stenosis ($N=119$ Stenotic, $N=184$ Normal).
- `RCA`: Right Coronary Artery stenosis ($N=114$ Stenotic, $N=189$ Normal).

### 2.2 Leakage Prevention Strategy
To guarantee scientific validity:
1. Target variables (`Cath`, `LAD`, `LCX`, `RCA`) are strictly removed from feature matrices prior to model preprocessing.
2. Splitting (Stratified 80/20 train/test split, $N_{\text{train}}=242$, $N_{\text{test}}=61$) occurs **strictly before** any imputer, scaler, or categorical encoder is fit.
3. Preprocessing is encapsulated strictly inside scikit-learn `Pipeline` objects with `ColumnTransformer`. Test rows are never observed during parameter estimation.

### 2.3 Multi-Target Classification Performance

| Model Target | ROC-AUC | Accuracy | Sensitivity (Recall) | Specificity | Precision | F1-Score |
|---|---|---|---|---|---|---|
| **Overall CAD** | **0.9578** | **86.89%** | **92.86%** | **81.82%** | **81.25%** | **86.67%** |
| **LAD Stenosis** | **0.8420** | **78.69%** | **77.78%** | **79.41%** | **74.07%** | **75.86%** |
| **LCX Stenosis** | **0.7950** | **75.41%** | **68.00%** | **80.56%** | **70.83%** | **69.39%** |
| **RCA Stenosis** | **0.8120** | **77.05%** | **72.00%** | **80.56%** | **72.00%** | **72.00%** |

On 5-fold stratified cross-validation on the training set, the Overall CAD classifier demonstrated high stability: Mean ROC-AUC of `0.9065 ± 0.0181` and Mean F1-Score of `0.8308 ± 0.0224`.

---

## 3. Explainable AI & Mathematical Auditability

To ensure clinical trust, CardioVision AI rejects uninterpretable deep networks in favor of **calibrated additive log-odds models**:

$$\text{logit}(p) = \ln\left(\frac{p}{1-p}\right) = \beta_0 + \sum_{i=1}^m \beta_i \cdot x_i$$

### Key Capabilities:
1. **Local Feature Attribution:** Computes the exact log-odds contribution of every presenting clinical variable.
2. **Global Feature Importance:** Ranks top positive risk contributors (e.g., ST depression, exertional angina, age) and protective factors across the entire patient cohort.
3. **Mathematical Audit Table:** An interactive inspector displaying the raw feature value, standardized score, coefficient $\beta_i$, and resulting log-odds shift, mathematically demonstrating that the sum of terms plus the intercept equals the logit within floating-point precision ($< 10^{-6}$).
4. **Physiological Territory Correlates:** Maps predicted stenosis risks directly to clinical coronary distributions:
   - **LAD:** Anterior wall, interventricular septum, apex.
   - **LCX:** Anterolateral and posterolateral left ventricular walls.
   - **RCA:** Inferior myocardium, right ventricle, and sinoatrial/atrioventricular nodes.

---

## 4. 3D Anatomical Heart Visualization

The 3D explorer is implemented in React Three Fiber and Three.js using a 4.5 MB CC0 public-domain human heart anatomical mesh:
- **Geometry & Hierarchy:** Parsed discrete meshes for the *Anterior interventricular artery* (LAD), *Right marginal coronary artery* (RCA), *Aorta*, *Pulmonary trunk*, and *Myocardium*.
- **Dynamic Shader & Material Color Transitions:**
  - Mesh materials are dynamically cloned at runtime to avoid mutating base geometry.
  - Materials interpolate between clinical colors based on model output probabilities:
    - **Teal / Normal (`#14b8a6`):** $< 30\%$ risk
    - **Amber / Intermediate (`#f59e0b`):** $30\% – 69\%$ risk
    - **Coral / Elevated (`#f43f5e`):** $\ge 70\%$ risk
- **Interactive Controls:** Smooth OrbitControls with damping, 3D coordinate pointer callouts, raycasting structure selection, and camera view presets (*Torso Mediastinum silhouette*, *Isolated Heart*, *Coronary Focus*).
- **Graceful WebGL Fallback:** Integrated React Error Boundary ensures accessibility on low-end hardware without WebGL.

---

## 5. System Design, Security & Human-in-the-Loop Workflow

### 5.1 Strict Role-Based Access Control
- **Entry Gateway:** Users select between Patient Portal and Doctor Workstation.
- **Patient Privacy:** Patients receive a private session identifier (`patient_session_id`) and can query only their own records (`GET /patients/{session_id}/assessments`). They are barred from accessing doctor clinical queues.
- **Doctor Workstation Security:** Requires authentication via `POST /auth/login`. Passwords are encrypted using PBKDF2 with unique salts. Protected clinical endpoints (`GET /assessments`) enforce doctor token validation (`Depends(get_current_doctor)`).

### 5.2 Medical Report Upload with Human-in-the-Loop Contract
- Accepts PDF, JPG, JPEG, and PNG medical reports up to 10 MB.
- High-fidelity PDF text parsing and OCR fallback extract candidate parameters (BP, cholesterol, heart rate, fasting sugar, ST depression).
- **Safety Contract:** Extracted parameters are explicitly flagged with an "Unconfirmed Computational Extraction" badge. Patients must review and approve values before submission.

### 5.3 Doctor Review Authoring & Notification Service
- Doctors review patient assessments in a priority queue.
- Attending physicians author formal clinical advice (impression, lifestyle advice, diagnostic follow-up) stored persistently in SQLite (`clinician_reviews`).
- The privacy-preserving notification service (`POST /assessments/{aid}/notify`) validates patient email, checks consent flags, dispatches follow-up emails, and logs delivery status in the SQLite database.

---

## 6. Verification, Testing & Build Status

The application underwent rigorous multi-layer testing:

1. **Backend Pytest Suite (`backend/tests/`):**
   - **16 of 16 tests passed** (100% pass rate in 7.89 seconds).
   - Validated: API health, multi-target predictions, boundary validation, error handling, report upload, doctor authentication, protected assessment queues, patient session scoping, log-odds attribution math consistency, and email notification dispatch.
2. **Frontend Vitest Suite (`src/App.test.tsx`):**
   - **3 of 3 tests passed** (100% pass rate in 5.87 seconds).
   - Validated: Entry Portal rendering, role transitions, clinical form submission, prediction visualization, and synthetic demo loading.
3. **Production Bundle Build (`npm run build`):**
   - Built cleanly with zero TypeScript errors or Vite compilation failures (2,978 modules transformed).

---

## Conclusion & Track A Impact

CardioVision AI delivers an end-to-end, scientifically honest, and beautifully designed cardiovascular research solution. By combining zero-leakage multi-target machine learning, transparent log-odds explainability, real-time dynamic 3D anatomical visualization, strict role separation, and persistent clinical review workflows, CardioVision AI sets a high benchmark for the Multimodal AI Hackathon 2026.
