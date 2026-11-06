"""Create a sanitized, auditable production release record."""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import UTC, datetime
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--backend-image", required=True)
    parser.add_argument("--frontend-image", required=True)
    parser.add_argument("--migration-head", required=True)
    parser.add_argument("--backup-id", required=True)
    parser.add_argument("--operator", required=True)
    parser.add_argument("--smoke-result", choices=("passed", "failed"), required=True)
    parser.add_argument("--rollback-backend-image", required=True)
    parser.add_argument("--rollback-frontend-image", required=True)
    parser.add_argument("--risk", action="append", default=[])
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    if not re.fullmatch(r"[0-9a-f]{40}", args.commit):
        parser.error("--commit must be a full 40-character lowercase Git SHA")
    for image in (args.backend_image, args.frontend_image):
        if not image.endswith(f":{args.commit}"):
            parser.error("deployed image references must end with the release Git SHA")
    for image in (args.rollback_backend_image, args.rollback_frontend_image):
        if not re.fullmatch(r".+:[0-9a-f]{40}", image):
            parser.error("rollback image references must use a full Git SHA tag")
    if not args.migration_head.strip():
        parser.error("--migration-head must not be empty")
    if args.smoke_result != "passed":
        print("Refusing to record a failed smoke test as a production release.", file=sys.stderr)
        return 1

    record = {
        "release_version": args.version,
        "git_commit": args.commit,
        "images": {
            "backend": args.backend_image,
            "frontend": args.frontend_image,
        },
        "migration_head": args.migration_head,
        "backup_id": args.backup_id,
        "operator": args.operator,
        "smoke_test": args.smoke_result,
        "rollback_images": {
            "backend": args.rollback_backend_image,
            "frontend": args.rollback_frontend_image,
        },
        "accepted_risks": args.risk,
        "recorded_at_utc": datetime.now(UTC).isoformat(),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(f"PASS release record written: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
