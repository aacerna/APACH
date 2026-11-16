#!/usr/bin/env bash
# Arranque completo para la demo: construye, levanta, espera salud y siembra datos ficticios.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { cp .env.example .env; echo "Se creó .env desde .env.example (revisa la contraseña)."; }
docker compose up --build -d
echo "Esperando a que la API esté saludable…"
for _ in $(seq 1 60); do
  if docker compose exec -T api python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health')" 2>/dev/null; then break; fi
  sleep 2
done
docker compose exec -T api python -m app.scripts.seed_demo
echo "APACH listo en http://localhost:$(grep -E '^WEB_PORT=' .env | cut -d= -f2 || echo 8080)"
