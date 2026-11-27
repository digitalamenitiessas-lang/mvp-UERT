# MVP UERT · Diseño

MVP del sistema de gestión de denuncias de la **Unidad Ejecutora de Riesgos del Trabajo (UERT)** de Santiago del Estero. Su objetivo es **mostrar**: que la UERT pueda recorrer el circuito completo de una denuncia cambiando de rol, incluyendo la nueva denuncia de Enfermedad Profesional (FODEP) y la comunicación con la SRT. Los datos son ficticios y la SRT está simulada.

Fuentes: relevamiento de Informática de Casa de Gobierno (RF-01 a RF-67, RNF-01 a RNF-10), proyecto de Resolución SRT de EP y sus anexos, WS FODEP v1.0, Sistema de Intercambio FODEP v0.2.

## Roles (un usuario de demo por rol)

| Rol | Submódulo | Qué hace | Inicio |
| --- | --- | --- | --- |
| `mesa_entrada` | 1 | Carga la denuncia (formulario único con solapas), documentación, constancia, verificación de relación laboral, pase a médica, reingresos | `/mesa` |
| `medico` | 1 | Evalúa cada diagnóstico (CIE-10, listado, lesiones, zonas), citaciones (72 h, reiteración, caducidad), baja laboral, reencuadre AT→EP, pase a legal | `/medica` |
| `legal` | 2 | 10 días hábiles (+ prórroga) para aceptar o rechazar **cada diagnóstico** (R/D/E/P/L), cierra el dictamen, notificación de rechazo | `/legal` |
| `seguimiento` | 3 | Licencias activas: presentaciones y vencimientos, intercurrencias, alta, presentación ante Comisión Médica | `/seguimiento` |
| `direccion` | — | Tablero: estados, vencimientos, comunicaciones SRT | `/direccion` |
| `admin` | — | Usuarios, catálogos, reiniciar la demo, lotes de intercambio | `/admin` |

No hay login: se elige el usuario en `/ingresar` y se cambia con el selector "Viendo como". Cookie `uert_demo_usuario`.

## Circuito

```
recepcion ──(verificar + documentación + [EP: alta FODEP])──▶ evaluacion_medica ──(todo evaluado + baja definida)──▶ dictamen_legal
    │                                                            │                                                    │
    └──▶ desistido (falta de cobertura / relación no corroborada)  └──▶ desistido (2ª inasistencia = caducidad)           ├──▶ licencia_activa ──(alta)──▶ alta ──(reingreso, sufijo+1)──▶ recepcion
                                                                                                                     ├──▶ sin_baja ──(presentación CM)──▶ cerrado
                                                                                                                     └──▶ rechazado (todos los diagnósticos rechazados)
```

- Cada **diagnóstico** tiene estado propio: `invocado → evaluado → aceptado | rechazado` (o `desistido`).
- Intercurrencia: siniestro nuevo durante una licencia activa, vinculado (`origen_id`, `es_intercurrencia`), va directo a `evaluacion_medica`.
- Reingreso: mismo número, sufijo +1 (`2026-000012-01`), vuelve a `recepcion`.
- Permisos por rol y estado: `src/lib/dominio/permisos.ts` (`puede(rol, accion, estado)`).

## Reglas implementadas (dónde)

| Regla | Dónde |
| --- | --- |
| Número de siniestro 20 posiciones, sufijo de reingreso (RF-23/24) | `lib/dominio/numeracion.ts` |
| Siniestros abiertos (nuevo + sistema actual) al cargar (RF-25 a RF-28) | `operaciones/denuncias.ts` `siniestrosAbiertos` |
| Documentación por tipo de denuncia | `lib/dominio/documentos.ts` |
| Configuración: relación laboral; si no, Desistido e informe a SRT (48 h) | `operaciones/recepcion.ts` |
| Hasta 10 diagnósticos EP con agente causante (FO23) | `esquemas.ts`, `operaciones/medica.ts` |
| Citación ≥ 72 h, reiteración única, caducidad (Anexo II 1.6 y 3.3) | `operaciones/medica.ts` |
| Inicio de inasistencia ≥ siniestro + 1 día (RF-20) | `operaciones/medica.ts` `definirBaja` |
| Plazo legal 10 hábiles + prórroga 20 (RF-10, a confirmar) | `operaciones/legal.ts` |
| Motivos R/D/E/P/L; E exige CYMAT, P exige estudios (RF-47 a RF-49) | `operaciones/legal.ts` |
| Sin baja: 20 días hábiles para la Comisión Médica (RF-51) | `operaciones/legal.ts` |
| Alta = cese ILT, tope 365 días (RF-21/22) | `operaciones/seguimiento.ts` |
| WS FODEP simulado con errores FOxx (RF-52 a RF-63) | `lib/srt/fodep.ts`, `operaciones/srt.ts` |
| Archivos .AD/.AL/.AZ (RF-64 a RF-67) | `lib/srt/intercambio.ts`, `operaciones/intercambio.ts` |
| Búsqueda unificada nuevo + sistema actual por año (RF-02) | `lib/datos/busqueda.ts` |

## Arquitectura

Next.js 16.4 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 · shadcn/ui (Radix, preset Nova) · react-hook-form + zod 4 · PostgreSQL (`pg`) en la VPS y **PGlite** embebido en desarrollo y tests.

```
db/migraciones/*.sql        esquema (schema "uert")
db/catalogos/*.json         tablas de referencia de la SRT (CIE-10, agentes, lesiones, zonas, localidades SDE…)
src/lib/dominio/            vocabulario y reglas puras (constantes, fechas/plazos, validaciones, permisos, documentos)
src/lib/srt/                FODEP simulado y archivos de intercambio (puro)
src/lib/db/                 conexión (pg o PGlite), migraciones
src/lib/datos/              LECTURAS: listarExpedientes, obtenerFicha, plazosDe, listarCitaciones, buscarIncidentes, obtenerTablero, catálogos, SRT
src/lib/operaciones/        ESCRITURAS con reglas de negocio (reciben Ctx = { db, usuario, ahora })
src/lib/demo/               datos de la demo (se arman con las operaciones, fechas relativas a hoy)
src/app/acciones.ts         Server Functions que llaman las pantallas → ResultadoAccion
src/app/(app)/…             pantallas con la barra de la aplicación
src/app/imprimir/…          constancias y notificaciones para imprimir
src/components/ui/          shadcn (no modificar)
src/components/comun/       piezas compartidas (ver abajo)
src/components/<área>/      componentes de cada área
tests/                      vitest (dominio y flujos sobre PGlite en memoria)
```

### Convenciones

- **Todo en español** (código del dominio, textos). Voseo en la interfaz ("Elegí", "Cargá").
- **Cache Components desactivado** (igual que Oakland): render dinámico por pedido. `params`/`searchParams` son Promises (`await props.params`). El middleware se llama `src/proxy.ts`.
- Lecturas en Server Components con `const db = await getDb()` + funciones de `lib/datos`. Escrituras solo vía `src/app/acciones.ts` (devuelven `{ ok, datos } | { ok: false, error, detalles }`) y `revalidatePath("/", "layout")`.
- Usuario: `await requerirUsuario()` (`lib/sesion.ts`). Permisos en la interfaz: `puede(usuario.rol, "accion", estado)`.
- Fechas sin hora = `'YYYY-MM-DD'`; mostrar con `formatoFecha`, momentos con `formatoFechaHora` (hora de Argentina). Plazos con `plazosDe()` + `<PlazoBadge>`.
- Formularios: `react-hook-form` + `zodResolver` con los esquemas de `lib/esquemas.ts` cuando existen; componentes `Field*` de `components/ui/field.tsx`; fechas con `<Input type="date">` (permite escribir y elegir, RNF-08).
- Llamar acciones desde el cliente con `useAccion()` (`components/comun/use-accion.ts`) y mostrar errores con `<ErrorAccion>`.

### Identidad visual (Gobierno de Santiago del Estero)

Tomada de [sde.gob.ar](https://sde.gob.ar/): barra y pie en azul institucional con el logo en blanco y fondo gris lavanda. La tipografía es Figtree: el sitio usa Blinker, pero en pantallas con tablas densas resultaba dura.

| Pieza | Dónde |
| --- | --- |
| Colores (`--sde-azul` #003399, `--sde-celeste` #00a0e5, `--sde-rojo` #c4343b, `--sde-fondo` #efeff5, `--sde-texto` #1d1d1b) y su mapeo a los tokens de shadcn (`--primary`, `--ring`, `--destructive`, `--muted`…) | `src/app/globals.css` |
| Tipografía Figtree (variable, todos los pesos) | `src/app/layout.tsx`, `globals.css` |
| Logo de la Provincia, blanco (sobre azul) y azul (fondos claros y papel) | `src/assets/marca/*.svg` → `LogoSDE` |
| Marca de la app (logo · UERT · Gestión de denuncias) y pie institucional | `src/components/app/marca.tsx` (`Marca`, `PieSDE`) |
| Escudo en color como ícono de la pestaña | `src/app/icon.svg`, `favicon.ico`, `apple-icon.png` |
| Membrete de constancias, citaciones y rechazos | `Membrete` en `src/components/comun/documento.tsx` |

Los colores de cada rol (`ROL_INFO`) y de los estados no cambian: sirven para distinguir áreas. Los SVG se importan desde `src/assets` (no desde `/public`) para que Next les agregue el `basePath` de la VPS.

### Asistente virtual (Yanapa)

Botón flotante abajo a la derecha, en todas las pantallas de la app y en `/ingresar`. Su nombre viene de «yanapay», *ayudar* en quichua santiagueño, y su marca es el sol de ocho puntas del escudo. **No usa servicios de IA**: las respuestas salen de las reglas y constantes del sistema (si cambia un plazo, cambia la respuesta) y de los datos de la demo.

| Pieza | Dónde |
| --- | --- |
| Preguntas prearmadas, palabras clave, respuestas fijas, sugerencias por rol y pantalla | `src/lib/asistente/conocimiento.ts` (puro) |
| Respuestas con datos: pendientes por rol, vencimientos, resumen del día, citaciones, el expediente de la ficha, búsqueda por número/CUIL/DNI/apellido, adjuntos y audios | `src/lib/asistente/responder.ts` (solo lee) → `accionAsistente` en `src/app/acciones.ts` |
| Widget: panel, burbujas, todas las preguntas por tema | `src/components/asistente/` |
| Audios: graba con MediaRecorder y transcribe con el reconocimiento de voz del navegador (Chrome, Edge, Safari); si no puede, lo avisa | `use-grabador.ts` |
| Tests | `tests/asistente.test.ts` |

- La conversación vive en `sessionStorage`: sigue al navegar, al cambiar de rol (avisa «Ahora estás como…» y cambia las sugerencias) y al recargar. Los audios y las imágenes no se guardan ni se suben: del adjunto se mandan nombre, tipo y tamaño.
- Para sumar una pregunta: una entrada en `INTENCIONES` (pregunta, tema, claves y `responder` o `datos: true`) y un caso en el test de reconocimiento.
- La transcripción de Chrome usa el servicio de voz de Google. En el sistema real conviene definir dónde se procesan los audios (datos de salud).

### Recorrido guiado (system tour)

Oscurece la pantalla, marca un elemento y explica qué es y qué se puede hacer, paso a paso (← → para avanzar, Esc para salir). Dos recorridos:

- **De la pantalla**: el de la ruta y el rol actuales (bandejas, nueva denuncia, ficha, listado, búsqueda, SRT, tablero, administración). Si la bandeja es de otra área, explica cómo cambiar de rol. Se ofrece la primera vez que se entra a cada pantalla (abajo a la izquierda, con «No volver a ofrecer»).
- **Del circuito**: 29 pasos por Mesa de entrada → Área médica → Área legal → Seguimiento → Dirección. Cambia de rol solo (`cambiarUsuario`) y abre fichas de ejemplo en el estado de cada etapa (`accionExpedienteDeEjemplo`). Se arranca desde «Ver el recorrido guiado» en `/ingresar` (ideal para presentar), desde el botón **Recorrido** de la barra o pidiéndoselo a Yanapa.

| Pieza | Dónde |
| --- | --- |
| Guion: pasos de cada pantalla y etapas del circuito | `src/lib/recorrido/guion.ts` (puro) |
| Motor: foco, tarjeta, navegación y cambio de rol, oferta | `src/components/recorrido/recorrido.tsx` (`ProveedorRecorrido`, `useRecorrido`) |
| Botón de la barra y botón de `/ingresar` | `boton-recorrido.tsx`, `boton-ingreso.tsx` |
| Elementos marcados | atributo `data-recorrido` (lista en `OBJETIVOS`); `EncabezadoPagina` y `Seccion` aceptan `recorrido="…"` |
| Tests | `tests/recorrido.test.ts` (también controla que cada objetivo esté marcado en el código) |

El paso en curso vive en `sessionStorage`, así sobrevive al cambio de rol (Next rearma la página). Para sumar un paso: agregar el objetivo a `OBJETIVOS`, marcar el elemento con `data-recorrido` y escribir el paso en el guion; si el elemento puede no estar (depende del rol o del estado), marcar el paso como `opcional`.

### Piezas compartidas (`src/components/comun`)

| Pieza | Uso |
| --- | --- |
| `EncabezadoPagina`, `Seccion`, `Dato`, `Datos` | Estructura de páginas y fichas |
| `TablaExpedientes` | Tabla de bandeja (servidor), con plazo más urgente y columnas extra |
| `EstadoBadge`, `TipoBadge`, `EstadoDiagnosticoBadge`, `EstadoCitacionBadge`, `PlazoBadge`, `RolBadge`, `Simulado`, `Etiqueta` | Etiquetas |
| `Circuito` | Indicador de etapa del expediente |
| `CampoCatalogo` | Combo con buscador sobre catálogos SRT (`/api/catalogos/[catalogo]?q=`) |
| `SelectorArchivos` | Elegir archivos en varias tandas (se registran nombre y tamaño; el aviso de la demo, una vez por pantalla) |
| `AdjuntarDocumento` | Adjuntar uno o varios archivos al expediente, desde cualquier área con permiso |
| `useAccion`, `ErrorAccion` | Ejecutar acciones con espera, aviso y errores |
| `PanelProps`, `PanelArea` | Props y marco común (encabezado con el color del rol) de los paneles de acciones de la ficha |
| `TarjetaIndicador`, `GrillaIndicadores` | Indicadores de las bandejas y el tablero (el color va en el ícono, nunca en el número) |
| `Hoja`, `Membrete`, `BarraImpresion`, `PieDocumento`, `BotonImprimir` | Documentos para imprimir (constancia, citación, notificación de rechazo) |
| `EsqueletoPagina` | Esqueleto de carga de bandejas, tablero, SRT, Administración, listado y búsqueda |

## Pendiente de confirmar con la UERT / SRT

- CART y prefijo del número de siniestro (tomados del sistema anterior: `00050` / `00050024`); continuidad de la numeración del sistema actual.
- Tabla oficial de estados FODEP, relación CIE-10/agente causante (FO22), WSDL y certificado.
- Documentación de in itinere, reingresos e intercurrencias; prórroga legal (20 días); anticipación y medio de las alertas (RF-15).
- Feriados trasladables (solo se cargaron los de fecha fija).
- Diferencia en el documento de Intercambio v0.2: los ejemplos muestran Nro. de siniestro en .AL/.AZ y la definición de campos no.
