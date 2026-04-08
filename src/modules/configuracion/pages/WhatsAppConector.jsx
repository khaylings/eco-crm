import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useNavigate } from 'react-router-dom'

const socket = io('http://https://eco-whatsapp-backend-production.up.railway.app')

export default function WhatsAppConector() {
  const [estado, setEstado] = useState('desconectado')
  const [qr, setQr] = useState(null)
  const [numero, setNumero] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    socket.on('estado', (e) => setEstado(e))
    socket.on('qr', (qrImg) => setQr(qrImg))
    return () => { socket.off('estado'); socket.off('qr') }
  }, [])

  const conectar = async () => {
    await fetch('http://https://eco-whatsapp-backend-production.up.railway.app/conectar', { method: 'POST' })
  }

  const desconectar = async () => {
    await fetch('http://https://eco-whatsapp-backend-production.up.railway.app/desconectar', { method: 'POST' })
    setQr(null)
  }

  const enviarMensaje = async () => {
    if (!numero || !mensaje) return
    setEnviando(true)
    try {
      const res = await fetch('http://https://eco-whatsapp-backend-production.up.railway.app/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero, mensaje })
      })
      const data = await res.json()
      setResultado(data.ok ? '✅ Mensaje enviado' : '❌ Error: ' + data.error)
    } catch {
      setResultado('❌ Error de conexión')
    } finally {
      setEnviando(false)
    }
  }

  const colorEstado = { conectado: '#2e7d32', esperando_qr: '#f57c00', desconectado: '#c62828' }[estado] || '#666'
  const textoEstado = { conectado: '🟢 Conectado', esperando_qr: '🟡 Esperando QR', desconectado: '🔴 Desconectado' }[estado] || estado

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
        <button onClick={() => navigate('/configuracion/conectores')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1e5799', fontSize: '0.9rem', fontWeight: 600, padding: 0 }}>
          ← Conectores
        </button>
      </div>
      <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.8rem', color: '#1a3a5c', marginBottom: '0.25rem' }}>
        💬 WhatsApp Business
      </h1>
      <p style={{ color: '#666', marginBottom: '2rem', fontSize: '0.9rem' }}>
        Conecta tu número y envía mensajes directamente desde el CRM
      </p>

      {/* ESTADO */}
      <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem' }}>Estado</p>
            <p style={{ fontWeight: 700, color: colorEstado, fontSize: '1rem' }}>{textoEstado}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {estado === 'desconectado' && (
              <button onClick={conectar} style={{ padding: '0.65rem 1.25rem', backgroundColor: '#25D366', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                Conectar
              </button>
            )}
            {estado !== 'desconectado' && (
              <button onClick={desconectar} style={{ padding: '0.65rem 1.25rem', backgroundColor: '#c62828', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                Desconectar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* QR */}
      {qr && estado !== 'conectado' && (
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a3a5c', marginBottom: '0.5rem' }}>
            📱 Escanea con WhatsApp Business
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
            WhatsApp → Dispositivos vinculados → Vincular dispositivo
          </p>
          <img src={qr} alt="QR" style={{ width: '250px', height: '250px', border: '4px solid #f0f4f8', borderRadius: '12px' }} />
        </div>
      )}

      {/* ENVIAR */}
      {estado === 'conectado' && (
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a3a5c', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '2px solid #f0f4f8' }}>
            ✉️ Enviar mensaje de prueba
          </h2>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#1a3a5c', marginBottom: '0.3rem' }}>
              Número (con código de país, ej: 50688887777)
            </label>
            <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="50688887777"
              style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1.5px solid #dde3ed', borderRadius: '8px', fontSize: '0.9rem' }} />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#1a3a5c', marginBottom: '0.3rem' }}>Mensaje</label>
            <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Escribe tu mensaje..." rows={4}
              style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1.5px solid #dde3ed', borderRadius: '8px', fontSize: '0.9rem', resize: 'vertical' }} />
          </div>
          {resultado && (
            <div style={{ padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', backgroundColor: resultado.includes('✅') ? '#f0fff4' : '#fff0f0', color: resultado.includes('✅') ? '#2e7d32' : '#c62828', fontSize: '0.85rem' }}>
              {resultado}
            </div>
          )}
          <button onClick={enviarMensaje} disabled={enviando}
            style={{ padding: '0.75rem 1.5rem', backgroundColor: enviando ? '#93afd4' : '#1e5799', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: enviando ? 'not-allowed' : 'pointer' }}>
            {enviando ? 'Enviando...' : 'Enviar mensaje'}
          </button>
        </div>
      )}
    </div>
  )
}