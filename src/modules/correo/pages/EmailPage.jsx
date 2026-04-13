/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: EmailPage.jsx
 * Módulo:  Correo Electrónico
 * ============================================================
 */

import { useEffect, useState } from 'react'
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../../firebase/config'
import { useAuth } from '../../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getAuth } from 'firebase/auth'

const SYNC_URL    = 'https://us-central1-eco-crm-da4eb.cloudfunctions.net/sincronizarEmailsManual'
const IMPORT_URL  = 'https://us-central1-eco-crm-da4eb.cloudfunctions.net/importarEmailsHistoricos'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatFechaEmail(fecha) {
  if (!fecha) return ''
  const d = fecha?.toDate ? fecha.toDate() : new Date(fecha?.seconds ? fecha.seconds * 1000 : fecha)
  if (isNaN(d.getTime())) return ''
  const ahora   = new Date()
  const diffMin = Math.floor((ahora - d) / 60000)
  const diffH   = Math.floor((ahora - d) / 3600000)
  const diffD   = Math.floor((ahora - d) / 86400000)
  if (diffMin < 1)  return 'Ahora'
  if (diffMin < 60) return `${diffMin} min`
  if (diffH < 24)   return d.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })
  if (diffD < 7)    return d.toLocaleDateString('es-CR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
  return d.toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatFechaDetalle(fecha) {
  if (!fecha) return ''
  const d = fecha?.toDate ? fecha.toDate() : new Date(fecha?.seconds ? fecha.seconds * 1000 : fecha)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('es-CR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatFechaCorta(fecha) {
  if (!fecha) return '—'
  const d = fecha instanceof Date ? fecha : fecha?.toDate ? fecha.toDate() : new Date(fecha?.seconds ? fecha.seconds * 1000 : fecha)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }) + ' · ' + d.toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function initials(str) {
  if (!str) return '?'
  const parts = str.trim().split(/\s+/)
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : str.slice(0, 2).toUpperCase()
}

function colorFromEmail(email) {
  const colors = ['#185FA5', '#3B6D11', '#854F0B', '#534AB7', '#0F6E56', '#A32D2D', '#5F5E5A', '#0C447C']
  let hash = 0
  for (let i = 0; i < (email || '').length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function SpinnerInline() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ animation: 'emailSpin 1s linear infinite', flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round" />
      <style>{`@keyframes emailSpin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
    </svg>
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function EmailAvatar({ nombre, email, size = 36 }) {
  const bg = colorFromEmail(email || nombre)
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: size * 0.35, fontWeight: 700, flexShrink: 0 }}>
      {initials(nombre || email)}
    </div>
  )
}

// ─── Badge estado cuenta ──────────────────────────────────────────────────────
function EstadoCuenta({ cuenta }) {
  const ok    = cuenta.estadoConexion === 'ok'
  const error = cuenta.estadoConexion === 'error'
  const color = ok ? '#3B6D11' : error ? '#A32D2D' : '#888'
  const bg    = ok ? '#EAF3DE' : error ? '#FCEBEB' : '#f0f0f0'
  const texto = ok ? '● OK' : error ? '● Error' : '○ —'
  const titulo = error ? (cuenta.errorConexion || 'Error') : ok && cuenta.ultimaSincronizacion ? `Última sync: ${formatFechaCorta(cuenta.ultimaSincronizacion)}` : ''
  return (
    <span title={titulo} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: bg, color, fontWeight: 600, cursor: titulo ? 'help' : 'default' }}>{texto}</span>
  )
}

// ─── Modal Importar Históricos ────────────────────────────────────────────────
function ModalImportar({ onCerrar, onImportar }) {
  const [limite, setLimite] = useState(500)
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado]   = useState(null)
  const [error, setError]           = useState(null)

  async function ejecutar() {
    setImportando(true); setError(null); setResultado(null)
    try {
      const res = await onImportar({ desdeAnio: 2025, limitePorCuenta: limite })
      setResultado(res)
    } catch(e) {
      setError(e.message || 'Error al importar')
    } finally {
      setImportando(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && !importando && onCerrar()}>
      <div style={{ background: '#fff', borderRadius: 14, width: '90%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e8ecf0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8f9fc' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>📥 Importar correos históricos</span>
          {!importando && <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#aaa' }}>×</button>}
        </div>

        <div style={{ padding: '20px' }}>

          {/* Info */}
          <div style={{ padding: '12px 14px', background: '#EAF3DE', border: '1px solid #8BC34A', borderRadius: 9, marginBottom: 16, fontSize: 12, color: '#3B6D11', lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>✅ Filtros aplicados automáticamente:</div>
            <div>• Solo correos desde <strong>enero 2025</strong></div>
            <div>• Excluye: eco website, ChatGPT, OpenAI, Stel Order, SAP</div>
            <div>• Excluye: Mail Delivery, Postmaster, Meta, Twilio</div>
            <div>• Excluye: BNCR, BAC, Scotiabank, Davivienda, Promerica, Lafise y otros bancos</div>
            <div style={{ marginTop: 6 }}>• Los históricos entran como <strong>leídos</strong> (no afectan el contador)</div>
            <div>• No se marcan como leídos en el servidor</div>
          </div>

          {/* Límite */}
          {!resultado && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 6 }}>
                Máximo de correos por cuenta
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[200, 500, 1000].map(v => (
                  <button key={v} onClick={() => setLimite(v)}
                    style={{ flex: 1, padding: '8px', border: `1px solid ${limite === v ? '#185FA5' : '#e0e0e0'}`, borderRadius: 8, fontSize: 13, fontWeight: limite === v ? 700 : 400, cursor: 'pointer', background: limite === v ? '#E6F1FB' : '#fff', color: limite === v ? '#185FA5' : '#555', fontFamily: 'inherit' }}>
                    {v}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: '#bbb', marginTop: 5 }}>
                Si hay más de {limite} en el servidor, corrés la importación varias veces.
              </div>
            </div>
          )}

          {/* Progreso */}
          {importando && (
            <div style={{ padding: '16px', background: '#f0f4f8', borderRadius: 9, textAlign: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#185FA5', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                <SpinnerInline /> Importando correos...
              </div>
              <div style={{ fontSize: 11, color: '#888' }}>Esto puede tardar varios minutos. No cierres esta ventana.</div>
            </div>
          )}

          {/* Resultado */}
          {resultado && (
            <div style={{ padding: '14px', background: '#EAF3DE', border: '1px solid #8BC34A', borderRadius: 9, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#3B6D11', marginBottom: 8 }}>✓ Importación completada</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center', flex: 1, padding: '8px', background: '#fff', borderRadius: 7, border: '1px solid #c5e0a0' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#3B6D11' }}>{resultado.totalImportados}</div>
                  <div style={{ fontSize: 10, color: '#666' }}>Importados</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1, padding: '8px', background: '#fff', borderRadius: 7, border: '1px solid #e0e0e0' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#888' }}>{resultado.totalFiltrados}</div>
                  <div style={{ fontSize: 10, color: '#666' }}>Filtrados</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1, padding: '8px', background: '#fff', borderRadius: 7, border: '1px solid #e0e0e0' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#aaa' }}>{resultado.totalDuplicados}</div>
                  <div style={{ fontSize: 10, color: '#666' }}>Duplicados</div>
                </div>
              </div>
              {resultado.cuentas?.map(c => (
                <div key={c.email} style={{ marginTop: 8, fontSize: 11, color: c.ok ? '#3B6D11' : '#A32D2D' }}>
                  {c.ok ? '✓' : '✗'} {c.email}: {c.ok ? `${c.importados} importados, ${c.filtrados} filtrados` : c.error}
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ padding: '10px 14px', background: '#FCEBEB', border: '1px solid #f09595', borderRadius: 9, marginBottom: 16, fontSize: 12, color: '#A32D2D' }}>
              ✗ {error}
            </div>
          )}

          {/* Botones */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {!importando && <button onClick={onCerrar} style={{ padding: '8px 18px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: '#f5f5f5', fontFamily: 'inherit' }}>
              {resultado ? 'Cerrar' : 'Cancelar'}
            </button>}
            {!resultado && (
              <button onClick={ejecutar} disabled={importando}
                style={{ padding: '8px 22px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: importando ? 'not-allowed' : 'pointer', background: importando ? '#ccc' : '#3B6D11', color: '#fff', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                {importando ? <><SpinnerInline /> Importando...</> : '📥 Iniciar importación'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Redactar ────────────────────────────────────────────────────────────
function ModalRedactar({ cuentas, inicial, onCerrar }) {
  const fns      = getFunctions()
  const fnEnviar = httpsCallable(fns, 'enviarEmail')
  const [para,     setPara]     = useState(inicial?.para    || '')
  const [cc,       setCc]       = useState(inicial?.cc      || '')
  const [asunto,   setAsunto]   = useState(inicial?.asunto  || '')
  const [cuerpo,   setCuerpo]   = useState(inicial?.cuerpo  || '')
  const [cuentaId, setCuentaId] = useState(inicial?.cuentaId || cuentas[0]?.id || '')
  const [enviando, setEnviando] = useState(false)
  const [error,    setError]    = useState(null)

  async function enviar() {
    if (!para.trim() || !asunto.trim() || !cuentaId) { setError('Completá: Para, Asunto y elegí una cuenta.'); return }
    setEnviando(true); setError(null)
    try {
      await fnEnviar({ cuentaId, para: para.trim(), asunto: asunto.trim(), cuerpoTexto: cuerpo, cuerpoHtml: `<div style="font-family:inherit;font-size:14px;line-height:1.6">${cuerpo.replace(/\n/g,'<br>')}</div>`, leadId: inicial?.leadId || null, contactoId: inicial?.contactoId || null })
      onCerrar()
    } catch (e) { setError(e.message || 'Error al enviar.') }
    finally { setEnviando(false) }
  }

  const inp = { width: '100%', padding: '8px 10px', border: '1px solid #e8ecf0', borderRadius: 7, fontSize: 13, color: '#1a1a1a', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#fff' }
  const lbl = { fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: '#fff', borderRadius: 14, width: '90%', maxWidth: 620, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e8ecf0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>✉️ Redactar correo</span>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#aaa' }}>×</button>
        </div>
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', flex: 1 }}>
          <div><label style={lbl}>Enviar desde *</label>
            <select value={cuentaId} onChange={e => setCuentaId(e.target.value)} style={{ ...inp, fontSize: 12 }}>
              {cuentas.length === 0 ? <option value="">Sin cuentas configuradas</option> : cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre} &lt;{c.email}&gt;</option>)}
            </select>
          </div>
          <div><label style={lbl}>Para *</label><input value={para} onChange={e => setPara(e.target.value)} placeholder="destinatario@ejemplo.com" style={inp} /></div>
          <div><label style={lbl}>CC</label><input value={cc} onChange={e => setCc(e.target.value)} placeholder="copia@ejemplo.com" style={inp} /></div>
          <div><label style={lbl}>Asunto *</label><input value={asunto} onChange={e => setAsunto(e.target.value)} placeholder="Asunto del correo" style={inp} /></div>
          <div><label style={lbl}>Mensaje</label><textarea value={cuerpo} onChange={e => setCuerpo(e.target.value)} placeholder="Escribe tu mensaje aquí..." rows={10} style={{ ...inp, resize: 'vertical', lineHeight: 1.7, minHeight: 180 }} /></div>
          {error && <div style={{ padding: '8px 12px', background: '#FCEBEB', border: '1px solid #f09595', borderRadius: 7, fontSize: 12, color: '#A32D2D' }}>{error}</div>}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #e8ecf0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCerrar} style={{ padding: '8px 18px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: '#f5f5f5', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={enviar} disabled={enviando || !cuentaId} style={{ padding: '8px 22px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: enviando ? 'not-allowed' : 'pointer', background: enviando ? '#ccc' : '#185FA5', color: '#fff', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            {enviando && <SpinnerInline />}{enviando ? 'Enviando...' : '📤 Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Detalle email ─────────────────────────────────────────────────────────────
function DetalleEmail({ email, onResponder, onVerLead }) {
  if (!email) return null
  const de = email.de || email.deEmail || '—'
  const esEntrada = email.direccion === 'entrada'
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', background: '#fff', borderBottom: '1px solid #e8ecf0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
          <EmailAvatar nombre={de} email={email.deEmail || de} size={42} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a1a', marginBottom: 3 }}>{email.asunto || '(Sin asunto)'}</div>
            <div style={{ fontSize: 12, color: '#555' }}><span style={{ fontWeight: 500 }}>De:</span> {de}</div>
            <div style={{ fontSize: 12, color: '#555' }}><span style={{ fontWeight: 500 }}>Para:</span> {email.para || '—'}</div>
            <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>{formatFechaDetalle(email.fecha || email.creadoEn)}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {email.leadId && <button onClick={() => onVerLead && onVerLead(email.leadId)} style={{ padding: '5px 12px', border: '1px solid #185FA5', borderRadius: 7, fontSize: 11, cursor: 'pointer', background: '#E6F1FB', color: '#185FA5', fontFamily: 'inherit', fontWeight: 500 }}>👤 Ver lead</button>}
            {esEntrada && <button onClick={() => onResponder && onResponder(email)} style={{ padding: '5px 12px', border: 'none', borderRadius: 7, fontSize: 11, cursor: 'pointer', background: '#185FA5', color: '#fff', fontFamily: 'inherit', fontWeight: 500 }}>↩ Responder</button>}
          </div>
        </div>
        {email.adjuntos?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {email.adjuntos.map((adj, i) => <span key={i} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#f0f4f8', color: '#555', border: '1px solid #e0e0e0' }}>📎 {adj.nombre}</span>)}
          </div>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#fafbfc' }}>
        {email.cuerpoHtml
          ? <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', border: '1px solid #e8ecf0', fontSize: 14, lineHeight: 1.8, color: '#1a1a1a' }} dangerouslySetInnerHTML={{ __html: email.cuerpoHtml }} />
          : <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', border: '1px solid #e8ecf0', fontSize: 14, lineHeight: 1.8, color: '#1a1a1a', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{email.cuerpoTexto || '(Sin contenido)'}</div>
        }
      </div>
    </div>
  )
}

// ─── Item lista ────────────────────────────────────────────────────────────────
function EmailItem({ email, activo, onClick }) {
  const esEntrada = email.direccion === 'entrada'
  const esNoLeido = email.estado === 'no_leido'
  const de        = email.de || email.deEmail || '—'
  const contactoNombre = email.contactoNombre || de
  return (
    <div onClick={onClick} style={{ padding: '11px 14px', cursor: 'pointer', background: activo ? '#EEF3FA' : '#fff', borderLeft: activo ? '3px solid #185FA5' : '3px solid transparent', borderBottom: '1px solid #f5f6f8' }}
      onMouseEnter={e => { if (!activo) e.currentTarget.style.background = '#f9fafb' }}
      onMouseLeave={e => { if (!activo) e.currentTarget.style.background = '#fff' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <EmailAvatar nombre={contactoNombre} email={email.deEmail || de} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontWeight: esNoLeido ? 700 : 500, fontSize: 13, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
              {esEntrada ? contactoNombre : `→ ${email.para || '?'}`}
            </span>
            <span style={{ fontSize: 10, color: '#bbb', flexShrink: 0, marginLeft: 4 }}>{formatFechaEmail(email.fecha || email.creadoEn)}</span>
          </div>
          <div style={{ fontSize: 12, color: esNoLeido ? '#1a1a1a' : '#666', fontWeight: esNoLeido ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{email.asunto || '(Sin asunto)'}</div>
          <div style={{ fontSize: 11, color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(email.cuerpoTexto || '').slice(0, 80)}</div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 4 }}>
            {!esEntrada && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 10, background: '#E6F1FB', color: '#185FA5', fontWeight: 600 }}>ENVIADO</span>}
            {email.importadoHistorico && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 10, background: '#F5F0FF', color: '#534AB7', fontWeight: 600 }}>HISTÓRICO</span>}
            {email.leadId && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 10, background: '#EAF3DE', color: '#3B6D11', fontWeight: 600 }}>LEAD</span>}
            {esNoLeido && <span style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#185FA5', flexShrink: 0, display: 'inline-block' }} />}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ──────────────────────────────────────────────────────────
export default function EmailPage() {
  const { usuario } = useAuth()
  const navigate    = useNavigate()
  const fns         = getFunctions()
  const fnListar    = httpsCallable(fns, 'listarCuentasEmail')

  const [emails,             setEmails]             = useState([])
  const [cuentas,            setCuentas]            = useState([])
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState(null)
  const [emailActivo,        setEmailActivo]        = useState(null)
  const [tab,                setTab]                = useState('recibidos')
  const [busqueda,           setBusqueda]           = useState('')
  const [cargando,           setCargando]           = useState(true)
  const [showRedactar,       setShowRedactar]       = useState(false)
  const [redactarInicial,    setRedactarInicial]    = useState(null)
  const [showImportar,       setShowImportar]       = useState(false)
  const [noLeidos,           setNoLeidos]           = useState(0)
  const [sincronizando,      setSincronizando]      = useState(false)
  const [resultadoSync,      setResultadoSync]      = useState(null)
  const [errorSync,          setErrorSync]          = useState(null)
  const [ultimaSync,         setUltimaSync]         = useState(null)

  useEffect(() => {
    const col = collection(db, 'configuracion_segura', 'cuentas_email', 'lista')
    return onSnapshot(col, snap => {
      setCuentas(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.activo))
    }, () => {
      fnListar().then(res => setCuentas((res.data.cuentas || []).filter(c => c.activo))).catch(() => {})
    })
  }, [])

  useEffect(() => {
    setCargando(true)
    const q = query(collection(db, 'emails'), orderBy('creadoEn', 'desc'))
    return onSnapshot(q, snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setEmails(lista)
      setNoLeidos(lista.filter(e => e.estado === 'no_leido' && e.direccion === 'entrada').length)
      setCargando(false)
    }, () => setCargando(false))
  }, [])

  async function getToken() {
    const auth  = getAuth()
    const token = await auth.currentUser?.getIdToken()
    if (!token) throw new Error('No hay sesión activa')
    return token
  }

  async function sincronizar() {
    if (sincronizando) return
    setSincronizando(true); setResultadoSync(null); setErrorSync(null)
    try {
      const token = await getToken()
      const res   = await fetch(SYNC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({}) })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const data = await res.json()
      setResultadoSync(data)
      setUltimaSync(new Date())
      setTimeout(() => setResultadoSync(null), 6000)
    } catch (e) {
      setErrorSync(e.message || 'Error al sincronizar')
      setTimeout(() => setErrorSync(null), 6000)
    } finally {
      setSincronizando(false)
    }
  }

  async function importarHistoricos({ desdeAnio, limitePorCuenta }) {
    const token = await getToken()
    const res   = await fetch(IMPORT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ desdeAnio, limitePorCuenta }),
    })
    if (!res.ok) throw new Error(`Error ${res.status}`)
    return await res.json()
  }

  async function seleccionarEmail(email) {
    setEmailActivo(email)
    if (email.estado === 'no_leido' && email.direccion === 'entrada') {
      await updateDoc(doc(db, 'emails', email.id), { estado: 'leido' }).catch(() => {})
    }
  }

  const emailsFiltrados = emails.filter(e => {
    if (tab === 'recibidos' && e.direccion !== 'entrada') return false
    if (tab === 'enviados'  && e.direccion !== 'salida')  return false
    if (cuentaSeleccionada) {
      const c = cuentas.find(x => x.id === cuentaSeleccionada)
      if (c && e.cuentaEmail !== c.email && e.deCuenta !== c.nombre && e.de !== c.email) return false
    }
    if (busqueda) {
      const q = busqueda.toLowerCase()
      if (!(e.asunto||'').toLowerCase().includes(q) && !(e.de||e.deEmail||'').toLowerCase().includes(q) && !(e.para||'').toLowerCase().includes(q) && !(e.contactoNombre||'').toLowerCase().includes(q)) return false
    }
    return true
  })

  function responder(email) {
    setRedactarInicial({ para: email.deEmail || email.de, asunto: `Re: ${email.asunto || ''}`, cuerpo: `\n\n---\nEn respuesta a: ${email.asunto}\nDe: ${email.de}`, leadId: email.leadId || null, contactoId: email.contactoId || null })
    setShowRedactar(true)
  }

  const hayErrorConexion = cuentas.some(c => c.estadoConexion === 'error')
  const todasOk          = cuentas.length > 0 && cuentas.every(c => c.estadoConexion === 'ok')
  const noLeidosCuenta   = (cid) => { const c = cuentas.find(x => x.id === cid); if (!c) return 0; return emails.filter(e => e.estado === 'no_leido' && e.direccion === 'entrada' && (e.cuentaEmail === c.email || e.de === c.email)).length }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', fontFamily: 'inherit', background: '#f5f7fa' }}>

      {/* ════════ MODALES ════════ */}
      {showImportar && (
        <ModalImportar onCerrar={() => setShowImportar(false)} onImportar={importarHistoricos} />
      )}
      {showRedactar && (
        <ModalRedactar cuentas={cuentas} inicial={redactarInicial} onCerrar={() => { setShowRedactar(false); setRedactarInicial(null) }} />
      )}

      {/* ════════ SIDEBAR ════════ */}
      <div style={{ width: 290, borderRight: '1px solid #e8ecf0', display: 'flex', flexDirection: 'column', background: '#fff', flexShrink: 0, height: '100%' }}>
        <div style={{ padding: '14px 14px 8px', flexShrink: 0 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>📧 Correo</span>
              {cuentas.length > 0 && (
                <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 8, fontWeight: 600, background: todasOk ? '#EAF3DE' : hayErrorConexion ? '#FCEBEB' : '#f0f0f0', color: todasOk ? '#3B6D11' : hayErrorConexion ? '#A32D2D' : '#888' }}>
                  {todasOk ? '● Conectado' : hayErrorConexion ? '⚠ Error' : '○ Sin verificar'}
                </span>
              )}
            </div>
            <button onClick={() => { setRedactarInicial(null); setShowRedactar(true) }} style={{ padding: '5px 12px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Redactar</button>
          </div>

          {/* Botón sincronizar */}
          <button onClick={sincronizar} disabled={sincronizando || cuentas.length === 0}
            title={cuentas.length === 0 ? 'Configurá una cuenta primero' : 'Revisar nuevos correos ahora'}
            style={{ width: '100%', padding: '8px 10px', marginBottom: 6, border: `1px solid ${hayErrorConexion ? '#f09595' : '#c8d9ee'}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: sincronizando || cuentas.length === 0 ? 'not-allowed' : 'pointer', background: sincronizando ? '#f0f4f8' : hayErrorConexion ? '#FCEBEB' : '#E6F1FB', color: sincronizando ? '#888' : hayErrorConexion ? '#A32D2D' : '#185FA5', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: cuentas.length === 0 ? 0.5 : 1 }}>
            {sincronizando ? <><SpinnerInline /> Revisando correos...</> : hayErrorConexion ? '⚠️ Reintentar conexión' : '🔄 Revisar nuevos correos'}
          </button>

          {/* Botón importar históricos */}
          <button onClick={() => setShowImportar(true)} disabled={cuentas.length === 0}
            title="Importar correos del año 2025 con filtros"
            style={{ width: '100%', padding: '7px 10px', marginBottom: 8, border: '1px solid #c5e0a0', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: cuentas.length === 0 ? 'not-allowed' : 'pointer', background: '#EAF3DE', color: '#3B6D11', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: cuentas.length === 0 ? 0.5 : 1 }}>
            📥 Importar históricos 2025
          </button>

          {/* Resultado sync */}
          {resultadoSync && (
            <div style={{ padding: '7px 10px', marginBottom: 8, background: '#EAF3DE', border: '1px solid #8BC34A', borderRadius: 7, fontSize: 11, color: '#3B6D11' }}>
              ✓ {resultadoSync.totalNuevos > 0 ? `${resultadoSync.totalNuevos} correo${resultadoSync.totalNuevos !== 1 ? 's' : ''} nuevo${resultadoSync.totalNuevos !== 1 ? 's' : ''}` : 'Sin correos nuevos'}
              {resultadoSync.cuentas?.some(c => !c.ok) && <div style={{ marginTop: 3, color: '#A32D2D', fontSize: 10 }}>⚠️ Error en: {resultadoSync.cuentas.filter(c => !c.ok).map(c => c.email).join(', ')}</div>}
            </div>
          )}
          {errorSync && (
            <div style={{ padding: '7px 10px', marginBottom: 8, background: '#FCEBEB', border: '1px solid #f09595', borderRadius: 7, fontSize: 11, color: '#A32D2D' }}>✗ {errorSync}</div>
          )}

          {/* Alerta error conexión */}
          {hayErrorConexion && !sincronizando && !errorSync && !resultadoSync && (
            <div style={{ padding: '8px 10px', marginBottom: 8, background: '#FCEBEB', border: '1px solid #f09595', borderRadius: 7, fontSize: 11, color: '#A32D2D' }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>⚠️ Error en {cuentas.filter(c => c.estadoConexion === 'error').length} cuenta{cuentas.filter(c => c.estadoConexion === 'error').length !== 1 ? 's' : ''}</div>
              {cuentas.filter(c => c.estadoConexion === 'error').map(c => (
                <div key={c.id} style={{ fontSize: 10, marginTop: 1 }}>• {c.email}: {(c.errorConexion || 'Error').slice(0, 55)}</div>
              ))}
            </div>
          )}

          {/* Sin cuentas */}
          {cuentas.length === 0 && !cargando && (
            <div style={{ padding: '9px 11px', marginBottom: 8, background: '#FAEEDA', border: '1px solid #F0D080', borderRadius: 7, fontSize: 11, color: '#854F0B' }}>
              ⚠️ Sin cuentas configuradas. <span onClick={() => navigate('/configuracion')} style={{ textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}>Configurar →</span>
            </div>
          )}

          {/* Buscador */}
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#bbb' }}>🔍</span>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar asunto o remitente..." style={{ width: '100%', padding: '7px 10px 7px 27px', border: '1px solid #e8ecf0', borderRadius: 8, fontSize: 12, outline: 'none', background: '#f7f8fa', color: '#1a1a1a', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {[{ key: 'recibidos', label: '📥 Recibidos' }, { key: 'enviados', label: '📤 Enviados' }, { key: 'todos', label: 'Todos' }].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: '5px 2px', border: 'none', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 7, background: tab === t.key ? '#185FA5' : '#f0f2f5', color: tab === t.key ? '#fff' : '#666' }}>{t.label}</button>
            ))}
          </div>

          {/* Cuentas */}
          {cuentas.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 9, color: '#bbb', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 4, fontWeight: 600 }}>Cuentas</div>
              <div onClick={() => setCuentaSeleccionada(null)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 7px', borderRadius: 7, cursor: 'pointer', marginBottom: 2, background: !cuentaSeleccionada ? '#EEF3FA' : 'transparent', border: !cuentaSeleccionada ? '1px solid #c8d9ee' : '1px solid transparent' }}
                onMouseEnter={e => { if (cuentaSeleccionada) e.currentTarget.style.background = '#f7f8fa' }}
                onMouseLeave={e => { if (cuentaSeleccionada) e.currentTarget.style.background = 'transparent' }}>
                <span style={{ fontSize: 13 }}>📭</span>
                <span style={{ fontSize: 12, flex: 1, fontWeight: !cuentaSeleccionada ? 600 : 400 }}>Todas las cuentas</span>
                {noLeidos > 0 && !cuentaSeleccionada && <span style={{ background: '#185FA5', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>{noLeidos}</span>}
              </div>
              {cuentas.map(c => {
                const nl = noLeidosCuenta(c.id)
                return (
                  <div key={c.id} onClick={() => setCuentaSeleccionada(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 7px', borderRadius: 7, cursor: 'pointer', marginBottom: 2, background: cuentaSeleccionada === c.id ? '#EEF3FA' : 'transparent', border: cuentaSeleccionada === c.id ? '1px solid #c8d9ee' : '1px solid transparent' }}
                    onMouseEnter={e => { if (cuentaSeleccionada !== c.id) e.currentTarget.style.background = '#f7f8fa' }}
                    onMouseLeave={e => { if (cuentaSeleccionada !== c.id) e.currentTarget.style.background = 'transparent' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: colorFromEmail(c.email), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 700, flexShrink: 0 }}>{(c.nombre || c.email)[0].toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: cuentaSeleccionada === c.id ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{c.nombre}</span>
                        <EstadoCuenta cuenta={c} />
                      </div>
                      <div style={{ fontSize: 10, color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>
                    </div>
                    {nl > 0 && <span style={{ background: '#185FA5', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, flexShrink: 0 }}>{nl}</span>}
                  </div>
                )
              })}
            </div>
          )}

          {/* Contador */}
          <div style={{ fontSize: 10, color: '#bbb', paddingTop: 5, borderTop: '1px solid #f0f2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{emailsFiltrados.length} correo{emailsFiltrados.length !== 1 ? 's' : ''}{noLeidos > 0 && tab !== 'enviados' && <span style={{ marginLeft: 5, color: '#185FA5', fontWeight: 600 }}>· {noLeidos} sin leer</span>}</span>
            {ultimaSync && <span style={{ fontSize: 9, color: '#ccc' }}>Sync {formatFechaCorta(ultimaSync)}</span>}
          </div>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid #f0f2f5' }}>
          {cargando && <div style={{ padding: 30, textAlign: 'center', color: '#bbb', fontSize: 13 }}><div style={{ fontSize: 28, marginBottom: 8 }}>📬</div>Cargando...</div>}
          {!cargando && emailsFiltrados.length === 0 && (
            <div style={{ padding: 30, textAlign: 'center', color: '#bbb', fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
              {busqueda ? 'Sin resultados' : tab === 'recibidos' ? 'Sin correos recibidos' : tab === 'enviados' ? 'Sin correos enviados' : 'Sin correos aún'}
            </div>
          )}
          {emailsFiltrados.map(email => (
            <EmailItem key={email.id} email={email} activo={emailActivo?.id === email.id} onClick={() => seleccionarEmail(email)} />
          ))}
        </div>
      </div>

      {/* ════════ PANEL CENTRAL ════════ */}
      {emailActivo ? (
        <DetalleEmail email={emailActivo} onResponder={responder} onVerLead={leadId => navigate(`/crm/lead/${leadId}`)} />
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: '#f5f7fa', color: '#bbb' }}>
          <div style={{ fontSize: 48 }}>📧</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#888' }}>Seleccioná un correo para leer</div>
          <div style={{ fontSize: 12, color: '#ccc' }}>o redactá uno nuevo</div>
          <button onClick={() => { setRedactarInicial(null); setShowRedactar(true) }} style={{ marginTop: 8, padding: '9px 22px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✉️ Redactar correo</button>
        </div>
      )}

      {/* ════════ PANEL DERECHO ════════ */}
      {emailActivo && (
        <div style={{ width: 260, borderLeft: '1px solid #e0e7ef', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>
          <div style={{ padding: '16px 14px', borderBottom: '1px solid #e8edf5' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 12 }}>Información</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <EmailAvatar nombre={emailActivo.contactoNombre || emailActivo.de} email={emailActivo.deEmail || emailActivo.de} size={42} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1a1a' }}>{emailActivo.contactoNombre || emailActivo.de || '—'}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{emailActivo.deEmail || emailActivo.de}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'Dirección', valor: emailActivo.direccion === 'entrada' ? '📥 Recibido' : '📤 Enviado' },
                { label: 'Estado',    valor: emailActivo.estado === 'no_leido' ? '🔵 No leído' : '✓ Leído' },
                { label: 'Fecha',     valor: formatFechaDetalle(emailActivo.fecha || emailActivo.creadoEn) },
              ].map(({ label, valor }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, gap: 8 }}>
                  <span style={{ color: '#8a99b3', flexShrink: 0 }}>{label}</span>
                  <span style={{ color: '#1a1a1a', fontWeight: 500, textAlign: 'right' }}>{valor || '—'}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: '12px 14px' }}>
            {emailActivo.leadId && <button onClick={() => navigate(`/crm/lead/${emailActivo.leadId}`)} style={{ width: '100%', padding: '8px', marginBottom: 8, background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>👤 Ver lead vinculado</button>}
            {emailActivo.contactoId && <button onClick={() => navigate(`/contactos/${emailActivo.contactoId}`)} style={{ width: '100%', padding: '8px', marginBottom: 8, background: 'transparent', color: '#555', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>👤 Ver contacto</button>}
            {emailActivo.direccion === 'entrada' && <button onClick={() => responder(emailActivo)} style={{ width: '100%', padding: '8px', background: 'transparent', color: '#185FA5', border: '1px solid #185FA5', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>↩ Responder</button>}
          </div>
          {emailActivo.adjuntos?.length > 0 && (
            <div style={{ padding: '0 14px 14px' }}>
              <div style={{ fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.6px', fontWeight: 700, marginBottom: 8 }}>Adjuntos</div>
              {emailActivo.adjuntos.map((adj, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#f8f9fc', borderRadius: 8, marginBottom: 5, border: '1px solid #e8ecf0' }}>
                  <span>📎</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{adj.nombre}</div>
                    {adj.tamaño > 0 && <div style={{ fontSize: 10, color: '#aaa' }}>{Math.round(adj.tamaño / 1024)} KB</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}