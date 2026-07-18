'use client'

export default function PrintActions({ backHref: _ }: { backHref: string }) {
  return (
    <div className="no-print" style={{ marginBottom: 24 }}>
      <button
        onClick={() => window.print()}
        style={{ padding: '8px 16px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
        Imprimir
      </button>
    </div>
  )
}
