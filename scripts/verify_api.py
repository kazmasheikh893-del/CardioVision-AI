"""Direct ASGI API smoke test for CardioVision AI."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from httpx import ASGITransport, AsyncClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.main import app


VALID = {
    "age": 41,
    "sex": 0,
    "cp": 2,
    "trestbps": 120,
    "chol": 204,
    "fbs": 0,
    "restecg": 0,
    "thalach": 172,
    "exang": 0,
    "oldpeak": 0,
    "slope": 1,
    "ca": 0,
    "thal": 3,
}


async def main() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        print("checking /health", flush=True)
        health = await client.get("/health")
        health.raise_for_status()

        print("checking /model-info", flush=True)
        model_info = await client.get("/model-info")
        model_info.raise_for_status()

        print("checking /predict (CAD & vessel-specific LAD, LCX, RCA)", flush=True)
        prediction = await client.post("/predict", json=VALID)
        prediction.raise_for_status()
        pred_data = prediction.json()
        assert "vessels" in pred_data
        assert "lad" in pred_data["vessels"]
        assert "rca" in pred_data["vessels"]
        assert "lcx" in pred_data["vessels"]

        print("checking /explain (log-odds decomposition)", flush=True)
        explanation = await client.post("/explain", json=VALID)
        explanation.raise_for_status()

        print("checking /evaluation (holdout & CV metrics)", flush=True)
        evaluation = await client.get("/evaluation")
        evaluation.raise_for_status()
        eval_data = evaluation.json()
        assert "vessels" in eval_data

        print("checking validation error", flush=True)
        invalid = await client.post("/predict", json={**VALID, "age": 3})
        assert invalid.status_code == 422

        print("checking /auth/login and /auth/me", flush=True)
        auth_res = await client.post(
            "/auth/login",
            json={"email": "doctor@cardiovision.ai", "password": "CardioVision2026!"},
        )
        assert auth_res.status_code == 200
        token = auth_res.json()["token"]

        me_res = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_res.status_code == 200
        assert me_res.json()["email"] == "doctor@cardiovision.ai"

        print("checking assessment creation and clinician review authoring", flush=True)
        ass_res = await client.post(
            "/assessments",
            json={"patient_name": "Verified Smoke Patient", "inputs": VALID},
        )
        assert ass_res.status_code == 200
        aid = ass_res.json()["assessment_id"]

        rev_res = await client.post(
            f"/assessments/{aid}/review",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "doctor_name": "Dr. Sarah Chen, MD",
                "doctor_title": "Senior Interventional Cardiologist",
                "summary": "Verified low cardiovascular risk profile.",
                "advice": "Routine preventive maintenance and lifestyle adherence.",
                "follow_up": "12 months routine clinic check",
                "status": "Reviewed & Approved",
            },
        )
        assert rev_res.status_code == 200

    print(
        "ALL API SMOKE TESTS PASSED:",
        {
            "health": health.json(),
            "features": len(model_info.json()["features"]),
            "cad_probability": pred_data["probability"],
            "vessels": {k: f"{v['probability']*100:.1f}% ({v['risk_level']})" for k, v in pred_data["vessels"].items()},
            "contributions": len(explanation.json()["contributions"]),
            "holdout_cad_roc_auc": eval_data["holdout"]["metrics"]["roc_auc"],
            "doctor_auth_verified": True,
            "assessment_review_verified": True,
        },
    )


if __name__ == "__main__":
    asyncio.run(main())

