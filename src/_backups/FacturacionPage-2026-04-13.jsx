/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: FacturacionPage.jsx
 * Módulo:  Facturacion
 * ============================================================
 */

import { useState, useEffect, useMemo } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../../../firebase/config'
import { useNavigate } from 'react-router-dom'
import { usePermisos } from '../../../hooks/usePermisos'

const ESTADO_CONFIG = {
  'Sin Pagar':  { bg: '#FCEBEB', color: '#A32D2D', dot: '#E24B4A' },
  'Parcial':    { bg: '#FAEEDA', color: '#854F0B', dot: '#EF9F27' },
  'Pagada':     { bg: '#EAF3DE', color: '#3B6D11', dot: '#639922' },
  'Incobrable': { bg: '#EEEDFE', color: '#3C3489', dot: '#7F77DD' },
}

const ESTADOS_FILTRO = ['Todos', 'Sin Pagar', 'Parcial', 'Pagada', 'Incobrable']

const fmt = (n, mon = 'USD') =>
  mon === 'USD'
    ? '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '₡' + Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 0 })

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
  const saldo  = Number(f.saldo ?? f.total ?? 0)
  const pagado = Number(f.totalPagado ?? 0)
  if (saldo <= 0 && pagado > 0) return 'Pagada'
  if (pagado > 0 && saldo > 0)  return 'Parcial'
  return 'Sin Pagar'
}

function MetricaCard({ label, valor, color }) {
  return (
    <div style={{
      background: '#fff', border: '0.5px solid rgba(0,0,0,.08)', borderRadius: 10,
      padding: '16px 20px', flex: 1, minWidth: 160,
    }}>
      <div style={{ fontSize: 11, color: '#888', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: color || 'var(--eco-primary, #1a3a5c)', letterSpacing: '-0.5px' }}>{valor}</div>
    </div>
  )
}

export default function FacturacionPage() {
  const navigate = useNavigate()
  const { puede, usuario } = usePermisos()

  const puedeVerTodas   = puede('facturas', 'Ver facturas de todos')
  const puedeVerPrecios = puede('facturas', 'Ver precios y montos')

  const [facturas, setFacturas]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [filtroEstado, setFiltroEstado]   = useState('Todos')
  const [busqueda, setBusqueda]           = useState('')
  const [verSoloMias, setVerSoloMias]     = useState(!puedeVerTodas)

  useEffect(() => {
    const q = query(collection(db, 'facturas'), orderBy('creadoEn', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setFacturas(snap.docs.map(d => {
        const data = { id: d.id, ...d.data() }
        data.estadoCalculado = calcularEstado(data)
        return data
      }))
      setLoading(false)
    })
    return unsub
  }, [])

  const metricas = useMemo(() => {
    if (!puedeVerPrecios) return null
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0,0,0,0)
    let totalFacturado = 0, porCobrar = 0, vencido = 0, cobradoMes = 0
    facturas.forEach(f => {
      totalFacturado += Number(f.total || 0)
      const est   = f.estadoCalculado
      const saldo = Number(f.saldo || 0)
      if (est === 'Sin Pagar' || est === 'Parcial') {
        porCobrar += saldo
        const dias = diasRestantes(f.fechaVencimiento)
        if (dias !== null && dias < 0) vencido += saldo
      }
      ;(f.pagos || []).forEach(p => {
        if (!p.fecha) return
        const fp = new Date(p.fecha + 'T00:00:00')
        if (fp >= inicioMes) cobradoMes += Number(p.monto || 0)
      })
    })
    return { totalFacturado, porCobrar, vencido, cobradoMes }
  }, [facturas, puedeVerPrecios])

  const filtradas = useMemo(() => facturas.filter(f => {
    const esPropia = f.vendedorId === usuario?.uid || !f.vendedorId
    if (!puedeVerTodas && !esPropia) return false
    if (puedeVerTodas && verSoloMias && !esPropia) return false
    if (filtroEstado !== 'Todos' && f.estadoCalculado !== filtroEstado) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      if (!f.clienteNombre?.toLowerCase().includes(q) &&
          !f.numero?.toLowerCase().includes(q) &&
          !f.empresaNombre?.toLowerCase().includes(q)) return false
    }
    return true
  }), [facturas, filtroEstado, busqueda, verSoloMias, puedeVerTodas, usuario])

  const s = {
    page:    { padding: '24px 28px', minHeight: '100vh', background: 'var(--eco-bg, #f5f6f8)' },
    card:    { background: '#fff', border: '0.5px solid rgba(0,0,0,.08)', borderRadius: 10, overflow: 'hidden' },
    toolbar: { display: 'flex', gap: 10, alignItems: 'center', padding: '12px 16px', borderBottom: '0.5px solid rgba(0,0,0,.06)', flexWrap: 'wrap' },
    inp:     { padding: '7px 12px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fff', color: 'inherit', fontFamily: 'inherit' },
    th:      { padding: '10px 14px', textAlign: 'left', fontWeight: 500, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '0.5px solid rgba(0,0,0,.06)', background: '#fafafa' },
    td:      { padding: '11px 14px', borderBottom: '0.5px solid rgba(0,0,0,.05)', color: '#222', verticalAlign: 'middle' },
    btnSm:   { padding: '4px 12px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: '#fff', fontFamily: 'inherit' },
  }

  return (
    <div style={s.page}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <p style={{ fontSize: 20, fontWeight: 500, color: 'var(--eco-primary, #1a3a5c)', margin: 0 }}>Facturación</p>
        {puedeVerTodas && (
          <select value={verSoloMias ? 'mias' : 'todas'} onChange={e => setVerSoloMias(e.target.value === 'mias')} style={{ ...s.inp, fontSize: 12 }}>
            <option value="todas">Todas</option>
            <option value="mias">Mis facturas</option>
          </select>
        )}
      </div>

      {/* Métricas */}
      {metricas && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <MetricaCard label="Total facturado"  valor={fmt(metricas.totalFacturado)} />
          <MetricaCard label="Por cobrar"       valor={fmt(metricas.porCobrar)}       color="#185FA5" />
          <MetricaCard label="Vencido"          valor={fmt(metricas.vencido)}         color="#A32D2D" />
          <MetricaCard label="Cobrado este mes" valor={fmt(metricas.cobradoMes)}      color="#3B6D11" />
        </div>
      )}

      {/* Tabla */}
      <div style={s.card}>
        <div style={s.toolbar}>
          <input
            style={{ ...s.inp, width: 230 }}
            placeholder="Buscar por cliente o número..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ESTADOS_FILTRO.map(e => (
              <button key={e} onClick={() => setFiltroEstado(e)} style={{
                ...s.btnSm,
                background:  filtroEstado === e ? 'var(--eco-primary, #1a3a5c)' : '#fff',
                color:       filtroEstado === e ? '#fff' : '#555',
                borderColor: filtroEstado === e ? 'transparent' : 'rgba(0,0,0,.15)',
              }}>{e}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>Cargando...</div>
        ) : filtradas.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>
            {facturas.length === 0
              ? 'No hay facturas aún. Generá una desde una cotización Aceptada en el módulo de Ventas.'
              : 'Sin resultados para ese filtro.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={s.th}>#</th>
                <th style={s.th}>Cliente / Empresa</th>
                <th style={s.th}>Origen</th>
                <th style={s.th}>Vendedor</th>
                {puedeVerPrecios && <th style={s.th}>Total</th>}
                {puedeVerPrecios && <th style={s.th}>Saldo</th>}
                <th style={s.th}>Estado</th>
                <th style={s.th}>Vencimiento</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(f => {
                const est  = f.estadoCalculado
                const cfg  = ESTADO_CONFIG[est] || ESTADO_CONFIG['Sin Pagar']
                const dias = diasRestantes(f.fechaVencimiento)
                const vencida = (est === 'Sin Pagar' || est === 'Parcial') && dias !== null && dias < 0
                const proxima = !vencida && (est === 'Sin Pagar' || est === 'Parcial') && dias !== null && dias <= 5

                return (
                  <tr key={f.id} style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/facturacion/${f.id}`)}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td style={{ ...s.td, color: '#888', fontSize: 12, fontFamily: 'monospace' }}>{f.numero}</td>
                    <td style={s.td}>
                      <p style={{ fontWeight: 500, margin: 0, marginBottom: f.empresaNombre ? 2 : 0 }}>{f.clienteNombre || '—'}</p>
                      {f.facturarEmpresa && f.empresaNombre && <p style={{ fontSize: 11, color: '#888', margin: 0 }}>{f.empresaNombre}</p>}
                    </td>
                    <td style={{ ...s.td, fontSize: 12 }}>
                      {f.cotizacionNumero ? (
                        <span style={{ color: '#185FA5', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                          onClick={e => { e.stopPropagation(); navigate(`/ventas/cotizacion/${f.cotizacionId}`) }}
                          title="Ver cotización origen">
                          {f.cotizacionNumero}
                        </span>
                      ) : f.proyectoNumero ? (
                        <span style={{ color: '#3B6D11', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                          onClick={e => { e.stopPropagation(); navigate(`/proyectos/${f.proyectoId}`) }}
                          title="Ver proyecto origen">
                          {f.proyectoNumero}
                        </span>
                      ) : <span style={{ color: '#bbb' }}>—</span>}
                    </td>
                    <td style={{ ...s.td, color: '#666' }}>{f.vendedorNombre || '—'}</td>
                    {puedeVerPrecios && <td style={{ ...s.td, fontWeight: 500 }}>{fmt(f.total, f.moneda)}</td>}
                    {puedeVerPrecios && (
                      <td style={{ ...s.td, fontWeight: 500, color: Number(f.saldo) <= 0 ? '#3B6D11' : '#A32D2D' }}>
                        {Number(f.saldo) <= 0 ? <span style={{ color: '#ccc' }}>—</span> : fmt(f.saldo, f.moneda)}
                      </td>
                    )}
                    <td style={s.td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: cfg.bg, color: cfg.color }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                        {est}
                      </span>
                    </td>
                    <td style={{ ...s.td, fontSize: 12 }}>
                      {f.fechaVencimiento ? (
                        <span style={{ color: vencida ? '#A32D2D' : proxima ? '#854F0B' : '#666', fontWeight: vencida || proxima ? 500 : 400 }}>
                          {fmtFecha(f.fechaVencimiento)}
                          {vencida && <span style={{ marginLeft: 5, fontSize: 10, background: '#FCEBEB', color: '#A32D2D', padding: '1px 5px', borderRadius: 4 }}>Vencida</span>}
                          {proxima && <span style={{ marginLeft: 5, fontSize: 10, background: '#FAEEDA', color: '#854F0B', padding: '1px 5px', borderRadius: 4 }}>{dias}d</span>}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={s.td} onClick={e => e.stopPropagation()}>
                      <button style={s.btnSm} onClick={() => navigate(`/facturacion/${f.id}`)}>Ver</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}