import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, addDoc, deleteDoc, doc,
  serverTimestamp, query, orderBy, getDocs
} from 'firebase/firestore'
import { db } from '../../../firebase/firestore'
import { useNavigate } from 'react-router-dom'

const ESTADOS = [
  { valor: 'activo',    label: 'Activo',    color: '#1b5e20', bg: '#e8f5e9' },
  { valor: 'pendiente', label: 'Pendiente', color: '#0d47a1', bg: '#e3f2fd' },
  { valor: 'pausa',     label: 'En pausa',  color: '#e65100', bg: '#fff3e0' },
  { valor: 'terminado', label: 'Terminado', color: '#4a148c', bg: '#f3e5f5' },
]
function getEstado(v) { return ESTADOS.find(e => e.valor === v) || ESTADOS[0] }
function fmtMoneda(v) {
  if (!v && v !== 0) return '—'
  return '$' + parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function autoNum(lista, prefijo) {
  return `${prefijo}-${String((lista.length || 0) + 1).padStart(3, '0')}`
}

const FORM_INIT = {
  nombre: '', numero: '', fecha: new Date().toISOString().split('T')[0],
  estado: 'activo', ubicacion: '', descripcion: '', monto: '', toneladas: '',
  // cliente
  modoCliente: 'empresa', // 'empresa' | 'lead'
  empresaId: '', empresaNombre: '',
  sedeId: '', sedeNombre: '',
  contactoId: '', contactoNombre: '',
  leadId: '', leadNombre: '',
  clienteTexto: '',
}

export default function ProyectosPage() {
  const navigate = useNavigate()
  const [proyectos, setProyectos] = useState([])
  const [filtro, setFiltro] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [modalNuevo, setModalNuevo] = useState(false)
  const [config, setConfig] = useState({})
  const [form, setForm] = useState({ ...FORM_INIT })
  const [guardando, setGuardando] = useState(false)

  // Datos para selectores
  const [empresas, setEmpresas] = useState([])
  const [sedes, setSedes] = useState([])
  const [contactos, setContactos] = useState([])
  const [leads, setLeads] = useState([])
  const [busqLead, setBusqLead] = useState('')
  const [busqEmpresa, setBusqEmpresa] = useState('')

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'config'), snap => {
      const docs = {}
      snap.docs.forEach(d => { docs[d.id] = d.data() })
      setConfig(docs.consecutivos || {})
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'proyectos'), orderBy('_ts', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setProyectos(snap.docs.map(d => ({ _id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  // Cargar empresas y leads al abrir modal
  useEffect(() => {
    if (!modalNuevo) return
    const prefijo = config.prefijoProyecto || 'PRY'
    setForm({ ...FORM_INIT, numero: autoNum(proyectos, prefijo) })
    getBusquedas()
  }, [modalNuevo])

  async function getBusquedas() {
    const [eSnap, lSnap] = await Promise.all([
      getDocs(query(collection(db, 'empresas'), orderBy('nombre', 'asc'))),
      getDocs(query(collection(db, 'leads'), orderBy('nombre', 'asc'))),
    ])
    setEmpresas(eSnap.docs.map(d => ({ _id: d.id, ...d.data() })))
    setLeads(lSnap.docs.map(d => ({ _id: d.id, ...d.data() })))
  }

  async function cargarSedes(empresaId) {
    const snap = await getDocs(collection(db, 'empresas', empresaId, 'sedes'))
    setSedes(snap.docs.map(d => ({ _id: d.id, ...d.data() })))
    setContactos([])
    setForm(f => ({ ...f, sedeId: '', sedeNombre: '', contactoId: '', contactoNombre: '' }))
  }

  async function cargarContactos(empresaId, sedeId) {
    const snap = await getDocs(collection(db, 'contactos'))
    const todos = snap.docs.map(d => ({ _id: d.id, ...d.data() }))
    const filtrados = todos.filter(c => c.empresaId === empresaId && (!sedeId || c.sedeId === sedeId))
    setContactos(filtrados)
    setForm(f => ({ ...f, contactoId: '', contactoNombre: '' }))
  }

  const proyFiltrados = proyectos.filter(p => {
    const mF = filtro === 'todos' || (p.estado || 'activo') === filtro
    const mB = !busqueda ||
      (p.nombre || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.clienteTexto || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.numero || '').toLowerCase().includes(busqueda.toLowerCase())
    return mF && mB
  })

  async function crearProyecto() {
    if (!form.nombre.trim()) return alert('Ingresa el nombre del proyecto')
    const clienteTexto = form.modoCliente === 'empresa'
      ? [form.empresaNombre, form.sedeNombre, form.contactoNombre].filter(Boolean).join(' — ')
      : form.leadNombre
    if (!clienteTexto) return alert('Selecciona un cliente')
    setGuardando(true)
    await addDoc(collection(db, 'proyectos'), {
      nombre: form.nombre.trim(),
      numero: form.numero.trim(),
      fecha: form.fecha,
      estado: form.estado,
      ubicacion: form.ubicacion.trim(),
      descripcion: form.descripcion.trim(),
      monto: parseFloat(form.monto) || 0,
      toneladas: parseFloat(form.toneladas) || 0,
      clienteTexto,
      empresaId: form.empresaId || null,
      empresaNombre: form.empresaNombre || null,
      sedeId: form.sedeId || null,
      sedeNombre: form.sedeNombre || null,
      contactoId: form.contactoId || null,
      contactoNombre: form.contactoNombre || null,
      leadId: form.leadId || null,
      leadNombre: form.leadNombre || null,
      numCotizaciones: 0,
      _ts: serverTimestamp(),
    })
    setGuardando(false)
    setModalNuevo(false)
  }

  async function eliminarProyecto(e, proyId) {
    e.stopPropagation()
    if (!window.confirm('¿Eliminar este proyecto? Esta acción no se puede deshacer.')) return
    await deleteDoc(doc(db, 'proyectos', proyId))
  }

  const cnt = {
    todos: proyectos.length,
    activo: proyectos.filter(p => (p.estado || 'activo') === 'activo').length,
    pendiente: proyectos.filter(p => p.estado === 'pendiente').length,
    pausa: proyectos.filter(p => p.estado === 'pausa').length,
    terminado: proyectos.filter(p => p.estado === 'terminado').length,
  }

  const empresasFiltradas = empresas.filter(e =>
    !busqEmpresa || (e.nombre || '').toLowerCase().includes(busqEmpresa.toLowerCase())
  )
  const leadsFiltrados = leads.filter(l =>
    !busqLead || (l.nombre || '').toLowerCase().includes(busqLead.toLowerCase()) ||
    (l.empresa || '').toLowerCase().includes(busqLead.toLowerCase())
  )

  return (
    <div style={{ padding: '28px 32px', minHeight: '100vh', background: 'var(--color-background-secondary)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.4px' }}>Proyectos</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginTop: 3 }}>
            {proyectos.length} proyecto{proyectos.length !== 1 ? 's' : ''} registrados
          </div>
        </div>
        <button onClick={() => setModalNuevo(true)} style={S.btnVerde}>+ Nuevo proyecto</button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Buscar nombre, cliente o numero..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ ...S.input, maxWidth: 300, background: '#fff', color: '#1a1a1a', border: '1.5px solid #dde3ed' }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { k: 'todos',     label: `Todos (${cnt.todos})` },
            { k: 'activo',    label: `Activos (${cnt.activo})` },
            { k: 'pendiente', label: `Pendientes (${cnt.pendiente})` },
            { k: 'pausa',     label: `En pausa (${cnt.pausa})` },
            { k: 'terminado', label: `Terminados (${cnt.terminado})` },
          ].map(f => (
            <button key={f.k} onClick={() => setFiltro(f.k)} style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid',
              borderColor: filtro === f.k ? '#2e7d32' : '#dde3ed',
              background: filtro === f.k ? '#e8f5e9' : '#fff',
              color: filtro === f.k ? '#1b5e20' : '#555',
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* Cards */}
      {proyFiltrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: '#aaa' }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.25 }}>📁</div>
          <div style={{ fontSize: 14 }}>No hay proyectos{filtro !== 'todos' ? ' en este estado' : ''}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {proyFiltrados.map(p => {
            const est = getEstado(p.estado || 'activo')
            return (
              <div key={p._id} onClick={() => navigate(`/proyectos/${p._id}`)} style={S.card}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#2e7d32'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(46,125,50,.14)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#dde3ed'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.06)' }}
              >
                <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#2e7d32', background: 'rgba(46,125,50,.08)', padding: '3px 10px', borderRadius: 12, border: '1px solid rgba(46,125,50,.15)' }}>
                      {p.numero || '—'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: est.bg, color: est.color, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                        {est.label}
                      </span>
                      <button onClick={e => eliminarProyecto(e, p._id)} title="Eliminar proyecto"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 16, lineHeight: 1, padding: '2px 4px', borderRadius: 4 }}
                        onMouseEnter={e => e.currentTarget.style.color = '#b71c1c'}
                        onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
                      >×</button>
                    </div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 3 }}>{p.nombre || 'Sin nombre'}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{p.clienteTexto || '—'}</div>
                </div>
                <div style={{ padding: '10px 18px' }}>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {p.fecha && <span style={{ fontSize: 12, color: '#888' }}>Fecha: <strong style={{ color: '#1a1a1a' }}>{p.fecha}</strong></span>}
                    {p.toneladas > 0 && <span style={{ fontSize: 12, color: '#888' }}>TR: <strong style={{ color: '#1a1a1a' }}>{p.toneladas}</strong></span>}
                    {p.ubicacion && <span style={{ fontSize: 12, color: '#888' }}>📍 {p.ubicacion}</span>}
                  </div>
                </div>
                <div style={{ padding: '10px 18px', background: '#fafafa', borderTop: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: '#aaa' }}>{p.numCotizaciones || 0} cotizacion{(p.numCotizaciones || 0) !== 1 ? 'es' : ''}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#2e7d32' }}>{p.monto ? fmtMoneda(p.monto) : '—'}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Nuevo Proyecto */}
      {modalNuevo && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setModalNuevo(false)}>
          <div style={S.modal}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: '#1a1a1a' }}>Nuevo Proyecto</div>

            {/* Datos básicos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.label}>Nombre del proyecto *</label>
                <input style={S.inp} placeholder="Ej: A/C Oficinas Torre Norte"
                  value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>N de Proyecto</label>
                <input style={{ ...S.inp, fontFamily: 'monospace', color: '#2e7d32', fontWeight: 700 }}
                  value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Fecha</label>
                <input type="date" style={S.inp} value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Estado</label>
                <select style={S.inp} value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                  {ESTADOS.map(e => <option key={e.valor} value={e.valor}>{e.label}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Ubicacion</label>
                <input style={S.inp} placeholder="Ej: San Jose, CR" value={form.ubicacion} onChange={e => setForm(f => ({ ...f, ubicacion: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Toneladas TR</label>
                <input type="number" step="0.5" min="0" style={S.inp} placeholder="Ej: 7.5"
                  value={form.toneladas} onChange={e => setForm(f => ({ ...f, toneladas: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Presupuesto ($)</label>
                <input type="number" style={S.inp} placeholder="0.00"
                  value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.label}>Descripcion</label>
                <textarea style={{ ...S.inp, resize: 'vertical', minHeight: 60 }} placeholder="Descripcion del proyecto..."
                  value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
              </div>
            </div>

            {/* Sección cliente */}
            <div style={{ borderTop: '1px solid #eee', paddingTop: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>Asociar cliente *</div>

              {/* Toggle modo */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {[
                  { k: 'empresa', label: 'Por empresa / sede' },
                  { k: 'lead', label: 'Por lead / contacto' },
                ].map(t => (
                  <button key={t.k} onClick={() => setForm(f => ({ ...f, modoCliente: t.k }))} style={{
                    flex: 1, padding: '7px', borderRadius: 8, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer',
                    border: '1.5px solid', fontWeight: form.modoCliente === t.k ? 600 : 400,
                    borderColor: form.modoCliente === t.k ? '#2e7d32' : '#dde3ed',
                    background: form.modoCliente === t.k ? '#e8f5e9' : '#f9f9f9',
                    color: form.modoCliente === t.k ? '#1b5e20' : '#555',
                  }}>{t.label}</button>
                ))}
              </div>

              {/* Modo empresa */}
              {form.modoCliente === 'empresa' && (
                <div style={{ display: 'grid', gap: 10 }}>
                  <div>
                    <label style={S.label}>Empresa</label>
                    <input style={S.inp} placeholder="Buscar empresa..."
                      value={busqEmpresa} onChange={e => setBusqEmpresa(e.target.value)} />
                    {busqEmpresa && empresasFiltradas.length > 0 && (
                      <div style={S.dropdown}>
                        {empresasFiltradas.slice(0, 6).map(emp => (
                          <div key={emp._id} onClick={() => {
                            setForm(f => ({ ...f, empresaId: emp._id, empresaNombre: emp.nombre }))
                            setBusqEmpresa(emp.nombre)
                            cargarSedes(emp._id)
                          }} style={S.dropItem}>
                            {emp.nombre}
                          </div>
                        ))}
                      </div>
                    )}
                    {form.empresaNombre && (
                      <div style={{ fontSize: 11, color: '#2e7d32', marginTop: 4 }}>✓ {form.empresaNombre}</div>
                    )}
                  </div>

                  {sedes.length > 0 && (
                    <div>
                      <label style={S.label}>Sede</label>
                      <select style={S.inp} value={form.sedeId}
                        onChange={e => {
                          const sede = sedes.find(s => s._id === e.target.value)
                          setForm(f => ({ ...f, sedeId: e.target.value, sedeNombre: sede?.nombre || '' }))
                          if (form.empresaId) cargarContactos(form.empresaId, e.target.value)
                        }}>
                        <option value="">-- Seleccionar sede --</option>
                        {sedes.map(s => <option key={s._id} value={s._id}>{s.nombre}</option>)}
                      </select>
                    </div>
                  )}

                  {contactos.length > 0 && (
                    <div>
                      <label style={S.label}>Contacto de la sede</label>
                      <select style={S.inp} value={form.contactoId}
                        onChange={e => {
                          const c = contactos.find(x => x._id === e.target.value)
                          setForm(f => ({ ...f, contactoId: e.target.value, contactoNombre: c ? (c.nombre || c.nombreCompleto || '') : '' }))
                        }}>
                        <option value="">-- Seleccionar contacto --</option>
                        {contactos.map(c => <option key={c._id} value={c._id}>{c.nombre || c.nombreCompleto}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Modo lead */}
              {form.modoCliente === 'lead' && (
                <div>
                  <label style={S.label}>Lead / Contacto</label>
                  <input style={S.inp} placeholder="Buscar lead por nombre o empresa..."
                    value={busqLead} onChange={e => setBusqLead(e.target.value)} />
                  {busqLead && leadsFiltrados.length > 0 && (
                    <div style={S.dropdown}>
                      {leadsFiltrados.slice(0, 6).map(l => (
                        <div key={l._id} onClick={() => {
                          setForm(f => ({ ...f, leadId: l._id, leadNombre: l.nombre || l.nombreCompleto || '' }))
                          setBusqLead(l.nombre || l.nombreCompleto || '')
                        }} style={S.dropItem}>
                          <div style={{ fontWeight: 500 }}>{l.nombre || l.nombreCompleto}</div>
                          {l.empresa && <div style={{ fontSize: 11, color: '#888' }}>{l.empresa}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  {form.leadNombre && (
                    <div style={{ fontSize: 11, color: '#2e7d32', marginTop: 4 }}>✓ {form.leadNombre}</div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid #eee' }}>
              <button style={S.btnGris} onClick={() => setModalNuevo(false)}>Cancelar</button>
              <button style={S.btnVerde} onClick={crearProyecto} disabled={guardando}>
                {guardando ? 'Guardando...' : '+ Crear proyecto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  btnVerde: { padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#2e7d32', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' },
  btnGris:  { padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', background: '#f5f5f5', border: '1px solid #ddd', fontSize: 13, color: '#555' },
  inp:   { width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13, border: '1.5px solid #dde3ed', background: '#fff', color: '#1a1a1a', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  input: { width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13, border: '1.5px solid #dde3ed', background: '#fff', color: '#1a1a1a', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  label: { display: 'block', fontSize: 10, fontWeight: 600, color: '#888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.5px' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal: { background: '#fff', borderRadius: 14, padding: 28, width: '95%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)', border: '1px solid #e0e0e0' },
  card: { background: '#fff', border: '1.5px solid #dde3ed', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.06)', transition: 'all .18s' },
  dropdown: { position: 'absolute', zIndex: 100, background: '#fff', border: '1px solid #dde3ed', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 200, overflowY: 'auto', width: '100%', marginTop: 2 },
  dropItem: { padding: '9px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f0f0f0', color: '#1a1a1a', transition: 'background .1s' },
}