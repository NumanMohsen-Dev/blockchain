from datetime import timedelta
from app.core.security import create_access_token


def test_login_success(client, test_admin_user):
    resp = client.post(
        "/api/auth/login",
        json={"email": test_admin_user.email, "password": "AdminPass123!"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == test_admin_user.email
    assert data["user"]["role"] == "ADMIN"
    # Ensure password_hash is NEVER exposed
    assert "password_hash" not in data["user"]


def test_login_invalid_password(client, test_admin_user):
    resp = client.post(
        "/api/auth/login",
        json={"email": test_admin_user.email, "password": "WrongPassword!"},
    )
    assert resp.status_code == 401
    assert "Invalid email or password" in resp.json()["detail"]


def test_login_nonexistent_email(client):
    resp = client.post(
        "/api/auth/login",
        json={"email": "nobody@evidence.org", "password": "AnyPassword123!"},
    )
    assert resp.status_code == 401


def test_login_inactive_user(client, test_inactive_user):
    resp = client.post(
        "/api/auth/login",
        json={"email": test_inactive_user.email, "password": "InactivePass123!"},
    )
    assert resp.status_code == 401
    assert "deactivated" in resp.json()["detail"].lower()


def test_get_current_user_profile(client, admin_token, test_admin_user):
    headers = {"Authorization": f"Bearer {admin_token}"}
    resp = client.get("/api/auth/me", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == test_admin_user.id
    assert data["email"] == test_admin_user.email
    assert data["role"] == "ADMIN"


def test_get_current_user_no_token(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_logout_revokes_token(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Request /me works
    resp = client.get("/api/auth/me", headers=headers)
    assert resp.status_code == 200

    # Logout
    logout_resp = client.post("/api/auth/logout", headers=headers)
    assert logout_resp.status_code == 200

    # Subsequent /me with same token must fail
    resp_after = client.get("/api/auth/me", headers=headers)
    assert resp_after.status_code == 401


def test_expired_token_rejected(client, test_admin_user):
    # Create token expired 1 hour ago
    expired_token = create_access_token(
        subject=test_admin_user.id,
        role=test_admin_user.role.value,
        email=test_admin_user.email,
        expires_delta=timedelta(minutes=-60),
    )
    headers = {"Authorization": f"Bearer {expired_token}"}
    resp = client.get("/api/auth/me", headers=headers)
    assert resp.status_code == 401
