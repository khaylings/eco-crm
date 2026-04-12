/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: ModalNudge.jsx
 * Módulo:  CRM — Chats internos
 * ============================================================
 */

import { useEffect, useState } from 'react'

const NUDGE_IMG_URL   = 'https://firebasestorage.googleapis.com/v0/b/eco-crm-da4eb.firebasestorage.app/o/assets%2Fmsn-nudge.png?alt=media&token=51c498c6-360d-4822-bfd9-4705cb3fe659'
const NUDGE_AUDIO_URL = 'https://firebasestorage.googleapis.com/v0/b/eco-crm-da4eb.firebasestorage.app/o/assets%2Fnudge-nudge-msn.mp3?alt=media&token=51c498c6-360d-4822-bfd9-4705cb3fe659'

// Props:
//   nudgeData  = { autorNombre, mensaje }
//   chatNombre = nombre del chat donde llegó el zumbido
//   onCerrar   = función que cierra el modal

export default function ModalNudge({ nudgeData, chatNombre, onCerrar }) {
  const [shake, setShake] = useState(true)

  useEffect(() => {
    // Reproducir audio al montar
    try {
      const audio = new Audio(NUDGE_AUDIO_URL)
      audio.play().catch(() => {})
    } catch(e) {}

    // Detener shake después de 5 ciclos (~2.5s)
    const t = setTimeout(() => setShake(false), 2500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)',
    }}>
      <div style={{
        background: 'linear-gradient(145deg, #dff0ff 0%, #c2e0ff 50%, #dff0ff 100%)',
        border: '2.5px solid #5aabff',
        borderRadius: 20,
        padding: '32px 36px',
        maxWidth: 360,
        width: '90%',
        textAlign: 'center',
        boxShadow: '0 30px 90px rgba(0,100,255,0.3), 0 0 0 1px rgba(90,171,255,0.4)',
        animation: shake ? 'nudgeShake 0.35s ease-in-out 0s 5' : 'none',
      }}>

        {/* Imagen MSN animada */}
        <div style={{ marginBottom: 18 }}>
          <img
            src={NUDGE_IMG_URL}
            alt="nudge"
            style={{
              width: 100, height: 100, objectFit: 'contain',
              animation: shake
                ? 'nudgeBounce 0.35s ease-in-out 0s 5'
                : 'nudgeFloat 3s ease-in-out infinite',
              filter: 'drop-shadow(0 6px 16px rgba(0,100,255,0.35))',
            }}
          />
        </div>

        {/* Título */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1a5fa8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
          📳 ¡Zumbido!
        </div>

        {/* Quién lo envió */}
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0d3b6e', marginBottom: 4 }}>
          {nudgeData?.autorNombre || 'Alguien'}
        </div>
        <div style={{ fontSize: 13, color: '#2a6090', marginBottom: 16 }}>
          te envió un zumbido en <strong>{chatNombre}</strong>
        </div>

        {/* Burbuja con el mensaje */}
        <div style={{
          background: 'rgba(255,255,255,0.75)',
          border: '1px solid rgba(90,171,255,0.5)',
          borderRadius: 12,
          padding: '10px 16px',
          fontSize: 13,
          color: '#333',
          marginBottom: 22,
          fontStyle: 'italic',
          lineHeight: 1.5,
        }}>
          {nudgeData?.mensaje || '📳 envió un zumbido'}
        </div>

        {/* Botón cerrar */}
        <button
          onClick={onCerrar}
          style={{
            background: 'linear-gradient(135deg, #185FA5 0%, #0d3b6e 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '11px 32px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 4px 16px rgba(24,95,165,0.45)',
            transition: 'transform .1s, box-shadow .1s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.05)'
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(24,95,165,0.55)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(24,95,165,0.45)'
          }}
        >
          Cerrar
        </button>
      </div>

      <style>{`
        @keyframes nudgeShake {
          0%,100% { transform: translate(0,0) rotate(0deg); }
          15%     { transform: translate(-14px,-4px) rotate(-4deg); }
          30%     { transform: translate(14px, 4px) rotate( 4deg); }
          45%     { transform: translate(-10px,-2px) rotate(-2deg); }
          60%     { transform: translate(10px, 2px) rotate( 2deg); }
          75%     { transform: translate(-5px,-1px) rotate(-1deg); }
          90%     { transform: translate( 5px, 1px) rotate( 1deg); }
        }
        @keyframes nudgeBounce {
          0%,100% { transform: translateY(0)    scale(1);    }
          30%     { transform: translateY(-22px) scale(1.12); }
          60%     { transform: translateY(-10px) scale(1.06); }
        }
        @keyframes nudgeFloat {
          0%,100% { transform: translateY(0px);  }
          50%     { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  )
}