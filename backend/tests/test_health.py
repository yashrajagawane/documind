from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_a_non_secret_liveness_payload() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    assert response.json() == {"status": "healthy", "services": {"api": "healthy"}}
