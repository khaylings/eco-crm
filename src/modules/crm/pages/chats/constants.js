// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVO: src/modules/crm/pages/chats/constants.js
// ─────────────────────────────────────────────────────────────────────────────

export const WASENDER_URL   = import.meta.env.VITE_WASENDER_API_URL || 'https://wasenderapi.com/api'
export const WASENDER_TOKEN = import.meta.env.VITE_WASENDER_SESSION_TOKEN
export const GEMINI_KEY     = import.meta.env.VITE_GEMINI_API_KEY
export const NUDGE_IMG_URL  = 'https://firebasestorage.googleapis.com/v0/b/eco-crm-da4eb.firebasestorage.app/o/assets%2Fmsn-nudge.png?alt=media&token=51c498c6-360d-4822-bfd9-4705cb3fe659'

export const ETIQUETAS = [
  { valor: '', label: 'Sin etiqueta', color: '#888' },
  { valor: 'cliente_nuevo', label: 'Cliente nuevo', color: '#185FA5' },
  { valor: 'cotizacion',    label: 'Cotización',    color: '#854F0B' },
  { valor: 'soporte',       label: 'Soporte',       color: '#A32D2D' },
  { valor: 'seguimiento',   label: 'Seguimiento',   color: '#534AB7' },
  { valor: 'cerrado',       label: 'Cerrado',       color: '#3B6D11' },
]

export const ETAPAS_PIPELINE = [
  { valor: '', label: 'Todas las etapas' },
  { valor: 'nuevo',      label: 'Nuevo lead' },
  { valor: 'contactado', label: 'Contactado' },
  { valor: 'negociacion',label: 'Negociación' },
  { valor: 'propuesta',  label: 'Propuesta enviada' },
  { valor: 'ganado',     label: 'Ganado' },
  { valor: 'perdido',    label: 'Perdido' },
]

export const ETAPAS_LEAD_ACTIVO = [
  { valor: 'nuevo',      label: 'Nuevo lead' },
  { valor: 'contactado', label: 'Contactado' },
  { valor: 'negociacion',label: 'Negociación' },
  { valor: 'propuesta',  label: 'Propuesta enviada' },
]

export const ORIGENES = ['WhatsApp', 'Referido', 'Redes sociales', 'Sitio web', 'Llamada', 'Email', 'Otro']

export const ROLES_SUPERVISOR = ['Super Administrador', 'Administrador', 'Supervisor', 'admin', 'supervisor', 'gerente']
export const ROLES_RESUMEN_IA = ['Super Administrador', 'Administrador']

export const ETAPA_CONFIG = {
  nuevo:       { label: 'Nuevo lead',       color: '#185FA5', bg: '#E6F1FB' },
  contactado:  { label: 'Contactado',        color: '#534AB7', bg: '#EEEDFE' },
  negociacion: { label: 'Negociación',       color: '#854F0B', bg: '#FAEEDA' },
  propuesta:   { label: 'Propuesta enviada', color: '#3B6D11', bg: '#EAF3DE' },
  ganado:      { label: 'Ganado',            color: '#fff',    bg: '#3B6D11' },
  perdido:     { label: 'Perdido',           color: '#fff',    bg: '#A32D2D' },
}
