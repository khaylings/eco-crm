// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVO: src/modules/crm/pages/chats/helpers.js
// ─────────────────────────────────────────────────────────────────────────────

export function formatFecha(ts) {
  if (!ts) return ''
  const d = ts?.toDate ? ts.toDate() : new Date(typeof ts === 'number' ? ts * 1000 : ts)
  const hoy = new Date()
  if (d.toDateString() === hoy.toDateString())
    return d.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit' })
}

export function iniciales(nombre = '') {
  return nombre.split(' ').slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
}

export function colorFromString(str = '') {
  const colores = ['#185FA5', '#534AB7', '#0F6E56', '#993C1D', '#854F0B', '#A32D2D']
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return colores[Math.abs(hash) % colores.length]
}
