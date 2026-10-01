from fastapi.testclient import TestClient

from app.core.metrics import MetricsRegistry
from app.main import app


def test_metrics_registry_renders_prometheus_counter_labels() -> None:
    registry = MetricsRegistry()
    registry.increment("documind_example_total", outcome="completed")

    assert registry.value("documind_example_total", outcome="completed") == 1
    assert registry.render_prometheus() == 'documind_example_total{outcome="completed"} 1\n'


def test_metrics_endpoint_is_hidden_without_an_operations_token() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/metrics")

    assert response.status_code == 404
