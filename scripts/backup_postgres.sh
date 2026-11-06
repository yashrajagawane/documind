#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <protected-env-file>" >&2
  exit 2
fi

env_file="$1"
if [[ ! -f "$env_file" ]]; then
  echo "Environment file not found: $env_file" >&2
  exit 1
fi
if [[ -z "${AGE_RECIPIENT:-}" || -z "${BACKUP_BUCKET:-}" ]]; then
  echo "Set AGE_RECIPIENT and BACKUP_BUCKET in the protected operator environment." >&2
  exit 1
fi
command -v age >/dev/null || { echo "age is required." >&2; exit 1; }
command -v aws >/dev/null || { echo "AWS CLI is required." >&2; exit 1; }

compose=(docker compose --env-file "$env_file" -f docker-compose.yml -f docker-compose.prod.yml)
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
temporary_directory="$(mktemp -d)"
trap 'rm -rf "$temporary_directory"' EXIT
archive="$temporary_directory/documind-postgres-$timestamp.dump.age"

"${compose[@]}" exec -T postgres sh -c \
  'pg_dump --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --format=custom' \
  | age -r "$AGE_RECIPIENT" -o "$archive"

destination="s3://${BACKUP_BUCKET%/}/postgres/documind-postgres-$timestamp.dump.age"
aws s3 cp "$archive" "$destination" --sse AES256
echo "PASS encrypted PostgreSQL backup uploaded: $destination"
