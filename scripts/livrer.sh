#!/usr/bin/env bash
#
# Livre le travail courant vers une branche de deploiement.
#
#   npm run livrer:preprod   ta branche de travail  ->  preprod  ->  preprod.lavialatte.com
#   npm run livrer:prod      preprod               ->  main     ->  lavialatte.com
#
# Les trois verifications passent avant le merge : ce qui part en ligne a ete
# teste sur ta machine, la CI GitHub n'est que le second filet.
# SANS_TESTS=1 les saute — a ne sortir que pour eteindre un incendie.

set -euo pipefail

cd "$(dirname "$0")/.."

cible="${1:-}"
case "$cible" in
preprod | main) ;;
*)
  echo "usage : npm run livrer:preprod  |  npm run livrer:prod" >&2
  exit 1
  ;;
esac

depart="$(git rev-parse --abbrev-ref HEAD)"
if [ "$cible" = main ]; then
  source=preprod
else
  source="$depart"
fi

if [ "$source" = "$cible" ] || { [ "$cible" = preprod ] && [ "$depart" = main ]; }; then
  echo "Place-toi sur ta branche de travail avant de livrer (tu es sur $depart)." >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Travail non commite. Commite (ou git stash) avant de livrer." >&2
  exit 1
fi

if [ "${SANS_TESTS:-}" != 1 ]; then
  echo "== Verifications"
  npm test
  npm run build
  npx tsc -p api/tsconfig.json
  npm run format:check
fi

echo "== $source  ->  $cible"
git fetch origin
git push -u origin "$source"
git checkout "$cible"
git pull --ff-only origin "$cible"
git merge --no-ff "origin/$source" -m "Livre $source dans $cible"
git push origin "$cible"
git checkout "$depart"

if [ "$cible" = preprod ]; then
  echo "Livre. Dans une minute : https://preprod.lavialatte.com"
else
  echo "Livre en production. Dans une minute : https://lavialatte.com"
fi
