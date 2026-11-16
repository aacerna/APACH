#!/usr/bin/env bash
# Restauración básica desde un respaldo creado con backup.sh.
# - La base de datos se reemplaza (el volcado usa --clean --if-exists).
# - Los documentos del respaldo se extraen SOBRE el volumen actual (sobrescribe, no elimina archivos extra).
# Uso: ./scripts/restore.sh backups/AAAAMMDD-HHMMSS
set -euo pipefail
cd "$(dirname "$0")/.."
src="${1:?Indica la carpeta del respaldo}"
read -r -p "Esto reemplazará la base de datos actual. Escribe RESTAURAR para continuar: " answer
[ "$answer" = "RESTAURAR" ] || { echo "Cancelado."; exit 1; }
gunzip -c "$src/db.sql.gz" | docker compose exec -T postgres sh -c 'psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose exec -T api tar -C /data/documents -xzf - < "$src/documents.tar.gz"
echo "Restauración completada desde $src"
