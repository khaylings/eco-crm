/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: CRMPage.jsx
 * Módulo:  CRM
 * ============================================================
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  obtenerLeads, obtenerColumnas, crearColumna, actualizarColumna,
  eliminarColumna, actualizarLead, eliminarLead, crearLead,
  obtenerContactos, obtenerEmpresas, obtenerOrigenes
} from '../../../firebase/contactos'
import { usePermisos } from '../../../hooks/usePermisos'
import FichaLead from '../../leads/components/FichaLead'

const PRIORIDADES = [
  { valor: 'baja',  label: '⚪ Baja',  color: '#9e9e9e' },
  { valor: 'media', label: '🟡 Media', color: '#f59e0b' },
  { valor: 'alta',  label: '🔴 Alta',  color: '#ef4444' },
]

const FILTROS = [
  { k: 'activos',  label: 'Activos' },
  { k: 'ganados',  label: '✓ Ganados' },
  { k: 'perdidos', label: '✕ Perdidos' },
  { k: 'todos',    label: 'Todos' },
]

export default function CRMPage() {
  const navigate = useNavigate()
  const { puede, puedeVerDe, esSuperiorOAdmin, usuario } = usePermisos()

  // Permisos CRM
  const puedeCrear    = puede('crm', 'Crear lead')
  const puedeEditar   = puede('crm', 'Editar lead')
  const puedeEliminar = puede('crm', 'Eliminar lead')
  const puedeVerTodos = puede('crm', 'Ver leads de todos los vendedores')
  const puedeReasignar = puede('crm', 'Reasignar lead a otro vendedor')

  const [columnas, setColumnas]   = useState([])
  const [leads, setLeads]         = useState([])
  const [contactos, setContactos] = useState([])
  const [empresas, setEmpresas]   = useState([])
  const [origenes, setOrigenes]   = useState([])
  const [vista, setVista]         = useState('kanban')
  const [filtroEstado, setFiltroEstado] = useState('activos')
  const [filtroVendedor, setFiltroVendedor] = useState('todos')
  const [verSoloMios, setVerSoloMios] = useState(!puedeVerTodos)
  const [modalLead, setModalLead]   = useState(null)
  const [leadSeleccionado, setLeadSeleccionado] = useState(null)
  const [editandoColumna, setEditandoColumna]   = useState(null)
  const [nuevaColumna, setNuevaColumna]         = useState('')
  const [mostrarNuevaColumna, setMostrarNuevaColumna] = useState(false)
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [cargando, setCargando] = useState(true)

  const cargar = async () => {
    setCargando(true)
    const [c, l, ct, em, or] = await Promise.all([
      obtenerColumnas(), obtenerLeads(), obtenerContactos(),
      obtenerEmpresas(), obtenerOrigenes()
    ])
    setColumnas(c)
    setLeads(l)
    setContactos(ct)
    setEmpresas(em)
    setOrigenes(or)
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  // ── Filtrado con permisos ─────────────────────────────────────────────────
  const leadsFiltrados = leads.filter(l => {
    // Filtro de estado
    if (filtroEstado === 'activos')  return l.estado !== 'ganado' && l.estado !== 'perdido'
    if (filtroEstado === 'ganados')  return l.estado === 'ganado'
    if (filtroEstado === 'perdidos') return l.estado === 'perdido'
    // Filtro de visibilidad por permiso
    const visiblePorPermiso = puedeVerTodos && !verSoloMios
      ? true
      : l.vendedorId === usuario?.uid || !l.vendedorId
    if (!visiblePorPermiso) return false
    // Filtro adicional por vendedor (solo para quien puede ver todos)
    if (puedeVerTodos && !verSoloMios && filtroVendedor !== 'todos' && l.vendedorId !== filtroVendedor) return false
    return true
  }).filter(l => {
    // Re-aplicar visibilidad sobre todos los estados
    if (puedeVerTodos && !verSoloMios) return true
    return l.vendedorId === usuario?.uid || !l.vendedorId
  })

  const contadores = {
    activos:  leads.filter(l => l.estado !== 'ganado' && l.estado !== 'perdido').length,
    ganados:  leads.filter(l => l.estado === 'ganado').length,
    perdidos: leads.filter(l => l.estado === 'perdido').length,
    todos:    leads.length,
  }

  const agregarColumna = async () => {
    if (!nuevaColumna.trim()) return
    await crearColumna({ nombre: nuevaColumna.trim(), orden: columnas.length, color: '#1a3a5c' })
    setNuevaColumna('')
    setMostrarNuevaColumna(false)
    cargar()
  }

  const renombrarColumna = async (id, nombre) => {
    if (!nombre.trim()) return
    await actualizarColumna(id, { nombre: nombre.trim() })
    setEditandoColumna(null)
    cargar()
  }

  const borrarColumna = async (id) => {
    const tieneLeads = leads.some(l => l.columnaId === id)
    if (tieneLeads) return alert('Mueve los leads antes de eliminar esta columna')
    if (!confirm('¿Eliminar columna?')) return
    await eliminarColumna(id)
    cargar()
  }

  const moverLead = async (leadId, nuevaColumnaId) => {
    if (!puedeEditar) return
    await actualizarLead(leadId, { columnaId: nuevaColumnaId })
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, columnaId: nuevaColumnaId } : l))
  }

  const handleEliminarLead = async (lead) => {
    if (!puedeEliminar) return alert('No tenés permiso para eliminar leads.')
    if (!confirm('¿Eliminar lead?')) return
    await eliminarLead(lead.id)
    cargar()
  }

  const handleDragStart = (e, lead) => {
    if (!puedeEditar) return
    setDragging(lead)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDrop = (e, columnaId) => {
    e.preventDefault()
    if (dragging && dragging.columnaId !== columnaId) moverLead(dragging.id, columnaId)
    setDragging(null)
    setDragOver(null)
  }

  const leadsPorColumna = (colId) => leadsFiltrados.filter(l => l.columnaId === colId)

  const totalPorColumna = (colId) =>
    leadsPorColumna(colId).reduce((sum, l) => sum + (parseFloat(l.valor) || 0), 0)

  const s = estilos

  if (cargando) return <p style={{ textAlign: 'center', marginTop: '3rem', color: '#666' }}>Cargando pipeline...</p>

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* HEADER */}
      <div style={s.header}>
        <div>
          <h1 style={s.titulo}>Pipeline CRM</h1>
          <p style={s.subtitulo}>{contadores.activos} leads activos · {columnas.length} etapas</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={s.vistaTabs}>
            <button style={{ ...s.vistaBtn, ...(vista === 'kanban' ? s.vistaBtnActivo : {}) }} onClick={() => setVista('kanban')}>⊞ Kanban</button>
            <button style={{ ...s.vistaBtn, ...(vista === 'lista'  ? s.vistaBtnActivo : {}) }} onClick={() => setVista('lista')}>☰ Lista</button>
          </div>
          {puedeCrear && (
            <button style={s.btnPrimario} onClick={() => { setLeadSeleccionado(null); setModalLead('nuevo') }}>
              + Nuevo lead
            </button>
          )}
        </div>
      </div>

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {FILTROS.map(f => (
          <button key={f.k} onClick={() => setFiltroEstado(f.k)} style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid',
            borderColor: filtroEstado === f.k ? '#1a3a5c' : '#dde3ed',
            background: filtroEstado === f.k
              ? f.k === 'ganados' ? '#D1FAE5' : f.k === 'perdidos' ? '#FEE2E2' : '#1a3a5c'
              : '#fff',
            color: filtroEstado === f.k
              ? f.k === 'ganados' ? '#065F46' : f.k === 'perdidos' ? '#991B1B' : '#fff'
              : '#555',
          }}>
            {f.label} ({contadores[f.k]})
          </button>
        ))}

        {/* Toggle mis leads / todos — solo para quien tiene permiso */}
        {puedeVerTodos && (
          <select
            value={verSoloMios ? 'mios' : 'todos'}
            onChange={e => setVerSoloMios(e.target.value === 'mios')}
            style={{ marginLeft: 'auto', fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #dde3ed', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <option value="todos">Todos los vendedores</option>
            <option value="mios">Mis leads</option>
          </select>
        )}
      </div>

      {columnas.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
          <p style={{ fontSize: '2.5rem', margin: 0 }}>📋</p>
          <p>No hay etapas en el pipeline. Crea la primera columna.</p>
        </div>
      )}

      {/* KANBAN */}
      {vista === 'kanban' && (
        <div style={s.kanbanWrapper}>
          {columnas.map(col => (
            <div key={col.id}
              style={{ ...s.columna, ...(dragOver === col.id ? s.columnaOver : {}) }}
              onDragOver={e => { e.preventDefault(); setDragOver(col.id) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => handleDrop(e, col.id)}
            >
              <div style={s.colHeader}>
                {editandoColumna === col.id ? (
                  <input autoFocus defaultValue={col.nombre} style={s.inputCol}
                    onBlur={e => renombrarColumna(col.id, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') renombrarColumna(col.id, e.target.value) }} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                    <span style={s.colNombre} onClick={() => esSuperiorOAdmin && setEditandoColumna(col.id)}>{col.nombre}</span>
                    <span style={s.colCount}>{leadsPorColumna(col.id).length}</span>
                  </div>
                )}
                {esSuperiorOAdmin && (
                  <button style={s.btnBorrarCol} onClick={() => borrarColumna(col.id)} title="Eliminar columna">✕</button>
                )}
              </div>

              {totalPorColumna(col.id) > 0 && (
                <div style={s.colTotal}>${totalPorColumna(col.id).toLocaleString('es-CR', { minimumFractionDigits: 2 })}</div>
              )}

              <div style={s.leadsList}>
                {leadsPorColumna(col.id).map(lead => (
                  <TarjetaLead
                    key={lead.id}
                    lead={lead}
                    contactos={contactos}
                    empresas={empresas}
                    puedeEditar={puedeEditar}
                    puedeEliminar={puedeEliminar}
                    onDragStart={handleDragStart}
                    onClick={() => navigate(`/crm/lead/${lead.id}`)}
                    onEliminar={() => handleEliminarLead(lead)}
                  />
                ))}
                {leadsPorColumna(col.id).length === 0 && filtroEstado !== 'activos' && (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: '#bbb', fontSize: 12 }}>Sin leads</div>
                )}
              </div>

              {filtroEstado === 'activos' && puedeCrear && (
                <button style={s.btnAddLead} onClick={() => { setLeadSeleccionado({ columnaId: col.id }); setModalLead('nuevo') }}>
                  + Agregar lead
                </button>
              )}
            </div>
          ))}

          {filtroEstado === 'activos' && esSuperiorOAdmin && (
            <div style={s.nuevaColumnaWrap}>
              {mostrarNuevaColumna ? (
                <div style={s.nuevaColumnaForm}>
                  <input autoFocus style={s.inputCol} placeholder="Nombre de la etapa..." value={nuevaColumna}
                    onChange={e => setNuevaColumna(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') agregarColumna(); if (e.key === 'Escape') setMostrarNuevaColumna(false) }} />
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button style={s.btnGuardarCol} onClick={agregarColumna}>Agregar</button>
                    <button style={s.btnCancelarCol} onClick={() => setMostrarNuevaColumna(false)}>✕</button>
                  </div>
                </div>
              ) : (
                <button style={s.btnNuevaCol} onClick={() => setMostrarNuevaColumna(true)}>+ Agregar etapa</button>
              )}
            </div>
          )}
        </div>
      )}

      {/* LISTA */}
      {vista === 'lista' && (
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', overflow: 'hidden', border: '1px solid #eef0f4' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fc', borderBottom: '1px solid #eee' }}>
                {['Lead', 'Cliente', 'Etapa', 'Estado', 'Prioridad', 'Origen', 'Valor', ''].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leadsFiltrados.map(lead => {
                const col = columnas.find(c => c.id === lead.columnaId)
                const contacto = contactos.find(c => c.id === lead.contactoId) || empresas.find(e => e.id === lead.empresaId)
                const prio = PRIORIDADES.find(p => p.valor === lead.prioridad)
                return (
                  <tr key={lead.id} style={{ borderBottom: '1px solid #f5f5f5', cursor: 'pointer' }}
                    onClick={() => navigate(`/crm/lead/${lead.id}`)}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#1a1a1a', fontSize: '0.9rem' }}>{lead.nombre}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#555' }}>{contacto?.nombre || lead.empresaNombre || '—'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {col ? <span style={{ backgroundColor: '#e3f2fd', color: '#1565c0', fontSize: '0.78rem', fontWeight: 600, padding: '0.2rem 0.65rem', borderRadius: '20px' }}>{col.nombre}</span> : '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {lead.estado === 'ganado'  && <span style={{ background: '#D1FAE5', color: '#065F46',  fontSize: '0.78rem', fontWeight: 600, padding: '0.2rem 0.65rem', borderRadius: '20px' }}>✓ Ganado</span>}
                      {lead.estado === 'perdido' && <span style={{ background: '#FEE2E2', color: '#991B1B',  fontSize: '0.78rem', fontWeight: 600, padding: '0.2rem 0.65rem', borderRadius: '20px' }}>✕ Perdido</span>}
                      {(!lead.estado || (lead.estado !== 'ganado' && lead.estado !== 'perdido')) && <span style={{ background: '#f0f4f8', color: '#555', fontSize: '0.78rem', fontWeight: 600, padding: '0.2rem 0.65rem', borderRadius: '20px' }}>Activo</span>}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: prio?.color || '#999' }}>{prio?.label || '—'}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#555' }}>{lead.origen || '—'}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: '#1a3a5c' }}>
                      {lead.valor ? `$${parseFloat(lead.valor).toLocaleString('es-CR')}` : '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {puedeEliminar && (
                        <button style={s.btnEliminarSmall} onClick={e => { e.stopPropagation(); handleEliminarLead(lead) }}>✕</button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {leadsFiltrados.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>Sin leads en esta vista</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL LEAD */}
      {modalLead && (
        <FichaLead
          lead={leadSeleccionado}
          columnas={columnas}
          contactos={contactos}
          empresas={empresas}
          origenes={origenes}
          onClose={() => { setModalLead(null); setLeadSeleccionado(null) }}
          onGuardado={() => { setModalLead(null); setLeadSeleccionado(null); cargar() }}
        />
      )}
    </div>
  )
}

// ── Tarjeta Kanban ────────────────────────────────────────────────────────────
function TarjetaLead({ lead, contactos, empresas, puedeEditar, puedeEliminar, onDragStart, onClick, onEliminar }) {
  const contacto = contactos.find(c => c.id === lead.contactoId) || empresas.find(e => e.id === lead.empresaId)
  const prio = PRIORIDADES.find(p => p.valor === lead.prioridad)
  const s = estilos
  return (
    <div
      style={{ ...s.tarjeta, cursor: puedeEditar ? 'grab' : 'pointer' }}
      draggable={puedeEditar}
      onDragStart={e => onDragStart(e, lead)}
      onClick={onClick}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
        <span style={s.tarjetaNombre}>{lead.nombre}</span>
        {puedeEliminar && (
          <button style={s.btnEliminarSmall} onClick={e => { e.stopPropagation(); onEliminar() }}>✕</button>
        )}
      </div>
      {(contacto || lead.empresaNombre) && (
        <div style={s.tarjetaContacto}>👤 {contacto?.nombre || lead.empresaNombre}</div>
      )}
      {lead.origen && <div style={s.tarjetaOrigen}>{lead.origen}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
        {prio && <span style={{ fontSize: '0.75rem', color: prio.color, fontWeight: 600 }}>{prio.label}</span>}
        {lead.whatsapp && <span style={{ fontSize: '0.72rem', color: '#25d366', fontWeight: 600 }}>💬 WA</span>}
      </div>
      {lead.etiquetas?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.4rem' }}>
          {lead.etiquetas.map(e => <span key={e} style={s.etiqueta}>{e}</span>)}
        </div>
      )}
    </div>
  )
}

const estilos = {
  header:         { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexShrink: 0 },
  titulo:         { fontSize: '1.6rem', fontWeight: 700, color: '#1a1a1a', margin: 0 },
  subtitulo:      { color: '#666', margin: '0.25rem 0 0', fontSize: '0.9rem' },
  btnPrimario:    { backgroundColor: '#1a3a5c', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.65rem 1.25rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' },
  vistaTabs:      { display: 'flex', border: '1.5px solid #dde3ed', borderRadius: '8px', overflow: 'hidden' },
  vistaBtn:       { padding: '0.45rem 0.9rem', border: 'none', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', color: '#666', fontWeight: 500 },
  vistaBtnActivo: { backgroundColor: '#1a3a5c', color: '#fff' },
  kanbanWrapper:  { display: 'flex', gap: '1rem', overflowX: 'auto', flex: 1, paddingBottom: '1rem', alignItems: 'flex-start' },
  columna:        { minWidth: '280px', maxWidth: '280px', backgroundColor: '#f0f4f8', borderRadius: '12px', padding: '0.75rem', display: 'flex', flexDirection: 'column', transition: 'background 0.2s' },
  columnaOver:    { backgroundColor: '#dbeafe' },
  colHeader:      { display: 'flex', alignItems: 'center', marginBottom: '0.35rem', gap: '0.5rem' },
  colNombre:      { fontWeight: 700, color: '#1a1a1a', fontSize: '0.9rem', flex: 1 },
  colCount:       { backgroundColor: '#1a3a5c', color: '#fff', borderRadius: '20px', padding: '0.1rem 0.5rem', fontSize: '0.72rem', fontWeight: 700 },
  colTotal:       { fontSize: '0.78rem', color: '#2e7d32', fontWeight: 600, marginBottom: '0.5rem' },
  inputCol:       { width: '100%', padding: '0.4rem 0.6rem', border: '1.5px solid #1a3a5c', borderRadius: '6px', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' },
  btnBorrarCol:   { background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: '0.8rem', padding: '0.2rem', flexShrink: 0 },
  leadsList:      { display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: '60px', flex: 1 },
  tarjeta:        { backgroundColor: '#fff', borderRadius: '8px', padding: '0.85rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #eef0f4', userSelect: 'none' },
  tarjetaNombre:  { fontWeight: 600, color: '#1a1a1a', fontSize: '0.88rem', flex: 1, lineHeight: 1.3 },
  tarjetaContacto:{ fontSize: '0.78rem', color: '#555', marginBottom: '0.2rem' },
  tarjetaOrigen:  { fontSize: '0.73rem', color: '#1a3a5c', backgroundColor: '#e8f0fe', padding: '0.1rem 0.45rem', borderRadius: '20px', display: 'inline-block' },
  etiqueta:       { backgroundColor: '#f3e8ff', color: '#6b21a8', borderRadius: '20px', padding: '0.1rem 0.45rem', fontSize: '0.7rem', fontWeight: 600 },
  btnAddLead:     { marginTop: '0.6rem', padding: '0.4rem', border: '1.5px dashed #bbb', borderRadius: '6px', background: 'none', cursor: 'pointer', fontSize: '0.82rem', color: '#888', width: '100%' },
  btnNuevaCol:    { minWidth: '220px', padding: '0.75rem 1.25rem', border: '2px dashed #bbb', borderRadius: '12px', background: 'none', cursor: 'pointer', fontSize: '0.88rem', color: '#888', whiteSpace: 'nowrap' },
  nuevaColumnaWrap: { minWidth: '220px', flexShrink: 0 },
  nuevaColumnaForm: { backgroundColor: '#f0f4f8', borderRadius: '12px', padding: '0.75rem' },
  btnGuardarCol:  { padding: '0.35rem 0.85rem', border: 'none', borderRadius: '6px', backgroundColor: '#1a3a5c', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' },
  btnCancelarCol: { padding: '0.35rem 0.65rem', border: '1px solid #ccc', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '0.82rem' },
  btnEliminarSmall: { padding: '0.2rem 0.45rem', border: 'none', borderRadius: '4px', backgroundColor: '#fdecea', color: '#c62828', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0 },
}