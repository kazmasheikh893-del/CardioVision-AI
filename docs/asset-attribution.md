# Asset & Model Attribution

## Anatomical 3D Heart & Vasculature Asset

- **File**: `public/models/cardiovision-heart.glb` (1.19 MB)
- **Primary Source**: Human Reference Atlas (HRA) v1.3 / Cellular Community Finder (CCF) 3D Reference Library
  - *3D Reference Organ for Heart, Female* (`3d-vh-f-heart.glb`)
  - *3D Reference Organ for Blood Vasculature, Female* (`3d-vh-f-blood-vasculature.glb`)
- **Originating Dataset**: National Library of Medicine (NLM) Visible Human Project (Female dataset), curated by Indiana University and the HuBMAP Consortium.
- **License**: Creative Commons Attribution 4.0 International ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/))
- **Attribution Statement**: Based on 3D reference anatomical organs created by the Human Reference Atlas (HRA) team, CC BY 4.0.
- **Processing & Assembly**: Built via `scripts/build_heart_asset.mjs`:
  1. Combined female heart organ mesh with heart-specific vascular subtree (`VH_F_blood_vasculature_of_heart`).
  2. Pruned distal non-cardiac vascular stumps while retaining ascending aorta, pulmonary trunk, coronary sinus, and complete coronary arterial trees.
  3. Preserved distinct, named meshes for the **Left Anterior Descending (LAD)**, **Left Circumflex (LCX)**, and **Right Coronary Artery (RCA)**.
  4. Consolidated buffer references to single-buffer GLB standard and applied meshoptimizer Draco/quantized compression to reduce file size from 46 MB to 1.19 MB for responsive WebGL rendering.

## Legacy Viewer Reference (Phase 0 Archive)

- **File**: `public/models/heart.glb`
- **Source**: Innerscene Heart model (CC0 / Public Domain)
- **Status**: Retained as legacy asset; current active visualization throughout Patient Portal and Doctor Workstation standardizes exclusively on `cardiovision-heart.glb`.

## Clinical Datasets & Machine Learning Models

- **UCI Cleveland Heart Disease Cohort**:
  - Source: UCI Machine Learning Repository (Detrano et al., 1989).
  - Target: Binary angiographic coronary artery disease (absence: <50% stenosis vs. presence: >=50% stenosis).
  - Preprocessing: Zero-leakage scikit-learn pipeline with median/mode imputation and standard scaling fitted strictly within cross-validation and holdout training folds.
- **Z-Alizadeh Sani Heart Disease Cohort**:
  - Source: UCI Machine Learning Repository (Alizadeh Sani et al., 2017).
  - Target: Territory-specific stenosis models for LAD, LCX, and RCA coronary branches.
