#!/usr/bin/env bash
#
# Prepare l'environnement au demarrage d'une session Claude Code, locale ou cloud.
# Branche par le hook SessionStart de .claude/settings.json.
#
# Ce depot n'a aucun service local a demarrer : la base est un Neon distant joint
# en HTTP par api/, et npm test ne touche ni le reseau ni la base. Le seul travail
# de setup est donc l'installation des dependances npm.
#
# Idempotent : une session ou package-lock.json n'a pas bouge ne fait rien.
# Ne sort jamais en erreur — un setup rate ne doit pas empecher la session de demarrer.

set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-"$(dirname "$0")/.."}" || exit 0

marqueur="node_modules/.claude-setup-stamp"
empreinte="$(sha256sum package-lock.json 2>/dev/null | cut -d' ' -f1)"

if [ -d node_modules ] && [ -n "$empreinte" ] &&
  [ "$(cat "$marqueur" 2>/dev/null)" = "$empreinte" ]; then
  echo "Dependances a jour (node $(node -v), npm $(npm -v))."
  echo "Verifie ton travail avec : npm test && npm run build && npm run format:check"
  exit 0
fi

echo "Installation des dependances npm (npm ci)..."
if npm ci --no-audit --no-fund; then
  printf '%s' "$empreinte" >"$marqueur"
  echo "Dependances installees (node $(node -v), npm $(npm -v))."
  echo "Verifie ton travail avec : npm test && npm run build && npm run format:check"
else
  echo "npm ci a echoue. Lance 'npm ci' manuellement avant de travailler." >&2
fi

exit 0
