/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: Conectores.jsx
 * Módulo:  Configuracion
 * ============================================================
 */

import { useNavigate } from 'react-router-dom'

const conectores = [
  {
    id: 'whatsapp',
    nombre: 'WhatsApp Business',
    descripcion: 'Conecta tu número de WhatsApp Business para enviar mensajes desde el CRM',
    icono: '💬',
    ruta: '/configuracion/conectores/whatsapp',
    color: '#25D366',
  },
]

export default function Conectores() {
  const navigate = useNavigate()

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.8rem', color: '#1a3a5c', marginBottom: '0.25rem' }}>
        Conectores
      </h1>
      <p style={{ color: '#666', marginBottom: '2rem', fontSize: '0.9rem' }}>
        Integra canales de comunicación con tu CRM
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
        {conectores.map((c) => (
          <div
            key={c.id}
            onClick={() => navigate(c.ruta)}
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              cursor: 'pointer',
              border: '2px solid transparent',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.border = `2px solid ${c.color}`}
            onMouseLeave={e => e.currentTarget.style.border = '2px solid transparent'}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{c.icono}</div>
            <h3 style={{ fontWeight: 700, color: '#1a3a5c', marginBottom: '0.4rem' }}>{c.nombre}</h3>
            <p style={{ fontSize: '0.85rem', color: '#666', lineHeight: 1.5 }}>{c.descripcion}</p>
            <div style={{ marginTop: '1rem', fontSize: '0.8rem', fontWeight: 600, color: c.color }}>
              Configurar →
            </div>
          </div>
        ))}

        {/* Tarjeta agregar más */}
        <div style={{
          backgroundColor: '#f0f4f8',
          borderRadius: '12px',
          padding: '1.5rem',
          border: '2px dashed #c5d1dc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '160px',
          color: '#999',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>+</div>
          <p style={{ fontSize: '0.85rem' }}>Más conectores próximamente</p>
        </div>
      </div>
    </div>
  )
}