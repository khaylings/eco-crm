/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: FichaLead.jsx
 * Módulo:  Leads
 * ============================================================
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { getDocs, collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../../firebase/firestore'
import { crearLead, actualizarLead, agregarNotaLead, obtenerNotasLead } from '../../../firebase/contactos'
import { useAuth } from '../../../context/AuthContext'

const PRIORIDADES = ['baja', 'media', 'alta']
const ICONOS_PRIO = { baja: '⚪', media: '🟡', alta: '🔴' }

const TIPOS_FACTURA = [
  { k: 'fisica',   l: '👤 Física',      desc: 'Persona natural / cédula física' },
  { k: 'juridica', l: '🏢 Jurídica',     desc: 'Empresa / cédula jurídica' },
  { k: 'nd',       l: '⬜ Por definir',  desc: 'Se definirá más adelante' },
]

export default function FichaLead({ lead, columnas, contactos, empresas, origenes, onClose, onGuardado }) {
  const esNuevo = !lead?.id
  const { user, usuario } = useAuth()
  const nombreUsuarioActual = usuario?.nombre || user?.displayName || user?.email || ''
  const uidActual = user?.uid || ''

  const [tipoLead, setTipoLead] = useState(lead?.tipoLead || 'empresa')
  const [form, setForm] = useState({
    nombre: '', contactoId: '', cliente: '', empresaId: '', empresaNombre: '',
    sedeId: '', sedeNombre: '', origen: '',
    prioridad: 'media', etiquetas: '', whatsapp: '',
    vendedor: '', vendedorId: '', notas: '', columnaId: lead?.columnaId || '',
    tipoLead: 'empresa',
    tipoFactura: 'nd',
    activosIds: [],
    activosNombres: [],
  })
  const [sedes, setSedes] = useState([])
  const [contactosSede, setContactosSede] = useState([])
  const [busqEmpresa, setBusqEmpresa] = useState('')
  const [pendienteContacto, setPendienteContacto] = useState(null) // contacto elegido que tiene empresa, esperando tipo
  const [activos, setActivos] = useState([])
  const [busqActivo, setBusqActivo] = useState('')
  const [showActivoDrop, setShowActivoDrop] = useState(false)
  const [busqContacto, setBusqContacto] = useState('')
  const [notas, setNotas] = useState([])
  const [nuevaNota, setNuevaNota] = useState('')
  const [tab, setTab] = useState('info')
  const [guardando, setGuardando] = useState(false)
  const notasEndRef = useRef(null)
  const [usuarios, setUsuarios] = useState([])
  const [vendedores, setVendedores] = useState([])

  // Cargar usuarios, empleados asignables a ventas y activos
  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'usuarios'), snap => {
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.activo !== false))
    })
    const u2 = onSnapshot(collection(db, 'activos'), snap => {
      setActivos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    const u3 = onSnapshot(collection(db, 'empleados'), snap => {
      const emps = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setVendedores(emps.filter(e => e.activo !== false && e.asignableVentas))
    })
    return () => { u1(); u2(); u3() }
  }, [])

  // Auto-asignar vendedor al crear
  useEffect(() => {
    if (esNuevo && !form.vendedor && nombreUsuarioActual) {
      setForm(f => ({ ...f, vendedor: nombreUsuarioActual, vendedorId: uidActual }))
    }
  }, [nombreUsuarioActual])

  useEffect(() => {
    if (lead?.id) {
      setForm({ ...form, ...lead, etiquetas: lead.etiquetas?.join(', ') || '' })
      setTipoLead(lead.tipoLead || 'empresa')
      if (lead.empresaNombre) setBusqEmpresa(lead.empresaNombre)
      obtenerNotasLead(lead.id).then(setNotas)
      if (lead.empresaId) cargarSedes(lead.empresaId)
    }
  }, [])

  useEffect(() => {
    notasEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [notas])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function cargarSedes(empresaId) {
    try {
      const snap = await getDocs(collection(db, 'empresas', empresaId, 'sedes'))
      setSedes(snap.docs.map(d => ({ _id: d.id, ...d.data() })))
    } catch { setSedes([]) }
  }

  async function cargarContactosSede(empresaId, sedeId) {
    try {
      const snap = await getDocs(collection(db, 'contactos'))
      const todos = snap.docs.map(d => ({ _id: d.id, id: d.id, ...d.data() }))
      const filtrados = todos.filter(c =>
        c.empresaId === empresaId && (!sedeId || c.sedeId === sedeId)
      )
      setContactosSede(filtrados)
    } catch { setContactosSede([]) }
  }

  function elegirEmpresa(emp) {
    set('empresaId', emp.id || emp._id)
    set('empresaNombre', emp.nombre)
    setBusqEmpresa(emp.nombre)
    set('sedeId', '')
    set('sedeNombre', '')
    set('contactoId', '')
    setSedes([])
    setContactosSede([])
    cargarSedes(emp.id || emp._id)
  }

  function elegirSede(sede) {
    set('sedeId', sede._id)
    set('sedeNombre', sede.nombre)
    cargarContactosSede(form.empresaId, sede._id)
  }

  function elegirContacto(c) {
    set('contactoId', c._id || c.id)
    const nombre = c.nombre || c.nombreCompleto || ''
    set('cliente', nombre)
    setBusqContacto(nombre)
    if (c.whatsapp) set('whatsapp', c.whatsapp)
    else if (c.telefono) set('whatsapp', c.telefono)
  }

  const empresasFiltradas = empresas.filter(e =>
    !busqEmpresa || (e.nombre || '').toLowerCase().includes(busqEmpresa.toLowerCase())
  )
  // Para empresa: primero los de la sede/empresa, luego todos los demás como fallback
  const contactosFiltrados = useMemo(() => {
    const base = tipoLead === 'empresa' && contactosSede.length > 0 ? contactosSede : contactos
    if (!busqContacto) return base
    const q = busqContacto.toLowerCase()
    return base.filter(c =>
      (c.nombre || c.nombreCompleto || '').toLowerCase().includes(q) || (c.empresaNombre || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)
    )
  }, [tipoLead, contactosSede, contactos, busqContacto])

  const guardar = async () => {
    if (!form.nombre.trim()) return alert('El nombre del lead es requerido')
    if (!form.columnaId) return alert('Selecciona una etapa del pipeline')
    setGuardando(true)
    const data = {
      ...form,
      tipoLead,
      contactoId: form.contactoId === '__nuevo__' ? '' : form.contactoId,
      etiquetas: form.etiquetas ? form.etiquetas.split(',').map(e => e.trim()).filter(Boolean) : [],
    }
    if (lead?.id) await actualizarLead(lead.id, data)
    else await crearLead(data)
    setGuardando(false)
    onGuardado()
  }

  const enviarNota = async () => {
    if (!nuevaNota.trim() || !lead?.id) return
    const nota = { texto: nuevaNota.trim(), tipo: 'nota', autor: 'Yo', fecha: new Date().toISOString() }
    await agregarNotaLead(lead.id, nota)
    setNuevaNota('')
    const updated = await obtenerNotasLead(lead.id)
    setNotas(updated)
  }

  const s = estilos

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        {/* HEADER */}
        <div style={s.header}>
          <div style={{ flex: 1 }}>
            {esNuevo ? (
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1a1a1a' }}>Nuevo Lead</h2>
            ) : (
              <input style={s.inputTitulo} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre del lead..." />
            )}
            {!esNuevo && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <select style={s.selectPeq} value={form.columnaId} onChange={e => set('columnaId', e.target.value)}>
                  {columnas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <select style={s.selectPeq} value={form.prioridad} onChange={e => set('prioridad', e.target.value)}>
                  {PRIORIDADES.map(p => <option key={p} value={p}>{ICONOS_PRIO[p]} {p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
                {/* Badge tipo factura en edición */}
                <span style={{
                  ...s.badgeFact,
                  background: form.tipoFactura === 'fisica' ? '#e8f5e9' : form.tipoFactura === 'juridica' ? '#e8f0fe' : '#f5f5f5',
                  color: form.tipoFactura === 'fisica' ? '#2e7d32' : form.tipoFactura === 'juridica' ? '#1a3a5c' : '#888',
                  border: `1px solid ${form.tipoFactura === 'fisica' ? '#a5d6a7' : form.tipoFactura === 'juridica' ? '#c5d8f8' : '#ddd'}`,
                }}>
                  {TIPOS_FACTURA.find(t => t.k === form.tipoFactura)?.l || '⬜ Por definir'}
                </span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {!esNuevo && <button style={s.btnGuardar} onClick={guardar} disabled={guardando}>{guardando ? '...' : 'Guardar'}</button>}
            <button style={s.btnCerrar} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* TABS (solo si no es nuevo) */}
        {!esNuevo && (
          <div style={s.tabs}>
            {[{ k: 'info', l: 'Información' }, { k: 'chat', l: '💬 Comunicación' }].map(t => (
              <button key={t.k} style={{ ...s.tab, ...(tab === t.k ? s.tabActivo : {}) }} onClick={() => setTab(t.k)}>{t.l}</button>
            ))}
          </div>
        )}

        <div style={s.cuerpo}>
          {(esNuevo || tab === 'info') && (
            <div>
              {/* ═══ PASO 1: BUSCAR CONTACTO O EMPRESA (solo nuevo lead) ═══ */}
              {esNuevo && !form.contactoId && !pendienteContacto && (
                <div>
                  <div style={s.secTitulo}>Buscar contacto o empresa</div>
                  <div style={{ position: 'relative', marginBottom: 12 }}>
                    <input style={s.input} placeholder="Nombre de contacto, empresa, email, teléfono..."
                      value={busqContacto} onChange={e => setBusqContacto(e.target.value)} autoFocus />
                    {busqContacto && (() => {
                      const q = busqContacto.toLowerCase()
                      const contactosFilt = contactos.filter(c =>
                        (c.nombre || c.nombreCompleto || '').toLowerCase().includes(q) || (c.empresaNombre || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.telefono || '').includes(q)
                      ).slice(0, 6)
                      const empresasFilt = empresas.filter(e =>
                        (e.nombre || '').toLowerCase().includes(q) || (e.cedulaJuridica || '').includes(q)
                      ).slice(0, 4)
                      if (contactosFilt.length === 0 && empresasFilt.length === 0) return (
                        <div style={{ ...s.dropdown, maxHeight: 250 }}>
                          <div style={{ padding: '12px 14px', textAlign: 'center', color: '#aaa', fontSize: 12 }}>Sin resultados</div>
                        </div>
                      )
                      return (
                        <div style={{ ...s.dropdown, maxHeight: 300 }}>
                          {/* Contactos */}
                          {contactosFilt.length > 0 && (
                            <>
                              <div style={{ padding: '6px 14px', fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.5px', background: '#fafafa' }}>Contactos</div>
                              {contactosFilt.map(c => (
                                <div key={c._id || c.id} onClick={() => {
                                  if (c.empresaId) {
                                    const nombre = c.nombre || c.nombreCompleto || ''
                                    setBusqContacto(nombre)
                                    set('cliente', nombre)
                                    if (c.whatsapp) set('whatsapp', c.whatsapp)
                                    else if (c.telefono) set('whatsapp', c.telefono)
                                    setPendienteContacto({ ...c, _selId: c._id || c.id })
                                  } else {
                                    elegirContacto(c)
                                    setTipoLead('persona'); set('tipoLead', 'persona')
                                    set('tipoFactura', 'fisica')
                                  }
                                }} style={s.dropItem}
                                  onMouseEnter={e => e.currentTarget.style.background = '#f0f4f8'}
                                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                      <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nombre || c.nombreCompleto}</div>
                                      {c.cargo && <div style={{ fontSize: 11, color: '#888' }}>{c.cargo}</div>}
                                    </div>
                                    {c.empresaNombre ? (
                                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: '#e8f0fe', color: '#1a3a5c', fontWeight: 500 }}>🏢 {c.empresaNombre}</span>
                                    ) : (
                                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: '#f5f5f5', color: '#888' }}>👤 Personal</span>
                                    )}
                                  </div>
                                  {(c.email || c.telefono) && <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{[c.email, c.telefono].filter(Boolean).join(' · ')}</div>}
                                </div>
                              ))}
                            </>
                          )}
                          {/* Empresas */}
                          {empresasFilt.length > 0 && (
                            <>
                              <div style={{ padding: '6px 14px', fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.5px', background: '#fafafa', borderTop: contactosFilt.length > 0 ? '1px solid #f0f0f0' : 'none' }}>Empresas</div>
                              {empresasFilt.map(emp => (
                                <div key={emp.id || emp._id} onClick={() => {
                                  // Elegir empresa directamente → tipo jurídico, preguntar contacto después
                                  set('empresaId', emp.id || emp._id)
                                  set('empresaNombre', emp.nombre)
                                  setBusqEmpresa(emp.nombre)
                                  setTipoLead('empresa'); set('tipoLead', 'empresa')
                                  set('tipoFactura', 'juridica')
                                  if (emp.id || emp._id) cargarSedes(emp.id || emp._id)
                                  set('contactoId', '__nuevo__')
                                  setBusqContacto('')
                                }} style={s.dropItem}
                                  onMouseEnter={e => e.currentTarget.style.background = '#f0f4f8'}
                                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                      <div style={{ fontWeight: 600, fontSize: 13 }}>🏢 {emp.nombre}</div>
                                      {emp.sector && <div style={{ fontSize: 11, color: '#888' }}>{emp.sector}</div>}
                                    </div>
                                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: '#e8f0fe', color: '#1a3a5c', fontWeight: 500 }}>Empresa</span>
                                  </div>
                                  {(emp.telefono || emp.email) && <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{[emp.telefono, emp.email].filter(Boolean).join(' · ')}</div>}
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                  <button onClick={() => set('contactoId', '__nuevo__')}
                    style={{ width: '100%', padding: '10px', border: '1.5px dashed #d0d8d0', borderRadius: 10, background: '#fafafa', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: '#888', fontWeight: 500 }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0f4f8'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fafafa'}>
                    + Crear nuevo contacto
                  </button>
                </div>
              )}

              {/* ═══ PASO 1.5: ¿Físico o jurídico? (si contacto tiene empresa) ═══ */}
              {esNuevo && pendienteContacto && !form.contactoId && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ padding: '12px 14px', background: '#e8f5e9', borderRadius: 10, marginBottom: 14 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#2e7d32' }}>✓ {pendienteContacto.nombre || pendienteContacto.nombreCompleto}</span>
                    <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>({pendienteContacto.empresaNombre})</span>
                  </div>
                  <div style={s.secTitulo}>¿Este lead es a nombre personal o de la empresa?</div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <button onClick={() => {
                      set('contactoId', pendienteContacto._selId)
                      setTipoLead('persona'); set('tipoLead', 'persona'); set('tipoFactura', 'fisica')
                      setPendienteContacto(null)
                    }} style={{
                      flex: 1, padding: '14px', borderRadius: 12, fontFamily: 'inherit', cursor: 'pointer',
                      textAlign: 'left', border: '1.5px solid #a5d6a7', background: '#e8f5e9',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#2e7d32' }}>👤 Persona física</div>
                      <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Factura a nombre de {pendienteContacto.nombre || pendienteContacto.nombreCompleto}</div>
                    </button>
                    <button onClick={() => {
                      const c = pendienteContacto
                      set('contactoId', c._selId)
                      setTipoLead('empresa'); set('tipoLead', 'empresa'); set('tipoFactura', 'juridica')
                      set('empresaId', c.empresaId); set('empresaNombre', c.empresaNombre || '')
                      setBusqEmpresa(c.empresaNombre || '')
                      if (c.empresaId) cargarSedes(c.empresaId)
                      if (c.sedeId) { set('sedeId', c.sedeId); set('sedeNombre', c.sedeNombre || '') }
                      setPendienteContacto(null)
                    }} style={{
                      flex: 1, padding: '14px', borderRadius: 12, fontFamily: 'inherit', cursor: 'pointer',
                      textAlign: 'left', border: '1.5px solid #c5d8f8', background: '#e8f0fe',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#1a3a5c' }}>🏢 Persona jurídica</div>
                      <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Factura a nombre de {pendienteContacto.empresaNombre}</div>
                    </button>
                  </div>
                  <button onClick={() => { setPendienteContacto(null); set('contactoId', ''); set('cliente', ''); setBusqContacto('') }}
                    style={{ marginTop: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#aaa', fontFamily: 'inherit' }}>
                    ← Elegir otro contacto
                  </button>
                </div>
              )}

              {/* ═══ PASO 2: FORMULARIO COMPLETO (después de elegir contacto) ═══ */}
              {(form.contactoId || !esNuevo) && <>

              {/* Contacto seleccionado (solo nuevo) */}
              {esNuevo && form.contactoId && form.contactoId !== '__nuevo__' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#e8f5e9', borderRadius: 10, marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#2e7d32' }}>✓ {form.cliente || busqContacto}</span>
                    {form.empresaNombre && <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>({form.empresaNombre})</span>}
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: tipoLead === 'empresa' ? '#e8f0fe' : '#f5f5f5', color: tipoLead === 'empresa' ? '#1a3a5c' : '#888', marginLeft: 8 }}>
                      {tipoLead === 'empresa' ? '🏢 Empresa' : '👤 Persona'}
                    </span>
                  </div>
                  <button onClick={() => { set('contactoId', ''); set('cliente', ''); set('empresaId', ''); set('empresaNombre', ''); setBusqContacto(''); setBusqEmpresa('') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 14 }}>×</button>
                </div>
              )}

              {/* Tipo lead (para cambiar o si creó sin contacto) */}
              {(form.contactoId === '__nuevo__' || !esNuevo) && (
              <div style={{ marginBottom: 16 }}>
                <div style={s.secTitulo}>Tipo de lead</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { k: 'empresa', label: '🏢 Empresa', desc: 'Asociado a empresa y sede' },
                    { k: 'persona', label: '👤 Persona', desc: 'Contacto directo, sin empresa' },
                  ].map(t => (
                    <button key={t.k} onClick={() => { setTipoLead(t.k); set('tipoLead', t.k) }} style={{
                      flex: 1, padding: '10px 14px', borderRadius: 10, fontFamily: 'inherit',
                      cursor: 'pointer', textAlign: 'left', border: '1.5px solid',
                      borderColor: tipoLead === t.k ? '#1a3a5c' : '#dde3ed',
                      background: tipoLead === t.k ? '#e8f0fe' : '#fafafa',
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: tipoLead === t.k ? '#1a3a5c' : '#333' }}>{t.label}</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              )}

              {/* Separador */}
              <div style={s.separador} />

              {/* ── TIPO FACTURA ── */}
              <div style={{ marginBottom: 16 }}>
                <div style={s.secTitulo}>¿Cómo se emitirá la factura?</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {TIPOS_FACTURA.map(t => (
                    <button key={t.k} onClick={() => set('tipoFactura', t.k)} style={{
                      flex: 1, padding: '10px 14px', borderRadius: 10, fontFamily: 'inherit',
                      cursor: 'pointer', textAlign: 'left', border: '1.5px solid',
                      borderColor: form.tipoFactura === t.k
                        ? (t.k === 'fisica' ? '#2e7d32' : t.k === 'juridica' ? '#1a3a5c' : '#888')
                        : '#dde3ed',
                      background: form.tipoFactura === t.k
                        ? (t.k === 'fisica' ? '#e8f5e9' : t.k === 'juridica' ? '#e8f0fe' : '#f5f5f5')
                        : '#fafafa',
                    }}>
                      <div style={{
                        fontWeight: 600, fontSize: 13,
                        color: form.tipoFactura === t.k
                          ? (t.k === 'fisica' ? '#2e7d32' : t.k === 'juridica' ? '#1a3a5c' : '#555')
                          : '#333'
                      }}>{t.l}</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Separador */}
              <div style={s.separador} />

              {/* Info básica */}
              <div style={{ display: 'grid', gridTemplateColumns: esNuevo ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div style={s.campo}>
                  <label style={s.label}>Nombre del lead *</label>
                  <input style={s.input} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Mantenimiento 3 equipos - Empresa XYZ" />
                </div>
                {esNuevo && (
                  <div style={s.campo}>
                    <label style={s.label}>Etapa *</label>
                    <select style={s.input} value={form.columnaId} onChange={e => set('columnaId', e.target.value)}>
                      <option value="">— Seleccionar etapa —</option>
                      {columnas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                )}
                {esNuevo && (
                  <div style={s.campo}>
                    <label style={s.label}>Prioridad</label>
                    <select style={s.input} value={form.prioridad} onChange={e => set('prioridad', e.target.value)}>
                      {PRIORIDADES.map(p => <option key={p} value={p}>{ICONOS_PRIO[p]} {p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Separador */}
              <div style={s.separador} />
              <div style={{ ...s.secTitulo, marginBottom: 12 }}>
                {tipoLead === 'empresa' ? '🏢 Empresa y contactos' : '👤 Contacto'}
              </div>

              {/* MODO EMPRESA */}
              {tipoLead === 'empresa' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ position: 'relative' }}>
                    <label style={s.label}>Empresa</label>
                    <input style={s.input} placeholder="Buscar empresa..."
                      value={busqEmpresa}
                      onChange={e => { setBusqEmpresa(e.target.value); if (!e.target.value) { set('empresaId', ''); set('empresaNombre', ''); setSedes([]) } }} />
                    {busqEmpresa && !form.empresaId && empresasFiltradas.length > 0 && (
                      <div style={s.dropdown}>
                        {empresasFiltradas.slice(0, 6).map(emp => (
                          <div key={emp.id || emp._id} onClick={() => elegirEmpresa(emp)} style={s.dropItem}
                            onMouseEnter={e => e.currentTarget.style.background = '#f0f4f8'}
                            onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                            <div style={{ fontWeight: 500, fontSize: 13 }}>{emp.nombre}</div>
                            {emp.sector && <div style={{ fontSize: 11, color: '#888' }}>{emp.sector}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                    {form.empresaNombre && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <span style={{ fontSize: 11, color: '#2e7d32' }}>✓ {form.empresaNombre}</span>
                        <button onClick={() => { set('empresaId', ''); set('empresaNombre', ''); setBusqEmpresa(''); setSedes([]); setContactosSede([]) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 13 }}>×</button>
                      </div>
                    )}
                  </div>

                  {sedes.length > 0 && (
                    <div>
                      <label style={s.label}>Sede</label>
                      <select style={s.input} value={form.sedeId}
                        onChange={e => { const sede = sedes.find(s => s._id === e.target.value); elegirSede(sede || { _id: e.target.value, nombre: '' }) }}>
                        <option value="">— Seleccionar sede —</option>
                        {sedes.map(sede => <option key={sede._id} value={sede._id}>{sede.nombre}</option>)}
                      </select>
                    </div>
                  )}

                  <div style={{ position: 'relative' }}>
                    <label style={s.label}>Contacto <span style={{ color: '#bbb', fontWeight: 400 }}>(opcional)</span></label>
                    {form.contactoId && form.contactoId !== '__nuevo__' && form.cliente ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 11px', background: '#e8f5e9', borderRadius: 7 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#2e7d32' }}>✓ {form.cliente}</span>
                        <button onClick={() => { set('contactoId', '__nuevo__'); set('cliente', ''); setBusqContacto('') }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 13, marginLeft: 'auto' }}>×</button>
                      </div>
                    ) : (
                      <>
                        <input style={s.input} placeholder="Buscar contacto..."
                          value={busqContacto} onChange={e => setBusqContacto(e.target.value)} />
                        {busqContacto && contactosFiltrados.length > 0 && (
                          <div style={s.dropdown}>
                            {contactosFiltrados.slice(0, 8).map(c => (
                              <div key={c._id || c.id} onClick={() => elegirContacto(c)} style={s.dropItem}
                                onMouseEnter={e => e.currentTarget.style.background = '#f0f4f8'}
                                onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                                <div style={{ fontWeight: 500, fontSize: 13 }}>{c.nombre || c.nombreCompleto}</div>
                                <div style={{ fontSize: 10, color: '#888' }}>{[c.cargo, c.empresaNombre].filter(Boolean).join(' · ')}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* MODO PERSONA */}
              {tipoLead === 'persona' && (
                <div style={{ position: 'relative' }}>
                  <label style={s.label}>Contacto</label>
                  <input style={s.input} placeholder="Buscar contacto..."
                    value={busqContacto} onChange={e => setBusqContacto(e.target.value)} />
                  {busqContacto && contactosFiltrados.length > 0 && (
                    <div style={s.dropdown}>
                      {contactosFiltrados.slice(0, 6).map(c => (
                        <div key={c._id || c.id} onClick={() => elegirContacto(c)} style={s.dropItem}
                          onMouseEnter={e => e.currentTarget.style.background = '#f0f4f8'}
                          onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{c.nombre || c.nombreCompleto}</div>
                          {c.cargo && <div style={{ fontSize: 11, color: '#888' }}>{c.cargo}</div>}
                          {c.empresaNombre && <div style={{ fontSize: 11, color: '#1a3a5c' }}>{c.empresaNombre}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  {form.contactoId && (
                    <div style={{ fontSize: 11, color: '#2e7d32', marginTop: 4 }}>✓ Contacto seleccionado</div>
                  )}
                </div>
              )}

              {/* Separador */}
              <div style={{ ...s.separador, marginTop: 16 }} />
              <div style={{ ...s.secTitulo, marginBottom: 12 }}>Datos del negocio</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={s.campo}>
                  <label style={s.label}>Origen</label>
                  <select style={s.input} value={form.origen} onChange={e => set('origen', e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    {origenes.map(o => <option key={o.id} value={o.nombre}>{o.nombre}</option>)}
                  </select>
                </div>
                <div style={s.campo}>
                  <label style={s.label}>WhatsApp del lead</label>
                  <input style={s.input} value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="8888-8888" />
                </div>
                <div style={s.campo}>
                  <label style={s.label}>Vendedor asignado</label>
                  <select style={s.input} value={form.vendedorId} onChange={e => {
                    const emp = vendedores.find(v => v.usuarioId === e.target.value)
                    set('vendedorId', e.target.value)
                    set('vendedor', emp ? `${emp.nombre || ''} ${emp.apellido || ''}`.trim() : '')
                  }}>
                    <option value="">— Seleccionar —</option>
                    {vendedores.filter(v => v.usuarioId).map(v => (
                      <option key={v.id} value={v.usuarioId}>{`${v.nombre || ''} ${v.apellido || ''}`.trim()}{v.usuarioId === uidActual ? ' (yo)' : ''}</option>
                    ))}
                  </select>
                </div>
                <div style={s.campo}>
                  <label style={s.label}>Etiquetas (separadas por coma)</label>
                  <input style={s.input} value={form.etiquetas} onChange={e => set('etiquetas', e.target.value)} placeholder="Ej: urgente, campaña marzo" />
                </div>

                {/* Activos (opcional, multiselección) */}
                <div style={{ gridColumn: '1/-1', ...s.campo }}>
                  <label style={s.label}>Activos / Equipos <span style={{ color: '#bbb', fontWeight: 400 }}>(opcional)</span></label>
                  {/* Chips seleccionados */}
                  {form.activosIds?.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                      {form.activosIds.map((aid, idx) => {
                        const a = activos.find(x => x.id === aid)
                        return (
                          <span key={aid} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: '#e8f0fe', borderRadius: 8, fontSize: 11, color: '#1a3a5c', fontWeight: 500 }}>
                            {form.activosNombres?.[idx] || a?.marca || aid}
                            <button onClick={() => {
                              set('activosIds', form.activosIds.filter(x => x !== aid))
                              set('activosNombres', (form.activosNombres || []).filter((_, i) => i !== idx))
                            }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                  {/* Buscador */}
                  <div style={{ position: 'relative' }}>
                    <input style={s.input} placeholder="Buscar activo por marca, modelo, serie..."
                      value={busqActivo} onChange={e => { setBusqActivo(e.target.value); setShowActivoDrop(true) }}
                      onFocus={() => setShowActivoDrop(true)} onBlur={() => setTimeout(() => setShowActivoDrop(false), 200)} />
                    {showActivoDrop && busqActivo && (() => {
                      const q = busqActivo.toLowerCase()
                      const filtrados = activos.filter(a => {
                        if (form.activosIds?.includes(a.id)) return false
                        return (a.marca || '').toLowerCase().includes(q) || (a.modelo || '').toLowerCase().includes(q) || (a.nroSerie || '').toLowerCase().includes(q) || (a.ubicacion || '').toLowerCase().includes(q)
                      })
                      if (filtrados.length === 0) return null
                      return (
                        <div style={s.dropdown}>
                          {filtrados.slice(0, 6).map(a => (
                            <div key={a.id} onMouseDown={() => {
                              const label = [a.marca, a.modelo, a.nroSerie ? `S/N: ${a.nroSerie}` : ''].filter(Boolean).join(' ')
                              set('activosIds', [...(form.activosIds || []), a.id])
                              set('activosNombres', [...(form.activosNombres || []), label])
                              setBusqActivo('')
                            }} style={s.dropItem}
                              onMouseEnter={e => e.currentTarget.style.background = '#f0f4f8'}
                              onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                              <div style={{ fontWeight: 500, fontSize: 12 }}>{a.marca} {a.modelo}</div>
                              <div style={{ fontSize: 10, color: '#888' }}>
                                {[a.tipo, a.nroSerie ? `S/N: ${a.nroSerie}` : '', a.ubicacion].filter(Boolean).join(' · ')}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                </div>

                <div style={{ gridColumn: '1/-1', ...s.campo }}>
                  <label style={s.label}>Notas internas</label>
                  <textarea style={{ ...s.input, minHeight: '70px', resize: 'vertical' }} value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Observaciones del lead..." />
                </div>
              </div>
              </>}
            </div>
          )}

          {/* TAB CHAT */}
          {!esNuevo && tab === 'chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={s.chatArea}>
                {notas.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                    <p style={{ fontSize: '1.5rem', margin: 0 }}>💬</p>
                    <p style={{ fontSize: '0.88rem' }}>Sin notas aún.</p>
                  </div>
                )}
                {notas.map(n => (
                  <div key={n.id} style={s.notaBurbuja}>
                    <div style={s.notaAutor}>{n.autor} · {new Date(n.fecha).toLocaleString('es-CR', { dateStyle: 'short', timeStyle: 'short' })}</div>
                    <div style={s.notaTexto}>{n.texto}</div>
                  </div>
                ))}
                <div ref={notasEndRef} />
              </div>
              <div style={s.chatInput}>
                <textarea style={s.textareaNota} value={nuevaNota} onChange={e => setNuevaNota(e.target.value)}
                  placeholder="Escribe una nota, seguimiento o mensaje..."
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarNota() } }} />
                <button style={s.btnEnviar} onClick={enviarNota}>Enviar</button>
              </div>
            </div>
          )}
        </div>

        {/* PIE solo para nuevo */}
        {esNuevo && (
          <div style={s.pie}>
            <button style={s.btnCancelar} onClick={onClose}>Cancelar</button>
            <button style={s.btnGuardar} onClick={guardar} disabled={guardando}>{guardando ? 'Guardando...' : 'Crear lead'}</button>
          </div>
        )}
      </div>
    </div>
  )
}

const estilos = {
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' },
  modal: { backgroundColor: '#fff', borderRadius: '16px', width: '100%', maxWidth: '680px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1.25rem 1.5rem', borderBottom: '1px solid #eee', gap: '1rem', flexShrink: 0 },
  inputTitulo: { width: '100%', border: 'none', fontSize: '1.1rem', fontWeight: 700, color: '#1a1a1a', outline: 'none', padding: 0, fontFamily: 'inherit' },
  selectPeq: { padding: '0.3rem 0.6rem', border: '1.5px solid #dde3ed', borderRadius: '6px', fontSize: '0.82rem', cursor: 'pointer' },
  badgeFact: { display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600 },
  tabs: { display: 'flex', borderBottom: '1px solid #eee', padding: '0 1.5rem', flexShrink: 0 },
  tab: { padding: '0.75rem 1rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.88rem', color: '#666', borderBottom: '2px solid transparent', marginBottom: '-1px', fontWeight: 500, fontFamily: 'inherit' },
  tabActivo: { color: '#1a3a5c', borderBottomColor: '#1a3a5c', fontWeight: 700 },
  cuerpo: { overflowY: 'auto', padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' },
  pie: { padding: '1rem 1.5rem', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexShrink: 0 },
  campo: { marginBottom: '0.5rem' },
  label: { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#444', marginBottom: '0.35rem' },
  input: { width: '100%', padding: '0.6rem 0.85rem', border: '1.5px solid #dde3ed', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', color: '#1a1a1a', background: '#fff' },
  btnCerrar: { background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#666', flexShrink: 0 },
  btnGuardar: { padding: '0.5rem 1.25rem', border: 'none', borderRadius: '8px', backgroundColor: '#1a3a5c', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', fontFamily: 'inherit' },
  btnCancelar: { padding: '0.6rem 1.25rem', border: '1.5px solid #dde3ed', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#444', fontFamily: 'inherit' },
  chatArea: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '200px', maxHeight: '340px', marginBottom: '1rem' },
  chatInput: { display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexShrink: 0 },
  textareaNota: { flex: 1, padding: '0.6rem 0.85rem', border: '1.5px solid #dde3ed', borderRadius: '8px', fontSize: '0.88rem', resize: 'none', minHeight: '60px', fontFamily: 'inherit', outline: 'none' },
  btnEnviar: { padding: '0.6rem 1.25rem', border: 'none', borderRadius: '8px', backgroundColor: '#1a3a5c', color: '#fff', cursor: 'pointer', fontWeight: 600, flexShrink: 0, fontFamily: 'inherit' },
  notaBurbuja: { backgroundColor: '#f0f4f8', borderRadius: '10px', padding: '0.75rem 1rem', maxWidth: '85%' },
  notaAutor: { fontSize: '0.72rem', color: '#999', marginBottom: '0.25rem', fontWeight: 600 },
  notaTexto: { fontSize: '0.88rem', color: '#1a1a1a', lineHeight: 1.5 },
  secTitulo: { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 },
  separador: { height: 1, background: '#f0f0f0', margin: '12px 0' },
  dropdown: { position: 'absolute', zIndex: 100, background: '#fff', border: '1px solid #dde3ed', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 200, overflowY: 'auto', width: '100%', marginTop: 2 },
  dropItem: { padding: '9px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f0f0f0', color: '#1a1a1a', background: '#fff', transition: 'background .1s' },
}