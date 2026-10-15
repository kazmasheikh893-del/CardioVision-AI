"""Model loading, prediction, explanation, and metadata utilities."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
MODEL_PATH = ROOT / "models" / "cardiovision_pipeline.joblib"
EVALUATION_PATH = ROOT / "models" / "evaluation.json"


class ModelNotReadyError(RuntimeError):
    """Raised when trained artifacts are missing."""


@lru_cache(maxsize=1)
def load_artifact() -> dict[str, Any]:
    if not MODEL_PATH.exists():
        raise ModelNotReadyError("Trained model artifact is missing. Run `python ml/train_model.py`.")
    return joblib.load(MODEL_PATH)


def load_evaluation() -> dict[str, Any]:
    if not EVALUATION_PATH.exists():
        raise ModelNotReadyError("Evaluation artifact is missing. Run `python ml/train_model.py`.")
    return json.loads(EVALUATION_PATH.read_text(encoding="utf-8"))


def feature_metadata() -> list[dict[str, Any]]:
    return load_artifact()["features"]


def feature_names() -> list[str]:
    return load_artifact()["feature_names"]


def frame_from_payload(payload: dict[str, Any]) -> pd.DataFrame:
    names = feature_names()
    # `None` (unknown / not tested) becomes NaN so the trained pipeline's own imputers handle it.
    row = {name: (np.nan if payload.get(name) is None else payload[name]) for name in names}
    return pd.DataFrame([row], columns=names)


def predict(payload: dict[str, Any]) -> dict[str, Any]:
    artifact = load_artifact()
    pipeline = artifact["pipeline"]
    frame = frame_from_payload(payload)
    probability = float(pipeline.predict_proba(frame)[0, 1])
    prediction = int(probability >= 0.5)

    vessel_pipelines = artifact.get("vessel_pipelines", {})
    vessel_defs = artifact.get("vessel_definitions", {})
    vessels = {}

    for v_key in ["lad", "rca", "lcx"]:
        if v_key in vessel_pipelines:
            v_pipe = vessel_pipelines[v_key]
            v_prob = float(v_pipe.predict_proba(frame)[0, 1])
            v_info = vessel_defs.get(v_key, {})
            risk_level = "Low (<30%)" if v_prob < 0.3 else ("Moderate (30-69%)" if v_prob < 0.7 else "High (>=70%)")
            vessels[v_key] = {
                "vessel": v_key.upper(),
                "name": v_info.get("name", v_key.upper()),
                "probability": round(v_prob, 4),
                "risk_level": risk_level,
                "territory": v_info.get("territory", ""),
                "clinical_note": v_info.get("clinical_significance", ""),
            }

    return {
        "prediction": prediction,
        "probability": round(probability, 4),
        "threshold": 0.5,
        "label": "Disease presence prototype" if prediction else "Disease absence prototype",
        "target_definition": artifact["target_definition"],
        "limitations": [
            "This is not a diagnosis, triage tool, or validated cardiovascular risk score.",
            "The model estimates the UCI Cleveland binary target using historical tabular variables.",
            "Vessel-specific stenosis estimations reflect hemodynamic territory correlations without circular fluoroscopy leakage.",
            "Clinical interpretation requires a qualified healthcare professional.",
        ],
        "vessels": vessels,
    }


def global_weights() -> list[dict[str, Any]]:
    artifact = load_artifact()
    classifier = artifact["pipeline"].named_steps["classifier"]
    coefficients = classifier.coef_[0]
    transformed_names = artifact["transformed_feature_names"]
    
    # Calculate global magnitude per original feature
    feature_weights: dict[str, list[float]] = {name: [] for name in artifact["feature_names"]}
    for name, coef in zip(transformed_names, coefficients):
        base_name = name.split("_", 1)[0]
        if base_name in feature_weights:
            feature_weights[base_name].append(float(coef))
            
    summary = []
    for feat, coef_list in feature_weights.items():
        # Represent global importance as mean absolute coefficient across encoded levels
        importance = float(np.mean([abs(c) for c in coef_list])) if coef_list else 0.0
        summary.append({
            "feature": feat,
            "importance": round(importance, 4),
            "coefficients": [round(c, 4) for c in coef_list],
        })
    summary.sort(key=lambda item: item["importance"], reverse=True)
    return summary


def explain(payload: dict[str, Any]) -> dict[str, Any]:
    artifact = load_artifact()
    pipeline = artifact["pipeline"]
    frame = frame_from_payload(payload)
    transformed = pipeline.named_steps["preprocessor"].transform(frame)[0]
    classifier = pipeline.named_steps["classifier"]
    coefficients = classifier.coef_[0]
    intercept = float(classifier.intercept_[0])
    transformed_names = artifact["transformed_feature_names"]
    contribution_by_feature = {name: 0.0 for name in artifact["feature_names"]}
    detailed_contributions = []

    for transformed_name, value, coefficient in zip(transformed_names, transformed, coefficients):
        base_name = transformed_name.split("_", 1)[0]
        term = float(value * coefficient)
        contribution_by_feature[base_name] = contribution_by_feature.get(base_name, 0.0) + term
        if abs(term) > 1e-5:
            detailed_contributions.append({
                "transformed_feature": transformed_name,
                "base_feature": base_name,
                "value": round(float(value), 4),
                "coefficient": round(float(coefficient), 4),
                "contribution": round(term, 4),
            })

    probability = float(pipeline.predict_proba(frame)[0, 1])
    rows = [
        {
            "feature": feature,
            "contribution": round(score, 4),
            "direction": "increases model score" if score >= 0 else "decreases model score",
            "absolute": round(abs(score), 4),
        }
        for feature, score in contribution_by_feature.items()
    ]
    rows.sort(key=lambda item: item["absolute"], reverse=True)
    logit = float(intercept + np.dot(transformed, coefficients))
    return {
        "probability": round(probability, 4),
        "logit": round(logit, 4),
        "intercept": round(intercept, 4),
        "method": "Logistic regression log-odds decomposition on the train-fitted preprocessing space, grouped back to original clinical features.",
        "contributions": rows,
        "detailed_contributions": detailed_contributions,
        "global_importance": global_weights(),
        "caution": "Feature contributions describe how this model weighed inputs for this specific prediction. They are not causal medical factors or clinical diagnoses.",
    }

