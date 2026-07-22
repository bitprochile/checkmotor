import { Pool, PoolClient, types } from 'pg'
import bcrypt from 'bcryptjs'

// TIMESTAMP WITHOUT TIME ZONE (OID 1114): pg por defecto lo interpreta como UTC,
// pero la app y la DB corren en America/Santiago, por lo que debe parsearse como hora local.
types.setTypeParser(1114, (str: string) => new Date(str.replace(' ', 'T')))

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await pool.query(text, params)
  return result.rows as T[]
}

export async function queryOne<T>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] ?? null
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

export type RolUsuario    = 'admin' | 'mecanico' | 'recepcion'
export type EstadoOrden   = 'presupuestada' | 'pendiente' | 'en_progreso' | 'completada' | 'entregada' | 'rechazada'

export interface Taller {
  id: number; nombre: string; email: string | null
  telefono: string | null; direccion: string | null
  activo: boolean; created_at: Date
}

export interface TallerConStats extends Taller {
  usuarios_count: string; ordenes_activas: string
}

export interface Usuario {
  id: number; taller_id: number; nombre: string; email: string
  rol: RolUsuario; activo: boolean; superadmin: boolean; created_at: Date
}
export interface UsuarioRow extends Usuario { password_hash: string }

export interface Cliente {
  id: number; taller_id: number; nombre: string
  rut: string | null; email: string | null; telefono: string | null
  created_at: Date
}

export interface Vehiculo {
  id: number; taller_id: number; cliente_id: number
  patente: string; marca: string; modelo: string
  anio: number | null; color: string | null; created_at: Date
}
export interface VehiculoConCliente extends Vehiculo { cliente_nombre: string }

export interface OrdenTrabajo {
  id: number; taller_id: number; vehiculo_id: number
  descripcion: string; estado: EstadoOrden
  km_ingreso: number | null; km_salida: number | null
  km_proxima: number | null; fecha_proxima: string | null
  mecanico_id: number | null; notas_internas: string | null
  costo_total: number | null; checklist_completado: boolean
  numero_documento: number | null; numero_boleta: number | null
  presupuesto_enviado_en: Date | null; aprobado_en: Date | null
  rechazado_en: Date | null; razon_rechazo: string | null
  subtotal: number | null; iva: number | null; total_con_iva: number | null
  incluir_iva: boolean; forma_pago: string | null; monto_pagado: number | null
  created_at: Date; updated_at: Date
}
export interface OrdenTrabajoCompleta extends OrdenTrabajo {
  patente: string; marca: string; modelo: string
  cliente_nombre: string; mecanico_nombre: string | null
}

export interface OrdenTimeline extends OrdenTrabajo {
  servicios: Array<{ nombre: string; precio_aplicado: string | null }>
  observaciones_count: string
}

export interface Servicio {
  id: number; taller_id: number; nombre: string
  descripcion: string | null; precio_base: number | null
  activo: boolean; created_at: Date
}

export interface OrdenServicioConNombre {
  id: number; orden_id: number; servicio_id: number
  precio_aplicado: number | null; nombre: string; precio_base: number | null
}

export interface Repuesto {
  id: number; taller_id: number; codigo: string | null
  nombre: string; descripcion: string | null; unidad: string
  stock_actual: number; stock_minimo: number
  precio_costo: number; precio_venta: number
  activo: boolean; created_at: Date; updated_at: Date
}

export interface MovimientoStock {
  id: number; taller_id: number; repuesto_id: number
  orden_id: number | null; tipo: 'entrada' | 'salida' | 'ajuste'
  cantidad: number; stock_antes: number; stock_despues: number
  motivo: string | null; usuario_id: number | null; created_at: Date
}

export interface OrdenRepuesto {
  id: number; orden_id: number; repuesto_id: number
  cantidad: number; precio_aplicado: number
}

export interface ConfiguracionTaller {
  id: number; taller_id: number
  hora_apertura: string; hora_cierre: string
  dias_atencion: number[]; capacidad_boxes: number
  duracion_slot_min: number; updated_at: Date
}

export type EstadoCita = 'pendiente' | 'confirmada' | 'en_curso' | 'completada' | 'cancelada' | 'no_asistio'

export interface Cita {
  id: number; taller_id: number; vehiculo_id: number
  mecanico_id: number | null; fecha_hora: Date; duracion_min: number
  estado: EstadoCita; tipo_servicio: string | null
  observaciones: string | null; orden_id: number | null
  notificado_whatsapp: boolean; created_at: Date; updated_at: Date
}

export interface ChecklistItem {
  id: number; taller_id: number; categoria: string; nombre: string
  descripcion: string | null; orden: number; activo: boolean; created_at: Date
}

export interface OrdenChecklist {
  id: number; orden_id: number; item_id: number
  estado: 'ok' | 'observacion' | 'no_aplica' | 'pendiente'
  nota: string | null; revisado_en: Date | null
}

export interface OrdenChecklistConItem extends OrdenChecklist {
  categoria: string; item_nombre: string
  item_descripcion: string | null; item_orden: number
}

export interface CitaConDetalle extends Cita {
  cliente_nombre: string; cliente_telefono: string | null
  vehiculo_patente: string; vehiculo_marca: string; vehiculo_modelo: string
  mecanico_nombre: string | null
}

export interface PerfilTaller {
  id: number
  taller_id: number
  nombre: string
  rut: string | null
  direccion: string | null
  telefono: string | null
  email: string | null
  website: string | null
  logo_url: string | null
  pie_pagina: string | null
  updated_at: Date
}

export interface WhatsappConfig {
  id: number; taller_id: number; phone_number_id: string
  access_token: string; verify_token: string
  activo: boolean; updated_at: Date
}

export interface WhatsappConversacion {
  id: number; taller_id: number; whatsapp_id: string
  nombre_contacto: string | null; modo: 'bot' | 'humano' | 'cerrada'
  mensajes_no_leidos: number; created_at: Date
}

export interface WhatsappMensaje {
  id: number; conversacion_id: number; taller_id: number
  direccion: 'entrante' | 'saliente'; contenido: string
  tipo: string; wamid: string | null; enviado_en: Date
}

// ── Migrations ─────────────────────────────────────────────────────────────

async function ensureTalleres() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS talleres (
      id SERIAL PRIMARY KEY, nombre TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    )`)
  await pool.query(`ALTER TABLE talleres ADD COLUMN IF NOT EXISTS telefono TEXT`)
  await pool.query(`ALTER TABLE talleres ADD COLUMN IF NOT EXISTS direccion TEXT`)
  await pool.query(`ALTER TABLE talleres ADD COLUMN IF NOT EXISTS email TEXT`)
  await pool.query(`ALTER TABLE talleres ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true`)
  const { rows } = await pool.query('SELECT id FROM talleres WHERE id = 1')
  if (!rows.length) await pool.query(`INSERT INTO talleres (id, nombre) VALUES (1, 'Taller Demo')`)
}

async function ensureUsuarios() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY, taller_id INTEGER NOT NULL REFERENCES talleres(id),
      nombre TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL, rol TEXT NOT NULL DEFAULT 'mecanico',
      activo BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
    )`)
  await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS superadmin BOOLEAN NOT NULL DEFAULT false`)
  const seeds = [
    { nombre: 'Administrador',   email: 'admin@taller.com',     password: 'admin123', rol: 'admin',    superadmin: false },
    { nombre: 'Carlos Mecánico', email: 'mecanico@taller.com',  password: 'mec123',   rol: 'mecanico', superadmin: false },
    { nombre: 'Ana Recepción',   email: 'recepcion@taller.com', password: 'rec123',   rol: 'recepcion',superadmin: false },
    { nombre: 'Super Admin',     email: 'super@platform.com',   password: 'super123', rol: 'admin',    superadmin: true  },
  ]
  for (const s of seeds) {
    const { rows } = await pool.query('SELECT id FROM usuarios WHERE email = $1', [s.email])
    if (!rows.length) {
      const hash = await bcrypt.hash(s.password, 10)
      await pool.query(
        'INSERT INTO usuarios (taller_id, nombre, email, password_hash, rol, superadmin) VALUES ($1,$2,$3,$4,$5,$6)',
        [1, s.nombre, s.email, hash, s.rol, s.superadmin])
    }
  }
}

async function ensureClientes() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clientes (
      id SERIAL PRIMARY KEY, taller_id INTEGER NOT NULL REFERENCES talleres(id),
      nombre TEXT NOT NULL, rut TEXT, email TEXT, telefono TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`)
}

async function ensureVehiculos() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vehiculos (
      id SERIAL PRIMARY KEY, taller_id INTEGER NOT NULL REFERENCES talleres(id),
      cliente_id INTEGER NOT NULL REFERENCES clientes(id),
      patente TEXT NOT NULL, marca TEXT NOT NULL, modelo TEXT NOT NULL,
      anio INTEGER, color TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    )`)
}

async function ensureOrdenesTrabajo() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ordenes_trabajo (
      id SERIAL PRIMARY KEY, taller_id INTEGER NOT NULL REFERENCES talleres(id),
      vehiculo_id INTEGER NOT NULL REFERENCES vehiculos(id),
      descripcion TEXT NOT NULL, estado TEXT NOT NULL DEFAULT 'pendiente',
      km_ingreso INTEGER, costo_total NUMERIC(10,2),
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`)
}

async function ensureServicios() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS servicios (
      id SERIAL PRIMARY KEY, taller_id INTEGER NOT NULL REFERENCES talleres(id),
      nombre TEXT NOT NULL, descripcion TEXT,
      precio_base NUMERIC(10,2), activo BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`)
}

async function ensureOrdenesExtra() {
  await pool.query(`
    ALTER TABLE ordenes_trabajo
      ADD COLUMN IF NOT EXISTS km_salida       INTEGER,
      ADD COLUMN IF NOT EXISTS km_proxima      INTEGER,
      ADD COLUMN IF NOT EXISTS fecha_proxima   DATE,
      ADD COLUMN IF NOT EXISTS mecanico_id     INTEGER REFERENCES usuarios(id),
      ADD COLUMN IF NOT EXISTS notas_internas  TEXT
  `)
}

async function ensureOrdenesTrabajoServicios() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ordenes_trabajo_servicios (
      id SERIAL PRIMARY KEY,
      orden_id INTEGER NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
      servicio_id INTEGER NOT NULL REFERENCES servicios(id) ON DELETE CASCADE,
      precio_aplicado NUMERIC(10,2),
      UNIQUE(orden_id, servicio_id)
    )`)
}

async function ensureRepuestos(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS repuestos (
      id            SERIAL PRIMARY KEY,
      taller_id     INTEGER NOT NULL REFERENCES talleres(id),
      codigo        VARCHAR(50),
      nombre        VARCHAR(200) NOT NULL,
      descripcion   TEXT,
      unidad        VARCHAR(30) NOT NULL DEFAULT 'unidad',
      stock_actual  NUMERIC(10,2) NOT NULL DEFAULT 0,
      stock_minimo  NUMERIC(10,2) NOT NULL DEFAULT 0,
      precio_costo  NUMERIC(12,2) NOT NULL DEFAULT 0,
      precio_venta  NUMERIC(12,2) NOT NULL DEFAULT 0,
      activo        BOOLEAN NOT NULL DEFAULT true,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function ensureMovimientosStock(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS movimientos_stock (
      id            SERIAL PRIMARY KEY,
      taller_id     INTEGER NOT NULL REFERENCES talleres(id),
      repuesto_id   INTEGER NOT NULL REFERENCES repuestos(id),
      orden_id      INTEGER REFERENCES ordenes_trabajo(id),
      tipo          VARCHAR(20) NOT NULL CHECK (tipo IN ('entrada','salida','ajuste')),
      cantidad      NUMERIC(10,2) NOT NULL,
      stock_antes   NUMERIC(10,2) NOT NULL,
      stock_despues NUMERIC(10,2) NOT NULL,
      motivo        VARCHAR(200),
      usuario_id    INTEGER REFERENCES usuarios(id),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function ensureChecklistItems(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS checklist_items (
      id          SERIAL PRIMARY KEY,
      taller_id   INTEGER NOT NULL REFERENCES talleres(id),
      categoria   VARCHAR(100) NOT NULL,
      nombre      VARCHAR(200) NOT NULL,
      descripcion TEXT,
      orden       INTEGER NOT NULL DEFAULT 0,
      activo      BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function ensureOrdenesChecklist(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ordenes_checklist (
      id          SERIAL PRIMARY KEY,
      orden_id    INTEGER NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
      item_id     INTEGER NOT NULL REFERENCES checklist_items(id),
      estado      VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('ok','observacion','no_aplica','pendiente')),
      nota        TEXT,
      revisado_en TIMESTAMPTZ,
      UNIQUE(orden_id, item_id)
    )
  `)
}

async function ensureOrdenesChecklistCompletado(): Promise<void> {
  await pool.query(`
    ALTER TABLE ordenes_trabajo
    ADD COLUMN IF NOT EXISTS checklist_completado BOOLEAN NOT NULL DEFAULT false
  `)
}

const ITEMS_DEFAULT = [
  { categoria: 'Carrocería exterior', nombre: 'Parachoques delantero',          orden: 1  },
  { categoria: 'Carrocería exterior', nombre: 'Parachoques trasero',             orden: 2  },
  { categoria: 'Carrocería exterior', nombre: 'Capó',                           orden: 3  },
  { categoria: 'Carrocería exterior', nombre: 'Maletero / portón',              orden: 4  },
  { categoria: 'Carrocería exterior', nombre: 'Puerta delantera izquierda',     orden: 5  },
  { categoria: 'Carrocería exterior', nombre: 'Puerta delantera derecha',       orden: 6  },
  { categoria: 'Carrocería exterior', nombre: 'Puerta trasera izquierda',       orden: 7  },
  { categoria: 'Carrocería exterior', nombre: 'Puerta trasera derecha',         orden: 8  },
  { categoria: 'Carrocería exterior', nombre: 'Espejos laterales',              orden: 9  },
  { categoria: 'Carrocería exterior', nombre: 'Parabrisas delantero',           orden: 10 },
  { categoria: 'Carrocería exterior', nombre: 'Luneta trasera',                 orden: 11 },
  { categoria: 'Carrocería exterior', nombre: 'Ventanas laterales',             orden: 12 },
  { categoria: 'Neumáticos y ruedas', nombre: 'Neumático delantero izquierdo', orden: 13 },
  { categoria: 'Neumáticos y ruedas', nombre: 'Neumático delantero derecho',   orden: 14 },
  { categoria: 'Neumáticos y ruedas', nombre: 'Neumático trasero izquierdo',   orden: 15 },
  { categoria: 'Neumáticos y ruedas', nombre: 'Neumático trasero derecho',     orden: 16 },
  { categoria: 'Neumáticos y ruedas', nombre: 'Neumático de repuesto',         orden: 17 },
  { categoria: 'Neumáticos y ruedas', nombre: 'Aros / tapacubos',              orden: 18 },
  { categoria: 'Interior',            nombre: 'Tapizado de asientos',          orden: 19 },
  { categoria: 'Interior',            nombre: 'Tablero y consola central',     orden: 20 },
  { categoria: 'Interior',            nombre: 'Volante',                       orden: 21 },
  { categoria: 'Interior',            nombre: 'Alfombras y tapetes',           orden: 22 },
  { categoria: 'Interior',            nombre: 'Cielo interior',                orden: 23 },
  { categoria: 'Accesorios y documentos', nombre: 'Permiso de circulación',    orden: 24 },
  { categoria: 'Accesorios y documentos', nombre: 'Revisión técnica',          orden: 25 },
  { categoria: 'Accesorios y documentos', nombre: 'Radio / sistema de audio',  orden: 26 },
  { categoria: 'Accesorios y documentos', nombre: 'Encendedor / cargador USB', orden: 27 },
  { categoria: 'Accesorios y documentos', nombre: 'Gato hidráulico y llave de ruedas', orden: 28 },
  { categoria: 'Accesorios y documentos', nombre: 'Triángulos de emergencia',  orden: 29 },
  { categoria: 'Niveles y fluidos',   nombre: 'Nivel de combustible',          orden: 30 },
  { categoria: 'Niveles y fluidos',   nombre: 'Nivel de aceite',               orden: 31 },
  { categoria: 'Niveles y fluidos',   nombre: 'Nivel de agua radiador',        orden: 32 },
  { categoria: 'Niveles y fluidos',   nombre: 'Nivel de líquido de frenos',    orden: 33 },
]

export async function seedChecklistItems(taller_id: number): Promise<void> {
  const [{ count }] = (await pool.query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM checklist_items WHERE taller_id=$1', [taller_id],
  )).rows
  if (Number(count) > 0) return
  for (const item of ITEMS_DEFAULT) {
    await pool.query(
      `INSERT INTO checklist_items (taller_id, categoria, nombre, orden)
       VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [taller_id, item.categoria, item.nombre, item.orden],
    )
  }
}

async function ensureConfiguracionTaller(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS configuracion_taller (
      id                SERIAL PRIMARY KEY,
      taller_id         INTEGER NOT NULL UNIQUE REFERENCES talleres(id),
      hora_apertura     TIME NOT NULL DEFAULT '08:00',
      hora_cierre       TIME NOT NULL DEFAULT '18:00',
      dias_atencion     INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
      capacidad_boxes   INTEGER NOT NULL DEFAULT 3,
      duracion_slot_min INTEGER NOT NULL DEFAULT 60,
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function ensureCitas(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS citas (
      id                  SERIAL PRIMARY KEY,
      taller_id           INTEGER NOT NULL REFERENCES talleres(id),
      vehiculo_id         INTEGER NOT NULL REFERENCES vehiculos(id),
      mecanico_id         INTEGER REFERENCES usuarios(id),
      fecha_hora          TIMESTAMPTZ NOT NULL,
      duracion_min        INTEGER NOT NULL DEFAULT 60,
      estado              VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                          CHECK (estado IN ('pendiente','confirmada','en_curso','completada','cancelada','no_asistio')),
      tipo_servicio       VARCHAR(200),
      observaciones       TEXT,
      orden_id            INTEGER REFERENCES ordenes_trabajo(id),
      notificado_whatsapp BOOLEAN NOT NULL DEFAULT false,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function ensureOrdenesRepuestos(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ordenes_repuestos (
      id              SERIAL PRIMARY KEY,
      orden_id        INTEGER NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
      repuesto_id     INTEGER NOT NULL REFERENCES repuestos(id),
      cantidad        NUMERIC(10,2) NOT NULL,
      precio_aplicado NUMERIC(12,2) NOT NULL,
      UNIQUE(orden_id, repuesto_id)
    )
  `)
}

async function ensureOrdenesPresupuesto(): Promise<void> {
  // Drop and recreate the estado CHECK to include new values
  await pool.query(`ALTER TABLE ordenes_trabajo DROP CONSTRAINT IF EXISTS ordenes_trabajo_estado_check`)
  await pool.query(`ALTER TABLE ordenes_trabajo ADD CONSTRAINT ordenes_trabajo_estado_check
    CHECK (estado IN ('presupuestada','pendiente','en_progreso','completada','entregada','rechazada'))`)

  const cols = [
    `ADD COLUMN IF NOT EXISTS numero_documento INTEGER`,
    `ADD COLUMN IF NOT EXISTS numero_boleta INTEGER`,
    `ADD COLUMN IF NOT EXISTS presupuesto_enviado_en TIMESTAMPTZ`,
    `ADD COLUMN IF NOT EXISTS aprobado_en TIMESTAMPTZ`,
    `ADD COLUMN IF NOT EXISTS rechazado_en TIMESTAMPTZ`,
    `ADD COLUMN IF NOT EXISTS razon_rechazo TEXT`,
    `ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2)`,
    `ADD COLUMN IF NOT EXISTS iva NUMERIC(12,2)`,
    `ADD COLUMN IF NOT EXISTS total_con_iva NUMERIC(12,2)`,
    `ADD COLUMN IF NOT EXISTS incluir_iva BOOLEAN NOT NULL DEFAULT false`,
    `ADD COLUMN IF NOT EXISTS forma_pago VARCHAR(50)`,
    `ADD COLUMN IF NOT EXISTS monto_pagado NUMERIC(12,2)`,
  ]
  for (const col of cols) {
    await pool.query(`ALTER TABLE ordenes_trabajo ${col}`)
  }
}

async function ensureCorrelativoDocumentos(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS correlativo_documentos (
      id          SERIAL PRIMARY KEY,
      taller_id   INTEGER NOT NULL REFERENCES talleres(id),
      tipo        VARCHAR(20) NOT NULL CHECK (tipo IN ('presupuesto','boleta')),
      ultimo_numero INTEGER NOT NULL DEFAULT 0,
      UNIQUE(taller_id, tipo)
    )
  `)
}

async function ensurePerfilTaller(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS perfil_taller (
      id           SERIAL PRIMARY KEY,
      taller_id    INTEGER NOT NULL UNIQUE REFERENCES talleres(id),
      nombre       VARCHAR(200) NOT NULL DEFAULT 'Mi Taller',
      rut          VARCHAR(20),
      direccion    TEXT,
      telefono     VARCHAR(30),
      email        VARCHAR(200),
      website      VARCHAR(200),
      logo_url     TEXT,
      pie_pagina   TEXT,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function ensureWhatsappConfig() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_config (
      id              SERIAL PRIMARY KEY,
      taller_id       INTEGER      NOT NULL UNIQUE REFERENCES talleres(id),
      phone_number_id VARCHAR(60)  NOT NULL DEFAULT '',
      access_token    TEXT         NOT NULL DEFAULT '',
      verify_token    VARCHAR(100) NOT NULL DEFAULT '',
      activo          BOOLEAN      NOT NULL DEFAULT false,
      updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`ALTER TABLE whatsapp_config DROP COLUMN IF EXISTS openai_api_key`)
  await pool.query(`ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS nombre_agente VARCHAR(100) NOT NULL DEFAULT 'Asistente'`)
}

async function ensureWhatsappConversaciones() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_conversaciones (
      id                 SERIAL PRIMARY KEY,
      taller_id          INTEGER     NOT NULL REFERENCES talleres(id),
      whatsapp_id        VARCHAR(30) NOT NULL,
      nombre_contacto    VARCHAR(200),
      modo               VARCHAR(20) NOT NULL DEFAULT 'bot',
      mensajes_no_leidos INTEGER     NOT NULL DEFAULT 0,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(taller_id, whatsapp_id)
    )
  `)
}

async function ensureWhatsappMensajes() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_mensajes (
      id              SERIAL PRIMARY KEY,
      conversacion_id INTEGER      NOT NULL REFERENCES whatsapp_conversaciones(id) ON DELETE CASCADE,
      taller_id       INTEGER      NOT NULL REFERENCES talleres(id),
      direccion       VARCHAR(10)  NOT NULL CHECK(direccion IN ('entrante','saliente')),
      contenido       TEXT         NOT NULL,
      tipo            VARCHAR(20)  NOT NULL DEFAULT 'texto',
      wamid           VARCHAR(200),
      enviado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `)
}

export async function siguienteNumeroDocumento(
  taller_id: number,
  tipo: 'presupuesto' | 'boleta'
): Promise<number> {
  const result = await pool.query<{ ultimo_numero: string }>(`
    INSERT INTO correlativo_documentos (taller_id, tipo, ultimo_numero)
    VALUES ($1, $2, 1)
    ON CONFLICT (taller_id, tipo) DO UPDATE
      SET ultimo_numero = correlativo_documentos.ultimo_numero + 1
    RETURNING ultimo_numero
  `, [taller_id, tipo])
  return parseInt(result.rows[0].ultimo_numero)
}

// ── Init ───────────────────────────────────────────────────────────────────

let initialized = false

export async function initDB(): Promise<void> {
  if (initialized) return
  await ensureTalleres()
  await ensureUsuarios()
  await ensureClientes()
  await ensureVehiculos()
  await ensureOrdenesTrabajo()
  await ensureOrdenesExtra()
  await ensureServicios()
  await ensureOrdenesTrabajoServicios()
  await ensureRepuestos()
  await ensureMovimientosStock()
  await ensureOrdenesRepuestos()
  await ensureChecklistItems()
  await ensureOrdenesChecklist()
  await ensureOrdenesChecklistCompletado()
  await ensureConfiguracionTaller()
  await ensureCitas()
  await ensureOrdenesPresupuesto()
  await ensureCorrelativoDocumentos()
  await ensurePerfilTaller()
  await ensureWhatsappConfig()
  await ensureWhatsappConversaciones()
  await ensureWhatsappMensajes()
  initialized = true
}
