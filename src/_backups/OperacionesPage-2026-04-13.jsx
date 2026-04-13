/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: OperacionesPage.jsx
 * Módulo:  Operaciones
 * ============================================================
 */

import { useState, useEffect } from 'react'
import {
  collection, query, where, onSnapshot, orderBy,
  doc, getDoc, updateDoc, getDocs, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../../firebase/config'
import { usePermisos } from '../../../hooks/usePermisos'
import { crearNotificacion } from '../../../services/notificaciones'
import TareaOperacionCard from '../components/TareaOperacionCard'

const fmtFecha = (iso) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const ESTADO_OP = {
  pendiente:   { label: 'Pendiente',   color: '#A32D2D', bg: '#FCEBEB' },
  asignado:    { label: 'Asignado',    color: '#854F0B', bg: '#FAEEDA' },
  en_progreso: { label: 'En Progreso', color: '#185FA5', bg: '#E6F1FB' },
  completado:  { label: 'Completado',  color: '#3B6D11', bg: '#EAF3DE' },
}

export default function OperacionesPage() {
  const { puede, usuario } = usePermisos()

  const [config, setConfig]           = useState(null)
  const [columnas, setColumnas]       = useState([])
  const [leads, setLeads]             = useState([])
  const [usuarios, setUsuarios]       = useState([])
  const [filtroEstado, setFiltroEstado] = useState('activos')
  const [modalLead, setModalLead]     = useState(null)
  const [fichaData, setFichaData]     = useState(null)
  const [cotizaciones, setCotizaciones] = useState([])
  const [form, setForm]               = useState({})
  const [guardando, setGuardando]     = useState(false)
  const [loading, setLoading]         = useState(true)

  // Cargar configuración de operaciones
  useEffect(() => {
    return onSnapshot(doc(db, 'configuracion', 'operaciones'), snap => {
      setConfig(snap.exists() ? snap.data() : null)
    })
  }, [])

  // Cargar columnas del pipeline
  useEffect(() => {
    return onSnapshot(query(collection(db, 'pipeline_columnas'), orderBy('orden')), snap => {
      setColumnas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [])

  const columnasOpsIds = config?.columnasOperacionesIds || (config?.columnaOperacionesId ? [config.columnaOperacionesId] : [])

  // Cargar leads en columnas de operaciones o con estadoOperacion
  useEffect(() => {
    if (columnasOpsIds.length === 0) { setLeads([]); setLoading(false); return }
    const q = query(collection(db, 'leads'), orderBy('creadoEn', 'desc'))
    return onSnapshot(q, snap => {
      const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setLeads(todos.filter(l => columnasOpsIds.includes(l.columnaId) || l.estadoOperacion))
      setLoading(false)
    })
  }, [columnasOpsIds.join(',')])

  // Cargar usuarios
  useEffect(() => {
    return onSnapshot(collection(db, 'usuarios'), snap => {
      setUsuarios(snap.docs.map(d => ({ uid: d.id, ...d.data() })))
    })
  }, [])

  // Filtrar por estado
  const leadsFiltrados = leads.filter(l => {
    const est = l.estadoOperacion || 'pendiente'
    if (filtroEstado === 'activos') return est !== 'completado'
    if (filtroEstado === 'completados') return est === 'completado'
    return true
  })

  const contadores = {
    activos: leads.filter(l => (l.estadoOperacion || 'pendiente') !== 'completado').length,
    completados: leads.filter(l => l.estadoOperacion === 'completado').length,
    todos: leads.length,
  }

  // Abrir lead y cargar datos del contacto/empresa/sede
  const abrirLead = async (lead) => {
    setForm({
      tecnicoId: lead.tecnicoId || '',
      tecnicoNombre: lead.tecnicoNombre || '',
      fechaEstimada: lead.fechaEstimada || '',
      horaEstimada: lead.horaEstimada || '',
      materiales: lead.materiales || '',
      informeFinal: lead.informeFinal || '',
      // Datos de ubicación (del lead)
      ubicacion: lead.ubicacion || '',
      direccion: lead.direccion || '',
      casa: lead.casa || '',
      colorCasa: lead.colorCasa || '',
      enlaceUbicacion: lead.enlaceUbicacion || '',
      observacionesOperacion: lead.observacionesOperacion || '',
    })
    setModalLead(lead)

    // Cargar ficha del contacto o empresa+sede
    let ficha = { tipo: 'desconocido', nombre: lead.cliente || lead.nombre }
    try {
      if (lead.tipoLead === 'empresa' && lead.empresaId) {
        const empSnap = await getDoc(doc(db, 'empresas', lead.empresaId))
        if (empSnap.exists()) {
          ficha = { tipo: 'empresa', ...empSnap.data(), id: empSnap.id }
          // Si tiene sede, cargar sede
          if (lead.sedeId) {
            const sedeSnap = await getDoc(doc(db, `empresas/${lead.empresaId}/sedes`, lead.sedeId))
            if (sedeSnap.exists()) ficha.sede = { id: sedeSnap.id, ...sedeSnap.data() }
          }
        }
      } else if (lead.contactoId) {
        const ctSnap = await getDoc(doc(db, 'contactos', lead.contactoId))
        if (ctSnap.exists()) ficha = { tipo: 'contacto', ...ctSnap.data(), id: ctSnap.id }
      }
    } catch (e) { console.error('Error cargando ficha:', e) }
    setFichaData(ficha)

    // Cargar cotizaciones aprobadas del lead
    try {
      const cotSnap = await getDocs(query(collection(db, 'cotizaciones'), where('leadId', '==', lead.id)))
      const cots = cotSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.estado === 'Aceptada' || c.estado === 'Facturada')
      setCotizaciones(cots)
    } catch { setCotizaciones([]) }
  }

  // Guardar asignación
  const guardarAsignacion = async () => {
    if (!form.tecnicoId || !form.fechaEstimada) {
      alert('Técnico y fecha estimada son obligatorios')
      return
    }
    setGuardando(true)
    try {
      const tecnico = usuarios.find(u => u.uid === form.tecnicoId)
      const colActual = columnas.find(c => c.id === modalLead.columnaId)
      const siguiente = columnas.find(c => c.orden === (colActual?.orden || 0) + 1)

      const payload = {
        tecnicoId: form.tecnicoId,
        tecnicoNombre: tecnico?.nombre || tecnico?.email || '',
        fechaEstimada: form.fechaEstimada,
        horaEstimada: form.horaEstimada || '',
        materiales: form.materiales || '',
        ubicacion: form.ubicacion,
        direccion: form.direccion,
        casa: form.casa,
        colorCasa: form.colorCasa,
        enlaceUbicacion: form.enlaceUbicacion,
        observacionesOperacion: form.observacionesOperacion,
        estadoOperacion: 'asignado',
        asignadoEn: serverTimestamp(),
      }
      if (siguiente) payload.columnaId = siguiente.id

      await updateDoc(doc(db, 'leads', modalLead.id), payload)

      // Guardar ubicación también en el contacto/empresa/sede
      await guardarUbicacionEnFicha()

      if (modalLead.vendedorId) {
        await crearNotificacion({
          destinatarioId: modalLead.vendedorId,
          tipo: 'general',
          titulo: '🔧 Lead asignado a operaciones',
          cuerpo: `"${modalLead.nombre}" asignado a ${tecnico?.nombre || 'técnico'}. Fecha: ${fmtFecha(form.fechaEstimada)}${form.horaEstimada ? ` ${form.horaEstimada}` : ''}. Coordiná con el cliente.`,
          link: `/crm/lead/${modalLead.id}`,
        }).catch(() => {})
      }

      setModalLead(null); setFichaData(null); setCotizaciones([])
    } catch (e) { console.error(e); alert('Error: ' + e.message) }
    finally { setGuardando(false) }
  }

  // Guardar datos de ubicación en el contacto o empresa/sede
  const guardarUbicacionEnFicha = async () => {
    if (!fichaData) return
    const datosUbi = {
      ubicacion: form.ubicacion || '',
      direccion: form.direccion || '',
      colorCasa: form.colorCasa || '',
      enlaceUbicacion: form.enlaceUbicacion || '',
    }
    try {
      if (fichaData.tipo === 'empresa' && fichaData.sede && modalLead.empresaId && modalLead.sedeId) {
        await updateDoc(doc(db, `empresas/${modalLead.empresaId}/sedes`, modalLead.sedeId), datosUbi)
      } else if (fichaData.tipo === 'empresa' && modalLead.empresaId) {
        await updateDoc(doc(db, 'empresas', modalLead.empresaId), datosUbi)
      } else if (fichaData.tipo === 'contacto' && fichaData.id) {
        await updateDoc(doc(db, 'contactos', fichaData.id), datosUbi)
      }
    } catch (e) { console.error('Error guardando ubicación en ficha:', e) }
  }

  // Cambiar estado
  const cambiarEstado = async (lead, nuevoEstado) => {
    try {
      const payload = { estadoOperacion: nuevoEstado }
      if (nuevoEstado === 'completado') payload.completadoEn = serverTimestamp()
      if (nuevoEstado === 'en_progreso') payload.iniciadoEn = serverTimestamp()
      await updateDoc(doc(db, 'leads', lead.id), payload)

      if (nuevoEstado === 'en_progreso' && lead.vendedorId) {
        await crearNotificacion({
          destinatarioId: lead.vendedorId,
          tipo: 'general',
          titulo: '🚀 Técnico en camino',
          cuerpo: `El técnico ${lead.tecnicoNombre || ''} va en camino para "${lead.nombre}".`,
          link: `/crm/lead/${lead.id}`,
        }).catch(() => {})
      }
    } catch (e) { console.error(e) }
  }

  // Guardar informe final
  const guardarInforme = async () => {
    if (!form.informeFinal.trim()) { alert('Escribí el informe final'); return }
    setGuardando(true)
    try {
      await updateDoc(doc(db, 'leads', modalLead.id), {
        informeFinal: form.informeFinal.trim(),
        estadoOperacion: 'completado',
        completadoEn: serverTimestamp(),
      })
      if (modalLead.vendedorId) {
        await crearNotificacion({
          destinatarioId: modalLead.vendedorId,
          tipo: 'general',
          titulo: '✅ Trabajo completado',
          cuerpo: `"${modalLead.nombre}" fue completado. Revisá el informe final.`,
          link: `/crm/lead/${modalLead.id}`,
        }).catch(() => {})
      }
      setModalLead(null); setFichaData(null); setCotizaciones([])
    } catch (e) { console.error(e) }
    finally { setGuardando(false) }
  }

  const s = {
    page: { padding: '20px 24px', minHeight: '100vh', background: 'var(--eco-bg, #f5f6f8)', fontSize: 13 },
    card: { background: '#fff', border: '0.5px solid rgba(0,0,0,.08)', borderRadius: 10, padding: '16px 18px', marginBottom: 14 },
    btn: { padding: '6px 14px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 12, cursor: 'pointer', background: '#fff', fontFamily: 'inherit' },
    btnP: { padding: '7px 16px', background: 'var(--eco-primary, #1a3a5c)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
    lbl: { fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3, display: 'block' },
    inp: { width: '100%', padding: '7px 10px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' },
    info: { fontSize: 11, color: '#555', padding: '3px 0', display: 'flex', gap: 6 },
    infoLabel: { color: '#aaa', minWidth: 70 },
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Cargando operaciones...</div>

  if (columnasOpsIds.length === 0) return (
    <div style={s.page}>
      <div style={{ ...s.card, textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚙️</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>Módulo no configurado</div>
        <div style={{ fontSize: 13, color: '#888' }}>Configurá las columnas de operaciones desde Configuración.</div>
      </div>
    </div>
  )

  return (
    <div style={s.page}>

      {/* ═══ Modal detalle lead ═══ */}
      {modalLead && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(3px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && (() => { setModalLead(null); setFichaData(null); setCotizaciones([]) })()}>
          <div style={{ background: '#fff', borderRadius: 14, width: '95%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>

            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{modalLead.nombre}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{modalLead.empresaNombre || modalLead.cliente || ''}</div>
              </div>
              <button onClick={() => { setModalLead(null); setFichaData(null); setCotizaciones([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa' }}>×</button>
            </div>

            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* ── Datos del contacto/empresa ── */}
              {fichaData && (
                <div style={{ background: '#f8f9fb', borderRadius: 8, padding: '10px 14px', border: '1px solid #eaecf0' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
                    {fichaData.tipo === 'empresa' ? '🏢 Empresa' : '👤 Contacto'}
                  </div>
                  <div style={s.info}><span style={s.infoLabel}>Nombre</span> <span style={{ fontWeight: 500 }}>{fichaData.nombre || '—'}</span></div>
                  {fichaData.telefono && <div style={s.info}><span style={s.infoLabel}>Teléfono</span> {fichaData.telefono}</div>}
                  {fichaData.correo && <div style={s.info}><span style={s.infoLabel}>Correo</span> {fichaData.correo}</div>}
                  {fichaData.whatsapp && <div style={s.info}><span style={s.infoLabel}>WhatsApp</span> {fichaData.whatsapp}</div>}
                  {fichaData.provincia && <div style={s.info}><span style={s.infoLabel}>Provincia</span> {fichaData.provincia}</div>}
                  {fichaData.sede && (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #dde3ed' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#854F0B', marginBottom: 4 }}>📍 Sede: {fichaData.sede.nombre}</div>
                      {fichaData.sede.provincia && <div style={s.info}><span style={s.infoLabel}>Provincia</span> {fichaData.sede.provincia}</div>}
                      {fichaData.sede.direccion && <div style={s.info}><span style={s.infoLabel}>Dirección</span> {fichaData.sede.direccion}</div>}
                      {fichaData.sede.telefono && <div style={s.info}><span style={s.infoLabel}>Teléfono</span> {fichaData.sede.telefono}</div>}
                      {fichaData.sede.responsable && <div style={s.info}><span style={s.infoLabel}>Responsable</span> {fichaData.sede.responsable}</div>}
                    </div>
                  )}
                </div>
              )}

              {/* ── Datos de ubicación (editables) ── */}
              <div style={{ background: '#FFFBF0', borderRadius: 8, padding: '10px 14px', border: '1px solid #EDD98A' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#854F0B', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>📍 Ubicación del sitio</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div><label style={s.lbl}>Ubicación</label><input style={s.inp} value={form.ubicacion} onChange={e => setForm({ ...form, ubicacion: e.target.value })} placeholder="Provincia / zona" /></div>
                  <div><label style={s.lbl}>Casa / número</label><input style={s.inp} value={form.casa} onChange={e => setForm({ ...form, casa: e.target.value })} placeholder="# casa, apto" /></div>
                </div>
                <div style={{ marginTop: 8 }}><label style={s.lbl}>Dirección</label><input style={s.inp} value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} placeholder="Dirección completa" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                  <div><label style={s.lbl}>Color</label><input style={s.inp} value={form.colorCasa} onChange={e => setForm({ ...form, colorCasa: e.target.value })} placeholder="Color de la casa" /></div>
                  <div><label style={s.lbl}>Enlace (Maps)</label><input style={s.inp} value={form.enlaceUbicacion} onChange={e => setForm({ ...form, enlaceUbicacion: e.target.value })} placeholder="https://..." /></div>
                </div>
                {modalLead.fotoUbicacion && (
                  <div style={{ marginTop: 8 }}>
                    <img src={modalLead.fotoUbicacion} alt="ubicación" style={{ maxHeight: 100, borderRadius: 6, border: '1px solid #e0e0e0' }} />
                  </div>
                )}
                {form.enlaceUbicacion && (
                  <a href={form.enlaceUbicacion} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 6, fontSize: 11, color: '#185FA5', fontWeight: 500 }}>🗺️ Abrir enlace</a>
                )}
              </div>

              {/* ── Cotizaciones aprobadas ── */}
              {cotizaciones.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                    📄 Cotizaciones aprobadas ({cotizaciones.length})
                  </div>
                  {cotizaciones.map((cot, idx) => {
                    const opElegida = cot.opciones?.find(o => o.id === (cot.opcionElegida || cot.opcionActiva)) || cot.opciones?.[0]
                    const productos = opElegida?.productos || []
                    const opcionales = (opElegida?.productosOpcionales || []).filter(p => cot.opcionalesElegidos?.[p._lid || p.nombre])
                    return (
                      <div key={cot.id} style={{ background: '#fff', border: '1px solid #eaecf0', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
                        <div style={{ padding: '8px 12px', background: '#f8f9fb', borderBottom: '1px solid #eaecf0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>
                            {cotizaciones.length > 1 ? `Cotización ${idx + 1}` : 'Cotización'} — {cot.numero || ''}
                          </div>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, background: '#EAF3DE', color: '#3B6D11', fontWeight: 600 }}>{cot.estado}</span>
                        </div>
                        <div style={{ padding: '8px 12px' }}>
                          {/* Productos principales */}
                          {productos.map((p, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: i < productos.length - 1 ? '0.5px solid #f0f2f5' : 'none', fontSize: 12 }}>
                              <div style={{ flex: 1 }}>
                                <span style={{ fontWeight: 500, color: '#1a1a1a' }}>{p.cantidad || 1}x</span>{' '}
                                <span>{p.nombre}</span>
                                {p.descripcion && <div style={{ fontSize: 10, color: '#aaa', marginTop: 1 }}>{p.descripcion}</div>}
                              </div>
                            </div>
                          ))}
                          {/* Opcionales elegidos */}
                          {opcionales.length > 0 && (
                            <>
                              <div style={{ fontSize: 10, fontWeight: 600, color: '#854F0B', marginTop: 6, marginBottom: 2 }}>Opcionales incluidos:</div>
                              {opcionales.map((p, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11, color: '#854F0B' }}>
                                  <span>{p.cantidad || 1}x {p.nombre}</span>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── Observaciones ── */}
              {(form.observacionesOperacion || modalLead.estadoOperacion === 'pendiente') && (
                <div>
                  <label style={s.lbl}>Observaciones</label>
                  <textarea style={{ ...s.inp, minHeight: 50, resize: 'vertical' }} value={form.observacionesOperacion} onChange={e => setForm({ ...form, observacionesOperacion: e.target.value })} placeholder="Notas adicionales..." />
                </div>
              )}

              {/* ── Según estado: formulario diferente ── */}
              {modalLead.estadoOperacion === 'completado' ? (
                <div>
                  <label style={s.lbl}>Informe final</label>
                  <div style={{ ...s.inp, background: '#f8f9fb', minHeight: 60, whiteSpace: 'pre-wrap' }}>{modalLead.informeFinal || 'Sin informe'}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
                    Técnico: {modalLead.tecnicoNombre || '—'} | Fecha: {fmtFecha(modalLead.fechaEstimada)} {modalLead.horaEstimada || ''}
                  </div>
                </div>
              ) : modalLead.estadoOperacion === 'en_progreso' ? (
                <div>
                  <div style={{ padding: '8px 12px', background: '#E6F1FB', borderRadius: 7, marginBottom: 8, fontSize: 12, color: '#185FA5' }}>
                    Técnico en camino — Al terminar, escribí el informe final.
                  </div>
                  <label style={s.lbl}>Informe final *</label>
                  <textarea style={{ ...s.inp, minHeight: 80, resize: 'vertical' }} value={form.informeFinal} onChange={e => setForm({ ...form, informeFinal: e.target.value })} placeholder="Describí el trabajo realizado..." />
                </div>
              ) : (
                /* Pendiente o asignado: asignación */
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={s.lbl}>Técnico *</label>
                    <select style={s.inp} value={form.tecnicoId} onChange={e => setForm({ ...form, tecnicoId: e.target.value, tecnicoNombre: usuarios.find(u => u.uid === e.target.value)?.nombre || '' })}>
                      <option value="">Seleccionar...</option>
                      {usuarios.map(u => <option key={u.uid} value={u.uid}>{u.nombre || u.email}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={s.lbl}>Fecha estimada *</label>
                    <input type="date" style={s.inp} value={form.fechaEstimada} onChange={e => setForm({ ...form, fechaEstimada: e.target.value })} />
                  </div>
                  <div>
                    <label style={s.lbl}>Hora estimada</label>
                    <input type="time" style={s.inp} value={form.horaEstimada} onChange={e => setForm({ ...form, horaEstimada: e.target.value })} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={s.lbl}>Materiales / equipos</label>
                    <textarea style={{ ...s.inp, minHeight: 50, resize: 'vertical' }} value={form.materiales} onChange={e => setForm({ ...form, materiales: e.target.value })} placeholder="Equipos, herramientas, materiales..." />
                  </div>
                </div>
              )}
            </div>

            {/* Acciones */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid #f0f2f5', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={s.btn} onClick={() => { setModalLead(null); setFichaData(null); setCotizaciones([]) }}>Cerrar</button>
              {modalLead.estadoOperacion === 'en_progreso' && (
                <button style={{ ...s.btnP, background: '#0F6E56' }} onClick={guardarInforme} disabled={guardando}>
                  {guardando ? 'Guardando...' : '✅ Completar trabajo'}
                </button>
              )}
              {(!modalLead.estadoOperacion || modalLead.estadoOperacion === 'pendiente' || modalLead.estadoOperacion === 'asignado') && (
                <button style={s.btnP} onClick={guardarAsignacion} disabled={guardando}>
                  {guardando ? 'Guardando...' : modalLead.estadoOperacion === 'asignado' ? 'Actualizar' : 'Asignar y notificar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Operaciones</h1>
          <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>
            {columnasOpsIds.map(id => columnas.find(c => c.id === id)?.nombre).filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { k: 'activos', label: 'Activos', n: contadores.activos },
            { k: 'completados', label: 'Completados', n: contadores.completados },
            { k: 'todos', label: 'Todos', n: contadores.todos },
          ].map(f => (
            <button key={f.k} onClick={() => setFiltroEstado(f.k)} style={{
              ...s.btn, fontWeight: filtroEstado === f.k ? 600 : 400,
              background: filtroEstado === f.k ? 'var(--eco-primary, #1a3a5c)' : '#fff',
              color: filtroEstado === f.k ? '#fff' : '#555',
              borderColor: filtroEstado === f.k ? 'transparent' : undefined,
            }}>
              {f.label} ({f.n})
            </button>
          ))}
        </div>
      </div>

      {/* Columnas por estado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {Object.entries(ESTADO_OP).map(([key, cfg]) => {
          const items = leadsFiltrados.filter(l => (l.estadoOperacion || 'pendiente') === key)
          if (filtroEstado === 'activos' && key === 'completado') return null
          if (filtroEstado === 'completados' && key !== 'completado') return null
          return (
            <div key={key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>{cfg.label}</span>
                <span style={{ fontSize: 10, color: '#bbb', marginLeft: 4 }}>{items.length}</span>
              </div>
              {items.length === 0 && <div style={{ fontSize: 11, color: '#ccc', textAlign: 'center', padding: '20px 0' }}>Sin leads</div>}
              {items.map(lead => (
                <div key={lead.id}>
                  <TareaOperacionCard lead={lead} onClick={() => abrirLead(lead)} />
                  {key === 'asignado' && (
                    <button onClick={() => cambiarEstado(lead, 'en_progreso')} style={{ width: '100%', padding: 6, border: '1px dashed #185FA5', borderRadius: 7, background: '#f8faff', color: '#185FA5', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginTop: -4, marginBottom: 8 }}>
                      🚀 Pasar a En Progreso
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
