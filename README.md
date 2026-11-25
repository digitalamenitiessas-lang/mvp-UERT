# MVP UERT · Gestión de denuncias

MVP del sistema de gestión de denuncias de la **Unidad Ejecutora de Riesgos del Trabajo (UERT)** de la Provincia de Santiago del Estero.

Sirve para **mostrar el circuito completo cambiando de rol**: Mesa de entrada, Área médica, Área legal, Seguimiento de licencias, Dirección y Administración. Incluye la nueva denuncia de Enfermedad Profesional (FODEP) y la comunicación con la SRT (Web Service FODEP y archivos .AD/.AL/.AZ del Sistema de Intercambio).

> **Es una demo.** Los datos son ficticios (DNI de la serie 99.000.xxx, emails `.example`) y las comunicaciones con la SRT están simuladas: se arma el mismo contenido que se enviaría y se valida con las reglas publicadas, pero no se conecta.

## Probarlo en la PC

Requisitos: Node.js 22.

```bash
npm install
npm run dev
```

Abrí http://localhost:3000 y elegí con qué rol entrar. No hace falta instalar PostgreSQL: en desarrollo se usa **PGlite** (Postgres embebido) en `~/.mvp-uert/pglite`. La primera vez se crean solos el esquema y los datos de la demo.

| Comando | Para qué |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Tests (reglas y flujos completos sobre una base en memoria) |
| `npm run typecheck` | Chequeo de tipos |
| `npm run lint` | ESLint |
| `npm run db:sembrar` | Borra los datos y recarga la demo con fechas relativas a hoy (con el servidor apagado) |
| `npm run db:migrar` | Aplica migraciones pendientes |

Los datos también se reinician desde la app con el rol **Administración**.

## Qué se puede hacer

- **Mesa de entrada:** carga la denuncia en un formulario único con solapas, advierte siniestros abiertos (sistema nuevo y actual), arma el checklist de documentación según el tipo, emite la constancia de recepción, verifica la relación laboral y pasa al área médica. En una EP informa la denuncia a la SRT (WS FODEP simulado).
- **Área médica:** evalúa cada diagnóstico (CIE-10, Listado de EP, lesiones, zonas). También cita con 72 h de anticipación, reitera por única vez y deja la denuncia como Desistida si caduca. Define la baja y puede reencuadrar un accidente como EP.
- **Área legal:** tiene 10 días hábiles (más prórroga) para aceptar o rechazar cada diagnóstico con los motivos R, D, E, P o L. El rechazo por E exige el CYMAT y el rechazo por P exige los estudios. Al cerrar emite la notificación de rechazo.
- **Seguimiento:** registra las presentaciones de la licencia con sus vencimientos, el tope de 365 días, las intercurrencias, el alta y la presentación ante la Comisión Médica. Desde un siniestro dado de alta se puede cargar un reingreso.
- **Dirección:** tablero con estados, vencimientos y comunicaciones con la SRT.
- **Búsqueda unificada:** por nombre, DNI o CUIL trae los siniestros del sistema nuevo y del actual, por año.

## Documentación

- [docs/DISENO.md](docs/DISENO.md): roles, circuito, reglas, arquitectura y convenciones.
- [docs/DEPLOY.md](docs/DEPLOY.md): instalación y actualización en el VPS.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · react-hook-form + zod · PostgreSQL 17 (`pg`) en el VPS · PGlite en desarrollo y tests · Vitest.

Todo es software libre.
