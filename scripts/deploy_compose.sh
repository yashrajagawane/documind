#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <git-sha> <backend-image> <frontend-image>" >&2
  exit 2
fi

release_sha="$1"
backend_image="$2"
frontend_image="$3"
app_dir="${DOCUMIND_APP_DIR:-/opt/documind}"
env_file="${DOCUMIND_ENV_FILE:-.env.production}"

if [[ ! "$release_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Release revision must be a full 40-character Git SHA." >&2
  exit 2
fi
if [[ ! -d "$app_dir/.git" || ! -f "$app_dir/$env_file" ]]; then
  echo "Expected a cloned repository and protected environment file under $app_dir." >&2
  exit 1
fi

cd "$app_dir"
git fetch --no-tags origin "$release_sha"
git checkout --detach "$release_sha"

export DOCUMIND_BACKEND_IMAGE="$backend_image"
export DOCUMIND_FRONTEND_IMAGE="$frontend_image"
compose=(docker compose --env-file "$env_file" -f docker-compose.yml -f docker-compose.prod.yml)

"${compose[@]}" pull backend worker scheduler frontend
# Run schema changes exactly once before application and worker containers start.
"${compose[@]}" run --rm migrate
"${compose[@]}" up -d --no-build --remove-orphans
"${compose[@]}" ps
