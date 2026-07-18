import { NextResponse } from 'next/server'
import { initDB, withTransaction } from '@/lib/db'
import { getSession } from '@/lib/api-session'
import type { PoolClient } from 'pg'

// Servicios clásicos de un taller mecánico chileno
const SERVICIOS_SEED = [
  // ── Mantención y lubricación ──
  { categoria: 'Mantención y lubricación', nombre: 'Cambio de aceite y filtro',                precio_base: 25000 },
  { categoria: 'Mantención y lubricación', nombre: 'Cambio de filtro de aire',                  precio_base: 12000 },
  { categoria: 'Mantención y lubricación', nombre: 'Cambio de filtro de combustible',            precio_base: 15000 },
  { categoria: 'Mantención y lubricación', nombre: 'Cambio de filtro de habitáculo',             precio_base: 10000 },
  { categoria: 'Mantención y lubricación', nombre: 'Mantención menor (aceite + filtros)',        precio_base: 45000 },
  { categoria: 'Mantención y lubricación', nombre: 'Mantención mayor (revisión general 30.000 km)', precio_base: 85000 },
  { categoria: 'Mantención y lubricación', nombre: 'Engrase general chasis',                     precio_base: 8000  },

  // ── Frenos ──
  { categoria: 'Frenos', nombre: 'Cambio de pastillas delanteras (par)',  precio_base: 35000 },
  { categoria: 'Frenos', nombre: 'Cambio de pastillas traseras (par)',    precio_base: 30000 },
  { categoria: 'Frenos', nombre: 'Cambio de discos delanteros (par)',     precio_base: 80000 },
  { categoria: 'Frenos', nombre: 'Cambio de discos traseros (par)',       precio_base: 75000 },
  { categoria: 'Frenos', nombre: 'Cambio de zapatas traseras (par)',      precio_base: 28000 },
  { categoria: 'Frenos', nombre: 'Purga y cambio de líquido de frenos',  precio_base: 18000 },
  { categoria: 'Frenos', nombre: 'Rectificación de discos (par)',         precio_base: 25000 },
  { categoria: 'Frenos', nombre: 'Revisión y ajuste sistema de frenos',  precio_base: 12000 },

  // ── Motor ──
  { categoria: 'Motor', nombre: 'Cambio de bujías (4 cil.)',             precio_base: 25000 },
  { categoria: 'Motor', nombre: 'Cambio de bujías (6 cil.)',             precio_base: 35000 },
  { categoria: 'Motor', nombre: 'Cambio de correa de distribución',      precio_base: 90000 },
  { categoria: 'Motor', nombre: 'Cambio de kit distribución + bomba agua', precio_base: 130000 },
  { categoria: 'Motor', nombre: 'Cambio de correa accesorios (poly-v)', precio_base: 22000 },
  { categoria: 'Motor', nombre: 'Cambio de bomba de agua',               precio_base: 55000 },
  { categoria: 'Motor', nombre: 'Cambio de termostato',                  precio_base: 30000 },
  { categoria: 'Motor', nombre: 'Limpieza de inyectores (ultrasonido)',  precio_base: 50000 },
  { categoria: 'Motor', nombre: 'Regulación de válvulas',                precio_base: 40000 },
  { categoria: 'Motor', nombre: 'Diagnóstico computarizado (scanner)',   precio_base: 20000 },
  { categoria: 'Motor', nombre: 'Limpieza de cuerpo de aceleración',    precio_base: 18000 },
  { categoria: 'Motor', nombre: 'Cambio de juntas de culata',            precio_base: 250000 },

  // ── Suspensión y dirección ──
  { categoria: 'Suspensión y dirección', nombre: 'Cambio de amortiguadores delanteros (par)', precio_base: 120000 },
  { categoria: 'Suspensión y dirección', nombre: 'Cambio de amortiguadores traseros (par)',   precio_base: 110000 },
  { categoria: 'Suspensión y dirección', nombre: 'Alineación al volante (2 ruedas)',          precio_base: 15000  },
  { categoria: 'Suspensión y dirección', nombre: 'Alineación computarizada (4 ruedas)',       precio_base: 25000  },
  { categoria: 'Suspensión y dirección', nombre: 'Balanceo de ruedas (4 ruedas)',             precio_base: 16000  },
  { categoria: 'Suspensión y dirección', nombre: 'Cambio de rótulas delanteras (par)',        precio_base: 65000  },
  { categoria: 'Suspensión y dirección', nombre: 'Cambio de bieletas de suspensión (par)',    precio_base: 35000  },
  { categoria: 'Suspensión y dirección', nombre: 'Cambio de terminales de dirección (par)',   precio_base: 45000  },
  { categoria: 'Suspensión y dirección', nombre: 'Cambio de manga de dirección',              precio_base: 80000  },
  { categoria: 'Suspensión y dirección', nombre: 'Cambio de resortes delanteros (par)',       precio_base: 95000  },
  { categoria: 'Suspensión y dirección', nombre: 'Cambio de gomas de suspensión',             precio_base: 40000  },

  // ── Transmisión y embrague ──
  { categoria: 'Transmisión y embrague', nombre: 'Cambio de kit de embrague',                 precio_base: 180000 },
  { categoria: 'Transmisión y embrague', nombre: 'Cambio de aceite caja de cambios manual',   precio_base: 22000  },
  { categoria: 'Transmisión y embrague', nombre: 'Cambio de aceite caja automática + filtro', precio_base: 65000  },
  { categoria: 'Transmisión y embrague', nombre: 'Cambio de aceite diferencial',              precio_base: 20000  },
  { categoria: 'Transmisión y embrague', nombre: 'Cambio de homocinéticas (par)',             precio_base: 140000 },
  { categoria: 'Transmisión y embrague', nombre: 'Cambio de bota homocinética',               precio_base: 30000  },

  // ── Sistema eléctrico ──
  { categoria: 'Sistema eléctrico', nombre: 'Revisión sistema eléctrico',   precio_base: 15000 },
  { categoria: 'Sistema eléctrico', nombre: 'Cambio de batería',            precio_base: 15000 },
  { categoria: 'Sistema eléctrico', nombre: 'Cambio de alternador',         precio_base: 80000 },
  { categoria: 'Sistema eléctrico', nombre: 'Cambio de motor de arranque',  precio_base: 70000 },
  { categoria: 'Sistema eléctrico', nombre: 'Instalación de alarma',        precio_base: 45000 },
  { categoria: 'Sistema eléctrico', nombre: 'Cambio de faros y luces',      precio_base: 20000 },

  // ── Refrigeración ──
  { categoria: 'Refrigeración', nombre: 'Cambio de líquido refrigerante (flush)', precio_base: 25000 },
  { categoria: 'Refrigeración', nombre: 'Cambio de mangueras de radiador',        precio_base: 35000 },
  { categoria: 'Refrigeración', nombre: 'Revisión sistema de refrigeración',      precio_base: 12000 },
  { categoria: 'Refrigeración', nombre: 'Cambio de radiador',                     precio_base: 120000 },

  // ── Neumáticos ──
  { categoria: 'Neumáticos', nombre: 'Montaje y desmontaje de neumático (c/u)',  precio_base: 4000  },
  { categoria: 'Neumáticos', nombre: 'Reparación de pinchazo',                   precio_base: 5000  },
  { categoria: 'Neumáticos', nombre: 'Rotación de neumáticos (4 ruedas)',        precio_base: 12000 },

  // ── Revisión técnica ──
  { categoria: 'Revisión técnica', nombre: 'Preparación para revisión técnica (SIVG)', precio_base: 30000 },
  { categoria: 'Revisión técnica', nombre: 'Revisión gas de escape / GSUR',            precio_base: 8000  },
  { categoria: 'Revisión técnica', nombre: 'Inspección pre-compra vehículo usado',     precio_base: 40000 },
]

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

  await initDB()

  const resumen = await withTransaction(async (client: PoolClient) => {
    // 1. Limpiar ordenes y tablas dependientes (en orden por FK)
    await client.query('DELETE FROM ordenes_checklist         WHERE orden_id IN (SELECT id FROM ordenes_trabajo WHERE taller_id=$1)', [session.tallerId])
    await client.query('DELETE FROM ordenes_repuestos         WHERE orden_id IN (SELECT id FROM ordenes_trabajo WHERE taller_id=$1)', [session.tallerId])
    await client.query('DELETE FROM ordenes_trabajo_servicios WHERE orden_id IN (SELECT id FROM ordenes_trabajo WHERE taller_id=$1)', [session.tallerId])
    const { rowCount: ordenesEliminadas } = await client.query(
      'DELETE FROM ordenes_trabajo WHERE taller_id=$1', [session.tallerId],
    )

    // 2. Limpiar servicios del taller
    await client.query('DELETE FROM ordenes_trabajo_servicios WHERE servicio_id IN (SELECT id FROM servicios WHERE taller_id=$1)', [session.tallerId])
    await client.query('DELETE FROM servicios WHERE taller_id=$1', [session.tallerId])

    // 3. Insertar servicios seed
    let insertados = 0
    for (const s of SERVICIOS_SEED) {
      await client.query(
        `INSERT INTO servicios (taller_id, nombre, descripcion, precio_base, activo)
         VALUES ($1, $2, $3, $4, true)`,
        [session.tallerId, s.nombre, s.categoria, s.precio_base],
      )
      insertados++
    }

    return { ordenesEliminadas: ordenesEliminadas ?? 0, serviciosInsertados: insertados }
  })

  return NextResponse.json({
    ok: true,
    message: `Se eliminaron ${resumen.ordenesEliminadas} orden(es) de trabajo y se cargaron ${resumen.serviciosInsertados} servicios.`,
    ...resumen,
  })
}
