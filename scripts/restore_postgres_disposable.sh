#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <protected-staging-env-file> <encrypted-backup-file> <new-restore-database>" >&2
  exit 2
fi

env_file="$1"
backup_file="$2"
restore_database="$3"
if [[ "${RESTORE_ENVIRONMENT:-}" != "staging" ]]; then
  echo "Set RESTORE_ENVIRONMENT=staging and restore only into an isolated staging/disposable stack." >&2
  exit 1
fi
if [[ ! -f "$env_file" || ! -f "$backup_file" ]]; then
  echo "Environment file or encrypted backup does not exist." >&2
  exit 1
fi
if [[ ! "$restore_database" =~ ^documind_restore_[a-z0-9_]{1,40}$ ]]; then
  echo "Restore database name must start with documind_restore_." >&2
  exit 2
fi
if [[ -z "${AGE_IDENTITY_FILE:-}" || ! -f "$AGE_IDENTITY_FILE" ]]; then
  echo "Set AGE_IDENTITY_FILE to the protected age identity file." >&2
  exit 1
fi
command -v age >/dev/null || { echo "age is required." >&2; exit 1; }

compose=(docker compose --env-file "$env_file" -f docker-compose.yml -f docker-compose.prod.yml)
"${compose[@]}" exec -T postgres sh -c \
  'createdb --username "$POSTGRES_USER" --maintenance-db postgres "$1"' sh "$restore_database"

age -d -i "$AGE_IDENTITY_FILE" "$backup_file" \
  | "${compose[@]}" exec -T postgres sh -c \
      'pg_restore --username "$POSTGRES_USER" --dbname "$1" --no-owner --no-privileges' \
      sh "$restore_database"

echo "PASS restored into disposable database: $restore_database"
echo "Do not delete this database until migration and smoke checks are complete."
