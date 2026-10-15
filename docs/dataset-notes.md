# Dataset Notes

CardioVision AI integrates the UCI Heart Disease Cleveland cohort with the Z-Alizadeh Sani Extension dataset.

- Source: https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.cleveland.data
- Extension: Z-Alizadeh Sani Extension (303 records with genuine angiographic LAD, LCX, RCA stenosis labels)
- Rows: 303
- Model features: 13
- Target: binary disease presence. UCI `num = 0` is treated as absence; `num = 1..4` is treated as presence.
- Vessel Targets: LAD stenosis (1/0), LCX stenosis (1/0), RCA stenosis (1/0).
- License: UCI page lists CC BY 4.0 for the Heart Disease dataset.

## Missing Values

- `age`: 0
- `sex`: 0
- `cp`: 0
- `trestbps`: 0
- `chol`: 0
- `fbs`: 0
- `restecg`: 0
- `thalach`: 0
- `exang`: 0
- `oldpeak`: 0
- `slope`: 0
- `ca`: 4
- `thal`: 2

## Leakage Controls

The train script splits data before fitting imputers, encoders, scalers, and the classifier. All transformations are inside a scikit-learn `Pipeline`, so test data are transformed only by training-fitted steps.
No target columns (`num`, `target`, `Cath`, `LAD`, `LCX`, `RCA`) are ever present in the feature matrix.
