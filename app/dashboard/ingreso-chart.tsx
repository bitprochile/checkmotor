'use client'

interface Mes { mes_label: string; ingresos: number }

const BAR_MAX_PX = 76

export default function IngresoChart({ data }: { data: Mes[] }) {
  const max = Math.max(...data.map(d => d.ingresos), 1)
  return (
    <div className="barChart">
      {data.map(d => (
        <div key={d.mes_label} className="barChart-col">
          <div
            className="barChart-bar"
            style={{ height: `${Math.max(Math.round((d.ingresos / max) * BAR_MAX_PX), d.ingresos > 0 ? 3 : 0)}px` }}
          />
          <span className="barChart-label">{d.mes_label}</span>
        </div>
      ))}
    </div>
  )
}
