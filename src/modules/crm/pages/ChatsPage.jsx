import { useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'

const socket = io('http://https://eco-whatsapp-backend-production.up.railway.app')

const etiquetas = [
  { valor: '', label: 'Sin etiqueta', color: '#999' },
  { valor: 'cliente_nuevo', label: 'Cliente nuevo', color: '#1e5799' },
  { valor: 'cotizacion', label: 'Cotización', color: '#f57c00' },
  { valor: 'soporte', label: 'Soporte', color: '#c62828' },
  { valor: 'seguimiento', label: 'Seguimiento', color: '#7b1fa2' },
  { valor: 'cerrado', label: 'Cerrado', color: '#2e7d32' },
]

function formatHora(timestamp) {
  if (!timestamp) return ''
  const d = new Date(timestamp * 1000)
  return d.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })
}

function formatFecha(timestamp) {
  if (!timestamp) return ''
  const d = new Date(timestamp * 1000)
  const hoy = new Date()
  if (d.toDateString() === hoy.toDateString()) return formatHora(timestamp)
  return d.toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit' })
}

export default function ChatsPage() {
  const [conversaciones, setConversaciones] = useState([])
  const [chatActivo, setChatActivo] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [estadoWA, setEstadoWA] = useState('desconectado')
  const mensajesRef = useRef(null)

  useEffect(() => {
    socket.on('estado', setEstadoWA)
    socket.on('conversaciones', (data) => {
      const ordenadas = [...data].sort((a, b) => b.timestamp - a.timestamp)
      setConversaciones(ordenadas)
      if (chatActivo) {
        const actualizado = ordenadas.find(c => c.id === chatActivo.id)
        if (actualizado) setChatActivo(actualizado)
      }
    })
    socket.on('mensaje_nuevo', ({ chatId, mensaje: msg }) => {
      setConversaciones(prev => {
        const nuevas = prev.map(c => {
          if (c.id === chatId) {
            return { ...c, mensajes: [...(c.mensajes || []), msg], ultimoMensaje: msg.body, timestamp: msg.timestamp }
          }
          return c
        }).sort((a, b) => b.timestamp - a.timestamp)
        return nuevas
      })
      setChatActivo(prev => {
        if (prev?.id === chatId) {
          return { ...prev, mensajes: [...(prev.mensajes || []), msg] }
        }
        return prev
      })
    })
    return () => { socket.off('estado'); socket.off('conversaciones'); socket.off('mensaje_nuevo') }
  }, [chatActivo])

  useEffect(() => {
    if (mensajesRef.current) {
      mensajesRef.current.scrollTop = mensajesRef.current.scrollHeight
    }
  }, [chatActivo?.mensajes])

  const enviar = async () => {
    if (!mensaje.trim() || !chatActivo) return
    setEnviando(true)
    try {
      await fetch('http://https://eco-whatsapp-backend-production.up.railway.app/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero: chatActivo.telefono, mensaje })
      })
      setMensaje('')
    } catch (e) { console.error(e) }
    finally { setEnviando(false) }
  }

  const actualizarConversacion = async (campo, valor) => {
    if (!chatActivo) return
    await fetch(`http://https://eco-whatsapp-backend-production.up.railway.app/conversacion/${encodeURIComponent(chatActivo.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [campo]: valor })
    })
    setChatActivo(prev => ({ ...prev, [campo]: valor }))
  }

  const conversacionesFiltradas = conversaciones.filter(c =>
    c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.telefono?.includes(busqueda)
  )

  const etiquetaActiva = etiquetas.find(e => e.valor === chatActivo?.etiqueta) || etiquetas[0]

  if (estadoWA !== 'conectado') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem' }}>
        <div style={{ fontSize: '3rem' }}>💬</div>
        <h2 style={{ color: '#1a3a5c', fontFamily: 'Syne, sans-serif' }}>WhatsApp no conectado</h2>
        <p style={{ color: '#666' }}>Ve a Conectores → WhatsApp Business para conectar</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 4rem)', gap: '0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 20px rgba(0,0,0,0.08)' }}>

      {/* LISTA DE CONVERSACIONES */}
      <div style={{ width: '300px', backgroundColor: '#fff', borderRight: '1px solid #e8edf2', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #e8edf2' }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.1rem', color: '#1a3a5c', marginBottom: '0.75rem' }}>Chats</h2>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar conversación..."
            style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1.5px solid #dde3ed', borderRadius: '8px', fontSize: '0.85rem' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {conversacionesFiltradas.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#999', fontSize: '0.85rem' }}>
              No hay conversaciones
            </div>
          )}
          {conversacionesFiltradas.map(conv => {
            const etiq = etiquetas.find(e => e.valor === conv.etiqueta)
            const activo = chatActivo?.id === conv.id
            return (
              <div key={conv.id} onClick={() => setChatActivo(conv)}
                style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #f0f4f8', cursor: 'pointer', backgroundColor: activo ? '#f0f4f8' : '#fff', borderLeft: activo ? '3px solid #4caf50' : '3px solid transparent', transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1a1a1a' }}>{conv.nombre}</span>
                  <span style={{ fontSize: '0.72rem', color: '#999' }}>{formatFecha(conv.timestamp)}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '0.25rem' }}>
                  {conv.ultimoMensaje}
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  {etiq && etiq.valor && (
                    <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: etiq.color + '20', color: etiq.color, fontWeight: 600 }}>
                      {etiq.label}
                    </span>
                  )}
                  {conv.noLeidos > 0 && (
                    <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '10px', backgroundColor: '#4caf50', color: '#fff', fontWeight: 700, marginLeft: 'auto' }}>
                      {conv.noLeidos}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* CHAT */}
      {chatActivo ? (
        <>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f0f4f8' }}>
            <div style={{ padding: '1rem 1.25rem', backgroundColor: '#fff', borderBottom: '1px solid #e8edf2', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#1a3a5c', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '1rem' }}>
                {chatActivo.nombre?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1a1a1a' }}>{chatActivo.nombre}</div>
                <div style={{ fontSize: '0.78rem', color: '#666' }}>+{chatActivo.telefono}</div>
              </div>
            </div>

            <div ref={mensajesRef} style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(chatActivo.mensajes || []).map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.fromMe ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '65%', padding: '0.6rem 0.9rem', borderRadius: msg.fromMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px', backgroundColor: msg.fromMe ? '#1e5799' : '#fff', color: msg.fromMe ? '#fff' : '#1a1a1a', fontSize: '0.88rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                    <div>{msg.body}</div>
                    <div style={{ fontSize: '0.68rem', opacity: 0.7, textAlign: 'right', marginTop: '0.2rem' }}>{formatHora(msg.timestamp)}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fff', borderTop: '1px solid #e8edf2', display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
              <textarea value={mensaje} onChange={e => setMensaje(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                placeholder="Escribe un mensaje... (Enter para enviar)"
                rows={1}
                style={{ flex: 1, padding: '0.65rem 0.9rem', border: '1.5px solid #dde3ed', borderRadius: '8px', fontSize: '0.9rem', resize: 'none', fontFamily: 'DM Sans, sans-serif' }} />
              <button onClick={enviar} disabled={enviando}
                style={{ padding: '0.65rem 1.1rem', backgroundColor: '#1e5799', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
                ➤
              </button>
            </div>
          </div>

          {/* PANEL DERECHO */}
          <div style={{ width: '260px', backgroundColor: '#fff', borderLeft: '1px solid #e8edf2', padding: '1.25rem', overflowY: 'auto', flexShrink: 0 }}>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#1a3a5c', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '1.4rem', margin: '0 auto 0.5rem' }}>
                {chatActivo.nombre?.charAt(0)?.toUpperCase()}
              </div>
              <div style={{ fontWeight: 700, color: '#1a1a1a' }}>{chatActivo.nombre}</div>
              <div style={{ fontSize: '0.82rem', color: '#666' }}>+{chatActivo.telefono}</div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#1a3a5c', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Etiqueta</label>
              <select value={chatActivo.etiqueta || ''} onChange={e => actualizarConversacion('etiqueta', e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1.5px solid #dde3ed', borderRadius: '8px', fontSize: '0.85rem', color: etiquetaActiva.color, fontWeight: 600 }}>
                {etiquetas.map(e => (
                  <option key={e.valor} value={e.valor}>{e.label}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#1a3a5c', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Asignar a</label>
              <input value={chatActivo.asignado || ''} onChange={e => actualizarConversacion('asignado', e.target.value)}
                placeholder="Nombre del agente"
                style={{ width: '100%', padding: '0.5rem', border: '1.5px solid #dde3ed', borderRadius: '8px', fontSize: '0.85rem' }} />
            </div>

            <button style={{ width: '100%', padding: '0.65rem', backgroundColor: '#2e7d32', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
              + Crear lead en CRM
            </button>
          </div>
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f4f8', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontSize: '3rem' }}>💬</div>
          <p style={{ color: '#666', fontSize: '0.95rem' }}>Selecciona una conversación</p>
        </div>
      )}
    </div>
  )
}