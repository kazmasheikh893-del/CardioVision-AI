import pytest
from httpx import ASGITransport, AsyncClient

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


@pytest.mark.anyio
async def test_health_and_model_info():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        health = await client.get("/health")
        info = await client.get("/model-info")
    assert health.json()["model_loaded"] is True
    assert info.status_code == 200
    assert len(info.json()["features"]) == 13


@pytest.mark.anyio
async def test_predict_and_explain():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prediction = await client.post("/predict", json=VALID)
        explanation = await client.post("/explain", json=VALID)
    assert prediction.status_code == 200
    assert 0 <= prediction.json()["probability"] <= 1
    assert explanation.status_code == 200
    assert len(explanation.json()["contributions"]) == 13


@pytest.mark.anyio
async def test_invalid_payload_rejected():
    bad = {**VALID, "age": 3}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/predict", json=bad)
    assert response.status_code == 422


@pytest.mark.anyio
async def test_evaluation_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/evaluation")
    assert response.status_code == 200
    data = response.json()
    assert data["dataset"]["rows"] == 303
    assert "roc_auc" in data["holdout"]["metrics"]
    assert "confusion_matrix" in data["holdout"]
    assert len(data["holdout"]["roc_curve"]) > 0
    assert len(data["holdout"]["calibration"]) > 0


@pytest.mark.anyio
async def test_boundary_validation():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Invalid categorical value
        bad_sex = {**VALID, "sex": 2}
        res1 = await client.post("/predict", json=bad_sex)
        assert res1.status_code == 422

        # Invalid extra parameter (extra='forbid')
        extra_key = {**VALID, "unknown_field": 123}
        res2 = await client.post("/predict", json=extra_key)
        assert res2.status_code == 422

        # Valid edge case age: min 18, max 100
        edge_min = {**VALID, "age": 18}
        res3 = await client.post("/predict", json=edge_min)
        assert res3.status_code == 200

        edge_max = {**VALID, "age": 100}
        res4 = await client.post("/predict", json=edge_max)
        assert res4.status_code == 200


@pytest.mark.anyio
async def test_assessment_persistence_and_doctor_review():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Authenticate as doctor
        login_res = await client.post("/auth/login", json={"email": "doctor@cardiovision.ai", "password": "CardioVision2026!"})
        assert login_res.status_code == 200
        doc_token = login_res.json()["token"]
        headers = {"Authorization": f"Bearer {doc_token}"}

        # Create an assessment with doctor credentials
        create_res = await client.post(
            "/assessments",
            json={"patient_name": "Test Patient", "inputs": VALID, "report_source": "Manual"},
            headers=headers,
        )
        assert create_res.status_code == 200
        data = create_res.json()
        aid = data["assessment_id"]
        assert aid.startswith("CV-")

        # Fetch the assessment
        get_res = await client.get(f"/assessments/{aid}", headers=headers)
        assert get_res.status_code == 200
        assert get_res.json()["patient_name"] == "Test Patient"
        assert get_res.json()["review"] is None

        # Add doctor review
        review_payload = {
            "doctor_name": "Dr. Sarah Jenkins",
            "doctor_title": "Senior Cardiologist",
            "summary": "Low probability of significant coronary artery narrowing.",
            "advice": "Maintain healthy lifestyle and schedule annual routine wellness check.",
            "follow_up": "12 months",
            "status": "Reviewed & Approved",
        }
        rev_res = await client.post(f"/assessments/{aid}/review", json=review_payload, headers=headers)
        assert rev_res.status_code == 200

        # Verify review is now attached to the assessment
        get_again = await client.get(f"/assessments/{aid}", headers=headers)
        assert get_again.status_code == 200
        assert get_again.json()["review"]["doctor_name"] == "Dr. Sarah Chen, MD"


@pytest.mark.anyio
async def test_upload_medical_report():
    sample_text = (
        "CARDIOLOGY CLINICAL REPORT\n"
        "Patient: John Doe, Age: 55, Sex: Male\n"
        "Resting Blood Pressure: 135/85 mm Hg\n"
        "Serum Cholesterol: 220 mg/dL\n"
        "Fasting Glucose: 110 mg/dL\n"
        "Max Heart Rate: 160 bpm\n"
        "ST depression: 1.2 mm\n"
    )
    # Generate simple test PDF
    from pypdf import PdfWriter
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    # Upload as txt or text-based pdf
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        files = {"file": ("report.pdf", b"%PDF-1.4 sample pdf content", "application/pdf")}
        res = await client.post("/upload-report", files=files)
        # Verify endpoint parses or handles gracefully
        assert res.status_code in (200, 400)


@pytest.mark.anyio
async def test_vessel_predictions_in_predict():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/predict", json=VALID)
    assert res.status_code == 200
    data = res.json()
    assert "vessels" in data
    assert "lad" in data["vessels"]
    assert "rca" in data["vessels"]
    assert "lcx" in data["vessels"]
    for v_key in ["lad", "rca", "lcx"]:
        v = data["vessels"][v_key]
        assert 0 <= v["probability"] <= 1
        assert "risk_level" in v
        assert len(v["territory"]) > 0


@pytest.mark.anyio
async def test_doctor_authentication_and_session():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Invalid login
        bad_res = await client.post("/auth/login", json={"email": "doctor@cardiovision.ai", "password": "WrongPassword"})
        assert bad_res.status_code == 401

        # Valid login
        login_res = await client.post("/auth/login", json={"email": "doctor@cardiovision.ai", "password": "CardioVision2026!"})
        assert login_res.status_code == 200
        token_data = login_res.json()
        assert "token" in token_data
        token = token_data["token"]
        assert token_data["doctor"]["email"] == "doctor@cardiovision.ai"

        # Verify /auth/me with Bearer token
        me_res = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_res.status_code == 200
        assert me_res.json()["name"] == "Dr. Sarah Chen, MD"

        # Test unauthorized /auth/me without token
        unauth_res = await client.get("/auth/me")
        assert unauth_res.status_code == 401

        # Logout
        logout_res = await client.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
        assert logout_res.status_code == 200


@pytest.mark.anyio
async def test_protected_assessments_queue_and_patient_scoping():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Unauthorized access to doctor workstation queue should be denied (401)
        unauth_list = await client.get("/assessments")
        assert unauth_list.status_code == 401

        import secrets
        rnd = secrets.token_hex(3)
        phone1 = f"+1555{int(rnd, 16):07d}"[:12]
        rnd2 = secrets.token_hex(3)
        phone2 = f"+1556{int(rnd2, 16):07d}"[:12]

        # Register Patient 1
        p1_reg = await client.post(
            "/patient/register",
            json={
                "full_name": "Alice Smith",
                "phone": phone1,
                "age": 42,
                "password": "PasswordAlice123!",
                "email": f"alice_{rnd}@example.com",
            },
        )
        assert p1_reg.status_code == 201
        p1_data = p1_reg.json()
        p1_token = p1_data["token"]
        p1_id = p1_data["patient"]["id"]
        p1_headers = {"Authorization": f"Bearer {p1_token}"}

        # Patient 1 creates an assessment
        p1_assess_res = await client.post(
            "/patient/assessments",
            json={"inputs": VALID, "report_source": "Patient Manual Entry"},
            headers=p1_headers,
        )
        assert p1_assess_res.status_code == 201
        aid = p1_assess_res.json()["id"]

        # Patient 1 can list and read their own assessment
        p1_list = await client.get("/patient/assessments", headers=p1_headers)
        assert p1_list.status_code == 200
        assert any(item["id"] == aid for item in p1_list.json())

        p1_single = await client.get(f"/patient/assessments/{aid}", headers=p1_headers)
        assert p1_single.status_code == 200
        assert p1_single.json()["id"] == aid
        assert p1_single.json()["patient_name"] == "Alice Smith"

        # Register Patient 2
        p2_reg = await client.post(
            "/patient/register",
            json={
                "full_name": "Bob Jones",
                "phone": phone2,
                "age": 55,
                "password": "PasswordBob123!",
                "email": f"bob_{rnd2}@example.com",
            },
        )
        assert p2_reg.status_code == 201
        p2_token = p2_reg.json()["token"]
        p2_headers = {"Authorization": f"Bearer {p2_token}"}

        # IDOR Protection: Patient 2 CANNOT access Patient 1's assessment (returns 404, never leaks existence)
        idor_attempt = await client.get(f"/patient/assessments/{aid}", headers=p2_headers)
        assert idor_attempt.status_code == 404

        # IDOR Protection: Patient 2 accessing Patient 1's legacy route returns 403 Forbidden
        legacy_attempt = await client.get(f"/patients/{p1_id}/assessments", headers=p2_headers)
        assert legacy_attempt.status_code == 403

        # Authenticate as doctor
        login_res = await client.post(
            "/auth/login",
            json={"email": "doctor@cardiovision.ai", "password": "CardioVision2026!"},
        )
        assert login_res.status_code == 200
        doc_token = login_res.json()["token"]
        doc_headers = {"Authorization": f"Bearer {doc_token}"}

        # Doctor can view clinical assessment queue and locate Alice's assessment
        doc_list = await client.get("/assessments", headers=doc_headers)
        assert doc_list.status_code == 200
        assert any(item["id"] == aid for item in doc_list.json())

        # Doctor can view full clinical assessment details
        doc_single = await client.get(f"/assessments/{aid}", headers=doc_headers)
        assert doc_single.status_code == 200
        assert doc_single.json()["patient_name"] == "Alice Smith"


@pytest.mark.anyio
async def test_email_notification_dispatch_and_validation():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Authenticate as doctor
        login_res = await client.post(
            "/auth/login",
            json={"email": "doctor@cardiovision.ai", "password": "CardioVision2026!"},
        )
        assert login_res.status_code == 200
        doc_token = login_res.json()["token"]
        doc_headers = {"Authorization": f"Bearer {doc_token}"}

        create_res = await client.post(
            "/assessments",
            json={"patient_name": "Bob Taylor", "inputs": VALID},
            headers=doc_headers,
        )
        assert create_res.status_code == 200
        aid = create_res.json()["assessment_id"]

        # Rejection when consent is false
        no_consent = await client.post(
            f"/assessments/{aid}/notify",
            json={"recipient_email": "bob@example.com", "patient_consent": False},
            headers=doc_headers,
        )
        assert no_consent.status_code == 400

        # Rejection when email is invalid
        bad_email = await client.post(
            f"/assessments/{aid}/notify",
            json={"recipient_email": "not-an-email", "patient_consent": True},
            headers=doc_headers,
        )
        assert bad_email.status_code == 400

        # Successful dispatch (in dev / test environment)
        valid_notify = await client.post(
            f"/assessments/{aid}/notify",
            json={"recipient_email": "bob@example.com", "patient_consent": True, "patient_name": "Bob Taylor"},
            headers=doc_headers,
        )
        assert valid_notify.status_code == 200
        notif_data = valid_notify.json()
        assert notif_data["recipient_email"] == "bob@example.com"
        assert notif_data["status"] in ("Delivered", "Simulated / Dev Dispatched")

        # Retrieve notification audit history
        history = await client.get(f"/assessments/{aid}/notifications", headers=doc_headers)
        assert history.status_code == 200
        assert len(history.json()) >= 1


@pytest.mark.anyio
async def test_patient_auth_lifecycle_and_validation():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Validation: age too low
        bad_age = await client.post(
            "/patient/register",
            json={"full_name": "Young Patient", "phone": "+15550001111", "age": 16, "password": "Password123!"},
        )
        assert bad_age.status_code in (400, 422)

        # Validation: short password (< 8 chars)
        short_pass = await client.post(
            "/patient/register",
            json={"full_name": "Test Patient", "phone": "+15550002222", "age": 30, "password": "short"},
        )
        assert short_pass.status_code in (400, 422)

        import secrets
        rnd = secrets.token_hex(3)
        claire_phone = f"+1557{int(rnd, 16):07d}"[:12]

        # Successful registration
        reg = await client.post(
            "/patient/register",
            json={"full_name": "Claire Vance", "phone": claire_phone, "age": 38, "password": "SafePassword123!"},
        )
        assert reg.status_code == 201
        data = reg.json()
        assert "token" in data
        assert data["patient"]["full_name"] == "Claire Vance"
        assert "password" not in data["patient"]
        assert "password_hash" not in data["patient"]
        token = data["token"]

        # Duplicate phone registration rejected with 409 Conflict
        dup = await client.post(
            "/patient/register",
            json={"full_name": "Claire Duplicate", "phone": claire_phone, "age": 40, "password": "SafePassword123!"},
        )
        assert dup.status_code == 409

        # Bad password login rejected
        bad_login = await client.post(
            "/patient/login",
            json={"phone": claire_phone, "password": "WrongPassword!"},
        )
        assert bad_login.status_code == 401

        # Successful login
        good_login = await client.post(
            "/patient/login",
            json={"phone": claire_phone, "password": "SafePassword123!"},
        )
        assert good_login.status_code == 200
        new_token = good_login.json()["token"]

        # /patient/me returns profile
        me_res = await client.get("/patient/me", headers={"Authorization": f"Bearer {new_token}"})
        assert me_res.status_code == 200
        assert me_res.json()["full_name"] == "Claire Vance"

        # /patient/logout revokes session
        logout_res = await client.post("/patient/logout", headers={"Authorization": f"Bearer {new_token}"})
        assert logout_res.status_code == 200

        # Post-logout request is unauthorized
        post_logout = await client.get("/patient/me", headers={"Authorization": f"Bearer {new_token}"})
        assert post_logout.status_code == 401


