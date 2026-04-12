import { useState, useEffect } from 'react'
import {
  doc, getDoc, updateDoc, deleteDoc, collection, onSnapshot,
  addDoc, serverTimestamp, query, orderBy, getDocs
} from 'firebase/firestore'
import { db } from '../../../firebase/firestore'
import { useParams, useNavigate } from 'react-router-dom'

const ESTADOS = [
  { valor: 'activo',    label: 'Activo',    color: '#1b5e20', bg: '#e8f5e9' },
  { valor: 'pendiente', label: 'Pendiente', color: '#0d47a1', bg: '#e3f2fd' },
  { valor: 'pausa',     label: 'En pausa',  color: '#e65100', bg: '#fff3e0' },
  { valor: 'terminado', label: 'Terminado', color: '#4a148c', bg: '#f3e5f5' },
]
const EST_COT = [
  { valor: 'borrador',  label: 'Borrador',  color: '#666',    bg: '#f5f5f5' },
  { valor: 'enviada',   label: 'Enviada',   color: '#0d47a1', bg: '#e3f2fd' },
  { valor: 'aprobada',  label: 'Aprobada',  color: '#1b5e20', bg: '#e8f5e9' },
  { valor: 'rechazada', label: 'Rechazada', color: '#b71c1c', bg: '#ffebee' },
]
function getEstado(arr, v) { return arr.find(e => e.valor === v) || arr[0] }
function fmt$(v) { return '$' + parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

export default function ProyectoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [proyecto, setProyecto] = useState(null)
  const [cotizaciones, setCotizaciones] = useState([])
  const [equipos, setEquipos] = useState([])
  const [tab, setTab] = useState('cotizaciones')
  const [cargando, setCargando] = useState(true)
  const [config, setConfig] = useState({})

  // Modales
  const [modalEditProy, setModalEditProy] = useState(false)
  const [modalNuevaCot, setModalNuevaCot] = useState(false)
  const [modalNuevoEq, setModalNuevoEq] = useState(false)
  const [formProy, setFormProy] = useState({})
  const [formCot, setFormCot] = useState({ nombre: '', numero: '', fecha: new Date().toISOString().split('T')[0], estado: 'borrador', descripcion: '' })
  const [formEq, setFormEq] = useState({ nombre: '', descripcion: '' })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'config'), snap => {
      const docs = {}
      snap.docs.forEach(d => { docs[d.id] = d.data() })
      setConfig(docs.consecutivos || {})
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    async function cargar() {
      setCargando(true)
      const snap = await getDoc(doc(db, 'proyectos', id))
      if (!snap.exists()) { navigate('/proyectos'); return }
      setProyecto({ _id: snap.id, ...snap.data() })
      setFormProy({ ...snap.data() })
      setCargando(false)
    }
    cargar()
  }, [id])

  useEffect(() => {
    const q = query(collection(db, 'proyectos', id, 'cotizaciones'), orderBy('_ts', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setCotizaciones(snap.docs.map(d => ({ _id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [id])

  useEffect(() => {
    const q = query(collection(db, 'proyectos', id, 'equipos'), orderBy('_ts', 'asc'))
    const unsub = onSnapshot(q, snap => {
      setEquipos(snap.docs.map(d => ({ _id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [id])

  const abrirNuevaCot = () => {
    const prefijo = config.prefijoCotizacion || 'CTO'
    const num = cotizaciones.length + 1
    setFormCot({
      nombre: '', numero: prefijo + '-' + String(num).padStart(3, '0'),
      fecha: new Date().toISOString().split('T')[0],
      estado: 'borrador', descripcion: ''
    })
    setModalNuevaCot(true)
  }

  async function guardarProy() {
    setGuardando(true)
    await updateDoc(doc(db, 'proyectos', id), { ...formProy, _ts: serverTimestamp() })
    setProyecto(p => ({ ...p, ...formProy }))
    setGuardando(false)
    setModalEditProy(false)
  }

  async function eliminarProy() {
    if (!window.confirm('¿Eliminar este proyecto? Esta accion no se puede deshacer.')) return
    await deleteDoc(doc(db, 'proyectos', id))
    navigate('/proyectos')
  }

  async function crearCotizacion() {
    if (!formCot.nombre.trim()) return alert('Ingresa el nombre de la cotizacion')
    setGuardando(true)
    const ref = await addDoc(collection(db, 'proyectos', id, 'cotizaciones'), {
      nombre: formCot.nombre.trim(),
      numero: formCot.numero.trim(),
      fecha: formCot.fecha,
      estado: formCot.estado,
      descripcion: formCot.descripcion.trim(),
      totalSinIVA: 0, totalConIVA: 0,
      aprobada: false,
      _ts: serverTimestamp(),
    })
    await updateDoc(doc(db, 'proyectos', id), { numCotizaciones: cotizaciones.length + 1 })
    setGuardando(false)
    setModalNuevaCot(false)
    navigate('/proyectos/' + id + '/cotizacion/' + ref.id)
  }

  async function crearEquipo() {
    if (!formEq.nombre.trim()) return alert('Ingresa el nombre del equipo')
    setGuardando(true)
    await addDoc(collection(db, 'proyectos', id, 'equipos'), {
      nombre: formEq.nombre.trim(),
      descripcion: formEq.descripcion.trim(),
      items: [],
      _ts: serverTimestamp(),
    })
    setGuardando(false)
    setModalNuevoEq(false)
    setFormEq({ nombre: '', descripcion: '' })
  }

  async function eliminarEquipo(eqId) {
    if (!window.confirm('¿Eliminar este grupo de equipos?')) return
    await deleteDoc(doc(db, 'proyectos', id, 'equipos', eqId))
  }

  if (cargando) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--color-text-tertiary)' }}>
      Cargando proyecto...
    </div>
  )

  const est = getEstado(ESTADOS, proyecto.estado || 'activo')
  const totalAprobadas = cotizaciones.filter(c => c.aprobada).reduce((s, c) => s + (c.totalSinIVA || 0), 0)
  const totalGeneral = cotizaciones.reduce((s, c) => s + (c.totalSinIVA || 0), 0)

  return (
    <div style={{ padding: '24px 32px', minHeight: '100vh', background: 'var(--color-background-secondary)' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-tertiary)', marginBottom: 16 }}>
        <span onClick={() => navigate('/proyectos')} style={{ color: '#2e7d32', cursor: 'pointer', fontWeight: 500 }}>Proyectos</span>
        <span style={{ color: 'var(--color-border-secondary)' }}>›</span>
        <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{proyecto.nombre}</span>
      </div>

      {/* Header del proyecto */}
      <div style={{ background: 'var(--color-background-primary)', border: '1px solid var(--color-border-secondary)', borderRadius: 14, padding: '20px 24px', marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#2e7d32', background: 'rgba(46,125,50,.08)', padding: '3px 10px', borderRadius: 12, border: '1px solid rgba(46,125,50,.15)' }}>
                {proyecto.numero || '—'}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: est.bg, color: est.color, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                {est.label}
              </span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 2 }}>{proyecto.nombre}</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>{proyecto.cliente}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setFormProy({ ...proyecto }); setModalEditProy(true) }} style={S.btnGris}>
              Editar proyecto
            </button>
            <button onClick={() => navigate('/proyectos/' + id + '/propuesta')} style={S.btnVerde}>
              Generar propuesta
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13, color: 'var(--color-text-tertiary)' }}>
          {proyecto.fecha && <span>Fecha: <strong style={{ color: 'var(--color-text-primary)' }}>{proyecto.fecha}</strong></span>}
          {proyecto.ubicacion && <span>Ubicacion: <strong style={{ color: 'var(--color-text-primary)' }}>{proyecto.ubicacion}</strong></span>}
          {proyecto.descripcion && <span>Descripcion: <strong style={{ color: 'var(--color-text-primary)' }}>{proyecto.descripcion}</strong></span>}
        </div>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16 }}>
          {[
            { label: 'Cotizaciones', valor: cotizaciones.length, mono: false },
            { label: 'Aprobadas', valor: cotizaciones.filter(c => c.aprobada).length, mono: false },
            { label: 'Total general', valor: fmt$(totalGeneral), mono: true },
            { label: 'Total aprobado', valor: fmt$(totalAprobadas), mono: true, verde: true },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--color-text-tertiary)', fontWeight: 600, marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontFamily: k.mono ? 'monospace' : 'inherit', fontSize: 16, fontWeight: 700, color: k.verde ? '#2e7d32' : 'var(--color-text-primary)' }}>{k.valor}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid var(--color-border-secondary)', marginBottom: 20 }}>
        {[
          { k: 'cotizaciones', label: 'Cotizaciones (' + cotizaciones.length + ')' },
          { k: 'equipos', label: 'Equipos / Grupos (' + equipos.length + ')' },
          { k: 'resumen', label: 'Resumen' },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            padding: '10px 18px', fontSize: 13, fontWeight: tab === t.k ? 600 : 500,
            cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: 'transparent',
            color: tab === t.k ? '#2e7d32' : 'var(--color-text-secondary)',
            borderBottom: tab === t.k ? '2px solid #2e7d32' : '2px solid transparent',
            marginBottom: -2,
          }}>{t.label}</button>
        ))}
      </div>

      {/* TAB: Cotizaciones */}
      {tab === 'cotizaciones' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button onClick={abrirNuevaCot} style={S.btnVerde}>+ Nueva cotizacion</button>
          </div>
          {cotizaciones.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-tertiary)' }}>
              <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.25 }}>📄</div>
              <div style={{ fontSize: 14 }}>Sin cotizaciones aun</div>
            </div>
          ) : (
            cotizaciones.map(c => {
              const estC = getEstado(EST_COT, c.estado || 'borrador')
              return (
                <div key={c._id} style={{ background: 'var(--color-background-primary)', border: c.aprobada ? '2px solid #2e7d32' : '1.5px solid var(--color-border-secondary)', borderRadius: 10, padding: '16px 18px', marginBottom: 12, transition: 'all .15s', cursor: 'pointer', background: c.aprobada ? 'linear-gradient(135deg, var(--color-background-primary), #f8fff8)' : 'var(--color-background-primary)' }}
                  onClick={() => navigate('/proyectos/' + id + '/cotizacion/' + c._id)}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#2e7d32'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = c.aprobada ? '#2e7d32' : 'var(--color-border-secondary)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#1565c0', background: 'rgba(21,101,192,.08)', padding: '3px 10px', borderRadius: 6 }}>
                      {c.numero || 'sin numero'}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 14, flex: 1, color: 'var(--color-text-primary)' }}>{c.nombre}</span>
                    {c.aprobada && (
                      <span style={{ fontSize: 11, fontWeight: 700, background: '#2e7d32', color: '#fff', padding: '3px 10px', borderRadius: 12 }}>Aprobada</span>
                    )}
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: estC.bg, color: estC.color }}>
                      {estC.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--color-text-tertiary)', flexWrap: 'wrap' }}>
                    {c.fecha && <span>Fecha: {c.fecha}</span>}
                    {c.descripcion && <span>{c.descripcion}</span>}
                    {c.totalSinIVA > 0 && (
                      <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: '#2e7d32' }}>
                        {fmt$(c.totalSinIVA)} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-tertiary)' }}>+ IVA</span>
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* TAB: Equipos */}
      {tab === 'equipos' && (
        <div>
          <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#b45309', marginBottom: 14 }}>
            Los grupos de equipos son conjuntos de productos que se incluiran en las cotizaciones del proyecto. Crea grupos y agregales productos desde el cotizador.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button onClick={() => setModalNuevoEq(true)} style={S.btnVerde}>+ Nuevo grupo</button>
          </div>
          {equipos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-tertiary)' }}>
              <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.25 }}>🔧</div>
              <div style={{ fontSize: 14 }}>Sin grupos de equipos aun</div>
            </div>
          ) : (
            equipos.map(eq => (
              <div key={eq._id} style={{ background: 'var(--color-background-primary)', border: '1.5px solid var(--color-border-secondary)', borderRadius: 10, padding: '16px 18px', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: eq.items?.length ? 10 : 0 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>{eq.nombre}</div>
                    {eq.descripcion && <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{eq.descripcion}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{eq.items?.length || 0} item(s)</span>
                    <button onClick={() => eliminarEquipo(eq._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b71c1c', fontSize: 12, fontFamily: 'inherit' }}>
                      Eliminar
                    </button>
                  </div>
                </div>
                {eq.items?.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--color-border-tertiary)', paddingTop: 10 }}>
                    {eq.items.map((it, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-secondary)', padding: '4px 0', borderBottom: '1px solid var(--color-border-tertiary)' }}>
                        <span>{it.descripcion || it.nombre}</span>
                        <span style={{ fontFamily: 'monospace' }}>x{it.cantidad || 1} — {fmt$(it.precioUSD || 0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB: Resumen */}
      {tab === 'resumen' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: 'var(--color-background-primary)', border: '1px solid var(--color-border-secondary)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ background: '#e8f5e9', padding: '9px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: '#2e7d32' }}>
              Por estado
            </div>
            {EST_COT.map(e => {
              const n = cotizaciones.filter(c => c.estado === e.valor).length
              return (
                <div key={e.valor} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid rgba(0,0,0,.04)', fontSize: 13 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 8, background: e.bg, color: e.color, fontSize: 11, fontWeight: 600 }}>{e.label}</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{n} cotizacion{n !== 1 ? 'es' : ''}</span>
                </div>
              )
            })}
          </div>
          <div style={{ background: 'var(--color-background-primary)', border: '1px solid var(--color-border-secondary)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ background: '#e8f5e9', padding: '9px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: '#2e7d32' }}>
              Totales
            </div>
            {[
              { label: 'Total general (todas)', valor: fmt$(totalGeneral) },
              { label: 'Total aprobado', valor: fmt$(totalAprobadas), verde: true },
              { label: 'Cotizaciones', valor: cotizaciones.length },
              { label: 'Aprobadas', valor: cotizaciones.filter(c => c.aprobada).length },
              { label: 'Equipos/Grupos', valor: equipos.length },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid rgba(0,0,0,.04)', fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>{r.label}</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: r.verde ? '#2e7d32' : 'var(--color-text-primary)' }}>{r.valor}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal editar proyecto */}
      {modalEditProy && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setModalEditProy(false)}>
          <div style={S.modal}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--color-text-primary)' }}>Editar Proyecto</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.label}>Nombre *</label>
                <input style={S.input} value={formProy.nombre || ''} onChange={e => setFormProy(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.label}>Cliente *</label>
                <input style={S.input} value={formProy.cliente || ''} onChange={e => setFormProy(f => ({ ...f, cliente: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>N de Proyecto</label>
                <input style={{ ...S.input, fontFamily: 'monospace', color: '#2e7d32' }} value={formProy.numero || ''} onChange={e => setFormProy(f => ({ ...f, numero: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Fecha</label>
                <input type="date" style={S.input} value={formProy.fecha || ''} onChange={e => setFormProy(f => ({ ...f, fecha: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Estado</label>
                <select style={S.input} value={formProy.estado || 'activo'} onChange={e => setFormProy(f => ({ ...f, estado: e.target.value }))}>
                  {ESTADOS.map(e => <option key={e.valor} value={e.valor}>{e.label}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Ubicacion</label>
                <input style={S.input} value={formProy.ubicacion || ''} onChange={e => setFormProy(f => ({ ...f, ubicacion: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Presupuesto ($)</label>
                <input type="number" style={S.input} value={formProy.monto || ''} onChange={e => setFormProy(f => ({ ...f, monto: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.label}>Descripcion</label>
                <textarea style={{ ...S.input, resize: 'vertical', minHeight: 60 }} value={formProy.descripcion || ''} onChange={e => setFormProy(f => ({ ...f, descripcion: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--color-border-secondary)' }}>
              <button onClick={eliminarProy} style={{ ...S.btnRojo, marginRight: 'auto' }}>Eliminar proyecto</button>
              <button style={S.btnGris} onClick={() => setModalEditProy(false)}>Cancelar</button>
              <button style={S.btnVerde} onClick={guardarProy} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar cambios'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nueva cotizacion */}
      {modalNuevaCot && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setModalNuevaCot(false)}>
          <div style={{ ...S.modal, maxWidth: 480 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--color-text-primary)' }}>Nueva Cotizacion</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.label}>Nombre de la cotizacion *</label>
                <input style={S.input} placeholder="Ej: Opcion A — Mini Split 9000 BTU"
                  value={formCot.nombre} onChange={e => setFormCot(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Numero</label>
                <input style={{ ...S.input, fontFamily: 'monospace', color: '#1565c0' }} value={formCot.numero} onChange={e => setFormCot(f => ({ ...f, numero: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Fecha</label>
                <input type="date" style={S.input} value={formCot.fecha} onChange={e => setFormCot(f => ({ ...f, fecha: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Estado inicial</label>
                <select style={S.input} value={formCot.estado} onChange={e => setFormCot(f => ({ ...f, estado: e.target.value }))}>
                  {EST_COT.map(e => <option key={e.valor} value={e.valor}>{e.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.label}>Descripcion</label>
                <input style={S.input} placeholder="Descripcion breve..."
                  value={formCot.descripcion} onChange={e => setFormCot(f => ({ ...f, descripcion: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--color-border-secondary)' }}>
              <button style={S.btnGris} onClick={() => setModalNuevaCot(false)}>Cancelar</button>
              <button style={S.btnVerde} onClick={crearCotizacion} disabled={guardando}>{guardando ? 'Creando...' : 'Crear y abrir cotizador'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nuevo equipo */}
      {modalNuevoEq && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setModalNuevoEq(false)}>
          <div style={{ ...S.modal, maxWidth: 400 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--color-text-primary)' }}>Nuevo Grupo de Equipos</div>
            <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={S.label}>Nombre del grupo *</label>
                <input style={S.input} placeholder="Ej: Equipos Piso 1" value={formEq.nombre} onChange={e => setFormEq(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Descripcion</label>
                <input style={S.input} placeholder="Descripcion opcional" value={formEq.descripcion} onChange={e => setFormEq(f => ({ ...f, descripcion: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--color-border-secondary)' }}>
              <button style={S.btnGris} onClick={() => setModalNuevoEq(false)}>Cancelar</button>
              <button style={S.btnVerde} onClick={crearEquipo} disabled={guardando}>{guardando ? 'Creando...' : 'Crear grupo'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  btnVerde: { padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#2e7d32', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' },
  btnGris: { padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-secondary)', fontSize: 13, color: 'var(--color-text-secondary)' },
  btnRojo: { padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(183,28,28,.08)', border: '1px solid rgba(183,28,28,.2)', fontSize: 13, color: '#b71c1c' },
  input: { width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13, border: '1.5px solid var(--color-border-secondary)', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  label: { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal: { background: 'var(--color-background-primary)', borderRadius: 14, padding: 28, width: '95%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)', border: '1px solid var(--color-border-secondary)' },
}
