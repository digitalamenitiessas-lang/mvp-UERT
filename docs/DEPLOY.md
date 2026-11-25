# MVP UERT en el VPS

Corre en el VPS compartido (`2.25.185.242`, Ubuntu 24.04, 1 núcleo, 3.8 GB) con el mismo patrón que Citify: `next start` como servicio de systemd detrás del Caddy nativo, PostgreSQL 17 local.

| Pieza | Dónde |
| --- | --- |
| Código | `/home/uert/mvp-UERT` (usuario de sistema `uert`) |
| Servicio | `uert.service` → `next start` en `127.0.0.1:3190` (`Nice=10`, `MemoryMax=768M`) |
| Entorno | `/etc/uert/app.env` (root:uert 0640) |
| Base | PostgreSQL 17 local, base `uert`, rol `uert_app`, schema `uert` |
| HTTPS | Caddy: ruta `@uert` dentro del sitio `vps.marcorossi.com.ar` de `/etc/caddy/Caddyfile`, como SDE en `/sde` |
| Dirección | **`https://vps.marcorossi.com.ar/uert`** (la provisoria `uert.2-25-185-242.nip.io` redirige ahí, vía `/etc/caddy/uert.caddy`) |

La app se compila con `basePath` `/uert` (`NEXT_PUBLIC_BASE_PATH` en `/etc/uert/app.env`; en desarrollo no se define y queda en la raíz). `Link`, `redirect()`, `router.push()` y `next/form` agregan el prefijo solos; en `fetch()`, `<a>` y `<form>` nativos hay que usar `conBase()` de `src/lib/rutas.ts`.

## Instalación (una vez)

Desde la PC, en la carpeta del repo:

```bash
scp deploy/instalar.sh deploy/uert.service root@2.25.185.242:/tmp/
ssh root@2.25.185.242 'bash /tmp/instalar.sh'
```

Crea el usuario, la base, el entorno, el servicio y la ruta `/uert` en Caddy. El sitio no pide clave a propósito: es una demo con datos ficticios y se entra eligiendo un rol. Antes de tocar el Caddyfile guarda un respaldo y valida la configuración antes de recargarla.

## Actualizar

```bash
scripts/desplegar.sh            # sube el código, compila, migra y reinicia
scripts/desplegar.sh --sembrar  # además recarga los datos de la demo
```

No usa git: empaqueta la carpeta local (sin `node_modules`, `.next`, `.git` ni `.env`), la copia al VPS y corre `deploy/actualizar.sh`. Si el build falla, no reinicia y sigue la versión anterior. El build tarda varios minutos porque corre con prioridad mínima en un núcleo compartido.

## Notas

- Es una demo con datos ficticios. Para el sistema real, el alojamiento se define con la Provincia (datos de salud, Ley 25.326).
- Los datos de la demo se recargan con `scripts/desplegar.sh --sembrar` o desde la app, con el rol Administración.
- Ver logs: `ssh root@2.25.185.242 'journalctl -u uert -n 100 --no-pager'`.
