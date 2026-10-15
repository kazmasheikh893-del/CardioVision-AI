from backend.app import model_service


DEMO = {
    "age": 63,
    "sex": 1,
    "cp": 4,
    "trestbps": 145,
    "chol": 233,
    "fbs": 1,
    "restecg": 2,
    "thalach": 150,
    "exang": 0,
    "oldpeak": 2.3,
    "slope": 3,
    "ca": 0,
    "thal": 6,
}


def test_prediction_uses_saved_model():
    result = model_service.predict(DEMO)
    assert 0 <= result["probability"] <= 1
    assert result["prediction"] in (0, 1)
    assert "UCI" in result["target_definition"]


def test_explanation_has_real_contributions_for_all_features():
    explanation = model_service.explain(DEMO)
    assert len(explanation["contributions"]) == 13
    assert explanation["method"].startswith("Logistic regression")
    assert any(item["absolute"] > 0 for item in explanation["contributions"])


def test_evaluation_metrics_are_generated():
    evaluation = model_service.load_evaluation()
    assert evaluation["dataset"]["rows"] == 303
    assert "roc_auc" in evaluation["holdout"]["metrics"]
    assert evaluation["holdout"]["confusion_matrix"]["tp"] >= 0


def test_explanation_math_consistency():
    explanation = model_service.explain(DEMO)
    intercept = explanation["intercept"]
    logit = explanation["logit"]
    sum_contributions = sum(item["contribution"] for item in explanation["contributions"])
    # Logit should equal intercept + sum of feature contributions (within rounding margin)
    assert abs(logit - (intercept + sum_contributions)) < 0.05
    assert len(explanation["global_importance"]) == 13
    assert explanation["global_importance"][0]["importance"] > 0


def test_model_not_ready_error_handling(monkeypatch):
    import pathlib
    monkeypatch.setattr(model_service, "MODEL_PATH", pathlib.Path("non_existent_model.joblib"))
    model_service.load_artifact.cache_clear()
    try:
        import pytest
        with pytest.raises(model_service.ModelNotReadyError):
            model_service.load_artifact()
    finally:
        model_service.load_artifact.cache_clear()

