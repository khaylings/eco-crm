/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Archivo: OperacionesPage.jsx
 * Módulo:  Operaciones — Tablero kanban
 * ============================================================
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, onSnapshot, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../../firebase/config'
import { usePermisos } from '../../../hooks/usePermisos'
import { crearNotificacion } from '../../../services/notificaciones'
import TareaOperacionCard from '../components/TareaOperacionCard'

const ESTADO_OP = {
  pendiente:   { label: 'Pendiente',   color: '#A32D2D', bg: '#FCEBEB' },
  asignado:    { label: 'Asignado',    color: '#854F0B', bg: '#FAEEDA' },
  en_progreso: { label: 'En Progreso', color: '#185FA5', bg: '#E6F1FB' },
  completado:  { label: 'Completado',  color: '#3B6D11', bg: '#EAF3DE' },
}

export default function OperacionesPage() {
  const navigate = useNavigate()
  const { puede } = usePermisos()

  const [config, setConfig]           = useState(null)
  const [columnas, setColumnas]       = useState([])
  const [leads, setLeads]             = useState([])
  const [filtroEstado, setFiltroEstado] = useState('activos')
  const [loading, setLoading]         = useState(true)

  useEffect(() => { return onSnapshot(doc(db, 'configuracion', 'operaciones'), snap => setConfig(snap.exists() ? snap.data() : null)) }, [])
  useEffect(() => { return onSnapshot(query(collection(db, 'pipeline_columnas'), orderBy('orden')), snap => setColumnas(snap.docs.map(d => ({ id: d.id, ...d.data() })))) }, [])

  const columnasOpsIds = config?.columnasOperacionesIds || (config?.columnaOperacionesId ? [config.columnaOperacionesId] : [])

  useEffect(() => {
    if (columnasOpsIds.length === 0) { setLeads([]); setLoading(false); return }
    const q = query(collection(db, 'leads'), orderBy('creadoEn', 'desc'))
    return onSnapshot(q, snap => {
      const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setLeads(todos.filter(l => columnasOpsIds.includes(l.columnaId) || l.estadoOperacion))
      setLoading(false)
    })
  }, [columnasOpsIds.join(',')])

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

  const cambiarEstado = async (lead, nuevoEstado) => {
    const payload = { estadoOperacion: nuevoEstado }
    if (nuevoEstado === 'completado') payload.completadoEn = serverTimestamp()
    if (nuevoEstado === 'en_progreso') payload.iniciadoEn = serverTimestamp()
    await updateDoc(doc(db, 'leads', lead.id), payload)
    if (nuevoEstado === 'en_progreso' && lead.vendedorId) {
      await crearNotificacion({ destinatarioId: lead.vendedorId, tipo: 'general', titulo: '🚀 Técnico en camino', cuerpo: `Equipo en camino para "${lead.nombre}".`, link: `/crm/lead/${lead.id}` }).catch(() => {})
    }
  }

  const s = {
    page: { padding: '20px 24px', minHeight: '100vh', background: 'var(--eco-bg, #f5f6f8)', fontSize: 13 },
    card: { background: '#fff', border: '0.5px solid rgba(0,0,0,.08)', borderRadius: 10, padding: '16px 18px', marginBottom: 14 },
    btn: { padding: '6px 14px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 12, cursor: 'pointer', background: '#fff', fontFamily: 'inherit' },
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Operaciones</h1>
          <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>{columnasOpsIds.map(id => columnas.find(c => c.id === id)?.nombre).filter(Boolean).join(' · ') || '—'}</p>
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
            }}>{f.label} ({f.n})</button>
          ))}
        </div>
      </div>

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
                  <TareaOperacionCard lead={lead} onClick={() => navigate(`/operaciones/${lead.id}`)} />
                  {key === 'asignado' && (
                    <button onClick={e => { e.stopPropagation(); cambiarEstado(lead, 'en_progreso') }} style={{ width: '100%', padding: 6, border: '1px dashed #185FA5', borderRadius: 7, background: '#f8faff', color: '#185FA5', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginTop: -4, marginBottom: 8 }}>
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
