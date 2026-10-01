"""Small process-local metrics registry with Prometheus text exposition.

The registry intentionally has no external dependency. It provides visibility for a
single backend process; production replicas must export these events to a shared
metrics backend.
"""

from collections import Counter


class MetricsRegistry:
    def __init__(self) -> None:
        self._counters: Counter[tuple[str, tuple[tuple[str, str], ...]]] = Counter()

    def increment(self, name: str, **labels: str) -> None:
        normalized = tuple(sorted((key, str(value)) for key, value in labels.items()))
        self._counters[(name, normalized)] += 1

    def value(self, name: str, **labels: str) -> int:
        normalized = tuple(sorted((key, str(value)) for key, value in labels.items()))
        return self._counters[(name, normalized)]

    def render_prometheus(self) -> str:
        lines: list[str] = []
        for (name, labels), value in sorted(self._counters.items()):
            rendered_labels = ""
            if labels:
                rendered = ",".join(f'{key}="{value}"' for key, value in labels)
                rendered_labels = f"{{{rendered}}}"
            lines.append(f"{name}{rendered_labels} {value}")
        return "\n".join(lines) + ("\n" if lines else "")


metrics = MetricsRegistry()
