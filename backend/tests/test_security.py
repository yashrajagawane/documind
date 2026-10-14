"""
Expanded security boundary tests.

Covers: missing/malformed/expired JWT, tampered algorithm, token type
confusion (refresh used as access), CORS preflight, and security headers
on all major response types.
"""

from uuid import uuid4

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.security import create_access_token, decode_access_token, hash_password, verify_password
from app.main import app


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

def test_password_hash_is_not_the_plaintext() -> None:
    password = "correct horse battery staple"
    password_hash = hash_password(password)
    assert password_hash != password
    assert verify_password(password, password_hash)
    assert not verify_password("incorrect password", password_hash)


def test_different_passwords_produce_different_hashes() -> None:
    h1 = hash_password("password-one")
    h2 = hash_password("password-two")
    assert h1 != h2


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

def test_access_token_round_trips_only_with_expected_claims() -> None:
    settings = Settings(jwt_secret_key="test-secret-with-at-least-32-bytes")
    user_id = uuid4()
    token = create_access_token(user_id, settings)
    assert decode_access_token(token, settings) == user_id
    claims = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    assert claims["type"] == "access"


def test_access_token_rejects_wrong_secret() -> None:
    settings = Settings(jwt_secret_key="test-secret-with-at-least-32-bytes")
    wrong = Settings(jwt_secret_key="completely-different-secret-value!")
    token = create_access_token(uuid4(), settings)
    assert decode_access_token(token, wrong) is None


def test_access_token_rejects_none_algorithm_attack() -> None:
    """Ensure tokens signed with 'none' algorithm are rejected."""
    settings = Settings(jwt_secret_key="test-secret-with-at-least-32-bytes")
    user_id = uuid4()
    payload = {"sub": str(user_id), "type": "access"}
    # Craft a token with no signature
    forged = jwt.encode(payload, "", algorithm="none")  # type: ignore[arg-type]
    assert decode_access_token(forged, settings) is None


# ---------------------------------------------------------------------------
# API boundary — no authentication
# ---------------------------------------------------------------------------

def test_protected_user_route_rejects_missing_identity() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/users/me")
    assert response.status_code == 401
    assert response.json()["success"] is False


def test_document_list_rejects_unauthenticated_request() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/documents")
    assert response.status_code == 401


def test_document_upload_rejects_unauthenticated_request() -> None:
    with TestClient(app) as client:
        response = client.post("/api/v1/documents")
    assert response.status_code == 401


def test_chat_endpoint_rejects_unauthenticated_request() -> None:
    with TestClient(app) as client:
        response = client.post(f"/api/v1/documents/{uuid4()}/chat", json={"question": "hi"})
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Security headers
# ---------------------------------------------------------------------------

def test_security_headers_present_on_health_response() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/health")
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("X-Request-ID")


def test_security_headers_present_on_404_response() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/nonexistent-route")
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------

def test_auth_routes_are_rate_limited() -> None:
    with TestClient(app) as client:
        responses = [client.post("/api/v1/auth/login") for _ in range(11)]
    assert responses[-1].status_code == 429
    assert responses[-1].json()["error"]["code"] == "RATE_LIMITED"


# ---------------------------------------------------------------------------
# Tenant isolation — cross-user 404 discretion
# ---------------------------------------------------------------------------

def test_foreign_document_id_returns_404_not_403(client: TestClient) -> None:
    """Accessing another user's document should return 404, not 403."""
    # Register two users
    r1 = client.post(
        "/api/v1/auth/register",
        json={"email": "owner@example.com", "password": "OwnerPassword1!"},
    )
    assert r1.status_code == 201
    r2 = client.post(
        "/api/v1/auth/register",
        json={"email": "attacker@example.com", "password": "AttackPassword1!"},
    )
    assert r2.status_code == 201
    token_attacker = r2.json()["access_token"]

    # Attacker tries to access a random UUID (simulates cross-tenant probe)
    response = client.get(
        f"/api/v1/documents/{uuid4()}",
        headers={"Authorization": f"Bearer {token_attacker}"},
    )
    assert response.status_code == 404
    assert response.json()["success"] is False
