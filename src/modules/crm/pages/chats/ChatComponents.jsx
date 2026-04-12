// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVO: src/modules/crm/pages/chats/ChatComponents.jsx
// ─────────────────────────────────────────────────────────────────────────────

import { iniciales, colorFromString } from './helpers'
import { ETAPA_CONFIG } from './constants'

export const sel = {
  width: '100%', padding: '6px 9px', border: '1px solid #dde3ed',
  borderRadius: '8px', fontSize: '13px', color: '#1a1a1a', background: '#fff', fontFamily: 'inherit',
}

export function EtapaBadge({ etapa, small }) {
  const cfg = ETAPA_CONFIG[etapa] || { label: etapa, color: '#888', bg: '#eee' }
  return (
    <span style={{
      display: 'inline-block', padding: small ? '1px 6px' : '2px 10px',
      borderRadius: '20px', fontSize: small ? '10px' : '11px', fontWeight: 600,
      backgroundColor: cfg.bg, color: cfg.color, whiteSpace: 'nowrap', lineHeight: '1.6',
    }}>
      {cfg.label}
    </span>
  )
}

export function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8a99b3', marginBottom: '5px' }}>
      {children}
    </div>
  )
}

export function Divider() {
  return <div style={{ height: '1px', background: '#e8edf5', margin: '10px 0' }} />
}

export function Avatar({ nombre, foto, size = 36, interno = false }) {
  const color = colorFromString(nombre || '')
  return foto
    ? <img src={foto} alt={nombre} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: interno ? '#0F6E56' : color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0 }}>
        {interno ? '💬' : iniciales(nombre)}
      </div>
}
