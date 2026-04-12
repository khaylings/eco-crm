/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: FichaLead.jsx
 * Módulo:  Leads
 * ============================================================
 */

import { useState, useEffect, useRef } from 'react'
import { getDocs, collection } from 'firebase/firestore'
import { db } from '../../../firebase/firestore'
import { crearLead, actualizarLead, agregarNotaLead, obtenerNotasLead } from '../../../firebase/contactos'

const PRIORIDADES = ['baja', 'media', 'alta']
const ICONOS_PRIO = { baja: '⚪', media: '🟡', alta: '🔴' }

const TIPOS_FACTURA = [
  { k: 'fisica',   l: '👤 Física',      desc: 'Persona natural / cédula física' },
  { k: 'juridica', l: '🏢 Jurídica',     desc: 'Empresa / cédula jurídica' },
  { k: 'nd',       l: '⬜ Por definir',  desc: 'Se definirá más adelante' },
]

export default function FichaLead({ lead, columnas, contactos, empresas, origenes, onClose, onGuardado }) {
  const esNuevo = !lead?.id
  const [tipoLead, setTipoLead] = useState(lead?.tipoLead || 'empresa')
  const [form, setForm] = useState({
    nombre: '', contactoId: '', empresaId: '', empresaNombre: '',
    sedeId: '', sedeNombre: '', origen: '',
    prioridad: 'media', etiquetas: '', whatsapp: '',
    vendedor: '', notas: '', columnaId: lead?.columnaId || '',
    tipoLead: 'empresa',
    tipoFactura: 'nd',
  })
  const [sedes, setSedes] = useState([])
  const [contactosSede, setContactosSede] = useState([])
  const [busqEmpresa, setBusqEmpresa] = useState('')
  const [busqContacto, setBusqContacto] = useState('')
  const [notas, setNotas] = useState([])
  const [nuevaNota, setNuevaNota] = useState('')
  const [tab, setTab] = useState('info')
  const [guardando, setGuardando] = useState(false)
  const notasEndRef = useRef(null)

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
    setBusqContacto(nombre)
    if (c.whatsapp) set('whatsapp', c.whatsapp)
    else if (c.telefono) set('whatsapp', c.telefono)
  }

  const empresasFiltradas = empresas.filter(e =>
    !busqEmpresa || (e.nombre || '').toLowerCase().includes(busqEmpresa.toLowerCase())
  )
  const contactosFiltrados = (tipoLead === 'empresa' ? contactosSede : contactos).filter(c =>
    !busqContacto || (c.nombre || c.nombreCompleto || '').toLowerCase().includes(busqContacto.toLowerCase())
  )

  const guardar = async () => {
    if (!form.nombre.trim()) return alert('El nombre del lead es requerido')
    if (!form.columnaId) return alert('Selecciona una etapa del pipeline')
    setGuardando(true)
    const data = {
      ...form,
      tipoLead,
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
              {/* Tipo lead */}
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
                    <label style={s.label}>Contacto{contactosSede.length > 0 ? ` (${contactosSede.length} disponibles)` : ''}</label>
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
                          </div>
                        ))}
                      </div>
                    )}
                    {form.contactoId && (
                      <div style={{ fontSize: 11, color: '#2e7d32', marginTop: 4 }}>✓ Contacto seleccionado</div>
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
                  <input style={s.input} value={form.vendedor} onChange={e => set('vendedor', e.target.value)} placeholder="Nombre del agente" />
                </div>
                <div style={s.campo}>
                  <label style={s.label}>Etiquetas (separadas por coma)</label>
                  <input style={s.input} value={form.etiquetas} onChange={e => set('etiquetas', e.target.value)} placeholder="Ej: urgente, campaña marzo" />
                </div>
                <div style={{ gridColumn: '1/-1', ...s.campo }}>
                  <label style={s.label}>Notas internas</label>
                  <textarea style={{ ...s.input, minHeight: '70px', resize: 'vertical' }} value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Observaciones del lead..." />
                </div>
              </div>
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