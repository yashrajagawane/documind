"""Small process-local metrics registry with Prometheus text exposition.

The registry intentionally has no external dependency. It provides visibility for a
single backend process; production replicas must export these events to a shared
metrics backend.
"""

from collections import Counter


class MetricsRegistry:
    def __init__(self) -> None:
        self._counters: Counter[tuple[str, tuple[tuple[str, str], ...]]] = Counter()
        self._gauges: dict[tuple[str, tuple[tuple[str, str], ...]], float] = {}
        self._observations: dict[tuple[str, tuple[tuple[str, str], ...]], tuple[float, int]] = {}

    def increment(self, name: str, **labels: str) -> None:
        normalized = tuple(sorted((key, str(value)) for key, value in labels.items()))
        self._counters[(name, normalized)] += 1

    def value(self, name: str, **labels: str) -> int:
        normalized = tuple(sorted((key, str(value)) for key, value in labels.items()))
        return self._counters[(name, normalized)]

    def set_gauge(self, name: str, value: float, **labels: str) -> None:
        normalized = tuple(sorted((key, str(label)) for key, label in labels.items()))
        self._gauges[(name, normalized)] = value

    def observe(self, name: str, value: float, **labels: str) -> None:
        normalized = tuple(sorted((key, str(label)) for key, label in labels.items()))
        total, count = self._observations.get((name, normalized), (0.0, 0))
        self._observations[(name, normalized)] = (total + value, count + 1)

    def render_prometheus(self) -> str:
        lines: list[str] = []
        metric_names = sorted(
            {name for name, _ in self._counters}
            | {name for name, _ in self._gauges}
            | {name for name, _ in self._observations}
        )
        for name in metric_names:
            metric_type = (
                "summary"
                if any(metric == name for metric, _ in self._observations)
                else "gauge"
                if any(metric == name for metric, _ in self._gauges)
                else "counter"
            )
            if metric_type != "counter":
                lines.append(f"# TYPE {name} {metric_type}")
            for (metric, labels), value in sorted(self._counters.items()):
                if metric == name:
                    lines.append(f"{name}{_format_labels(labels)} {value}")
            for (metric, labels), value in sorted(self._gauges.items()):
                if metric == name:
                    lines.append(f"{name}{_format_labels(labels)} {value}")
            for (metric, labels), (total, count) in sorted(self._observations.items()):
                if metric == name:
                    lines.append(f"{name}_sum{_format_labels(labels)} {total}")
                    lines.append(f"{name}_count{_format_labels(labels)} {count}")
        return "\n".join(lines) + ("\n" if lines else "")


def _format_labels(labels: tuple[tuple[str, str], ...]) -> str:
    if not labels:
        return ""
    escaped = [
        (key, value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n"))
        for key, value in labels
    ]
    rendered = ",".join(f'{key}="{value}"' for key, value in escaped)
    return f"{{{rendered}}}"


metrics = MetricsRegistry()
