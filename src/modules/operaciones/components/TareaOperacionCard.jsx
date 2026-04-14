/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: TareaOperacionCard.jsx
 * Módulo:  Operaciones
 * ============================================================
 */

const PRIORIDAD = {
  alta:  { label: 'Alta',  color: '#A32D2D', bg: '#FCEBEB' },
  media: { label: 'Media', color: '#854F0B', bg: '#FAEEDA' },
  baja:  { label: 'Baja',  color: '#3B6D11', bg: '#EAF3DE' },
}

const ESTADO_OP = {
  pendiente:   { label: 'Pendiente',    color: '#A32D2D', bg: '#FCEBEB' },
  asignado:    { label: 'Asignado',     color: '#854F0B', bg: '#FAEEDA' },
  en_progreso: { label: 'En Progreso',  color: '#185FA5', bg: '#E6F1FB' },
  completado:  { label: 'Completado',   color: '#3B6D11', bg: '#EAF3DE' },
}

const fmtFecha = (iso) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const diasDesde = (ts) => {
  if (!ts) return null
  const d = ts?.toDate ? ts.toDate() : new Date(ts?.seconds ? ts.seconds * 1000 : ts)
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  return `${diff}d`
}

export default function TareaOperacionCard({ lead, onClick }) {
  const pr = PRIORIDAD[lead.prioridad] || PRIORIDAD.media
  const est = ESTADO_OP[lead.estadoOperacion] || ESTADO_OP.pendiente

  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff', border: '1px solid #eaecf0', borderRadius: 10,
        padding: '12px 14px', cursor: 'pointer', marginBottom: 8,
        borderLeft: `3px solid ${pr.color}`,
        transition: 'box-shadow .15s',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* Header: nombre + estado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lead.nombre}
          </div>
          {lead.empresaNombre && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{lead.empresaNombre}</div>
          )}
        </div>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
          background: est.bg, color: est.color, flexShrink: 0, marginLeft: 8,
        }}>
          {est.label}
        </span>
      </div>

      {/* Info */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, color: '#888' }}>
        <span style={{
          padding: '1px 7px', borderRadius: 12, background: pr.bg, color: pr.color, fontWeight: 600, fontSize: 10,
        }}>
          {pr.label}
        </span>

        {lead.tecnicoNombre && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width:14, height:14, borderRadius:'50%', background:'#185FA5', display:'inline-flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:7, fontWeight:700, flexShrink:0 }}>{(lead.tecnicoNombre||'?')[0].toUpperCase()}</span>
            {lead.tecnicoNombre}
          </span>
        )}

        {lead.fechaEstimada && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {fmtFecha(lead.fechaEstimada)}{lead.horaEstimada ? ` ${lead.horaEstimada}` : ''}
          </span>
        )}

        {lead.creadoEn && (
          <span style={{ marginLeft: 'auto', color: '#bbb' }}>
            Entrada: {diasDesde(lead.creadoEn)}
          </span>
        )}
      </div>
    </div>
  )
}
