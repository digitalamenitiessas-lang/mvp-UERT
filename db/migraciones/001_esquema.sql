-- MVP UERT · esquema inicial
-- Compatible con PostgreSQL 17 (VPS) y con PGlite (desarrollo y tests).
-- Todo vive en el schema "uert". Fechas sin hora como DATE ('YYYY-MM-DD');
-- momentos como TIMESTAMPTZ. La zona horaria de negocio es
-- America/Argentina/Buenos_Aires y se calcula en la aplicación.

create schema if not exists uert;
set search_path to uert, public;

-- ---------------------------------------------------------------------------
-- Usuarios de la demo (no hay login real: se elige el usuario y su rol)
-- ---------------------------------------------------------------------------
create table usuarios (
  id        serial primary key,
  nombre    text not null,
  rol       text not null check (rol in ('mesa_entrada','medico','legal','seguimiento','direccion','admin')),
  cargo     text not null,
  email     text,
  activo    boolean not null default true,
  orden     int not null default 0
);

-- ---------------------------------------------------------------------------
-- Catálogos de referencia de la SRT (copias de las tablas publicadas)
-- ---------------------------------------------------------------------------
create table cat_cie10           (codigo text primary key, descripcion text not null);
create table cat_agente_causante (codigo text primary key, descripcion text not null);
create table cat_lesion          (codigo text primary key, descripcion text not null);
create table cat_zona_cuerpo     (codigo text primary key, descripcion text not null);
create table cat_forma_accidente (codigo text primary key, descripcion text not null);
create table cat_agente_material (codigo text primary key, descripcion text not null);
create table cat_ciuo88          (codigo text primary key, descripcion text not null);
create table cat_provincia (
  id          int primary key,
  codigo_dgi  text not null,
  nombre      text not null
);
create table cat_localidad (
  id            int primary key,
  provincia_id  int not null references cat_provincia(id),
  nombre        text not null,
  codigo_postal text,
  departamento  text
);
create index cat_localidad_nombre_idx on cat_localidad (lower(nombre));

create table feriados (
  fecha        date primary key,
  descripcion  text not null
);

-- Numeración de siniestros: un contador por año (Res. SRT 3326/14)
create table contadores (
  anio    int primary key,
  ultimo  int not null
);

create sequence numero_unico_diagnostico_seq start 100000001;
create sequence fodep_codigo_seq start 7001;          -- simulado (lo asigna la SRT)
create sequence fodep_numero_seq start 2026000101;     -- simulado (lo asigna la SRT)

-- ---------------------------------------------------------------------------
-- Personas trabajadoras
-- ---------------------------------------------------------------------------
create table personas (
  id               serial primary key,
  cuil             text not null unique check (cuil ~ '^[0-9]{11}$'),
  dni              text not null check (dni ~ '^[0-9]{7,8}$'),
  apellido         text not null,
  nombres          text not null,
  fecha_nacimiento date,
  sexo             text check (sexo in ('F','M','X')),
  telefono         text,
  email            text,
  domicilio        text,
  localidad_id     int references cat_localidad(id),
  creado_en        timestamptz not null default now()
);
create index personas_dni_idx on personas (dni);
create index personas_apellido_idx on personas (lower(apellido));

-- Siniestros del sistema que la UERT usa hoy (simulado para la demo de la
-- búsqueda unificada, RF-01/RF-02)
create table legado_siniestros (
  id               serial primary key,
  cuil             text,
  dni              text,
  apellido_nombre  text not null,
  numero           text not null,
  anio             int not null,
  tipo             text not null,
  estado           text not null,
  abierto          boolean not null default false,
  fecha_ocurrencia date,
  diagnostico      text,
  reparticion      text
);
create index legado_dni_idx on legado_siniestros (dni);
create index legado_cuil_idx on legado_siniestros (cuil);

-- ---------------------------------------------------------------------------
-- Expedientes (una denuncia = un siniestro)
-- ---------------------------------------------------------------------------
create table expedientes (
  id        serial primary key,
  anio      int not null,
  contador  int not null,
  sufijo    int not null default 0 check (sufijo between 0 and 99),
  numero    text generated always as (
              anio::text || '-' || lpad(contador::text, 6, '0') || '-' || lpad(sufijo::text, 2, '0')
            ) stored,
  tipo      text not null check (tipo in ('EP','AT','IT')),
  estado    text not null check (estado in (
              'recepcion','evaluacion_medica','dictamen_legal','licencia_activa',
              'sin_baja','alta','rechazado','desistido','cerrado')),
  persona_id         int not null references personas(id),
  origen_id          int references expedientes(id),
  es_reingreso       boolean not null default false,
  es_intercurrencia  boolean not null default false,
  reencuadrado_en    timestamptz,

  -- Recepción (Mesa de entrada)
  canal                 text not null default 'presencial' check (canal in ('presencial','digital')),
  denunciante_tipo      text not null default 'trabajador'
                        check (denunciante_tipo in ('trabajador','empleador','derechohabiente','otro')),
  denunciante_nombre    text,
  denunciante_email     text,
  denunciante_telefono  text,
  recibido_en           timestamptz not null,
  recibido_por          int references usuarios(id),

  -- Datos laborales
  reparticion             text not null,
  cuit_empleador          text not null default '30999164990',
  codigo_establecimiento  text not null default '0',
  domicilio_laboral       text,
  localidad_laboral_id    int references cat_localidad(id),
  puesto                  text,
  ciuo                    text references cat_ciuo88(codigo),
  tareas                  text,
  antiguedad_empresa      text,
  antiguedad_area         text,
  desvinculado            boolean not null default false,

  -- El hecho (AT/IT) o la primera manifestación (EP)
  fecha_ocurrencia         date,
  hora_ocurrencia          text,
  lugar_ocurrencia         text,
  localidad_ocurrencia_id  int references cat_localidad(id),
  descripcion              text,
  forma_accidente          text references cat_forma_accidente(codigo),
  agente_material          text references cat_agente_material(codigo),
  trayecto                 text,

  -- Enfermedad profesional (FODEP)
  pluriempleo        boolean,
  cuits_pluriempleo  text[],
  obligada_pago      boolean,
  exposicion_desde   date,
  exposicion_hasta   date,
  fodep_codigo       int,
  fodep_numero       bigint,
  fodep_estado       int,

  -- Configuración de la denuncia
  relacion_laboral_verificada  boolean,
  verificado_en                timestamptz,

  -- Área médica
  con_baja                   boolean,
  fecha_inicio_inasistencia  date,
  estres_postraumatico       boolean not null default false,

  -- Área legal
  legal_ingreso          date,
  legal_vence            date,
  legal_prorroga_usada   boolean not null default false,

  -- Licencia (ILT) y cierre
  proxima_presentacion  date,
  fecha_fin_ilt         date,
  motivo_cese_ilt       text check (motivo_cese_ilt in ('L','P','D','T')),
  cm_vence              date,
  cm_presentado_en      date,
  desistido_motivo      text check (desistido_motivo in (
                          'falta_cobertura','relacion_no_corroborada',
                          'inconsistencia_diagnostico','incomparecencia')),
  cerrado_en            timestamptz,

  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  unique (anio, contador, sufijo)
);
create index expedientes_estado_idx on expedientes (estado);
create index expedientes_persona_idx on expedientes (persona_id);

-- ---------------------------------------------------------------------------
-- Diagnósticos (hasta 10 por denuncia de EP; estado y resolución propios)
-- ---------------------------------------------------------------------------
create table diagnosticos (
  id                   serial primary key,
  expediente_id        int not null references expedientes(id) on delete cascade,
  orden                int not null check (orden between 1 and 999),
  numero_unico         bigint not null unique default nextval('numero_unico_diagnostico_seq'),
  cie10                text not null references cat_cie10(codigo),
  cie10_adecuado       text references cat_cie10(codigo),
  agente_causante      text references cat_agente_causante(codigo),
  fecha_diagnostico    date,
  codigo_examen        text check (codigo_examen in ('P','R','E','A','T','O','N','H','M','J','S','B','F')),
  origen               text not null default 'denuncia' check (origen in ('denuncia','evaluacion')),
  en_listado           boolean,
  patologia_constatada boolean,
  observacion_medica   text,
  estado               text not null default 'invocado'
                       check (estado in ('invocado','evaluado','aceptado','rechazado','desistido')),
  motivo_rechazo       text check (motivo_rechazo in ('R','D','E','P','L')),
  fundamento           text,
  estudios             text,
  cymat_adjunto        boolean,
  evaluado_en          timestamptz,
  decidido_en          timestamptz,
  intercambio_estado   text not null default 'pendiente'
                       check (intercambio_estado in ('pendiente','informado','modificado')),
  intercambio_lote_id  int,
  unique (expediente_id, orden)
);
create index diagnosticos_expediente_idx on diagnosticos (expediente_id);

create table diagnostico_lesiones (
  id              serial primary key,
  diagnostico_id  int not null references diagnosticos(id) on delete cascade,
  orden           int not null,
  codigo          text not null references cat_lesion(codigo),
  unique (diagnostico_id, orden)
);

create table diagnostico_zonas (
  id              serial primary key,
  diagnostico_id  int not null references diagnosticos(id) on delete cascade,
  orden           int not null,
  codigo          text not null references cat_zona_cuerpo(codigo),
  unique (diagnostico_id, orden)
);

-- ---------------------------------------------------------------------------
-- Documentación (en el MVP se registran los datos del archivo, no el archivo)
-- ---------------------------------------------------------------------------
create table documentos (
  id             serial primary key,
  expediente_id  int not null references expedientes(id) on delete cascade,
  tipo           text not null,
  nombre_archivo text,
  tamano_bytes   int,
  etapa          text not null default 'recepcion'
                 check (etapa in ('recepcion','medica','legal','seguimiento')),
  observacion    text,
  cargado_por    int references usuarios(id),
  cargado_en     timestamptz not null
);
create index documentos_expediente_idx on documentos (expediente_id);

-- ---------------------------------------------------------------------------
-- Citaciones a examen o a presentar documentación (Anexo II pto. 3.3)
-- ---------------------------------------------------------------------------
create table citaciones (
  id                      serial primary key,
  expediente_id           int not null references expedientes(id) on delete cascade,
  reiteracion_de          int references citaciones(id),
  fecha_hora              timestamptz not null,
  motivo                  text not null check (motivo in ('examen','estudios','documentacion')),
  lugar                   text not null,
  detalle                 text,
  estado                  text not null default 'programada'
                          check (estado in ('programada','asistio','no_asistio')),
  notificada_en           timestamptz not null,
  resultado_registrado_en timestamptz,
  creada_por              int references usuarios(id)
);
create index citaciones_expediente_idx on citaciones (expediente_id);

-- ---------------------------------------------------------------------------
-- Seguimiento de la licencia: presentaciones periódicas (RF-13 a RF-16)
-- ---------------------------------------------------------------------------
create table presentaciones (
  id              serial primary key,
  expediente_id   int not null references expedientes(id) on delete cascade,
  fecha           date not null,
  detalle         text not null,
  proxima_fecha   date,
  registrada_por  int references usuarios(id),
  registrada_en   timestamptz not null
);
create index presentaciones_expediente_idx on presentaciones (expediente_id);

-- ---------------------------------------------------------------------------
-- Historial / auditoría de cada expediente
-- ---------------------------------------------------------------------------
create table movimientos (
  id               bigserial primary key,
  expediente_id    int references expedientes(id) on delete cascade,
  fecha            timestamptz not null,
  usuario_id       int references usuarios(id),
  rol              text,
  accion           text not null,
  detalle          text not null,
  estado_anterior  text,
  estado_nuevo     text,
  datos            jsonb
);
create index movimientos_expediente_idx on movimientos (expediente_id, fecha desc);

-- ---------------------------------------------------------------------------
-- Comunicaciones con la SRT (en el MVP, todas simuladas)
-- ---------------------------------------------------------------------------
create table srt_comunicaciones (
  id             bigserial primary key,
  expediente_id  int references expedientes(id) on delete cascade,
  canal          text not null check (canal in ('ws_fodep','eservicios','ventanilla','intercambio')),
  operacion      text not null,
  request        jsonb,
  response       jsonb,
  ok             boolean not null,
  error_codigo   text,
  error_mensaje  text,
  simulado       boolean not null default true,
  fecha          timestamptz not null
);
create index srt_comunicaciones_expediente_idx on srt_comunicaciones (expediente_id, fecha desc);

create table intercambio_lotes (
  id            serial primary key,
  generado_en   timestamptz not null,
  generado_por  int references usuarios(id),
  archivos      jsonb not null,
  registros     int not null
);
