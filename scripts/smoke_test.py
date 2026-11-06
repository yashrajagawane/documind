"""Run a safe release smoke test against a running DocuMind deployment."""

from __future__ import annotations

import argparse
import os
import sys
import time
from uuid import uuid4
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
    parser.add_argument("--question", default="What is the main point of this document?")
    parser.add_argument("--processing-timeout", type=int, default=900)
    parser.add_argument(
        "--min-citation-score",
        type=float,
        default=float(os.environ.get("RETRIEVAL_MIN_SCORE", "0.35")),
    )
    args = parser.parse_args()
    if args.processing_timeout < 1:
        parser.error("--processing-timeout must be positive")
    if not 0 <= args.min_citation_score <= 1:
        parser.error("--min-citation-score must be between 0 and 1")
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
        check(client.get(f"{api}/users/me"), {401}, "protected route rejects missing token")
        check(
            client.get(f"{api}/users/me", headers={"Authorization": "Bearer invalid-token"}),
            {401},
            "protected route rejects invalid token",
        )

        if args.document:
            if not args.document.is_file():
                raise RuntimeError(f"document does not exist: {args.document}")
            document_id: str | None = None
            with args.document.open("rb") as source:
                upload = client.post(
                    f"{api}/documents",
                    headers={**headers, "Idempotency-Key": f"release-smoke-{uuid4()}"},
                    files={"file": (args.document.name, source)},
                )
            check(upload, {200, 201}, "document upload")
            document_id = upload.json()["id"]
            print(f"INFO uploaded document {document_id} with status {upload.json()['status']}")

            deadline = time.monotonic() + args.processing_timeout
            while time.monotonic() < deadline:
                document = client.get(f"{api}/documents/{document_id}", headers=headers)
                check(document, {200}, "document status")
                state = document.json()["status"]
                print(f"INFO processing status: {state}")
                if state == "ready":
                    break
                if state == "failed":
                    raise RuntimeError(
                        "document processing failed: "
                        f"{document.json().get('processing_stage')} "
                        f"{document.json().get('processing_progress')}%"
                    )
                time.sleep(min(5, max(0, deadline - time.monotonic())))
            else:
                raise RuntimeError(
                    f"document did not reach ready within {args.processing_timeout}s"
                )

            preview = client.get(f"{api}/documents/{document_id}/preview", headers=headers)
            check(preview, {200}, "document preview")
            if not preview.json().get("markdown", "").strip():
                raise RuntimeError("document preview is empty")
            for export_format in ("markdown", "json", "html", "txt"):
                exported = client.get(
                    f"{api}/documents/{document_id}/export",
                    params={"format": export_format},
                    headers=headers,
                )
                check(exported, {200}, f"{export_format} export")
                if not exported.content:
                    raise RuntimeError(f"{export_format} export returned an empty body")

            missing_evidence = client.post(
                f"{api}/documents/{document_id}/chat",
                headers=headers,
                json={"question": f"Unrelated staging smoke query {uuid4()}"},
            )
            check(missing_evidence, {200}, "no-evidence chat")
            if missing_evidence.json().get("citations"):
                raise RuntimeError("no-evidence chat returned fabricated citations")

            answer = client.post(
                f"{api}/documents/{document_id}/chat",
                headers=headers,
                json={"question": args.question},
            )
            check(answer, {200}, "grounded chat")
            if not answer.json().get("answer", "").strip():
                raise RuntimeError("grounded chat returned an empty answer")
            citations = answer.json().get("citations", [])
            if not citations:
                raise RuntimeError("grounded chat returned no verified citations")
            for citation in citations:
                if (
                    not citation.get("chunk_id")
                    or citation.get("score", 0) < args.min_citation_score
                ):
                    raise RuntimeError("grounded chat returned an invalid citation")
            print(f"PASS citation integrity ({len(citations)} citations)")

            check(client.delete(f"{api}/documents/{document_id}", headers=headers), {204}, "document cleanup")

        check(client.post(f"{api}/auth/logout", headers=headers), {204}, "logout")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (httpx.HTTPError, OSError, RuntimeError) as error:
        print(f"FAIL {error}", file=sys.stderr)
        raise SystemExit(1) from error
