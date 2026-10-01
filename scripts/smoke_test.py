"""Run a safe release smoke test against a running DocuMind deployment."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import httpx


def check(response: httpx.Response, expected: set[int], label: str) -> None:
    if response.status_code not in expected:
        raise RuntimeError(
            f"{label}: expected {sorted(expected)}, got {response.status_code}: {response.text}"
        )
    print(f"PASS {label} ({response.status_code})")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--email")
    parser.add_argument("--password")
    parser.add_argument("--document", type=Path)
    args = parser.parse_args()
    api = f"{args.base_url.rstrip('/')}/api/v1"

    with httpx.Client(timeout=30, follow_redirects=True) as client:
        check(client.get(f"{api}/health"), {200}, "liveness")
        check(client.get(f"{api}/ready"), {200}, "readiness")
        if not args.email or not args.password:
            print(
                "INFO public smoke checks complete; provide --email and --password "
                "for auth checks"
            )
            return 0

        credentials = {"email": args.email, "password": args.password}
        response = client.post(f"{api}/auth/register", json=credentials)
        if response.status_code == 409:
            response = client.post(f"{api}/auth/login", json=credentials)
        check(response, {200, 201}, "register/login")
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        check(client.get(f"{api}/users/me", headers=headers), {200}, "current user")

        if args.document:
            with args.document.open("rb") as source:
                upload = client.post(
                    f"{api}/documents",
                    headers={**headers, "Idempotency-Key": "release-smoke-test"},
                    files={"file": (args.document.name, source)},
                )
            check(upload, {200, 201}, "document upload")

        check(client.post(f"{api}/auth/logout", headers=headers), {204}, "logout")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (httpx.HTTPError, OSError, RuntimeError) as error:
        print(f"FAIL {error}", file=sys.stderr)
        raise SystemExit(1) from error
