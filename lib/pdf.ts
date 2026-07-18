import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import { existsSync } from 'fs'
import type { PerfilTaller } from './db'

interface ServicioPDF { nombre: string; descripcion: string | null; precio: number }
interface RepuestoPDF { nombre: string; cantidad: number; precio_unitario: number; subtotal: number }

export interface DatosDocumento {
  tipo: 'presupuesto' | 'boleta'
  numero: number
  fecha: Date
  taller: PerfilTaller
  cliente: { nombre: string; rut: string | null; telefono: string | null; email: string | null }
  vehiculo: { patente: string; marca: string; modelo: string; anio: number; color: string; km_ingreso: number | null }
  servicios: ServicioPDF[]
  repuestos: RepuestoPDF[]
  subtotal: number
  iva: number
  incluir_iva: boolean
  total: number
  observaciones: string | null
  pie_pagina: string | null
  validez_dias?: number
  forma_pago?: string | null
}

function clp(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

function numDoc(n: number): string {
  return String(n).padStart(6, '0')
}

function fechaEs(d: Date): string {
  return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
}

function getLocalChromePath(): string | undefined {
  const candidates: string[] = []
  if (process.platform === 'win32') {
    candidates.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      ...(process.env.LOCALAPPDATA
        ? [`${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`]
        : []),
    )
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
  } else {
    candidates.push('/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium')
  }
  return candidates.find(p => existsSync(p))
}

async function getBrowser() {
  const isDev = process.env.NODE_ENV === 'development'
  const executablePath = isDev ? getLocalChromePath() : await chromium.executablePath()
  if (!executablePath) {
    throw new Error(
      'No se encontró Chrome. Instala Google Chrome o configura CHROME_PATH en .env.local'
    )
  }
  return puppeteer.launch({
    args: isDev ? ['--no-sandbox', '--disable-setuid-sandbox'] : chromium.args,
    defaultViewport: { width: 1240, height: 1754 },
    executablePath,
    headless: true,
  })
}

export function generarHTMLDocumento(d: DatosDocumento): string {
  const tipoLabel = d.tipo === 'presupuesto' ? 'PRESUPUESTO' : 'BOLETA DE SERVICIO'

  const serviciosHTML = d.servicios.length === 0 ? '' : `
    <div class="items-titulo">Servicios</div>
    <table>
      <thead><tr><th>Descripción</th><th class="num">Precio</th></tr></thead>
      <tbody>
        ${d.servicios.map(s => `
          <tr>
            <td>${s.nombre}${s.descripcion ? `<div style="font-size:9pt;color:#777">${s.descripcion}</div>` : ''}</td>
            <td class="num">${clp(s.precio)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`

  const repuestosHTML = d.repuestos.length === 0 ? '' : `
    <div class="items-titulo">Repuestos y materiales</div>
    <table>
      <thead>
        <tr><th>Ítem</th><th class="num">Cant.</th><th class="num">P. unitario</th><th class="num">Subtotal</th></tr>
      </thead>
      <tbody>
        ${d.repuestos.map(r => `
          <tr>
            <td>${r.nombre}</td>
            <td class="num">${r.cantidad}</td>
            <td class="num">${clp(r.precio_unitario)}</td>
            <td class="num">${clp(r.subtotal)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`

  const ivaHTML = d.incluir_iva ? `
    <div class="total-fila"><span>IVA (19%)</span><span>${clp(d.iva)}</span></div>` : ''

  const formaPagoHTML = d.forma_pago ? `
    <div class="total-fila" style="font-size:9pt;color:#555">
      <span>Forma de pago</span><span>${d.forma_pago}</span>
    </div>` : ''

  const validezHTML = d.tipo === 'presupuesto' && d.validez_dias ? `
    <div class="doc-numero" style="color:#d97706">Válido por ${d.validez_dias} días</div>` : ''

  const observacionesHTML = d.observaciones ? `
    <div class="nota-box"><strong>Observaciones:</strong> ${d.observaciones}</div>` : ''

  const firmasHTML = d.tipo === 'boleta' ? `
    <div class="firmas">
      <div class="firma-linea">Firma cliente</div>
      <div class="firma-linea">Firma taller</div>
    </div>` : ''

  const pieHTML = d.pie_pagina ? `<div class="pie">${d.pie_pagina}</div>` : ''

  const tallerDatos = [
    d.taller.rut ? `RUT: ${d.taller.rut}` : null,
    d.taller.direccion,
    d.taller.telefono ? `Tel: ${d.taller.telefono}` : null,
    d.taller.email,
  ].filter(Boolean).join('<br>')

  const kmHTML = d.vehiculo.km_ingreso != null
    ? `<br>KM ingreso: ${d.vehiculo.km_ingreso.toLocaleString('es-CL')}` : ''

  const logoHTML = d.taller.logo_url
    ? `<img src="${d.taller.logo_url}" alt="${d.taller.nombre}" style="max-height:60px;max-width:200px;object-fit:contain;display:block;margin-bottom:6px;" />`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size:11pt; color:#1a1a1a; padding:2cm; }
.header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:2rem; padding-bottom:1rem; border-bottom:2px solid #0f766e; }
.taller-nombre { font-size:18pt; font-weight:bold; color:#0f766e; }
.taller-datos { font-size:9pt; color:#555; margin-top:4px; line-height:1.6; }
.doc-tipo { font-size:14pt; font-weight:bold; text-align:right; }
.doc-numero { font-size:10pt; color:#555; text-align:right; }
.partes { display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; margin-bottom:1.5rem; }
.parte-box { background:#f8faf9; border:1px solid #e0e7e4; border-radius:6px; padding:0.75rem 1rem; }
.parte-titulo { font-size:8pt; font-weight:bold; text-transform:uppercase; letter-spacing:0.05em; color:#0f766e; margin-bottom:6px; }
.parte-dato { font-size:10pt; line-height:1.7; }
.items-titulo { font-size:9pt; font-weight:bold; text-transform:uppercase; letter-spacing:0.05em; color:#555; margin-bottom:6px; margin-top:1rem; }
table { width:100%; border-collapse:collapse; margin-bottom:0.5rem; }
thead th { background:#0f766e; color:white; padding:8px 10px; font-size:9pt; text-align:left; }
thead th.num { text-align:right; }
tbody tr:nth-child(even) { background:#f8faf9; }
tbody td { padding:7px 10px; font-size:10pt; border-bottom:1px solid #e8edeb; }
tbody td.num { text-align:right; font-variant-numeric:tabular-nums; }
.totales { display:flex; justify-content:flex-end; margin-top:1rem; margin-bottom:1.5rem; }
.totales-box { min-width:240px; }
.total-fila { display:flex; justify-content:space-between; padding:4px 0; font-size:10pt; border-bottom:1px solid #e8edeb; }
.total-fila.final { font-size:13pt; font-weight:bold; color:#0f766e; border-bottom:none; padding-top:8px; margin-top:4px; }
.nota-box { background:#fffbeb; border:1px solid #fcd34d; border-radius:6px; padding:0.75rem 1rem; margin-bottom:1.5rem; font-size:10pt; }
.pie { margin-top:2rem; padding-top:1rem; border-top:1px solid #e0e7e4; font-size:8.5pt; color:#777; text-align:center; }
.firmas { display:grid; grid-template-columns:1fr 1fr; gap:3rem; margin-top:2.5rem; }
.firma-linea { border-top:1px solid #333; padding-top:6px; font-size:9pt; text-align:center; color:#555; }
</style>
</head>
<body>
<div class="header">
  <div>
    ${logoHTML}
    <div class="taller-nombre">${d.taller.nombre}</div>
    <div class="taller-datos">${tallerDatos}</div>
  </div>
  <div>
    <div class="doc-tipo">${tipoLabel}</div>
    <div class="doc-numero">N° ${numDoc(d.numero)}</div>
    <div class="doc-numero">Fecha: ${fechaEs(d.fecha)}</div>
    ${validezHTML}
  </div>
</div>
<div class="partes">
  <div class="parte-box">
    <div class="parte-titulo">Cliente</div>
    <div class="parte-dato">
      <strong>${d.cliente.nombre}</strong><br>
      ${d.cliente.rut ? `RUT: ${d.cliente.rut}<br>` : ''}
      ${d.cliente.telefono ? `Tel: ${d.cliente.telefono}<br>` : ''}
      ${d.cliente.email ?? ''}
    </div>
  </div>
  <div class="parte-box">
    <div class="parte-titulo">Vehículo</div>
    <div class="parte-dato">
      <strong>${d.vehiculo.patente}</strong><br>
      ${d.vehiculo.marca} ${d.vehiculo.modelo} ${d.vehiculo.anio}<br>
      Color: ${d.vehiculo.color}${kmHTML}
    </div>
  </div>
</div>
${serviciosHTML}
${repuestosHTML}
<div class="totales">
  <div class="totales-box">
    <div class="total-fila"><span>Subtotal</span><span>${clp(d.subtotal)}</span></div>
    ${ivaHTML}
    <div class="total-fila final"><span>TOTAL</span><span>${clp(d.total)}</span></div>
    ${formaPagoHTML}
  </div>
</div>
${observacionesHTML}
${firmasHTML}
${pieHTML}
</body>
</html>`
}

export async function generarPDF(html: string): Promise<Buffer> {
  const browser = await getBrowser()
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    return Buffer.from(buffer)
  } finally {
    await browser.close()
  }
}
