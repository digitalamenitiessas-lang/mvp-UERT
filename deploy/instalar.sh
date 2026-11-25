#!/usr/bin/env bash
# Instalación inicial del MVP UERT en el VPS. Se corre UNA vez, como root.
# Es idempotente: si algo ya existe, lo deja como está.
#
#   1. usuario de sistema "uert"
#   2. base PostgreSQL "uert" con su rol "uert_app" y /etc/uert/app.env
#   3. servicio systemd uert.service (puerto 127.0.0.1:3190)
#   4. ruta /uert en el sitio vps.marcorossi.com.ar de Caddy (con respaldo)
#
# La app vive en https://vps.marcorossi.com.ar/uert: ese dominio ya apunta al
# VPS y lo comparten otras apps (SDE en /sde, el compresor de audio en la raíz).
# El sitio no pide clave a propósito: es una demo con datos ficticios y se
# entra eligiendo un rol. El código se sube y se compila con deploy/actualizar.sh.
set -Eeuo pipefail

RUTA=/uert
PUERTO=3190
DIR=/home/uert/mvp-UERT
CADDYFILE=/etc/caddy/Caddyfile
AQUI="$(cd "$(dirname "$0")" && pwd)"

paso() { echo; echo "→ $1"; }
[ "$(id -u)" = 0 ] || { echo "Correr como root" >&2; exit 1; }

paso "usuario de sistema"
if ! id uert >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /home/uert --shell /usr/sbin/nologin uert
  echo "  creado"
else
  echo "  ya existía"
fi
install -d -o uert -g uert "$DIR"

paso "base de datos"
install -d -m 0750 -o root -g uert /etc/uert
if ! sudo -u postgres psql -Atc "select 1 from pg_roles where rolname = 'uert_app'" | grep -q 1; then
  CLAVE_DB="$(openssl rand -hex 24)"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q -c "create role uert_app login password '$CLAVE_DB'"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q -c "create database uert owner uert_app"
  (
    umask 027
    cat > /etc/uert/app.env <<EOF
# MVP UERT en el VPS. root:uert 0640. Plantilla: .env.example del repo.
NODE_ENV=production
TZ=America/Argentina/Buenos_Aires
DATABASE_URL=postgres://uert_app:${CLAVE_DB}@127.0.0.1:5432/uert
DB_POOL_MAX=5
NEXT_PUBLIC_BASE_PATH=${RUTA}
EOF
  )
  chown root:uert /etc/uert/app.env
  chmod 0640 /etc/uert/app.env
  echo "  base 'uert' y rol 'uert_app' creados; credenciales en /etc/uert/app.env"
else
  echo "  el rol uert_app ya existía (no se tocan las credenciales)"
fi
# La ruta se fija en el build (basePath de Next): tiene que estar en el entorno.
if ! grep -q '^NEXT_PUBLIC_BASE_PATH=' /etc/uert/app.env; then
  echo "NEXT_PUBLIC_BASE_PATH=${RUTA}" >> /etc/uert/app.env
  echo "  NEXT_PUBLIC_BASE_PATH=${RUTA} agregado a /etc/uert/app.env"
fi

paso "servicio systemd"
install -m 0644 "$AQUI/uert.service" /etc/systemd/system/uert.service
systemctl daemon-reload
systemctl enable uert >/dev/null 2>&1 || true
echo "  uert.service instalado (se arranca después del primer build)"

paso "Caddy"
if grep -q '@uert path' "$CADDYFILE"; then
  echo "  la ruta ${RUTA} ya estaba en $CADDYFILE"
else
  RESPALDO="$CADDYFILE.respaldo-$(date +%Y%m%d-%H%M)-antes-de-uert-ruta"
  cp "$CADDYFILE" "$RESPALDO"
  BLOQUE="$(mktemp)"
  cat > "$BLOQUE" <<EOF
	# --- MVP UERT: demo del sistema de denuncias (Next.js, puerto ${PUERTO}) ---
	# Igual que SDE: handle y NO handle_path, porque la app se compila con
	# basePath=${RUTA} (NEXT_PUBLIC_BASE_PATH en /etc/uert/app.env) y espera
	# recibir el prefijo. Sin clave a propósito: datos ficticios, se entra
	# eligiendo un rol. Instalación: deploy/instalar.sh del repo mvp-UERT.
	@uert path ${RUTA} ${RUTA}/*
	handle @uert {
		reverse_proxy 127.0.0.1:${PUERTO}
	}
EOF
  # Va dentro del sitio vps.marcorossi.com.ar, antes del handler por defecto
  # (el compresor de audio), igual que la ruta de SDE.
  if awk -v bloque="$BLOQUE" '
      /# --- Compresor de audio/ && !hecho { while ((getline linea < bloque) > 0) print linea; hecho = 1 }
      { print }
      END { exit hecho ? 0 : 3 }' "$RESPALDO" > "$CADDYFILE.nuevo"; then
    mv "$CADDYFILE.nuevo" "$CADDYFILE"
    echo "  ruta ${RUTA} agregada (respaldo: $RESPALDO)"
  else
    rm -f "$CADDYFILE.nuevo" "$BLOQUE"
    echo "  ERROR: no encontré el handler del compresor de audio en $CADDYFILE;" >&2
    echo "  agregá la ruta a mano dentro de vps.marcorossi.com.ar { … }" >&2
    exit 1
  fi
  rm -f "$BLOQUE"
fi
# Dirección provisoria anterior (nip.io): redirige a la definitiva.
cat > /etc/caddy/uert.caddy <<EOF
# MVP UERT: dirección provisoria anterior. La app vive en
# https://vps.marcorossi.com.ar${RUTA} (ruta dentro de $CADDYFILE).
uert.2-25-185-242.nip.io {
	redir https://vps.marcorossi.com.ar${RUTA} 302
}
EOF
chmod 0644 /etc/caddy/uert.caddy
if ! grep -q "import /etc/caddy/uert.caddy" "$CADDYFILE"; then
  printf '\n# MVP UERT (agregado %s)\nimport /etc/caddy/uert.caddy\n' "$(date +%F)" >> "$CADDYFILE"
fi
if caddy validate --config "$CADDYFILE" --adapter caddyfile >/tmp/uert-caddy-validate.log 2>&1; then
  systemctl reload caddy
  echo "  Caddy validado y recargado"
else
  cat /tmp/uert-caddy-validate.log >&2
  echo "  ERROR: la configuración de Caddy no valida; se restaura el respaldo" >&2
  [ -n "${RESPALDO:-}" ] && cp "$RESPALDO" "$CADDYFILE"
  exit 1
fi

echo
echo "Listo. Ahora subí el código con scripts/desplegar.sh --sembrar desde la PC."
