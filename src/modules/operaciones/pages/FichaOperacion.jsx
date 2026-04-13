/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Archivo: FichaOperacion.jsx
 * Módulo:  Operaciones — Ficha completa de un lead en operaciones
 * ============================================================
 */

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  doc, getDoc, updateDoc, collection, query, where, orderBy,
  onSnapshot, addDoc, getDocs, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../../firebase/config'
import { usePermisos } from '../../../hooks/usePermisos'
import { crearNotificacion } from '../../../services/notificaciones'

const fmtFecha = (iso) => { if (!iso) return '—'; const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}` }
const tiempoRel = (ts) => {
  if (!ts) return ''
  const d = ts?.toDate ? ts.toDate() : new Date(ts?.seconds ? ts.seconds * 1000 : ts)
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h/24)}d`
}

const ESTADO_OP = {
  pendiente:   { label: 'Pendiente',   color: '#A32D2D', bg: '#FCEBEB' },
  asignado:    { label: 'Asignado',    color: '#854F0B', bg: '#FAEEDA' },
  en_progreso: { label: 'En Progreso', color: '#185FA5', bg: '#E6F1FB' },
  completado:  { label: 'Completado',  color: '#3B6D11', bg: '#EAF3DE' },
}

export default function FichaOperacion() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { usuario } = usePermisos()

  const [lead, setLead] = useState(null)
  const [ficha, setFicha] = useState(null)
  const [cotizaciones, setCotizaciones] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [columnas, setColumnas] = useState([])
  const [config, setConfig] = useState(null)
  const [mensajes, setMensajes] = useState([])
  const [msgTexto, setMsgTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [form, setForm] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [loading, setLoading] = useState(true)
  const chatRef = useRef()
  const inputRef = useRef()
  const [panelIzqPct, setPanelIzqPct] = useState(65)
  const resizing = useRef(false)
  const [confirmarAsignacion, setConfirmarAsignacion] = useState(false)
  const [hayCambios, setHayCambios] = useState(false)

  // Cargar lead
  useEffect(() => {
    return onSnapshot(doc(db, 'leads', id), snap => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() }
        setLead(data)
        setForm(prev => Object.keys(prev).length === 0 ? {
          asignados: data.asignados || [],
          fechaEstimada: data.fechaEstimada || '',
          horaEstimada: data.horaEstimada || '',
          materiales: data.materiales || '',
          informeFinal: data.informeFinal || '',
          ubicacion: data.ubicacion || '',
          direccion: data.direccion || '',
          casa: data.casa || '',
          colorCasa: data.colorCasa || '',
          enlaceUbicacion: data.enlaceUbicacion || '',
          observacionesOperacion: data.observacionesOperacion || '',
        } : prev)
      }
      setLoading(false)
    })
  }, [id])

  // Cargar ficha contacto/empresa
  useEffect(() => {
    if (!lead) return
    const cargar = async () => {
      let f = { tipo: 'desconocido', nombre: lead.cliente || lead.nombre }
      try {
        if (lead.tipoLead === 'empresa' && lead.empresaId) {
          const snap = await getDoc(doc(db, 'empresas', lead.empresaId))
          if (snap.exists()) {
            f = { tipo: 'empresa', ...snap.data(), id: snap.id }
            if (lead.sedeId) {
              const sSnap = await getDoc(doc(db, `empresas/${lead.empresaId}/sedes`, lead.sedeId))
              if (sSnap.exists()) f.sede = { id: sSnap.id, ...sSnap.data() }
            }
          }
        } else if (lead.contactoId) {
          const snap = await getDoc(doc(db, 'contactos', lead.contactoId))
          if (snap.exists()) f = { tipo: 'contacto', ...snap.data(), id: snap.id }
        }
      } catch {}
      setFicha(f)
    }
    cargar()
  }, [lead?.contactoId, lead?.empresaId, lead?.sedeId])

  // Cargar cotizaciones aprobadas
  useEffect(() => {
    if (!id) return
    getDocs(query(collection(db, 'cotizaciones'), where('leadId', '==', id))).then(snap => {
      setCotizaciones(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.estado === 'Aceptada' || c.estado === 'Facturada'))
    }).catch(() => {})
  }, [id])

  // Cargar empleados asignables
  useEffect(() => {
    return onSnapshot(query(collection(db, 'empleados'), orderBy('nombre')), snap => {
      setEmpleados(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.activo !== false && e.asignableOperaciones))
    })
  }, [])

  // Cargar columnas + config
  useEffect(() => {
    onSnapshot(query(collection(db, 'pipeline_columnas'), orderBy('orden')), snap => setColumnas(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    getDoc(doc(db, 'configuracion', 'operaciones')).then(snap => { if (snap.exists()) setConfig(snap.data()) })
  }, [])

  // Chat operaciones (tiempo real)
  useEffect(() => {
    if (!id) return
    const q = query(collection(db, `leads/${id}/chat_operaciones`), orderBy('creadoEn', 'asc'))
    return onSnapshot(q, snap => {
      setMensajes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setTimeout(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight }, 100)
    })
  }, [id])

  const enviarMensaje = async () => {
    if (!msgTexto.trim() || enviando) return
    setEnviando(true)
    try {
      await addDoc(collection(db, `leads/${id}/chat_operaciones`), {
        texto: msgTexto.trim(),
        autorId: usuario?.uid,
        autorNombre: usuario?.nombre || usuario?.email || '',
        creadoEn: serverTimestamp(),
      })
      setMsgTexto('')
      inputRef.current?.focus()
    } catch (e) { console.error(e) }
    finally { setEnviando(false) }
  }

  const guardarAsignacion = async () => {
    if (form.asignados.length === 0 || !form.fechaEstimada) { alert('Asigná al menos una persona y fecha'); return }
    setGuardando(true)
    try {
      const nombresAsignados = form.asignados.map(a => a.nombre).join(', ')
      const colActual = columnas.find(c => c.id === lead.columnaId)
      const siguiente = columnas.find(c => c.orden === (colActual?.orden || 0) + 1)

      const payload = {
        asignados: form.asignados,
        tecnicoId: form.asignados[0]?.id || '',
        tecnicoNombre: nombresAsignados,
        fechaEstimada: form.fechaEstimada,
        horaEstimada: form.horaEstimada || '',
        materiales: form.materiales || '',
        ubicacion: form.ubicacion,
        direccion: form.direccion,
        casa: form.casa,
        colorCasa: form.colorCasa,
        enlaceUbicacion: form.enlaceUbicacion,
        estadoOperacion: 'asignado',
        asignadoEn: serverTimestamp(),
      }
      if (siguiente) payload.columnaId = siguiente.id
      await updateDoc(doc(db, 'leads', id), payload)

      // Guardar ubicación en contacto/empresa
      const datosUbi = { ubicacion: form.ubicacion || '', direccion: form.direccion || '', colorCasa: form.colorCasa || '', enlaceUbicacion: form.enlaceUbicacion || '' }
      if (ficha?.tipo === 'empresa' && ficha?.sede && lead.empresaId && lead.sedeId) {
        await updateDoc(doc(db, `empresas/${lead.empresaId}/sedes`, lead.sedeId), datosUbi).catch(() => {})
      } else if (ficha?.tipo === 'empresa' && lead.empresaId) {
        await updateDoc(doc(db, 'empresas', lead.empresaId), datosUbi).catch(() => {})
      } else if (ficha?.tipo === 'contacto' && ficha?.id) {
        await updateDoc(doc(db, 'contactos', ficha.id), datosUbi).catch(() => {})
      }

      if (lead.vendedorId) {
        await crearNotificacion({ destinatarioId: lead.vendedorId, tipo: 'general', titulo: '🔧 Lead asignado', cuerpo: `"${lead.nombre}" asignado a ${nombresAsignados}. Fecha: ${fmtFecha(form.fechaEstimada)}`, link: `/crm/lead/${id}` }).catch(() => {})
      }
      setHayCambios(false)
    } catch (e) { alert('Error: ' + e.message) }
    finally { setGuardando(false) }
  }

  const cambiarEstado = async (nuevoEstado) => {
    const payload = { estadoOperacion: nuevoEstado }
    if (nuevoEstado === 'completado') payload.completadoEn = serverTimestamp()
    if (nuevoEstado === 'en_progreso') payload.iniciadoEn = serverTimestamp()
    await updateDoc(doc(db, 'leads', id), payload)
    if (nuevoEstado === 'en_progreso' && lead.vendedorId) {
      await crearNotificacion({ destinatarioId: lead.vendedorId, tipo: 'general', titulo: '🚀 Técnico en camino', cuerpo: `Equipo en camino para "${lead.nombre}".`, link: `/crm/lead/${id}` }).catch(() => {})
    }
  }

  const guardarInforme = async () => {
    if (!form.informeFinal.trim()) { alert('Escribí el informe final'); return }
    setGuardando(true)
    try {
      await updateDoc(doc(db, 'leads', id), { informeFinal: form.informeFinal.trim(), estadoOperacion: 'completado', completadoEn: serverTimestamp() })
      if (lead.vendedorId) {
        await crearNotificacion({ destinatarioId: lead.vendedorId, tipo: 'general', titulo: '✅ Trabajo completado', cuerpo: `"${lead.nombre}" fue completado.`, link: `/crm/lead/${id}` }).catch(() => {})
      }
    } catch (e) { console.error(e) }
    finally { setGuardando(false) }
  }

  // Detectar cambios en el form
  const updForm = (cambios) => { setForm(prev => ({ ...prev, ...cambios })); setHayCambios(true) }

  const esVendedor = lead?.vendedorId === usuario?.uid
  const est = ESTADO_OP[lead?.estadoOperacion] || ESTADO_OP.pendiente
  const tieneAsignados = form.asignados?.length > 0

  const s = {
    lbl: { fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3, display: 'block' },
    inp: { width: '100%', padding: '7px 10px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' },
    info: { fontSize: 12, color: '#555', padding: '3px 0', display: 'flex', gap: 6 },
    infoLbl: { color: '#aaa', minWidth: 75, fontSize: 11 },
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Cargando...</div>
  if (!lead) return <div style={{ padding: 40, textAlign: 'center', color: '#c00' }}>Lead no encontrado</div>

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f5f6f8' }}>

      {/* Modal confirmar asignación */}
      {confirmarAsignacion && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(3px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && setConfirmarAsignacion(false)}>
          <div style={{ background: '#fff', borderRadius: 14, width: '90%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,.2)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f2f5' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Confirmar asignación</div>
            </div>
            <div style={{ padding: '16px 20px', fontSize: 13, color: '#555', lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 8px' }}>Se asignará <b>{lead.nombre}</b> a:</p>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                {form.asignados?.map(a => (
                  <span key={a.id} style={{ padding: '2px 8px', borderRadius: 12, background: '#E6F1FB', color: '#185FA5', fontSize: 11, fontWeight: 500 }}>{a.nombre}{a.cargo ? ` · ${a.cargo}` : ''}</span>
                ))}
              </div>
              {form.fechaEstimada && <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Fecha: {fmtFecha(form.fechaEstimada)}{form.horaEstimada ? ` a las ${form.horaEstimada}` : ''}</p>}
              <p style={{ margin: '10px 0 0', fontSize: 12, color: '#999' }}>Se notificará al vendedor para que coordine con el cliente.</p>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid #f0f2f5', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmarAsignacion(false)} style={{ padding: '8px 16px', border: '1px solid #dde3ed', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: '#f5f5f5', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={() => { setConfirmarAsignacion(false); guardarAsignacion() }} disabled={guardando} style={{ padding: '8px 20px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#854F0B', color: '#fff', fontFamily: 'inherit' }}>
                {guardando ? 'Guardando...' : 'Confirmar y notificar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '10px 20px', background: '#fff', borderBottom: '1px solid #e0e4ea', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/operaciones')} style={{ padding: '5px 10px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 12, cursor: 'pointer', background: '#fff', fontFamily: 'inherit' }}>← Volver</button>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a1a' }}>{lead.nombre}</div>
            <div style={{ fontSize: 12, color: '#888' }}>{lead.empresaNombre || lead.cliente || ''}</div>
          </div>
          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: est.bg, color: est.color }}>{est.label}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {hayCambios && tieneAsignados && (
            <button onClick={() => setConfirmarAsignacion(true)} style={{ padding: '7px 14px', border: 'none', borderRadius: 7, background: '#854F0B', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {guardando ? '...' : '💾 Confirmar asignación'}
            </button>
          )}
          {lead.estadoOperacion === 'asignado' && <button onClick={() => cambiarEstado('en_progreso')} style={{ padding: '7px 14px', border: 'none', borderRadius: 7, background: '#185FA5', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>🚀 En Progreso</button>}
          {lead.estadoOperacion === 'en_progreso' && <button onClick={guardarInforme} disabled={guardando} style={{ padding: '7px 14px', border: 'none', borderRadius: 7, background: '#0F6E56', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{guardando ? '...' : '✅ Completar'}</button>}
        </div>
      </div>

      {/* Cuerpo: panel izq + divisor + panel der */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}
        onMouseMove={e => { if (!resizing.current) return; const rect = e.currentTarget.getBoundingClientRect(); const pct = ((e.clientX - rect.left) / rect.width) * 100; setPanelIzqPct(Math.min(80, Math.max(40, pct))) }}
        onMouseUp={() => { resizing.current = false }}
        onMouseLeave={() => { resizing.current = false }}>

        {/* ═══ PANEL IZQUIERDO ═══ */}
        <div style={{ width: `${panelIzqPct}%`, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>

          {/* Contacto/Empresa */}
          {ficha && (
            <div style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', border: '1px solid #eaecf0' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 6 }}>{ficha.tipo === 'empresa' ? '🏢 Empresa' : '👤 Contacto'}</div>
              <div style={s.info}><span style={s.infoLbl}>Nombre</span><span style={{ fontWeight: 500 }}>{ficha.nombre || '—'}</span></div>
              {ficha.telefono && <div style={s.info}><span style={s.infoLbl}>Teléfono</span>{ficha.telefono}</div>}
              {ficha.correo && <div style={s.info}><span style={s.infoLbl}>Correo</span>{ficha.correo}</div>}
              {ficha.whatsapp && <div style={s.info}><span style={s.infoLbl}>WhatsApp</span>{ficha.whatsapp}</div>}
              {ficha.sede && (
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #dde3ed' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#854F0B', marginBottom: 4 }}>📍 Sede: {ficha.sede.nombre}</div>
                  {ficha.sede.direccion && <div style={s.info}><span style={s.infoLbl}>Dirección</span>{ficha.sede.direccion}</div>}
                  {ficha.sede.telefono && <div style={s.info}><span style={s.infoLbl}>Teléfono</span>{ficha.sede.telefono}</div>}
                  {ficha.sede.responsable && <div style={s.info}><span style={s.infoLbl}>Responsable</span>{ficha.sede.responsable}</div>}
                </div>
              )}
            </div>
          )}

          {/* Ubicación + Asignados lado a lado */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Ubicación */}
            <div style={{ background: '#FFFBF0', borderRadius: 8, padding: '10px 14px', border: '1px solid #EDD98A' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#854F0B', textTransform: 'uppercase', marginBottom: 8 }}>📍 Ubicación</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div><label style={s.lbl}>Ubicación</label><input style={s.inp} value={form.ubicacion} onChange={e => updForm({ ubicacion: e.target.value })} placeholder="Zona" /></div>
                <div><label style={s.lbl}>Dirección</label><input style={s.inp} value={form.direccion} onChange={e => updForm({ direccion: e.target.value })} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div><label style={s.lbl}>Casa / #</label><input style={s.inp} value={form.casa} onChange={e => updForm({ casa: e.target.value })} /></div>
                  <div><label style={s.lbl}>Color</label><input style={s.inp} value={form.colorCasa} onChange={e => updForm({ colorCasa: e.target.value })} /></div>
                </div>
                <div><label style={s.lbl}>Enlace</label><input style={s.inp} value={form.enlaceUbicacion} onChange={e => updForm({ enlaceUbicacion: e.target.value })} /></div>
                {form.enlaceUbicacion && <a href={form.enlaceUbicacion} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#185FA5', fontWeight: 500 }}>🗺️ Abrir mapa</a>}
                {lead.fotoUbicacion && <img src={lead.fotoUbicacion} alt="" style={{ maxHeight: 60, borderRadius: 6 }} />}
              </div>
            </div>

            {/* Asignados */}
            <div style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', border: '1px solid #eaecf0' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 6 }}>👥 Asignado a ({form.asignados?.length || 0})</div>
              {form.asignados?.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                  {form.asignados.map(a => (
                    <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 12, background: '#E6F1FB', color: '#185FA5', fontSize: 10, fontWeight: 500 }}>
                      {a.nombre}{a.cargo ? ` · ${a.cargo}` : ''}
                      <button onClick={() => updForm({ asignados: form.asignados.filter(x => x.id !== a.id) })} style={{ background:'none', border:'none', cursor:'pointer', color:'#185FA5', fontSize:12, padding:0, lineHeight:1 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ background: '#f8f9fb', border: '1px solid #eaecf0', borderRadius: 8, maxHeight: 180, overflowY: 'auto' }}>
                {(() => {
                  const cargosUnicos = [...new Set(empleados.map(e => e.cargoNombre || 'Sin cargo'))]
                  return cargosUnicos.map(cargo => {
                    const emps = empleados.filter(e => (e.cargoNombre || 'Sin cargo') === cargo)
                    if (!emps.length) return null
                    return (
                      <div key={cargo}>
                        <div style={{ padding: '3px 10px', fontSize: 9, fontWeight: 700, color: '#888', textTransform: 'uppercase', background: '#f0f2f5', borderBottom: '1px solid #e8ecf0' }}>{cargo}</div>
                        {emps.map(emp => {
                          const sel = form.asignados?.some(a => a.id === emp.id)
                          return (
                            <div key={emp.id} onClick={() => {
                              if (sel) updForm({ asignados: form.asignados.filter(a => a.id !== emp.id) })
                              else updForm({ asignados: [...(form.asignados||[]), {id:emp.id, nombre:`${emp.nombre} ${emp.apellido}`, cargo:emp.cargoNombre||''}] })
                            }} style={{ padding:'4px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:7, fontSize:12, background:sel?'#E6F1FB':'transparent', borderBottom:'0.5px solid #f0f2f5' }}>
                              <div style={{ width:13, height:13, borderRadius:3, border:sel?'none':'1.5px solid #ccc', background:sel?'var(--eco-primary)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                {sel && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                              </div>
                              {emp.nombre} {emp.apellido}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          </div>

          {/* Fecha y materiales */}
          <div style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', border: '1px solid #eaecf0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><label style={s.lbl}>Fecha *</label><input type="date" style={s.inp} value={form.fechaEstimada} onChange={e => updForm({ fechaEstimada: e.target.value })} /></div>
              <div><label style={s.lbl}>Hora</label><input type="time" style={s.inp} value={form.horaEstimada} onChange={e => updForm({ horaEstimada: e.target.value })} /></div>
            </div>
            <div style={{ marginTop: 8 }}><label style={s.lbl}>Materiales / equipos</label><textarea style={{...s.inp, minHeight:50, resize:'vertical'}} value={form.materiales} onChange={e => updForm({ materiales: e.target.value })} placeholder="Equipos necesarios..." /></div>
          </div>

          {/* Cotizaciones */}
          {cotizaciones.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', border: '1px solid #eaecf0' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 8 }}>📄 Cotizaciones ({cotizaciones.length})</div>
              {cotizaciones.map((cot, idx) => {
                const op = cot.opciones?.find(o => o.id === (cot.opcionElegida || cot.opcionActiva)) || cot.opciones?.[0]
                const prods = op?.productos || []
                const opts = (op?.productosOpcionales || []).filter(p => cot.opcionalesElegidos?.[p._lid || p.nombre])
                return (
                  <div key={cot.id} style={{ border: '1px solid #eaecf0', borderRadius: 7, marginBottom: 6, overflow: 'hidden' }}>
                    <div style={{ padding: '6px 10px', background: '#f8f9fb', borderBottom: '1px solid #eaecf0', fontSize: 11, fontWeight: 600 }}>
                      {cotizaciones.length > 1 ? `Cotización ${idx+1}` : 'Cotización'} — {cot.numero || ''}
                    </div>
                    <div style={{ padding: '6px 10px' }}>
                      {prods.map((p,i) => <div key={i} style={{ fontSize: 11, padding: '2px 0', color: '#555' }}>{p.cantidad||1}x {p.nombre}</div>)}
                      {opts.length > 0 && <div style={{ fontSize: 10, color: '#854F0B', fontWeight: 600, marginTop: 4 }}>Opcionales:</div>}
                      {opts.map((p,i) => <div key={i} style={{ fontSize: 11, color: '#854F0B', padding: '1px 0' }}>{p.cantidad||1}x {p.nombre}</div>)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Observaciones (solo editable por vendedor) */}
          <div style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', border: '1px solid #eaecf0' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Observaciones del vendedor</div>
            {esVendedor ? (
              <textarea style={{...s.inp, minHeight:50, resize:'vertical'}} value={form.observacionesOperacion} onChange={e => updForm({ observacionesOperacion: e.target.value })} placeholder="Solo el vendedor puede editar..." />
            ) : (
              <div style={{ fontSize: 12, color: '#555', padding: '6px 0', whiteSpace: 'pre-wrap' }}>{lead.observacionesOperacion || 'Sin observaciones'}</div>
            )}
          </div>

          {/* Informe final */}
          {(lead.estadoOperacion === 'en_progreso' || lead.estadoOperacion === 'completado') && (
            <div style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', border: '1px solid #eaecf0' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Informe final</div>
              {lead.estadoOperacion === 'completado' ? (
                <div style={{ fontSize: 12, color: '#555', whiteSpace: 'pre-wrap' }}>{lead.informeFinal || 'Sin informe'}</div>
              ) : (
                <textarea style={{...s.inp, minHeight:70, resize:'vertical'}} value={form.informeFinal} onChange={e => updForm({ informeFinal: e.target.value })} placeholder="Describí el trabajo realizado..." />
              )}
            </div>
          )}
        </div>

        {/* Divisor arrastrable */}
        <div onMouseDown={() => { resizing.current = true }} style={{ width: 5, cursor: 'col-resize', background: '#e0e4ea', flexShrink: 0, transition: 'background .15s' }} onMouseEnter={e => e.currentTarget.style.background = '#185FA5'} onMouseLeave={e => { if (!resizing.current) e.currentTarget.style.background = '#e0e4ea' }} />

        {/* ═══ PANEL DERECHO — CHAT ═══ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #e0e4ea', fontSize: 13, fontWeight: 600, color: '#1a1a1a', flexShrink: 0 }}>
            💬 Chat con {lead.vendedorNombre || lead.vendedor || 'vendedor'}
          </div>

          <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6, background: '#f8f9fb' }}>
            {mensajes.length === 0 && <div style={{ textAlign: 'center', color: '#bbb', fontSize: 12, marginTop: 40 }}>Sin mensajes — iniciá la conversación</div>}
            {mensajes.map(msg => {
              const esMio = msg.autorId === usuario?.uid
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: esMio ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '75%', padding: '8px 12px', borderRadius: esMio ? '12px 12px 2px 12px' : '12px 12px 12px 2px', background: esMio ? 'var(--eco-primary, #1a3a5c)' : '#fff', color: esMio ? '#fff' : '#1a1a1a', fontSize: 13, lineHeight: 1.5, boxShadow: '0 1px 2px rgba(0,0,0,.06)', border: esMio ? 'none' : '1px solid #eaecf0' }}>
                    {!esMio && <div style={{ fontSize: 10, fontWeight: 600, color: '#185FA5', marginBottom: 2 }}>{msg.autorNombre}</div>}
                    {msg.texto}
                    <div style={{ fontSize: 9, marginTop: 3, textAlign: 'right', opacity: 0.6 }}>{tiempoRel(msg.creadoEn)}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ padding: '10px 16px', borderTop: '1px solid #e0e4ea', display: 'flex', gap: 8, flexShrink: 0 }}>
            <input ref={inputRef} value={msgTexto} onChange={e => setMsgTexto(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje() }}}
              placeholder="Escribe un mensaje..."
              style={{ flex: 1, padding: '8px 12px', border: '1px solid #dde3ed', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
            />
            <button onClick={enviarMensaje} disabled={!msgTexto.trim() || enviando} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: !msgTexto.trim() ? '#e0e0e0' : 'var(--eco-primary, #1a3a5c)', color: !msgTexto.trim() ? '#aaa' : '#fff', fontSize: 13, fontWeight: 600, cursor: !msgTexto.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
