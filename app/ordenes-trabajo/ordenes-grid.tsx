'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Trash2, ClipboardList, ClipboardCheck, Save, X, PlusCircle, Filter, Search, FileText, Receipt, Check, Ban } from 'lucide-react'
import type { OrdenTrabajoCompleta, VehiculoConCliente, EstadoOrden, Servicio, OrdenServicioConNombre, Repuesto } from '@/lib/db'

// ── ComboSelect: input con búsqueda y dropdown ───────────────────────────────
interface ComboOption { value: string; label: string; sub?: string }
interface ComboSelectProps {
  value: string
  onChange: (val: string) => void
  options: ComboOption[]
  placeholder?: string
  required?: boolean
}
function ComboSelect({ value, onChange, options, placeholder = 'Buscar…', required }: ComboSelectProps) {
  const selectedLabel = options.find(o => o.value === value)?.label ?? ''
  const [query, setQuery]   = useState('')
  const [open,  setOpen]    = useState(false)
  const wrapRef             = useRef<HTMLDivElement>(null)

  // sync label when value changes from outside (e.g. openEdit)
  const [display, setDisplay] = useState(selectedLabel)
  useEffect(() => { setDisplay(options.find(o => o.value === value)?.label ?? '') }, [value, options])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
        setDisplay(options.find(o => o.value === value)?.label ?? '')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [value, options])

  const filtered = query.trim()
    ? options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        (o.sub?.toLowerCase().includes(query.toLowerCase()))
      )
    : options

  function select(opt: ComboOption) {
    onChange(opt.value)
    setDisplay(opt.label)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="combo-wrap" ref={wrapRef}>
      <input
        value={open ? query : display}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setQuery(''); setOpen(true) }}
        style={{ paddingRight: 28 }}
      />
      <Search size={12} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
      {open && (
        <div className="combo-dropdown">
          {filtered.length === 0
            ? <div className="combo-empty">Sin resultados</div>
            : filtered.map(opt => (
                <button key={opt.value} type="button" className="combo-option" onMouseDown={() => select(opt)}>
                  <span>{opt.label}</span>
                  {opt.sub && <span className="combo-option-sub">{opt.sub}</span>}
                </button>
              ))
          }
        </div>
      )}
    </div>
  )
}

interface OrdenRepuestoFila {
  id: number; repuesto_id: number; nombre: string; codigo: string | null
  unidad: string; cantidad: number; precio_aplicado: number
}

type FormData = {
  vehiculo_id: string; descripcion: string; estado: EstadoOrden
  km_ingreso: string; km_salida: string; km_proxima: string
  fecha_proxima: string; mecanico_id: string
  notas_internas: string; costo_total: string
  incluir_iva: boolean; forma_pago: string; monto_pagado: string
}
const EMPTY: FormData = {
  vehiculo_id: '', descripcion: '', estado: 'pendiente',
  km_ingreso: '', km_salida: '', km_proxima: '', fecha_proxima: '',
  mecanico_id: '', notas_internas: '', costo_total: '',
  incluir_iva: false, forma_pago: '', monto_pagado: '',
}

const ESTADO_LABELS: Record<EstadoOrden, string> = {
  presupuestada: 'Presupuestada', pendiente: 'Pendiente', en_progreso: 'En progreso',
  completada: 'Completada', entregada: 'Entregada', rechazada: 'Rechazada',
}

// Estados que el usuario puede seleccionar manualmente en el formulario.
// 'presupuestada' y 'rechazada' se gestionan mediante los botones de aprobación/rechazo.
const ESTADOS_FORM: EstadoOrden[] = ['pendiente', 'en_progreso', 'completada', 'entregada']

const FORMAS_PAGO = ['Efectivo', 'Transferencia', 'Tarjeta débito', 'Tarjeta crédito', 'Cheque']

function toForm(o: OrdenTrabajoCompleta): FormData {
  return {
    vehiculo_id:    String(o.vehiculo_id),
    descripcion:    o.descripcion,
    estado:         o.estado,
    km_ingreso:     o.km_ingreso   ? String(o.km_ingreso)  : '',
    km_salida:      o.km_salida    ? String(o.km_salida)   : '',
    km_proxima:     o.km_proxima   ? String(o.km_proxima)  : '',
    fecha_proxima:  o.fecha_proxima ? String(o.fecha_proxima).slice(0, 10) : '',
    mecanico_id:    o.mecanico_id  ? String(o.mecanico_id) : '',
    notas_internas: o.notas_internas ?? '',
    costo_total:    o.costo_total  ? String(o.costo_total) : '',
    incluir_iva:    Boolean(o.incluir_iva),
    forma_pago:     o.forma_pago ?? '',
    monto_pagado:   o.monto_pagado != null ? String(o.monto_pagado) : '',
  }
}

const CLP = (n: number | string | null) => {
  const num = Number(n ?? 0)
  return isNaN(num) ? '—' : num.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })
}

function calcTotal(svcs: OrdenServicioConNombre[], reps: OrdenRepuestoFila[]) {
  const sTotal = svcs.reduce((s, x) => s + Number(x.precio_aplicado ?? x.precio_base ?? 0), 0)
  const rTotal = reps.reduce((s, x) => s + x.precio_aplicado * x.cantidad, 0)
  return sTotal + rTotal
}

export default function OrdenesGrid() {
  const searchParams   = useSearchParams()
  const initVehiculoId = searchParams.get('vehiculo_id') ?? ''

  const [ordenes,        setOrdenes]        = useState<OrdenTrabajoCompleta[]>([])
  const [vehiculos,      setVehiculos]      = useState<VehiculoConCliente[]>([])
  const [catalogoSvc,    setCatalogoSvc]    = useState<Servicio[]>([])
  const [mecanicos,      setMecanicos]      = useState<{ id: number; nombre: string }[]>([])
  const [catalogoRep,    setCatalogoRep]    = useState<Repuesto[]>([])
  const [ordenServicios, setOrdenServicios] = useState<OrdenServicioConNombre[]>([])
  const [ordenRepuestos, setOrdenRepuestos] = useState<OrdenRepuestoFila[]>([])
  const [selected,       setSelected]       = useState<OrdenTrabajoCompleta | null>(null)
  const [isNew,          setIsNew]          = useState(true)
  const [form,           setForm]           = useState<FormData>(EMPTY)
  const [crearPresupuesto, setCrearPresupuesto] = useState(false)
  const [accionMsg,      setAccionMsg]      = useState('')
  const [selectedSvcIds, setSelectedSvcIds] = useState<Set<number>>(new Set())
  const [svcQuery,       setSvcQuery]       = useState('')

  // Repuesto add form
  const [addRepId,    setAddRepId]    = useState('')
  const [addRepCant,  setAddRepCant]  = useState('1')
  const [addRepPrecio,setAddRepPrecio]= useState('')
  const [repWarn,     setRepWarn]     = useState('')

  // Filters
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroDesde,  setFiltroDesde]  = useState('')
  const [filtroHasta,  setFiltroHasta]  = useState('')

  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  async function load(estado = filtroEstado, desde = filtroDesde, hasta = filtroHasta) {
    setLoading(true)
    const p = new URLSearchParams()
    if (estado) p.set('estado', estado)
    if (desde)  p.set('desde',  desde)
    if (hasta)  p.set('hasta',  hasta)
    const [oRes, vRes, sRes, mRes, rRes] = await Promise.all([
      fetch(`/api/ordenes-trabajo?${p}`),
      fetch('/api/vehiculos'),
      fetch('/api/servicios'),
      fetch('/api/usuarios/mecanicos'),
      fetch('/api/repuestos?activo=true'),
    ])
    const [oData, vData, sData, mData, rData] = await Promise.all([
      oRes.json(), vRes.json(), sRes.json(), mRes.json(), rRes.json(),
    ])
    setOrdenes(oData.ordenes ?? [])
    setVehiculos(vData.vehiculos ?? [])
    setCatalogoSvc(sData.servicios ?? [])
    setMecanicos(mData.mecanicos ?? [])
    setCatalogoRep(rData.repuestos ?? [])
    setLoading(false)
  }

  const loadOrdenSvc = useCallback(async (ordenId: number) => {
    const res  = await fetch(`/api/ordenes-trabajo/${ordenId}/servicios`)
    const data = await res.json()
    setOrdenServicios(data.servicios ?? [])
  }, [])

  const loadOrdenRep = useCallback(async (ordenId: number) => {
    const res  = await fetch(`/api/ordenes-trabajo/${ordenId}/repuestos`)
    const data = await res.json()
    setOrdenRepuestos(data.repuestos ?? [])
  }, [])

  // Auto-calcular costo_total cuando cambian los servicios o repuestos
  useEffect(() => {
    const total = calcTotal(ordenServicios, ordenRepuestos)
    setForm(f => ({ ...f, costo_total: String(total) }))
  }, [ordenServicios, ordenRepuestos])

  useEffect(() => {
    load()
    if (initVehiculoId) {
      setIsNew(true)
      setForm(f => ({ ...f, vehiculo_id: initVehiculoId }))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function applyFilters() { load(filtroEstado, filtroDesde, filtroHasta) }
  function clearFilters()  { setFiltroEstado(''); setFiltroDesde(''); setFiltroHasta(''); load('','','') }

  function resetRepForm() { setAddRepId(''); setAddRepCant('1'); setAddRepPrecio(''); setRepWarn('') }

  function openNew() {
    setSelected(null); setIsNew(true); setForm(EMPTY)
    setOrdenServicios([]); setOrdenRepuestos([])
    setSelectedSvcIds(new Set()); resetRepForm(); setError('')
    setCrearPresupuesto(false); setAccionMsg('')
  }

  function openEdit(o: OrdenTrabajoCompleta) {
    setSelected(o); setIsNew(false); setForm(toForm(o))
    setOrdenServicios([]); setOrdenRepuestos([])
    setSelectedSvcIds(new Set()); resetRepForm(); setError('')
    setCrearPresupuesto(false); setAccionMsg('')
    loadOrdenSvc(o.id)
    loadOrdenRep(o.id)
  }

  // When the repuesto selector changes, auto-fill price from catalog
  function onRepSelect(repId: string) {
    setAddRepId(repId)
    setRepWarn('')
    if (!repId) { setAddRepPrecio(''); return }
    const rep = catalogoRep.find(r => String(r.id) === repId)
    if (rep) setAddRepPrecio(String(parseFloat(String(rep.precio_venta))))
  }

  async function handleAddRepuesto() {
    if (!addRepId) return
    const rep   = catalogoRep.find(r => String(r.id) === addRepId)
    if (!rep) return
    const cant  = parseFloat(addRepCant || '1')
    const precio = parseFloat(addRepPrecio || String(rep.precio_venta))
    if (isNaN(cant) || cant <= 0) { setRepWarn('Cantidad inválida'); return }

    // Check stock
    const stockDisp = parseFloat(String(rep.stock_actual)) - ordenRepuestos.filter(r => r.repuesto_id === rep.id).reduce((s, r) => s + r.cantidad, 0)
    if (cant > stockDisp) { setRepWarn(`Stock insuficiente. Disponible: ${stockDisp} ${rep.unidad}`); return }

    if (isNew) {
      setOrdenRepuestos(prev => {
        const existing = prev.find(r => r.repuesto_id === rep.id)
        if (existing) return prev.map(r => r.repuesto_id === rep.id ? { ...r, cantidad: r.cantidad + cant } : r)
        return [...prev, { id: 0, repuesto_id: rep.id, nombre: rep.nombre, codigo: rep.codigo, unidad: rep.unidad, cantidad: cant, precio_aplicado: precio }]
      })
      resetRepForm()
    } else {
      setRepWarn('')
      const res  = await fetch(`/api/ordenes-trabajo/${selected!.id}/repuestos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repuesto_id: rep.id, cantidad: cant, precio_aplicado: precio }),
      })
      const data = await res.json()
      if (!res.ok) { setRepWarn(data.error ?? 'Error al agregar repuesto'); return }
      await loadOrdenRep(selected!.id)
      resetRepForm()
    }
  }

  async function handleRemoveRep(repuestoId: number) {
    if (isNew) {
      setOrdenRepuestos(prev => prev.filter(r => r.repuesto_id !== repuestoId))
    } else {
      await fetch(`/api/ordenes-trabajo/${selected!.id}/repuestos/${repuestoId}`, { method: 'DELETE' })
      await loadOrdenRep(selected!.id)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const subtotal = Number(form.costo_total) || 0
    const iva = form.incluir_iva ? Math.round(subtotal * 0.19) : 0
    const payload = {
      vehiculo_id:    Number(form.vehiculo_id),
      descripcion:    form.descripcion,
      estado:         isNew ? (crearPresupuesto ? 'presupuestada' : 'pendiente') : form.estado,
      km_ingreso:     form.km_ingreso    ? Number(form.km_ingreso)    : null,
      km_salida:      form.km_salida     ? Number(form.km_salida)     : null,
      km_proxima:     form.km_proxima    ? Number(form.km_proxima)    : null,
      fecha_proxima:  form.fecha_proxima || null,
      mecanico_id:    form.mecanico_id   ? Number(form.mecanico_id)   : null,
      notas_internas: form.notas_internas || null,
      costo_total:    form.costo_total   ? Number(form.costo_total)   : null,
      incluir_iva:    form.incluir_iva,
      forma_pago:     form.forma_pago || null,
      monto_pagado:   form.monto_pagado ? Number(form.monto_pagado)   : null,
      subtotal,
      iva,
      total_con_iva:  subtotal + iva,
    }
    const url    = isNew ? '/api/ordenes-trabajo' : `/api/ordenes-trabajo/${selected!.id}`
    const method = isNew ? 'POST' : 'PUT'
    const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Error al guardar'); setSaving(false); return }

    if (isNew && data.orden?.id) {
      // Persistir servicios pendientes
      if (ordenServicios.length > 0) {
        await Promise.all(
          ordenServicios.map(s =>
            fetch(`/api/ordenes-trabajo/${data.orden.id}/servicios`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ servicio_id: s.servicio_id, precio_aplicado: s.precio_aplicado }),
            })
          )
        )
      }
      // Persistir repuestos pendientes
      if (ordenRepuestos.length > 0) {
        const errors: string[] = []
        for (const r of ordenRepuestos) {
          const rRes = await fetch(`/api/ordenes-trabajo/${data.orden.id}/repuestos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repuesto_id: r.repuesto_id, cantidad: r.cantidad, precio_aplicado: r.precio_aplicado }),
          })
          if (!rRes.ok) {
            const rData = await rRes.json()
            errors.push(`${r.nombre}: ${rData.error ?? 'error'}`)
          }
        }
        if (errors.length > 0) {
          setError(`Orden creada pero algunos repuestos fallaron: ${errors.join(', ')}`)
          setSaving(false)
          await load()
          return
        }
      }
    }

    await load()
    openNew()
    setSaving(false)
  }

  function toggleSvc(id: number) {
    setSelectedSvcIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleAddServicios() {
    if (selectedSvcIds.size === 0) return
    const toAdd = catalogoSvc.filter(s => selectedSvcIds.has(s.id))

    if (isNew) {
      const entries: OrdenServicioConNombre[] = toAdd.map(svc => ({
        id: 0, orden_id: 0,
        servicio_id:     svc.id,
        nombre:          svc.nombre,
        precio_base:     svc.precio_base,
        precio_aplicado: svc.precio_base,
      }))
      setOrdenServicios(prev => [...prev, ...entries])
      setSelectedSvcIds(new Set())
    } else {
      await Promise.all(
        toAdd.map(svc =>
          fetch(`/api/ordenes-trabajo/${selected!.id}/servicios`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ servicio_id: svc.id, precio_aplicado: svc.precio_base }),
          })
        )
      )
      const updated = await fetch(`/api/ordenes-trabajo/${selected!.id}/servicios`).then(r => r.json())
      setOrdenServicios(updated.servicios ?? [])
      setSelectedSvcIds(new Set())
    }
  }

  async function handleRemoveSvc(servicioId: number) {
    if (isNew) {
      setOrdenServicios(prev => prev.filter(s => s.servicio_id !== servicioId))
    } else {
      await fetch(`/api/ordenes-trabajo/${selected!.id}/servicios/${servicioId}`, { method: 'DELETE' })
      const updated = await fetch(`/api/ordenes-trabajo/${selected!.id}/servicios`).then(r => r.json())
      setOrdenServicios(updated.servicios ?? [])
    }
  }

  async function handleDelete(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('¿Eliminar esta orden de trabajo?')) return
    await fetch(`/api/ordenes-trabajo/${id}`, { method: 'DELETE' })
    if (selected?.id === id) openNew()
    load()
  }

  async function handleAprobar() {
    if (!selected) return
    setAccionMsg('')
    const res  = await fetch(`/api/ordenes-trabajo/${selected.id}/aprobar`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Error al aprobar'); return }
    await load()
    if (data.orden) openEdit({ ...selected, ...data.orden })
    setAccionMsg('Presupuesto aprobado. La orden pasó a Pendiente.')
  }

  async function handleRechazar() {
    if (!selected) return
    const razon = prompt('Razón del rechazo (opcional):') ?? ''
    setAccionMsg('')
    const res  = await fetch(`/api/ordenes-trabajo/${selected.id}/rechazar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ razon }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Error al rechazar'); return }
    await load()
    if (data.orden) openEdit({ ...selected, ...data.orden })
    setAccionMsg('Presupuesto rechazado.')
  }

  async function handleReactivar() {
    if (!selected) return
    setAccionMsg('')
    const res  = await fetch(`/api/ordenes-trabajo/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehiculo_id: selected.vehiculo_id,
        descripcion: selected.descripcion,
        estado: 'presupuestada',
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Error al reactivar'); return }
    await load()
    if (data.orden) openEdit({ ...selected, ...data.orden })
    setAccionMsg('Orden reactivada como presupuesto.')
  }

  const field         = (key: keyof FormData, val: string) => setForm(f => ({ ...f, [key]: val }))
  const svcDisponibles = catalogoSvc.filter(s => s.activo && !ordenServicios.some(os => os.servicio_id === s.id))
  const repDisponibles = catalogoRep.filter(r => !ordenRepuestos.some(or => or.repuesto_id === r.id))

  const selectedRep = catalogoRep.find(r => String(r.id) === addRepId)

  return (
    <div className="workspace">
      {/* ── Grid panel ── */}
      <div className="gridPanel">
        <div className="toolbar">
          <span style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>Órdenes de trabajo</span>
          <button className="button teal" onClick={openNew}><Plus size={14} /> Nueva orden</button>
        </div>

        <div className="filterBar">
          <Filter size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {(Object.keys(ESTADO_LABELS) as EstadoOrden[]).map(k => (
              <option key={k} value={k}>{ESTADO_LABELS[k]}</option>
            ))}
          </select>
          <input type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} title="Desde" />
          <input type="date" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)} title="Hasta" />
          <button className="button teal" onClick={applyFilters}>Filtrar</button>
          <button className="button" onClick={clearFilters}>Limpiar</button>
        </div>

        {loading ? (
          <div className="emptyState"><p>Cargando...</p></div>
        ) : ordenes.length === 0 ? (
          <div className="emptyState">
            <ClipboardList size={36} style={{ margin: '0 auto 14px', opacity: 0.25 }} />
            <p>Sin órdenes de trabajo</p>
            <p>Crea la primera con el botón de arriba.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="entityTable">
              <thead>
                <tr>
                  <th>#</th><th>Vehículo</th><th>Cliente</th>
                  <th>Descripción</th><th>Estado</th><th>Mecánico</th><th>Costo</th><th>Checklist</th><th></th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map(o => (
                  <tr key={o.id} className={selected?.id === o.id ? 'selected' : ''} style={{ whiteSpace: 'nowrap' }} onClick={() => openEdit(o)}>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>#{o.id}</td>
                    <td>
                      <strong style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{o.patente}</strong>
                      <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 6 }}>{o.marca} {o.modelo}</span>
                    </td>
                    <td style={{ color: 'var(--muted)' }}>{o.cliente_nombre}</td>
                    <td style={{ maxWidth: 180 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.descripcion}
                      </span>
                    </td>
                    <td><span className={`estadoBadge ${o.estado}`}>{ESTADO_LABELS[o.estado]}</span></td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{o.mecanico_nombre ?? '—'}</td>
                    <td style={{ fontWeight: 600 }}>{CLP(o.costo_total)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <a
                        href={`/ordenes-trabajo/${o.id}/checklist`}
                        title="Ver / registrar checklist de recepción"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, textDecoration: 'none',
                          ...(o.checklist_completado
                            ? { background: '#d1fae5', color: '#065f46' }
                            : { background: 'var(--panel-strong)', color: 'var(--muted)', border: '1px solid var(--line)' }) }}>
                        <ClipboardCheck size={12} />
                        {o.checklist_completado ? '✓' : 'Iniciar'}
                      </a>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="button softDanger" style={{ padding: '4px 10px' }} onClick={e => handleDelete(o.id, e)}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail / form panel ── */}
      <div className="detailPanel" style={{ maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>
        <div className="detailPanelHead">
          <h2>{isNew ? 'Nueva orden' : `Orden #${selected?.id}`}</h2>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {!isNew && selected && (
              <a
                href={`/ordenes-trabajo/${selected.id}/checklist`}
                title="Checklist de recepción"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, textDecoration: 'none',
                  ...(selected.checklist_completado
                    ? { background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0' }
                    : { background: '#e6f4f3', color: 'var(--brand-dark)', border: '1px solid #c4dedd' }) }}>
                <ClipboardCheck size={13} />
                {selected.checklist_completado ? '✓ Checklist' : 'Checklist'}
              </a>
            )}
            <button className="iconButton" onClick={openNew}><X size={15} /></button>
          </div>
        </div>

        {error && <div className="warningBox" style={{ marginBottom: 14 }}>{error}</div>}
        {accionMsg && <div className="notice" style={{ marginBottom: 14 }}>{accionMsg}</div>}

        {/* ── Banner: presupuesto pendiente de aprobación ── */}
        {!isNew && selected && selected.estado === 'presupuestada' && (
          <div className="banner-presupuesto">
            <div>
              <div className="banner-presupuesto-titulo">Presupuesto pendiente de aprobación</div>
              <div className="banner-presupuesto-sub">
                El cliente debe aprobar antes de iniciar el trabajo
                {selected.numero_documento != null && (
                  <span className="numero-doc"> · N° {String(selected.numero_documento).padStart(6, '0')}</span>
                )}
              </div>
            </div>
            <div className="banner-presupuesto-acciones">
              <a className="btn-pdf" href={`/api/ordenes-trabajo/${selected.id}/presupuesto-pdf`} target="_blank" rel="noopener noreferrer">
                <FileText size={14} /> Ver PDF
              </a>
              <button type="button" className="button teal" onClick={handleAprobar}>
                <Check size={14} /> Aprobar
              </button>
              <button type="button" className="button softDanger" onClick={handleRechazar}>
                <Ban size={14} /> Rechazar
              </button>
            </div>
          </div>
        )}

        {/* ── Banner: presupuesto rechazado ── */}
        {!isNew && selected && selected.estado === 'rechazada' && (
          <div className="banner-rechazada">
            <div className="banner-rechazada-titulo">Presupuesto rechazado</div>
            {selected.razon_rechazo && (
              <div style={{ fontSize: '.8rem', color: '#b91c1c', marginTop: 4 }}>
                Razón: {selected.razon_rechazo}
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <button type="button" className="button" onClick={handleReactivar}>
                Reactivar como presupuesto
              </button>
            </div>
          </div>
        )}

        {/* ── Botones de documentos PDF ── */}
        {!isNew && selected && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <a className="btn-pdf" href={`/api/ordenes-trabajo/${selected.id}/presupuesto-pdf`} target="_blank" rel="noopener noreferrer">
              <FileText size={14} /> Presupuesto PDF
            </a>
            {(selected.estado === 'completada' || selected.estado === 'entregada') && (
              <a className="btn-pdf boleta" href={`/api/ordenes-trabajo/${selected.id}/boleta-pdf`} target="_blank" rel="noopener noreferrer">
                <Receipt size={14} /> Boleta PDF
              </a>
            )}
          </div>
        )}

        <form className="entityForm" onSubmit={handleSave}>
          <label>
            <span>Vehículo *</span>
            <ComboSelect
              value={form.vehiculo_id}
              onChange={val => field('vehiculo_id', val)}
              placeholder="Patente, marca o cliente…"
              required
              options={vehiculos.map(v => ({
                value: String(v.id),
                label: `${v.patente} — ${v.marca} ${v.modelo}`,
                sub:   v.cliente_nombre,
              }))}
            />
          </label>
          <label>
            <span>Descripción *</span>
            <textarea rows={2} value={form.descripcion} onChange={e => field('descripcion', e.target.value)} placeholder="Trabajo a realizar…" required style={{ resize: 'vertical' }} />
          </label>
          {isNew ? (
            <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={crearPresupuesto} onChange={e => setCrearPresupuesto(e.target.checked)} style={{ width: 'auto', cursor: 'pointer' }} />
              <span style={{ margin: 0 }}>Crear como presupuesto (requiere aprobación del cliente)</span>
            </label>
          ) : (
            <label>
              <span>Estado</span>
              <select value={form.estado} onChange={e => field('estado', e.target.value as EstadoOrden)}>
                {/* Mantener el estado actual visible aunque no sea editable manualmente */}
                {!ESTADOS_FORM.includes(form.estado) && (
                  <option value={form.estado}>{ESTADO_LABELS[form.estado]}</option>
                )}
                {ESTADOS_FORM.map(k => (
                  <option key={k} value={k}>{ESTADO_LABELS[k]}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span>Mecánico asignado</span>
            <ComboSelect
              value={form.mecanico_id}
              onChange={val => field('mecanico_id', val)}
              placeholder="Sin asignar…"
              options={[
                { value: '', label: 'Sin asignar' },
                ...mecanicos.map(m => ({ value: String(m.id), label: m.nombre })),
              ]}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label>
              <span>KM ingreso</span>
              <input type="number" min="0" value={form.km_ingreso} onChange={e => field('km_ingreso', e.target.value)} placeholder="125000" />
            </label>
            <label>
              <span>KM salida</span>
              <input type="number" min="0" value={form.km_salida} onChange={e => field('km_salida', e.target.value)} placeholder="125050" />
            </label>
            <label>
              <span>Próx. mantención (KM)</span>
              <input type="number" min="0" value={form.km_proxima} onChange={e => field('km_proxima', e.target.value)} placeholder="135000" />
            </label>
            <label>
              <span>Próx. mantención (fecha)</span>
              <input type="date" value={form.fecha_proxima} onChange={e => field('fecha_proxima', e.target.value)} />
            </label>
          </div>

          {/* ── Servicios asignados ── */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, display: 'grid', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: 0.5 }}>
              Servicios asignados
              {isNew && ordenServicios.length > 0 && (
                <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--brand-dark)', background: '#e6f4f3', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                  se guardarán al crear
                </span>
              )}
            </span>
            {svcDisponibles.length > 0 && (
              <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
                {/* Buscador */}
                <div style={{ padding: '7px 10px', borderBottom: '1px solid var(--line)', background: 'var(--panel-strong)', position: 'relative' }}>
                  <Search size={12} style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
                  <input
                    value={svcQuery}
                    onChange={e => setSvcQuery(e.target.value)}
                    placeholder="Filtrar servicios…"
                    style={{ paddingLeft: 26, paddingTop: 5, paddingBottom: 5, fontSize: 12 }}
                  />
                </div>
                <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                  {svcDisponibles
                    .filter(s => !svcQuery || s.nombre.toLowerCase().includes(svcQuery.toLowerCase()))
                    .map(s => (
                      <label key={s.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 10px', cursor: 'pointer',
                        background: selectedSvcIds.has(s.id) ? '#e6f4f3' : 'transparent',
                        borderBottom: '1px solid var(--line)',
                      }}>
                        <input type="checkbox" checked={selectedSvcIds.has(s.id)} onChange={() => toggleSvc(s.id)} style={{ width: 'auto', cursor: 'pointer' }} />
                        <span style={{ flex: 1, fontSize: 13 }}>{s.nombre}</span>
                        {s.precio_base && <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{CLP(s.precio_base)}</span>}
                      </label>
                    ))
                  }
                </div>
                <div style={{ padding: '8px 10px', borderTop: '1px solid var(--line)', background: 'var(--panel-strong)' }}>
                  <button type="button" className="button teal" style={{ width: '100%', justifyContent: 'center' }}
                    disabled={selectedSvcIds.size === 0} onClick={handleAddServicios}>
                    <PlusCircle size={13} />
                    {selectedSvcIds.size > 0 ? `Agregar ${selectedSvcIds.size} servicio${selectedSvcIds.size > 1 ? 's' : ''}` : 'Selecciona servicios'}
                  </button>
                </div>
              </div>
            )}
            {ordenServicios.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>Sin servicios asignados.</p>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {ordenServicios.map(s => (
                  <div key={s.servicio_id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--panel-strong)', border: '1px solid var(--line)', borderRadius: 6, padding: '7px 10px' }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{s.nombre}</span>
                    <span style={{ fontSize: 12, color: 'var(--brand-dark)', fontWeight: 700 }}>{CLP(s.precio_aplicado ?? s.precio_base)}</span>
                    <button type="button" className="iconButton" style={{ width: 28, height: 28 }} onClick={() => handleRemoveSvc(s.servicio_id)}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Repuestos asignados ── */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, display: 'grid', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: 0.5 }}>
              Repuestos / materiales
              {isNew && ordenRepuestos.length > 0 && (
                <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--brand-dark)', background: '#e6f4f3', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                  se guardarán al crear
                </span>
              )}
            </span>

            {/* Agregar repuesto */}
            {catalogoRep.length > 0 && (
              <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '10px', background: 'var(--panel-strong)', display: 'grid', gap: 8 }}>
                <ComboSelect
                  value={addRepId}
                  onChange={onRepSelect}
                  placeholder="Buscar repuesto por nombre o código…"
                  options={repDisponibles.map(r => ({
                    value: String(r.id),
                    label: `${r.nombre}${r.codigo ? ` [${r.codigo}]` : ''}`,
                    sub:   `Stock: ${parseFloat(String(r.stock_actual))} ${r.unidad}`,
                  }))}
                />
                {selectedRep && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <label style={{ display: 'grid', gap: 3 }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>Cantidad ({selectedRep.unidad})</span>
                      <input type="number" min="0.01" step="0.01" value={addRepCant} onChange={e => setAddRepCant(e.target.value)} />
                    </label>
                    <label style={{ display: 'grid', gap: 3 }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>Precio unit. ($)</span>
                      <input type="number" min="0" step="1" value={addRepPrecio} onChange={e => setAddRepPrecio(e.target.value)} />
                    </label>
                  </div>
                )}
                {repWarn && <p style={{ fontSize: 12, color: 'var(--danger)', margin: 0 }}>{repWarn}</p>}
                <button type="button" className="button teal" style={{ justifyContent: 'center' }}
                  disabled={!addRepId} onClick={handleAddRepuesto}>
                  <PlusCircle size={13} /> Agregar repuesto
                </button>
              </div>
            )}

            {ordenRepuestos.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>Sin repuestos asignados.</p>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {ordenRepuestos.map(r => (
                  <div key={r.repuesto_id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--panel-strong)', border: '1px solid var(--line)', borderRadius: 6, padding: '7px 10px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{r.nombre}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.cantidad} {r.unidad} × {CLP(r.precio_aplicado)}</div>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {CLP(r.cantidad * r.precio_aplicado)}
                    </span>
                    <button type="button" className="iconButton" style={{ width: 28, height: 28 }} onClick={() => handleRemoveRep(r.repuesto_id)}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Costo total</span>
            <div style={{ padding: '10px 12px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg)', fontSize: 16, fontWeight: 800, color: Number(form.costo_total) > 0 ? 'var(--ok)' : 'var(--muted)', letterSpacing: '-0.3px' }}>
              {CLP(form.costo_total || 0)}
            </div>
            <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3, display: 'block' }}>Calculado automáticamente desde servicios y repuestos</span>
          </div>

          {/* ── Facturación ── */}
          {(() => {
            const subtotal = Number(form.costo_total) || 0
            const iva = form.incluir_iva ? Math.round(subtotal * 0.19) : 0
            const total = subtotal + iva
            const pagado = Number(form.monto_pagado) || 0
            const saldo = total - pagado
            return (
              <div className="facturacion-box">
                <div className="facturacion-titulo">Facturación</div>
                <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 10 }}>
                  <input type="checkbox" checked={form.incluir_iva}
                    onChange={e => setForm(f => ({ ...f, incluir_iva: e.target.checked }))}
                    style={{ width: 'auto', cursor: 'pointer' }} />
                  <span style={{ margin: 0 }}>Incluir IVA (19%)</span>
                </label>
                <div className="facturacion-fila"><span>Subtotal</span><span>{CLP(subtotal)}</span></div>
                {form.incluir_iva && (
                  <div className="facturacion-fila"><span>IVA (19%)</span><span>{CLP(iva)}</span></div>
                )}
                <div className="facturacion-fila total"><span>Total</span><span>{CLP(total)}</span></div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                  <label>
                    <span>Forma de pago</span>
                    <select value={form.forma_pago} onChange={e => field('forma_pago', e.target.value)}>
                      <option value="">Sin especificar</option>
                      {FORMAS_PAGO.map(fp => <option key={fp} value={fp}>{fp}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Monto pagado</span>
                    <input type="number" min="0" step="1" value={form.monto_pagado}
                      onChange={e => field('monto_pagado', e.target.value)} placeholder="0" />
                  </label>
                </div>
                {pagado > 0 && saldo !== 0 && (
                  <div className="facturacion-fila saldo" style={{ marginTop: 8 }}>
                    <span>{saldo > 0 ? 'Saldo pendiente' : 'Saldo a favor'}</span>
                    <span>{CLP(Math.abs(saldo))}</span>
                  </div>
                )}
              </div>
            )
          })()}

          <label>
            <span>Notas internas</span>
            <textarea rows={2} value={form.notas_internas} onChange={e => field('notas_internas', e.target.value)} placeholder="Observaciones internas…" style={{ resize: 'vertical' }} />
          </label>

          <div className="formActions">
            <button type="submit" className="button teal" disabled={saving}>
              <Save size={14} />{saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" className="button" onClick={openNew}><X size={14} />Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}
