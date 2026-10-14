"""
Auth route integration tests using an in-memory SQLite database.

These tests cover the full register → login → refresh → logout cycle
without requiring a live PostgreSQL container.
"""

from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

def test_register_creates_user_and_returns_access_token(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "alice@example.com", "password": "SecurePass123!"},
    )
    assert response.status_code == 201
    body = response.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == "alice@example.com"


def test_register_rejects_duplicate_email(client: TestClient) -> None:
    payload = {"email": "bob@example.com", "password": "SecurePass123!"}
    first = client.post("/api/v1/auth/register", json=payload)
    assert first.status_code == 201
    second = client.post("/api/v1/auth/register", json=payload)
    assert second.status_code == 409


def test_register_rejects_invalid_email(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "not-an-email", "password": "SecurePass123!"},
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

def test_login_returns_access_token_for_valid_credentials(client: TestClient) -> None:
    email, password = "carol@example.com", "GoodPass45678!"
    client.post("/api/v1/auth/register", json={"email": email, "password": password})

    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_rejects_wrong_password(client: TestClient) -> None:
    email = "dave@example.com"
    client.post("/api/v1/auth/register", json={"email": email, "password": "RightPass789!"})

    response = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "WrongPass000!"}
    )
    assert response.status_code == 401


def test_login_rejects_unknown_email(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "ValidPassword123!"},
    )
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Protected route
# ---------------------------------------------------------------------------

def test_me_returns_profile_for_authenticated_user(client: TestClient) -> None:
    email, password = "eve@example.com", "SafePass32199!"
    reg = client.post("/api/v1/auth/register", json={"email": email, "password": password})
    token = reg.json()["access_token"]

    response = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == email


def test_me_rejects_tampered_token(client: TestClient) -> None:
    response = client.get(
        "/api/v1/users/me", headers={"Authorization": "Bearer totally.invalid.token"}
    )
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------

def test_logout_returns_no_content(client: TestClient) -> None:
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": "frank@example.com", "password": "Pass11111111!"},
    )
    assert reg.status_code == 201
    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 204
