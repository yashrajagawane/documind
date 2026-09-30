from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_a_non_secret_liveness_payload() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    assert response.json() == {"status": "healthy", "services": {"api": "healthy"}}


def test_unknown_route_uses_the_safe_error_envelope() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/does-not-exist")

    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    assert response.json()["success"] is False
    assert response.json()["error"]["code"] == "NOT_FOUND"
    assert response.json()["error"]["request_id"] == response.headers["X-Request-ID"]
