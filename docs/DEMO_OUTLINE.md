# CardioVision AI — Demonstration & Presentation Outline
### Multimodal AI Hackathon 2026 | Track A: Cardiovascular Risk Visualization & Prediction

This guide provides a structured, timed walkthrough for presenting CardioVision AI to hackathon judges and clinical evaluators.

---

## ⏱️ Quick Summary (3-Minute Elevator Pitch)

- **Minute 1: The Problem & The Gateway**
  - Point out that existing cardiovascular calculators give black-box 10-year risk numbers with no anatomical context.
  - Show the dark-themed Entry Portal Gateway: distinct Patient Portal and Doctor Workstation entry points with strict role separation.
- **Minute 2: Multimodal Input, 3D Dynamic Heart & Zero-Leakage ML**
  - Load a high-risk clinical case or upload a medical PDF report (highlighting the human-in-the-loop confirmation modal).
  - Submit the assessment: showcase the real-time multi-target predictions for Overall CAD, LAD, LCX, and RCA stenosis.
  - Interact with the 3D WebGL heart: show dynamic vessel color transitions (Teal $<30\%$, Amber $30\%–69\%$, Coral $\ge 70\%$) on the LAD and RCA meshes, camera presets, and 3D pointer callouts.
- **Minute 3: Explainable AI & Doctor Workflow**
  - Open the Explainability panel: show the exact log-odds mathematical decomposition ($\beta \times x$) and audit table.
  - Log in to the Doctor Workstation (`doctor@cardiovision.ai` / `CardioVision2026!`), show the protected assessment queue, author clinical advice, and dispatch a patient email notification.
  - Conclude with scientific integrity: 16/16 pytest tests passed, 3/3 vitest tests passed, and zero target leakage.

---

## ⏱️ Detailed Walkthrough (7–10 Minute Full Demonstration)

### Phase 1: Architecture & Scientific Foundation (Minutes 0:00 – 2:00)
1. **Introduction:**
   - Welcome the judges and state the track: Track A (Cardiovascular Risk Visualization & Prediction).
   - Clarify the scientific scope: Trained on the genuine Z-Alizadeh Sani Extension Dataset (303 angiographic records) and UCI Cleveland.
   - Highlight the **Zero-Leakage Guarantee**: Catheterization targets (`Cath`, `LAD`, `LCX`, `RCA`) are strictly excluded from input features; preprocessing pipelines are fitted exclusively on training splits.
2. **Design Philosophy:**
   - Highlight the dark medical-tech design system: `#080D18` canvas, `#0D1524` surfaces, clinical teal/cyan accents, and high-contrast typography.

### Phase 2: Patient Experience & Multimodal Report Ingestion (Minutes 2:00 – 4:30)
1. **Entry Portal Gateway:**
   - Click **Enter Patient Portal** (no password required; private patient session created).
2. **Medical Report Upload (OCR / PDF):**
   - Click **Upload Medical Report**.
   - Select a sample report (or drag-and-drop).
   - Point out the **Human-in-the-Loop Contract**: Extracted values are tagged with an unconfirmed badge, preventing unverified data from being used without user consent.
3. **Clinical Assessment Submission:**
   - Review or populate the grouped clinical parameters (Demographics, Vitals, Labs, ECG, Echocardiography).
   - Click **Evaluate Cardiovascular Risk**.
4. **Patient Portal View:**
   - Switch to the Patient Summary view: display the plain-English explanation, individual vessel risk estimates, and safety disclaimer.

### Phase 3: 3D Anatomical Heart Explorer (Minutes 4:30 – 6:30)
1. **Real-Time 3D WebGL Visualization:**
   - Showcase the 3D heart model rendered using Three.js and React Three Fiber.
   - Demonstrate the dynamic material color mapping:
     - LAD artery mesh tinted Coral ($\ge 70\%$) or Amber ($30\%–69\%$).
     - Normal vessels tinted Teal ($< 30\%$).
2. **Camera Controls & Presets:**
   - Demonstrate smooth orbit, pan, and zoom controls.
   - Switch between **Torso Mediastinum Silhouette**, **Isolated Heart**, and **Coronary Focus** camera presets.
3. **Interactive Raycasting & Correlates:**
   - Click on the coronary arteries to trigger 3D coordinate pointer callouts with anatomical and physiological territory details (e.g., LAD supplying the anterior wall and interventricular septum).

### Phase 4: Explainable AI & Model Governance (Minutes 6:30 – 8:00)
1. **Transparent Explainability:**
   - Navigate to the **Model Explanation** tab.
   - Explain the additive log-odds decomposition: $\text{logit} = \beta_0 + \sum \beta_i x_i$.
   - Review top risk factors (e.g., ST depression, chest pain type) and protective variables.
2. **Mathematical Audit Table:**
   - Show how the exact formula sums to the raw logit and transforms via sigmoid into the predicted probability.
3. **Research Evaluation Hub:**
   - Navigate to the **Research Hub** tab.
   - Review the empirical holdout ROC curves (CAD ROC-AUC: `0.9578`), 2x2 confusion matrix, and calibration quantile bins.

### Phase 5: Doctor Workstation & Clinical Governance (Minutes 8:00 – 10:00)
1. **Doctor Authentication:**
   - Log in using credentials:
     - **Email:** `doctor@cardiovision.ai`
     - **Password:** `CardioVision2026!`
2. **Protected Assessment Queue:**
   - Explain that patients cannot access this queue (`GET /assessments` enforces doctor token authentication).
   - Select the patient assessment from the list.
3. **Authoring Clinical Advice:**
   - Write clinical impression notes, lifestyle recommendations, and follow-up guidance.
   - Save the review (persisted directly in SQLite).
4. **Email Notification Dispatch:**
   - Click **Send Email Notification**.
   - Demonstrate email address validation, consent verification, and delivery audit logging.
5. **Closing:**
   - Conclude with test verification summary: 16/16 backend pytest tests passing, 3/3 frontend vitest tests passing, production bundle built cleanly.
   - Open floor for questions.
