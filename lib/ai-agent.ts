import 'server-only'
import OpenAI from 'openai'
import { query, queryOne, withTransaction } from './db'

// ── Tool definitions ────────────────────────────────────────────────────────

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'verificar_disponibilidad',
      description: 'Verifica los horarios disponibles para agendar una cita en el taller en una fecha específica. Úsala antes de confirmar cualquier cita.',
      parameters: {
        type: 'object',
        properties: {
          fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD' },
        },
        required: ['fecha'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crear_cita',
      description: 'Crea una cita confirmada en el taller. Úsala solo cuando el cliente haya confirmado todos los datos.',
      parameters: {
        type: 'object',
        properties: {
          nombre_cliente:  { type: 'string', description: 'Nombre completo del cliente' },
          telefono:        { type: 'string', description: 'Teléfono del cliente (el número de WhatsApp)' },
          patente:         { type: 'string', description: 'Patente del vehículo (opcional)' },
          marca:           { type: 'string', description: 'Marca del vehículo' },
          modelo:          { type: 'string', description: 'Modelo del vehículo' },
          tipo_servicio:   { type: 'string', description: 'Tipo de servicio requerido' },
          fecha_hora:      { type: 'string', description: 'Fecha y hora en formato ISO 8601, ej: 2025-07-15T10:00' },
        },
        required: ['nombre_cliente', 'telefono', 'tipo_servicio', 'fecha_hora'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'transferir_a_humano',
      description: 'Transfiere la conversación a un asesor humano. Usa cuando el cliente lo pide, cuando hay un reclamo, o cuando no puedes resolver la consulta.',
      parameters: {
        type: 'object',
        properties: {
          motivo: { type: 'string', description: 'Motivo de la transferencia' },
        },
        required: [],
      },
    },
  },
]

// ── Tool handlers ───────────────────────────────────────────────────────────

async function verificarDisponibilidad(fecha: string, tallerId: number): Promise<string> {
  const config = await queryOne<{
    hora_apertura: string; hora_cierre: string; dias_atencion: number[]
    capacidad_boxes: number; duracion_slot_min: number
  }>('SELECT * FROM configuracion_taller WHERE taller_id = $1', [tallerId])

  if (!config) return 'El taller no tiene configuración de horarios. Contacta al taller directamente.'

  const d = new Date(fecha + 'T12:00:00')
  const diaSemana = d.getDay()
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

  if (!config.dias_atencion.includes(diaSemana)) {
    return `El taller no atiende los ${DIAS[diaSemana]}. Días disponibles: ${config.dias_atencion.map(n => DIAS[n]).join(', ')}.`
  }

  const citasDia = await query<{ fecha_hora: string }>(
    `SELECT fecha_hora FROM citas
     WHERE taller_id = $1 AND DATE(fecha_hora AT TIME ZONE 'America/Santiago') = $2
       AND estado NOT IN ('cancelada','no_asistio')`,
    [tallerId, fecha],
  )

  const [hIni, mIni] = config.hora_apertura.split(':').map(Number)
  const [hFin, mFin] = config.hora_cierre.split(':').map(Number)
  const inicio = hIni * 60 + mIni
  const fin    = hFin * 60 + mFin

  const conteo: Record<string, number> = {}
  for (let m = inicio; m < fin; m += config.duracion_slot_min) {
    const h   = Math.floor(m / 60).toString().padStart(2, '0')
    const min = (m % 60).toString().padStart(2, '0')
    conteo[`${h}:${min}`] = 0
  }

  for (const c of citasDia) {
    const dt = new Date(c.fecha_hora)
    const key = `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`
    if (key in conteo) conteo[key]++
  }

  const disponibles = Object.entries(conteo)
    .filter(([, cnt]) => cnt < config.capacidad_boxes)
    .map(([hora]) => hora)

  if (disponibles.length === 0)
    return `No hay horarios disponibles para el ${fecha}. ¿Te acomoda otro día?`

  return `Horarios disponibles para el ${fecha}: ${disponibles.join(', ')}.`
}

async function crearCita(args: {
  nombre_cliente: string; telefono: string; patente?: string
  marca?: string; modelo?: string; tipo_servicio: string; fecha_hora: string
}, tallerId: number): Promise<string> {
  return withTransaction(async (client) => {
    const telLimpio = args.telefono.replace(/\D/g, '')
    const { rows: clientes } = await client.query(
      `SELECT id FROM clientes WHERE taller_id = $1 AND regexp_replace(telefono,'\\D','','g') LIKE $2`,
      [tallerId, `%${telLimpio.slice(-9)}`],
    )
    let clienteId: number

    if (clientes.length > 0) {
      clienteId = clientes[0].id
      await client.query('UPDATE clientes SET nombre=$1 WHERE id=$2', [args.nombre_cliente, clienteId])
    } else {
      const { rows } = await client.query(
        'INSERT INTO clientes (taller_id, nombre, telefono) VALUES ($1,$2,$3) RETURNING id',
        [tallerId, args.nombre_cliente, args.telefono],
      )
      clienteId = rows[0].id
    }

    let vehiculoId: number
    if (args.patente) {
      const patUp = args.patente.toUpperCase().replace(/\s/g, '')
      const { rows: vehs } = await client.query(
        'SELECT id FROM vehiculos WHERE taller_id = $1 AND patente = $2',
        [tallerId, patUp],
      )
      if (vehs.length > 0) {
        vehiculoId = vehs[0].id
      } else {
        const { rows } = await client.query(
          `INSERT INTO vehiculos (taller_id, cliente_id, patente, marca, modelo)
           VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [tallerId, clienteId, patUp, args.marca ?? 'Sin especificar', args.modelo ?? 'Sin especificar'],
        )
        vehiculoId = rows[0].id
      }
    } else {
      const patHolder = `WA-${Date.now()}`
      const { rows } = await client.query(
        `INSERT INTO vehiculos (taller_id, cliente_id, patente, marca, modelo)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [tallerId, clienteId, patHolder, args.marca ?? 'Sin especificar', args.modelo ?? 'Sin especificar'],
      )
      vehiculoId = rows[0].id
    }

    const { rows: citaRows } = await client.query(
      `INSERT INTO citas (taller_id, vehiculo_id, fecha_hora, duracion_min, estado, tipo_servicio, observaciones)
       VALUES ($1,$2, ($3::timestamp AT TIME ZONE 'America/Santiago') ,60,'pendiente',$4,$5) RETURNING id`,
      [tallerId, vehiculoId, args.fecha_hora, args.tipo_servicio,
       `Agendado vía WhatsApp. Cliente: ${args.nombre_cliente}`],
    )
    const citaId = citaRows[0].id as number

    const fechaLeg = new Date(args.fecha_hora).toLocaleString('es-CL', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit',
    })

    return `✅ ¡Cita confirmada! Tu número de cita es #${citaId}.\n📅 ${fechaLeg}\n🔧 ${args.tipo_servicio}\n\n¿Necesitas algo más?`
  })
}

// ── System prompt builder ───────────────────────────────────────────────────

async function buildSystemPrompt(tallerId: number): Promise<string> {
  const [perfil, config, servicios, waConfig] = await Promise.all([
    queryOne<{ nombre: string }>('SELECT nombre FROM perfil_taller WHERE taller_id = $1', [tallerId])
      .catch(() => null),
    queryOne<{ hora_apertura: string; hora_cierre: string; dias_atencion: number[] }>(
      'SELECT hora_apertura, hora_cierre, dias_atencion FROM configuracion_taller WHERE taller_id = $1',
      [tallerId],
    ).catch(() => null),
    query<{ nombre: string; descripcion: string | null; precio_base: string | null }>(
      'SELECT nombre, descripcion, precio_base FROM servicios WHERE taller_id = $1 AND activo = true ORDER BY nombre LIMIT 30',
      [tallerId],
    ).catch(() => [] as { nombre: string; descripcion: string | null; precio_base: string | null }[]),
    queryOne<{ nombre_agente: string }>('SELECT nombre_agente FROM whatsapp_config WHERE taller_id = $1 AND activo = true', [tallerId])
      .catch(() => null),
  ])

  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const nombreTaller = perfil?.nombre ?? 'el taller'
  const nombreAgente = waConfig?.nombre_agente ?? 'Asistente'
  const horario = config
    ? `${config.hora_apertura.slice(0, 5)} a ${config.hora_cierre.slice(0, 5)}, ${config.dias_atencion.map(d => DIAS[d]).join(', ')}`
    : 'horario a confirmar'
  const listaServicios = servicios.length > 0
    ? servicios.map(s => {
        const precio = s.precio_base && Number(s.precio_base) > 0
          ? ` — $${Number(s.precio_base).toLocaleString('es-CL')}`
          : ' — precio a consultar'
        const desc = s.descripcion ? ` (${s.descripcion})` : ''
        return `• ${s.nombre}${desc}${precio}`
      }).join('\n')
    : '• Consultar disponibilidad directamente'

  const ahora = new Date().toLocaleString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return `Eres ${nombreAgente}, el asistente virtual de ${nombreTaller}. Eres amable, profesional y eficiente en español.

PRESENTACIÓN: Cuando alguien te saluda por primera vez, preséntate con tu nombre y el nombre del taller. Ejemplo: "¡Hola! Soy ${nombreAgente}, asistente de ${nombreTaller}. ¿En qué te puedo ayudar hoy?"

FECHA Y HORA ACTUAL: ${ahora}

HORARIO DE ATENCIÓN: ${horario}

SERVICIOS Y PRECIOS VIGENTES:
${listaServicios}

TU MISIÓN: Ayudar a los clientes respondiendo consultas sobre servicios y precios, y agendar citas para su vehículo.

DATOS QUE NECESITAS RECOPILAR PARA AGENDAR (en este orden):
1. Nombre del cliente
2. Tipo de servicio requerido
3. Patente, marca y modelo del vehículo
4. Fecha preferida → usa verificar_disponibilidad para confirmar disponibilidad real
5. Hora (de las disponibles) → luego usa crear_cita para confirmar

REGLAS IMPORTANTES:
- Si el cliente pregunta por precios o servicios, respóndele directamente con la información de arriba
- SIEMPRE usa verificar_disponibilidad antes de ofrecer o confirmar horarios
- NUNCA inventes horarios disponibles ni precios que no estén en la lista
- Si un servicio no tiene precio definido, indica que debe consultarse directamente
- Responde de forma concisa (máximo 3-4 líneas por mensaje)
- Si el cliente pide hablar con una persona, usa transferir_a_humano
- Si hay un reclamo o problema complejo, usa transferir_a_humano
- No hagas preguntas múltiples en un solo mensaje — una a la vez`
}

// ── Main export ─────────────────────────────────────────────────────────────

export interface MensajeHistorial {
  direccion: 'entrante' | 'saliente'
  contenido: string
}

export async function procesarMensaje({
  tallerId,
  conversacionId,
  whatsappId,
  mensaje,
  historial,
}: {
  tallerId: number
  conversacionId: number
  whatsappId: string
  mensaje: string
  historial: MensajeHistorial[]
}): Promise<{ respuesta: string; transferirHumano: boolean }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada en las variables de entorno del servidor.')
  const openai = new OpenAI({ apiKey })

  const systemPrompt = await buildSystemPrompt(tallerId)

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...historial.slice(-15).map(m => ({
      role: m.direccion === 'entrante' ? 'user' as const : 'assistant' as const,
      content: m.contenido,
    })),
    { role: 'user', content: mensaje },
  ]

  let transferirHumano = false

  for (let iter = 0; iter < 4; iter++) {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
      temperature: 0.4,
    })

    const choice = completion.choices[0]

    if (choice.finish_reason === 'stop') {
      return { respuesta: choice.message.content ?? 'Disculpa, no pude procesar tu consulta.', transferirHumano }
    }

    if (choice.finish_reason === 'tool_calls') {
      messages.push(choice.message as OpenAI.Chat.ChatCompletionMessageParam)

      for (const toolCall of choice.message.tool_calls ?? []) {
        if (toolCall.type !== 'function') continue
        const fn   = toolCall.function
        const args = JSON.parse(fn.arguments) as Record<string, string>
        let resultado: string

        try {
          if (fn.name === 'verificar_disponibilidad') {
            resultado = await verificarDisponibilidad(args.fecha, tallerId)
          } else if (fn.name === 'crear_cita') {
            resultado = await crearCita(args as Parameters<typeof crearCita>[0], tallerId)
          } else if (fn.name === 'transferir_a_humano') {
            transferirHumano = true
            await query(
              `UPDATE whatsapp_conversaciones SET modo = 'humano' WHERE id = $1`,
              [conversacionId],
            )
            resultado = 'Transferencia solicitada. Un asesor tomará el control pronto.'
          } else {
            resultado = 'Herramienta no reconocida.'
          }
        } catch (err) {
          resultado = `Error al ejecutar la acción: ${err instanceof Error ? err.message : 'Error desconocido'}`
        }

        messages.push({ role: 'tool', content: resultado, tool_call_id: toolCall.id })

        if (transferirHumano) {
          const finalComp = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            temperature: 0.4,
          })
          return {
            respuesta: finalComp.choices[0].message.content ?? 'En un momento te atiende un asesor. ¡Gracias por tu paciencia!',
            transferirHumano: true,
          }
        }
      }
    }
  }

  return { respuesta: 'Disculpa, hubo un problema procesando tu consulta. Intenta nuevamente.', transferirHumano: false }
}
