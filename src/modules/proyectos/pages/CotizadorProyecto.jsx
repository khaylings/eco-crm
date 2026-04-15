import { useState, useEffect, useRef } from 'react'
import {
  doc, getDoc, updateDoc, collection, onSnapshot,
  query, orderBy, getDocs, serverTimestamp
} from 'firebase/firestore'
import { db } from '../../../firebase/firestore'
import { useParams, useNavigate } from 'react-router-dom'

const PCT_DEFAULTS = { pctAdmin: 10, pctIngenieria: 5, pctSupervision: 5, pctImprevistos: 3, pctUtilidad: 15, pctIVA: 13 }

import { fmt as _fmt } from '../../../lib/formatMoneda'
function fmt$(v, mon = 'USD') { return _fmt(v, mon) }
function fmt2(v) { return parseFloat(v || 0).toFixed(2) }

export default function CotizadorProyecto() {
  const { proyId, cotId } = useParams()
  const navigate = useNavigate()

  const [proyecto, setProyecto] = useState(null)
  const [cotizacion, setCotizacion] = useState(null)
  const [productos, setProductos] = useState([])
  const [equiposProyecto, setEquiposProyecto] = useState([])
  const [config, setConfig] = useState({})
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  // Secciones del cotizador
  const [productosSeleccionados, setProductosSeleccionados] = useState([])
  const [equiposSeleccionados, setEquiposSeleccionados] = useState([])
  const [adicionales, setAdicionales] = useState([])
  const [viaticos, setViaticos] = useState({ alimentacion: 0, hospedaje: 0, movilizacion: 0 })
  const [porcentajes, setPorcentajes] = useState({ ...PCT_DEFAULTS })
  const [notas, setNotas] = useState('')
  const [tab, setTab] = useState('productos')

  // Modales
  const [modalProducto, setModalProducto] = useState(false)
  const [busqProd, setBusqProd] = useState('')
  const [tipoAgregado, setTipoAgregado] = useState('existente')
  const [prodNuevo, setProdNuevo] = useState({ nombre: '', precio: '', cantidad: 1, unidad: 'Unidad', descripcion: '' })
  const [modalEquipo, setModalEquipo] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'config'), snap => {
      const docs = {}
      snap.docs.forEach(d => { docs[d.id] = d.data() })
      setConfig(docs.empresa || {})
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    async function cargar() {
      setCargando(true)
      const [pSnap, cSnap, prodSnap, eqSnap] = await Promise.all([
        getDoc(doc(db, 'proyectos', proyId)),
        getDoc(doc(db, 'proyectos', proyId, 'cotizaciones', cotId)),
        getDocs(query(collection(db, 'productos'), orderBy('nombre', 'asc'))),
        getDocs(query(collection(db, 'proyectos', proyId, 'equipos'), orderBy('_ts', 'asc'))),
      ])
      if (!pSnap.exists() || !cSnap.exists()) { navigate('/proyectos/' + proyId); return }
      const cData = { _id: cSnap.id, ...cSnap.data() }
      setProyecto({ _id: pSnap.id, ...pSnap.data() })
      setCotizacion(cData)
      setProductos(prodSnap.docs.map(d => ({ _id: d.id, ...d.data() })))
      setEquiposProyecto(eqSnap.docs.map(d => ({ _id: d.id, ...d.data() })))
      // Restaurar datos guardados
      if (cData.productosSeleccionados) setProductosSeleccionados(cData.productosSeleccionados)
      if (cData.equiposSeleccionados) setEquiposSeleccionados(cData.equiposSeleccionados)
      if (cData.adicionales) setAdicionales(cData.adicionales)
      if (cData.viaticos) setViaticos(cData.viaticos)
      if (cData.porcentajes) setPorcentajes({ ...PCT_DEFAULTS, ...cData.porcentajes })
      if (cData.notas) setNotas(cData.notas)
      setCargando(false)
    }
    cargar()
  }, [proyId, cotId])

  // ── Calculos ──────────────────────────────────────────────────────────────
  const calcTotales = () => {
    const costoProductos = productosSeleccionados.reduce((s, p) => s + (p.precio || 0) * (p.cantidad || 1), 0)
    const costoEquipos = equiposSeleccionados.reduce((s, e) => {
      const eq = equiposProyecto.find(x => x._id === e.equipoId)
      if (!eq) return s
      return s + (eq.items || []).reduce((ss, it) => ss + (it.precioUSD || 0) * (it.cantidad || 1), 0)
    }, 0)
    const costoAdicionales = adicionales.reduce((s, a) => s + (a.precio || 0) * (a.cantidad || 1), 0)
    const costoViaticos = (viaticos.alimentacion || 0) + (viaticos.hospedaje || 0) + (viaticos.movilizacion || 0)
    const subtotal = costoProductos + costoEquipos + costoAdicionales + costoViaticos
    const gastosAdmin = subtotal * (porcentajes.pctAdmin / 100)
    const ingenieria = subtotal * (porcentajes.pctIngenieria / 100)
    const supervision = subtotal * (porcentajes.pctSupervision / 100)
    const imprevistos = subtotal * (porcentajes.pctImprevistos / 100)
    const totalSinUtil = subtotal + gastosAdmin + ingenieria + supervision + imprevistos
    const utilidad = totalSinUtil * (porcentajes.pctUtilidad / 100)
    const totalSinIVA = totalSinUtil + utilidad
    const iva = totalSinIVA * (porcentajes.pctIVA / 100)
    const totalConIVA = totalSinIVA + iva
    return { costoProductos, costoEquipos, costoAdicionales, costoViaticos, subtotal, gastosAdmin, ingenieria, supervision, imprevistos, totalSinUtil, utilidad, totalSinIVA, iva, totalConIVA }
  }
  const T = calcTotales()

  // ── Guardar ───────────────────────────────────────────────────────────────
  async function guardar(marcarAprobada = null) {
    setGuardando(true)
    const data = {
      productosSeleccionados, equiposSeleccionados, adicionales, viaticos, porcentajes, notas,
      totalSinIVA: T.totalSinIVA, totalConIVA: T.totalConIVA,
      _ts: serverTimestamp(),
    }
    if (marcarAprobada !== null) data.aprobada = marcarAprobada
    await updateDoc(doc(db, 'proyectos', proyId, 'cotizaciones', cotId), data)
    setCotizacion(c => ({ ...c, ...data }))
    setGuardando(false)
    alert('Cotizacion guardada')
  }

  // ── Agregar producto existente ─────────────────────────────────────────────
  function agregarProductoExistente(prod) {
    const existe = productosSeleccionados.find(p => p.productoId === prod._id)
    if (existe) {
      setProductosSeleccionados(ps => ps.map(p => p.productoId === prod._id ? { ...p, cantidad: (p.cantidad || 1) + 1 } : p))
    } else {
      const precioLista = prod.preciosLista?.[0]?.precio || prod.precioCompra || 0
      setProductosSeleccionados(ps => [...ps, {
        productoId: prod._id, nombre: prod.nombre, descripcion: prod.descripcion || '',
        precio: precioLista, cantidad: 1, unidad: prod.unidad || 'Unidad',
        esCompuesto: !!(prod.componentes?.length), componentes: prod.componentes || [],
        soloProyecto: false,
      }])
    }
    setModalProducto(false)
    setBusqProd('')
  }

  function agregarProductoNuevo() {
    if (!prodNuevo.nombre.trim()) return alert('Ingresa el nombre')
    setProductosSeleccionados(ps => [...ps, {
      productoId: null, nombre: prodNuevo.nombre.trim(),
      descripcion: prodNuevo.descripcion.trim(),
      precio: parseFloat(prodNuevo.precio) || 0,
      cantidad: parseInt(prodNuevo.cantidad) || 1,
      unidad: prodNuevo.unidad || 'Unidad',
      esCompuesto: false, soloProyecto: true,
    }])
    setProdNuevo({ nombre: '', precio: '', cantidad: 1, unidad: 'Unidad', descripcion: '' })
    setModalProducto(false)
  }

  function quitarProducto(idx) { setProductosSeleccionados(ps => ps.filter((_, i) => i !== idx)) }
  function actualizarProd(idx, campo, val) { setProductosSeleccionados(ps => ps.map((p, i) => i === idx ? { ...p, [campo]: val } : p)) }

  // ── Equipos ───────────────────────────────────────────────────────────────
  function toggleEquipo(eq) {
    const existe = equiposSeleccionados.find(e => e.equipoId === eq._id)
    if (existe) {
      setEquiposSeleccionados(es => es.filter(e => e.equipoId !== eq._id))
    } else {
      setEquiposSeleccionados(es => [...es, { equipoId: eq._id, nombre: eq.nombre }])
    }
  }

  // ── Adicionales ───────────────────────────────────────────────────────────
  function agregarAdicional() { setAdicionales(a => [...a, { descripcion: '', precio: 0, cantidad: 1 }]) }
  function quitarAdicional(i) { setAdicionales(a => a.filter((_, idx) => idx !== i)) }
  function actualizarAd(i, campo, val) { setAdicionales(a => a.map((x, idx) => idx === i ? { ...x, [campo]: val } : x)) }

  const prodFiltrados = productos.filter(p =>
    !busqProd || (p.nombre || '').toLowerCase().includes(busqProd.toLowerCase()) ||
    (p.descripcion || '').toLowerCase().includes(busqProd.toLowerCase())
  )

  if (cargando) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--color-text-tertiary)', fontSize: 14 }}>
      Cargando cotizador...
    </div>
  )

  return (
    <div style={{ padding: '24px 32px', minHeight: '100vh', background: 'var(--color-background-secondary)' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-tertiary)', marginBottom: 16 }}>
        <span onClick={() => navigate('/proyectos')} style={{ color: '#2e7d32', cursor: 'pointer', fontWeight: 500 }}>Proyectos</span>
        <span>›</span>
        <span onClick={() => navigate('/proyectos/' + proyId)} style={{ color: '#2e7d32', cursor: 'pointer', fontWeight: 500 }}>{proyecto?.nombre}</span>
        <span>›</span>
        <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{cotizacion?.nombre}</span>
      </div>

      {/* Header cotizacion */}
      <div style={{ background: 'var(--color-background-primary)', border: '1px solid var(--color-border-secondary)', borderRadius: 14, padding: '18px 24px', marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#1565c0', background: 'rgba(21,101,192,.08)', padding: '3px 10px', borderRadius: 6 }}>
              {cotizacion?.numero}
            </span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>{cotizacion?.nombre}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Proyecto: {proyecto?.nombre} — Cliente: {proyecto?.cliente}</div>
            </div>
            {cotizacion?.aprobada && (
              <span style={{ fontSize: 11, fontWeight: 700, background: '#2e7d32', color: '#fff', padding: '3px 10px', borderRadius: 12 }}>Aprobada</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!cotizacion?.aprobada && (
              <button onClick={() => guardar(true)} style={{ ...S.btnAzul }}>Marcar aprobada</button>
            )}
            {cotizacion?.aprobada && (
              <button onClick={() => guardar(false)} style={S.btnGris}>Desaprobar</button>
            )}
            <button onClick={() => guardar(null)} style={S.btnVerde} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
        {/* Total inline */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, gap: 20 }}>
          <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>
            Sin IVA: <strong style={{ fontFamily: 'monospace', color: '#2e7d32', fontSize: 15 }}>{fmt$(T.totalSinIVA)}</strong>
          </span>
          <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>
            Con IVA: <strong style={{ fontFamily: 'monospace', color: '#2e7d32', fontSize: 15 }}>{fmt$(T.totalConIVA)}</strong>
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
        {/* Columna izquierda */}
        <div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid var(--color-border-secondary)', marginBottom: 16 }}>
            {[
              { k: 'productos', label: 'Productos / Actividades (' + productosSeleccionados.length + ')' },
              { k: 'equipos', label: 'Equipos (' + equiposSeleccionados.length + ')' },
              { k: 'adicionales', label: 'Adicionales (' + adicionales.length + ')' },
              { k: 'viaticos', label: 'Viaticos' },
              { k: 'notas', label: 'Notas' },
            ].map(t => (
              <button key={t.k} onClick={() => setTab(t.k)} style={{
                padding: '8px 14px', fontSize: 12, fontWeight: tab === t.k ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: 'transparent',
                color: tab === t.k ? '#2e7d32' : 'var(--color-text-secondary)',
                borderBottom: tab === t.k ? '2px solid #2e7d32' : '2px solid transparent',
                marginBottom: -2, whiteSpace: 'nowrap',
              }}>{t.label}</button>
            ))}
          </div>

          {/* TAB Productos */}
          {tab === 'productos' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button onClick={() => setModalProducto(true)} style={S.btnVerde}>+ Agregar producto</button>
              </div>
              {productosSeleccionados.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-tertiary)' }}>
                  <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.2 }}>📦</div>
                  <div style={{ fontSize: 13 }}>Sin productos agregados</div>
                </div>
              ) : (
                <>
                  {/* Encabezado tabla */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 100px 36px', gap: 8, padding: '6px 12px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--color-text-tertiary)', fontWeight: 600 }}>
                    <span>Producto</span><span style={{ textAlign: 'center' }}>Cant.</span><span style={{ textAlign: 'right' }}>Precio</span><span style={{ textAlign: 'right' }}>Total</span><span></span>
                  </div>
                  {productosSeleccionados.map((p, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 100px 36px', gap: 8, alignItems: 'center', padding: '8px 12px', background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 8, marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--color-text-primary)' }}>
                          {p.nombre}
                          {p.soloProyecto && <span style={{ marginLeft: 6, fontSize: 10, background: '#fff8e1', color: '#b45309', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>Solo proyecto</span>}
                          {p.esCompuesto && <span style={{ marginLeft: 6, fontSize: 10, background: '#e3f2fd', color: '#1565c0', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>Compuesto</span>}
                        </div>
                        {p.descripcion && <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{p.descripcion}</div>}
                      </div>
                      <input type="number" min="1" value={p.cantidad} onChange={e => actualizarProd(i, 'cantidad', parseInt(e.target.value) || 1)}
                        style={{ ...S.inputPeq, textAlign: 'center' }} />
                      <input type="number" min="0" step="0.01" value={p.precio} onChange={e => actualizarProd(i, 'precio', parseFloat(e.target.value) || 0)}
                        style={{ ...S.inputPeq, textAlign: 'right' }} />
                      <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: '#2e7d32', textAlign: 'right' }}>
                        {fmt$((p.precio || 0) * (p.cantidad || 1))}
                      </div>
                      <button onClick={() => quitarProducto(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b71c1c', fontSize: 16 }}>×</button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* TAB Equipos */}
          {tab === 'equipos' && (
            <div>
              <div style={{ background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#1565c0', marginBottom: 14 }}>
                Selecciona los grupos de equipos creados en el proyecto para incluirlos en esta cotizacion.
              </div>
              {equiposProyecto.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-tertiary)' }}>
                  <div style={{ fontSize: 13 }}>No hay grupos de equipos en el proyecto.</div>
                  <button onClick={() => navigate('/proyectos/' + proyId)} style={{ marginTop: 10, ...S.btnGris }}>
                    Ir a crear grupos
                  </button>
                </div>
              ) : (
                equiposProyecto.map(eq => {
                  const seleccionado = equiposSeleccionados.some(e => e.equipoId === eq._id)
                  const totalEq = (eq.items || []).reduce((s, it) => s + (it.precioUSD || 0) * (it.cantidad || 1), 0)
                  return (
                    <div key={eq._id} onClick={() => toggleEquipo(eq)}
                      style={{ background: seleccionado ? 'rgba(46,125,50,.04)' : 'var(--color-background-primary)', border: seleccionado ? '2px solid #2e7d32' : '1.5px solid var(--color-border-secondary)', borderRadius: 10, padding: '14px 16px', marginBottom: 10, cursor: 'pointer', transition: 'all .15s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="checkbox" checked={seleccionado} onChange={() => {}} style={{ width: 16, height: 16, accentColor: '#2e7d32' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>{eq.nombre}</div>
                          {eq.descripcion && <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{eq.descripcion}</div>}
                          <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{eq.items?.length || 0} item(s)</div>
                        </div>
                        {totalEq > 0 && <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#2e7d32' }}>{fmt$(totalEq)}</div>}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* TAB Adicionales */}
          {tab === 'adicionales' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button onClick={agregarAdicional} style={S.btnVerde}>+ Agregar item</button>
              </div>
              {adicionales.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Sin adicionales</div>
              ) : (
                adicionales.map((a, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 36px', gap: 8, alignItems: 'center', padding: '8px 12px', background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 8, marginBottom: 6 }}>
                    <input style={S.inputPeq} placeholder="Descripcion del adicional"
                      value={a.descripcion} onChange={e => actualizarAd(i, 'descripcion', e.target.value)} />
                    <input type="number" min="1" style={{ ...S.inputPeq, textAlign: 'center' }}
                      value={a.cantidad} onChange={e => actualizarAd(i, 'cantidad', parseInt(e.target.value) || 1)} />
                    <input type="number" min="0" step="0.01" style={{ ...S.inputPeq, textAlign: 'right' }}
                      placeholder="Precio $" value={a.precio} onChange={e => actualizarAd(i, 'precio', parseFloat(e.target.value) || 0)} />
                    <button onClick={() => quitarAdicional(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b71c1c', fontSize: 16 }}>×</button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB Viaticos */}
          {tab === 'viaticos' && (
            <div style={{ background: 'var(--color-background-primary)', border: '1px solid var(--color-border-secondary)', borderRadius: 10, padding: '20px 24px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 16 }}>Viaticos y movilizacion</div>
              {[
                { k: 'alimentacion', label: 'Alimentacion ($)' },
                { k: 'hospedaje', label: 'Hospedaje ($)' },
                { k: 'movilizacion', label: 'Movilizacion ($)' },
              ].map(v => (
                <div key={v.k} style={{ marginBottom: 14 }}>
                  <label style={S.label}>{v.label}</label>
                  <input type="number" min="0" step="0.01" style={S.input}
                    value={viaticos[v.k]} onChange={e => setViaticos(x => ({ ...x, [v.k]: parseFloat(e.target.value) || 0 }))} />
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--color-border-secondary)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Total viaticos</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2e7d32' }}>
                  {fmt$((viaticos.alimentacion || 0) + (viaticos.hospedaje || 0) + (viaticos.movilizacion || 0))}
                </span>
              </div>
            </div>
          )}

          {/* TAB Notas */}
          {tab === 'notas' && (
            <div>
              <label style={{ ...S.label, marginBottom: 8 }}>Notas internas de la cotizacion</label>
              <textarea style={{ ...S.input, minHeight: 200, resize: 'vertical' }}
                placeholder="Observaciones, condiciones especiales, acuerdos con el cliente..."
                value={notas} onChange={e => setNotas(e.target.value)} />
            </div>
          )}
        </div>

        {/* Columna derecha — Resumen y porcentajes */}
        <div style={{ position: 'sticky', top: 20 }}>
          {/* Porcentajes */}
          <div style={{ background: 'var(--color-background-primary)', border: '1px solid var(--color-border-secondary)', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.5px' }}>Parametros (%)</div>
            {[
              { k: 'pctAdmin',       label: 'Gastos admin.' },
              { k: 'pctIngenieria',  label: 'Ingenieria' },
              { k: 'pctSupervision', label: 'Supervision' },
              { k: 'pctImprevistos',label: 'Imprevistos' },
              { k: 'pctUtilidad',   label: 'Utilidad' },
              { k: 'pctIVA',        label: 'IVA' },
            ].map(p => (
              <div key={p.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{p.label}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" min="0" max="100" step="0.5" value={porcentajes[p.k]}
                    onChange={e => setPorcentajes(x => ({ ...x, [p.k]: parseFloat(e.target.value) || 0 }))}
                    style={{ width: 58, padding: '4px 6px', borderRadius: 6, border: '1.5px solid var(--color-border-secondary)', fontFamily: 'monospace', fontSize: 12, textAlign: 'right', outline: 'none', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)' }} />
                  <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Resumen de totales */}
          <div style={{ background: 'var(--color-background-primary)', border: '1px solid var(--color-border-secondary)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: '#e8f5e9', padding: '9px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: '#2e7d32' }}>
              Resumen
            </div>
            {[
              { label: 'Productos', valor: T.costoProductos },
              { label: 'Equipos', valor: T.costoEquipos },
              { label: 'Adicionales', valor: T.costoAdicionales },
              { label: 'Viaticos', valor: T.costoViaticos },
            ].map(r => r.valor > 0 && (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 16px', borderBottom: '1px solid rgba(0,0,0,.04)', fontSize: 12 }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>{r.label}</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>{fmt$(r.valor)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 16px', borderBottom: '1px solid rgba(0,0,0,.04)', fontSize: 12, background: 'var(--color-background-secondary)' }}>
              <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>Subtotal</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fmt$(T.subtotal)}</span>
            </div>
            {[
              { label: 'Admin ' + porcentajes.pctAdmin + '%', valor: T.gastosAdmin },
              { label: 'Ingenieria ' + porcentajes.pctIngenieria + '%', valor: T.ingenieria },
              { label: 'Supervision ' + porcentajes.pctSupervision + '%', valor: T.supervision },
              { label: 'Imprevistos ' + porcentajes.pctImprevistos + '%', valor: T.imprevistos },
              { label: 'Utilidad ' + porcentajes.pctUtilidad + '%', valor: T.utilidad },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 16px', borderBottom: '1px solid rgba(0,0,0,.04)', fontSize: 12 }}>
                <span style={{ color: 'var(--color-text-tertiary)' }}>{r.label}</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>{fmt$(r.valor)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 16px', borderBottom: '2px solid var(--color-border-secondary)', fontSize: 13, background: 'var(--color-background-secondary)' }}>
              <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>Total sin IVA</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2e7d32', fontSize: 14 }}>{fmt$(T.totalSinIVA)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 16px', borderBottom: '1px solid rgba(0,0,0,.04)', fontSize: 12 }}>
              <span style={{ color: 'var(--color-text-tertiary)' }}>IVA {porcentajes.pctIVA}%</span>
              <span style={{ fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>{fmt$(T.iva)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', fontSize: 14, background: '#2e7d32', color: '#fff' }}>
              <span style={{ fontWeight: 700 }}>TOTAL CON IVA</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16 }}>{fmt$(T.totalConIVA)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal agregar producto */}
      {modalProducto && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setModalProducto(false)}>
          <div style={{ ...S.modal, maxWidth: 640 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--color-text-primary)' }}>Agregar Producto</div>
            {/* Tabs tipo */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[
                { k: 'existente', label: 'Elegir del catalogo' },
                { k: 'nuevo', label: 'Crear solo para este proyecto' },
              ].map(t => (
                <button key={t.k} onClick={() => setTipoAgregado(t.k)} style={{
                  flex: 1, padding: '8px', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer',
                  border: '1.5px solid', fontWeight: tipoAgregado === t.k ? 600 : 400,
                  borderColor: tipoAgregado === t.k ? '#2e7d32' : 'var(--color-border-secondary)',
                  background: tipoAgregado === t.k ? '#e8f5e9' : 'var(--color-background-secondary)',
                  color: tipoAgregado === t.k ? '#1b5e20' : 'var(--color-text-secondary)',
                }}>{t.label}</button>
              ))}
            </div>

            {tipoAgregado === 'existente' && (
              <>
                <input placeholder="Buscar producto por nombre..." value={busqProd} onChange={e => setBusqProd(e.target.value)}
                  style={{ ...S.input, marginBottom: 12 }} autoFocus />
                <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--color-border-secondary)', borderRadius: 8 }}>
                  {prodFiltrados.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Sin resultados</div>
                  ) : prodFiltrados.map(p => {
                    const precio = p.preciosLista?.[0]?.precio || p.precioCompra || 0
                    const yaAgregado = productosSeleccionados.some(ps => ps.productoId === p._id)
                    return (
                      <div key={p._id} onClick={() => !yaAgregado && agregarProductoExistente(p)}
                        style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--color-border-tertiary)', cursor: yaAgregado ? 'default' : 'pointer', background: yaAgregado ? 'var(--color-background-secondary)' : 'transparent', transition: 'background .1s' }}
                        onMouseEnter={e => { if (!yaAgregado) e.currentTarget.style.background = 'var(--color-background-secondary)' }}
                        onMouseLeave={e => { if (!yaAgregado) e.currentTarget.style.background = 'transparent' }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--color-text-primary)' }}>
                            {p.nombre}
                            {p.componentes?.length > 0 && <span style={{ marginLeft: 6, fontSize: 10, background: '#e3f2fd', color: '#1565c0', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>Compuesto</span>}
                          </div>
                          {p.descripcion && <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{p.descripcion}</div>}
                          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{p.categoria || ''} · {p.unidad || 'Unidad'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: '#2e7d32' }}>{fmt$(precio)}</div>
                          {yaAgregado && <div style={{ fontSize: 11, color: '#2e7d32', fontWeight: 600 }}>Ya agregado</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {tipoAgregado === 'nuevo' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={S.label}>Nombre *</label>
                  <input style={S.input} placeholder="Nombre del producto" value={prodNuevo.nombre} onChange={e => setProdNuevo(f => ({ ...f, nombre: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Precio ($)</label>
                  <input type="number" min="0" step="0.01" style={S.input} placeholder="0.00" value={prodNuevo.precio} onChange={e => setProdNuevo(f => ({ ...f, precio: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Cantidad</label>
                  <input type="number" min="1" style={S.input} value={prodNuevo.cantidad} onChange={e => setProdNuevo(f => ({ ...f, cantidad: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Unidad</label>
                  <input style={S.input} value={prodNuevo.unidad} onChange={e => setProdNuevo(f => ({ ...f, unidad: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={S.label}>Descripcion</label>
                  <input style={S.input} placeholder="Descripcion opcional" value={prodNuevo.descripcion} onChange={e => setProdNuevo(f => ({ ...f, descripcion: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1/-1', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#b45309' }}>
                  Este producto solo existira en esta cotizacion y no se guardara en el catalogo general.
                </div>
                <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border-secondary)' }}>
                  <button style={S.btnGris} onClick={() => setModalProducto(false)}>Cancelar</button>
                  <button style={S.btnVerde} onClick={agregarProductoNuevo}>Agregar</button>
                </div>
              </div>
            )}

            {tipoAgregado === 'existente' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border-secondary)' }}>
                <button style={S.btnGris} onClick={() => setModalProducto(false)}>Cerrar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  btnVerde: { padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#2e7d32', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' },
  btnGris: { padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-secondary)', fontSize: 13, color: 'var(--color-text-secondary)' },
  btnAzul: { padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#1565c0', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' },
  btnRojo: { padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(183,28,28,.08)', border: '1px solid rgba(183,28,28,.2)', fontSize: 13, color: '#b71c1c' },
  input: { width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13, border: '1.5px solid var(--color-border-secondary)', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  inputPeq: { width: '100%', padding: '5px 8px', borderRadius: 6, fontSize: 12, border: '1.5px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' },
  label: { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal: { background: 'var(--color-background-primary)', borderRadius: 14, padding: 28, width: '95%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)', border: '1px solid var(--color-border-secondary)' },
}
