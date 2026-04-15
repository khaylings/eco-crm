/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: OrdenCompraForm.jsx
 * Módulo:  Compras
 * ============================================================
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  doc, getDoc, setDoc, addDoc, updateDoc, collection,
  getDocs, query, orderBy, serverTimestamp, runTransaction
} from 'firebase/firestore'
import { db, storage } from '../../../firebase/config'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useAuth } from '../../../context/AuthContext'
import { usePermisos } from '../../../hooks/usePermisos'

// ── Helpers ───────────────────────────────────────────────────────────────────
import { fmt as fmtMoneda } from '../../../lib/formatMoneda'
const fmt = (n, mon = 'CRC') => fmtMoneda(n, mon)

const genId = () => Math.random().toString(36).slice(2, 10)

const METODOS_PAGO = ['Transferencia', 'SINPE Móvil', 'Efectivo', 'Tarjeta débito', 'Tarjeta crédito', 'Cheque', 'Depósito', 'Otro']

// ── Genera consecutivo ────────────────────────────────────────────────────────
async function generarConsecutivo() {
  const configRef  = doc(db, 'config', 'consecutivos')
  const counterRef = doc(db, 'config', 'contadores')
  return await runTransaction(db, async (tx) => {
    const configSnap  = await tx.get(configRef)
    const counterSnap = await tx.get(counterRef)
    const prefijo     = configSnap.exists() ? (configSnap.data().prefijoOrdenCompra || 'OC') : 'OC'
    const contadores  = counterSnap.exists() ? counterSnap.data() : {}
    const actual      = Number(contadores.prefijoOrdenCompra || 0) + 1
    tx.set(counterRef, { ...contadores, prefijoOrdenCompra: actual }, { merge: true })
    return `${prefijo}-${String(actual).padStart(3, '0')}`
  })
}

// ── Modal agregar producto al proveedor ───────────────────────────────────────
function ModalAgregarProducto({ proveedorId, onGuardar, onCerrar }) {
  const [busqueda, setBusqueda]     = useState('')
  const [productos, setProductos]   = useState([])
  const [seleccionado, setSelec]    = useState(null)
  const [precioCompra, setPrecio]   = useState('')
  const [creandoNuevo, setCreando]  = useState(false)
  const [nuevoNombre, setNuevoNom]  = useState('')
  const [guardando, setGuardando]   = useState(false)

  useEffect(() => {
    getDocs(query(collection(db, 'productos'), orderBy('nombre'))).then(snap => {
      setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [])

  const filtrados = productos.filter(p => p.nombre?.toLowerCase().includes(busqueda.toLowerCase())).slice(0, 8)

  const handleGuardar = async () => {
    if (!seleccionado && !nuevoNombre.trim()) return
    setGuardando(true)
    try {
      let productoId = seleccionado?.id
      let nombre     = seleccionado?.nombre || nuevoNombre.trim()

      // Si es nuevo producto, crearlo en la colección de productos
      if (!seleccionado && nuevoNombre.trim()) {
        const ref = await addDoc(collection(db, 'productos'), {
          nombre:      nuevoNombre.trim(),
          precioCompra: Number(precioCompra) || 0,
          precio:       0,
          tipo:         'Producto',
          esVenta:      false,
          esCompra:     true,
          creadoEn:     serverTimestamp(),
        })
        productoId = ref.id
      }

      // Agregar producto al proveedor
      const provRef = doc(db, 'proveedores', proveedorId)
      const provSnap = await getDoc(provRef)
      const productosActuales = provSnap.exists() ? (provSnap.data().productos || []) : []
      const yaExiste = productosActuales.some(p => p.productoId === productoId)

      if (!yaExiste) {
        await updateDoc(provRef, {
          productos: [...productosActuales, {
            productoId,
            nombre,
            precioCompra: Number(precioCompra) || 0,
            agregadoEn: new Date().toISOString(),
          }]
        })
      }

      onGuardar({ productoId, nombre, precioCompra: Number(precioCompra) || 0 })
    } catch (e) { console.error(e) }
    finally { setGuardando(false) }
  }

  const s = {
    inp: { width: '100%', padding: '8px 11px', border: '0.5px solid rgba(0,0,0,.18)', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fff', color: 'inherit', fontFamily: 'inherit', boxSizing: 'border-box' },
    lbl: { fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4, display: 'block' },
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: '#fff', borderRadius: 14, width: '95%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Agregar producto al proveedor</div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa' }}>×</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!creandoNuevo ? (
            <>
              <div>
                <label style={s.lbl}>Buscar producto existente</label>
                <input style={s.inp} placeholder="Nombre del producto..." value={busqueda} onChange={e => setBusqueda(e.target.value)} autoFocus />
                {busqueda && (
                  <div style={{ border: '0.5px solid rgba(0,0,0,.12)', borderRadius: 8, marginTop: 4, overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
                    {filtrados.map(p => (
                      <div key={p.id} onClick={() => { setSelec(p); setPrecio(p.precioCompra || '') }} style={{ padding: '9px 14px', cursor: 'pointer', background: seleccionado?.id === p.id ? '#E6F1FB' : '#fff', borderBottom: '0.5px solid rgba(0,0,0,.05)', fontSize: 13 }}
                        onMouseEnter={e => { if (seleccionado?.id !== p.id) e.currentTarget.style.background = '#f5f7fa' }}
                        onMouseLeave={e => { if (seleccionado?.id !== p.id) e.currentTarget.style.background = '#fff' }}>
                        <p style={{ fontWeight: 500, margin: 0 }}>{p.nombre}</p>
                        {p.precioCompra > 0 && <p style={{ fontSize: 11, color: '#888', margin: '1px 0 0' }}>Costo anterior: ₡{Number(p.precioCompra).toLocaleString('es-CR')}</p>}
                      </div>
                    ))}
                    {filtrados.length === 0 && <div style={{ padding: '12px 14px', color: '#999', fontSize: 12 }}>Sin resultados</div>}
                  </div>
                )}
              </div>
              <button onClick={() => setCreando(true)} style={{ padding: '8px', border: '0.5px dashed rgba(0,0,0,.2)', borderRadius: 7, fontSize: 12, cursor: 'pointer', background: '#f8f9fb', color: '#555', fontFamily: 'inherit' }}>
                + Crear producto nuevo
              </button>
            </>
          ) : (
            <div>
              <label style={s.lbl}>Nombre del nuevo producto</label>
              <input style={s.inp} placeholder="Ej: Compresor Copeland 5HP" value={nuevoNombre} onChange={e => setNuevoNom(e.target.value)} autoFocus />
              <button onClick={() => setCreando(false)} style={{ marginTop: 6, fontSize: 11, color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>← Buscar existente</button>
            </div>
          )}

          {(seleccionado || nuevoNombre.trim()) && (
            <div>
              <label style={s.lbl}>Precio de compra (CRC)</label>
              <input style={{ ...s.inp, fontSize: 17, fontWeight: 600 }} type="number" min="0" step="0.01" placeholder="0.00" value={precioCompra} onChange={e => setPrecio(e.target.value)} />
            </div>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(0,0,0,.08)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCerrar} style={{ padding: '8px 16px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: '#f5f5f5', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={guardando || (!seleccionado && !nuevoNombre.trim())} style={{ padding: '8px 22px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: guardando ? 'not-allowed' : 'pointer', background: (!seleccionado && !nuevoNombre.trim()) ? '#e0e0e0' : 'var(--eco-primary, #1a3a5c)', color: (!seleccionado && !nuevoNombre.trim()) ? '#aaa' : '#fff', fontFamily: 'inherit' }}>
            {guardando ? 'Guardando...' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal pago ────────────────────────────────────────────────────────────────
function ModalPago({ orden, onGuardar, onCerrar }) {
  const [monto,      setMonto]     = useState('')
  const [metodo,     setMetodo]    = useState('Transferencia')
  const [referencia, setRef]       = useState('')
  const [fecha,      setFecha]     = useState(new Date().toISOString().split('T')[0])
  const [nota,       setNota]      = useState('')
  const [guardando,  setGuardando] = useState(false)
  const [error,      setError]     = useState('')
  const [fotoC, setFotoC]          = useState(null)
  const [fotoPreviewC, setFotoPreviewC] = useState(null)
  const fotoRefC = useRef()
  const handleFotoC = (file) => { if (!file) return; setFotoC(file); const r = new FileReader(); r.onload = ev => setFotoPreviewC(ev.target.result); r.readAsDataURL(file) }
  const handlePasteC = (e) => { const items = e.clipboardData?.items; if (!items) return; for (const item of items) { if (item.type.startsWith('image/')) { e.preventDefault(); handleFotoC(item.getAsFile()); return } } }

  const saldo = Number(orden.saldo ?? orden.total ?? 0)
  const mon   = orden.moneda || 'CRC'

  const handleGuardar = async () => {
    const num = Number(monto)
    if (!monto || isNaN(num) || num <= 0) { setError('Ingresá un monto válido.'); return }
    if (num > saldo + 0.01) { setError(`El monto no puede superar el saldo.`); return }
    setError('')
    setGuardando(true)
    let comprobanteUrl = ''
    if (fotoC) { try { const sR = storageRef(storage, `comprobantes/${Date.now()}_${fotoC.name}`); const sn = await uploadBytes(sR, fotoC); comprobanteUrl = await getDownloadURL(sn.ref) } catch {} }
    await onGuardar({ id: genId(), monto: num, metodo, referencia, fecha, nota, comprobante: comprobanteUrl, registradoEn: new Date().toISOString() })
    setGuardando(false)
  }

  const sym = mon === 'USD' ? '$' : '₡'
  const s = {
    lbl: { fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4, display: 'block' },
    inp: { width: '100%', padding: '8px 11px', border: '0.5px solid rgba(0,0,0,.18)', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fff', color: 'inherit', fontFamily: 'inherit', boxSizing: 'border-box' },
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: '#fff', borderRadius: 14, width: '95%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Registrar pago / abono</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Saldo: <strong style={{ color: '#A32D2D' }}>{sym}{Number(saldo).toLocaleString()}</strong></div>
          </div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa' }}>×</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={s.lbl}>Monto ({mon})</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...s.inp, fontSize: 18, fontWeight: 600 }} type="number" min="0" step="0.01" placeholder="0.00" value={monto} onChange={e => setMonto(e.target.value)} autoFocus />
              <button onClick={() => setMonto(saldo.toFixed(2))} style={{ padding: '8px 12px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 12, cursor: 'pointer', background: '#f5f5f5', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>Saldo total</button>
            </div>
          </div>
          <div>
            <label style={s.lbl}>Método</label>
            <select style={s.inp} value={metodo} onChange={e => setMetodo(e.target.value)}>
              {METODOS_PAGO.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={s.lbl}>Fecha</label><input style={s.inp} type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
            <div><label style={s.lbl}>Referencia</label><input style={s.inp} placeholder="Nº transferencia..." value={referencia} onChange={e => setRef(e.target.value)} /></div>
          </div>
          <div><label style={s.lbl}>Nota</label><textarea style={{ ...s.inp, resize: 'vertical' }} rows={2} value={nota} onChange={e => setNota(e.target.value)} onPaste={handlePasteC} /></div>
          <div><label style={s.lbl}>Comprobante</label>
            <input ref={fotoRefC} type="file" accept="image/*" style={{ display:'none' }} onChange={e => { if(e.target.files?.[0]) handleFotoC(e.target.files[0]); e.target.value='' }} />
            {fotoPreviewC ? (<div style={{ position:'relative', display:'inline-block' }}><img src={fotoPreviewC} alt="" style={{ maxHeight:100, borderRadius:8, border:'1px solid #e0e0e0' }} /><button onClick={() => { setFotoC(null); setFotoPreviewC(null) }} style={{ position:'absolute', top:-6, right:-6, width:20, height:20, borderRadius:'50%', background:'#A32D2D', border:'none', color:'#fff', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button></div>
            ) : (<div style={{ display:'flex', gap:8, alignItems:'center' }}><button onClick={() => fotoRefC.current?.click()} style={{ padding:'6px 12px', border:'1px dashed #bbb', borderRadius:7, background:'#fafafa', color:'#888', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>📷 Subir</button><span style={{ fontSize:10, color:'#bbb' }}>o Ctrl+V</span></div>)}
          </div>
          {error && <div style={{ padding: '8px 12px', background: '#FCEBEB', borderRadius: 7, fontSize: 12, color: '#A32D2D' }}>{error}</div>}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(0,0,0,.08)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCerrar} style={{ padding: '8px 16px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: '#f5f5f5', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={guardando || !monto} style={{ padding: '8px 22px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: guardando || !monto ? 'not-allowed' : 'pointer', background: guardando || !monto ? '#e0e0e0' : 'var(--eco-primary, #1a3a5c)', color: guardando || !monto ? '#aaa' : '#fff', fontFamily: 'inherit' }}>
            {guardando ? 'Guardando...' : 'Registrar pago'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function OrdenCompraForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const { usuario } = usePermisos()
  const esNueva = !id || id === 'nueva'

  const [orden,        setOrden]       = useState(null)
  const [loading,      setLoading]     = useState(!esNueva)
  const [guardando,    setGuardando]   = useState(false)
  const [proveedores,  setProveedores] = useState([])
  const [provActivo,   setProvActivo]  = useState(null)
  const [busqProv,     setBusqProv]    = useState('')
  const [showProv,     setShowProv]    = useState(false)
  const [tasas,        setTasas]       = useState({ compra: 519, venta: 525 })
  const [showModalProd,setShowModalProd] = useState(false)
  const [showModalPago,setShowModalPago] = useState(false)
  const [confirmElim,  setConfirmElim]  = useState(null)

  // Form local
  const [form, setForm] = useState({
    tipo:                'inventariable',
    moneda:              'CRC',
    descripcion:         '',
    condicionPago:       'contado',
    fechaVencimientoPago:'',
    observaciones:       '',
    lineas:              [],
    pagos:               [],
    estado:              'Borrador',
  })

  useEffect(() => {
    // Cargar tasas
    getDoc(doc(db, 'configuracion', 'tasas')).then(snap => { if (snap.exists()) setTasas(snap.data()) })
    // Cargar proveedores
    getDocs(query(collection(db, 'proveedores'), orderBy('nombreComercial'))).then(snap => {
      setProveedores(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    // Cargar orden si es edición
    if (!esNueva) {
      getDoc(doc(db, 'ordenes_compra', id)).then(snap => {
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() }
          setOrden(data)
          setForm({
            tipo:                data.tipo || 'inventariable',
            moneda:              data.moneda || 'CRC',
            descripcion:         data.descripcion || '',
            condicionPago:       data.condicionPago || 'contado',
            fechaVencimientoPago:data.fechaVencimientoPago || '',
            observaciones:       data.observaciones || '',
            lineas:              data.lineas || [],
            pagos:               data.pagos || [],
            estado:              data.estado || 'Borrador',
          })
          setBusqProv(data.proveedorNombre || '')
          // Buscar proveedor activo
          if (data.proveedorId) {
            getDoc(doc(db, 'proveedores', data.proveedorId)).then(ps => {
              if (ps.exists()) setProvActivo({ id: ps.id, ...ps.data() })
            })
          }
        }
        setLoading(false)
      })
    }
  }, [id])

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // ── Selección de proveedor ────────────────────────────────────────────────
  const selProv = (p) => {
    setProvActivo(p)
    setBusqProv(p.nombreComercial || p.razonSocial || '')
    setShowProv(false)
    upd('lineas', []) // limpiar líneas al cambiar proveedor
  }

  const provsFiltrados = proveedores.filter(p =>
    (p.nombreComercial || p.razonSocial || '').toLowerCase().includes(busqProv.toLowerCase())
  ).slice(0, 8)

  // ── Líneas de productos ───────────────────────────────────────────────────
  const agregarLinea = (prod) => {
    const linea = {
      _lid:         genId(),
      productoId:   prod.productoId,
      nombre:       prod.nombre,
      cantidad:     1,
      precioCompra: prod.precioCompra || 0,
      subtotal:     prod.precioCompra || 0,
    }
    upd('lineas', [...form.lineas, linea])
  }

  const updLinea = (lid, k, v) => {
    upd('lineas', form.lineas.map(l => {
      if (l._lid !== lid) return l
      const updated = { ...l, [k]: v }
      updated.subtotal = Number(updated.cantidad || 0) * Number(updated.precioCompra || 0)
      return updated
    }))
  }

  const elimLinea = (lid) => upd('lineas', form.lineas.filter(l => l._lid !== lid))

  // ── Cálculos ──────────────────────────────────────────────────────────────
  const subtotal    = form.lineas.reduce((a, l) => a + Number(l.subtotal || 0), 0)
  const iva         = subtotal * 0.13
  const total       = subtotal + iva
  const totalPagado = form.pagos.reduce((a, p) => a + Number(p.monto || 0), 0)
  const saldo       = Math.max(0, total - totalPagado)

  // Diferencial cambiario (solo si moneda USD)
  const totalEnCRC    = form.moneda === 'USD' ? total * (tasas.compra || 519) : total
  const totalPagadoCRC = form.moneda === 'USD' ? totalPagado * (tasas.compra || 519) : totalPagado

  // ── Guardar ───────────────────────────────────────────────────────────────
  const guardar = useCallback(async (estadoNuevo) => {
    if (!provActivo) { alert('Seleccioná un proveedor.'); return }
    setGuardando(true)
    try {
      const tasa = tasas.compra || 519
      const payload = {
        ...form,
        estado:           estadoNuevo || form.estado,
        proveedorId:      provActivo.id,
        proveedorNombre:  provActivo.nombreComercial || provActivo.razonSocial || '',
        subtotal,
        iva,
        total,
        totalPagado,
        saldo,
        tasaCompra:       tasa,
        totalEnCRC:       form.moneda === 'USD' ? total * tasa : total,
        actualizadoEn:    serverTimestamp(),
      }

      if (esNueva) {
        const numero = await generarConsecutivo()
        await addDoc(collection(db, 'ordenes_compra'), {
          ...payload,
          numero,
          creadoPor:  usuario?.uid || currentUser?.uid || null,
          creadoEn:   serverTimestamp(),
        })
        // Si es inventariable y estado Recibida, actualizar stock
        if (form.tipo === 'inventariable' && estadoNuevo === 'Recibida') {
          await actualizarStock(form.lineas, tasa, form.moneda)
        }
        navigate('/compras')
      } else {
        await updateDoc(doc(db, 'ordenes_compra', id), payload)
        if (form.tipo === 'inventariable' && estadoNuevo === 'Recibida' && orden?.estado !== 'Recibida') {
          await actualizarStock(form.lineas, tasa, form.moneda)
        }
        setOrden(o => ({ ...o, ...payload }))
      }
    } catch (e) { console.error(e) }
    finally { setGuardando(false) }
  }, [form, provActivo, tasas, subtotal, iva, total, totalPagado, saldo, esNueva, id, orden])

  // ── Actualizar stock en productos ─────────────────────────────────────────
  const actualizarStock = async (lineas, tasa, moneda) => {
    for (const l of lineas) {
      if (!l.productoId) continue
      try {
        const prodRef  = doc(db, 'productos', l.productoId)
        const prodSnap = await getDoc(prodRef)
        if (!prodSnap.exists()) continue
        const prod = prodSnap.data()
        const stockActual = Number(prod.stock || 0)
        const precioCompraEnCRC = moneda === 'USD' ? Number(l.precioCompra) * tasa : Number(l.precioCompra)

        // PEPS: si no tiene precio compra, notificar
        if (!precioCompraEnCRC) {
          console.warn(`[stock] Producto ${l.nombre} sin precio de compra`)
        }

        await updateDoc(prodRef, {
          stock:        stockActual + Number(l.cantidad || 0),
          precioCompra: precioCompraEnCRC || prod.precioCompra || 0,
          ultimaCompra: new Date().toISOString(),
        })
      } catch (e) { console.error(`Error actualizando stock de ${l.nombre}:`, e) }
    }
  }

  // ── Registrar pago ────────────────────────────────────────────────────────
  const registrarPago = async (pago) => {
    const nuevosPagos    = [...form.pagos, { ...pago, registradoPor: usuario?.nombre || 'Usuario' }]
    const nuevoTotalPagado = nuevosPagos.reduce((a, p) => a + Number(p.monto), 0)
    const nuevoSaldo     = Math.max(0, total - nuevoTotalPagado)
    const nuevoEstado    = nuevoSaldo <= 0 ? 'Pagada' : nuevoTotalPagado > 0 ? 'Crédito pendiente' : form.estado

    upd('pagos', nuevosPagos)
    if (!esNueva) {
      await updateDoc(doc(db, 'ordenes_compra', id), {
        pagos:       nuevosPagos,
        totalPagado: nuevoTotalPagado,
        saldo:       nuevoSaldo,
        estado:      nuevoEstado,
        actualizadoEn: serverTimestamp(),
      })
    }
    setShowModalPago(false)
  }

  const eliminarPago = async (pagoId) => {
    const nuevosPagos      = form.pagos.filter(p => p.id !== pagoId)
    const nuevoTotalPagado = nuevosPagos.reduce((a, p) => a + Number(p.monto), 0)
    const nuevoSaldo       = Math.max(0, total - nuevoTotalPagado)
    upd('pagos', nuevosPagos)
    if (!esNueva) {
      await updateDoc(doc(db, 'ordenes_compra', id), { pagos: nuevosPagos, totalPagado: nuevoTotalPagado, saldo: nuevoSaldo, actualizadoEn: serverTimestamp() })
    }
    setConfirmElim(null)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Cargando...</div>

  const sym = form.moneda === 'USD' ? '$' : '₡'

  const s = {
    page:  { padding: '20px 24px', minHeight: '100vh', background: 'var(--eco-bg, #f5f6f8)', fontSize: 13 },
    card:  { background: '#fff', border: '0.5px solid rgba(0,0,0,.08)', borderRadius: 10, padding: '18px 20px', marginBottom: 14 },
    lbl:   { fontSize: 10, fontWeight: 500, color: '#999', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3, display: 'block' },
    inp:   { width: '100%', padding: '8px 10px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fff', color: 'inherit', fontFamily: 'inherit', boxSizing: 'border-box' },
    btn:   { padding: '6px 14px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 12, cursor: 'pointer', background: '#fff', fontFamily: 'inherit' },
    btnP:  { padding: '8px 18px', background: 'var(--eco-primary, #1a3a5c)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
    th:    { padding: '9px 12px', textAlign: 'left', fontWeight: 500, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '0.5px solid rgba(0,0,0,.06)', background: '#fafafa' },
    td:    { padding: '10px 12px', borderBottom: '0.5px solid rgba(0,0,0,.05)', verticalAlign: 'middle', fontSize: 13 },
  }

  return (
    <div style={s.page}>

      {showModalProd && provActivo && (
        <ModalAgregarProducto
          proveedorId={provActivo.id}
          onGuardar={(prod) => { agregarLinea(prod); setShowModalProd(false) }}
          onCerrar={() => setShowModalProd(false)}
        />
      )}

      {showModalPago && (
        <ModalPago
          orden={{ ...form, total, saldo }}
          onGuardar={registrarPago}
          onCerrar={() => setShowModalPago(false)}
        />
      )}

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={{ ...s.btn, padding: '5px 10px' }} onClick={() => navigate('/compras')}>← Volver</button>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--eco-primary, #1a3a5c)' }}>
            {esNueva ? 'Nueva orden de compra' : (orden?.numero || 'Orden de compra')}
          </span>
          {guardando && <span style={{ fontSize: 11, color: '#bbb' }}>Guardando...</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!esNueva && form.estado !== 'Recibida' && form.estado !== 'Pagada' && (
            <button style={{ ...s.btn, background: '#EAF3DE', color: '#3B6D11', borderColor: 'transparent' }} onClick={() => guardar('Recibida')}>
              ✓ Marcar recibida
            </button>
          )}
          <button style={s.btnP} onClick={() => guardar()} disabled={guardando}>
            {guardando ? 'Guardando...' : esNueva ? 'Crear orden' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>

        {/* Columna principal */}
        <div>

          {/* Encabezado */}
          <div style={s.card}>
            {/* Tipo */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[
                { val: 'inventariable', label: '📦 Inventariable', sub: 'Mueve stock' },
                { val: 'gasto',         label: '💸 Gasto',          sub: 'No inventariable' },
              ].map(t => (
                <button key={t.val} onClick={() => upd('tipo', t.val)} style={{
                  flex: 1, padding: '10px 14px', border: `1.5px solid ${form.tipo === t.val ? 'var(--eco-primary, #1a3a5c)' : 'rgba(0,0,0,.12)'}`,
                  borderRadius: 8, cursor: 'pointer', background: form.tipo === t.val ? 'var(--eco-primary, #1a3a5c)' : '#fff',
                  color: form.tipo === t.val ? '#fff' : '#555', fontFamily: 'inherit', textAlign: 'left',
                }}>
                  <p style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>{t.label}</p>
                  <p style={{ fontSize: 11, margin: '2px 0 0', opacity: 0.75 }}>{t.sub}</p>
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Proveedor */}
              <div style={{ position: 'relative' }}>
                <label style={s.lbl}>Proveedor *</label>
                <input style={s.inp} placeholder="Buscar proveedor..." value={busqProv}
                  onChange={e => { setBusqProv(e.target.value); setShowProv(true) }}
                  onFocus={() => setShowProv(true)} />
                {showProv && busqProv && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 8, zIndex: 50, maxHeight: 200, overflowY: 'auto', marginTop: 3, boxShadow: '0 8px 24px rgba(0,0,0,.1)' }}>
                    {provsFiltrados.map(p => (
                      <div key={p.id} onMouseDown={() => selProv(p)} style={{ padding: '9px 13px', cursor: 'pointer', borderBottom: '0.5px solid rgba(0,0,0,.05)', fontSize: 13 }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f5f7fa'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                        <p style={{ fontWeight: 500, margin: 0 }}>{p.nombreComercial || p.razonSocial}</p>
                        {p.telefono && <p style={{ fontSize: 11, color: '#888', margin: '1px 0 0' }}>{p.telefono}</p>}
                      </div>
                    ))}
                    {provsFiltrados.length === 0 && <div style={{ padding: '10px 13px', color: '#999', fontSize: 12 }}>Sin resultados</div>}
                  </div>
                )}
                {provActivo && (
                  <div style={{ marginTop: 6, padding: '6px 10px', background: '#EAF3DE', borderRadius: 6, fontSize: 11, color: '#3B6D11', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>✓ {provActivo.nombreComercial || provActivo.razonSocial}</span>
                    <button onClick={() => { setProvActivo(null); setBusqProv('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3B6D11', fontSize: 14 }}>×</button>
                  </div>
                )}
              </div>

              {/* Descripción */}
              <div>
                <label style={s.lbl}>Descripción / referencia</label>
                <input style={s.inp} placeholder="Ej: Compra de equipos agosto" value={form.descripcion} onChange={e => upd('descripcion', e.target.value)} />
              </div>

              {/* Moneda */}
              <div>
                <label style={s.lbl}>Moneda</label>
                <select style={s.inp} value={form.moneda} onChange={e => upd('moneda', e.target.value)}>
                  <option value="CRC">CRC — Colón ₡</option>
                  <option value="USD">USD — Dólar $</option>
                </select>
                {form.moneda === 'USD' && (
                  <p style={{ fontSize: 11, color: '#888', marginTop: 4 }}>Tasa compra: ₡{Number(tasas.compra || 0).toLocaleString('es-CR')}/USD</p>
                )}
              </div>

              {/* Condición de pago */}
              <div>
                <label style={s.lbl}>Condición de pago</label>
                <select style={s.inp} value={form.condicionPago} onChange={e => upd('condicionPago', e.target.value)}>
                  <option value="contado">Contado</option>
                  <option value="credito">Crédito</option>
                </select>
              </div>

              {/* Fecha vencimiento (solo crédito) */}
              {form.condicionPago === 'credito' && (
                <div>
                  <label style={s.lbl}>Fecha vencimiento del crédito</label>
                  <input style={s.inp} type="date" value={form.fechaVencimientoPago} onChange={e => upd('fechaVencimientoPago', e.target.value)} />
                </div>
              )}
            </div>
          </div>

          {/* Productos */}
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#444', margin: 0 }}>
                {form.tipo === 'inventariable' ? 'Productos a comprar' : 'Conceptos del gasto'}
              </p>
              <button style={{ ...s.btn, background: provActivo ? '#E6F1FB' : '#f5f5f5', color: provActivo ? '#185FA5' : '#bbb', borderColor: 'transparent', fontSize: 12, fontWeight: 500 }}
                onClick={() => { if (provActivo) setShowModalProd(true) }}
                disabled={!provActivo} title={!provActivo ? 'Primero seleccioná un proveedor' : ''}>
                + Agregar {form.tipo === 'inventariable' ? 'producto' : 'concepto'}
              </button>
            </div>

            {/* Productos del proveedor como accesos rápidos */}
            {provActivo?.productos?.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, padding: '10px 12px', background: '#f8f9fb', borderRadius: 8, border: '0.5px solid rgba(0,0,0,.06)' }}>
                <span style={{ fontSize: 11, color: '#aaa', alignSelf: 'center', marginRight: 4 }}>Productos del proveedor:</span>
                {provActivo.productos.map((p, i) => (
                  <button key={i} onClick={() => agregarLinea(p)} style={{ padding: '4px 10px', border: '0.5px solid rgba(0,0,0,.12)', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: '#fff', fontFamily: 'inherit' }}>
                    + {p.nombre}
                  </button>
                ))}
              </div>
            )}

            {form.lineas.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#ccc', fontSize: 12, background: '#fafafa', borderRadius: 8, border: '0.5px dashed rgba(0,0,0,.1)' }}>
                {provActivo ? 'Agregá productos con el botón de arriba' : 'Seleccioná un proveedor primero'}
              </div>
            ) : (
              <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #eaecf2' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={s.th}>Producto / Concepto</th>
                      <th style={{ ...s.th, textAlign: 'center', width: 70 }}>Cant.</th>
                      <th style={s.th}>Precio compra ({form.moneda})</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Subtotal</th>
                      <th style={{ ...s.th, width: 36 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.lineas.map((l, i) => (
                      <tr key={l._lid} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                        <td style={s.td}>
                          <p style={{ fontWeight: 500, margin: 0 }}>{l.nombre}</p>
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          <input style={{ width: 52, padding: '4px 6px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 5, fontSize: 12, outline: 'none', textAlign: 'center', fontFamily: 'inherit' }}
                            type="number" min="0" value={l.cantidad}
                            onChange={e => updLinea(l._lid, 'cantidad', Number(e.target.value))} />
                        </td>
                        <td style={s.td}>
                          <input style={{ width: 110, padding: '4px 6px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 5, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
                            type="number" min="0" step="0.01" value={l.precioCompra}
                            onChange={e => updLinea(l._lid, 'precioCompra', Number(e.target.value))} />
                        </td>
                        <td style={{ ...s.td, textAlign: 'right', fontWeight: 600, color: 'var(--eco-primary, #1a3a5c)' }}>
                          {sym}{Number(l.subtotal || 0).toLocaleString()}
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 16, padding: '2px 4px', borderRadius: 4 }}
                            onMouseEnter={e => e.currentTarget.style.color = '#E24B4A'}
                            onMouseLeave={e => e.currentTarget.style.color = '#ddd'}
                            onClick={() => elimLinea(l._lid)}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Observaciones */}
          <div style={s.card}>
            <label style={s.lbl}>Observaciones</label>
            <textarea style={{ ...s.inp, resize: 'vertical' }} rows={3} placeholder="Condiciones especiales, instrucciones de entrega..." value={form.observaciones} onChange={e => upd('observaciones', e.target.value)} />
          </div>

          {/* Historial de pagos */}
          {!esNueva && (
            <div style={s.card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#444', margin: 0 }}>
                  Pagos registrados
                  {form.pagos.length > 0 && <span style={{ marginLeft: 8, fontSize: 11, background: '#E6F1FB', color: '#185FA5', padding: '1px 8px', borderRadius: 10 }}>{form.pagos.length}</span>}
                </p>
                {saldo > 0 && (
                  <button style={{ ...s.btn, background: '#EAF3DE', color: '#3B6D11', borderColor: 'transparent', fontSize: 12, fontWeight: 500 }} onClick={() => setShowModalPago(true)}>
                    + Registrar pago
                  </button>
                )}
              </div>
              {form.pagos.length === 0 ? (
                <div style={{ padding: '20px 16px', textAlign: 'center', color: '#ccc', fontSize: 12, background: '#fafafa', borderRadius: 8, border: '0.5px dashed rgba(0,0,0,.1)' }}>
                  Sin pagos registrados
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {form.pagos.map((p, i) => (
                    <div key={p.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#fafafa', borderRadius: 8, border: '0.5px solid rgba(0,0,0,.06)' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EAF3DE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>
                        {p.metodo === 'Efectivo' ? '💵' : p.metodo?.includes('SINPE') ? '📱' : '🏦'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: '#3B6D11' }}>{sym}{Number(p.monto).toLocaleString()}</span>
                          <span style={{ fontSize: 11, background: '#EAF3DE', color: '#3B6D11', padding: '1px 7px', borderRadius: 10 }}>{p.metodo}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                          {p.fecha} {p.referencia && `· Ref: ${p.referencia}`} {p.registradoPor && `· por ${p.registradoPor}`}
                        </div>
                      </div>
                      {confirmElim === p.id ? (
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: '#A32D2D' }}>¿Eliminar?</span>
                          <button style={{ padding: '2px 8px', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer', background: '#FCEBEB', color: '#A32D2D', fontFamily: 'inherit' }} onClick={() => eliminarPago(p.id)}>Sí</button>
                          <button style={{ padding: '2px 8px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 4, fontSize: 11, cursor: 'pointer', background: '#fff', fontFamily: 'inherit' }} onClick={() => setConfirmElim(null)}>No</button>
                        </div>
                      ) : (
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 16, padding: '2px 5px', borderRadius: 4 }}
                          onMouseEnter={e => e.currentTarget.style.color = '#E24B4A'}
                          onMouseLeave={e => e.currentTarget.style.color = '#ddd'}
                          onClick={() => setConfirmElim(p.id)}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar derecho */}
        <div style={{ position: 'sticky', top: 20 }}>

          {/* Resumen financiero */}
          <div style={{ ...s.card, marginBottom: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '.6px', margin: '0 0 14px' }}>Resumen</p>

            {[
              { lbl: 'Subtotal',  val: subtotal },
              { lbl: 'IVA (13%)', val: iva },
            ].map(({ lbl, val }) => (
              <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#888', marginBottom: 8 }}>
                <span>{lbl}</span>
                <span>{sym}{Number(val).toLocaleString()}</span>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16, color: 'var(--eco-primary, #1a3a5c)', borderTop: '1.5px solid #e0e4ea', paddingTop: 10, marginTop: 4 }}>
              <span>Total {form.moneda}</span>
              <span>{sym}{Number(total).toLocaleString()}</span>
            </div>

            {/* Equivalente en CRC si es USD */}
            {form.moneda === 'USD' && (
              <div style={{ marginTop: 10, padding: '8px 10px', background: '#f8f9fb', borderRadius: 7, border: '0.5px dashed rgba(0,0,0,.1)' }}>
                <p style={{ fontSize: 10, color: '#bbb', textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 2px' }}>Equivalente CRC</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#185FA5', margin: 0 }}>₡{Math.round(totalEnCRC).toLocaleString('es-CR')}</p>
                <p style={{ fontSize: 10, color: '#bbb', margin: '2px 0 0' }}>Tasa compra ₡{Number(tasas.compra || 0).toLocaleString('es-CR')}/USD</p>
              </div>
            )}

            {/* Pagos */}
            {!esNueva && form.pagos.length > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#3B6D11', marginTop: 12 }}>
                  <span>Pagado</span>
                  <span style={{ fontWeight: 600 }}>{sym}{Number(totalPagado).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14, color: saldo <= 0 ? '#3B6D11' : '#A32D2D', marginTop: 6 }}>
                  <span>Saldo</span>
                  <span>{saldo <= 0 ? '✓ Saldado' : `${sym}${Number(saldo).toLocaleString()}`}</span>
                </div>
                <div style={{ background: '#f0f0f0', borderRadius: 20, height: 5, overflow: 'hidden', marginTop: 10 }}>
                  <div style={{ height: '100%', width: `${Math.min(100, total > 0 ? (totalPagado / total) * 100 : 0)}%`, background: saldo <= 0 ? '#639922' : '#EF9F27', borderRadius: 20 }} />
                </div>
              </>
            )}
          </div>

          {/* Estado */}
          <div style={s.card}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '.6px', margin: '0 0 10px' }}>Estado</p>
            <select style={s.inp} value={form.estado} onChange={e => upd('estado', e.target.value)}>
              {['Borrador', 'Enviada', 'Recibida', 'Crédito pendiente', 'Pagada', 'Cancelada'].map(e => <option key={e}>{e}</option>)}
            </select>

            {form.condicionPago === 'credito' && form.fechaVencimientoPago && (
              <div style={{ marginTop: 10, padding: '8px 10px', background: '#FAEEDA', borderRadius: 7, fontSize: 12, color: '#854F0B' }}>
                ⏰ Vence el {form.fechaVencimientoPago}
              </div>
            )}

            <button style={{ ...s.btnP, width: '100%', textAlign: 'center', marginTop: 12 }} onClick={() => guardar()} disabled={guardando}>
              {guardando ? 'Guardando...' : esNueva ? 'Crear orden' : 'Guardar cambios'}
            </button>

            {!esNueva && saldo > 0 && (
              <button style={{ width: '100%', padding: '8px', border: '0.5px solid rgba(0,0,0,.12)', borderRadius: 7, fontSize: 12, cursor: 'pointer', background: '#EAF3DE', color: '#3B6D11', fontFamily: 'inherit', marginTop: 8 }}
                onClick={() => setShowModalPago(true)}>
                + Registrar pago
              </button>
            )}
          </div>

          {/* Info proveedor */}
          {provActivo && (
            <div style={s.card}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '.6px', margin: '0 0 10px' }}>Proveedor</p>
              <p style={{ fontWeight: 600, fontSize: 13, margin: '0 0 4px' }}>{provActivo.nombreComercial || provActivo.razonSocial}</p>
              {provActivo.telefono && <p style={{ fontSize: 12, color: '#888', margin: '0 0 2px' }}>📞 {provActivo.telefono}</p>}
              {provActivo.email    && <p style={{ fontSize: 12, color: '#888', margin: '0 0 2px' }}>✉️ {provActivo.email}</p>}
              {provActivo.cedula   && <p style={{ fontSize: 11, color: '#bbb', margin: '4px 0 0' }}>Cédula: {provActivo.cedula}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}