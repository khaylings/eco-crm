/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: ActivosPage.jsx
 * Módulo:  Activos
 * ============================================================
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDocs, collection, query, orderBy } from 'firebase/firestore'
import { db } from '../../../firebase/config'
import { obtenerEmpresas, obtenerTodasLasSedes, eliminarActivo } from '../../../firebase/contactos'
import ActivoForm from '../components/ActivoForm'

const ESTADOS = ['Todos', 'Operativo', 'En mantenimiento', 'Fuera de servicio', 'En garantía']
const PROVINCIAS = ['Todas', 'San José', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste', 'Puntarenas', 'Limón']

function diasDesdeUltimoServicio(fechaStr) {
  if (!fechaStr) return null
  const hoy = new Date()
  const fecha = new Date(fechaStr)
  return Math.floor((hoy - fecha) / (1000 * 60 * 60 * 24))
}

function AlertaBadge({ activo }) {
  const dias = diasDesdeUltimoServicio(activo.ultimoServicio)
  if (!dias && !activo.garantiaHasta) return null

  const garantiaVencida = activo.garantiaHasta && new Date(activo.garantiaHasta) < new Date()
  const mantenimientoVencido = dias !== null && dias > 180

  if (!garantiaVencida && !mantenimientoVencido) return null

  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
      background: '#FCEBEB', color: '#A32D2D', whiteSpace: 'nowrap',
    }}>
      {garantiaVencida ? '⚠ Garantía vencida' : `⚠ Sin mantenimiento ${dias}d`}
    </span>
  )
}

export default function ActivosPage() {
  const navigate = useNavigate()
  const [activos, setActivos] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [sedes, setSedes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(false)

  const [filtroEmpresa, setFiltroEmpresa] = useState('')
  const [filtroSede, setFiltroSede] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('Todos')
  const [filtroProvincia, setFiltroProvincia] = useState('Todas')
  const [busqueda, setBusqueda] = useState('')

  const cargar = async () => {
    setCargando(true)
    const [snap, emps, todasSedes] = await Promise.all([
      getDocs(query(collection(db, 'activos'), orderBy('creadoEn', 'desc'))),
      obtenerEmpresas(),
      obtenerTodasLasSedes(),
    ])
    setActivos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    setEmpresas(emps)
    setSedes(todasSedes)
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  // Sedes filtradas según empresa seleccionada
  const sedesFiltradas = filtroEmpresa
    ? sedes.filter(s => s.empresaId === filtroEmpresa)
    : sedes

  const activosFiltrados = activos.filter(a => {
    if (busqueda) {
      const b = busqueda.toLowerCase()
      if (!a.tipo?.toLowerCase().includes(b) &&
          !a.marca?.toLowerCase().includes(b) &&
          !a.modelo?.toLowerCase().includes(b) &&
          !a.nroSerie?.toLowerCase().includes(b)) return false
    }
    if (filtroEmpresa && a.empresaId !== filtroEmpresa) return false
    if (filtroSede && a.sedeId !== filtroSede) return false
    if (filtroEstado !== 'Todos' && a.estado !== filtroEstado) return false
    if (filtroProvincia !== 'Todas') {
      const sede = sedes.find(s => s.id === a.sedeId)
      if (sede?.provincia !== filtroProvincia) return false
    }
    return true
  })

  const conAlertas = activosFiltrados.filter(a => {
    const dias = diasDesdeUltimoServicio(a.ultimoServicio)
    const garantiaVencida = a.garantiaHasta && new Date(a.garantiaHasta) < new Date()
    const mantenimientoVencido = dias !== null && dias > 180
    return garantiaVencida || mantenimientoVencido
  }).length

  const s = est

  return (
    <div style={{ padding: '24px 28px' }}>

      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.titulo}>Activos</h1>
          <p style={s.sub}>
            {activos.length} equipo{activos.length !== 1 ? 's' : ''} registrado{activos.length !== 1 ? 's' : ''}
            {conAlertas > 0 && (
              <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: '#FCEBEB', color: '#A32D2D' }}>
                ⚠ {conAlertas} con alerta
              </span>
            )}
          </p>
        </div>
        <button style={s.btnPrimario} onClick={() => setModal(true)}>+ Nuevo activo</button>
      </div>

      {/* Filtros */}
      <div style={s.filtrosRow}>
        <input
          style={s.buscador}
          placeholder="Buscar por tipo, marca, modelo, serie..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <select style={s.select} value={filtroEmpresa} onChange={e => { setFiltroEmpresa(e.target.value); setFiltroSede('') }}>
          <option value="">Todas las empresas</option>
          {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <select style={s.select} value={filtroSede} onChange={e => setFiltroSede(e.target.value)} disabled={sedesFiltradas.length === 0}>
          <option value="">Todas las sedes</option>
          {sedesFiltradas.map(s => <option key={s.id} value={s.id}>{s.nombre}{s.empresaNombre ? ` — ${s.empresaNombre}` : ''}</option>)}
        </select>
        <select style={s.select} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select style={s.select} value={filtroProvincia} onChange={e => setFiltroProvincia(e.target.value)}>
          {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Tabla */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-tertiary)' }}>Cargando...</div>
      ) : activosFiltrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-tertiary)' }}>
          <p style={{ fontSize: '2.5rem', margin: 0 }}>❄️</p>
          <p style={{ marginTop: 8 }}>No hay activos registrados</p>
        </div>
      ) : (
        <div style={s.tabla}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-background-secondary)' }}>
                {['Equipo', 'Empresa / Sede', 'Capacidad', 'Serie', 'Estado', 'Garantía', ''].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activosFiltrados.map((activo, i) => {
                const sede = sedes.find(s => s.id === activo.sedeId)
                const empresa = empresas.find(e => e.id === activo.empresaId)
                const estadoColor = {
                  'Operativo': { bg: '#EAF3DE', color: '#27500A' },
                  'En mantenimiento': { bg: '#FAEEDA', color: '#633806' },
                  'Fuera de servicio': { bg: '#FCEBEB', color: '#791F1F' },
                  'En garantía': { bg: '#E6F1FB', color: '#0C447C' },
                }[activo.estado] || { bg: '#F1EFE8', color: '#444441' }

                return (
                  <tr key={activo.id} style={{
                    borderBottom: '0.5px solid var(--color-border-tertiary)',
                    background: i % 2 === 0 ? 'var(--color-background-primary)' : 'var(--color-background-secondary)',
                    cursor: 'pointer',
                    transition: 'background .12s',
                  }}
                    onClick={() => navigate(`/activos/${activo.id}`)}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-background-info)'}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'var(--color-background-primary)' : 'var(--color-background-secondary)'}
                  >
                    <td style={s.td}>
                      <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--color-text-primary)' }}>
                        ❄️ {activo.tipo}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        {[activo.marca, activo.modelo].filter(Boolean).join(' ')}
                      </div>
                      <AlertaBadge activo={activo} />
                    </td>
                    <td style={s.td}>
                      <div style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 500 }}>
                        {empresa?.nombre || activo.propietarioNombre || '—'}
                      </div>
                      {sede && (
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                          🏪 {sede.nombre}{sede.provincia ? ` · ${sede.provincia}` : ''}
                        </div>
                      )}
                    </td>
                    <td style={s.td}>
                      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                        {activo.capacidadBTU ? `${activo.capacidadBTU} BTU` : '—'}
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'monospace' }}>
                        {activo.nroSerie || '—'}
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: estadoColor.bg, color: estadoColor.color }}>
                        {activo.estado || 'Sin estado'}
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={{ fontSize: 12, color: activo.garantiaHasta && new Date(activo.garantiaHasta) < new Date() ? '#A32D2D' : 'var(--color-text-secondary)' }}>
                        {activo.garantiaHasta || '—'}
                      </span>
                    </td>
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/activos/${activo.id}`) }}
                        style={s.btnVer}
                      >
                        Ver →
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ActivoForm
          empresas={empresas}
          sedes={sedes}
          onClose={() => setModal(false)}
          onGuardado={() => { setModal(false); cargar() }}
        />
      )}
    </div>
  )
}

const est = {
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  titulo:     { fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 },
  sub:        { color: 'var(--color-text-secondary)', margin: '4px 0 0', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 },
  btnPrimario:{ background: '#1a3a5c', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' },
  filtrosRow: { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  buscador:   { flex: 2, minWidth: 200, padding: '7px 12px', border: '0.5px solid var(--color-border-secondary)', borderRadius: 8, fontSize: 13, background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', fontFamily: 'inherit', outline: 'none' },
  select:     { flex: 1, minWidth: 140, padding: '7px 10px', border: '0.5px solid var(--color-border-secondary)', borderRadius: 8, fontSize: 13, background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', fontFamily: 'inherit', outline: 'none' },
  tabla:      { background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, overflow: 'hidden' },
  th:         { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '0.5px solid var(--color-border-tertiary)' },
  td:         { padding: '12px 14px', verticalAlign: 'middle' },
  btnVer:     { padding: '4px 12px', border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, background: 'none', fontSize: 12, color: 'var(--color-text-primary)', cursor: 'pointer', fontFamily: 'inherit' },
}