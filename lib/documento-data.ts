import 'server-only'
import { query, queryOne, PerfilTaller } from './db'
import type { DatosDocumento } from './pdf'

interface OrdenDocRow {
  id: number
  taller_id: number
  descripcion: string
  incluir_iva: boolean
  forma_pago: string | null
  notas_internas: string | null
  km_ingreso: number | null
  patente: string
  marca: string
  modelo: string
  anio: number | null
  color: string | null
  cliente_nombre: string
  cliente_rut: string | null
  cliente_telefono: string | null
  cliente_email: string | null
}

interface ServicioRow { nombre: string; descripcion: string | null; precio: string | null }
interface RepuestoRow { nombre: string; cantidad: string; precio_unitario: string }

export interface DocumentoBundle {
  orden: OrdenDocRow
  datosBase: Omit<DatosDocumento, 'tipo' | 'numero' | 'fecha' | 'validez_dias'>
}

/**
 * Carga los datos necesarios para generar un documento (presupuesto o boleta)
 * de una orden de trabajo. Devuelve null si la orden no pertenece al taller.
 */
export async function cargarDatosDocumento(
  ordenId: string,
  tallerId: number,
): Promise<DocumentoBundle | null> {
  const orden = await queryOne<OrdenDocRow>(
    `SELECT ot.id, ot.taller_id, ot.descripcion,
            COALESCE(ot.incluir_iva, false) AS incluir_iva,
            ot.forma_pago, ot.notas_internas, ot.km_ingreso,
            v.patente, v.marca, v.modelo, v.anio, v.color,
            c.nombre AS cliente_nombre, c.rut AS cliente_rut,
            c.telefono AS cliente_telefono, c.email AS cliente_email
     FROM ordenes_trabajo ot
     JOIN vehiculos v ON ot.vehiculo_id = v.id
     JOIN clientes  c ON v.cliente_id   = c.id
     WHERE ot.id = $1 AND ot.taller_id = $2`,
    [ordenId, tallerId],
  )
  if (!orden) return null

  const serviciosRows = await query<ServicioRow>(
    `SELECT s.nombre, s.descripcion,
            COALESCE(ots.precio_aplicado, s.precio_base) AS precio
     FROM ordenes_trabajo_servicios ots
     JOIN servicios s ON ots.servicio_id = s.id
     WHERE ots.orden_id = $1
     ORDER BY s.nombre ASC`,
    [ordenId],
  )

  const repuestosRows = await query<RepuestoRow>(
    `SELECT r.nombre, orep.cantidad, orep.precio_aplicado AS precio_unitario
     FROM ordenes_repuestos orep
     JOIN repuestos r ON orep.repuesto_id = r.id
     WHERE orep.orden_id = $1
     ORDER BY r.nombre ASC`,
    [ordenId],
  )

  let perfil = await queryOne<PerfilTaller>(
    `SELECT * FROM perfil_taller WHERE taller_id = $1`,
    [tallerId],
  )
  if (!perfil) {
    await query(
      `INSERT INTO perfil_taller (taller_id, nombre) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [tallerId, 'Mi Taller'],
    )
    perfil = await queryOne<PerfilTaller>(`SELECT * FROM perfil_taller WHERE taller_id = $1`, [tallerId])
  }
  if (!perfil) return null

  const servicios = serviciosRows.map(s => ({
    nombre: s.nombre,
    descripcion: s.descripcion,
    precio: Number(s.precio ?? 0),
  }))

  const repuestos = repuestosRows.map(r => {
    const cantidad = Number(r.cantidad)
    const precio_unitario = Number(r.precio_unitario)
    return {
      nombre: r.nombre,
      cantidad,
      precio_unitario,
      subtotal: cantidad * precio_unitario,
    }
  })

  const subtotal =
    servicios.reduce((acc, s) => acc + s.precio, 0) +
    repuestos.reduce((acc, r) => acc + r.subtotal, 0)
  const incluir_iva = Boolean(orden.incluir_iva)
  const iva = incluir_iva ? Math.round(subtotal * 0.19) : 0
  const total = subtotal + iva

  return {
    orden,
    datosBase: {
      taller: perfil,
      cliente: {
        nombre: orden.cliente_nombre,
        rut: orden.cliente_rut,
        telefono: orden.cliente_telefono,
        email: orden.cliente_email,
      },
      vehiculo: {
        patente: orden.patente,
        marca: orden.marca,
        modelo: orden.modelo,
        anio: orden.anio ?? 0,
        color: orden.color ?? '—',
        km_ingreso: orden.km_ingreso,
      },
      servicios,
      repuestos,
      subtotal,
      iva,
      incluir_iva,
      total,
      observaciones: orden.notas_internas,
      pie_pagina: perfil.pie_pagina,
      forma_pago: orden.forma_pago,
    },
  }
}
