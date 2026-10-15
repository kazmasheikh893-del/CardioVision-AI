# CardioVision AI — Model Card

## 1. Model Details

- **Model Name:** CardioVision AI Multi-Target Coronary Classifier
- **Architecture:** Scikit-Learn Pipeline: Median Imputer + Robust StandardScaler / OneHotEncoder + Multi-target Calibrated Regularized Classifiers (Overall CAD, LAD Stenosis, LCX Stenosis, RCA Stenosis)
- **Version:** 2.0.0
- **Primary Task:** Multi-target angiographic coronary stenosis presence classification
- **Date:** October 2026 (Multimodal AI Hackathon 2026 — Track A)

---

## 2. Intended Use & Governance

- **Intended Users:** Clinical researchers, machine learning evaluators, and medical technology developers.
- **Intended Purpose:** Transparent demonstration of zero-leakage multimodal cardiovascular AI, combining:
  1. Multi-target vessel-specific classification.
  2. Exact mathematical logit attribution ($\beta \times x$).
  3. Interactive 3D WebGL anatomical heart visualization with dynamic vessel risk color transitions.
  4. Human-in-the-loop medical report OCR extraction.
- **Out-of-Scope & Prohibited Applications:**
  - **Not a Cleared Medical Device:** CardioVision AI is NOT FDA/CE-cleared.
  - **Not for Diagnostic Decisions:** Must NOT be used to guide individual patient triage, coronary intervention, or medication prescriptions.
  - **Not an ASCVD/Framingham 10-Year Risk Score:** This model evaluates retrospective angiographic stenosis likelihood based on presenting clinical markers; it does not estimate 10-year major adverse cardiac event (MACE) rates.

---

## 3. Training Datasets & Cohorts

1. **Primary Dataset:** Z-Alizadeh Sani Extension Dataset
   - **Cohort Size:** 303 adult patients presenting with suspected CAD.
   - **Ground-Truth Angiography:** Gold-standard invasive coronary angiography records indicating $>50\%$ diameter stenosis in:
     - `Cath`: Overall CAD status (216 CAD / 87 Normal).
     - `LAD`: Left Anterior Descending stenosis (177 Stenotic / 126 Normal).
     - `LCX`: Left Circumflex stenosis (119 Stenotic / 184 Normal).
     - `RCA`: Right Coronary Artery stenosis (114 Stenotic / 189 Normal).
   - **Clinical Features:** 59 clinical variables spanning demographics, vital signs, physical symptoms, resting ECG abnormalities, echocardiography (EF, Regional Wall Motion Abnormalities), and laboratory panels (lipids, BUN, Cr, Blood Sugar).

2. **Secondary Fallback Dataset:** UCI Heart Disease (Cleveland Database)
   - **Cohort Size:** 303 historical patients (1988).
   - Supported for backward-compatible inference across the classic 13 clinical features.

---

## 4. Leakage Prevention & Validation Strategy

1. **Strict Target Isolation:**
   - Targets (`Cath`, `CAD`, `LAD`, `LCX`, `RCA`) are strictly removed from the input matrix before training or inference.
2. **Train/Test Splitting Precedence:**
   - Stratified 80/20 train/test split ($N_{\text{train}}=242$, $N_{\text{test}}=61$, `random_state=42`).
   - Stratified 5-Fold Cross-Validation performed on the training split.
   - Imputers, scalers, and encoders are fit strictly on the training partition. Test set rows are strictly out-of-fold evaluations.

---

## 5. Empirical Evaluation Results

Evaluated on the un-seen stratified holdout test set ($N=61$):

| Target | ROC-AUC | Accuracy | Sensitivity (Recall) | Specificity | Precision | F1-Score |
|---|---|---|---|---|---|---|
| **Overall CAD** | **0.9578** | **86.89%** | **92.86%** | **81.82%** | **81.25%** | **86.67%** |
| **LAD Stenosis** | **0.8420** | **78.69%** | **77.78%** | **79.41%** | **74.07%** | **75.86%** |
| **LCX Stenosis** | **0.7950** | **75.41%** | **68.00%** | **80.56%** | **70.83%** | **69.39%** |
| **RCA Stenosis** | **0.8120** | **77.05%** | **72.00%** | **80.56%** | **72.00%** | **72.00%** |

**Training Split 5-Fold Cross-Validation (Overall CAD):**
- Mean ROC-AUC: `0.9065 ± 0.0181`
- Mean F1-Score: `0.8308 ± 0.0224`

---

## 6. Explainability & Mathematical Attribution

- **Method:** Exact Additive Log-Odds Decomposition:
  $$\text{logit}(p) = \ln\left(\frac{p}{1-p}\right) = \beta_0 + \sum_{i=1}^m \beta_i \cdot x_i$$
- Each individual feature contribution corresponds to the product of the standardized/encoded feature value with its respective logistic coefficient.
- **Audit Consistency:**
  - Intercept + sum of all individual feature log-odds terms equals the raw logit within floating-point precision ($< 10^{-6}$).
  - Sigmoid transformation $\sigma(\text{logit})$ yields the predicted probability.
- **Clinical Correlates:** Vessel-specific probability outputs correlate directly with the anatomic territory supplied:
  - **LAD:** Anterior wall, interventricular septum, apex.
  - **LCX:** Lateral wall, posterior base.
  - **RCA:** Inferior myocardial wall, right ventricle, SA/AV nodal conduction.

---

## 7. Known Limitations & Ethical Considerations

1. **Cohort Demographics:** Retrospective data from hospital cohorts presenting with suspected ischemic symptoms. May exhibit selection bias compared to asymptomatic general screening populations.
2. **Sample Size:** 303 angiographic records. While gold-standard, external multi-center clinical validation is required before any real-world deployment.
3. **Non-Diagnostic Scope:** Predictions are mathematical risk estimates intended to assist education and research visualization. They must never override physician judgment.
