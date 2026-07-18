'use client'

interface BarDatum {
  label: string
  value: number
  color?: string
}

interface BarChartSVGProps {
  data: BarDatum[]
  height?: number
  formatValue?: (v: number) => string
  unit?: string
}

function fmt(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$${Math.round(v / 1_000)}K`
  return `$${v}`
}

const SLOT_W  = 54   // px por columna
const BAR_W   = 32   // ancho de barra
const PAD_TOP = 28   // espacio arriba para etiqueta de valor
const PAD_BOT = 30   // espacio abajo para etiqueta de mes

export default function BarChartSVG({ data, height = 220, formatValue = fmt, unit }: BarChartSVGProps) {
  if (!data.length) return <div className="chart-empty">Sin datos en el período</div>

  const n      = data.length
  const vbW    = n * SLOT_W
  const chartH = height - PAD_TOP - PAD_BOT
  const max    = Math.max(...data.map(d => d.value), 1)

  return (
    <div className="bar-chart-wrap">
      <svg
        viewBox={`0 0 ${vbW} ${height}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: height, display: 'block' }}
        aria-label={unit ? `Gráfico de barras: ${unit}` : 'Gráfico de barras'}
      >
        {/* línea base */}
        <line
          x1={0} y1={PAD_TOP + chartH}
          x2={vbW} y2={PAD_TOP + chartH}
          stroke="var(--line)" strokeWidth={1}
        />

        {data.map((d, i) => {
          const barH  = Math.max(2, (d.value / max) * chartH)
          const cx    = i * SLOT_W + SLOT_W / 2
          const barX  = cx - BAR_W / 2
          const barY  = PAD_TOP + chartH - barH
          const color = d.color ?? 'var(--brand)'

          return (
            <g key={i}>
              {/* barra */}
              <rect x={barX} y={barY} width={BAR_W} height={barH} fill={color} rx={3} />

              {/* valor encima */}
              <text
                x={cx} y={barY - 5}
                textAnchor="middle"
                fontSize={9} fill="var(--muted)"
                fontFamily="inherit"
              >
                {d.value > 0 ? formatValue(d.value) : ''}
              </text>

              {/* etiqueta mes debajo */}
              <text
                x={cx} y={PAD_TOP + chartH + 18}
                textAnchor="middle"
                fontSize={9} fill="var(--muted)"
                fontFamily="inherit"
              >
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
