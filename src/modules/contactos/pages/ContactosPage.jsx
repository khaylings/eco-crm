/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: ContactosPage.jsx
 * Módulo:  Contactos + Empresas (unificado)
 * ============================================================
 */

import { useState, useEffect } from 'react'
import { obtenerContactos, eliminarContacto, obtenerEmpresas, eliminarEmpresa } from '../../../firebase/contactos'
import ContactoForm from '../components/ContactoForm'
import VerContacto from '../components/VerContacto'
import EmpresaForm from '../../empresas/components/EmpresaForm'
import VerEmpresa from '../../empresas/components/VerEmpresa'

export default function ContactosPage() {
  const [contactos, setContactos] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [filtro, setFiltro] = useState('')
  const [vista, setVista] = useState('todos') // 'todos' | 'contactos' | 'empresas'
  const [modal, setModal] = useState(null)
  const [vistaLayout, setVistaLayout] = useState('lista') // 'lista' | 'tarjetas'
  const [seleccionado, setSeleccionado] = useState(null)
  const [cargando, setCargando] = useState(true)

  const cargar = async () => {
    setCargando(true)
    const [ct, em] = await Promise.all([obtenerContactos(), obtenerEmpresas()])
    setContactos(ct)
    setEmpresas(em)
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  const q = filtro.toLowerCase()

  const contactosFilt = contactos.filter(c =>
    (c.nombre || '').toLowerCase().includes(q) || (c.telefono || '').includes(q) ||
    (c.correo || '').toLowerCase().includes(q) || (c.empresaNombre || '').toLowerCase().includes(q)
  )

  const empresasFilt = empresas.filter(e =>
    (e.nombre || '').toLowerCase().includes(q) || (e.nombreComercial || '').toLowerCase().includes(q) ||
    (e.razonSocial || '').toLowerCase().includes(q) || (e.ruc || '').includes(q) ||
    (e.sector || '').toLowerCase().includes(q)
  )

  const handleEliminarContacto = async (id) => {
    if (!confirm('¿Eliminar este contacto?')) return
    await eliminarContacto(id)
    cargar()
  }

  const handleEliminarEmpresa = async (id) => {
    if (!confirm('¿Eliminar esta empresa?')) return
    await eliminarEmpresa(id)
    cargar()
  }

  const totalItems = (vista === 'empresas' ? 0 : contactosFilt.length) + (vista === 'contactos' ? 0 : empresasFilt.length)

  return (
    <div>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.titulo}>Contactos & Empresas</h1>
          <p style={s.subtitulo}>{contactos.length} contactos · {empresas.length} empresas</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.btnPrimario} onClick={() => { setSeleccionado(null); setModal('nuevoContacto') }}>+ Contacto</button>
          <button style={{ ...s.btnPrimario, background: '#854F0B' }} onClick={() => { setSeleccionado(null); setModal('nuevaEmpresa') }}>+ Empresa</button>
        </div>
      </div>

      {/* Barra filtros */}
      <div style={s.barra}>
        <input style={s.buscador} placeholder="Buscar por nombre, empresa, teléfono, correo, RUC..."
          value={filtro} onChange={e => setFiltro(e.target.value)} />
        <div style={s.tabs}>
          {[
            { k: 'todos', l: `Todos (${totalItems})` },
            { k: 'contactos', l: `👤 Contactos (${contactosFilt.length})` },
            { k: 'empresas', l: `Empresas (${empresasFilt.length})` },
          ].map(t => (
            <button key={t.k} style={{ ...s.tab, ...(vista === t.k ? s.tabActivo : {}) }}
              onClick={() => setVista(t.k)}>{t.l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 2, marginLeft: 4 }}>
          <button onClick={() => setVistaLayout('lista')} title="Vista lista" style={{ padding: '6px 8px', border: '1.5px solid #dde3ed', borderRadius: '6px 0 0 6px', background: vistaLayout === 'lista' ? '#1a3a5c' : '#fff', color: vistaLayout === 'lista' ? '#fff' : '#888', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>☰</button>
          <button onClick={() => setVistaLayout('tarjetas')} title="Vista tarjetas" style={{ padding: '6px 8px', border: '1.5px solid #dde3ed', borderRadius: '0 6px 6px 0', borderLeft: 'none', background: vistaLayout === 'tarjetas' ? '#1a3a5c' : '#fff', color: vistaLayout === 'tarjetas' ? '#fff' : '#888', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>▦</button>
        </div>
      </div>

      {cargando ? (
        <p style={{ color: '#666', textAlign: 'center', marginTop: '2rem' }}>Cargando...</p>
      ) : totalItems === 0 ? (
        <div style={s.vacio}>
          <p style={{ fontSize: '2.5rem', margin: 0 }}>📋</p>
          <p style={{ color: '#666' }}>No hay resultados{filtro ? ' para ese filtro' : ''}.</p>
        </div>
      ) : vistaLayout === 'lista' ? (
          /* ═══ VISTA LISTA ═══ */
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #eef0f4', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#fafbfc', borderBottom: '1px solid #eef0f4' }}>
                  <th style={s.th}>Nombre</th>
                  <th style={s.th}>Tipo</th>
                  <th style={s.th}>Empresa</th>
                  <th style={s.th}>Teléfono</th>
                  <th style={s.th}>Correo</th>
                  <th style={s.th}></th>
                </tr>
              </thead>
              <tbody>
                {vista !== 'contactos' && empresasFilt.map(e => (
                  <tr key={`emp-${e.id}`} style={{ borderBottom: '1px solid #f5f5f5' }}
                    onMouseEnter={ev => ev.currentTarget.style.background = '#fafbfc'}
                    onMouseLeave={ev => ev.currentTarget.style.background = ''}>
                    <td style={s.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#854F0B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>🏢</div>
                        <span style={{ fontWeight: 600 }}>{e.nombre || e.nombreComercial || e.razonSocial}</span>
                      </div>
                    </td>
                    <td style={s.td}><span style={{ ...s.badge, backgroundColor: '#FAEEDA', color: '#854F0B' }}>Empresa</span></td>
                    <td style={{ ...s.td, color: '#888' }}>{e.sector || '—'}</td>
                    <td style={{ ...s.td, color: '#555' }}>{e.telefono || '—'}</td>
                    <td style={{ ...s.td, color: '#555' }}>{e.correo || e.email || '—'}</td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button onClick={() => { setSeleccionado(e); setModal('verEmpresa') }} style={s.btnSmList}>Ver</button>
                        <button onClick={() => { setSeleccionado(e); setModal('editarEmpresa') }} style={{ ...s.btnSmList, background: '#e8f0fe', color: '#1a3a5c' }}>Editar</button>
                        <button onClick={() => handleEliminarEmpresa(e.id)} style={{ ...s.btnSmList, background: '#fdecea', color: '#c62828' }}>×</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {vista !== 'empresas' && contactosFilt.map(c => (
                  <tr key={`ct-${c.id}`} style={{ borderBottom: '1px solid #f5f5f5' }}
                    onMouseEnter={ev => ev.currentTarget.style.background = '#fafbfc'}
                    onMouseLeave={ev => ev.currentTarget.style.background = ''}>
                    <td style={s.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#2e7d32', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{c.nombre?.charAt(0)?.toUpperCase() || '?'}</div>
                        <div>
                          <span style={{ fontWeight: 600 }}>{c.nombre}</span>
                          {c.cargo && <span style={{ fontSize: '0.75rem', color: '#888', marginLeft: 6 }}>{c.cargo}</span>}
                        </div>
                      </div>
                    </td>
                    <td style={s.td}><span style={{ ...s.badge, backgroundColor: '#e8f5e9', color: '#2e7d32' }}>Contacto</span></td>
                    <td style={{ ...s.td, color: '#555' }}>{c.empresaNombre || '—'}</td>
                    <td style={{ ...s.td, color: '#555' }}>{c.telefono || '—'}</td>
                    <td style={{ ...s.td, color: '#555' }}>{c.correo || '—'}</td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button onClick={() => { setSeleccionado(c); setModal('verContacto') }} style={s.btnSmList}>Ver</button>
                        <button onClick={() => { setSeleccionado(c); setModal('editarContacto') }} style={{ ...s.btnSmList, background: '#e8f0fe', color: '#1a3a5c' }}>Editar</button>
                        <button onClick={() => handleEliminarContacto(c.id)} style={{ ...s.btnSmList, background: '#fdecea', color: '#c62828' }}>×</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* ═══ VISTA TARJETAS ═══ */
          <div style={s.grid}>
            {vista !== 'contactos' && empresasFilt.map(e => (
              <div key={`emp-${e.id}`} style={{ ...s.tarjeta, borderLeft: '4px solid #854F0B' }}>
                <div style={s.tarjetaHeader}>
                  <div style={{ ...s.avatar, backgroundColor: '#854F0B' }}>🏢</div>
                  <div style={{ flex: 1 }}>
                    <div style={s.nombreTarjeta}>{e.nombre || e.nombreComercial || e.razonSocial}</div>
                    {e.sector && <div style={s.empresa}>{e.sector}</div>}
                    <span style={{ ...s.badge, backgroundColor: '#FAEEDA', color: '#854F0B' }}>Empresa</span>
                  </div>
                </div>
                <div style={s.datos}>
                  {(e.ruc || e.cedulaJuridica) && <span>🆔 {e.ruc || e.cedulaJuridica}</span>}
                  {e.telefono && <span>📞 {e.telefono}</span>}
                  {(e.correo || e.email) && <span>✉️ {e.correo || e.email}</span>}
                  {e.provincia && <span>📍 {e.provincia}</span>}
                </div>
                <div style={s.acciones}>
                  <button style={s.btnVer} onClick={() => { setSeleccionado(e); setModal('verEmpresa') }}>Ver</button>
                  <button style={s.btnEditar} onClick={() => { setSeleccionado(e); setModal('editarEmpresa') }}>Editar</button>
                  <button style={s.btnEliminar} onClick={() => handleEliminarEmpresa(e.id)}>×</button>
                </div>
              </div>
            ))}
            {vista !== 'empresas' && contactosFilt.map(c => (
              <div key={`ct-${c.id}`} style={{ ...s.tarjeta, borderLeft: '4px solid #2e7d32' }}>
                <div style={s.tarjetaHeader}>
                  <div style={{ ...s.avatar, backgroundColor: '#2e7d32' }}>
                    {c.nombre?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={s.nombreTarjeta}>{c.nombre}</div>
                    {c.empresaNombre && <div style={s.empresa}>🏢 {c.empresaNombre} {c.cargo && `· ${c.cargo}`}</div>}
                    <span style={{ ...s.badge, backgroundColor: '#e8f5e9', color: '#2e7d32' }}>Contacto</span>
                  </div>
                </div>
                <div style={s.datos}>
                  {c.telefono && <span>📞 {c.telefono}</span>}
                  {c.correo && <span>✉️ {c.correo}</span>}
                  {c.provincia && <span>📍 {c.provincia}</span>}
                </div>
                <div style={s.acciones}>
                  <button style={s.btnVer} onClick={() => { setSeleccionado(c); setModal('verContacto') }}>Ver</button>
                  <button style={s.btnEditar} onClick={() => { setSeleccionado(c); setModal('editarContacto') }}>Editar</button>
                  <button style={s.btnEliminar} onClick={() => handleEliminarContacto(c.id)}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}

      {/* Modales contacto */}
      {(modal === 'nuevoContacto' || modal === 'editarContacto') && (
        <ContactoForm contacto={modal === 'editarContacto' ? seleccionado : null}
          onClose={() => setModal(null)} onGuardado={() => { setModal(null); cargar() }} />
      )}
      {modal === 'verContacto' && seleccionado && (
        <VerContacto contacto={seleccionado} onClose={() => setModal(null)}
          onEditar={() => setModal('editarContacto')} onActualizar={cargar} />
      )}

      {/* Modales empresa */}
      {(modal === 'nuevaEmpresa' || modal === 'editarEmpresa') && (
        <EmpresaForm empresa={modal === 'editarEmpresa' ? seleccionado : null}
          onClose={() => setModal(null)} onGuardado={() => { setModal(null); cargar() }} />
      )}
      {modal === 'verEmpresa' && seleccionado && (
        <VerEmpresa empresa={seleccionado} onClose={() => setModal(null)}
          onEditar={() => setModal('editarEmpresa')} onActualizar={cargar} />
      )}
    </div>
  )
}

const s = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' },
  titulo: { fontSize: '1.6rem', fontWeight: 700, color: '#1a1a1a', margin: 0 },
  subtitulo: { color: '#666', margin: '0.25rem 0 0', fontSize: '0.9rem' },
  btnPrimario: { backgroundColor: '#1a3a5c', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.65rem 1.25rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'inherit' },
  barra: { display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' },
  buscador: { flex: 1, minWidth: '220px', padding: '0.6rem 1rem', border: '1.5px solid #dde3ed', borderRadius: '8px', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none' },
  tabs: { display: 'flex', gap: '0.5rem' },
  tab: { padding: '0.5rem 1rem', border: '1.5px solid #dde3ed', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '0.82rem', color: '#444', fontFamily: 'inherit' },
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
  btnVer: { flex: 1, padding: '0.4rem', border: '1.5px solid #1a3a5c', borderRadius: '6px', color: '#1a3a5c', background: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'inherit' },
  btnEditar: { flex: 1, padding: '0.4rem', border: 'none', borderRadius: '6px', backgroundColor: '#e8f0fe', color: '#1a3a5c', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'inherit' },
  btnEliminar: { padding: '0.4rem 0.75rem', border: 'none', borderRadius: '6px', backgroundColor: '#fdecea', color: '#c62828', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'inherit' },
  th: { padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', color: '#8a99b3', textTransform: 'uppercase', letterSpacing: '.5px' },
  td: { padding: '10px 14px', verticalAlign: 'middle', fontSize: '0.85rem' },
  btnSmList: { padding: '3px 10px', border: '1px solid #dde3ed', borderRadius: 5, fontSize: '0.75rem', cursor: 'pointer', background: '#fff', fontFamily: 'inherit', fontWeight: 600, color: '#555' },
}
