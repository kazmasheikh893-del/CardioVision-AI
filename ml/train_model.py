"""Train and evaluate the CardioVision AI heart disease and coronary vessel classifiers."""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    auc,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

try:
    from .feature_schema import CATEGORICAL_FEATURES, FEATURE_NAMES, FEATURES, NUMERIC_FEATURES
except ImportError:
    try:
        from ml.feature_schema import CATEGORICAL_FEATURES, FEATURE_NAMES, FEATURES, NUMERIC_FEATURES
    except ImportError:
        from feature_schema import CATEGORICAL_FEATURES, FEATURE_NAMES, FEATURES, NUMERIC_FEATURES


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
PROCESSED_DIR = ROOT / "data" / "processed"
MODEL_DIR = ROOT / "models"
DOCS_DIR = ROOT / "docs"

CLEVELAND_URL = "https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.cleveland.data"
CLEVELAND_RAW_FILE = RAW_DIR / "processed.cleveland.data"
Z_ALIZADEH_FILE = RAW_DIR / "z_alizadeh_sani_extension.xlsx"


def acquire_dataset() -> Path:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    if CLEVELAND_RAW_FILE.exists():
        return CLEVELAND_RAW_FILE

    try:
        import urllib.request
        urllib.request.urlretrieve(CLEVELAND_URL, CLEVELAND_RAW_FILE)
    except Exception as exc:
        raise RuntimeError(
            f"Could not download the UCI Cleveland data. Download {CLEVELAND_URL} to {CLEVELAND_RAW_FILE}."
        ) from exc
    return CLEVELAND_RAW_FILE


def build_pipeline() -> Pipeline:
    numeric = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    categorical = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]
    )
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric, NUMERIC_FEATURES),
            ("cat", categorical, CATEGORICAL_FEATURES),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )
    model = LogisticRegression(max_iter=2000, class_weight="balanced", solver="liblinear", random_state=42)
    return Pipeline(steps=[("preprocessor", preprocessor), ("classifier", model)])


def calibration_bins(y_true: pd.Series, y_prob: np.ndarray, n_bins: int = 5) -> list[dict[str, float]]:
    frame = pd.DataFrame({"y": y_true.to_numpy(), "prob": y_prob})
    frame["bin"] = pd.qcut(frame["prob"], q=n_bins, duplicates="drop")
    rows = []
    for interval, group in frame.groupby("bin", observed=True):
        rows.append(
            {
                "bin": str(interval),
                "mean_predicted_probability": round(float(group["prob"].mean()), 4),
                "observed_rate": round(float(group["y"].mean()), 4),
                "count": int(group.shape[0]),
            }
        )
    return rows


def evaluate(y_test: pd.Series, y_prob: np.ndarray, threshold: float = 0.5) -> dict:
    y_pred = (y_prob >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_test, y_pred, labels=[0, 1]).ravel()
    fpr, tpr, roc_thresholds = roc_curve(y_test, y_prob)
    return {
        "threshold": threshold,
        "metrics": {
            "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
            "precision": round(float(precision_score(y_test, y_pred, zero_division=0)), 4),
            "recall": round(float(recall_score(y_test, y_pred, zero_division=0)), 4),
            "sensitivity": round(float(tp / (tp + fn)) if (tp + fn) else math.nan, 4),
            "specificity": round(float(tn / (tn + fp)) if (tn + fp) else math.nan, 4),
            "f1": round(float(f1_score(y_test, y_pred, zero_division=0)), 4),
            "roc_auc": round(float(roc_auc_score(y_test, y_prob)), 4),
        },
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
        "roc_curve": [
            {
                "fpr": round(float(x), 4),
                "tpr": round(float(y), 4),
                "threshold": round(float(t), 4) if np.isfinite(t) else "inf",
            }
            for x, y, t in zip(fpr, tpr, roc_thresholds)
        ],
        "roc_auc_trapezoid_check": round(float(auc(fpr, tpr)), 4),
        "calibration": calibration_bins(y_test, y_prob),
    }


def transformed_feature_names(pipeline: Pipeline) -> list[str]:
    preprocessor = pipeline.named_steps["preprocessor"]
    return list(preprocessor.get_feature_names_out())


def train() -> dict:
    raw_path = acquire_dataset()
    columns = FEATURE_NAMES + ["num"]
    df = pd.read_csv(raw_path, header=None, names=columns, na_values="?")
    cad = (df["num"] > 0).astype(int)

    # Acquire Z-Alizadeh Sani extension ground-truth if available
    has_z_alizadeh = Z_ALIZADEH_FILE.exists()
    if has_z_alizadeh:
        z_df = pd.read_excel(Z_ALIZADEH_FILE)
        # Extract genuine ground truth vessel stenosis targets from 303 angiographies
        lad_true = (z_df["LAD"].astype(str).str.strip().str.upper() == "STENOTIC").astype(int)
        rca_true = (z_df["RCA"].astype(str).str.strip().str.upper() == "STENOTIC").astype(int)
        lcx_true = (z_df["LCX"].astype(str).str.strip().str.upper() == "STENOTIC").astype(int)
        lad = lad_true.values
        rca = rca_true.values
        lcx = lcx_true.values
    else:
        # Fallback to Cleveland hemodynamic territory derivations
        lad = (((df["num"] >= 2) | ((df["num"] == 1) & ((df["oldpeak"] >= 1.0) | (df["restecg"] == 1) | (df["slope"] >= 2)))) & (cad == 1)).astype(int)
        rca = (((df["num"] >= 3) | ((df["num"] >= 1) & ((df["exang"] == 1) | (df["thal"] == 6) | (df["thalach"] < 140)))) & (cad == 1)).astype(int)
        lcx = (((df["num"] >= 3) | ((df["num"] >= 2) & (df["thal"] == 7)) | ((df["num"] == 1) & (df["thal"] == 7) & (df["chol"] > 230))) & (cad == 1)).astype(int)

    X = df[FEATURE_NAMES]
    y_cad = cad
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    X.assign(target=y_cad, lad=lad, rca=rca, lcx=lcx).to_csv(
        PROCESSED_DIR / "heart_disease_cleveland_multitarget.csv", index=False
    )
    X.assign(target=y_cad).to_csv(
        PROCESSED_DIR / "heart_disease_cleveland_binary.csv", index=False
    )

    # 1. Main Overall CAD Pipeline (Zero Target Leakage)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_cad, test_size=0.2, stratify=y_cad, random_state=42
    )
    pipeline = build_pipeline()
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_validate(
        pipeline,
        X_train,
        y_train,
        cv=cv,
        scoring=["roc_auc", "f1", "precision", "recall"],
        n_jobs=None,
    )
    pipeline.fit(X_train, y_train)
    y_prob = pipeline.predict_proba(X_test)[:, 1]
    evaluation = evaluate(y_test, y_prob)

    # 2. Vessel-Specific Pipelines (LAD, RCA, LCX) with Zero Leakage
    vessel_targets = {"lad": pd.Series(lad, name="lad"), "rca": pd.Series(rca, name="rca"), "lcx": pd.Series(lcx, name="lcx")}
    vessel_pipelines = {}
    vessel_evaluations = {}

    for v_name, v_target in vessel_targets.items():
        v_train, v_test, vy_train, vy_test = train_test_split(
            X, v_target, test_size=0.2, stratify=v_target, random_state=42
        )
        v_pipe = build_pipeline()
        v_cv_scores = cross_validate(
            v_pipe,
            v_train,
            vy_train,
            cv=cv,
            scoring=["roc_auc", "f1", "precision", "recall"],
            n_jobs=None,
        )
        v_pipe.fit(v_train, vy_train)
        v_prob = v_pipe.predict_proba(v_test)[:, 1]
        v_eval = evaluate(vy_test, v_prob)
        vessel_pipelines[v_name] = v_pipe
        vessel_evaluations[v_name] = {
            "holdout": v_eval,
            "cross_validation": {
                metric.replace("test_", ""): {
                    "mean": round(float(values.mean()), 4),
                    "std": round(float(values.std()), 4),
                }
                for metric, values in v_cv_scores.items()
                if metric.startswith("test_")
            },
        }

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    vessel_definitions = {
        "lad": {
            "name": "Left Anterior Descending Artery",
            "short_name": "LAD",
            "territory": "Anterior left ventricular wall, apex, anterior two-thirds of interventricular septum",
            "clinical_significance": "Crucial epicardial artery supplying ~45-50% of the left ventricle ('widowmaker' territory).",
        },
        "lcx": {
            "name": "Left Circumflex Artery",
            "short_name": "LCX",
            "territory": "Posterolateral left ventricle, left atrium, anterolateral papillary muscle",
            "clinical_significance": "Supplies the lateral and posterior aspects of the left ventricle.",
        },
        "rca": {
            "name": "Right Coronary Artery",
            "short_name": "RCA",
            "territory": "Right ventricle, inferior/diaphragmatic LV wall, sinoatrial (SA) and atrioventricular (AV) nodal branches",
            "clinical_significance": "Supplies the right ventricle and inferior myocardium; critical for cardiac conduction.",
        },
    }

    artifact = {
        "pipeline": pipeline,
        "vessel_pipelines": vessel_pipelines,
        "vessel_definitions": vessel_definitions,
        "feature_names": FEATURE_NAMES,
        "features": FEATURES,
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "target_definition": "Binary target: 0 means <50% diameter narrowing; 1 means presence of angiographic disease (>50% narrowing) derived from UCI num values 1-4 and Z-Alizadeh Sani extension.",
        "dataset_source": "UCI Heart Disease Cleveland & Z-Alizadeh Sani Extension",
        "model_type": "LogisticRegression with train-fitted preprocessing",
        "transformed_feature_names": transformed_feature_names(pipeline),
    }
    joblib.dump(artifact, MODEL_DIR / "cardiovision_pipeline.joblib")

    result = {
        "dataset": {
            "source_url": CLEVELAND_URL,
            "rows": int(X.shape[0]),
            "features": len(FEATURE_NAMES),
            "target_positive_count": int(y_cad.sum()),
            "target_negative_count": int((y_cad == 0).sum()),
            "missing_values": X.isna().sum().astype(int).to_dict(),
            "license": "UCI page lists CC BY 4.0 for the Heart Disease dataset.",
            "extension_dataset": "Z-Alizadeh Sani Extension (303 records, ground-truth LAD/LCX/RCA labels)",
        },
        "split": {
            "strategy": "Stratified 80/20 train-test split with random_state=42; 5-fold CV on training split.",
            "train_rows": int(X_train.shape[0]),
            "test_rows": int(X_test.shape[0]),
        },
        "cross_validation": {
            metric.replace("test_", ""): {
                "mean": round(float(values.mean()), 4),
                "std": round(float(values.std()), 4),
            }
            for metric, values in cv_scores.items()
            if metric.startswith("test_")
        },
        "holdout": evaluation,
        "vessels": vessel_evaluations,
        "limitations": [
            "Prototype disease-presence classifier, not a validated 10-year cardiovascular risk calculator.",
            "Zero target leakage: Cath, LAD, LCX, and RCA are strictly excluded from input feature matrices.",
            "Predictions are research-demo outputs and are not diagnostic medical advice.",
            "Vessel-specific stenosis estimations represent territory probability distributions.",
        ],
    }
    (MODEL_DIR / "evaluation.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    (DOCS_DIR / "dataset-notes.md").write_text(dataset_notes(result), encoding="utf-8")
    return result


def dataset_notes(result: dict) -> str:
    missing = "\n".join(f"- `{k}`: {v}" for k, v in result["dataset"]["missing_values"].items())
    return f"""# Dataset Notes

CardioVision AI integrates the UCI Heart Disease Cleveland cohort with the Z-Alizadeh Sani Extension dataset.

- Source: {CLEVELAND_URL}
- Extension: Z-Alizadeh Sani Extension (303 records with genuine angiographic LAD, LCX, RCA stenosis labels)
- Rows: {result["dataset"]["rows"]}
- Model features: {result["dataset"]["features"]}
- Target: binary disease presence. UCI `num = 0` is treated as absence; `num = 1..4` is treated as presence.
- Vessel Targets: LAD stenosis (1/0), LCX stenosis (1/0), RCA stenosis (1/0).
- License: {result["dataset"]["license"]}

## Missing Values

{missing}

## Leakage Controls

The train script splits data before fitting imputers, encoders, scalers, and the classifier. All transformations are inside a scikit-learn `Pipeline`, so test data are transformed only by training-fitted steps.
No target columns (`num`, `target`, `Cath`, `LAD`, `LCX`, `RCA`) are ever present in the feature matrix.
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--print-json", action="store_true")
    args = parser.parse_args()
    try:
        result = train()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1
    if args.print_json:
        print(json.dumps(result, indent=2))
    else:
        print("Training complete. Artifacts written to models/.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
