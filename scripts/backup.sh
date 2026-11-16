#!/usr/bin/env bash
# Respaldo local: volcado de PostgreSQL + archivos privados de documentos.
# Uso: ./scripts/backup.sh  → crea backups/AAAAMMDD-HHMMSS/{db.sql.gz,documents.tar.gz}
set -euo pipefail
cd "$(dirname "$0")/.."
stamp=$(date +%Y%m%d-%H%M%S)
dest="backups/$stamp"
mkdir -p "$dest"
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' | gzip > "$dest/db.sql.gz"
docker compose exec -T api tar -C /data/documents -czf - . > "$dest/documents.tar.gz"
echo "Respaldo creado en $dest"
