/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: ContactosPage.jsx
 * Módulo:  Contactos
 * ============================================================
 */

import { useState, useEffect } from 'react'
import { obtenerContactos, eliminarContacto } from '../../../firebase/contactos'
import ContactoForm from '../components/ContactoForm'
import VerContacto from '../components/VerContacto'

export default function ContactosPage() {
  const [contactos, setContactos] = useState([])
  const [filtro, setFiltro] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('todos')
  const [modal, setModal] = useState(null) // null | 'nuevo' | 'editar' | 'ver'
  const [seleccionado, setSeleccionado] = useState(null)
  const [cargando, setCargando] = useState(true)

  const cargar = async () => {
    setCargando(true)
    const data = await obtenerContactos()
    setContactos(data)
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  const filtrados = contactos.filter(c => {
    const textoOk = c.nombre?.toLowerCase().includes(filtro.toLowerCase()) ||
      c.telefono?.includes(filtro) || c.correo?.toLowerCase().includes(filtro.toLowerCase())
    const tipoOk = tipoFiltro === 'todos' || c.tipo === tipoFiltro
    return textoOk && tipoOk
  })

  const handleEliminar = async (id) => {
    if (!confirm('¿Eliminar este contacto?')) return
    await eliminarContacto(id)
    cargar()
  }

  const s = estilos

  return (
    <div>
      <div style={s.header}>
        <div>
          <h1 style={s.titulo}>Contactos</h1>
          <p style={s.subtitulo}>{contactos.length} contacto{contactos.length !== 1 ? 's' : ''} registrado{contactos.length !== 1 ? 's' : ''}</p>
        </div>
        <button style={s.btnPrimario} onClick={() => { setSeleccionado(null); setModal('nuevo') }}>
          + Nuevo contacto
        </button>
      </div>

      <div style={s.barra}>
        <input
          style={s.buscador}
          placeholder="Buscar por nombre, teléfono o correo..."
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
        />
        <div style={s.tabs}>
          {['todos', 'persona', 'empresa'].map(t => (
            <button key={t} style={{ ...s.tab, ...(tipoFiltro === t ? s.tabActivo : {}) }}
              onClick={() => setTipoFiltro(t)}>
              {t === 'todos' ? 'Todos' : t === 'persona' ? '👤 Persona' : '🏢 Empresa'}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <p style={{ color: '#666', textAlign: 'center', marginTop: '2rem' }}>Cargando...</p>
      ) : filtrados.length === 0 ? (
        <div style={s.vacio}>
          <p style={{ fontSize: '2.5rem', margin: 0 }}>👤</p>
          <p style={{ color: '#666' }}>No hay contactos{filtro ? ' con ese filtro' : ''}.</p>
        </div>
      ) : (
        <div style={s.grid}>
          {filtrados.map(c => (
            <div key={c.id} style={s.tarjeta}>
              <div style={s.tarjetaHeader}>
                <div style={{ ...s.avatar, backgroundColor: c.tipo === 'empresa' ? '#1a3a5c' : '#2e7d32' }}>
                  {c.nombre?.charAt(0)?.toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={s.nombreTarjeta}>{c.nombre}</div>
                  {c.tipo === 'empresa' && c.empresaNombre && (
                    <div style={s.empresa}>🏢 {c.empresaNombre} {c.cargo && `· ${c.cargo}`}</div>
                  )}
                  <span style={{ ...s.badge, backgroundColor: c.tipo === 'empresa' ? '#e3f2fd' : '#e8f5e9', color: c.tipo === 'empresa' ? '#1565c0' : '#2e7d32' }}>
                    {c.tipo === 'empresa' ? 'Representante' : 'Persona natural'}
                  </span>
                </div>
              </div>
              <div style={s.datos}>
                {c.telefono && <span>📞 {c.telefono}</span>}
                {c.correo && <span>✉️ {c.correo}</span>}
                {c.provincia && <span>📍 {c.provincia}</span>}
              </div>
              <div style={s.acciones}>
                <button style={s.btnVer} onClick={() => { setSeleccionado(c); setModal('ver') }}>Ver</button>
                <button style={s.btnEditar} onClick={() => { setSeleccionado(c); setModal('editar') }}>Editar</button>
                <button style={s.btnEliminar} onClick={() => handleEliminar(c.id)}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(modal === 'nuevo' || modal === 'editar') && (
        <ContactoForm
          contacto={seleccionado}
          onClose={() => setModal(null)}
          onGuardado={() => { setModal(null); cargar() }}
        />
      )}

      {modal === 'ver' && seleccionado && (
        <VerContacto
          contacto={seleccionado}
          onClose={() => setModal(null)}
          onEditar={() => setModal('editar')}
          onActualizar={cargar}
        />
      )}
    </div>
  )
}

const estilos = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' },
  titulo: { fontSize: '1.6rem', fontWeight: 700, color: '#1a1a1a', margin: 0 },
  subtitulo: { color: '#666', margin: '0.25rem 0 0', fontSize: '0.9rem' },
  btnPrimario: { backgroundColor: '#1a3a5c', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.65rem 1.25rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' },
  barra: { display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' },
  buscador: { flex: 1, minWidth: '220px', padding: '0.6rem 1rem', border: '1.5px solid #dde3ed', borderRadius: '8px', fontSize: '0.9rem' },
  tabs: { display: 'flex', gap: '0.5rem' },
  tab: { padding: '0.5rem 1rem', border: '1.5px solid #dde3ed', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', color: '#444' },
  tabActivo: { backgroundColor: '#1a3a5c', color: '#fff', borderColor: '#1a3a5c' },
  vacio: { textAlign: 'center', padding: '3rem', color: '#999' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' },
  tarjeta: { backgroundColor: '#fff', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #eef0f4' },
  tarjetaHeader: { display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'flex-start' },
  avatar: { width: '42px', height: '42px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '1.1rem', flexShrink: 0 },
  nombreTarjeta: { fontWeight: 700, color: '#1a1a1a', fontSize: '0.95rem', marginBottom: '0.2rem' },
  empresa: { fontSize: '0.78rem', color: '#555', marginBottom: '0.3rem' },
  badge: { fontSize: '0.72rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '20px', display: 'inline-block' },
  datos: { display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.82rem', color: '#555', marginBottom: '0.75rem' },
  acciones: { display: 'flex', gap: '0.5rem', borderTop: '1px solid #f0f0f0', paddingTop: '0.75rem' },
  btnVer: { flex: 1, padding: '0.4rem', border: '1.5px solid #1a3a5c', borderRadius: '6px', color: '#1a3a5c', background: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 },
  btnEditar: { flex: 1, padding: '0.4rem', border: 'none', borderRadius: '6px', backgroundColor: '#e8f0fe', color: '#1a3a5c', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 },
  btnEliminar: { padding: '0.4rem 0.75rem', border: 'none', borderRadius: '6px', backgroundColor: '#fdecea', color: '#c62828', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 },
}