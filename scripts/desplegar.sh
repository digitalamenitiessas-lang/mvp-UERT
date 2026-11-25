#!/usr/bin/env bash
# Sube el código al VPS y lo actualiza (correr desde la PC, en Git Bash o Linux).
#
#   scripts/desplegar.sh            # actualizar
#   scripts/desplegar.sh --sembrar  # actualizar y recargar los datos de la demo
#
# Empaqueta la carpeta actual (sin node_modules, .next, .git ni .env), la copia
# al VPS y corre deploy/actualizar.sh allá. No usa git: sirve aunque no haya
# commits ni acceso del VPS a GitHub.
set -Eeuo pipefail

VPS="${VPS:-root@2.25.185.242}"
SEMBRAR=0
[ "${1:-}" = "--sembrar" ] && SEMBRAR=1

cd "$(dirname "$0")/.."
PAQUETE="$(mktemp -t uert-XXXXXX).tgz"
trap 'rm -f "$PAQUETE"' EXIT

echo "→ empaquetando"
tar -czf "$PAQUETE" \
  --exclude=./node_modules --exclude=./.next --exclude=./.git --exclude=./.claude \
  --exclude='./.env*' --exclude=./tsconfig.tsbuildinfo --exclude=./coverage .
echo "  $(du -h "$PAQUETE" | cut -f1)"

echo "→ subiendo a $VPS"
scp -q "$PAQUETE" "$VPS:/tmp/uert-deploy.tgz"
scp -q deploy/actualizar.sh "$VPS:/tmp/uert-actualizar.sh"

echo "→ actualizando en el VPS"
ssh "$VPS" "SEMBRAR=$SEMBRAR bash /tmp/uert-actualizar.sh /tmp/uert-deploy.tgz && rm -f /tmp/uert-deploy.tgz /tmp/uert-actualizar.sh"
