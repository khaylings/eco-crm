/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: VerEmpresa.jsx
 * Módulo:  Empresas
 * ============================================================
 */

import { useState, useEffect } from 'react'
import {
  obtenerSedes, crearSede, eliminarSede,
  obtenerContactosPorEmpresa, obtenerContactosPorSede,
  obtenerActivosPorSede, crearActivo, eliminarActivo,
  crearServicio, obtenerServicios
} from '../../../firebase/contactos'

const PROVINCIAS = ['San José', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste', 'Puntarenas', 'Limón']
const TIPOS_EQUIPO = ['Mini Split', 'Cassette', 'Piso techo', 'Ventana', 'Chiller', 'Fan Coil', 'Manejadora', 'Condensadora', 'Otro']
const TIPOS_SERVICIO = ['Instalación', 'Mantenimiento preventivo', 'Mantenimiento correctivo', 'Reparación', 'Diagnóstico', 'Garantía']
const ESTADOS_EQUIPO = ['Operativo', 'En mantenimiento', 'Fuera de servicio', 'En garantía']

export default function VerEmpresa({ empresa, onClose, onEditar, onActualizar }) {
  const [tab, setTab] = useState('info')
  const [sedes, setSedes] = useState([])
  const [contactosEmpresa, setContactosEmpresa] = useState([])
  const [sedeActiva, setSedeActiva] = useState(null)
  const [subTab, setSubTab] = useState('equipos')
  const [contactosSede, setContactosSede] = useState([])
  const [activos, setActivos] = useState([])
  const [activoSeleccionado, setActivoSeleccionado] = useState(null)
  const [servicios, setServicios] = useState([])

  const [modalSede, setModalSede] = useState(false)
  const [modalActivo, setModalActivo] = useState(false)
  const [modalServicio, setModalServicio] = useState(false)

  const [formSede, setFormSede] = useState({ nombre: '', direccion: '', provincia: '', telefono: '', responsable: '' })
  const [formActivo, setFormActivo] = useState({ tipo: '', marca: '', modelo: '', capacidadBTU: '', nroSerie: '', ubicacion: '', fechaInstalacion: '', garantiaHasta: '', estado: 'Operativo', observaciones: '' })
  const [formServicio, setFormServicio] = useState({ fecha: '', tipo: '', tecnico: '', descripcion: '' })
  const [guardando, setGuardando] = useState(false)

  const cargarSedes = async () => setSedes(await obtenerSedes(empresa.id))
  const cargarContactosEmpresa = async () => setContactosEmpresa(await obtenerContactosPorEmpresa(empresa.id))
  const cargarActivos = async (sedeId) => setActivos(await obtenerActivosPorSede(sedeId))
  const cargarContactosSede = async (sedeId) => setContactosSede(await obtenerContactosPorSede(sedeId))
  const cargarServicios = async (activoId) => setServicios(await obtenerServicios(activoId))

  useEffect(() => { cargarSedes(); cargarContactosEmpresa() }, [])

  const setSF = (k, v) => setFormSede(f => ({ ...f, [k]: v }))
  const setA  = (k, v) => setFormActivo(f => ({ ...f, [k]: v }))
  const setS  = (k, v) => setFormServicio(f => ({ ...f, [k]: v }))

  const guardarSede = async () => {
    if (!formSede.nombre.trim()) return alert('El nombre de sede es requerido')
    setGuardando(true)
    await crearSede(empresa.id, formSede)
    setGuardando(false)
    setModalSede(false)
    setFormSede({ nombre: '', direccion: '', provincia: '', telefono: '', responsable: '' })
    cargarSedes()
  }

  const guardarActivo = async () => {
    if (!formActivo.tipo) return alert('Selecciona el tipo de equipo')
    setGuardando(true)
    await crearActivo({
      ...formActivo,
      propietarioTipo: 'sede',
      propietarioId: sedeActiva.id,
      propietarioNombre: `${empresa.nombre} - ${sedeActiva.nombre}`,
      empresaId: empresa.id,
      sedeId: sedeActiva.id,
    })
    setGuardando(false)
    setModalActivo(false)
    setFormActivo({ tipo: '', marca: '', modelo: '', capacidadBTU: '', nroSerie: '', ubicacion: '', fechaInstalacion: '', garantiaHasta: '', estado: 'Operativo', observaciones: '' })
    cargarActivos(sedeActiva.id)
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

  const abrirSede = (sede) => {
    setSedeActiva(sede)
    setActivoSeleccionado(null)
    setServicios([])
    setSubTab('equipos')
    cargarActivos(sede.id)
    cargarContactosSede(sede.id)
    setTab('sede-detalle')
  }

  const s = estilos

  return (
    <div style={s.overlay}>
      <div style={s.modal}>

        {/* HEADER */}
        <div style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🏢</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{empresa.nombre}</h2>
              {empresa.sector && <span style={s.sectorBadge}>{empresa.sector}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button style={s.btnEditar} onClick={onEditar}>Editar</button>
            <button style={s.btnCerrar} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* TABS */}
        <div style={s.tabs}>
          {[
            { key: 'info', label: 'Información' },
            { key: 'sedes', label: `Sedes (${sedes.length})` },
            { key: 'contactos', label: `Contactos (${contactosEmpresa.length})` },
          ].map(t => (
            <button key={t.key}
              style={{ ...s.tab, ...(tab === t.key || (tab === 'sede-detalle' && t.key === 'sedes') ? s.tabActivo : {}) }}
              onClick={() => { setTab(t.key); setSedeActiva(null) }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={s.cuerpo}>

          {/* ── INFO ── */}
          {tab === 'info' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {[
                ['Cédula jurídica', empresa.ruc],
                ['Teléfono', empresa.telefono],
                ['Correo', empresa.correo],
                ['Provincia', empresa.provincia],
                ['Dirección', empresa.direccion],
                ['Sitio web', empresa.sitioWeb],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} style={s.infoItem}>
                  <span style={s.infoLabel}>{k}</span>
                  <span style={s.infoValor}>{v}</span>
                </div>
              ))}
              {empresa.notas && (
                <div style={{ gridColumn: '1/-1', ...s.infoItem }}>
                  <span style={s.infoLabel}>Notas</span>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#333', lineHeight: 1.5 }}>{empresa.notas}</p>
                </div>
              )}
            </div>
          )}

          {/* ── LISTA DE SEDES ── */}
          {tab === 'sedes' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <p style={{ margin: 0, color: '#666', fontSize: '0.88rem' }}>{sedes.length} sede{sedes.length !== 1 ? 's' : ''} registrada{sedes.length !== 1 ? 's' : ''}</p>
                <button style={s.btnAgregar} onClick={() => setModalSede(true)}>+ Agregar sede</button>
              </div>
              {sedes.length === 0 ? (
                <div style={s.vacio}>
                  <p style={{ fontSize: '2rem', margin: 0 }}>🏪</p>
                  <p>Sin sedes registradas</p>
                </div>
              ) : sedes.map(sede => (
                <div key={sede.id} style={s.sedeCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: '#1a1a1a', fontSize: '0.95rem', marginBottom: 4 }}>🏪 {sede.nombre}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {sede.provincia && <Tag>📍 {sede.provincia}{sede.direccion ? ` · ${sede.direccion}` : ''}</Tag>}
                        {sede.telefono && <Tag>📞 {sede.telefono}</Tag>}
                        {sede.responsable && <Tag>👤 {sede.responsable}</Tag>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 12 }}>
                      <button style={s.btnVerSede} onClick={() => abrirSede(sede)}>Ver detalle →</button>
                      <button style={s.btnEliminarSmall} onClick={async () => {
                        if (confirm('¿Eliminar sede? También se eliminarán sus equipos.')) {
                          await eliminarSede(empresa.id, sede.id)
                          cargarSedes()
                        }
                      }}>✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── DETALLE DE SEDE ── */}
          {tab === 'sede-detalle' && sedeActiva && (
            <div>
              {/* Encabezado sede */}
              <div style={{ marginBottom: '1rem' }}>
                <button style={s.btnVolver} onClick={() => { setTab('sedes'); setSedeActiva(null) }}>← Volver a sedes</button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 6 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1a1a1a' }}>🏪 {sedeActiva.nombre}</div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: 4 }}>
                      {sedeActiva.provincia && <Tag>📍 {sedeActiva.provincia}</Tag>}
                      {sedeActiva.telefono && <Tag>📞 {sedeActiva.telefono}</Tag>}
                      {sedeActiva.responsable && <Tag>👤 {sedeActiva.responsable}</Tag>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-tabs de la sede */}
              {!activoSeleccionado && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '0.5px solid #eee', paddingBottom: 0 }}>
                  {[
                    { key: 'equipos', label: `Equipos (${activos.length})` },
                    { key: 'contactos', label: `Contactos (${contactosSede.length})` },
                  ].map(t => (
                    <button key={t.key} onClick={() => setSubTab(t.key)} style={{
                      padding: '6px 14px', border: 'none', background: 'none', cursor: 'pointer',
                      fontSize: '0.85rem', fontWeight: subTab === t.key ? 700 : 500,
                      color: subTab === t.key ? '#1a3a5c' : '#888',
                      borderBottom: subTab === t.key ? '2px solid #1a3a5c' : '2px solid transparent',
                      marginBottom: -1, fontFamily: 'inherit',
                    }}>{t.label}</button>
                  ))}
                  {subTab === 'equipos' && (
                    <button style={{ ...s.btnAgregar, marginLeft: 'auto', fontSize: '0.82rem', padding: '4px 12px' }}
                      onClick={() => setModalActivo(true)}>+ Agregar equipo</button>
                  )}
                </div>
              )}

              {/* SUB-TAB EQUIPOS */}
              {subTab === 'equipos' && !activoSeleccionado && (
                activos.length === 0 ? (
                  <div style={s.vacio}>
                    <p style={{ fontSize: '2rem', margin: 0 }}>❄️</p>
                    <p>Sin equipos en esta sede</p>
                  </div>
                ) : activos.map(a => (
                  <div key={a.id} style={s.activoCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: '#1a1a1a', fontSize: '0.95rem' }}>
                          ❄️ {a.tipo}{a.marca ? ` · ${a.marca}` : ''}{a.modelo ? ` ${a.modelo}` : ''}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: 4 }}>
                          {a.capacidadBTU && <Tag>{a.capacidadBTU} BTU</Tag>}
                          {a.ubicacion && <Tag>📍 {a.ubicacion}</Tag>}
                          {a.nroSerie && <Tag>S/N: {a.nroSerie}</Tag>}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 600, padding: '2px 10px', borderRadius: 20,
                        background: a.estado === 'Operativo' ? '#EAF3DE' : '#FFF3E0',
                        color: a.estado === 'Operativo' ? '#3B6D11' : '#E65100',
                        flexShrink: 0, marginLeft: 8,
                      }}>{a.estado}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <button style={s.btnVerSede} onClick={() => { setActivoSeleccionado(a); cargarServicios(a.id) }}>
                        Historial de servicios
                      </button>
                      <button style={s.btnEliminarSmall} onClick={async () => {
                        if (confirm('¿Eliminar equipo?')) { await eliminarActivo(a.id); cargarActivos(sedeActiva.id) }
                      }}>Eliminar</button>
                    </div>
                  </div>
                ))
              )}

              {/* HISTORIAL DE SERVICIOS */}
              {subTab === 'equipos' && activoSeleccionado && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                      <button style={s.btnVolver} onClick={() => setActivoSeleccionado(null)}>← Volver a equipos</button>
                      <p style={{ margin: '4px 0 0', fontWeight: 600, fontSize: '0.95rem' }}>
                        ❄️ {activoSeleccionado.tipo} {activoSeleccionado.marca} {activoSeleccionado.modelo}
                      </p>
                    </div>
                    <button style={s.btnAgregar} onClick={() => setModalServicio(true)}>+ Registrar servicio</button>
                  </div>
                  {servicios.length === 0 ? (
                    <div style={s.vacio}>
                      <p style={{ fontSize: '2rem', margin: 0 }}>🔧</p>
                      <p>Sin servicios registrados</p>
                    </div>
                  ) : servicios.map(sv => (
                    <div key={sv.id} style={s.servicioCard}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={s.servicioBadge}>{sv.tipo}</span>
                        <span style={{ fontSize: '0.8rem', color: '#888' }}>{sv.fecha}</span>
                      </div>
                      {sv.tecnico && <div style={{ fontSize: '0.85rem', color: '#555', marginTop: 4 }}>🔧 {sv.tecnico}</div>}
                      {sv.descripcion && <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#333', lineHeight: 1.5 }}>{sv.descripcion}</p>}
                    </div>
                  ))}
                </div>
              )}

              {/* SUB-TAB CONTACTOS DE SEDE */}
              {subTab === 'contactos' && (
                <div>
                  {contactosSede.length === 0 ? (
                    <div style={s.vacio}>
                      <p style={{ fontSize: '2rem', margin: 0 }}>👤</p>
                      <p>Sin contactos en esta sede.<br />
                        <span style={{ fontSize: '0.82rem' }}>Asignale una sede a los contactos desde el módulo de Contactos.</span>
                      </p>
                    </div>
                  ) : contactosSede.map(c => (
                    <div key={c.id} style={s.contactoCard}>
                      <div style={s.avatarSmall}>{c.nombre?.charAt(0)?.toUpperCase()}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: '#1a1a1a', fontSize: '0.9rem' }}>{c.nombre}</div>
                        {c.cargo && <div style={{ fontSize: '0.82rem', color: '#1a3a5c', fontWeight: 500 }}>{c.cargo}</div>}
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>
                          {c.telefono}{c.correo ? ` · ${c.correo}` : ''}
                        </div>
                      </div>
                      {c.esResponsable && (
                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 20, background: '#E6F1FB', color: '#0C447C', fontWeight: 600 }}>
                          Responsable
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── CONTACTOS DE LA EMPRESA ── */}
          {tab === 'contactos' && (
            <div>
              <p style={{ margin: '0 0 1rem', color: '#666', fontSize: '0.88rem' }}>
                Todos los contactos vinculados a esta empresa
              </p>
              {contactosEmpresa.length === 0 ? (
                <div style={s.vacio}>
                  <p style={{ fontSize: '2rem', margin: 0 }}>👤</p>
                  <p>Sin contactos vinculados a esta empresa</p>
                </div>
              ) : contactosEmpresa.map(c => (
                <div key={c.id} style={s.contactoCard}>
                  <div style={s.avatarSmall}>{c.nombre?.charAt(0)?.toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#1a1a1a', fontSize: '0.9rem' }}>{c.nombre}</div>
                    {c.cargo && <div style={{ fontSize: '0.82rem', color: '#1a3a5c', fontWeight: 500 }}>{c.cargo}</div>}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                      {c.telefono && <Tag>📞 {c.telefono}</Tag>}
                      {c.correo && <Tag>✉️ {c.correo}</Tag>}
                      {c.sedeNombre && <Tag>🏪 {c.sedeNombre}</Tag>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── MODAL SEDE ── */}
        {modalSede && (
          <div style={s.subOverlay}>
            <div style={{ ...s.subModal, maxWidth: '440px' }}>
              <div style={s.header}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Agregar sede</h3>
                <button style={s.btnCerrar} onClick={() => setModalSede(false)}>✕</button>
              </div>
              <div style={{ padding: '1.25rem' }}>
                {[
                  { label: 'Nombre de la sede *', key: 'nombre', placeholder: 'Ej: Sucursal San José' },
                  { label: 'Provincia', key: 'provincia', tipo: 'select', opciones: PROVINCIAS },
                  { label: 'Dirección', key: 'direccion', placeholder: 'Dirección de la sede' },
                  { label: 'Teléfono de sede', key: 'telefono', placeholder: '2222-2222' },
                  { label: 'Contacto responsable', key: 'responsable', placeholder: 'Nombre del encargado' },
                ].map(({ label, key, tipo, placeholder, opciones }) => (
                  <div key={key} style={{ marginBottom: '0.85rem' }}>
                    <label style={s.label}>{label}</label>
                    {tipo === 'select' ? (
                      <select style={s.input} value={formSede[key]} onChange={e => setSF(key, e.target.value)}>
                        <option value="">— Seleccionar —</option>
                        {opciones.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input style={s.input} value={formSede[key]} onChange={e => setSF(key, e.target.value)} placeholder={placeholder} />
                    )}
                  </div>
                ))}
              </div>
              <div style={s.pie}>
                <button style={s.btnCancelar} onClick={() => setModalSede(false)}>Cancelar</button>
                <button style={s.btnGuardar} onClick={guardarSede} disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Agregar sede'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL ACTIVO ── */}
        {modalActivo && (
          <div style={s.subOverlay}>
            <div style={s.subModal}>
              <div style={s.header}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Agregar equipo AC</h3>
                <button style={s.btnCerrar} onClick={() => setModalActivo(false)}>✕</button>
              </div>
              <div style={{ padding: '1.25rem', overflowY: 'auto', maxHeight: '55vh' }}>
                {[
                  { label: 'Tipo de equipo *', key: 'tipo', tipo: 'select', opciones: TIPOS_EQUIPO },
                  { label: 'Marca', key: 'marca', placeholder: 'Ej: Carrier, Daikin' },
                  { label: 'Modelo', key: 'modelo', placeholder: 'Ej: 40MBFQ12' },
                  { label: 'Capacidad (BTU)', key: 'capacidadBTU', placeholder: 'Ej: 12000' },
                  { label: 'Nro. de serie', key: 'nroSerie' },
                  { label: 'Ubicación en sede', key: 'ubicacion', placeholder: 'Ej: Sala de servidores' },
                  { label: 'Fecha instalación', key: 'fechaInstalacion', tipo: 'date' },
                  { label: 'Garantía hasta', key: 'garantiaHasta', tipo: 'date' },
                  { label: 'Estado', key: 'estado', tipo: 'select', opciones: ESTADOS_EQUIPO },
                  { label: 'Observaciones', key: 'observaciones', tipo: 'textarea' },
                ].map(({ label, key, tipo, placeholder, opciones }) => (
                  <div key={key} style={{ marginBottom: '0.85rem' }}>
                    <label style={s.label}>{label}</label>
                    {tipo === 'select' ? (
                      <select style={s.input} value={formActivo[key]} onChange={e => setA(key, e.target.value)}>
                        <option value="">— Seleccionar —</option>
                        {opciones.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : tipo === 'textarea' ? (
                      <textarea style={{ ...s.input, minHeight: 70, resize: 'vertical' }} value={formActivo[key]} onChange={e => setA(key, e.target.value)} placeholder={placeholder} />
                    ) : (
                      <input style={s.input} type={tipo || 'text'} value={formActivo[key]} onChange={e => setA(key, e.target.value)} placeholder={placeholder} />
                    )}
                  </div>
                ))}
              </div>
              <div style={s.pie}>
                <button style={s.btnCancelar} onClick={() => setModalActivo(false)}>Cancelar</button>
                <button style={s.btnGuardar} onClick={guardarActivo} disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar equipo'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL SERVICIO ── */}
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
                  { label: 'Descripción', key: 'descripcion', tipo: 'textarea' },
                ].map(({ label, key, tipo, placeholder, opciones }) => (
                  <div key={key} style={{ marginBottom: '0.85rem' }}>
                    <label style={s.label}>{label}</label>
                    {tipo === 'select' ? (
                      <select style={s.input} value={formServicio[key]} onChange={e => setS(key, e.target.value)}>
                        <option value="">— Seleccionar —</option>
                        {opciones.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : tipo === 'textarea' ? (
                      <textarea style={{ ...s.input, minHeight: 80, resize: 'vertical' }} value={formServicio[key]} onChange={e => setS(key, e.target.value)} placeholder={placeholder} />
                    ) : (
                      <input style={s.input} type={tipo || 'text'} value={formServicio[key]} onChange={e => setS(key, e.target.value)} placeholder={placeholder} />
                    )}
                  </div>
                ))}
              </div>
              <div style={s.pie}>
                <button style={s.btnCancelar} onClick={() => setModalServicio(false)}>Cancelar</button>
                <button style={s.btnGuardar} onClick={guardarServicio} disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Tag({ children }) {
  return (
    <span style={{ fontSize: '0.78rem', padding: '1px 8px', borderRadius: 20, background: '#f0f4f8', color: '#555', border: '0.5px solid #e0e7ef' }}>
      {children}
    </span>
  )
}

const estilos = {
  overlay:       { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' },
  subOverlay:    { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px', zIndex: 10 },
  modal:         { backgroundColor: '#fff', borderRadius: '16px', width: '100%', maxWidth: '740px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', position: 'relative' },
  subModal:      { backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '540px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' },
  header:        { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '0.5px solid #eee', flexShrink: 0 },
  tabs:          { display: 'flex', borderBottom: '0.5px solid #eee', padding: '0 1.5rem', flexShrink: 0 },
  tab:           { padding: '0.75rem 1rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.88rem', color: '#666', borderBottom: '2px solid transparent', marginBottom: '-1px', fontWeight: 500, fontFamily: 'inherit' },
  tabActivo:     { color: '#1a3a5c', borderBottomColor: '#1a3a5c', fontWeight: 700 },
  cuerpo:        { overflowY: 'auto', padding: '1.5rem', flex: 1 },
  pie:           { padding: '1rem 1.5rem', borderTop: '0.5px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexShrink: 0 },
  btnCerrar:     { background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#666' },
  btnEditar:     { padding: '0.4rem 1rem', border: '1.5px solid #1a3a5c', borderRadius: '8px', background: '#fff', color: '#1a3a5c', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' },
  btnAgregar:    { padding: '0.45rem 1rem', border: 'none', borderRadius: '8px', backgroundColor: '#1a3a5c', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', fontFamily: 'inherit' },
  btnVerSede:    { padding: '0.35rem 0.75rem', border: '1.5px solid #1a3a5c', borderRadius: '6px', background: '#fff', color: '#1a3a5c', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 },
  btnEliminarSmall: { padding: '0.35rem 0.75rem', border: 'none', borderRadius: '6px', backgroundColor: '#fdecea', color: '#c62828', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 },
  btnVolver:     { background: 'none', border: 'none', color: '#1a3a5c', cursor: 'pointer', fontSize: '0.82rem', padding: 0, fontFamily: 'inherit' },
  sectorBadge:   { fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '20px', backgroundColor: '#e3f2fd', color: '#1565c0', display: 'inline-block', marginTop: '0.2rem' },
  infoItem:      { backgroundColor: '#f8f9fc', borderRadius: '8px', padding: '0.75rem' },
  infoLabel:     { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' },
  infoValor:     { fontSize: '0.9rem', color: '#1a1a1a', fontWeight: 500 },
  sedeCard:      { backgroundColor: '#f8f9fc', borderRadius: '10px', padding: '1rem', marginBottom: '0.75rem', border: '0.5px solid #eef0f4' },
  activoCard:    { backgroundColor: '#f8f9fc', borderRadius: '10px', padding: '1rem', marginBottom: '0.75rem', border: '0.5px solid #eef0f4' },
  servicioCard:  { backgroundColor: '#f8f9fc', borderRadius: '10px', padding: '1rem', marginBottom: '0.75rem', border: '0.5px solid #eef0f4' },
  servicioBadge: { backgroundColor: '#e3f2fd', color: '#1565c0', fontSize: '0.78rem', fontWeight: 600, padding: '0.2rem 0.65rem', borderRadius: '20px' },
  contactoCard:  { display: 'flex', gap: '0.75rem', alignItems: 'center', backgroundColor: '#f8f9fc', borderRadius: '10px', padding: '0.85rem', marginBottom: '0.6rem', border: '0.5px solid #eef0f4' },
  avatarSmall:   { width: 36, height: 36, borderRadius: '50%', backgroundColor: '#1a3a5c', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 },
  vacio:         { textAlign: 'center', padding: '2rem', color: '#999' },
  label:         { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#444', marginBottom: '0.35rem' },
  input:         { width: '100%', padding: '0.6rem 0.85rem', border: '1.5px solid #dde3ed', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  btnCancelar:   { padding: '0.6rem 1.25rem', border: '1.5px solid #dde3ed', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#444', fontFamily: 'inherit' },
  btnGuardar:    { padding: '0.6rem 1.5rem', border: 'none', borderRadius: '8px', backgroundColor: '#1a3a5c', color: '#fff', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' },
}