"""Validate production secrets and Compose port exposure before a release."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

from app.core.config import Settings  # noqa: E402
from scripts.validate_production_config import read_env_file, validate

SHA_IMAGE = re.compile(r".+:[0-9a-f]{40}$")
PUBLIC_PORTS = {"80", "443"}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env.production")
    parser.add_argument("--backend-image", required=True)
    parser.add_argument("--frontend-image", required=True)
    args = parser.parse_args()

    try:
        for image in (args.backend_image, args.frontend_image):
            if not SHA_IMAGE.fullmatch(image):
                raise ValueError("Images must be pinned to full 40-character Git SHA tags.")
        values = read_env_file(args.env_file)
        validate(values)
        Settings(**{name.lower(): value for name, value in values.items()})

        command = [
            "docker",
            "compose",
            "--env-file",
            str(args.env_file),
            "-f",
            str(ROOT / "docker-compose.yml"),
            "-f",
            str(ROOT / "docker-compose.prod.yml"),
            "config",
            "--format",
            "json",
        ]
        environment = os.environ.copy()
        environment["DOCUMIND_BACKEND_IMAGE"] = args.backend_image
        environment["DOCUMIND_FRONTEND_IMAGE"] = args.frontend_image
        completed = subprocess.run(
            command,
            cwd=ROOT,
            env=environment,
            check=True,
            capture_output=True,
            text=True,
        )
        configuration = json.loads(completed.stdout)
        services = configuration.get("services", {})
        public: dict[str, set[str]] = {}
        loopback: dict[str, set[str]] = {}
        for service_name, service in services.items():
            ports = service.get("ports", []) or []
            for port in ports:
                host_ip = port.get("host_ip") or "0.0.0.0"
                destination = loopback if host_ip in {"127.0.0.1", "::1"} else public
                destination.setdefault(service_name, set()).add(str(port["published"]))

        if set(public) != {"proxy"}:
            raise ValueError(
                "Only proxy may publish non-loopback host ports; found: "
                + ", ".join(sorted(public))
            )
        if public["proxy"] != PUBLIC_PORTS:
            raise ValueError(
                "Proxy must publish exactly ports 80 and 443; found: "
                + ", ".join(sorted(public["proxy"]))
            )
        if loopback.get("prometheus") != {"9090"}:
            raise ValueError("Prometheus must bind only to loopback port 9090.")
        if loopback.get("grafana") != {"3001"}:
            raise ValueError("Grafana must bind only to loopback port 3001.")
        if loopback.get("alertmanager") != {"9093"}:
            raise ValueError("Alertmanager must bind only to loopback port 9093.")
        print("PASS production configuration, immutable image refs, and published ports")
    except (OSError, ValueError, subprocess.CalledProcessError, json.JSONDecodeError) as error:
        detail = error.stderr.strip() if isinstance(error, subprocess.CalledProcessError) else str(error)
        print(f"FAIL production preflight: {detail}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
