/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: VerContacto.jsx
 * Módulo:  Contactos
 * ============================================================
 */

import { useState, useEffect } from 'react'
import { obtenerActivosPorPropietario, crearActivo, eliminarActivo, crearServicio, obtenerServicios, eliminarServicio } from '../../../firebase/contactos'

const TIPOS_EQUIPO = ['Mini Split', 'Cassette', 'Piso techo', 'Ventana', 'Chiller', 'Fan Coil', 'Manejadora', 'Condensadora', 'Otro']
const TIPOS_SERVICIO = ['Instalación', 'Mantenimiento preventivo', 'Mantenimiento correctivo', 'Reparación', 'Diagnóstico', 'Garantía']
const ESTADOS_EQUIPO = ['Operativo', 'En mantenimiento', 'Fuera de servicio', 'En garantía']

export default function VerContacto({ contacto, onClose, onEditar, onActualizar }) {
  const [tab, setTab] = useState('info')
  const [activos, setActivos] = useState([])
  const [activoSeleccionado, setActivoSeleccionado] = useState(null)
  const [servicios, setServicios] = useState([])
  const [modalActivo, setModalActivo] = useState(false)
  const [modalServicio, setModalServicio] = useState(false)
  const [formActivo, setFormActivo] = useState({ tipo: '', marca: '', modelo: '', capacidadBTU: '', nroSerie: '', ubicacion: '', fechaInstalacion: '', garantiaHasta: '', estado: 'Operativo', observaciones: '' })
  const [formServicio, setFormServicio] = useState({ fecha: '', tipo: '', tecnico: '', descripcion: '' })
  const [guardando, setGuardando] = useState(false)

  const cargarActivos = async () => {
    const data = await obtenerActivosPorPropietario('contacto', contacto.id)
    setActivos(data)
  }

  const cargarServicios = async (activoId) => {
    const data = await obtenerServicios(activoId)
    setServicios(data)
  }

  useEffect(() => { cargarActivos() }, [])

  const setA = (k, v) => setFormActivo(f => ({ ...f, [k]: v }))
  const setS = (k, v) => setFormServicio(f => ({ ...f, [k]: v }))

  const guardarActivo = async () => {
    if (!formActivo.tipo) return alert('Selecciona el tipo de equipo')
    setGuardando(true)
    await crearActivo({ ...formActivo, propietarioTipo: 'contacto', propietarioId: contacto.id, propietarioNombre: contacto.nombre })
    setGuardando(false)
    setModalActivo(false)
    setFormActivo({ tipo: '', marca: '', modelo: '', capacidadBTU: '', nroSerie: '', ubicacion: '', fechaInstalacion: '', garantiaHasta: '', estado: 'Operativo', observaciones: '' })
    cargarActivos()
  }

  const guardarServicio = async () => {
    if (!formServicio.fecha || !formServicio.tipo) return alert('Fecha y tipo son requeridos')
    setGuardando(true)
    await crearServicio(activoSeleccionado.id, formServicio)
    setGuardando(false)
    setModalServicio(false)
    setFormServicio({ fecha: '', tipo: '', tecnico: '', descripcion: '' })
    cargarServicios(activoSeleccionado.id)
  }

  const verHistorial = (activo) => {
    setActivoSeleccionado(activo)
    cargarServicios(activo.id)
    setTab('historial')
  }

  const s = estilos

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ ...s.avatar, backgroundColor: contacto.tipo === 'empresa' ? '#1a3a5c' : '#2e7d32' }}>
              {contacto.nombre?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{contacto.nombre}</h2>
              {contacto.tipo === 'empresa' && contacto.empresaNombre && (
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#666' }}>🏢 {contacto.empresaNombre} {contacto.cargo && `· ${contacto.cargo}`}</p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button style={s.btnEditar} onClick={onEditar}>Editar</button>
            <button style={s.btnCerrar} onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={s.tabs}>
          {['info', 'activos', 'historial'].map(t => (
            <button key={t} style={{ ...s.tab, ...(tab === t ? s.tabActivo : {}) }} onClick={() => setTab(t)}>
              {t === 'info' ? 'Información' : t === 'activos' ? `Equipos (${activos.length})` : 'Historial de servicios'}
            </button>
          ))}
        </div>

        <div style={s.cuerpo}>
          {/* TAB: INFO */}
          {tab === 'info' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {[
                ['Tipo', contacto.tipo === 'empresa' ? 'Representante de empresa' : 'Persona natural'],
                ['Teléfono', contacto.telefono],
                ['WhatsApp', contacto.whatsapp],
                ['Correo', contacto.correo],
                ['Provincia', contacto.provincia],
                ['Empresa', contacto.empresaNombre],
                ['Cargo', contacto.cargo],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} style={s.infoItem}>
                  <span style={s.infoLabel}>{k}</span>
                  <span style={s.infoValor}>{v}</span>
                </div>
              ))}
              {contacto.etiquetas?.length > 0 && (
                <div style={{ gridColumn: '1/-1', ...s.infoItem }}>
                  <span style={s.infoLabel}>Etiquetas</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                    {contacto.etiquetas.map(e => <span key={e} style={s.etiqueta}>{e}</span>)}
                  </div>
                </div>
              )}
              {contacto.notas && (
                <div style={{ gridColumn: '1/-1', ...s.infoItem }}>
                  <span style={s.infoLabel}>Notas</span>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#333', lineHeight: 1.5 }}>{contacto.notas}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB: ACTIVOS */}
          {tab === 'activos' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <p style={{ margin: 0, color: '#666', fontSize: '0.88rem' }}>Equipos de aire acondicionado registrados</p>
                <button style={s.btnAgregar} onClick={() => setModalActivo(true)}>+ Agregar equipo</button>
              </div>
              {activos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
                  <p style={{ fontSize: '2rem', margin: 0 }}>❄️</p>
                  <p>Sin equipos registrados</p>
                </div>
              ) : activos.map(a => (
                <div key={a.id} style={s.activoCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#1a1a1a', fontSize: '0.95rem' }}>❄️ {a.tipo} {a.marca && `· ${a.marca}`} {a.modelo && a.modelo}</div>
                      {a.capacidadBTU && <div style={{ fontSize: '0.82rem', color: '#555' }}>{a.capacidadBTU} BTU</div>}
                      {a.ubicacion && <div style={{ fontSize: '0.82rem', color: '#555' }}>📍 {a.ubicacion}</div>}
                      {a.nroSerie && <div style={{ fontSize: '0.82rem', color: '#888' }}>S/N: {a.nroSerie}</div>}
                    </div>
                    <span style={{ ...s.estadoBadge, backgroundColor: a.estado === 'Operativo' ? '#e8f5e9' : '#fff3e0', color: a.estado === 'Operativo' ? '#2e7d32' : '#e65100' }}>
                      {a.estado}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <button style={s.btnHistorial} onClick={() => verHistorial(a)}>Ver historial</button>
                    <button style={s.btnEliminarSmall} onClick={async () => { if(confirm('¿Eliminar equipo?')) { await eliminarActivo(a.id); cargarActivos() } }}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB: HISTORIAL */}
          {tab === 'historial' && (
            <div>
              {activoSeleccionado ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, color: '#1a1a1a' }}>❄️ {activoSeleccionado.tipo} {activoSeleccionado.marca} {activoSeleccionado.modelo}</p>
                      <button style={{ background: 'none', border: 'none', color: '#1a3a5c', cursor: 'pointer', fontSize: '0.82rem', padding: 0 }} onClick={() => setTab('activos')}>← Volver a equipos</button>
                    </div>
                    <button style={s.btnAgregar} onClick={() => setModalServicio(true)}>+ Registrar servicio</button>
                  </div>
                  {servicios.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
                      <p style={{ fontSize: '2rem', margin: 0 }}>🔧</p>
                      <p>Sin servicios registrados</p>
                    </div>
                  ) : servicios.map(sv => (
                    <div key={sv.id} style={s.servicioCard}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={s.servicioBadge}>{sv.tipo}</span>
                        <span style={{ fontSize: '0.8rem', color: '#888' }}>{sv.fecha}</span>
                      </div>
                      {sv.tecnico && <div style={{ fontSize: '0.85rem', color: '#555', marginTop: '0.35rem' }}>🔧 {sv.tecnico}</div>}
                      {sv.descripcion && <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#333', lineHeight: 1.5 }}>{sv.descripcion}</p>}
                      <button style={{ ...s.btnEliminarSmall, marginTop: '0.5rem' }} onClick={async () => { if(confirm('¿Eliminar servicio?')) { await eliminarServicio(activoSeleccionado.id, sv.id); cargarServicios(activoSeleccionado.id) } }}>Eliminar</button>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
                  <p>Selecciona un equipo desde la pestaña "Equipos" para ver su historial.</p>
                  <button style={s.btnAgregar} onClick={() => setTab('activos')}>Ver equipos</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL ACTIVO */}
        {modalActivo && (
          <div style={s.subOverlay}>
            <div style={s.subModal}>
              <div style={s.header}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Agregar equipo AC</h3>
                <button style={s.btnCerrar} onClick={() => setModalActivo(false)}>✕</button>
              </div>
              <div style={{ padding: '1.25rem', overflowY: 'auto', maxHeight: '60vh' }}>
                {[
                  { label: 'Tipo de equipo *', key: 'tipo', tipo: 'select', opciones: TIPOS_EQUIPO },
                  { label: 'Marca', key: 'marca', placeholder: 'Ej: Carrier, Daikin, LG' },
                  { label: 'Modelo', key: 'modelo', placeholder: 'Ej: 40MBFQ12' },
                  { label: 'Capacidad (BTU)', key: 'capacidadBTU', placeholder: 'Ej: 12000' },
                  { label: 'Nro. de serie', key: 'nroSerie', placeholder: 'S/N del equipo' },
                  { label: 'Ubicación en sitio', key: 'ubicacion', placeholder: 'Ej: Oficina principal, 2do piso' },
                  { label: 'Fecha de instalación', key: 'fechaInstalacion', tipo: 'date' },
                  { label: 'Garantía hasta', key: 'garantiaHasta', tipo: 'date' },
                  { label: 'Estado', key: 'estado', tipo: 'select', opciones: ESTADOS_EQUIPO },
                  { label: 'Observaciones', key: 'observaciones', tipo: 'textarea' },
                ].map(({ label, key, tipo, placeholder, opciones }) => (
                  <div key={key} style={{ marginBottom: '0.85rem' }}>
                    <label style={estilos.label}>{label}</label>
                    {tipo === 'select' ? (
                      <select style={estilos.input} value={formActivo[key]} onChange={e => setA(key, e.target.value)}>
                        <option value="">— Seleccionar —</option>
                        {opciones.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : tipo === 'textarea' ? (
                      <textarea style={{ ...estilos.input, minHeight: '70px', resize: 'vertical' }} value={formActivo[key]} onChange={e => setA(key, e.target.value)} placeholder={placeholder} />
                    ) : (
                      <input style={estilos.input} type={tipo || 'text'} value={formActivo[key]} onChange={e => setA(key, e.target.value)} placeholder={placeholder} />
                    )}
                  </div>
                ))}
              </div>
              <div style={s.pie}>
                <button style={estilos.btnCancelar} onClick={() => setModalActivo(false)}>Cancelar</button>
                <button style={estilos.btnGuardar} onClick={guardarActivo} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar equipo'}</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL SERVICIO */}
        {modalServicio && (
          <div style={s.subOverlay}>
            <div style={{ ...s.subModal, maxWidth: '420px' }}>
              <div style={s.header}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Registrar servicio</h3>
                <button style={s.btnCerrar} onClick={() => setModalServicio(false)}>✕</button>
              </div>
              <div style={{ padding: '1.25rem' }}>
                {[
                  { label: 'Fecha *', key: 'fecha', tipo: 'date' },
                  { label: 'Tipo de servicio *', key: 'tipo', tipo: 'select', opciones: TIPOS_SERVICIO },
                  { label: 'Técnico responsable', key: 'tecnico', placeholder: 'Nombre del técnico' },
                  { label: 'Descripción / observaciones', key: 'descripcion', tipo: 'textarea' },
                ].map(({ label, key, tipo, placeholder, opciones }) => (
                  <div key={key} style={{ marginBottom: '0.85rem' }}>
                    <label style={estilos.label}>{label}</label>
                    {tipo === 'select' ? (
                      <select style={estilos.input} value={formServicio[key]} onChange={e => setS(key, e.target.value)}>
                        <option value="">— Seleccionar —</option>
                        {opciones.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : tipo === 'textarea' ? (
                      <textarea style={{ ...estilos.input, minHeight: '80px', resize: 'vertical' }} value={formServicio[key]} onChange={e => setS(key, e.target.value)} placeholder={placeholder} />
                    ) : (
                      <input style={estilos.input} type={tipo || 'text'} value={formServicio[key]} onChange={e => setS(key, e.target.value)} placeholder={placeholder} />
                    )}
                  </div>
                ))}
              </div>
              <div style={s.pie}>
                <button style={estilos.btnCancelar} onClick={() => setModalServicio(false)}>Cancelar</button>
                <button style={estilos.btnGuardar} onClick={guardarServicio} disabled={guardando}>{guardando ? 'Guardando...' : 'Registrar'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const estilos = {
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' },
  subOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px', zIndex: 10 },
  modal: { backgroundColor: '#fff', borderRadius: '16px', width: '100%', maxWidth: '680px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', position: 'relative' },
  subModal: { backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '540px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid #eee', flexShrink: 0 },
  tabs: { display: 'flex', borderBottom: '1px solid #eee', padding: '0 1.5rem', flexShrink: 0 },
  tab: { padding: '0.75rem 1rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.88rem', color: '#666', borderBottom: '2px solid transparent', marginBottom: '-1px', fontWeight: 500 },
  tabActivo: { color: '#1a3a5c', borderBottomColor: '#1a3a5c', fontWeight: 700 },
  cuerpo: { overflowY: 'auto', padding: '1.5rem', flex: 1 },
  pie: { padding: '1rem 1.5rem', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexShrink: 0 },
  avatar: { width: '46px', height: '46px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '1.2rem', flexShrink: 0 },
  btnCerrar: { background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#666' },
  btnEditar: { padding: '0.4rem 1rem', border: '1.5px solid #1a3a5c', borderRadius: '8px', background: '#fff', color: '#1a3a5c', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' },
  btnAgregar: { padding: '0.45rem 1rem', border: 'none', borderRadius: '8px', backgroundColor: '#1a3a5c', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' },
  btnHistorial: { padding: '0.35rem 0.75rem', border: '1.5px solid #1a3a5c', borderRadius: '6px', background: '#fff', color: '#1a3a5c', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 },
  btnEliminarSmall: { padding: '0.35rem 0.75rem', border: 'none', borderRadius: '6px', backgroundColor: '#fdecea', color: '#c62828', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 },
  infoItem: { backgroundColor: '#f8f9fc', borderRadius: '8px', padding: '0.75rem' },
  infoLabel: { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' },
  infoValor: { fontSize: '0.9rem', color: '#1a1a1a', fontWeight: 500 },
  etiqueta: { backgroundColor: '#e8f0fe', color: '#1a3a5c', borderRadius: '20px', padding: '0.2rem 0.65rem', fontSize: '0.78rem', fontWeight: 600 },
  activoCard: { backgroundColor: '#f8f9fc', borderRadius: '10px', padding: '1rem', marginBottom: '0.75rem', border: '1px solid #eef0f4' },
  estadoBadge: { fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.65rem', borderRadius: '20px' },
  servicioCard: { backgroundColor: '#f8f9fc', borderRadius: '10px', padding: '1rem', marginBottom: '0.75rem', border: '1px solid #eef0f4' },
  servicioBadge: { backgroundColor: '#e3f2fd', color: '#1565c0', fontSize: '0.78rem', fontWeight: 600, padding: '0.2rem 0.65rem', borderRadius: '20px' },
  label: { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#444', marginBottom: '0.35rem' },
  input: { width: '100%', padding: '0.6rem 0.85rem', border: '1.5px solid #dde3ed', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  btnCancelar: { padding: '0.6rem 1.25rem', border: '1.5px solid #dde3ed', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#444' },
  btnGuardar: { padding: '0.6rem 1.5rem', border: 'none', borderRadius: '8px', backgroundColor: '#1a3a5c', color: '#fff', cursor: 'pointer', fontWeight: 600 },
}