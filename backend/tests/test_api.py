import uuid
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database.session import SessionLocal
from backend.app.models.entities import User, Scan, Website

client = TestClient(app)


def test_health_check_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "service" in data


def test_user_registration_and_login():
    unique_email = f"user_{uuid.uuid4().hex[:8]}@crox.ai"

    # 1. Register
    reg_res = client.post("/api/auth/register", json={
        "name": "Jane Tester",
        "email": unique_email,
        "password": "Password123!",
        "confirm_password": "Password123!"
    })
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["email"] == unique_email

    # 2. Duplicate registration fails
    dup_res = client.post("/api/auth/register", json={
        "name": "Jane Tester",
        "email": unique_email,
        "password": "Password123!",
        "confirm_password": "Password123!"
    })
    assert dup_res.status_code == 400
    assert "already exists" in dup_res.json()["detail"].lower()

    # 3. Login with wrong password fails
    wrong_login = client.post("/api/auth/login", json={
        "email": unique_email,
        "password": "WrongPassword!"
    })
    assert wrong_login.status_code == 401

    # 4. Login with correct password succeeds
    login_res = client.post("/api/auth/login", json={
        "email": unique_email,
        "password": "Password123!"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    # 5. Get current profile using Bearer token
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["name"] == "Jane Tester"


def test_ssrf_blocking_on_scan_endpoint():
    response = client.post("/api/scans", json={"url": "http://127.0.0.1:9000"})
    assert response.status_code == 400
    assert "prohibited" in response.json()["detail"].lower()


def test_user_isolation_between_accounts():
    email_a = f"alice_{uuid.uuid4().hex[:8]}@crox.ai"
    email_b = f"bob_{uuid.uuid4().hex[:8]}@crox.ai"

    res_a = client.post("/api/auth/register", json={
        "name": "Alice",
        "email": email_a,
        "password": "AlicePassword123!",
        "confirm_password": "AlicePassword123!"
    })
    token_a = res_a.json()["access_token"]
    user_a_id = res_a.json()["user"]["id"]

    res_b = client.post("/api/auth/register", json={
        "name": "Bob",
        "email": email_b,
        "password": "BobPassword123!",
        "confirm_password": "BobPassword123!"
    })
    token_b = res_b.json()["access_token"]

    # Create a scan directly assigned to Alice
    db = SessionLocal()
    alice_domain = f"alice-{uuid.uuid4().hex[:8]}.com"
    website = Website(domain=alice_domain, user_id=user_a_id)
    db.add(website)
    db.commit()

    scan_a = Scan(
        id=f"scan_{uuid.uuid4().hex[:8]}",
        user_id=user_a_id,
        website_id=website.id,
        target_url=f"https://{alice_domain}",
        status="completed",
        health_score=82
    )
    db.add(scan_a)
    db.commit()
    scan_id = scan_a.id
    db.close()

    # Alice can view her scan report
    alice_view = client.get(f"/api/scans/{scan_id}/report", headers={"Authorization": f"Bearer {token_a}"})
    assert alice_view.status_code == 200

    # Bob attempts to view Alice's scan report -> must be blocked with 403 Forbidden!
    bob_view = client.get(f"/api/scans/{scan_id}/report", headers={"Authorization": f"Bearer {token_b}"})
    assert bob_view.status_code == 403
    assert "denied" in bob_view.json()["detail"].lower() or "belongs to another user" in bob_view.json()["detail"].lower()
