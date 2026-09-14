#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/infra/docker-compose.yml"

if [[ ! -f "${ROOT_DIR}/.env" ]]; then
  bash "${ROOT_DIR}/scripts/ivory-cloud-setup.sh"
fi

echo "ivory-cloud-boot: starting infrastructure services"
docker compose -f "${COMPOSE_FILE}" up -d --wait

echo "ivory-cloud-boot: applying forward-only ivory migrations"
npm run migrate:ivory

echo "ivory-cloud-boot: runtime ready (postgres, minio, docling, schema)"
