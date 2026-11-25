#!/usr/bin/env bash
# Actualiza el MVP UERT en el VPS a partir de un paquete .tgz del código.
# Lo llama scripts/desplegar.sh; también se puede correr a mano como root:
#
#   bash actualizar.sh /tmp/uert-deploy.tgz            # actualizar
#   SEMBRAR=1 bash actualizar.sh /tmp/uert-deploy.tgz  # y recargar los datos de la demo
#
# Pasos: sincroniza el código → npm ci si cambió el lock → build con prioridad
# mínima → migraciones → (demo) → reinicio → verifica /uert/ingresar.
# Si el build falla, no reinicia: sigue andando la versión anterior.
set -Eeuo pipefail

PAQUETE="${1:?Falta el paquete .tgz}"
DIR=/home/uert/mvp-UERT
ENV_FILE=/etc/uert/app.env
NODE_BIN=/opt/node22/bin
PUERTO=3190

die() { echo "ERROR: $1" >&2; exit 1; }
paso() { echo; echo "→ $1"; }
como_uert() { sudo -u uert -H env PATH="$NODE_BIN:$PATH" "$@"; }

[ "$(id -u)" = 0 ] || die "hay que correrlo como root (usa systemctl)"
[ -f "$ENV_FILE" ] || die "falta $ENV_FILE: corré antes deploy/instalar.sh"
[ -f "$PAQUETE" ] || die "no existe $PAQUETE"

paso "código"
TMP="$(mktemp -d /tmp/uert-codigo-XXXX)"
tar -xzf "$PAQUETE" -C "$TMP"
LOCK_ANTES="$(sha256sum "$DIR/package-lock.json" 2>/dev/null | cut -d' ' -f1 || true)"
rsync -a --delete --exclude node_modules --exclude .next "$TMP"/ "$DIR"/
rm -rf "$TMP"
chown -R uert:uert "$DIR"
LOCK_DESPUES="$(sha256sum "$DIR/package-lock.json" | cut -d' ' -f1)"
echo "  sincronizado en $DIR"

paso "dependencias"
cd "$DIR"
if [ ! -d node_modules ] || [ "$LOCK_ANTES" != "$LOCK_DESPUES" ]; then
  echo "  instalando (npm ci)"
  como_uert nice -n 19 ionice -c3 npm ci --no-audit --no-fund 2>&1 | tail -3
else
  echo "  sin cambios, se saltea npm ci"
fi

paso "compilando (puede tardar varios minutos: 1 núcleo compartido)"
if ! como_uert bash -c "set -a; . '$ENV_FILE'; set +a; NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=1536 nice -n 19 ionice -c3 npm run build" \
  >/tmp/uert-build.log 2>&1; then
  tail -40 /tmp/uert-build.log
  die "el build falló — el servicio NO se reinició"
fi
grep -E "Compiled successfully|Route \(app\)" /tmp/uert-build.log | head -2 || true

paso "migraciones"
como_uert bash -c "set -a; . '$ENV_FILE'; set +a; npm run --silent db:migrar"

if [ "${SEMBRAR:-0}" = "1" ]; then
  paso "datos de la demo"
  como_uert bash -c "set -a; . '$ENV_FILE'; set +a; npm run --silent db:sembrar"
fi

paso "reinicio"
# La app se compila con basePath (ej. /uert): la verificación va con el prefijo.
BASE="$(sed -n 's/^NEXT_PUBLIC_BASE_PATH=//p' "$ENV_FILE" | tail -1)"
systemctl restart uert
for i in $(seq 1 20); do
  sleep 2
  if CODIGO="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PUERTO$BASE/ingresar")" && [ "$CODIGO" = "200" ]; then
    echo "  $BASE/ingresar responde 200"
    exit 0
  fi
done
journalctl -u uert -n 30 --no-pager
die "la app no respondió 200 en $BASE/ingresar"
