/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: WhatsAppConector.jsx
 * Módulo:  Configuracion
 * ============================================================
 */

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

const API_URL   = import.meta.env.VITE_WASENDER_API_URL   || 'https://wasenderapi.com/api'
const PAT       = import.meta.env.VITE_WASENDER_PERSONAL_TOKEN  // Personal Access Token
const SESSION_1 = import.meta.env.VITE_WASENDER_SESSION          // ID numérico de la sesión
const TOKEN_1   = import.meta.env.VITE_WASENDER_SESSION_TOKEN    // API Key de la sesión

// ── 3 slots de WhatsApp ─────────────────────────────────────────
const SLOTS = [
  { id: 1, label: 'WhatsApp Principal',  pat: PAT, session: SESSION_1, token: TOKEN_1 },
  { id: 2, label: 'WhatsApp Secundario', pat: import.meta.env.VITE_WASENDER_PAT_2, session: import.meta.env.VITE_WASENDER_SESSION_2, token: import.meta.env.VITE_WASENDER_TOKEN_2 },
  { id: 3, label: 'WhatsApp Tercero',    pat: import.meta.env.VITE_WASENDER_PAT_3, session: import.meta.env.VITE_WASENDER_SESSION_3, token: import.meta.env.VITE_WASENDER_TOKEN_3 },
]

// ── Componente de un slot individual ───────────────────────────
function SlotWhatsApp({ slot }) {
  const [estado, setEstado]           = useState('cargando')
  const [qrImagen, setQrImagen]       = useState(null)
  const [numero, setNumero]           = useState('')
  const [mensaje, setMensaje]         = useState('')
  const [enviando, setEnviando]       = useState(false)
  const [resultado, setResultado]     = useState('')
  const [cargando, setCargando]       = useState(false)
  const [desconectando, setDesconectando] = useState(false)

  const configurado = !!(slot.pat && slot.session)

  // Verificar estado de la sesión
  async function verificarEstado() {
    if (!configurado) { setEstado('no_configurado'); return }
    try {
      const res = await fetch(`${API_URL}/whatsapp-sessions/${slot.session}`, {
        headers: { 'Authorization': `Bearer ${slot.pat}` }
      })
      const data = await res.json()
      const status = data?.data?.status?.toLowerCase()
      setEstado(status === 'connected' ? 'conectado' : 'desconectado')
      return status === 'connected'
    } catch {
      setEstado('desconectado')
      return false
    }
  }

  // Conectar y obtener QR
  async function conectarYObtenerQR() {
    setCargando(true)
    setQrImagen(null)
    try {
      const res = await fetch(`${API_URL}/whatsapp-sessions/${slot.session}/connect`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${slot.pat}`, 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      const status = data?.data?.status?.toLowerCase()
      if (status === 'connected') {
        setEstado('conectado')
      } else if (data?.data?.qrCode) {
        const imgUrl = await QRCode.toDataURL(data.data.qrCode, { width: 220 })
        setQrImagen(imgUrl)
        setEstado('esperando_qr')
      } else {
        console.log('Respuesta connect:', JSON.stringify(data))
      }
    } catch (e) {
      console.error('Error conectando:', e)
    } finally {
      setCargando(false)
    }
  }

  // Desconectar
  async function desconectar() {
    if (!window.confirm(`¿Desconectar ${slot.label}? Dejarás de recibir mensajes de este número.`)) return
    setDesconectando(true)
    try {
      await fetch(`${API_URL}/whatsapp-sessions/${slot.session}/disconnect`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${slot.pat}`, 'Content-Type': 'application/json' }
      })
      setEstado('desconectado')
      setQrImagen(null)
    } catch (e) {
      console.error('Error desconectando:', e)
    } finally {
      setDesconectando(false)
    }
  }

  // Enviar mensaje de prueba — usa el session token (API Key)
  async function enviarMensajePrueba() {
    if (!numero || !mensaje) return
    setEnviando(true)
    setResultado('')
    try {
      const telefono = numero.replace(/[^0-9]/g, '')
      const res = await fetch(`${API_URL}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${slot.token}` },
        body: JSON.stringify({ to: `+${telefono}`, text: mensaje }),
      })
      const data = await res.json()
      setResultado(data?.success !== false ? '✅ Mensaje enviado' : '❌ Error: ' + (data?.message || 'desconocido'))
    } catch {
      setResultado('❌ Error de conexión')
    } finally {
      setEnviando(false)
    }
  }

  useEffect(() => {
    verificarEstado()
    if (!configurado) return
    const intervalo = setInterval(verificarEstado, 10000)
    return () => clearInterval(intervalo)
  }, [])

  const colorEstado = {
    conectado: '#3B6D11', desconectado: '#A32D2D',
    esperando_qr: '#854F0B', cargando: '#534AB7', no_configurado: '#888',
  }
  const textoEstado = {
    conectado: 'Conectado', desconectado: 'Desconectado',
    esperando_qr: 'Esperando escaneo...', cargando: 'Verificando...',
    no_configurado: 'No configurado',
  }
  const dotColor = {
    conectado: '#3B6D11', desconectado: '#A32D2D',
    esperando_qr: '#BA7517', cargando: '#534AB7', no_configurado: '#ccc',
  }

  return (
    <div style={{ background: '#fff', border: '0.5px solid var(--eco-border, #d0d8d0)', borderRadius: 'var(--eco-radius, 0px)', marginBottom: 14, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '0.5px solid var(--eco-border, #d0d8d0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: dotColor[estado], flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--eco-text, #1a1a1a)' }}>{slot.label}</div>
            <div style={{ fontSize: 11, color: colorEstado[estado], fontWeight: 500, marginTop: 2 }}>
              {textoEstado[estado]}
              {!configurado && ' — agrega las variables al .env'}
            </div>
          </div>
        </div>

        {configurado && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={verificarEstado} style={btnSec}>Actualizar</button>
            {estado === 'conectado' ? (
              <button onClick={desconectar} disabled={desconectando} style={btnDanger}>
                {desconectando ? 'Desconectando...' : 'Desconectar'}
              </button>
            ) : (
              <button onClick={conectarYObtenerQR} disabled={cargando} style={btnPrimary}>
                {cargando ? 'Conectando...' : 'Conectar / Ver QR'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* QR */}
      {configurado && estado !== 'conectado' && estado !== 'no_configurado' && (
        <div style={{ padding: '1.25rem', borderBottom: '0.5px solid var(--eco-border, #d0d8d0)', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 12 }}>
            Escanea el QR con tu WhatsApp Business
          </div>
          {qrImagen ? (
            <img src={qrImagen} alt="QR WhatsApp" style={{ width: 200, height: 200, borderRadius: 8, border: '0.5px solid var(--eco-border, #d0d8d0)' }} />
          ) : (
            <div style={{ width: 200, height: 200, margin: '0 auto', background: '#f5f7fa', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 12 }}>
              {cargando ? 'Generando QR...' : 'Presiona "Conectar / Ver QR"'}
            </div>
          )}
        </div>
      )}

      {/* No configurado */}
      {!configurado && (
        <div style={{ padding: '14px 18px', background: '#fafafa' }}>
          <p style={{ fontSize: 12, color: '#888' }}>Este slot no está configurado aún.</p>
        </div>
      )}

      {/* Enviar mensaje de prueba */}
      {configurado && estado === 'conectado' && (
        <div style={{ padding: '14px 18px' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--eco-text, #1a1a1a)', marginBottom: 12 }}>Enviar mensaje de prueba</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <div style={labelSt}>Número (con código de país)</div>
              <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="+50688887777" style={inputSt} />
            </div>
            <div>
              <div style={labelSt}>Mensaje</div>
              <input value={mensaje} onChange={e => setMensaje(e.target.value)} placeholder="Hola, esto es una prueba..." style={inputSt} />
            </div>
          </div>
          {resultado && (
            <div style={{ padding: '7px 12px', borderRadius: 7, marginBottom: 10, background: resultado.includes('✅') ? '#EAF3DE' : '#FCEBEB', color: resultado.includes('✅') ? '#3B6D11' : '#A32D2D', fontSize: 12 }}>
              {resultado}
            </div>
          )}
          <button onClick={enviarMensajePrueba} disabled={enviando} style={btnPrimary}>
            {enviando ? 'Enviando...' : 'Enviar mensaje'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Página principal ────────────────────────────────────────────
export default function WhatsAppConector() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px' }}>
      <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--eco-text, #1a1a1a)', marginBottom: 4 }}>
        WhatsApp Conectores
      </h2>
      <p style={{ color: 'var(--eco-muted, #888)', fontSize: 12, marginBottom: 20 }}>
        Conecta hasta 3 números de WhatsApp Business
      </p>
      {SLOTS.map(slot => (
        <SlotWhatsApp key={slot.id} slot={slot} />
      ))}
    </div>
  )
}

// ── Estilos compartidos ─────────────────────────────────────────
const btnPrimary = { padding: '7px 16px', background: 'var(--eco-primary, #1a3a5c)', color: '#fff', border: 'none', borderRadius: 'var(--eco-radius, 0px)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }
const btnSec     = { padding: '7px 14px', background: 'transparent', color: 'var(--eco-text, #1a1a1a)', border: '0.5px solid var(--eco-border, #d0d8d0)', borderRadius: 'var(--eco-radius, 0px)', fontSize: 12, cursor: 'pointer' }
const btnDanger  = { padding: '7px 14px', background: '#FCEBEB', color: '#A32D2D', border: '0.5px solid #f09595', borderRadius: 'var(--eco-radius, 0px)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }
const labelSt    = { fontSize: 10, fontWeight: 600, color: 'var(--eco-muted, #888)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }
const inputSt    = { width: '100%', padding: '7px 10px', border: '0.5px solid var(--eco-border, #d0d8d0)', borderRadius: 'var(--eco-radius, 0px)', fontSize: 12, outline: 'none', background: '#fff', boxSizing: 'border-box' }