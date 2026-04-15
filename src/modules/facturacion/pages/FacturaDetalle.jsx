/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: FacturaDetalle.jsx
 * Módulo:  Facturacion
 * ============================================================
 */

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, updateDoc, getDocs, addDoc, collection, query, where, serverTimestamp } from 'firebase/firestore'
import { db, storage } from '../../../firebase/config'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { usePermisos } from '../../../hooks/usePermisos'
import { useAuth } from '../../../context/AuthContext'
import { signInWithEmailAndPassword, getAuth } from 'firebase/auth'
import { registrarPagoPendiente, solicitarEliminacionFactura } from '../../../services/notificaciones'

// ── Helpers ───────────────────────────────────────────────────────────────────
const sym  = (mon) => mon === 'USD' ? '$' : '₡'
const fmtN = (n, mon = 'USD') =>
  mon === 'USD'
    ? Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const fmtFecha = (iso) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const diasRestantes = (iso) => {
  if (!iso) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const vence = new Date(iso + 'T00:00:00')
  return Math.ceil((vence - hoy) / 86400000)
}

const calcularEstado = (f) => {
  if (f.estado === 'Incobrable') return 'Incobrable'
  const saldo  = Number(f.saldo  ?? f.total ?? 0)
  const pagado = Number(f.totalPagado ?? 0)
  if (saldo <= 0 && pagado > 0) return 'Pagada'
  if (pagado > 0 && saldo > 0)  return 'Parcial'
  return 'Sin Pagar'
}

const ESTADO_CONFIG = {
  'Sin Pagar':  { bg: '#FCEBEB', color: '#A32D2D', dot: '#E24B4A' },
  'Parcial':    { bg: '#FAEEDA', color: '#854F0B', dot: '#EF9F27' },
  'Pagada':     { bg: '#EAF3DE', color: '#3B6D11', dot: '#639922' },
  'Incobrable': { bg: '#EEEDFE', color: '#3C3489', dot: '#7F77DD' },
}

const METODOS_PAGO = ['Transferencia', 'SINPE Móvil', 'Efectivo', 'Tarjeta débito', 'Tarjeta crédito', 'Cheque', 'Depósito', 'Otro']

const genId = () => Math.random().toString(36).slice(2, 10)

// ── Modal Incobrable — pide contraseña Super Admin ────────────────────────────
function ModalIncobrableAuth({ onConfirmar, onCerrar }) {
  const [email, setEmail]       = useState('')
  const [pass, setPass]         = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const verificar = async () => {
    if (!email || !pass) { setError('Ingresá email y contraseña.'); return }
    setLoading(true); setError('')
    try {
      // Verificar que sea Super Administrador en Firestore
      const snap = await getDocs(query(collection(db, 'usuarios'), where('email', '==', email), where('rol', '==', 'Super Administrador')))
      if (snap.empty) { setError('Ese usuario no es Super Administrador.'); setLoading(false); return }

      // Verificar contraseña con Firebase Auth (instancia secundaria para no cerrar sesión actual)
      const auth = getAuth()
      await signInWithEmailAndPassword(auth, email, pass)

      onConfirmar(snap.docs[0].data().nombre || email)
    } catch (e) {
      setError('Contraseña incorrecta o usuario no válido.')
    }
    setLoading(false)
  }

  const s = {
    lbl: { fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4, display: 'block' },
    inp: { width: '100%', padding: '8px 11px', border: '0.5px solid rgba(0,0,0,.18)', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fff', color: 'inherit', fontFamily: 'inherit', boxSizing: 'border-box' },
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', backdropFilter:'blur(4px)', zIndex:1100, display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background:'#fff', borderRadius:14, width:'95%', maxWidth:420, boxShadow:'0 20px 60px rgba(0,0,0,.25)', border:'0.5px solid #e0e0e0' }}>
        <div style={{ padding:'16px 20px', borderBottom:'0.5px solid rgba(0,0,0,.08)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:'#A32D2D' }}>🔒 Autorización requerida</div>
            <div style={{ fontSize:12, color:'#888', marginTop:2 }}>Solo un Super Administrador puede marcar como Incobrable</div>
          </div>
          <button onClick={onCerrar} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#aaa' }}>×</button>
        </div>
        <div style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={s.lbl}>Email del Super Administrador</label>
            <input style={s.inp} type="email" placeholder="admin@empresa.com" value={email} onChange={e=>setEmail(e.target.value)} autoFocus />
          </div>
          <div>
            <label style={s.lbl}>Contraseña</label>
            <input style={s.inp} type="password" placeholder="••••••••" value={pass} onChange={e=>setPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && verificar()} />
          </div>
          {error && (
            <div style={{ padding:'8px 12px', background:'#FCEBEB', border:'0.5px solid #F7C1C1', borderRadius:7, fontSize:12, color:'#A32D2D' }}>
              {error}
            </div>
          )}
        </div>
        <div style={{ padding:'12px 20px', borderTop:'0.5px solid rgba(0,0,0,.08)', display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onCerrar} style={{ padding:'8px 16px', border:'0.5px solid rgba(0,0,0,.15)', borderRadius:7, fontSize:13, cursor:'pointer', background:'#f5f5f5', fontFamily:'inherit' }}>Cancelar</button>
          <button onClick={verificar} disabled={loading} style={{ padding:'8px 22px', border:'none', borderRadius:7, fontSize:13, fontWeight:600, cursor:loading?'not-allowed':'pointer', background:loading?'#e0e0e0':'#A32D2D', color:loading?'#aaa':'#fff', fontFamily:'inherit' }}>
            {loading ? 'Verificando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Solicitud de Eliminación ────────────────────────────────────────────
function ModalSolicitarEliminacion({ factura, onEnviar, onCerrar }) {
  const [observacion, setObservacion] = useState('')
  const [enviando, setEnviando]       = useState(false)

  const enviar = async () => {
    if (!observacion.trim()) return
    setEnviando(true)
    await onEnviar(observacion.trim())
    setEnviando(false)
  }

  const sym_ = factura.moneda === 'USD' ? '$' : '₡'

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', backdropFilter:'blur(4px)', zIndex:1100, display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background:'#fff', borderRadius:14, width:'95%', maxWidth:440, boxShadow:'0 20px 60px rgba(0,0,0,.25)', border:'0.5px solid #e0e0e0' }}>
        <div style={{ padding:'16px 20px', borderBottom:'0.5px solid rgba(0,0,0,.08)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:'#A32D2D' }}>🗑 Solicitar eliminación</div>
            <div style={{ fontSize:12, color:'#888', marginTop:2 }}>Se enviará una solicitud al Super Administrador</div>
          </div>
          <button onClick={onCerrar} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#aaa' }}>×</button>
        </div>

        <div style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>
          {/* Resumen de la factura */}
          <div style={{ background:'#f8f9fb', borderRadius:8, padding:'10px 14px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div>
              <div style={{ fontSize:10, color:'#aaa', textTransform:'uppercase', letterSpacing:'.5px' }}>Factura</div>
              <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a' }}>{factura.numero}</div>
            </div>
            <div>
              <div style={{ fontSize:10, color:'#aaa', textTransform:'uppercase', letterSpacing:'.5px' }}>Cliente</div>
              <div style={{ fontSize:13, fontWeight:500, color:'#1a1a1a' }}>{factura.clienteNombre}</div>
            </div>
            <div>
              <div style={{ fontSize:10, color:'#aaa', textTransform:'uppercase', letterSpacing:'.5px' }}>Total</div>
              <div style={{ fontSize:13, fontWeight:600, color:'#A32D2D' }}>{sym_}{Number(factura.total||0).toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize:10, color:'#aaa', textTransform:'uppercase', letterSpacing:'.5px' }}>Estado</div>
              <div style={{ fontSize:13, fontWeight:500 }}>{factura.estadoCalculado || factura.estado}</div>
            </div>
          </div>

          <div>
            <label style={{ fontSize:11, fontWeight:600, color:'#5c6b5c', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:6, display:'block' }}>
              Observación / Motivo <span style={{ color:'#cc3333' }}>*</span>
            </label>
            <textarea
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
              placeholder="Explicá por qué se debe eliminar esta factura..."
              rows={3}
              autoFocus
              style={{ width:'100%', padding:'8px 11px', border:'0.5px solid rgba(0,0,0,.18)', borderRadius:7, fontSize:13, outline:'none', resize:'vertical', fontFamily:'inherit', boxSizing:'border-box', lineHeight:1.6 }}
            />
            <div style={{ fontSize:11, color:'#aaa', marginTop:4 }}>El Super Administrador verá este motivo antes de aprobar o rechazar.</div>
          </div>

          <div style={{ padding:'8px 12px', background:'#FAEEDA', border:'0.5px solid #FAC775', borderRadius:7, fontSize:11, color:'#854F0B' }}>
            ⚠️ Esta acción no elimina la factura de inmediato — envía una solicitud que debe ser aprobada.
          </div>
        </div>

        <div style={{ padding:'12px 20px', borderTop:'0.5px solid rgba(0,0,0,.08)', display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onCerrar} style={{ padding:'8px 16px', border:'0.5px solid rgba(0,0,0,.15)', borderRadius:7, fontSize:13, cursor:'pointer', background:'#f5f5f5', fontFamily:'inherit' }}>Cancelar</button>
          <button onClick={enviar} disabled={!observacion.trim() || enviando}
            style={{ padding:'8px 22px', border:'none', borderRadius:7, fontSize:13, fontWeight:600,
              cursor: !observacion.trim() || enviando ? 'not-allowed' : 'pointer',
              background: !observacion.trim() || enviando ? '#e0e0e0' : '#A32D2D',
              color: !observacion.trim() || enviando ? '#aaa' : '#fff', fontFamily:'inherit' }}>
            {enviando ? 'Enviando...' : '📨 Enviar solicitud'}
          </button>
        </div>
      </div>
    </div>
  )
}
function ModalPago({ factura, onGuardar, onCerrar }) {
  const [monto,      setMonto]      = useState('')
  const [metodo,     setMetodo]     = useState('Transferencia')
  const [referencia, setReferencia] = useState('')
  const [fecha,      setFecha]      = useState(new Date().toISOString().split('T')[0])
  const [nota,       setNota]       = useState('')
  const [guardando,  setGuardando]  = useState(false)
  const [error,      setError]      = useState('')
  const [foto,       setFoto]       = useState(null)
  const [fotoPreview, setFotoPreview] = useState(null)
  const fotoRef = useRef()

  const handleFoto = (file) => {
    if (!file) return
    setFoto(file)
    const reader = new FileReader()
    reader.onload = ev => setFotoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        handleFoto(item.getAsFile())
        return
      }
    }
  }

  const saldo = Number(factura.saldo ?? 0)
  const mon   = factura.moneda || 'USD'

  const handleGuardar = async () => {
    const montoNum = Number(monto)
    if (!monto || isNaN(montoNum) || montoNum <= 0) { setError('Ingresá un monto válido.'); return }
    if (montoNum > saldo + 0.01) { setError(`El monto no puede superar el saldo de ${sym(mon)}${fmtN(saldo, mon)}.`); return }
    setError('')
    setGuardando(true)
    let comprobanteUrl = ''
    if (foto) {
      try {
        const sRef = storageRef(storage, `comprobantes/${Date.now()}_${foto.name}`)
        const snap = await uploadBytes(sRef, foto)
        comprobanteUrl = await getDownloadURL(snap.ref)
      } catch (err) { console.error('Error subiendo comprobante:', err) }
    }
    await onGuardar({ id: genId(), monto: montoNum, metodo, referencia, fecha, nota, comprobante: comprobanteUrl, registradoEn: new Date().toISOString() })
    setGuardando(false)
  }

  const s = {
    lbl: { fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4, display: 'block' },
    inp: { width: '100%', padding: '8px 11px', border: '0.5px solid rgba(0,0,0,.18)', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fff', color: 'inherit', fontFamily: 'inherit', boxSizing: 'border-box' },
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: '#fff', borderRadius: 14, width: '95%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,.2)', border: '0.5px solid #e0e0e0' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>Registrar pago</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              Saldo pendiente: <strong style={{ color: '#A32D2D' }}>{sym(mon)}{fmtN(saldo, mon)}</strong>
            </div>
          </div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa', lineHeight: 1, padding: '4px 8px' }}>×</button>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={s.lbl}>Monto recibido ({mon})</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input style={{ ...s.inp, fontSize: 18, fontWeight: 600 }} type="number" min="0" step="0.01" placeholder="0.00" value={monto} onChange={e => setMonto(e.target.value)} autoFocus />
              <button style={{ padding: '8px 12px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 12, cursor: 'pointer', background: '#f5f5f5', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
                onClick={() => setMonto(saldo.toFixed(2))}>Saldo total</button>
            </div>
            {monto && Number(monto) > 0 && (
              <div style={{ fontSize: 11, color: '#3B6D11', marginTop: 4 }}>
                Saldo restante: {sym(mon)}{fmtN(Math.max(0, saldo - Number(monto)), mon)}
                {Number(monto) >= saldo && <span style={{ marginLeft: 6, fontWeight: 600 }}>✓ Salda la factura</span>}
              </div>
            )}
          </div>
          <div>
            <label style={s.lbl}>Método de pago</label>
            <select style={s.inp} value={metodo} onChange={e => setMetodo(e.target.value)}>
              {METODOS_PAGO.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={s.lbl}>Fecha del pago</label>
              <input style={s.inp} type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div>
              <label style={s.lbl}>Referencia / Comprobante</label>
              <input style={s.inp} placeholder="Nº transferencia, SINPE..." value={referencia} onChange={e => setReferencia(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={s.lbl}>Nota interna (opcional)</label>
            <textarea style={{ ...s.inp, resize: 'vertical' }} rows={2} placeholder="Observación sobre este pago..." value={nota} onChange={e => setNota(e.target.value)} onPaste={handlePaste} />
          </div>
          <div>
            <label style={s.lbl}>Comprobante (foto)</label>
            <input ref={fotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleFoto(e.target.files[0]); e.target.value = '' }} />
            {fotoPreview ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={fotoPreview} alt="comprobante" style={{ maxHeight: 120, maxWidth: '100%', borderRadius: 8, border: '1px solid #e0e0e0', display: 'block' }} />
                <button onClick={() => { setFoto(null); setFotoPreview(null) }} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#A32D2D', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => fotoRef.current?.click()} style={{ padding: '8px 14px', border: '1px dashed #bbb', borderRadius: 7, background: '#fafafa', color: '#888', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>📷 Subir imagen</button>
                <span style={{ fontSize: 11, color: '#bbb' }}>o Ctrl+V para pegar</span>
              </div>
            )}
          </div>
          <div style={{ padding: '8px 12px', background: '#FAEEDA', border: '0.5px solid #FAC775', borderRadius: 7, fontSize: 11, color: '#854F0B', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⏳</span>
            <span>Este pago quedará <strong>pendiente de aprobación</strong>. Un aprobador recibirá una notificación.</span>
          </div>
          {error && (
            <div style={{ padding: '8px 12px', background: '#FCEBEB', border: '0.5px solid #F7C1C1', borderRadius: 7, fontSize: 12, color: '#A32D2D' }}>
              {error}
            </div>
          )}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(0,0,0,.08)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCerrar} style={{ padding: '8px 16px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: '#f5f5f5', color: '#555', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={guardando || !monto} style={{ padding: '8px 22px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: guardando || !monto ? 'not-allowed' : 'pointer', background: guardando || !monto ? '#e0e0e0' : 'var(--eco-primary, #1a3a5c)', color: guardando || !monto ? '#aaa' : '#fff', fontFamily: 'inherit' }}>
            {guardando ? 'Enviando...' : 'Registrar pago'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function FacturaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const { puede, usuario } = usePermisos()

  const puedeRegistrarPago    = puede('facturas', 'Registrar pagos')
  const puedeMarcarIncobrable = puede('facturas', 'Marcar como incobrable')
  const puedeVerPrecios       = puede('facturas', 'Ver precios y montos')
  const puedeBancos           = puede('bancos', 'Ver') // permiso de bancos para editar fecha y solicitar eliminación
  const esAdmin               = usuario?.rol === 'Super Administrador' || usuario?.rol === 'Administrador'

  const [factura,             setFactura]             = useState(null)
  const [loading,             setLoading]             = useState(true)
  const [showModalPago,       setShowModalPago]       = useState(false)
  const [showModalIncobl,     setShowModalIncobl]     = useState(false)
  const [showModalEliminar,   setShowModalEliminar]   = useState(false)
  const [solicitudEnviada,    setSolicitudEnviada]    = useState(false)
  const [guardando,           setGuardando]           = useState(false)
  const [confirmElim,         setConfirmElim]         = useState(null)
  const [fechaEdit,           setFechaEdit]           = useState('')
  const [guardandoFecha,      setGuardandoFecha]      = useState(false)
  const [fechaGuardada,       setFechaGuardada]       = useState(false)
  const [editandoVendedor,    setEditandoVendedor]    = useState(false)
  const [nuevoVendedorId,     setNuevoVendedorId]     = useState('')
  const [listaVendedores,     setListaVendedores]     = useState([])

  useEffect(() => {
    getDocs(collection(db, 'usuarios')).then(snap => {
      setListaVendedores(snap.docs.map(d => ({ uid: d.id, ...d.data() })))
    })
  }, [])

  useEffect(() => { cargar() }, [id])

  const cargar = async () => {
    try {
      const snap = await getDoc(doc(db, 'facturas', id))
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() }
        setFactura(data)
        setFechaEdit(data.fechaVencimiento || '')
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  // ── Guardar fecha de vencimiento ─────────────────────────────────────────
  const guardarFecha = async () => {
    if (!fechaEdit || fechaEdit === factura.fechaVencimiento) return
    setGuardandoFecha(true)
    await updateDoc(doc(db, 'facturas', id), { fechaVencimiento: fechaEdit, actualizadoEn: serverTimestamp() })
    setFactura(f => ({ ...f, fechaVencimiento: fechaEdit }))
    setFechaGuardada(true)
    setTimeout(() => setFechaGuardada(false), 2500)
    setGuardandoFecha(false)
  }

  // ── Registrar pago ────────────────────────────────────────────────────────
  const registrarPago = async (pago) => {
    const pagosActuales = factura.pagos || []
    const pagoConAutor  = { ...pago, registradoPor: usuario?.nombre || currentUser?.displayName || 'Usuario' }
    const nuevosPagos   = [...pagosActuales, pagoConAutor]
    const totalPagado   = nuevosPagos.reduce((acc, p) => acc + Number(p.monto), 0)
    const saldo         = Math.max(0, Number(factura.total) - totalPagado)
    const estadoNuevo   = calcularEstado({ ...factura, totalPagado, saldo })

    const payload = { pagos: nuevosPagos, totalPagado, saldo, estado: estadoNuevo, actualizadoEn: serverTimestamp() }
    await updateDoc(doc(db, 'facturas', id), payload)
    setFactura(f => ({ ...f, ...payload, estadoCalculado: estadoNuevo }))

    try {
      await registrarPagoPendiente({
        factura: { id, numero: factura.numero, moneda: factura.moneda },
        pago:    pagoConAutor,
        vendedor: { uid: usuario?.uid, nombre: usuario?.nombre || currentUser?.displayName || 'Usuario' },
      })
    } catch (e) { console.warn('No se pudo enviar notificación de pago:', e) }

    setShowModalPago(false)
  }

  // ── Eliminar pago ─────────────────────────────────────────────────────────
  const eliminarPago = async (pagoId) => {
    const nuevosPagos = (factura.pagos || []).filter(p => p.id !== pagoId)
    const totalPagado = nuevosPagos.reduce((acc, p) => acc + Number(p.monto), 0)
    const saldo       = Math.max(0, Number(factura.total) - totalPagado)
    const estadoNuevo = calcularEstado({ ...factura, totalPagado, saldo })

    const payload = { pagos: nuevosPagos, totalPagado, saldo, estado: estadoNuevo, actualizadoEn: serverTimestamp() }
    await updateDoc(doc(db, 'facturas', id), payload)
    setFactura(f => ({ ...f, ...payload, estadoCalculado: estadoNuevo }))
    setConfirmElim(null)
  }

  // ── Enviar solicitud de eliminación ──────────────────────────────────────────
  const enviarSolicitudEliminacion = async (observacion) => {
    await solicitarEliminacionFactura({
      factura: { id, numero: factura.numero, clienteNombre: factura.clienteNombre, total: factura.total, moneda: factura.moneda },
      solicitante: { uid: usuario?.uid, nombre: usuario?.nombre || currentUser?.displayName || 'Usuario' },
      observacion,
    })
    setSolicitudEnviada(true)
    setShowModalEliminar(false)
  }

  // ── Marcar incobrable — ejecutar tras autorización ────────────────────────
  const confirmarIncobrable = async (nombreAdmin) => {
    const estadoNuevo = factura.estado === 'Incobrable'
      ? calcularEstado({ ...factura, estado: '' })
      : 'Incobrable'
    await updateDoc(doc(db, 'facturas', id), {
      estado: estadoNuevo,
      incobrableAutorizadoPor: nombreAdmin,
      incobrableEn: new Date().toISOString(),
      actualizadoEn: serverTimestamp(),
    })
    setFactura(f => ({ ...f, estado: estadoNuevo, estadoCalculado: estadoNuevo }))
    // Celebración pausada al marcar Incobrable — obtener avatar
    if (estadoNuevo === 'Incobrable') {
      let avIncob = ''
      if (factura.vendedorId) { try { const uS = await getDoc(doc(db, 'usuarios', factura.vendedorId)); if (uS.exists()) avIncob = uS.data().fotoURL || '' } catch {} }
      await addDoc(collection(db, 'ventas_celebraciones'), {
        tipo: 'pausada',
        vendedorId: factura.vendedorId || '',
        vendedorNombre: factura.vendedorNombre || '',
        vendedorAvatar: avIncob,
        facturaId: id,
        cotizacionId: factura.cotizacionId || '',
        monto: factura.total || 0,
        moneda: factura.moneda || 'USD',
        mensaje: 'La venta ha sido pausada — apoyo para recuperarla',
        creadoEn: serverTimestamp(),
        reacciones: {},
        visto: [],
      }).catch(() => {})
    }
    setShowModalIncobl(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>Cargando factura...</div>
  if (!factura) return <div style={{ padding: 40, color: '#c00', fontSize: 13 }}>Factura no encontrada.</div>

  const mon     = factura.moneda || 'USD'
  const tasa    = Number(factura.tasa || 519.5)
  const est     = factura.estadoCalculado || calcularEstado(factura)
  const cfg     = ESTADO_CONFIG[est] || ESTADO_CONFIG['Sin Pagar']
  const total   = Number(factura.total || 0)
  const pagado  = Number(factura.totalPagado || 0)
  const saldo   = Number(factura.saldo ?? (total - pagado))
  const dias    = diasRestantes(factura.fechaVencimiento)
  const vencida = (est === 'Sin Pagar' || est === 'Parcial') && dias !== null && dias < 0
  const proxima = !vencida && (est === 'Sin Pagar' || est === 'Parcial') && dias !== null && dias <= 5
  const pct     = total > 0 ? Math.min(100, Math.round((pagado / total) * 100)) : 0

  const opActiva  = factura.opciones?.find(o => o.id === factura.opcionActiva) || factura.opciones?.[0]
  const productos = opActiva?.productos || []

  const s = {
    page:    { padding: '20px 24px', minHeight: '100vh', background: 'var(--eco-bg, #f5f6f8)', fontSize: 13 },
    card:    { background: '#fff', border: '0.5px solid rgba(0,0,0,.08)', borderRadius: 10, padding: '18px 20px', marginBottom: 14 },
    lbl:     { fontSize: 10, fontWeight: 500, color: '#999', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3, display: 'block' },
    th:      { padding: '9px 12px', textAlign: 'left', fontWeight: 500, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '0.5px solid rgba(0,0,0,.06)', background: '#fafafa' },
    td:      { padding: '10px 12px', borderBottom: '0.5px solid rgba(0,0,0,.05)', verticalAlign: 'middle', fontSize: 13 },
    btn:     { padding: '6px 14px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 12, cursor: 'pointer', background: '#fff', fontFamily: 'inherit' },
    btnPrim: { padding: '8px 18px', background: 'var(--eco-primary, #1a3a5c)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
    inp:     { width: '100%', padding: '7px 10px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fff', color: 'inherit', fontFamily: 'inherit', boxSizing: 'border-box' },
  }

  return (
    <div style={s.page}>

      {showModalPago && (
        <ModalPago factura={{ ...factura, saldo }} onGuardar={registrarPago} onCerrar={() => setShowModalPago(false)} />
      )}

      {showModalIncobl && (
        <ModalIncobrableAuth
          onConfirmar={confirmarIncobrable}
          onCerrar={() => setShowModalIncobl(false)}
        />
      )}

      {showModalEliminar && (
        <ModalSolicitarEliminacion
          factura={{ ...factura, estadoCalculado: est }}
          onEnviar={enviarSolicitudEliminacion}
          onCerrar={() => setShowModalEliminar(false)}
        />
      )}

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={{ ...s.btn, padding: '5px 10px' }} onClick={() => navigate('/facturacion')}>← Volver</button>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--eco-primary, #1a3a5c)', fontFamily: 'monospace' }}>{factura.numero}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: cfg.bg, color: cfg.color }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot }} />
            {est}
          </span>
          {guardando && <span style={{ fontSize: 11, color: '#bbb' }}>Guardando...</span>}
          {solicitudEnviada && (
            <span style={{ fontSize: 11, background: '#EAF3DE', color: '#3B6D11', padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>
              ✓ Solicitud enviada al Super Admin
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {puedeBancos && est !== 'Pagada' && !solicitudEnviada && (
            <button
              style={{ ...s.btn, color: '#A32D2D', borderColor: '#fca5a5', background: '#fff8f8' }}
              onClick={() => setShowModalEliminar(true)}>
              🗑 Solicitar eliminación
            </button>
          )}
          {puedeMarcarIncobrable && est !== 'Pagada' && (
            <button
              style={{ ...s.btn, color: est === 'Incobrable' ? '#854F0B' : '#888', borderColor: est === 'Incobrable' ? '#EF9F27' : undefined }}
              onClick={() => setShowModalIncobl(true)}>
              {est === 'Incobrable' ? 'Reactivar' : 'Incobrable'}
            </button>
          )}
          {puedeRegistrarPago && est !== 'Pagada' && est !== 'Incobrable' && (
            <button style={s.btnPrim} onClick={() => setShowModalPago(true)}>+ Registrar pago</button>
          )}
        </div>
      </div>

      {/* Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>

        {/* Columna principal */}
        <div>
          {/* Encabezado */}
          <div style={s.card}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={s.lbl}>Cliente</label>
                <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{factura.clienteNombre || '—'}</p>
                {factura.facturarEmpresa && factura.empresaNombre && (
                  <>
                    <p style={{ fontSize: 12, color: '#888', margin: '2px 0 0' }}>{factura.empresaNombre}</p>
                    {factura.empresaCedula && <p style={{ fontSize: 11, color: '#bbb', margin: 0 }}>Cédula: {factura.empresaCedula}</p>}
                  </>
                )}
              </div>
              <div>
                <label style={s.lbl}>Vendedor</label>
                {editandoVendedor ? (
                  <select value={nuevoVendedorId} onChange={async (e) => {
                    const uid = e.target.value
                    const u = listaVendedores.find(v => v.uid === uid)
                    if (u) {
                      await updateDoc(doc(db, 'facturas', factura.id), { vendedorId: uid, vendedorNombre: u.nombre || u.email })
                      setFactura(prev => ({ ...prev, vendedorId: uid, vendedorNombre: u.nombre || u.email }))
                    }
                    setEditandoVendedor(false)
                  }} style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid #d0d8e0', fontFamily: 'inherit', width: '100%' }} autoFocus onBlur={() => setTimeout(() => setEditandoVendedor(false), 200)}>
                    <option value="">Seleccionar...</option>
                    {listaVendedores.map(v => <option key={v.uid} value={v.uid}>{v.nombre || v.email}</option>)}
                  </select>
                ) : (
                  <p style={{ fontWeight: 500, margin: 0, cursor: esAdmin ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => { if (esAdmin) { setNuevoVendedorId(factura.vendedorId || ''); setEditandoVendedor(true) } }}>
                    {factura.vendedorNombre || '—'}
                    {esAdmin && <span style={{ fontSize: 10, color: '#aaa' }}>✏️</span>}
                  </p>
                )}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div>
                <label style={s.lbl}>Emisión</label>
                <p style={{ margin: 0, fontWeight: 500 }}>{fmtFecha(factura.fechaEmision)}</p>
              </div>
              <div>
                <label style={s.lbl}>Vencimiento</label>
                <p style={{ margin: 0, fontWeight: 500, color: vencida ? '#A32D2D' : proxima ? '#854F0B' : 'inherit' }}>
                  {fmtFecha(factura.fechaVencimiento)}
                  {vencida && <span style={{ display: 'block', fontSize: 10, color: '#A32D2D', fontWeight: 600 }}>Vencida</span>}
                  {proxima && <span style={{ display: 'block', fontSize: 10, color: '#854F0B', fontWeight: 600 }}>Vence en {dias}d</span>}
                </p>
              </div>
              <div>
                <label style={s.lbl}>Moneda</label>
                <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: mon === 'USD' ? '#E6F1FB' : '#FAEEDA', color: mon === 'USD' ? '#185FA5' : '#854F0B' }}>{mon}</span>
              </div>
              <div>
                <label style={s.lbl}>Origen</label>
                {factura.cotizacionNumero ? (
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#185FA5', fontSize: 13, padding: 0, fontFamily: 'inherit', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                    onClick={() => navigate(`/ventas/cotizacion/${factura.cotizacionId}`)}>{factura.cotizacionNumero}</button>
                ) : factura.proyectoNumero ? (
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3B6D11', fontSize: 13, padding: 0, fontFamily: 'inherit', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                    onClick={() => navigate(`/proyectos/${factura.proyectoId}`)}>{factura.proyectoNumero}</button>
                ) : <span style={{ color: '#bbb' }}>—</span>}
              </div>
            </div>
          </div>

          {/* Tabla productos */}
          {puedeVerPrecios && productos.length > 0 && (
            <div style={s.card}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#444', margin: '0 0 12px' }}>Detalle</p>
              <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #eaecf2' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={s.th}>Producto</th>
                      <th style={{ ...s.th, textAlign: 'center', width: 60 }}>Cant.</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Precio</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Total c/IVA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productos.map((p, i) => {
                      const precio    = Number(p.precio || 0)
                      const cant      = Number(p.cantidad || 1)
                      const totalLine = precio * cant * 1.13
                      const precioMon = mon === 'CRC' ? precio * tasa : precio
                      const totalMon  = mon === 'CRC' ? totalLine * tasa : totalLine
                      return (
                        <tr key={p._lid || i} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                          <td style={s.td}>
                            <p style={{ fontWeight: 500, margin: 0 }}>{p.nombre}</p>
                            {p.descripcion && <p style={{ fontSize: 11, color: '#aaa', margin: '2px 0 0' }}>{p.descripcion}</p>}
                          </td>
                          <td style={{ ...s.td, textAlign: 'center', color: '#666' }}>{cant}</td>
                          <td style={{ ...s.td, textAlign: 'right', color: '#666' }}>{sym(mon)}{fmtN(precioMon, mon)}</td>
                          <td style={{ ...s.td, textAlign: 'right', fontWeight: 600, color: 'var(--eco-primary, #1a3a5c)' }}>{sym(mon)}{fmtN(totalMon, mon)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <div style={{ background: '#f8f9fb', borderRadius: 8, padding: '12px 16px', minWidth: 220, border: '0.5px solid #eaecf0' }}>
                  {[
                    { lbl: 'Subtotal',  val: factura.subtotal },
                    { lbl: 'Descuento', val: factura.descuento, neg: true },
                    { lbl: 'IVA (13%)', val: factura.impuesto },
                  ].map(({ lbl, val, neg }) => val > 0 && (
                    <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginBottom: 6 }}>
                      <span>{lbl}</span>
                      <span style={{ color: neg ? '#E24B4A' : 'inherit' }}>{neg ? '−' : ''}{sym(mon)}{fmtN(mon === 'CRC' ? val * tasa : val, mon)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, color: 'var(--eco-primary, #1a3a5c)', borderTop: '1.5px solid #e0e4ea', paddingTop: 8, marginTop: 4 }}>
                    <span>Total {mon}</span>
                    <span>{sym(mon)}{fmtN(mon === 'CRC' ? total * tasa : total, mon)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Historial de pagos */}
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#444', margin: 0 }}>
                Historial de pagos
                {(factura.pagos || []).length > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 11, background: '#E6F1FB', color: '#185FA5', padding: '1px 8px', borderRadius: 10, fontWeight: 500 }}>
                    {(factura.pagos || []).length}
                  </span>
                )}
              </p>
              {puedeRegistrarPago && est !== 'Pagada' && est !== 'Incobrable' && (
                <button style={{ ...s.btn, background: '#EAF3DE', color: '#3B6D11', borderColor: 'transparent', fontSize: 12, fontWeight: 500 }}
                  onClick={() => setShowModalPago(true)}>+ Registrar pago</button>
              )}
            </div>

            {(factura.pagos || []).length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: '#ccc', fontSize: 12, background: '#fafafa', borderRadius: 8, border: '0.5px dashed rgba(0,0,0,.1)' }}>
                Sin pagos registrados aún
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(factura.pagos || []).map((p, i) => (
                  <div key={p.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#fafafa', borderRadius: 8, border: '0.5px solid rgba(0,0,0,.06)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: '#EAF3DE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>
                      {p.metodo === 'Efectivo' ? '💵' : p.metodo?.includes('SINPE') ? '📱' : p.metodo?.includes('crédito') ? '💳' : p.metodo?.includes('Cheque') ? '📄' : '🏦'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: '#3B6D11' }}>{sym(mon)}{fmtN(p.monto, mon)}</span>
                        <span style={{ fontSize: 11, background: '#EAF3DE', color: '#3B6D11', padding: '1px 7px', borderRadius: 10 }}>{p.metodo}</span>
                        {p.aprobado && <span style={{ fontSize: 10, background: '#EAF3DE', color: '#3B6D11', padding: '1px 6px', borderRadius: 6, fontWeight: 600 }}>✓ Aprobado</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: '#888' }}>{fmtFecha(p.fecha)}</span>
                        {p.referencia    && <span style={{ fontSize: 11, color: '#888' }}>Ref: {p.referencia}</span>}
                        {p.registradoPor && <span style={{ fontSize: 11, color: '#bbb' }}>por {p.registradoPor}</span>}
                        {p.aprobadoPor   && <span style={{ fontSize: 11, color: '#3B6D11' }}>aprobado por {p.aprobadoPor}</span>}
                      </div>
                      {p.nota && <p style={{ fontSize: 11, color: '#999', margin: '4px 0 0', fontStyle: 'italic' }}>{p.nota}</p>}
                    </div>
                    {puedeRegistrarPago && est !== 'Incobrable' && (
                      confirmElim === p.id ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: '#A32D2D' }}>¿Eliminar?</span>
                          <button style={{ padding: '3px 10px', border: 'none', borderRadius: 5, fontSize: 11, cursor: 'pointer', background: '#FCEBEB', color: '#A32D2D', fontFamily: 'inherit' }} onClick={() => eliminarPago(p.id)}>Sí</button>
                          <button style={{ padding: '3px 10px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 5, fontSize: 11, cursor: 'pointer', background: '#fff', fontFamily: 'inherit' }} onClick={() => setConfirmElim(null)}>No</button>
                        </div>
                      ) : (
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 16, padding: '2px 6px', borderRadius: 4, lineHeight: 1 }}
                          onMouseEnter={e => e.currentTarget.style.color = '#E24B4A'}
                          onMouseLeave={e => e.currentTarget.style.color = '#ddd'}
                          onClick={() => setConfirmElim(p.id)}>✕</button>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {factura.observaciones && (
            <div style={s.card}>
              <label style={s.lbl}>Observaciones</label>
              <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>{factura.observaciones}</p>
            </div>
          )}
        </div>

        {/* Sidebar derecho */}
        <div style={{ position: 'sticky', top: 20 }}>

          {puedeVerPrecios && (
            <div style={{ ...s.card, marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '.6px', margin: '0 0 14px' }}>Resumen</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: '#888' }}>Total factura</span>
                <span style={{ fontWeight: 700, color: 'var(--eco-primary, #1a3a5c)' }}>{sym(mon)}{fmtN(mon === 'CRC' ? total * tasa : total, mon)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: '#888' }}>Pagado</span>
                <span style={{ fontWeight: 600, color: '#3B6D11' }}>{sym(mon)}{fmtN(mon === 'CRC' ? pagado * tasa : pagado, mon)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, fontSize: 13 }}>
                <span style={{ color: '#888' }}>Saldo</span>
                <span style={{ fontWeight: 700, color: saldo <= 0 ? '#3B6D11' : '#A32D2D', fontSize: 15 }}>
                  {saldo <= 0 ? '✓ Saldado' : `${sym(mon)}${fmtN(mon === 'CRC' ? saldo * tasa : saldo, mon)}`}
                </span>
              </div>
              <div style={{ background: '#f0f0f0', borderRadius: 20, height: 6, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#639922' : '#EF9F27', borderRadius: 20, transition: 'width 0.4s ease' }} />
              </div>
              <p style={{ fontSize: 11, color: '#aaa', textAlign: 'right', margin: 0 }}>{pct}% cobrado</p>
              {saldo > 0 && (
                <div style={{ marginTop: 12, border: '0.5px dashed rgba(0,0,0,.12)', borderRadius: 8, padding: '8px 10px', background: '#f8f9fb' }}>
                  <p style={{ fontSize: 10, fontWeight: 500, color: '#bbb', textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 3px' }}>
                    Saldo en {mon === 'USD' ? 'CRC' : 'USD'}
                  </p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#555', margin: 0 }}>
                    {mon === 'USD' ? `₡${Math.round(saldo * tasa).toLocaleString('es-CR')}` : `$${fmtN(saldo / tasa)}`}
                  </p>
                  <p style={{ fontSize: 10, color: '#bbb', margin: '2px 0 0' }}>Tasa ₡{tasa.toFixed(2)} / USD</p>
                </div>
              )}
            </div>
          )}

          {/* Estado + Fecha vencimiento + Acciones */}
          <div style={s.card}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '.6px', margin: '0 0 12px' }}>Estado</p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: cfg.bg, color: cfg.color, marginBottom: 14 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot }} />
              {est}
            </div>
            {vencida && <div style={{ padding: '8px 10px', background: '#FCEBEB', borderRadius: 7, fontSize: 12, color: '#A32D2D', marginBottom: 10, fontWeight: 500 }}>Venció el {fmtFecha(factura.fechaVencimiento)}</div>}
            {proxima && <div style={{ padding: '8px 10px', background: '#FAEEDA', borderRadius: 7, fontSize: 12, color: '#854F0B', marginBottom: 10, fontWeight: 500 }}>Vence en {dias} {dias === 1 ? 'día' : 'días'}</div>}

            {/* Fecha vencimiento — editable solo con permiso de bancos */}
            <label style={s.lbl}>Vencimiento</label>
            {puedeBancos ? (
              <div style={{ marginBottom: 10 }}>
                <input type="date" value={fechaEdit}
                  style={{ ...s.inp, marginBottom: 6 }}
                  onChange={e => setFechaEdit(e.target.value)} />
                {fechaEdit !== factura.fechaVencimiento && (
                  <button onClick={guardarFecha} disabled={guardandoFecha}
                    style={{ width:'100%', padding:'6px', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', background:'#185FA5', color:'#fff', fontFamily:'inherit' }}>
                    {guardandoFecha ? 'Guardando...' : '💾 Guardar fecha'}
                  </button>
                )}
                {fechaGuardada && <div style={{ fontSize:11, color:'#1a6e3c', textAlign:'center', marginTop:4 }}>✓ Fecha actualizada</div>}
              </div>
            ) : (
              <p style={{ fontWeight: 500, fontSize: 13, margin: '0 0 10px', color: vencida ? '#A32D2D' : 'inherit' }}>
                {fmtFecha(factura.fechaVencimiento)}
                {!puedeBancos && <span style={{ display:'block', fontSize:10, color:'#bbb', marginTop:2 }}>Solo usuarios con acceso a Bancos pueden editar</span>}
              </p>
            )}

            {puedeRegistrarPago && est !== 'Pagada' && est !== 'Incobrable' && (
              <button style={{ ...s.btnPrim, width: '100%', textAlign: 'center', marginBottom: 8 }} onClick={() => setShowModalPago(true)}>+ Registrar pago</button>
            )}
            {puedeMarcarIncobrable && est !== 'Pagada' && (
              <button
                style={{ width: '100%', padding: '7px 14px', border: '0.5px solid rgba(0,0,0,.12)', borderRadius: 7, fontSize: 12, cursor: 'pointer', background: est === 'Incobrable' ? '#FAEEDA' : '#f5f5f5', color: est === 'Incobrable' ? '#854F0B' : '#888', fontFamily: 'inherit' }}
                onClick={() => setShowModalIncobl(true)}>
                {est === 'Incobrable' ? 'Reactivar factura' : 'Marcar como incobrable'}
              </button>
            )}
            {factura.incobrableAutorizadoPor && est === 'Incobrable' && (
              <div style={{ marginTop:8, padding:'6px 10px', background:'#EEEDFE', borderRadius:6, fontSize:11, color:'#3C3489' }}>
                🔒 Autorizado por: <strong>{factura.incobrableAutorizadoPor}</strong>
              </div>
            )}
          </div>

          {/* Trazabilidad */}
          <div style={s.card}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '.6px', margin: '0 0 10px' }}>Trazabilidad</p>
            {factura.cotizacionNumero && (
              <button style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', border: '0.5px solid rgba(0,0,0,.1)', borderRadius: 7, cursor: 'pointer', background: '#f8f9fb', marginBottom: 6, fontFamily: 'inherit', textAlign: 'left' }}
                onClick={() => navigate(`/ventas/cotizacion/${factura.cotizacionId}`)}>
                <span style={{ fontSize: 16 }}>📋</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#185FA5' }}>Ver cotización</div>
                  <div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{factura.cotizacionNumero}</div>
                </div>
              </button>
            )}
            {factura.proyectoNumero && (
              <button style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', border: '0.5px solid rgba(0,0,0,.1)', borderRadius: 7, cursor: 'pointer', background: '#f8f9fb', marginBottom: 6, fontFamily: 'inherit', textAlign: 'left' }}
                onClick={() => navigate(`/proyectos/${factura.proyectoId}`)}>
                <span style={{ fontSize: 16 }}>📁</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#3B6D11' }}>Ver proyecto</div>
                  <div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{factura.proyectoNumero}</div>
                </div>
              </button>
            )}
            {factura.clienteId && (
              <button style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', border: '0.5px solid rgba(0,0,0,.1)', borderRadius: 7, cursor: 'pointer', background: '#f8f9fb', fontFamily: 'inherit', textAlign: 'left' }}
                onClick={() => navigate(`/contactos`)}>
                <span style={{ fontSize: 16 }}>👤</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{factura.clienteNombre}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>Ver contacto</div>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}