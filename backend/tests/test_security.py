from uuid import uuid4

import jwt
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.main import app


def test_password_hash_is_not_the_plaintext() -> None:
    password = "correct horse battery staple"
    password_hash = hash_password(password)

    assert password_hash != password
    assert verify_password(password, password_hash)
    assert not verify_password("incorrect password", password_hash)


def test_access_token_round_trips_only_with_expected_claims() -> None:
    settings = Settings(jwt_secret_key="test-secret-with-at-least-32-bytes")
    user_id = uuid4()
    token = create_access_token(user_id, settings)

    assert decode_access_token(token, settings) == user_id
    claims = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    assert claims["type"] == "access"


def test_protected_user_route_rejects_missing_identity() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/users/me")

    assert response.status_code == 401
    assert response.json()["success"] is False
