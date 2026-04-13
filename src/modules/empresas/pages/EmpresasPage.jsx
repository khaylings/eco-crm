/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: EmpresasPage.jsx
 * Módulo:  Empresas
 * ============================================================
 */

import { useState, useEffect } from 'react'
import { obtenerEmpresas, eliminarEmpresa } from '../../../firebase/contactos'
import EmpresaForm from '../components/EmpresaForm'
import VerEmpresa from '../components/VerEmpresa'

export default function EmpresasPage() {
  const [empresas, setEmpresas] = useState([])
  const [filtro, setFiltro] = useState('')
  const [modal, setModal] = useState(null)
  const [seleccionada, setSeleccionada] = useState(null)
  const [cargando, setCargando] = useState(true)

  const cargar = async () => {
    setCargando(true)
    const data = await obtenerEmpresas()
    setEmpresas(data)
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  const filtradas = empresas.filter(e => {
    const q = filtro.toLowerCase()
    return (e.nombre || '').toLowerCase().includes(q) ||
      (e.nombreComercial || '').toLowerCase().includes(q) ||
      (e.razonSocial || '').toLowerCase().includes(q) ||
      (e.sector || '').toLowerCase().includes(q) ||
      (e.ruc || '').includes(q)
  })

  const s = estilos

  return (
    <div>
      <div style={s.header}>
        <div>
          <h1 style={s.titulo}>Empresas</h1>
          <p style={s.subtitulo}>{empresas.length} empresa{empresas.length !== 1 ? 's' : ''} registrada{empresas.length !== 1 ? 's' : ''}</p>
        </div>
        <button style={s.btnPrimario} onClick={() => { setSeleccionada(null); setModal('nuevo') }}>+ Nueva empresa</button>
      </div>

      <input style={s.buscador} placeholder="Buscar empresa o sector..." value={filtro} onChange={e => setFiltro(e.target.value)} />

      {cargando ? (
        <p style={{ color: '#666', textAlign: 'center', marginTop: '2rem' }}>Cargando...</p>
      ) : filtradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
          <p style={{ fontSize: '2.5rem', margin: 0 }}>🏢</p>
          <p>No hay empresas registradas.</p>
        </div>
      ) : (
        <div style={s.grid}>
          {filtradas.map(e => (
            <div key={e.id} style={s.tarjeta}>
              <div style={s.tarjetaTop}>
                <div style={s.iconoEmpresa}>🏢</div>
                <div>
                  <div style={s.nombreEmpresa}>{e.nombre}</div>
                  {e.sector && <div style={s.sector}>{e.sector}</div>}
                </div>
              </div>
              <div style={s.datos}>
                {e.telefono && <span>📞 {e.telefono}</span>}
                {e.correo && <span>✉️ {e.correo}</span>}
                {e.provincia && <span>📍 {e.provincia}</span>}
              </div>
              <div style={s.acciones}>
                <button style={s.btnVer} onClick={() => { setSeleccionada(e); setModal('ver') }}>Ver</button>
                <button style={s.btnEditar} onClick={() => { setSeleccionada(e); setModal('editar') }}>Editar</button>
                <button style={s.btnEliminar} onClick={async () => { if(confirm('¿Eliminar empresa?')) { await eliminarEmpresa(e.id); cargar() } }}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(modal === 'nuevo' || modal === 'editar') && (
        <EmpresaForm empresa={seleccionada} onClose={() => setModal(null)} onGuardado={() => { setModal(null); cargar() }} />
      )}
      {modal === 'ver' && seleccionada && (
        <VerEmpresa empresa={seleccionada} onClose={() => setModal(null)} onEditar={() => setModal('editar')} onActualizar={cargar} />
      )}
    </div>
  )
}

const estilos = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' },
  titulo: { fontSize: '1.6rem', fontWeight: 700, color: '#1a1a1a', margin: 0 },
  subtitulo: { color: '#666', margin: '0.25rem 0 0', fontSize: '0.9rem' },
  btnPrimario: { backgroundColor: '#1a3a5c', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.65rem 1.25rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' },
  buscador: { width: '100%', padding: '0.6rem 1rem', border: '1.5px solid #dde3ed', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '1.5rem', boxSizing: 'border-box' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' },
  tarjeta: { backgroundColor: '#fff', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #eef0f4' },
  tarjetaTop: { display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '0.75rem' },
  iconoEmpresa: { fontSize: '1.5rem', flexShrink: 0 },
  nombreEmpresa: { fontWeight: 700, color: '#1a1a1a', fontSize: '0.95rem' },
  sector: { fontSize: '0.78rem', color: '#1a3a5c', fontWeight: 600, backgroundColor: '#e3f2fd', padding: '0.15rem 0.5rem', borderRadius: '20px', display: 'inline-block', marginTop: '0.2rem' },
  datos: { display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.82rem', color: '#555', marginBottom: '0.75rem' },
  acciones: { display: 'flex', gap: '0.5rem', borderTop: '1px solid #f0f0f0', paddingTop: '0.75rem' },
  btnVer: { flex: 1, padding: '0.4rem', border: '1.5px solid #1a3a5c', borderRadius: '6px', color: '#1a3a5c', background: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 },
  btnEditar: { flex: 1, padding: '0.4rem', border: 'none', borderRadius: '6px', backgroundColor: '#e8f0fe', color: '#1a3a5c', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 },
  btnEliminar: { padding: '0.4rem 0.75rem', border: 'none', borderRadius: '6px', backgroundColor: '#fdecea', color: '#c62828', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 },
}