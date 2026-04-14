/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: ChatWidget.jsx
 * Módulo:  Shared
 * ============================================================
 */

import { useState, useEffect, useRef } from 'react'
import {
  collection, query, orderBy, onSnapshot, doc,
  updateDoc, addDoc, deleteDoc, serverTimestamp, getDocs, where, getDoc
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { TabSolicitudes } from '../../modules/solicitudes/pages/SolicitudesPage'

const WASENDER_URL   = import.meta.env.VITE_WASENDER_API_URL || 'https://wasenderapi.com/api'
const WASENDER_TOKEN = import.meta.env.VITE_WASENDER_SESSION_TOKEN

function formatHora(ts) {
  if (!ts) return ''
  const d = ts?.toDate ? ts.toDate() : new Date(typeof ts === 'number' ? ts * 1000 : ts)
  const hoy = new Date()
  if (d.toDateString() === hoy.toDateString())
    return d.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function iniciales(nombre = '') {
  return nombre.split(' ').slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
}

function colorStr(str = '') {
  const cols = ['#185FA5', '#534AB7', '#0F6E56', '#993C1D', '#854F0B', '#A32D2D']
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return cols[Math.abs(h) % cols.length]
}

function Avatar({ nombre, foto, size = 34, interno = false }) {
  const color = colorStr(nombre || '')
  return foto
    ? <img src={foto} alt={nombre} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: interno ? '#0F6E56' : color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.36, flexShrink: 0 }}>
        {interno ? '💬' : iniciales(nombre)}
      </div>
}

// ── Ventana de chat individual ────────────────────────────────────────────────
function VentanaChat({ chat, tipo, usuarioActual, usuarios, onCerrar }) {
  const [mensajes, setMensajes] = useState([])
  const [texto,    setTexto]    = useState('')
  const [enviando, setEnviando] = useState(false)
  const bottomRef = useRef()
  const inputRef  = useRef()

  useEffect(() => {
    const col = tipo === 'wa'
      ? `conversaciones/${chat.id}/mensajes`
      : `chats_internos/${chat.id}/mensajes`
    const q = query(collection(db, col), orderBy('timestamp', 'asc'))
    const unsub = onSnapshot(q, snap => {
      setMensajes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    })
    // Marcar leído
    if (tipo === 'wa' && chat.noLeidos > 0) {
      updateDoc(doc(db, 'conversaciones', chat.id), { noLeidos: 0 }).catch(() => {})
    }
    if (tipo === 'interno') {
      const nl = chat.noLeidos || {}
      if (nl[usuarioActual?.uid] > 0) {
        updateDoc(doc(db, 'chats_internos', chat.id), { [`noLeidos.${usuarioActual.uid}`]: 0 }).catch(() => {})
      }
    }
    return unsub
  }, [chat.id, tipo])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const enviar = async () => {
    if (!texto.trim() || enviando) return
    setEnviando(true)
    const t = texto.trim()
    setTexto('')
    try {
      if (tipo === 'wa') {
        const tel = chat.telefono?.replace(/[^0-9]/g, '')
        const res = await fetch(`${WASENDER_URL}/send-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${WASENDER_TOKEN}` },
          body: JSON.stringify({ to: `+${tel}`, text: t }),
        })
        const data = await res.json()
        if (data?.success !== false) {
          await addDoc(collection(db, `conversaciones/${chat.id}/mensajes`), {
            body: t, fromMe: true, tipo: 'texto', timestamp: serverTimestamp(),
            autorNombre: usuarioActual?.nombre || 'Agente',
            autorFoto: usuarioActual?.fotoURL || null,
          })
          await updateDoc(doc(db, 'conversaciones', chat.id), {
            ultimoMensaje: t, timestamp: Math.floor(Date.now() / 1000),
          })
        }
      } else {
        await addDoc(collection(db, `chats_internos/${chat.id}/mensajes`), {
          body: t, autorId: usuarioActual?.uid,
          autorNombre: usuarioActual?.nombre || 'Agente',
          autorFoto: usuarioActual?.fotoURL || null,
          timestamp: serverTimestamp(),
        })
        const noLeidos = {}
        ;(chat.miembros || []).forEach(uid => {
          if (uid !== usuarioActual?.uid) noLeidos[`noLeidos.${uid}`] = (chat.noLeidos?.[uid] || 0) + 1
        })
        await updateDoc(doc(db, 'chats_internos', chat.id), {
          ultimoMensaje: t, ultimoMensajeEn: serverTimestamp(), ...noLeidos,
        })
      }
    } catch (e) { console.error(e) }
    finally { setEnviando(false) }
  }

  const nombresMiembros = (miembros = []) =>
    miembros.map(uid => uid === usuarioActual?.uid ? 'Tú' : usuarios.find(u => u.uid === uid)?.nombre || 'Usuario').join(', ')

  return (
    <div style={{
      width: 320, height: 420, background: '#fff',
      borderRadius: '12px 12px 0 0',
      boxShadow: '0 -4px 24px rgba(0,0,0,.18)',
      border: '0.5px solid rgba(0,0,0,.1)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: 'inherit',
    }}>
      {/* Header */}
      <div style={{ background: tipo === 'interno' ? '#0F6E56' : 'var(--eco-primary, #185FA5)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <Avatar nombre={chat.nombre} size={28} interno={tipo === 'interno'} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chat.nombre}</div>
          <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tipo === 'wa' ? chat.telefono : nombresMiembros(chat.miembros)}
          </div>
        </div>
        <button onClick={onCerrar} style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#fff', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>×</button>
      </div>

      {/* Mensajes */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 6px', display: 'flex', flexDirection: 'column', gap: 4, background: tipo === 'interno' ? '#f0faf6' : '#f0f4f8' }}>
        {mensajes.length === 0 && (
          <div style={{ textAlign: 'center', color: '#ccc', fontSize: 12, marginTop: 30 }}>Sin mensajes aún</div>
        )}
        {mensajes.map((msg, i) => {
          const esMio = tipo === 'wa' ? msg.fromMe : msg.autorId === usuarioActual?.uid
          return (
            <div key={msg.id || i} style={{ display: 'flex', justifyContent: esMio ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%', padding: '6px 10px',
                borderRadius: esMio ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                background: esMio ? (tipo === 'interno' ? '#0F6E56' : 'var(--eco-primary, #185FA5)') : '#fff',
                color: esMio ? '#fff' : '#1a1a1a',
                fontSize: 12, lineHeight: 1.5,
                boxShadow: '0 1px 2px rgba(0,0,0,.06)',
              }}>
                {!esMio && tipo === 'interno' && (
                  <div style={{ fontSize: 10, color: colorStr(msg.autorNombre || ''), fontWeight: 600, marginBottom: 2 }}>{msg.autorNombre}</div>
                )}
                <span>{msg.tipo === 'image' || msg.type === 'image' ? '📷 Imagen' : msg.tipo === 'audio' || msg.type === 'audio' ? '🎵 Audio' : msg.body}</span>
                <div style={{ fontSize: 9, opacity: 0.6, marginTop: 2, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                  {formatHora(msg.timestamp)}
                  {esMio && tipo === 'wa' && (
                    <span style={{ fontSize: 11, lineHeight: 1 }}>
                      {msg.leido === true
                        ? <span style={{ color: '#4FC3F7', fontWeight: 700 }}>✓✓</span>
                        : <span style={{ color: 'rgba(255,255,255,0.55)' }}>✓✓</span>
                      }
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '8px 10px', borderTop: '0.5px solid #e8ecf0', display: 'flex', gap: 6, background: '#fff', flexShrink: 0 }}>
        <input
          ref={inputRef}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar()}
          placeholder="Escribe un mensaje..."
          style={{ flex: 1, padding: '7px 10px', border: '0.5px solid #d0d8d0', borderRadius: 8, fontSize: 12, outline: 'none', fontFamily: 'inherit', background: '#f9f9f9' }}
        />
        <button onClick={enviar} disabled={!texto.trim() || enviando}
          style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: tipo === 'interno' ? '#0F6E56' : 'var(--eco-primary, #185FA5)', color: '#fff', cursor: !texto.trim() || enviando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: !texto.trim() ? 0.5 : 1, flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  )
}

// ── Widget principal ──────────────────────────────────────────────────────────
export default function ChatWidget({ onSonido }) {
  const { usuario, currentUser } = useAuth()
  const navigate = useNavigate()
  const usuarioActual = usuario || currentUser

  const [abierto,        setAbierto]        = useState(false)
  const [conversaciones, setConversaciones] = useState([])
  const [grupos,         setGrupos]         = useState([])
  const [usuarios,       setUsuarios]       = useState([])
  const [tab,            setTab]            = useState('todos') // 'todos' | 'chats' | 'internos' | 'solicitudes'
  const [pendientesSolicitudes, setPendientesSolicitudes] = useState(0)
  const [ventanas,       setVentanas]       = useState([]) // chats abiertos como ventana
  const [busqueda,       setBusqueda]       = useState('')
  const panelRef = useRef()

  useEffect(() => {
    getDocs(collection(db, 'usuarios')).then(snap => {
      setUsuarios(snap.docs.map(d => ({ uid: d.id, ...d.data() })))
    })
  }, [])

  // Refs para detectar mensajes nuevos
  const prevNoLeidosWARef  = useRef(-1)  // -1 = no inicializado
  const prevNoLeidosIntRef = useRef(-1)
  const iniciadoWA  = useRef(false)
  const iniciadoInt = useRef(false)

  // Conversaciones WA
  useEffect(() => {
    if (!usuarioActual?.uid) return
    const q = query(collection(db, 'conversaciones'), orderBy('timestamp', 'desc'))
    return onSnapshot(q, snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data(), _tipo: 'wa' }))
      const totalNoLeidos = lista.reduce((acc, c) => acc + (c.noLeidos || 0), 0)
      if (prevNoLeidosWARef.current === -1) {
        // Primera carga — guardar valor base sin sonar
        prevNoLeidosWARef.current = totalNoLeidos
      } else if (totalNoLeidos > prevNoLeidosWARef.current && onSonido) {
        onSonido()
        prevNoLeidosWARef.current = totalNoLeidos
      } else {
        prevNoLeidosWARef.current = totalNoLeidos
      }
      iniciadoWA.current = true
      setConversaciones(lista)
    })
  }, [usuarioActual?.uid, onSonido])

  // Grupos internos
  useEffect(() => {
    if (!usuarioActual?.uid) return
    const q = query(collection(db, 'chats_internos'), where('miembros', 'array-contains', usuarioActual.uid))
    return onSnapshot(q, snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data(), _tipo: 'interno' }))
      const totalNoLeidos = lista.reduce((acc, g) => acc + (g.noLeidos?.[usuarioActual.uid] || 0), 0)
      if (prevNoLeidosIntRef.current === -1) {
        prevNoLeidosIntRef.current = totalNoLeidos
      } else if (totalNoLeidos > prevNoLeidosIntRef.current && onSonido) {
        onSonido()
        prevNoLeidosIntRef.current = totalNoLeidos
      } else {
        prevNoLeidosIntRef.current = totalNoLeidos
      }
      iniciadoInt.current = true
      setGrupos(lista)
    })
  }, [usuarioActual?.uid, onSonido])

  // Cerrar panel al hacer clic afuera
  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Lista combinada y filtrada
  const lista = (() => {
    const wa = conversaciones.filter(c => {
      if (tab === 'internos') return false
      if (busqueda && !c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) && !c.telefono?.includes(busqueda)) return false
      return true
    })
    const int = grupos.filter(g => {
      if (tab === 'chats') return false
      if (busqueda && !g.nombre?.toLowerCase().includes(busqueda.toLowerCase())) return false
      return true
    })
    const getTs = (item) => {
      if (item._tipo === 'interno') {
        const ts = item.ultimoMensajeEn
        if (!ts) return 0
        if (ts?.toDate) return ts.toDate().getTime()
        if (ts?.seconds) return ts.seconds * 1000
        return new Date(ts).getTime()
      }
      const ts = item.timestamp
      if (!ts) return 0
      if (typeof ts === 'number') return ts * 1000
      if (ts?.seconds) return ts.seconds * 1000
      if (ts?.toDate) return ts.toDate().getTime()
      return 0
    }
    if (tab === 'chats') return [...wa].sort((a, b) => getTs(b) - getTs(a))
    if (tab === 'internos') return [...int].sort((a, b) => getTs(b) - getTs(a))
    return [...int, ...wa].sort((a, b) => getTs(b) - getTs(a))
  })()

  // Total no leídos
  const noLeidosWA  = conversaciones.reduce((acc, c) => acc + (c.noLeidos || 0), 0)
  const noLeidosInt = grupos.reduce((acc, g) => acc + (g.noLeidos?.[usuarioActual?.uid] || 0), 0)
  const totalNoLeidos = noLeidosWA + noLeidosInt

  // Abrir ventana de chat
  const abrirVentana = (item) => {
    setAbierto(false)
    const yaAbierto = ventanas.find(v => v.id === item.id && v._tipo === item._tipo)
    if (!yaAbierto) {
      setVentanas(prev => [...prev.slice(-2), item]) // máximo 3 ventanas
    }
  }

  const cerrarVentana = (id, tipo) => {
    setVentanas(prev => prev.filter(v => !(v.id === id && v._tipo === tipo)))
  }

  const noLeidosItem = (item) => item._tipo === 'interno'
    ? (item.noLeidos?.[usuarioActual?.uid] || 0)
    : (item.noLeidos || 0)

  return (
    <>
      {/* ── Ventanas de chat abiertas ── */}
      <div style={{ position: 'fixed', bottom: 0, right: 70, display: 'flex', gap: 12, alignItems: 'flex-end', zIndex: 10001, pointerEvents: 'none' }}>
        {ventanas.map(chat => (
          <div key={`${chat._tipo}-${chat.id}`} style={{ pointerEvents: 'all' }}>
            <VentanaChat
              chat={chat}
              tipo={chat._tipo}
              usuarioActual={usuarioActual}
              usuarios={usuarios}
              onCerrar={() => cerrarVentana(chat.id, chat._tipo)}
            />
          </div>
        ))}
      </div>

      {/* ── Panel flotante ── */}
      <div ref={panelRef} style={{ position: 'fixed', bottom: 0, right: 16, zIndex: 10002 }}>

        {/* Panel de lista */}
        {abierto && (
          <div style={{
            position: 'absolute', bottom: 56, right: 0,
            width: 320, height: 480,
            background: '#fff', borderRadius: 14,
            boxShadow: '0 8px 40px rgba(0,0,0,.2)',
            border: '0.5px solid rgba(0,0,0,.1)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            fontFamily: 'inherit',
          }}>
            {/* Header del panel */}
            <div style={{ padding: '12px 14px', borderBottom: '0.5px solid #e8ecf0', background: '#fafafa', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>Mensajes</span>
                {tab !== 'solicitudes' && (
                  <button onClick={() => navigate('/chats')}
                    style={{ fontSize: 11, color: 'var(--eco-primary, #185FA5)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                    Ver todos →
                  </button>
                )}
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {[
                  { key: 'todos',        label: 'Todos',       badge: totalNoLeidos },
                  { key: 'chats',        label: '📱 WA',       badge: noLeidosWA },
                  { key: 'internos',     label: '💬 Internos', badge: noLeidosInt },
                  { key: 'solicitudes',  label: '🐛 Soporte',  badge: pendientesSolicitudes },
                  ...(usuario?.rol === 'Super Administrador' ? [{ key: 'anuncios', label: '📢 Anuncios', badge: 0 }] : []),
                ].map(t => (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    style={{ flex: 1, padding: '5px 4px', border: 'none', fontSize: 11, fontWeight: 600, borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', position: 'relative',
                      background: tab === t.key ? 'var(--eco-primary, #185FA5)' : '#f0f2f5',
                      color: tab === t.key ? '#fff' : '#666',
                    }}>
                    {t.label}
                    {t.badge > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: '#E24B4A', color: '#fff', fontSize: 8, fontWeight: 700, padding: '0 3px', borderRadius: 8, minWidth: 14, textAlign: 'center', lineHeight: '14px' }}>{t.badge}</span>}
                  </button>
                ))}
              </div>

              {/* Buscador — oculto en tab Solicitudes */}
              {tab !== 'solicitudes' && tab !== 'anuncios' && (
                <div style={{ position: 'relative' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <circle cx="11" cy="11" r="8" stroke="#bbb" strokeWidth="2"/><path d="M21 21l-4.35-4.35" stroke="#bbb" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar..."
                    style={{ width: '100%', padding: '6px 10px 6px 26px', border: '0.5px solid #e0e0e0', borderRadius: 8, fontSize: 12, outline: 'none', background: '#f7f8fa', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
              )}
            </div>

            {/* Contenido — conversaciones o tab Solicitudes */}
            {tab === 'anuncios' ? (
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <TabAnuncios usuario={usuario} />
              </div>
            ) : tab === 'solicitudes' ? (
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <TabSolicitudes onPendientesChange={setPendientesSolicitudes} />
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {lista.length === 0 && (
                  <div style={{ padding: '30px 20px', textAlign: 'center', color: '#bbb', fontSize: 13 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
                    Sin conversaciones
                  </div>
                )}
                {lista.map(item => {
                  const esInt    = item._tipo === 'interno'
                  const noLeidos = noLeidosItem(item)
                  const ts       = esInt ? item.ultimoMensajeEn : item.timestamp
                  return (
                    <div key={`${item._tipo}-${item.id}`}
                      onClick={() => abrirVentana(item)}
                      style={{ display: 'flex', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: '0.5px solid #f5f6f8', alignItems: 'center', background: '#fff', transition: 'background .1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                      <Avatar nombre={item.nombre} size={36} interno={esInt} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                          <span style={{ fontWeight: noLeidos > 0 ? 700 : 600, fontSize: 13, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{item.nombre}</span>
                          <span style={{ fontSize: 10, color: '#bbb', flexShrink: 0, marginLeft: 4 }}>{formatHora(ts)}</span>
                        </div>
                        <div style={{ fontSize: 11, color: noLeidos > 0 ? '#555' : '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: noLeidos > 0 ? 500 : 400 }}>
                          {esInt && <span style={{ color: '#0F6E56', marginRight: 3 }}>💬</span>}
                          {!esInt && item.ultimoMensaje && (
                            <span style={{ fontSize: 11, marginRight: 2, color: '#aaa' }}>✓✓</span>
                          )}
                          {item.ultimoMensaje || '...'}
                        </div>
                      </div>
                      {noLeidos > 0 && (
                        <span style={{ background: esInt ? '#0F6E56' : 'var(--eco-primary, #185FA5)', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 700, flexShrink: 0 }}>{noLeidos}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Footer — oculto en tab Solicitudes */}
            {tab !== 'solicitudes' && (
              <div style={{ padding: '10px 14px', borderTop: '0.5px solid #e8ecf0', background: '#fafafa', flexShrink: 0, textAlign: 'center' }}>
                <span style={{ fontSize: 11, color: '#bbb' }}>{lista.length} conversación{lista.length !== 1 ? 'es' : ''}</span>
              </div>
            )}
          </div>
        )}

        {/* Botón flotante */}
        <button onClick={() => setAbierto(o => !o)}
          title="Mensajes"
          style={{
            width: 46, height: 46, borderRadius: '50%',
            background: abierto ? 'var(--eco-primary, #185FA5)' : 'var(--eco-primary, #185FA5)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,.25)',
            position: 'relative', transition: 'transform .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
          {abierto
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          }
          {totalNoLeidos > 0 && !abierto && (
            <span style={{ position: 'absolute', top: -4, right: -4, background: '#E24B4A', color: '#fff', fontSize: 9, fontWeight: 700, padding: '0 4px', borderRadius: 10, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
              {totalNoLeidos > 99 ? '99+' : totalNoLeidos}
            </span>
          )}
        </button>
      </div>
    </>
  )
}

// ─── Tab Anuncios (solo Super Admin) ─────────────────────────────────────────
function TabAnuncios({ usuario }) {
  const [anuncios, setAnuncios] = useState([])
  const [mensaje, setMensaje] = useState('')
  const [version, setVersion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mejorando, setMejorando] = useState(false)
  const [msg, setMsg] = useState('')
  const [vista, setVista] = useState('form') // 'form' | 'historial'

  useEffect(() => {
    const q = query(collection(db, 'anuncios'), orderBy('creadoEn', 'desc'))
    return onSnapshot(q, snap => setAnuncios(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [])

  const mejorarConIA = async () => {
    if (!mensaje.trim()) return
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY
    if (!geminiKey) { setMsg('⚠️ Falta VITE_GEMINI_API_KEY'); return }
    setMejorando(true)
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `Reescribí este texto como un anuncio interno para el equipo de trabajo que usa un CRM.

Texto original:
${mensaje}

Instrucciones estrictas:
- Escribí en español latinoamericano, tuteando
- SIEMPRE incluí 2-3 emojis relevantes en el texto (al inicio de párrafos o ideas clave)
- Empezá directo con lo que se hizo, sin saludos ni "Hemos implementado"
- Explicá el beneficio concreto para el usuario en palabras simples
- Usá un tono cercano como si le hablaras a un compañero de trabajo
- Máximo 4-5 líneas
- Devolvé ÚNICAMENTE el texto reescrito, sin comillas, sin explicaciones, sin "Aquí tienes"` }] }],
            generationConfig: { maxOutputTokens: 1024, temperature: 0.5 },
          }),
        }
      )
      const data = await res.json()
      const texto = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (texto) setMensaje(texto.trim())
    } catch { setMsg('Error al conectar con IA') }
    finally { setMejorando(false) }
  }

  const publicar = async () => {
    if (!mensaje.trim()) { setMsg('El mensaje es obligatorio'); return }
    setGuardando(true)
    try {
      const tituloFijo = version.trim() ? `🚀 Equipo, nueva actualización v${version.trim()}` : '🚀 Equipo, nueva actualización'
      await addDoc(collection(db, 'anuncios'), {
        titulo: tituloFijo, mensaje: mensaje.trim(), version: version.trim() || null,
        autorId: usuario?.uid, autorNombre: usuario?.nombre || usuario?.email || 'Admin',
        autorFoto: usuario?.fotoURL || null, activo: true, leidoPor: [], creadoEn: serverTimestamp(),
      })
      setMensaje(''); setVersion('')
      setMsg('✓ Publicado'); setTimeout(() => setMsg(''), 2500)
    } catch { setMsg('Error al publicar') }
    finally { setGuardando(false) }
  }

  const desactivar = async (id) => await updateDoc(doc(db, 'anuncios', id), { activo: false })
  const reactivar = async (id) => await updateDoc(doc(db, 'anuncios', id), { activo: true, leidoPor: [] })
  const eliminar = async (id) => { if (confirm('¿Eliminar anuncio?')) await deleteDoc(doc(db, 'anuncios', id)) }

  const inp = { width: '100%', padding: '6px 8px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Tabs internas */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #eee', flexShrink: 0 }}>
        {[{ key: 'form', label: '+ Nuevo' }, { key: 'historial', label: `Historial (${anuncios.length})` }].map(t => (
          <button key={t.key} onClick={() => setVista(t.key)} style={{ flex: 1, padding: '8px 0', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: vista === t.key ? '#fff' : '#f5f6f8', color: vista === t.key ? '#185FA5' : '#888', borderBottom: vista === t.key ? '2px solid #185FA5' : '2px solid transparent' }}>{t.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {vista === 'form' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 9, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 3 }}>Versión (opcional)</label>
              <input value={version} onChange={e => setVersion(e.target.value)} placeholder="Ej: 2.1" style={inp} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <label style={{ fontSize: 9, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.5px' }}>Mensaje *</label>
                <button onClick={mejorarConIA} disabled={mejorando || !mensaje.trim()} style={{ fontSize: 10, border: 'none', background: mejorando ? '#eee' : '#EEF3FA', color: mejorando ? '#aaa' : '#185FA5', cursor: mejorando ? 'not-allowed' : 'pointer', padding: '2px 8px', borderRadius: 5, fontWeight: 600, fontFamily: 'inherit' }}>
                  {mejorando ? '⟳ ...' : '✨ IA'}
                </button>
              </div>
              <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} rows={4} placeholder="Escribí el anuncio..." style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} />
            </div>

            {/* Preview mini */}
            {mensaje && (
              <div style={{ background: '#f8f9fb', borderRadius: 8, padding: 10, border: '1px dashed #d0d8e0' }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', marginBottom: 6 }}>Preview</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  {usuario?.fotoURL
                    ? <img src={usuario.fotoURL} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                    : <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#185FA5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{(usuario?.nombre || '?')[0]?.toUpperCase()}</div>
                  }
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#1a1a1a' }}>{usuario?.nombre || 'Admin'}</span>
                </div>
                <div style={{ fontSize: 11, color: '#555', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{mensaje?.slice(0, 200)}{mensaje?.length > 200 ? '...' : ''}</div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={publicar} disabled={guardando || !mensaje.trim()} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: guardando ? '#ccc' : '#185FA5', color: '#fff', fontSize: 12, fontWeight: 600, cursor: guardando ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {guardando ? '...' : '📢 Publicar'}
              </button>
              {msg && <span style={{ fontSize: 11, color: msg.startsWith('✓') ? '#3B6D11' : '#A32D2D', fontWeight: 500 }}>{msg}</span>}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {anuncios.length === 0 && <div style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: 20 }}>Sin anuncios</div>}
            {anuncios.map(a => (
              <div key={a.id} style={{ background: '#fff', borderRadius: 8, border: '1px solid #eee', padding: '10px 12px', opacity: a.activo === false ? 0.5 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>{a.titulo}</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {a.activo !== false
                      ? <button onClick={() => desactivar(a.id)} style={{ fontSize: 9, border: 'none', background: '#f5f6f8', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', color: '#888', fontFamily: 'inherit' }}>Off</button>
                      : <button onClick={() => reactivar(a.id)} style={{ fontSize: 9, border: 'none', background: '#EEF3FA', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', color: '#185FA5', fontFamily: 'inherit' }}>On</button>
                    }
                    <button onClick={() => eliminar(a.id)} style={{ fontSize: 9, border: 'none', background: '#FCEBEB', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', color: '#A32D2D', fontFamily: 'inherit' }}>✕</button>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>
                  {a.creadoEn?.toDate ? a.creadoEn.toDate().toLocaleDateString('es-CR', { day: '2-digit', month: 'short' }) : ''} · {(a.leidoPor || []).length} leídos
                </div>
                <div style={{ fontSize: 11, color: '#555', lineHeight: 1.5 }}>{a.mensaje?.slice(0, 100)}{a.mensaje?.length > 100 ? '...' : ''}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}