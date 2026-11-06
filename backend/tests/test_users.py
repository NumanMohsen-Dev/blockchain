def test_admin_list_users(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    resp = client.get("/api/users", headers=headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 1


def test_admin_create_user_success(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "full_name": "Detective John Doe",
        "email": "johndoe@evidence.org",
        "password": "SecurePassword123!",
        "role": "INVESTIGATOR",
        "blockchain_address": "0x1234567890123456789012345678901234567890",
    }
    resp = client.post("/api/users", json=payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "johndoe@evidence.org"
    assert data["role"] == "INVESTIGATOR"
    assert data["blockchain_address"] == "0x1234567890123456789012345678901234567890"
    assert "password_hash" not in data


def test_non_admin_cannot_create_user(client, collector_token):
    headers = {"Authorization": f"Bearer {collector_token}"}
    payload = {
        "full_name": "Unauthorized User",
        "email": "unauthorized@evidence.org",
        "password": "Password123!",
        "role": "INVESTIGATOR",
        "blockchain_address": "0x9999999999999999999999999999999999999999",
    }
    resp = client.post("/api/users", json=payload, headers=headers)
    assert resp.status_code == 403


def test_create_user_duplicate_email(client, admin_token, test_admin_user):
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "full_name": "Another Admin",
        "email": test_admin_user.email,  # duplicate
        "password": "Password123!",
        "role": "ADMIN",
        "blockchain_address": "0x1111111111111111111111111111111111111111",
    }
    resp = client.post("/api/users", json=payload, headers=headers)
    assert resp.status_code == 409
    assert "already exists" in resp.json()["detail"].lower()


def test_create_user_invalid_blockchain_address(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "full_name": "Bad Address User",
        "email": "badaddr@evidence.org",
        "password": "Password123!",
        "role": "INVESTIGATOR",
        "blockchain_address": "not-an-eth-address",
    }
    resp = client.post("/api/users", json=payload, headers=headers)
    assert resp.status_code == 422


def test_admin_update_user(client, admin_token, test_collector_user):
    headers = {"Authorization": f"Bearer {admin_token}"}
    update_payload = {
        "full_name": "Updated Collector Name",
        "role": "INVESTIGATOR",
    }
    resp = client.patch(
        f"/api/users/{test_collector_user.id}",
        json=update_payload,
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["full_name"] == "Updated Collector Name"
    assert data["role"] == "INVESTIGATOR"


def test_admin_toggle_user_status(client, admin_token, test_collector_user):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Deactivate user
    resp = client.patch(
        f"/api/users/{test_collector_user.id}/status",
        json={"is_active": False},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False

    # Deactivated user cannot login
    login_resp = client.post(
        "/api/auth/login",
        json={"email": test_collector_user.email, "password": "CollectorPass123!"},
    )
    assert login_resp.status_code == 401
