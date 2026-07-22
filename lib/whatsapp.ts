type PlantillaWA =
  | 'confirmacion'
  | 'recordatorio'
  | 'listo_para_retirar'
  | 'proxima_mantencion'

interface DatosWA {
  telefono: string
  cliente_nombre: string
  vehiculo_patente: string
  vehiculo_marca: string
  vehiculo_modelo: string
  fecha_hora?: Date
  taller_nombre?: string
}

export function generarLinkWhatsApp(plantilla: PlantillaWA, datos: DatosWA): string {
  const tel    = datos.telefono.replace(/\D/g, '')
  const numero = tel.startsWith('56') ? tel : `56${tel}`
  let mensaje  = ''

  switch (plantilla) {
    case 'confirmacion':
      mensaje =
        `Hola ${datos.cliente_nombre}, le confirmamos su cita en nuestro taller ` +
        `para el vehículo ${datos.vehiculo_patente} (${datos.vehiculo_marca} ${datos.vehiculo_modelo}) ` +
        `el ${datos.fecha_hora?.toLocaleDateString('es-CL')} a las ` +
        `${datos.fecha_hora?.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}. ` +
        `¡Le esperamos!`
      break
    case 'recordatorio':
      mensaje =
        `Hola ${datos.cliente_nombre}, le recordamos que mañana tiene una cita en nuestro taller ` +
        `para su ${datos.vehiculo_marca} ${datos.vehiculo_modelo} (${datos.vehiculo_patente}) ` +
        `a las ${datos.fecha_hora?.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}. ` +
        `Cualquier consulta, estamos a su disposición.`
      break
    case 'listo_para_retirar':
      mensaje =
        `Hola ${datos.cliente_nombre}, le informamos que su vehículo ` +
        `${datos.vehiculo_marca} ${datos.vehiculo_modelo} (${datos.vehiculo_patente}) ` +
        `ya está listo para ser retirado. ¡Gracias por confiar en nosotros!`
      break
    case 'proxima_mantencion':
      mensaje =
        `Hola ${datos.cliente_nombre}, le recordamos que su vehículo ` +
        `${datos.vehiculo_marca} ${datos.vehiculo_modelo} (${datos.vehiculo_patente}) ` +
        `tiene próximamente una mantención programada. ` +
        `Contáctenos para agendar su hora.`
      break
  }

  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
}

// ── Meta Cloud API ─────────────────────────────────────────────────────────

const META_API = 'https://graph.facebook.com/v21.0'

export async function marcarLeido({
  phoneNumberId, accessToken, messageId,
}: {
  phoneNumberId: string; accessToken: string; messageId: string
}): Promise<void> {
  const res = await fetch(`${META_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: messageId }),
  }).catch(err => { console.error('[marcarLeido] fetch error:', err); return null })
  if (!res) return
  const body = await res.text().catch(() => '')
  if (res.ok) {
    console.log('[marcarLeido] OK', res.status, body)
  } else {
    console.error('[marcarLeido] ERROR', res.status, body)
  }
}


export async function enviarMensajeAPI({
  phoneNumberId, accessToken, to, texto,
}: {
  phoneNumberId: string; accessToken: string; to: string; texto: string
}): Promise<void> {
  const res = await fetch(`${META_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: texto },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Meta API error ${res.status}: ${err}`)
  }
}

export function extraerTexto(message: Record<string, unknown>): string | null {
  const tipo = message.type as string
  if (tipo === 'text') return (message.text as { body: string } | undefined)?.body ?? null
  if (tipo === 'interactive') {
    const i = message.interactive as Record<string, unknown>
    if (i.type === 'button_reply') return (i.button_reply as { title: string } | undefined)?.title ?? null
    if (i.type === 'list_reply')   return (i.list_reply  as { title: string } | undefined)?.title ?? null
  }
  return null
}
