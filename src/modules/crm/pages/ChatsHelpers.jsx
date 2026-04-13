/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: ChatsHelpers.jsx
 * Módulo:  CRM — Constantes, utilidades y subcomponentes
 * ============================================================
 */

import { useEffect, useState } from 'react'
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore'
import { db } from '../../../firebase/config'

// ─── Constantes de entorno ────────────────────────────────────────────────────
export const WASENDER_URL   = import.meta.env.VITE_WASENDER_API_URL || 'https://wasenderapi.com/api'
export const WASENDER_TOKEN = import.meta.env.VITE_WASENDER_SESSION_TOKEN
export const GEMINI_KEY     = import.meta.env.VITE_GEMINI_API_KEY

// Assets del nudge — subidos a Firebase Storage en assets/
export const NUDGE_AUDIO_URL = 'https://firebasestorage.googleapis.com/v0/b/eco-crm-da4eb.appspot.com/o/assets%2Fnudge-nudge-msn.mp3?alt=media&token=51c498c6-360d-4822-bfd9-4705cb3fe659'
export const NUDGE_IMG_URL   = 'https://firebasestorage.googleapis.com/v0/b/eco-crm-da4eb.appspot.com/o/assets%2Fmsn-nudge.png?alt=media&token=49bf9d3c-b39b-4f78-ac91-0e4a2647045c'

// ─── Constantes de dominio ────────────────────────────────────────────────────
export const ETIQUETAS = [
  { valor: '', label: 'Sin etiqueta', color: '#888' },
  { valor: 'cliente_nuevo', label: 'Cliente nuevo', color: '#185FA5' },
  { valor: 'cotizacion', label: 'Cotización', color: '#854F0B' },
  { valor: 'soporte', label: 'Soporte', color: '#A32D2D' },
  { valor: 'seguimiento', label: 'Seguimiento', color: '#534AB7' },
  { valor: 'cerrado', label: 'Cerrado', color: '#3B6D11' },
]

export const ORIGENES = ['WhatsApp', 'Referido', 'Redes sociales', 'Sitio web', 'Llamada', 'Email', 'Otro']
export const ROLES_SUPERVISOR = ['Super Administrador', 'Administrador', 'Supervisor', 'admin', 'supervisor', 'gerente']
export const ROLES_RESUMEN_IA = ['Super Administrador', 'Administrador']
export const ETAPAS_CERRADAS  = ['ganado', 'perdido']

export const SEL_STYLE = {
  width: '100%', padding: '6px 9px', border: '1px solid #dde3ed',
  borderRadius: '8px', fontSize: '13px', color: '#1a1a1a', background: '#fff', fontFamily: 'inherit',
}

// ─── Utilidades puras ─────────────────────────────────────────────────────────
export function formatFecha(ts) {
  if (!ts) return ''
  const d = ts?.toDate ? ts.toDate() : new Date(typeof ts === 'number' ? ts * 1000 : ts)
  const hoy = new Date()
  if (d.toDateString() === hoy.toDateString())
    return d.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' })
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

// ─── Subcomponentes atómicos ──────────────────────────────────────────────────
export function EtapaBadge({ etapa, etapasConfig = [], small }) {
  const cfg = etapasConfig.find(e => e.valor === etapa)
  const color = cfg?.color || '#888'
  const label = cfg?.label || etapa
  const esFinal = etapa === 'ganado' || etapa === 'perdido'
  const bg = esFinal ? (etapa === 'ganado' ? '#3B6D11' : '#A32D2D') : color + '22'
  const textColor = esFinal ? '#fff' : color
  return (
    <span style={{
      display: 'inline-block', padding: small ? '1px 6px' : '2px 10px',
      borderRadius: '20px', fontSize: small ? '10px' : '11px', fontWeight: 600,
      backgroundColor: bg, color: textColor, whiteSpace: 'nowrap', lineHeight: '1.6',
    }}>
      {label}
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

// ─── TabResumenIA ─────────────────────────────────────────────────────────────
export function TabResumenIA({ chatActivo, mensajes, tipoActivo }) {
  const [resumen,   setResumen]   = useState(null)
  const [generando, setGenerando] = useState(false)
  const [error,     setError]     = useState(null)
  const [guardado,  setGuardado]  = useState(null)

  useEffect(() => {
    setResumen(null)
    setError(null)
    const col = tipoActivo === 'wa' ? 'conversaciones' : 'chats_internos'
    getDoc(doc(db, col, chatActivo.id)).then(snap => {
      if (snap.exists() && snap.data().resumenIA) {
        setResumen(snap.data().resumenIA)
        setGuardado(snap.data().resumenIAFecha)
      }
    })
  }, [chatActivo.id])

  const generarResumen = async () => {
    if (!GEMINI_KEY) { setError('Configurá VITE_GEMINI_API_KEY en el .env'); return }
    if (mensajes.length === 0) { setError('No hay mensajes para resumir'); return }
    setGenerando(true)
    setError(null)
    try {
      const transcripcion = mensajes.map(m => {
        const quien = m.fromMe ? (m.autorNombre || 'Agente') : (chatActivo.nombre || 'Cliente')
        return `[${formatFecha(m.timestamp)}] ${quien}: ${m.body || '[media]'}`
      }).join('\n')

      const prompt = `Eres un asistente de CRM. Analizá la siguiente conversación de ${tipoActivo === 'wa' ? 'WhatsApp' : 'chat interno'} y generá un resumen ejecutivo en español con este formato exacto:

**RESUMEN EJECUTIVO**
[2-3 oraciones resumiendo de qué se trató la conversación]

**PUNTOS CLAVE**
- [punto 1]
- [punto 2]
- [punto 3]

**TONO DEL CLIENTE**
[positivo / neutral / negativo / interesado / indeciso] — [1 oración explicando por qué]

**PRÓXIMOS PASOS SUGERIDOS**
- [acción 1]
- [acción 2]

**DATOS IMPORTANTES MENCIONADOS**
[precios, fechas, productos, ubicaciones u otros datos relevantes. Si no hay, escribí "Ninguno"]

CONVERSACIÓN:
${transcripcion}`

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 1024, temperature: 0.4 },
          }),
        }
      )
      if (!res.ok) { const err = await res.json(); throw new Error(err?.error?.message || `Error ${res.status}`) }
      const data  = await res.json()
      const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo generar el resumen.'
      setResumen(texto)
      const col   = tipoActivo === 'wa' ? 'conversaciones' : 'chats_internos'
      const fecha = new Date().toISOString()
      await updateDoc(doc(db, col, chatActivo.id), { resumenIA: texto, resumenIAFecha: fecha })
      setGuardado(fecha)
    } catch (e) {
      console.error('Error generando resumen:', e)
      setError(e.message || 'Error al conectar con la IA')
    } finally {
      setGenerando(false)
    }
  }

  const renderTexto = (texto) => texto.split('\n').map((linea, i) => {
    if (linea.startsWith('**') && linea.endsWith('**'))
      return <div key={i} style={{ fontWeight: 700, fontSize: 12, color: '#185FA5', marginTop: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.5px' }}>{linea.replace(/\*\*/g, '')}</div>
    if (linea.startsWith('- '))
      return <div key={i} style={{ fontSize: 13, color: '#333', paddingLeft: 12, marginBottom: 3, lineHeight: 1.5 }}>• {linea.slice(2)}</div>
    if (linea.trim() === '') return <div key={i} style={{ height: 4 }} />
    return <div key={i} style={{ fontSize: 13, color: '#333', lineHeight: 1.6, marginBottom: 2 }}>{linea}</div>
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #e8edf5', background: '#fafbfd', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>🤖 Resumen con IA</div>
          <button onClick={generarResumen} disabled={generando}
            style={{ padding: '6px 14px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: generando ? 'not-allowed' : 'pointer', fontFamily: 'inherit', background: generando ? '#e0e0e0' : 'var(--eco-primary, #185FA5)', color: generando ? '#aaa' : '#fff', display: 'flex', alignItems: 'center', gap: 5 }}>
            {generando ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span> Analizando...</> : resumen ? '↺ Regenerar' : '✨ Generar resumen'}
          </button>
        </div>
        {guardado && <div style={{ fontSize: 10, color: '#bbb' }}>Último resumen: {new Date(guardado).toLocaleString('es-CR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>}
        <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{mensajes.length} mensajes · Powered by Gemini AI</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
        {error && <div style={{ padding: '10px 14px', background: '#FCEBEB', border: '0.5px solid #f09595', borderRadius: 8, color: '#A32D2D', fontSize: 12, marginBottom: 12 }}>⚠️ {error}</div>}
        {!resumen && !generando && !error && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#bbb' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🤖</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 6 }}>No hay resumen todavía</div>
            <div style={{ fontSize: 12, color: '#bbb' }}>Hacé clic en "Generar resumen" para analizar la conversación con IA</div>
          </div>
        )}
        {generando && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#bbb' }}>
            <div style={{ fontSize: 36, marginBottom: 10, animation: 'pulse 1s ease-in-out infinite' }}>🧠</div>
            <div style={{ fontSize: 13, color: '#888' }}>Analizando {mensajes.length} mensajes...</div>
            <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>Esto puede tomar unos segundos</div>
          </div>
        )}
        {resumen && !generando && (
          <div style={{ background: '#fff', border: '0.5px solid #e0e8e0', borderRadius: 10, padding: '14px 16px' }}>
            {renderTexto(resumen)}
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.5 } }
      `}</style>
    </div>
  )
}

// ─── ModalNuevoGrupo ──────────────────────────────────────────────────────────
export function ModalNuevoGrupo({ usuarios, onCrear, onCerrar, usuarioActual }) {
  const [tipo,      setTipo]      = useState('individual')
  const [nombre,    setNombre]    = useState('')
  const [miembros,  setMiembros]  = useState([usuarioActual?.uid].filter(Boolean))
  const [guardando, setGuardando] = useState(false)

  const otrosUsuarios  = usuarios.filter(u => u.uid !== usuarioActual?.uid)
  const seleccionadoUid = tipo === 'individual' ? miembros.find(uid => uid !== usuarioActual?.uid) : null
  const puedeCrear     = tipo === 'individual' ? !!seleccionadoUid : (nombre.trim() && miembros.length >= 2)

  const toggleMiembro = (uid) => {
    if (uid === usuarioActual?.uid) return
    if (tipo === 'individual') setMiembros([usuarioActual?.uid, uid])
    else setMiembros(prev => prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid])
  }

  const crear = async () => {
    if (!puedeCrear) return
    setGuardando(true)
    if (tipo === 'individual') {
      const otro = otrosUsuarios.find(u => u.uid === seleccionadoUid)
      await onCrear({ nombre: otro?.nombre || otro?.email || 'Chat', miembros, individual: true })
    } else {
      await onCrear({ nombre: nombre.trim(), miembros, individual: false })
    }
    setGuardando(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: '#fff', borderRadius: 14, width: '90%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '0.5px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Nuevo chat interno</span>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa' }}>×</button>
        </div>

        <div style={{ padding: '14px 18px 0', display: 'flex', gap: 8 }}>
          {[{ key: 'individual', label: '👤 Individual', desc: 'Chat con una persona' }, { key: 'grupal', label: '👥 Grupal', desc: 'Chat con varios' }].map(t => (
            <button key={t.key} onClick={() => { setTipo(t.key); setMiembros([usuarioActual?.uid].filter(Boolean)); setNombre('') }}
              style={{ flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', border: `2px solid ${tipo === t.key ? '#0F6E56' : '#e0e0e0'}`, background: tipo === t.key ? '#f0faf6' : '#fafafa', color: tipo === t.key ? '#0F6E56' : '#888' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</div>
              <div style={{ fontSize: 10, marginTop: 2, opacity: 0.7 }}>{t.desc}</div>
            </button>
          ))}
        </div>

        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {tipo === 'grupal' && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }}>Nombre del grupo</label>
              <input style={{ ...SEL_STYLE, fontSize: 13 }} placeholder="Ej: Equipo ventas, Soporte..." value={nombre} onChange={e => setNombre(e.target.value)} autoFocus={tipo === 'grupal'} />
            </div>
          )}
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 8 }}>
              {tipo === 'individual' ? 'Elegí con quién hablar' : 'Miembros del grupo'}
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
              {otrosUsuarios.map(u => {
                const selec = miembros.includes(u.uid)
                return (
                  <div key={u.uid} onClick={() => toggleMiembro(u.uid)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, background: selec ? '#f0faf6' : '#fafafa', border: `0.5px solid ${selec ? '#0F6E56' : 'transparent'}`, transition: 'all .1s' }}>
                    {tipo === 'grupal'
                      ? <input type="checkbox" checked={selec} onChange={() => {}} style={{ accentColor: '#0F6E56', flexShrink: 0, pointerEvents: 'none' }} />
                      : <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${selec ? '#0F6E56' : '#ccc'}`, background: selec ? '#0F6E56' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {selec && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
                        </div>}
                    <Avatar nombre={u.nombre || u.email} foto={u.fotoURL} size={28} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>{u.nombre || u.email}</div>
                      {u.rol && <div style={{ fontSize: 10, color: '#aaa' }}>{u.rol}</div>}
                    </div>
                    {selec && <span style={{ color: '#0F6E56', fontSize: 14, fontWeight: 700 }}>✓</span>}
                  </div>
                )
              })}
            </div>
          </div>
          {tipo === 'grupal' && miembros.length < 2 && <p style={{ fontSize: 11, color: '#A32D2D', margin: 0 }}>Seleccioná al menos un miembro.</p>}
        </div>

        <div style={{ padding: '12px 18px', borderTop: '0.5px solid rgba(0,0,0,.08)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCerrar} style={{ padding: '7px 14px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 12, cursor: 'pointer', background: '#f5f5f5', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={crear} disabled={guardando || !puedeCrear}
            style={{ padding: '7px 18px', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: guardando || !puedeCrear ? 'not-allowed' : 'pointer', background: !puedeCrear ? '#e0e0e0' : '#0F6E56', color: !puedeCrear ? '#aaa' : '#fff', fontFamily: 'inherit' }}>
            {guardando ? 'Creando...' : tipo === 'individual' ? 'Iniciar chat' : 'Crear grupo'}
          </button>
        </div>
      </div>
    </div>
  )
}