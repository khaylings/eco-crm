/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: FichaLeadPage.jsx
 * Módulo:  Leads
 * ============================================================
 */

import { useState, useEffect, useRef } from 'react'
import UserAvatar from '../../../shared/components/UserAvatar'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { collection, addDoc, serverTimestamp, getDocs, doc, getDoc, query, where, orderBy, onSnapshot, runTransaction } from 'firebase/firestore'
import { db } from '../../../firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import {
  suscribirLead, actualizarLead,
  suscribirNotas, agregarNota,
  suscribirTimeline, agregarTimeline,
  suscribirAdjuntos, subirAdjunto, eliminarAdjunto,
  obtenerColumnas, obtenerContactos, obtenerEmpresas,
  obtenerUsuarios, obtenerOrigenes,
} from '../../../firebase/leads'

const PRIORIDADES = [
  { valor: 'baja',  label: '⚪ Baja',  color: '#9e9e9e' },
  { valor: 'media', label: '🟡 Media', color: '#f59e0b' },
  { valor: 'alta',  label: '🔴 Alta',  color: '#ef4444' },
]

const TIPOS_ACTIVIDAD = [
  { valor: 'llamada',    label: '📞 Llamada',    color: '#185FA5', bg: '#E6F1FB', border: '#85B7EB' },
  { valor: 'reunion',    label: '👥 Reunión',    color: '#3C3489', bg: '#EEEDFE', border: '#AFA9EC' },
  { valor: 'visita',     label: '🚗 Visita',     color: '#27500A', bg: '#EAF3DE', border: '#97C459' },
  { valor: 'tarea',      label: '✅ Tarea',      color: '#633806', bg: '#FAEEDA', border: '#EF9F27' },
  { valor: 'incidencia', label: '⚠️ Incidencia', color: '#791F1F', bg: '#FCEBEB', border: '#F09595' },
  { valor: 'garantia',   label: '🛡️ Garantía',  color: '#444441', bg: '#F1EFE8', border: '#B4B2A9' },
  { valor: 'evento',     label: '📅 Evento',     color: '#0C447C', bg: '#E6F1FB', border: '#85B7EB' },
]

function colorTimeline(tipo) {
  const map = { etapa:'#378ADD', ganado:'#1D9E75', perdido:'#E24B4A', interno:'#534AB7', edicion:'#BA7517', adjunto:'#D4537E', cotizacion:'#1D9E75', evento:'#378ADD', llamada:'#185FA5', visita:'#3B6D11', incidencia:'#E24B4A', garantia:'#5F5E5A', whatsapp:'#25D366', email:'#EA4335', nota:'#BA7517' }
  return map[tipo] || '#888'
}

function diasDesde(ts) {
  if (!ts) return null
  const ms = ts.seconds ? ts.seconds * 1000 : new Date(ts).getTime()
  const diff = Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24))
  return diff > 0 ? `${diff}dd.` : 'hoy'
}

// ── Helper fecha email ────────────────────────────────────────────────────────
function formatFechaEmail(fecha) {
  if (!fecha) return ''
  const d = fecha?.toDate ? fecha.toDate() : new Date(fecha?.seconds ? fecha.seconds * 1000 : fecha)
  if (isNaN(d.getTime())) return ''
  const ahora = new Date()
  const diffH = Math.floor((ahora - d) / 3600000)
  const diffD = Math.floor((ahora - d) / 86400000)
  if (diffH < 24) return d.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })
  if (diffD < 7)  return d.toLocaleDateString('es-CR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
  return d.toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Sección con punto de color ────────────────────────────────────────────────
function Sec({ colorDot, titulo, children }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.92)', border: '0.5px solid #e8ecf0', borderRadius: 10, marginBottom: 7, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}>
      <div style={{ padding: '6px 11px', display: 'flex', alignItems: 'center', gap: 5, borderBottom: '0.5px solid #f0f0f0' }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: colorDot, flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 500, color: '#555', textTransform: 'uppercase', letterSpacing: '.6px' }}>{titulo}</span>
      </div>
      <div style={{ padding: '8px 11px' }}>{children}</div>
    </div>
  )
}

// ── Campo inline editable ─────────────────────────────────────────────────────
function Campo({ label, value, type = 'text', onSave, span2, children }) {
  const [ed, setEd] = useState(false)
  const [val, setVal] = useState(value || '')
  useEffect(() => setVal(value || ''), [value])
  if (children) return (
    <div style={{ gridColumn: span2 ? '1/-1' : undefined, marginBottom: 2 }}>
      <div style={S.fl}>{label}</div>
      <div style={{ fontSize: 11, color: '#1a1a1a' }}>{children}</div>
    </div>
  )
  return (
    <div style={{ gridColumn: span2 ? '1/-1' : undefined, marginBottom: 2 }}>
      <div style={S.fl}>{label}</div>
      {ed
        ? <input type={type} value={val} autoFocus onChange={e => setVal(e.target.value)}
            onBlur={() => { setEd(false); if (val !== (value||'')) onSave(val) }}
            style={{ width: '100%', padding: '3px 5px', border: '0.5px solid #185FA5', borderRadius: 5, fontSize: 11, outline: 'none', color: '#1a1a1a', fontFamily: 'inherit' }} />
        : <div onClick={() => setEd(true)} style={{ fontSize: 11, color: val ? '#1a1a1a' : '#ccc', borderBottom: '1px dashed #efefef', padding: '2px 0 3px', cursor: 'text', minHeight: 20 }}
            onMouseEnter={e => e.currentTarget.style.borderBottomColor = '#185FA5'}
            onMouseLeave={e => e.currentTarget.style.borderBottomColor = '#efefef'}>
            {val || '—'}
          </div>
      }
    </div>
  )
}

// ── Modal redactar email ───────────────────────────────────────────────────────
function ModalRedactarEmail({ cuentas, inicial, onCerrar }) {
  const fns = getFunctions()
  const fnEnviar = httpsCallable(fns, 'enviarEmail')
  const [para,     setPara]     = useState(inicial?.para || '')
  const [asunto,   setAsunto]   = useState(inicial?.asunto || '')
  const [cuerpo,   setCuerpo]   = useState('')
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id || '')
  const [enviando, setEnviando] = useState(false)
  const [error,    setError]    = useState(null)
  const [enviado,  setEnviado]  = useState(false)

  async function enviar() {
    if (!para.trim() || !asunto.trim() || !cuentaId) { setError('Completá: Para, Asunto y elegí una cuenta.'); return }
    setEnviando(true); setError(null)
    try {
      await fnEnviar({
        cuentaId,
        para: para.trim(),
        asunto: asunto.trim(),
        cuerpoTexto: cuerpo,
        cuerpoHtml: `<div style="font-family:inherit;font-size:14px;line-height:1.6">${cuerpo.replace(/\n/g, '<br>')}</div>`,
        leadId: inicial?.leadId || null,
        contactoId: inicial?.contactoId || null,
      })
      setEnviado(true)
      setTimeout(() => onCerrar(), 1200)
    } catch (e) { setError(e.message || 'Error al enviar.') }
    finally { setEnviando(false) }
  }

  const inp = { width: '100%', padding: '7px 9px', border: '0.5px solid #e0e0e0', borderRadius: 7, fontSize: 12, color: '#1a1a1a', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#fff' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(3px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: '#fff', borderRadius: 12, width: '95%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.25)', border: '0.5px solid #e0e0e0' }}>
        <div style={{ padding: '13px 18px', borderBottom: '0.5px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>✉️ Redactar correo</span>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa' }}>×</button>
        </div>
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>Desde</div>
            <select value={cuentaId} onChange={e => setCuentaId(e.target.value)} style={{ ...inp, fontSize: 12 }}>
              {cuentas.length === 0 ? <option value="">Sin cuentas configuradas</option> : cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre} &lt;{c.email}&gt;</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>Para *</div>
            <input value={para} onChange={e => setPara(e.target.value)} style={inp} placeholder="email@destino.com" />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>Asunto *</div>
            <input value={asunto} onChange={e => setAsunto(e.target.value)} style={inp} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>Mensaje</div>
            <textarea value={cuerpo} onChange={e => setCuerpo(e.target.value)} rows={8} style={{ ...inp, resize: 'vertical', lineHeight: 1.7 }} />
          </div>
          {error  && <div style={{ padding: '7px 10px', background: '#FCEBEB', border: '1px solid #f09595', borderRadius: 7, fontSize: 12, color: '#A32D2D' }}>{error}</div>}
          {enviado && <div style={{ padding: '7px 10px', background: '#EAF3DE', border: '1px solid #8BC34A', borderRadius: 7, fontSize: 12, color: '#3B6D11' }}>✓ Correo enviado correctamente</div>}
        </div>
        <div style={{ padding: '11px 18px', borderTop: '0.5px solid #eee', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCerrar} style={{ padding: '7px 16px', border: '1px solid #e0e0e0', borderRadius: 7, fontSize: 12, cursor: 'pointer', background: '#f5f5f5', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={enviar} disabled={enviando || !cuentaId} style={{ padding: '7px 20px', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: enviando ? 'not-allowed' : 'pointer', background: enviando ? '#ccc' : '#185FA5', color: '#fff', fontFamily: 'inherit' }}>
            {enviando ? 'Enviando...' : '📤 Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FichaLeadPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const fileInputRef = useRef(null)
  const chatRef = useRef(null)

  const [lead, setLead] = useState(null)
  const [columnas, setColumnas] = useState([])
  const [contactos, setContactos] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [origenes, setOrigenes] = useState([])
  const [notas, setNotas] = useState([])
  const [timeline, setTimeline] = useState([])
  const [adjuntos, setAdjuntos] = useState([])
  const [sedes, setSedes] = useState([])
  const [contactosSede, setContactosSede] = useState([])
  const [activosCliente, setActivosCliente] = useState([])
  const [leadsCliente, setLeadsCliente] = useState([])
  const [busqEmpresa, setBusqEmpresa] = useState('')
  const [busqContacto, setBusqContacto] = useState('')
  const [showEmpDrop, setShowEmpDrop] = useState(false)
  const [showCtDrop, setShowCtDrop] = useState(false)

  const [tabChat, setTabChat] = useState('interno')
  const [tabAbajo, setTabAbajo] = useState('observaciones')
  const [cotizacionesLead, setCotizacionesLead] = useState([])
  const [waNumActivo, setWaNumActivo] = useState(null)
  const [msgInput, setMsgInput] = useState('')
  const [chatOps, setChatOps] = useState([])
  const [msgOps, setMsgOps] = useState('')
  const [enviandoOps, setEnviandoOps] = useState(false)
  const chatOpsRef = useRef()
  const [panelIzqPct, setPanelIzqPct] = useState(65)
  const resizingPanel = useRef(false)
  const [obsInput, setObsInput] = useState('')
  const [modalAccion, setModalAccion] = useState(null)
  const [accionForm, setAccionForm] = useState({})
  const [modalPerdido, setModalPerdido] = useState(false)
  const [motivoPerdido, setMotivoPerdido] = useState('')
  const [adjuntoPreview, setAdjuntoPreview] = useState(null)
  const [subiendoArchivo, setSubiendoArchivo] = useState(false)
  const [modalAgregarWA, setModalAgregarWA] = useState(false)
  const [nuevoWA, setNuevoWA] = useState({ numero: '', etiqueta: '' })
  const [modalProyecto, setModalProyecto] = useState(false)
  const [formProyecto, setFormProyecto] = useState({})
  const [guardandoProy, setGuardandoProy] = useState(false)
  const [puedeEliminar, setPuedeEliminar] = useState(false)
  const [puedePerdido, setPuedePerdido] = useState(false)

  // ── Estados email ─────────────────────────────────────────────────────────
  const [emailsLead,        setEmailsLead]        = useState([])
  const [emailActivo,       setEmailActivo]        = useState(null)
  const [showRedactarEmail, setShowRedactarEmail]  = useState(false)
  const [cuentasEmail,      setCuentasEmail]       = useState([])

  const nombreUsuario = user?.displayName || user?.email || 'Usuario'

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubs = [
      suscribirLead(id, data => {
        setLead(data)
        if (!waNumActivo && data.whatsappNumeros?.length > 0) setWaNumActivo(data.whatsappNumeros[0].numero)
        if (data.empresaNombre) setBusqEmpresa(data.empresaNombre)
        if (data.empresaId) { cargarSedes(data.empresaId); cargarActivosCliente(data) }
        if (data.empresaId || data.contactoId) cargarLeadsCliente(data)
      }),
      suscribirNotas(id, setNotas),
      suscribirTimeline(id, setTimeline),
      suscribirAdjuntos(id, setAdjuntos),
    ]
    Promise.all([obtenerColumnas(), obtenerContactos(), obtenerEmpresas(), obtenerUsuarios(), obtenerOrigenes()])
      .then(([c, ct, em, us, or]) => { setColumnas(c); setContactos(ct); setEmpresas(em); setUsuarios(us); setOrigenes(or) })
    if (user?.uid) {
      getDoc(doc(db, 'usuarios', user.uid)).then(async uSnap => {
        const rolNombre = uSnap.exists() ? uSnap.data().rol : 'viewer'
        if (rolNombre === 'admin' || rolNombre === 'Administrador' || rolNombre === 'Super Administrador') { setPuedeEliminar(true); setPuedePerdido(true); return }
        const rSnap = await getDocs(collection(db, 'roles'))
        const rolDoc = rSnap.docs.map(d => ({ ...d.data() })).find(r => r.nombre?.toLowerCase() === rolNombre?.toLowerCase())
        if (rolDoc?.permisos) { setPuedeEliminar(!!rolDoc.permisos['crm_Eliminar lead']); setPuedePerdido(!!rolDoc.permisos['crm_Marcar como Perdido']) }
      }).catch(() => {})
    }
    return () => unsubs.forEach(u => u())
  }, [id])

  // Cargar cuentas de email
  useEffect(() => {
    const fns = getFunctions()
    const fn = httpsCallable(fns, 'listarCuentasEmail')
    fn().then(res => setCuentasEmail((res.data.cuentas || []).filter(c => c.activo))).catch(() => {})
  }, [])

  // Cargar emails vinculados al lead
  useEffect(() => {
    if (!id) return
    const q = lead?.contactoId
      ? query(collection(db, 'emails'), where('contactoId', '==', lead.contactoId), orderBy('creadoEn', 'desc'))
      : query(collection(db, 'emails'), where('leadId', '==', id), orderBy('creadoEn', 'desc'))
    return onSnapshot(q, snap => setEmailsLead(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [lead?.contactoId, id])

  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight }, [notas, tabChat, waNumActivo])

  // Cotizaciones del lead
  useEffect(() => {
    if (!id) return
    getDocs(query(collection(db, 'cotizaciones'), where('leadId', '==', id))).then(snap => {
      setCotizacionesLead(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }).catch(() => {})
  }, [id])

  // Chat operaciones
  useEffect(() => {
    if (!id) return
    const q = query(collection(db, `leads/${id}/chat_operaciones`), orderBy('creadoEn', 'asc'))
    return onSnapshot(q, snap => {
      setChatOps(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setTimeout(() => { if (chatOpsRef.current) chatOpsRef.current.scrollTop = chatOpsRef.current.scrollHeight }, 100)
    })
  }, [id])

  const enviarMsgOps = async () => {
    if (!msgOps.trim() || enviandoOps) return
    setEnviandoOps(true)
    try {
      await addDoc(collection(db, `leads/${id}/chat_operaciones`), {
        texto: msgOps.trim(),
        autorId: usuario?.uid,
        autorNombre: nombreUsuario,
        creadoEn: serverTimestamp(),
      })
      setMsgOps('')
    } catch (e) { console.error(e) }
    finally { setEnviandoOps(false) }
  }

  async function cargarSedes(empresaId) {
    try { const snap = await getDocs(collection(db, 'empresas', empresaId, 'sedes')); setSedes(snap.docs.map(d => ({ _id: d.id, ...d.data() }))) }
    catch { setSedes([]) }
  }

  async function cargarActivosCliente(data) {
    try {
      const snap = await getDocs(collection(db, 'activos'))
      const todos = snap.docs.map(d => ({ _id: d.id, ...d.data() }))
      setActivosCliente(todos.filter(a => (data.empresaId && a.empresaId === data.empresaId) || (data.sedeId && a.sedeId === data.sedeId) || (data.contactoId && a.contactoId === data.contactoId)))
    } catch { setActivosCliente([]) }
  }

  async function cargarContactosSede(empresaId, sedeId) {
    try {
      const snap = await getDocs(collection(db, 'contactos'))
      setContactosSede(snap.docs.map(d => ({ _id: d.id, ...d.data() })).filter(c => c.empresaId === empresaId && (!sedeId || c.sedeId === sedeId)))
    } catch { setContactosSede([]) }
  }

  async function cargarLeadsCliente(data) {
    try {
      const snap = await getDocs(collection(db, 'leads'))
      const todos = snap.docs.map(d => ({ _id: d.id, ...d.data() }))
      setLeadsCliente(todos.filter(l => l._id !== id && ((data.empresaId && l.empresaId === data.empresaId) || (data.contactoId && l.contactoId === data.contactoId))))
    } catch { setLeadsCliente([]) }
  }

  async function guardarCampo(campo, valor) { await actualizarLead(id, { [campo]: valor }) }

  async function cambiarEtapa(columnaId) {
    const ant = columnas.find(c => c.id === lead.columnaId)?.nombre || '—'
    const nueva = columnas.find(c => c.id === columnaId)?.nombre || '—'
    await actualizarLead(id, { columnaId })
    await agregarTimeline(id, { tipo: 'etapa', texto: `Etapa: "${ant}" → "${nueva}"`, usuario: nombreUsuario })
  }

  async function marcarGanado() {
    await actualizarLead(id, { estado: 'ganado' })
    await agregarTimeline(id, { tipo: 'ganado', texto: 'Lead marcado como Ganado', usuario: nombreUsuario })
  }

  async function marcarPerdido() {
    if (!motivoPerdido.trim()) return alert('El motivo es obligatorio')
    await actualizarLead(id, { estado: 'perdido', motivoPerdido })
    await agregarTimeline(id, { tipo: 'perdido', texto: `Perdido. Motivo: ${motivoPerdido}`, usuario: nombreUsuario })
    setModalPerdido(false); setMotivoPerdido('')
  }

  async function enviarMensaje() {
    if (!msgInput.trim()) return
    await agregarNota(id, { texto: msgInput, autor: nombreUsuario, tipo: tabChat, waNumero: tabChat === 'whatsapp' ? waNumActivo : undefined })
    await agregarTimeline(id, { tipo: tabChat, texto: `${nombreUsuario}: ${msgInput.slice(0,50)}`, usuario: nombreUsuario })
    setMsgInput('')
  }

  async function guardarObservacion() {
    if (!obsInput.trim()) return
    await agregarNota(id, { texto: obsInput, autor: nombreUsuario, tipo: 'observacion' })
    setObsInput('')
  }

  async function agregarNumeroWA() {
    if (!nuevoWA.numero.trim()) return
    const numeros = [...(lead.whatsappNumeros || []), nuevoWA]
    await actualizarLead(id, { whatsappNumeros: numeros })
    setWaNumActivo(nuevoWA.numero); setModalAgregarWA(false); setNuevoWA({ numero: '', etiqueta: '' })
  }

  async function ejecutarAccion() {
    await agregarTimeline(id, { tipo: modalAccion, texto: accionForm.titulo || modalAccion, detalle: accionForm, usuario: nombreUsuario })
    setModalAccion(null); setAccionForm({})
  }

  async function crearCotizacion() {
    try {
      const configRef  = doc(db, 'config', 'consecutivos')
      const counterRef = doc(db, 'config', 'contadores')
      const numero = await runTransaction(db, async (tx) => {
        const configSnap  = await tx.get(configRef)
        const counterSnap = await tx.get(counterRef)
        const prefijo   = configSnap.exists() ? (configSnap.data().prefijoCotizacion || 'CTO') : 'CTO'
        const contadores = counterSnap.exists() ? counterSnap.data() : {}
        const actual    = Number(contadores.prefijoCotizacion || 0) + 1
        tx.set(counterRef, { ...contadores, prefijoCotizacion: actual }, { merge: true })
        return `${prefijo}-${String(actual).padStart(3, '0')}`
      })
      // Cargar términos predeterminados
      let terminosDefault = '';
      try {
        const pltSnap = await getDoc(doc(db, 'configuracion', 'plantilla_cotizacion'));
        if (pltSnap.exists()) terminosDefault = pltSnap.data().terminosCotizacion || '';
      } catch {}
      const ref = await addDoc(collection(db, 'cotizaciones'), {
        numero,
        estado: 'Borrador',
        moneda: 'USD',
        tasa: 519.50,
        tasaAuto: true,
        clienteId: lead.contactoId || null,
        clienteNombre: lead.cliente || '',
        facturarEmpresa: !!lead.empresaId,
        empresaNombre: lead.empresaNombre || '',
        empresaCedula: '',
        contactoNombre: lead.cliente || '',
        vendedorId: user?.uid || null,
        vendedorNombre: nombreUsuario || '',
        opciones: [{ id: 'A', nombre: 'Opción A', productos: [], productosOpcionales: [] }],
        opcionActiva: 'A',
        descuentoGlobal: 0,
        descuentoGlobalTipo: '%',
        observaciones: '',
        terminos: terminosDefault,
        fichasTecnicas: [],
        fechaEmision: new Date().toISOString().split('T')[0],
        fechaVencimiento: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        vistoPorCliente: false,
        aceptada: false,
        firmaNombre: '',
        firmaCedula: '',
        facturaId: null,
        leadId: id,
        creadoEn: serverTimestamp(),
      })
      await agregarTimeline(id, { tipo: 'cotizacion', texto: `${nombreUsuario} creó cotización ${numero}`, usuario: nombreUsuario })
      navigate(`/ventas/cotizacion/${ref.id}`)
    } catch (err) {
      console.error(err)
      alert('Error creando cotización: ' + err.message)
    }
  }

  async function handleArchivo(e) {
    const file = e.target.files[0]; if (!file) return
    setSubiendoArchivo(true)
    try { await subirAdjunto(id, file, nombreUsuario); await agregarTimeline(id, { tipo: 'adjunto', texto: `${nombreUsuario} adjuntó "${file.name}"`, usuario: nombreUsuario }) }
    catch (err) { alert('Error: ' + err.message) }
    setSubiendoArchivo(false); e.target.value = ''
  }

  async function abrirModalProyecto() {
    const [cfgSnap, proySnap] = await Promise.all([getDocs(collection(db, 'config')), getDocs(collection(db, 'proyectos'))])
    const cfg = {}; cfgSnap.docs.forEach(d => { cfg[d.id] = d.data() })
    const prefijo = cfg.consecutivos?.prefijoProyecto || 'PRY'
    const clienteTexto = [lead.empresa || lead.empresaNombre, lead.sedeNombre, lead.cliente].filter(Boolean).join(' — ') || lead.nombre || ''
    setFormProyecto({ nombre: '', numero: `${prefijo}-${String(proySnap.size+1).padStart(3,'0')}`, fecha: new Date().toISOString().split('T')[0], estado: 'activo', ubicacion: '', descripcion: '', monto: '', toneladas: '', leadId: id, leadNombre: lead.nombre||'', empresaId: lead.empresaId||'', empresaNombre: lead.empresa||lead.empresaNombre||'', sedeId: lead.sedeId||'', sedeNombre: lead.sedeNombre||'', contactoId: lead.contactoId||'', contactoNombre: lead.cliente||'', clienteTexto })
    setModalProyecto(true)
  }

  async function crearProyectoDesdeL() {
    if (!formProyecto.nombre?.trim()) return alert('Ingresa el nombre del proyecto')
    setGuardandoProy(true)
    await addDoc(collection(db, 'proyectos'), { ...formProyecto, monto: parseFloat(formProyecto.monto)||0, toneladas: parseFloat(formProyecto.toneladas)||0, numCotizaciones: 0, _ts: serverTimestamp() })
    await agregarTimeline(id, { tipo: 'evento', texto: `Proyecto "${formProyecto.nombre}" creado`, usuario: nombreUsuario })
    setGuardandoProy(false); setModalProyecto(false)
    alert('Proyecto creado.')
  }

  if (!lead) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#aaa', fontSize:13 }}>Cargando lead...</div>

  const colActualIdx = columnas.findIndex(c => c.id === lead.columnaId)
  const waNumeros = lead.whatsappNumeros || (lead.whatsapp ? [{ numero: lead.whatsapp, etiqueta: 'Principal' }] : [])
  const tipoLead = lead.tipoLead || 'empresa'
  const notasFiltradas = notas.filter(n => {
    if (tabChat === 'interno')   return n.tipo === 'interno' || n.tipo === 'nota' || !n.tipo
    if (tabChat === 'whatsapp') return n.tipo === 'whatsapp' && n.waNumero === waNumActivo
    if (tabChat === 'email')    return n.tipo === 'email'
    return false
  })
  const obsNotas = notas.filter(n => n.tipo === 'observacion')
  const empresasFiltradas = empresas.filter(e => !busqEmpresa || (e.nombre||'').toLowerCase().includes(busqEmpresa.toLowerCase()))
  const contactosFiltrados = (tipoLead === 'empresa' ? contactosSede : contactos).filter(c => !busqContacto || (c.nombre||c.nombreCompleto||'').toLowerCase().includes(busqContacto.toLowerCase()))

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'#f5f6fa', overflow:'hidden' }}>

      {/* TOPBAR */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e8ecf0', padding:'0 14px', display:'flex', alignItems:'stretch', gap:0, flexShrink:0, height:38 }}>
        <button onClick={() => navigate('/crm')} style={S.odooBtn}>← Volver</button>
        <button onClick={crearCotizacion} style={{ ...S.odooBtn, color:'#185FA5', fontWeight:500 }}>+ Nueva cotización</button>
        <button onClick={abrirModalProyecto} style={{ ...S.odooBtn, color:'#3B6D11', fontWeight:500 }}>+ Nuevo proyecto</button>
        {lead.estado !== 'ganado' && lead.estado !== 'perdido' && (
          <button onClick={marcarGanado} style={{ ...S.odooBtn, color:'#065F46' }}>✓ Ganado</button>
        )}
        {puedePerdido && lead.estado !== 'ganado' && lead.estado !== 'perdido' && (
          <button onClick={() => setModalPerdido(true)} style={{ ...S.odooBtn, color:'#991B1B' }}>✕ Perdido</button>
        )}
        {puedeEliminar && (
          <button onClick={async () => {
            if (!window.confirm('¿Eliminar este lead?')) return
            const { eliminarLead } = await import('../../../firebase/contactos')
            await eliminarLead(id); navigate('/crm')
          }} style={{ ...S.odooBtn, color:'#991B1B' }}>🗑 Eliminar</button>
        )}
        {lead.estado === 'ganado' && <span style={{ alignSelf:'center', padding:'2px 10px', background:'#D1FAE5', color:'#065F46', fontSize:11, fontWeight:500, marginLeft:6 }}>✓ Ganado</span>}
        {lead.estado === 'perdido' && <span style={{ alignSelf:'center', padding:'2px 10px', background:'#FEE2E2', color:'#991B1B', fontSize:11, fontWeight:500, marginLeft:6 }}>✕ Perdido</span>}
        <div style={{ flex:1 }} />
        <span style={{ alignSelf:'center', fontSize:10, fontWeight:600, padding:'2px 8px', background: tipoLead==='empresa'?'#E6F1FB':'#EEEDFE', color: tipoLead==='empresa'?'#185FA5':'#534AB7', textTransform:'uppercase', letterSpacing:'.5px' }}>
          {tipoLead === 'empresa' ? '🏢 Empresa' : '👤 Persona'}
        </span>
      </div>

      {/* ETAPAS */}
      <div style={{ background:'#f0f2f5', borderBottom:'0.5px solid #d8dce2', display:'flex', overflowX:'auto', flexShrink:0 }}>
        {columnas.map((col, i) => {
          const isActual = col.id === lead.columnaId
          const isPasada = colActualIdx > i
          const ts = isPasada ? null : (isActual ? lead._ts : null)
          const dias = ts ? diasDesde(ts) : null
          return (
            <div key={col.id} onClick={() => cambiarEtapa(col.id)} style={{ padding:'6px 12px', fontSize:11, color: isActual ? '#fff' : isPasada ? '#555' : '#888', cursor:'pointer', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5, fontWeight: isActual ? 500 : 400, position:'relative', margin:'5px 3px', borderRadius:4, background: isActual ? '#4a5568' : 'transparent', borderLeft: isActual ? '3px solid #185FA5' : '3px solid transparent', transition:'background .15s' }}
              onMouseEnter={e => { if (!isActual) e.currentTarget.style.background='#e2e5ea' }}
              onMouseLeave={e => { if (!isActual) e.currentTarget.style.background='transparent' }}>
              {isPasada && <span style={{ color:'#3B6D11', fontSize:10 }}>✓</span>}
              {col.nombre}
              {dias && <span style={{ fontSize:9, background: isActual ? 'rgba(255,255,255,.2)' : '#d8dce2', color: isActual ? '#fff' : '#555', padding:'1px 5px', borderRadius:3 }}>{dias}</span>}
            </div>
          )
        })}
      </div>

      {/* CUERPO */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}
        onMouseMove={e => { if (!resizingPanel.current) return; const rect = e.currentTarget.getBoundingClientRect(); const pct = ((e.clientX - rect.left) / rect.width) * 100; setPanelIzqPct(Math.min(80, Math.max(40, pct))) }}
        onMouseUp={() => { resizingPanel.current = false }}
        onMouseLeave={() => { resizingPanel.current = false }}>

        {/* IZQUIERDA */}
        <div id="panel-left" style={{ width:`${panelIzqPct}%`, overflowY:'auto', padding:'10px 12px', flexShrink:0 }}>
          <TituloEditable value={lead.nombre} onSave={v => guardarCampo('nombre', v)} />

          {/* Empresa y contacto */}
          <Sec colorDot="#185FA5" titulo={tipoLead === 'empresa' ? 'Empresa y contacto' : 'Contacto'}>
            {tipoLead === 'empresa' ? (
              <div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 14px', marginBottom:6 }}>
                  <div style={{ gridColumn:'1/-1', position:'relative' }}>
                    <div style={S.fl}>Empresa</div>
                    <input style={S.inpSm} placeholder="Buscar empresa..." value={busqEmpresa}
                      onChange={e => { setBusqEmpresa(e.target.value); setShowEmpDrop(true); if (!e.target.value) guardarCampo('empresaId','') }}
                      onFocus={() => setShowEmpDrop(true)} onBlur={() => setTimeout(() => setShowEmpDrop(false), 200)} />
                    {showEmpDrop && busqEmpresa && empresasFiltradas.length > 0 && (
                      <div style={S.drop}>
                        {empresasFiltradas.slice(0,5).map(emp => (
                          <div key={emp.id} onMouseDown={() => { setBusqEmpresa(emp.nombre); setShowEmpDrop(false); guardarCampo('empresaId',emp.id); guardarCampo('empresaNombre',emp.nombre); setSedes([]); setContactosSede([]); cargarSedes(emp.id) }}
                            style={S.dropItem} onMouseEnter={e=>e.currentTarget.style.background='#f0f4f8'} onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                            {emp.nombre}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {sedes.length > 0 && (
                    <div style={{ gridColumn:'1/-1' }}>
                      <div style={S.fl}>Sede</div>
                      <select style={S.inpSm} value={lead.sedeId||''} onChange={e => { const s=sedes.find(x=>x._id===e.target.value); guardarCampo('sedeId',e.target.value); guardarCampo('sedeNombre',s?.nombre||''); if(lead.empresaId) cargarContactosSede(lead.empresaId,e.target.value) }}>
                        <option value="">— Seleccionar sede —</option>
                        {sedes.map(s => <option key={s._id} value={s._id}>{s.nombre}</option>)}
                      </select>
                    </div>
                  )}
                  <div style={{ gridColumn:'1/-1', position:'relative' }}>
                    <div style={S.fl}>Contacto</div>
                    <input style={S.inpSm} placeholder="Buscar contacto..." value={busqContacto}
                      onChange={e => { setBusqContacto(e.target.value); setShowCtDrop(true) }}
                      onFocus={() => setShowCtDrop(true)} onBlur={() => setTimeout(() => setShowCtDrop(false), 200)} />
                    {showCtDrop && busqContacto && contactosFiltrados.length > 0 && (
                      <div style={S.drop}>
                        {contactosFiltrados.slice(0,5).map(c => (
                          <div key={c._id} onMouseDown={() => { setBusqContacto(c.nombre||c.nombreCompleto||''); setShowCtDrop(false); guardarCampo('contactoId',c._id); guardarCampo('cliente',c.nombre||c.nombreCompleto||'') }}
                            style={S.dropItem} onMouseEnter={e=>e.currentTarget.style.background='#f0f4f8'} onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                            <div style={{ fontWeight:500, fontSize:12 }}>{c.nombre||c.nombreCompleto}</div>
                            {c.cargo && <div style={{ fontSize:10, color:'#aaa' }}>{c.cargo}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div><div style={S.fl}>Empresa actual</div><div style={{ fontSize:11, color:'#1a1a1a', fontWeight:500, borderBottom:'1px dashed #efefef', padding:'2px 0 3px' }}>{lead.empresaNombre||'—'}</div></div>
                  <div><div style={S.fl}>Sede actual</div><div style={{ fontSize:11, color:'#1a1a1a', borderBottom:'1px dashed #efefef', padding:'2px 0 3px' }}>{lead.sedeNombre||'—'}</div></div>
                  <div><div style={S.fl}>Contacto actual</div><div style={{ fontSize:11, color:'#1a1a1a', borderBottom:'1px dashed #efefef', padding:'2px 0 3px' }}>{lead.cliente||'—'}</div></div>
                  <Campo label="Teléfono" value={lead.telefono} onSave={v => guardarCampo('telefono',v)} />
                </div>
                <div>
                  <div style={S.fl}>WhatsApp</div>
                  {waNumeros.map((wa,i) => (
                    <div key={i} onClick={() => { setTabChat('whatsapp'); setWaNumActivo(wa.numero) }}
                      style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#1a1a1a', padding:'3px 0', borderBottom:'1px dashed #efefef', cursor:'pointer' }}>
                      <div style={{ width:6, height:6, borderRadius:'50%', background:'#25D366', flexShrink:0 }} />
                      {wa.numero}<span style={{ fontSize:9, color:'#bbb', marginLeft:2 }}>{wa.etiqueta}</span>
                    </div>
                  ))}
                  <button onClick={() => setModalAgregarWA(true)} style={{ fontSize:10, color:'#25D366', background:'none', border:'none', cursor:'pointer', padding:'3px 0', marginTop:2 }}>+ Agregar número</button>
                </div>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 14px' }}>
                <Campo label="Contacto" value={lead.cliente} onSave={v => guardarCampo('cliente',v)} />
                <Campo label="Teléfono" value={lead.telefono} onSave={v => guardarCampo('telefono',v)} />
              </div>
            )}
          </Sec>

          {/* Negocio */}
          <Sec colorDot="#3B6D11" titulo="Negocio">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 14px' }}>
              <div><div style={{ fontSize:9, color:'#8a99b3', fontWeight:600, marginBottom:2 }}>Vendedor</div><div style={{ display:'flex', alignItems:'center', gap:5 }}><UserAvatar nombre={lead.vendedor} uid={lead.vendedorId} size={18} /><Campo label="" value={lead.vendedor} onSave={v => guardarCampo('vendedor',v)} /></div></div>
              <Campo label="Origen" value={lead.origen} onSave={v => guardarCampo('origen',v)} />
              <Campo label="Valor estimado ($)" value={lead.valor} type="number" onSave={v => guardarCampo('valor',v)} />
              <div style={{ marginBottom:2 }}>
                <div style={S.fl}>Probabilidad</div>
                <div style={{ display:'flex', alignItems:'center', gap:5, padding:'2px 0 3px', borderBottom:'1px dashed #efefef' }}>
                  <div style={{ flex:1, height:3, background:'#eee', borderRadius:2 }}><div style={{ width:`${lead.probabilidad||0}%`, height:'100%', background:'#378ADD', borderRadius:2 }} /></div>
                  <span style={{ fontSize:10, color:'#555' }}>{lead.probabilidad||0}%</span>
                </div>
              </div>
              <div style={{ marginBottom:2 }}>
                <div style={S.fl}>Prioridad</div>
                <select style={{ ...S.inpSm, borderBottom:'1px dashed #efefef', border:'none', padding:'2px 0', fontSize:11 }} value={lead.prioridad||''} onChange={e => guardarCampo('prioridad',e.target.value)}>
                  <option value="">Sin prioridad</option>
                  {PRIORIDADES.map(p => <option key={p.valor} value={p.valor}>{p.label}</option>)}
                </select>
              </div>
              <Campo label="Etiquetas" value={(lead.etiquetas||[]).join(', ')} onSave={v => guardarCampo('etiquetas', v.split(',').map(x=>x.trim()).filter(Boolean))} />
            </div>
          </Sec>

          {/* Pestañas abajo */}
          <div style={{ background:'rgba(255,255,255,0.92)', border:'0.5px solid #e8ecf0', borderRadius:10, overflow:'hidden', boxShadow:'0 1px 2px rgba(0,0,0,.04)' }}>
            <div style={{ display:'flex', borderBottom:'0.5px solid #eef0f4', padding:'0 6px' }}>
              {[
                { k:'observaciones', label:'Observaciones' },
                { k:'adjuntos',      label:`Adjuntos (${adjuntos.length})` },
                { k:'activos',       label:`Activos (${activosCliente.length})` },
                { k:'leads',         label:`Leads (${leadsCliente.length})` },
                { k:'cotizaciones',  label:`Cotizaciones (${cotizacionesLead.length})` },
              ].map(t => (
                <button key={t.k} onClick={() => setTabAbajo(t.k)} style={{ padding:'6px 10px', fontSize:10, border:'none', background:'none', color:tabAbajo===t.k?'#185FA5':'#aaa', borderBottom:tabAbajo===t.k?'2px solid #185FA5':'2px solid transparent', fontWeight:tabAbajo===t.k?500:400, cursor:'pointer', whiteSpace:'nowrap', marginBottom:-1, fontFamily:'inherit' }}>
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ padding:'10px 11px' }}>
              {tabAbajo === 'observaciones' && (
                <div>
                  <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                    <textarea value={obsInput} onChange={e => setObsInput(e.target.value)} placeholder="Agregar observación..."
                      onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();guardarObservacion()} }}
                      rows={2} style={{ flex:1, padding:'5px 8px', border:'0.5px solid #e0e0e0', borderRadius:7, fontSize:11, resize:'none', fontFamily:'inherit', color:'#1a1a1a', outline:'none' }} />
                    <button onClick={guardarObservacion} style={{ padding:'5px 10px', background:'#1a3a5c', color:'#fff', border:'none', borderRadius:7, cursor:'pointer', fontSize:11, alignSelf:'flex-end', fontFamily:'inherit' }}>Agregar</button>
                  </div>
                  {obsNotas.length === 0
                    ? <div style={{ textAlign:'center', color:'#ccc', fontSize:12, padding:'12px 0' }}>Sin observaciones aún</div>
                    : obsNotas.map(n => (
                        <div key={n.id} style={{ background:'#f8f9fc', borderRadius:7, padding:'8px 10px', marginBottom:6, fontSize:12 }}>
                          <div style={{ fontSize:9, color:'#bbb', marginBottom:3 }}>{n.autor} · {n.creadoEn?.toDate?.()?.toLocaleString('es-CR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})||''}</div>
                          {n.texto}
                        </div>
                      ))
                  }
                </div>
              )}
              {tabAbajo === 'adjuntos' && (
                <div>
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleArchivo} style={{ display:'none' }} />
                  <button onClick={() => fileInputRef.current?.click()} disabled={subiendoArchivo}
                    style={{ marginBottom:10, padding:'5px 12px', background:'#f0f2f5', border:'0.5px solid #ddd', borderRadius:7, cursor:'pointer', fontSize:11, color:'#555', fontFamily:'inherit' }}>
                    {subiendoArchivo ? 'Subiendo...' : '📎 Subir archivo'}
                  </button>
                  {adjuntos.length === 0
                    ? <div style={{ textAlign:'center', color:'#ccc', fontSize:12, padding:'12px 0' }}>Sin adjuntos</div>
                    : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))', gap:8 }}>
                        {adjuntos.map(adj => (
                          <div key={adj.id} onClick={() => setAdjuntoPreview(adj)} style={{ background:'#f8f9fc', borderRadius:8, border:'0.5px solid #e0e0e0', padding:'8px', cursor:'pointer', textAlign:'center' }}
                            onMouseEnter={e=>e.currentTarget.style.borderColor='#185FA5'} onMouseLeave={e=>e.currentTarget.style.borderColor='#e0e0e0'}>
                            {adj.tipo?.startsWith('image') ? <img src={adj.url} alt={adj.nombre} style={{ width:'100%', height:60, objectFit:'cover', borderRadius:5, marginBottom:4 }} /> : <div style={{ fontSize:22, marginBottom:4 }}>📄</div>}
                            <div style={{ fontSize:10, color:'#555', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{adj.nombre}</div>
                            <button onClick={e=>{e.stopPropagation();eliminarAdjunto(id,adj.id,adj.storageRef)}} style={{ marginTop:3, background:'none', border:'none', cursor:'pointer', fontSize:10, color:'#e24b4a', fontFamily:'inherit' }}>Eliminar</button>
                          </div>
                        ))}
                      </div>
                  }
                </div>
              )}
              {tabAbajo === 'activos' && (
                <div>
                  <div style={{ fontSize:11, color:'#888', marginBottom:8 }}>Activos asociados al cliente, empresa o sede de este lead.</div>
                  {activosCliente.length === 0
                    ? <div style={{ textAlign:'center', color:'#ccc', fontSize:12, padding:'12px 0' }}>Sin activos asociados</div>
                    : activosCliente.map(a => (
                        <div key={a._id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', background:'#f8f9fc', borderRadius:8, marginBottom:6, border:'0.5px solid #e8ecf0' }}>
                          <span style={{ fontSize:14, flexShrink:0 }}>❄️</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:12, fontWeight:500 }}>{a.tipo} {a.marca} {a.modelo}</div>
                            <div style={{ fontSize:10, color:'#aaa' }}>{a.nroSerie} {a.estado?`· ${a.estado}`:''}</div>
                          </div>
                        </div>
                      ))
                  }
                </div>
              )}
              {tabAbajo === 'leads' && (
                <div>
                  {leadsCliente.length === 0
                    ? <div style={{ textAlign:'center', color:'#ccc', fontSize:12, padding:'12px 0' }}>Sin otros leads de este cliente</div>
                    : leadsCliente.map(l => {
                        const col = columnas.find(c => c.id === l.columnaId)
                        return (
                          <div key={l._id} onClick={() => navigate(`/crm/lead/${l._id}`)} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'#f8f9fc', borderRadius:8, marginBottom:6, cursor:'pointer', border:'0.5px solid #e8ecf0' }}
                            onMouseEnter={e=>e.currentTarget.style.borderColor='#185FA5'} onMouseLeave={e=>e.currentTarget.style.borderColor='#e8ecf0'}>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:12, fontWeight:500 }}>{l.nombre}</div>
                              <div style={{ fontSize:10, color:'#aaa', marginTop:1 }}>{col?.nombre||'—'}</div>
                            </div>
                            <span style={{ fontSize:12, color:'#bbb' }}>›</span>
                          </div>
                        )
                      })
                  }
                </div>
              )}
              {tabAbajo === 'cotizaciones' && (
                <div>
                  {cotizacionesLead.length === 0
                    ? <div style={{ textAlign:'center', color:'#ccc', fontSize:12, padding:'12px 0' }}>Sin cotizaciones vinculadas</div>
                    : cotizacionesLead.map(c => {
                        const estColors = { Borrador:'#5F5E5A', Enviada:'#185FA5', Vista:'#3C3489', Aceptada:'#3B6D11', Rechazada:'#A32D2D', Facturada:'#185FA5' }
                        const estBg = { Borrador:'#F1EFE8', Enviada:'#E6F1FB', Vista:'#EEEDFE', Aceptada:'#EAF3DE', Rechazada:'#FCEBEB', Facturada:'#E6F1FB' }
                        const mon = c.moneda || 'USD'
                        const sym = mon === 'USD' ? '$' : '₡'
                        const total = c.opciones?.reduce((best, op) => {
                          const t = (op.productos || []).reduce((s, p) => s + Number(p.precioVentaItem || p.precio || 0) * Number(p.cantidad || 1), 0)
                          return t > best ? t : best
                        }, 0) || 0
                        return (
                          <div key={c.id} onClick={() => navigate(`/ventas/cotizacion/${c.id}`)} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'#f8f9fc', borderRadius:8, marginBottom:6, cursor:'pointer', border:'0.5px solid #e8ecf0' }}
                            onMouseEnter={e=>e.currentTarget.style.borderColor='#185FA5'} onMouseLeave={e=>e.currentTarget.style.borderColor='#e8ecf0'}>
                            <div style={{ flex:1 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                <span style={{ fontSize:12, fontWeight:600, fontFamily:'monospace', color:'#888' }}>{c.numero || '—'}</span>
                                <span style={{ fontSize:10, padding:'1px 6px', borderRadius:10, background:estBg[c.estado]||'#eee', color:estColors[c.estado]||'#888', fontWeight:500 }}>{c.estado}</span>
                              </div>
                              <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>
                                {c.fechaEmision ? c.fechaEmision.split('-').reverse().join('/') : '—'}
                                {' · '}{sym}{Number(total).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}
                              </div>
                            </div>
                            <span style={{ fontSize:12, color:'#bbb' }}>›</span>
                          </div>
                        )
                      })
                  }
                </div>
              )}
            </div>
          </div>
        </div>

        {/* DIVISOR */}
        <div style={{ width:1, background:'#e0e4ea', flexShrink:0 }} />

        {/* DERECHA */}
        {/* Divisor arrastrable */}
        <div onMouseDown={() => { resizingPanel.current = true }} style={{ width:5, cursor:'col-resize', background:'#e0e4ea', flexShrink:0, transition:'background .15s' }} onMouseEnter={e => e.currentTarget.style.background='#378ADD'} onMouseLeave={e => { if(!resizingPanel.current) e.currentTarget.style.background='#e0e4ea' }} />

        <div id="panel-right" style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'#fff' }}>
          {/* Acciones rápidas */}
          <div style={{ padding:'8px 10px', display:'flex', flexWrap:'wrap', gap:4, flexShrink:0, background:'#f5f6fa' }}>
            {TIPOS_ACTIVIDAD.map(a => (
              <button key={a.valor} onClick={() => { setModalAccion(a.valor); setAccionForm({ tipo:a.valor }) }}
                style={{ padding:'4px 10px', fontSize:11, borderRadius:4, cursor:'pointer', background:'#fff', color:a.color, border:`1px solid ${a.border}`, fontFamily:'inherit', whiteSpace:'nowrap' }}>
                {a.label}
              </button>
            ))}
          </div>

          {/* Tabs chatter */}
          <div style={{ display:'flex', borderBottom:'0.5px solid #eee', flexShrink:0, padding:'0 10px' }}>
            {[
              { key:'interno',   label:'🔒 Interno' },
              { key:'whatsapp', label:'💬 WhatsApp' },
              { key:'email',    label:'📧 Email' },
              { key:'operaciones', label:'🛠️ Operaciones' },
              { key:'historial',label:'🕐 Historial' },
            ].map(t => (
              <button key={t.key} onClick={() => setTabChat(t.key)} style={{ padding:'8px 10px', fontSize:11, cursor:'pointer', background:'none', border:'none', borderBottom:tabChat===t.key?'2px solid #378ADD':'2px solid transparent', color:tabChat===t.key?'#378ADD':'#aaa', fontWeight:tabChat===t.key?500:400, whiteSpace:'nowrap', fontFamily:'inherit' }}>{t.label}</button>
            ))}
          </div>

          {/* Selector número WA */}
          {tabChat === 'whatsapp' && (
            <div style={{ display:'flex', gap:5, padding:'6px 10px', borderBottom:'0.5px solid #eee', flexShrink:0, background:'#f8f9fc', alignItems:'center', flexWrap:'wrap' }}>
              {waNumeros.map((wa,i) => (
                <button key={i} onClick={() => setWaNumActivo(wa.numero)} style={{ padding:'3px 9px', borderRadius:20, fontSize:10, cursor:'pointer', border:'0.5px solid', background:waNumActivo===wa.numero?'#E8F5E9':'#fff', color:waNumActivo===wa.numero?'#065F46':'#888', borderColor:waNumActivo===wa.numero?'#6EE7B7':'#e0e0e0', fontFamily:'inherit' }}>
                  💬 {wa.numero} <span style={{ background:waNumActivo===wa.numero?'#25D366':'#aaa', color:'#fff', fontSize:8, padding:'0 4px', borderRadius:6 }}>{wa.etiqueta}</span>
                </button>
              ))}
              <button onClick={() => setModalAgregarWA(true)} style={{ padding:'3px 9px', borderRadius:20, fontSize:10, cursor:'pointer', border:'0.5px dashed #ddd', background:'none', color:'#aaa', fontFamily:'inherit' }}>+ Agregar</button>
            </div>
          )}
          {tabChat === 'interno' && <div style={{ padding:'4px 12px', background:'#EEEDFE', fontSize:10, color:'#3C3489', flexShrink:0 }}>🔒 Solo visible para el equipo</div>}

          {/* ── Contenido tabs ── */}
          {tabChat === 'historial' ? (
            <div style={{ flex:1, overflowY:'auto', padding:'12px' }}>
              {timeline.length === 0 && <div style={{ textAlign:'center', color:'#ccc', fontSize:12, padding:'30px 0' }}>Sin actividad aún</div>}
              {timeline.map(item => (
                <div key={item.id} style={{ display:'flex', gap:8, marginBottom:10, alignItems:'flex-start' }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:colorTimeline(item.tipo), marginTop:3, flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, color:'#1a1a1a' }}>{item.texto}</div>
                    <div style={{ fontSize:9, color:'#bbb', marginTop:1 }}>{item.usuario} · {item.creadoEn?.toDate?.()?.toLocaleString('es-CR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})||''}</div>
                  </div>
                </div>
              ))}
            </div>

          ) : tabChat === 'operaciones' ? (
            <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
              <div style={{ padding:'6px 12px', background:'#FAEEDA', borderBottom:'1px solid #EDD98A', fontSize:11, color:'#854F0B', flexShrink:0 }}>
                🛠️ Chat con operaciones {lead.asignados?.length > 0 && <span style={{ marginLeft:6, fontWeight:500 }}>— Asignados: {lead.asignados.map(a => a.nombre).join(', ')}</span>}
              </div>
              <div ref={chatOpsRef} style={{ flex:1, overflowY:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:5, background:'#f8f9fb' }}>
                {chatOps.length === 0 && <div style={{ textAlign:'center', color:'#bbb', fontSize:12, marginTop:30 }}>Sin mensajes con operaciones</div>}
                {chatOps.map(msg => {
                  const esMio = msg.autorId === usuario?.uid
                  return (
                    <div key={msg.id} style={{ display:'flex', flexDirection:'column', alignItems:esMio?'flex-end':'flex-start' }}>
                      <div style={{ maxWidth:'80%', padding:'6px 10px', borderRadius:esMio?'10px 10px 2px 10px':'10px 10px 10px 2px', background:esMio?'#854F0B':'#fff', color:esMio?'#fff':'#1a1a1a', fontSize:12, lineHeight:1.5, border:esMio?'none':'1px solid #eaecf0' }}>
                        {!esMio && <div style={{ fontSize:9, fontWeight:600, color:'#854F0B', marginBottom:2 }}>{msg.autorNombre}</div>}
                        {msg.texto}
                      </div>
                      <span style={{ fontSize:8, color:'#bbb', marginTop:1 }}>{msg.creadoEn?.toDate ? (() => { const d=msg.creadoEn.toDate(); const diff=Math.floor((Date.now()-d.getTime())/60000); return diff<1?'ahora':diff<60?`${diff}min`:`${Math.floor(diff/60)}h` })() : ''}</span>
                    </div>
                  )
                })}
              </div>
              <div style={{ padding:'8px 10px', borderTop:'1px solid #e0e4ea', display:'flex', gap:6, flexShrink:0 }}>
                <input value={msgOps} onChange={e => setMsgOps(e.target.value)} onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();enviarMsgOps()} }} placeholder="Mensaje a operaciones..." style={{ flex:1, padding:'6px 10px', border:'1px solid #dde3ed', borderRadius:7, fontSize:12, outline:'none', fontFamily:'inherit' }} />
                <button onClick={enviarMsgOps} disabled={!msgOps.trim()||enviandoOps} style={{ padding:'6px 12px', border:'none', borderRadius:7, background:!msgOps.trim()?'#e0e0e0':'#854F0B', color:!msgOps.trim()?'#aaa':'#fff', fontSize:11, fontWeight:600, cursor:!msgOps.trim()?'not-allowed':'pointer', fontFamily:'inherit' }}>Enviar</button>
              </div>
            </div>

          ) : tabChat === 'email' ? (
            <>
              {/* Barra superior email */}
              <div style={{ padding:'8px 10px', borderBottom:'0.5px solid #eee', flexShrink:0, display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8f9fc' }}>
                <span style={{ fontSize:11, color:'#888' }}>{emailsLead.length} correo{emailsLead.length !== 1 ? 's' : ''} vinculados</span>
                <button onClick={() => setShowRedactarEmail(true)} style={{ padding:'4px 12px', background:'#185FA5', color:'#fff', border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>✉️ Redactar</button>
              </div>

              {/* Lista emails */}
              <div ref={chatRef} style={{ flex:1, overflowY:'auto' }}>
                {emailsLead.length === 0 ? (
                  <div style={{ textAlign:'center', color:'#ccc', fontSize:12, padding:'30px 0' }}>
                    <div style={{ fontSize:28, marginBottom:6 }}>📭</div>
                    Sin correos vinculados a este contacto
                    <div style={{ marginTop:12 }}>
                      <button onClick={() => setShowRedactarEmail(true)} style={{ padding:'6px 14px', background:'#185FA5', color:'#fff', border:'none', borderRadius:7, fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>Enviar primer correo</button>
                    </div>
                  </div>
                ) : emailsLead.map(em => {
                  const esEntrada = em.direccion === 'entrada'
                  const esActivo  = emailActivo?.id === em.id
                  return (
                    <div key={em.id} onClick={() => setEmailActivo(esActivo ? null : em)}
                      style={{ cursor:'pointer', borderBottom:'0.5px solid #f0f0f0', background: esActivo ? '#EEF3FA' : '#fff' }}
                      onMouseEnter={e => { if (!esActivo) e.currentTarget.style.background = '#f9fafb' }}
                      onMouseLeave={e => { if (!esActivo) e.currentTarget.style.background = esActivo ? '#EEF3FA' : '#fff' }}>
                      <div style={{ padding:'10px 12px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
                          <div style={{ width:24, height:24, borderRadius:'50%', background: esEntrada ? '#185FA5' : '#3B6D11', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', fontWeight:700, flexShrink:0 }}>
                            {esEntrada ? '↓' : '↑'}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:600, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {esEntrada ? (em.contactoNombre || em.de) : `→ ${em.para}`}
                            </div>
                            <div style={{ fontSize:10, color:'#888' }}>{formatFechaEmail(em.fecha || em.creadoEn)}</div>
                          </div>
                          {em.estado === 'no_leido' && <div style={{ width:7, height:7, borderRadius:'50%', background:'#185FA5', flexShrink:0 }} />}
                        </div>
                        <div style={{ fontSize:12, fontWeight:500, color:'#1a1a1a', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{em.asunto || '(Sin asunto)'}</div>
                        <div style={{ fontSize:11, color:'#aaa', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{(em.cuerpoTexto || '').slice(0, 70)}</div>
                      </div>
                      {esActivo && (
                        <div style={{ padding:'0 12px 12px', borderTop:'0.5px solid #eef0f4' }}>
                          <div style={{ background:'#f8f9fc', borderRadius:8, padding:'10px 12px', fontSize:12, lineHeight:1.7, color:'#1a1a1a', whiteSpace:'pre-wrap', maxHeight:200, overflowY:'auto', marginTop:8 }}>
                            {em.cuerpoTexto || '(Sin contenido en texto plano)'}
                          </div>
                          {em.adjuntos?.length > 0 && (
                            <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:5 }}>
                              {em.adjuntos.map((adj, i) => (
                                <span key={i} style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'#f0f4f8', color:'#555', border:'1px solid #e0e0e0' }}>📎 {adj.nombre}</span>
                              ))}
                            </div>
                          )}
                          {esEntrada && (
                            <button onClick={e => { e.stopPropagation(); setShowRedactarEmail(true) }}
                              style={{ marginTop:8, padding:'4px 12px', background:'transparent', color:'#185FA5', border:'1px solid #185FA5', borderRadius:6, fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>
                              ↩ Responder
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Botón inferior */}
              <div style={{ padding:'8px 10px', borderTop:'0.5px solid #eee', flexShrink:0, background:'#fff' }}>
                <button onClick={() => setShowRedactarEmail(true)} style={{ width:'100%', padding:'8px', background:'#f0f4f8', border:'1px solid #c8d9ee', borderRadius:8, fontSize:12, color:'#185FA5', fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>
                  ✉️ Redactar nuevo correo al contacto
                </button>
              </div>
            </>

          ) : (
            <>
              <div ref={chatRef} style={{ flex:1, overflowY:'auto', padding:'12px', display:'flex', flexDirection:'column', gap:10 }}>
                {notasFiltradas.length === 0 && (
                  <div style={{ textAlign:'center', color:'#ccc', fontSize:12, padding:'30px 0' }}>
                    {tabChat === 'interno'   && 'Sin comunicación interna aún'}
                    {tabChat === 'whatsapp' && 'Sin mensajes aún'}
                  </div>
                )}
                {notasFiltradas.map(nota => {
                  const esMio = nota.autor === nombreUsuario
                  return (
                    <div key={nota.id}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                        <div style={{ width:22, height:22, borderRadius:'50%', background:esMio?'#D1FAE5':tabChat==='interno'?'#EDE9FE':'#E8F5E9', color:esMio?'#065F46':'#3C3489', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:500, flexShrink:0 }}>
                          {(nota.autor||'U').slice(0,2).toUpperCase()}
                        </div>
                        <span style={{ fontSize:11, fontWeight:500, color:'#1a1a1a' }}>{nota.autor}</span>
                        <span style={{ fontSize:9, color:'#bbb' }}>{nota.creadoEn?.toDate?.()?.toLocaleString('es-CR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})||''}</span>
                      </div>
                      <div style={{ marginLeft:28, background:tabChat==='interno'?'#EDE9FE':tabChat==='whatsapp'&&!esMio?'#E8F5E9':'#f8f9fc', borderRadius:'0 8px 8px 8px', padding:'7px 10px', fontSize:12, lineHeight:1.5, color:'#1a1a1a' }}>
                        {nota.texto}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ padding:'8px 10px', borderTop:'0.5px solid #eee', flexShrink:0 }}>
                <div style={{ display:'flex', gap:6 }}>
                  <textarea value={msgInput} onChange={e => setMsgInput(e.target.value)}
                    onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();enviarMensaje()} }}
                    placeholder={tabChat==='interno'?'Mensaje interno...':'Mensaje WhatsApp...'}
                    rows={2} style={{ flex:1, padding:'6px 8px', border:'0.5px solid #e0e0e0', borderRadius:8, fontSize:11, background:'#fff', color:'#1a1a1a', resize:'none', fontFamily:'inherit', outline:'none' }} />
                  <button onClick={enviarMensaje} style={{ padding:'6px 12px', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:11, alignSelf:'flex-end', fontFamily:'inherit', background:tabChat==='interno'?'#534AB7':'#25D366' }}>Enviar</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* MODALES */}
      {modalAccion && (
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setModalAccion(null)}>
          <div style={S.modal}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ fontSize:14, fontWeight:500, margin:0 }}>{TIPOS_ACTIVIDAD.find(a=>a.valor===modalAccion)?.label}</h3>
              <button onClick={()=>setModalAccion(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#aaa' }}>×</button>
            </div>
            <CI label="Título" value={accionForm.titulo||''} onChange={v=>setAccionForm(p=>({...p,titulo:v}))} />
            <CI label="Fecha" type="date" value={accionForm.fecha||''} onChange={v=>setAccionForm(p=>({...p,fecha:v}))} />
            <CI label="Hora" type="time" value={accionForm.hora||''} onChange={v=>setAccionForm(p=>({...p,hora:v}))} />
            <CI label="Notas" type="textarea" value={accionForm.notas||''} onChange={v=>setAccionForm(p=>({...p,notas:v}))} />
            <div style={{ display:'flex', gap:8, marginTop:14 }}>
              <button onClick={ejecutarAccion} style={{ flex:1, padding:8, background:'#378ADD', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:500, fontFamily:'inherit' }}>Guardar</button>
              <button onClick={()=>setModalAccion(null)} style={S.btn}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {modalPerdido && (
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setModalPerdido(false)}>
          <div style={S.modal}>
            <h3 style={{ fontSize:14, fontWeight:500, margin:'0 0 14px' }}>Marcar como Perdido</h3>
            <CI label="Motivo *" type="textarea" value={motivoPerdido} onChange={setMotivoPerdido} placeholder="¿Por qué se perdió este lead?" />
            <div style={{ display:'flex', gap:8, marginTop:14 }}>
              <button onClick={marcarPerdido} style={{ flex:1, padding:8, background:'#FEE2E2', color:'#991B1B', border:'0.5px solid #FCA5A5', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:500, fontFamily:'inherit' }}>Confirmar pérdida</button>
              <button onClick={()=>setModalPerdido(false)} style={S.btn}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {modalAgregarWA && (
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setModalAgregarWA(false)}>
          <div style={S.modal}>
            <h3 style={{ fontSize:14, fontWeight:500, margin:'0 0 14px' }}>Agregar WhatsApp</h3>
            <CI label="Número" value={nuevoWA.numero} onChange={v=>setNuevoWA(p=>({...p,numero:v}))} placeholder="+506 0000 0000" />
            <CI label="Etiqueta" value={nuevoWA.etiqueta} onChange={v=>setNuevoWA(p=>({...p,etiqueta:v}))} placeholder="Principal" />
            <div style={{ display:'flex', gap:8, marginTop:14 }}>
              <button onClick={agregarNumeroWA} style={{ flex:1, padding:8, background:'#25D366', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:500, fontFamily:'inherit' }}>Agregar</button>
              <button onClick={()=>setModalAgregarWA(false)} style={S.btn}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {adjuntoPreview && (
        <div style={{ ...S.overlay, zIndex:200 }} onClick={()=>setAdjuntoPreview(null)}>
          <div style={{ background:'#fff', borderRadius:12, padding:16, maxWidth:680, width:'90%', maxHeight:'85vh', overflow:'auto' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
              <span style={{ fontSize:13, fontWeight:500 }}>{adjuntoPreview.nombre}</span>
              <button onClick={()=>setAdjuntoPreview(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18 }}>×</button>
            </div>
            {adjuntoPreview.tipo?.startsWith('image') ? <img src={adjuntoPreview.url} alt={adjuntoPreview.nombre} style={{ width:'100%', borderRadius:8 }} /> : <iframe src={adjuntoPreview.url} title={adjuntoPreview.nombre} style={{ width:'100%', height:480, border:'none', borderRadius:8 }} />}
          </div>
        </div>
      )}

      {modalProyecto && (
        <div style={{ ...S.overlay, zIndex:200 }} onClick={e=>e.target===e.currentTarget&&setModalProyecto(false)}>
          <div style={{ background:'#fff', borderRadius:14, padding:22, width:'95%', maxWidth:500, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.2)', border:'1px solid #e0e0e0' }}>
            <div style={{ fontSize:14, fontWeight:500, marginBottom:4 }}>Nuevo Proyecto</div>
            <div style={{ fontSize:11, color:'#888', marginBottom:14 }}>Lead: <strong style={{ color:'#2e7d32' }}>{lead.nombre}</strong></div>
            {formProyecto.clienteTexto && <div style={{ background:'#e8f5e9', border:'1px solid #a5d6a7', borderRadius:7, padding:'6px 10px', fontSize:11, color:'#1b5e20', marginBottom:12 }}>Cliente: <strong>{formProyecto.clienteTexto}</strong></div>}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              <div style={{ gridColumn:'1/-1' }}><label style={S.pL}>Nombre *</label><input style={S.pI} placeholder="Nombre del proyecto" value={formProyecto.nombre||''} onChange={e=>setFormProyecto(f=>({...f,nombre:e.target.value}))} /></div>
              <div><label style={S.pL}>N de Proyecto</label><input style={{ ...S.pI, fontFamily:'monospace', color:'#2e7d32' }} value={formProyecto.numero||''} onChange={e=>setFormProyecto(f=>({...f,numero:e.target.value}))} /></div>
              <div><label style={S.pL}>Fecha</label><input type="date" style={S.pI} value={formProyecto.fecha||''} onChange={e=>setFormProyecto(f=>({...f,fecha:e.target.value}))} /></div>
              <div><label style={S.pL}>Toneladas TR</label><input type="number" step="0.5" style={S.pI} value={formProyecto.toneladas||''} onChange={e=>setFormProyecto(f=>({...f,toneladas:e.target.value}))} /></div>
              <div><label style={S.pL}>Presupuesto ($)</label><input type="number" style={S.pI} value={formProyecto.monto||''} onChange={e=>setFormProyecto(f=>({...f,monto:e.target.value}))} /></div>
              <div><label style={S.pL}>Estado</label><select style={S.pI} value={formProyecto.estado||'activo'} onChange={e=>setFormProyecto(f=>({...f,estado:e.target.value}))}><option value="activo">Activo</option><option value="pendiente">Pendiente</option><option value="pausa">En pausa</option></select></div>
              <div><label style={S.pL}>Ubicacion</label><input style={S.pI} value={formProyecto.ubicacion||''} onChange={e=>setFormProyecto(f=>({...f,ubicacion:e.target.value}))} /></div>
              <div style={{ gridColumn:'1/-1' }}><label style={S.pL}>Descripcion</label><textarea style={{ ...S.pI, resize:'vertical', minHeight:50 }} value={formProyecto.descripcion||''} onChange={e=>setFormProyecto(f=>({...f,descripcion:e.target.value}))} /></div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:10, borderTop:'1px solid #eee' }}>
              <button onClick={()=>setModalProyecto(false)} style={{ padding:'7px 16px', borderRadius:7, cursor:'pointer', background:'#f5f5f5', border:'1px solid #ddd', fontSize:12, color:'#555', fontFamily:'inherit' }}>Cancelar</button>
              <button onClick={crearProyectoDesdeL} disabled={guardandoProy} style={{ padding:'7px 16px', borderRadius:7, border:'none', cursor:'pointer', background:'#2e7d32', color:'#fff', fontSize:12, fontWeight:500, fontFamily:'inherit' }}>{guardandoProy?'Creando...':'+ Crear proyecto'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal redactar email */}
      {showRedactarEmail && (
        <ModalRedactarEmail
          cuentas={cuentasEmail}
          inicial={{
            para: lead?.email || '',
            asunto: '',
            leadId: id,
            contactoId: lead?.contactoId || null,
          }}
          onCerrar={() => setShowRedactarEmail(false)}
        />
      )}
    </div>
  )
}

function TituloEditable({ value, onSave }) {
  const [ed, setEd] = useState(false)
  const [val, setVal] = useState(value||'')
  useEffect(() => setVal(value||''), [value])
  return ed
    ? <input value={val} onChange={e=>setVal(e.target.value)} onBlur={() => { setEd(false); if(val!==(value||'')) onSave(val) }} autoFocus style={{ fontSize:15, fontWeight:500, color:'#1a1a1a', border:'none', borderBottom:'2px solid #185FA5', outline:'none', width:'100%', background:'transparent', fontFamily:'inherit', marginBottom:8 }} />
    : <h1 onClick={() => setEd(true)} style={{ fontSize:15, fontWeight:500, color:'#1a1a1a', margin:'0 0 8px', cursor:'text' }}>{value}</h1>
}

function CI({ label, type='text', value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom:8 }}>
      <div style={{ fontSize:10, color:'#888', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:3 }}>{label}</div>
      {type==='textarea'
        ? <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{ width:'100%', padding:'6px 8px', border:'0.5px solid #e0e0e0', borderRadius:7, fontSize:12, resize:'vertical', minHeight:60, fontFamily:'inherit', color:'#1a1a1a', outline:'none', boxSizing:'border-box' }} />
        : <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{ width:'100%', padding:'6px 8px', border:'0.5px solid #e0e0e0', borderRadius:7, fontSize:12, fontFamily:'inherit', color:'#1a1a1a', outline:'none', boxSizing:'border-box' }} />
      }
    </div>
  )
}

const S = {
  btn:     { padding:'4px 10px', borderRadius:6, fontSize:11, fontWeight:500, border:'0.5px solid #ddd', cursor:'pointer', background:'#fff', color:'#555', fontFamily:'inherit' },
  fl:      { fontSize:9, color:'#bbb', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:1 },
  inpSm:  { width:'100%', padding:'4px 6px', border:'0.5px solid #e0e0e0', borderRadius:6, fontSize:11, color:'#1a1a1a', fontFamily:'inherit', outline:'none', boxSizing:'border-box' },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' },
  modal:   { background:'#fff', borderRadius:12, border:'0.5px solid #e0e0e0', width:400, padding:18, maxHeight:'85vh', overflowY:'auto' },
  drop:    { position:'absolute', zIndex:200, background:'#fff', border:'1px solid #e0e0e0', borderRadius:8, boxShadow:'0 8px 24px rgba(0,0,0,.1)', maxHeight:180, overflowY:'auto', width:'100%', marginTop:2 },
  dropItem:{ padding:'8px 12px', cursor:'pointer', fontSize:12, borderBottom:'1px solid #f5f5f5', color:'#1a1a1a', background:'#fff' },
  pL:      { display:'block', fontSize:10, fontWeight:500, color:'#888', marginBottom:3, textTransform:'uppercase', letterSpacing:'.5px' },
  pI:      { width:'100%', padding:'7px 10px', borderRadius:7, fontSize:12, border:'1px solid #e0e0e0', background:'#fff', color:'#1a1a1a', fontFamily:'inherit', outline:'none', boxSizing:'border-box' },
  odooBtn: { padding:'0 14px', fontSize:12, fontWeight:400, border:'none', borderRight:'1px solid #e8ecf0', cursor:'pointer', background:'none', color:'#555', fontFamily:'inherit', height:'100%', display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap' },
}