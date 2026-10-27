
#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$HOME/DevLabs/assistant-ia-langues-locales"
VENV="$PROJECT_DIR/backend/.venv"

# Nom du service : répertoire : port
SERVICES=(
  "identity:backend/identity:8001"
  "conversation:backend/conversation:8002"
  "learning:backend/learning:8003"
  "ml:backend/ml:8004"
  "gateway:backend/gateway:8000"
)

if [[ ! -x "$VENV/bin/python" ]]; then
  echo "Erreur : environnement virtuel introuvable : $VENV"
  exit 1
fi

pids=()

stop_services() {
  echo "Arrêt des services..."
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}

trap stop_services EXIT INT TERM

for service in "${SERVICES[@]}"; do
  IFS=: read -r name directory port <<< "$service"

  echo "Démarrage de $name sur le port $port..."

  (
    cd "$PROJECT_DIR/$directory"
    exec "$VENV/bin/python" -m uvicorn app.main:app \
      --host 0.0.0.0 \
      --port "$port" \
      --reload
  ) > "$PROJECT_DIR/${name}.log" 2>&1 &

  pids+=("$!")
done

echo "Services lancés. Logs disponibles dans les fichiers *.log."
echo "Appuie sur Ctrl+C pour arrêter les processus lancés."
wait
