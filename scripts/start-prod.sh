#!/usr/bin/env sh
# AI Generated code <PURPOSE>: startup production environment bootstrap
set -eu

script_dir=$(CDPATH= cd "$(dirname "$0")" && pwd)
repo_root=$(CDPATH= cd "$script_dir/.." && pwd)
root_env="$repo_root/.env"

if [ ! -f "$root_env" ]; then
  {
    printf '%s\n' "# AI Generated code <PURPOSE>: editable production compose defaults"
    printf '%s\n' "# Edit these values before running in a real production environment."
    printf '%s\n' "POSTGRES_DB=quiz_dev"
    printf '%s\n' "POSTGRES_USER=quiz"
    printf '%s\n' "POSTGRES_PASSWORD=quiz"
    printf '%s\n' "DATABASE_URL=postgres://quiz:quiz@postgres:5432/quiz_dev"
    printf '%s\n' "REDIS_URL=redis://redis:6379"
    printf '%s\n' "BACKEND_PORT=3000"
    printf '%s\n' "FRONTEND_PORT=5173"
    printf '%s\n' "VITE_API_URL=http://localhost:3000"
  } > "$root_env"
  printf '%s\n' "Created .env with editable production defaults"
fi

if ! command -v docker >/dev/null 2>&1; then
  printf '%s\n' "Docker is unavailable. Install Docker and ensure the docker command is on PATH." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  printf '%s\n' "Docker is unavailable. Start Docker and try again." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  printf '%s\n' "Docker Compose is unavailable. Install Docker Compose or enable the Docker Compose plugin." >&2
  exit 1
fi

cd "$repo_root"
docker compose up --build
