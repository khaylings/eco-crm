/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: ComprasPage.jsx
 * Módulo:  Compras
 * ============================================================
 */

import { useState, useEffect, useMemo } from 'react'
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore'
import { db } from '../../../firebase/config'
import { useNavigate } from 'react-router-dom'
import { usePermisos } from '../../../hooks/usePermisos'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n, mon = 'CRC') =>
  mon === 'USD'
    ? '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '₡' + Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 0 })

const fmtFecha = (iso) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const diasHasta = (iso) => {
  if (!iso) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const vence = new Date(iso + 'T00:00:00')
  return Math.ceil((vence - hoy) / 86400000)
}

const ESTADO_CONFIG = {
  'Borrador':          { bg: '#F1EFE8', color: '#5F5E5A', dot: '#888780' },
  'Enviada':           { bg: '#E6F1FB', color: '#185FA5', dot: '#378ADD' },
  'Recibida':          { bg: '#EAF3DE', color: '#3B6D11', dot: '#639922' },
  'Pagada':            { bg: '#EAF3DE', color: '#27500A', dot: '#3B6D11' },
  'Crédito pendiente': { bg: '#FAEEDA', color: '#854F0B', dot: '#EF9F27' },
  'Vencida':           { bg: '#FCEBEB', color: '#A32D2D', dot: '#E24B4A' },
  'Cancelada':         { bg: '#EEEDFE', color: '#3C3489', dot: '#7F77DD' },
}

const TIPO_CONFIG = {
  'inventariable': { bg: '#E6F1FB', color: '#185FA5', label: 'Inventario' },
  'gasto':         { bg: '#FAEEDA', color: '#854F0B', label: 'Gasto' },
}

const ESTADOS_FILTRO = ['Todos', 'Borrador', 'Enviada', 'Recibida', 'Crédito pendiente', 'Pagada', 'Vencida']
const TIPOS_FILTRO   = ['Todos', 'Inventariable', 'Gasto']

function MetricaCard({ label, valor, color, sub }) {
  return (
    <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,.08)', borderRadius: 10, padding: '14px 18px', flex: 1, minWidth: 150 }}>
      <p style={{ fontSize: 11, color: '#888', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 700, color: color || 'var(--eco-primary, #1a3a5c)', margin: 0, letterSpacing: '-0.5px' }}>{valor}</p>
      {sub && <p style={{ fontSize: 10, color: '#bbb', margin: '2px 0 0' }}>{sub}</p>}
    </div>
  )
}

export default function ComprasPage() {
  const navigate = useNavigate()
  const { puede, usuario } = usePermisos()

  const puedeCrear    = puede('compras', 'Crear orden')
  const puedeVerTodas = puede('compras', 'Ver')

  const [ordenes,       setOrdenes]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [tab,           setTab]           = useState('ordenes') // 'ordenes' | 'cuentas'
  const [filtroEstado,  setFiltroEstado]  = useState('Todos')
  const [filtroTipo,    setFiltroTipo]    = useState('Todos')
  const [busqueda,      setBusqueda]      = useState('')
  const [tasas,         setTasas]         = useState({ compra: 519, venta: 525 })

  // Cargar tasas
  useEffect(() => {
    getDoc(doc(db, 'configuracion', 'tasas')).then(snap => {
      if (snap.exists()) setTasas(snap.data())
    })
  }, [])

  // Suscripción en tiempo real
  useEffect(() => {
    const q = query(collection(db, 'ordenes_compra'), orderBy('creadoEn', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setOrdenes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])

  // Calcular estado automático
  const ordenesConEstado = useMemo(() => {
    return ordenes.map(o => {
      let estado = o.estado || 'Borrador'
      // Auto-marcar como vencida si tiene crédito pendiente y venció
      if (estado === 'Crédito pendiente' && o.fechaVencimientoPago) {
        const dias = diasHasta(o.fechaVencimientoPago)
        if (dias !== null && dias < 0) estado = 'Vencida'
      }
      return { ...o, estadoCalculado: estado }
    })
  }, [ordenes])

  // Métricas
  const metricas = useMemo(() => {
    let totalComprado = 0, porPagar = 0, vencido = 0, gastosMes = 0
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0)

    ordenesConEstado.forEach(o => {
      const total = Number(o.total || 0)
      totalComprado += total
      if (o.estadoCalculado === 'Crédito pendiente' || o.estadoCalculado === 'Vencida') {
        const saldo = Number(o.saldo ?? total)
        porPagar += saldo
        if (o.estadoCalculado === 'Vencida') vencido += saldo
      }
      if (o.tipo === 'gasto' && o.creadoEn) {
        const fecha = o.creadoEn?.toDate ? o.creadoEn.toDate() : new Date(o.creadoEn)
        if (fecha >= inicioMes) gastosMes += total
      }
    })
    return { totalComprado, porPagar, vencido, gastosMes }
  }, [ordenesConEstado])

  // Filtrado
  const filtradas = useMemo(() => {
    return ordenesConEstado.filter(o => {
      if (filtroEstado !== 'Todos' && o.estadoCalculado !== filtroEstado) return false
      if (filtroTipo !== 'Todos' && o.tipo !== filtroTipo.toLowerCase()) return false
      if (busqueda) {
        const q = busqueda.toLowerCase()
        if (!o.proveedorNombre?.toLowerCase().includes(q) && !o.numero?.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [ordenesConEstado, filtroEstado, filtroTipo, busqueda])

  // Cuentas por pagar
  const cuentasPorPagar = useMemo(() => {
    return ordenesConEstado.filter(o => o.estadoCalculado === 'Crédito pendiente' || o.estadoCalculado === 'Vencida')
      .sort((a, b) => {
        const da = diasHasta(a.fechaVencimientoPago) ?? 9999
        const db_ = diasHasta(b.fechaVencimientoPago) ?? 9999
        return da - db_
      })
  }, [ordenesConEstado])

  const nuevaOrden = async () => {
    if (!puedeCrear) return
    navigate('/compras/nueva')
  }

  const s = {
    page:    { padding: '24px 28px', minHeight: '100vh', background: 'var(--eco-bg, #f5f6f8)' },
    card:    { background: '#fff', border: '0.5px solid rgba(0,0,0,.08)', borderRadius: 10, overflow: 'hidden' },
    toolbar: { display: 'flex', gap: 10, alignItems: 'center', padding: '12px 16px', borderBottom: '0.5px solid rgba(0,0,0,.06)', flexWrap: 'wrap' },
    inp:     { padding: '7px 12px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff', color: 'inherit', fontFamily: 'inherit' },
    th:      { padding: '9px 14px', textAlign: 'left', fontWeight: 500, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '0.5px solid rgba(0,0,0,.06)', background: '#fafafa' },
    td:      { padding: '11px 14px', borderBottom: '0.5px solid rgba(0,0,0,.05)', verticalAlign: 'middle', fontSize: 13 },
    btnPrim: { padding: '8px 18px', background: 'var(--eco-primary, #1a3a5c)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
    btnSm:   { padding: '4px 12px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: '#fff', fontFamily: 'inherit' },
  }

  return (
    <div style={s.page}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <p style={{ fontSize: 20, fontWeight: 500, color: 'var(--eco-primary, #1a3a5c)', margin: 0 }}>Compras</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...s.btnSm, color: '#185FA5', borderColor: '#185FA5' }} onClick={() => navigate('/compras/proveedores')}>
            Proveedores
          </button>
          <button style={{ ...s.btnSm, color: '#854F0B', borderColor: '#EF9F27' }} onClick={() => navigate('/compras/recurrentes')}>
            Gastos recurrentes
          </button>
          {puedeCrear && (
            <button style={s.btnPrim} onClick={nuevaOrden}>+ Nueva orden</button>
          )}
        </div>
      </div>

      {/* Métricas */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <MetricaCard label="Total comprado"     valor={fmt(metricas.totalComprado, 'CRC')} />
        <MetricaCard label="Por pagar"          valor={fmt(metricas.porPagar, 'CRC')}    color="#185FA5" />
        <MetricaCard label="Vencido"            valor={fmt(metricas.vencido, 'CRC')}     color="#A32D2D" />
        <MetricaCard label="Gastos este mes"    valor={fmt(metricas.gastosMes, 'CRC')}   color="#854F0B" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 12, border: '0.5px solid rgba(0,0,0,.1)', borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
        {[
          { key: 'ordenes', label: `Órdenes (${filtradas.length})` },
          { key: 'cuentas', label: `Cuentas por pagar (${cuentasPorPagar.length})`, alert: cuentasPorPagar.some(o => o.estadoCalculado === 'Vencida') },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 18px', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
            background: tab === t.key ? 'var(--eco-primary, #1a3a5c)' : '#fff',
            color:      tab === t.key ? '#fff' : '#555',
          }}>
            {t.label}
            {t.alert && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#E24B4A', flexShrink: 0 }} />}
          </button>
        ))}
      </div>

      {/* ── Tab Órdenes ── */}
      {tab === 'ordenes' && (
        <div style={s.card}>
          <div style={s.toolbar}>
            <input style={{ ...s.inp, width: 220 }} placeholder="Buscar proveedor o número..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {ESTADOS_FILTRO.map(e => (
                <button key={e} onClick={() => setFiltroEstado(e)} style={{
                  ...s.btnSm,
                  background:  filtroEstado === e ? 'var(--eco-primary, #1a3a5c)' : '#fff',
                  color:       filtroEstado === e ? '#fff' : '#555',
                  borderColor: filtroEstado === e ? 'transparent' : 'rgba(0,0,0,.15)',
                }}>{e}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {TIPOS_FILTRO.map(t => (
                <button key={t} onClick={() => setFiltroTipo(t)} style={{
                  ...s.btnSm, fontSize: 11,
                  background:  filtroTipo === t ? '#185FA5' : '#fff',
                  color:       filtroTipo === t ? '#fff' : '#555',
                  borderColor: filtroTipo === t ? 'transparent' : 'rgba(0,0,0,.15)',
                }}>{t}</button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>Cargando...</div>
          ) : filtradas.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>
              {ordenes.length === 0
                ? 'No hay órdenes de compra. Creá la primera.'
                : 'Sin resultados para ese filtro.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={s.th}>#</th>
                  <th style={s.th}>Proveedor</th>
                  <th style={s.th}>Tipo</th>
                  <th style={s.th}>Total</th>
                  <th style={s.th}>Estado</th>
                  <th style={s.th}>Vencimiento</th>
                  <th style={s.th}>Fecha</th>
                  <th style={s.th}></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(o => {
                  const est  = o.estadoCalculado
                  const cfg  = ESTADO_CONFIG[est] || ESTADO_CONFIG['Borrador']
                  const tipo = TIPO_CONFIG[o.tipo] || TIPO_CONFIG['gasto']
                  const dias = diasHasta(o.fechaVencimientoPago)
                  const vencida = est === 'Vencida'
                  const proxima = !vencida && (est === 'Crédito pendiente') && dias !== null && dias <= 5

                  return (
                    <tr key={o.id} style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/compras/${o.id}`)}
                      onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      <td style={{ ...s.td, color: '#888', fontSize: 12, fontFamily: 'monospace' }}>{o.numero}</td>
                      <td style={s.td}>
                        <p style={{ fontWeight: 500, margin: 0 }}>{o.proveedorNombre || '—'}</p>
                        {o.descripcion && <p style={{ fontSize: 11, color: '#aaa', margin: '1px 0 0' }}>{o.descripcion}</p>}
                      </td>
                      <td style={s.td}>
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: tipo.bg, color: tipo.color }}>
                          {tipo.label}
                        </span>
                      </td>
                      <td style={{ ...s.td, fontWeight: 600 }}>
                        {fmt(o.total, o.moneda || 'CRC')}
                        {o.moneda === 'USD' && (
                          <p style={{ fontSize: 10, color: '#bbb', margin: '1px 0 0' }}>
                            ₡{Math.round(Number(o.total) * (tasas.compra || 519)).toLocaleString('es-CR')}
                          </p>
                        )}
                      </td>
                      <td style={s.td}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: cfg.bg, color: cfg.color }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot }} />
                          {est}
                        </span>
                      </td>
                      <td style={{ ...s.td, fontSize: 12 }}>
                        {o.fechaVencimientoPago ? (
                          <span style={{ color: vencida ? '#A32D2D' : proxima ? '#854F0B' : '#666', fontWeight: vencida || proxima ? 500 : 400 }}>
                            {fmtFecha(o.fechaVencimientoPago)}
                            {vencida && <span style={{ marginLeft: 5, fontSize: 10, background: '#FCEBEB', color: '#A32D2D', padding: '1px 5px', borderRadius: 4 }}>Vencida</span>}
                            {proxima && <span style={{ marginLeft: 5, fontSize: 10, background: '#FAEEDA', color: '#854F0B', padding: '1px 5px', borderRadius: 4 }}>{dias}d</span>}
                          </span>
                        ) : <span style={{ color: '#ccc' }}>—</span>}
                      </td>
                      <td style={{ ...s.td, fontSize: 12, color: '#888' }}>
                        {o.creadoEn?.toDate ? o.creadoEn.toDate().toLocaleDateString('es-CR') : '—'}
                      </td>
                      <td style={s.td} onClick={e => e.stopPropagation()}>
                        <button style={s.btnSm} onClick={() => navigate(`/compras/${o.id}`)}>Ver</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Tab Cuentas por pagar ── */}
      {tab === 'cuentas' && (
        <div style={s.card}>
          {cuentasPorPagar.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>
              No hay cuentas por pagar pendientes.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={s.th}>Proveedor</th>
                  <th style={s.th}>#</th>
                  <th style={s.th}>Total</th>
                  <th style={s.th}>Pagado</th>
                  <th style={s.th}>Saldo</th>
                  <th style={s.th}>Vencimiento</th>
                  <th style={s.th}>Estado</th>
                  <th style={s.th}></th>
                </tr>
              </thead>
              <tbody>
                {cuentasPorPagar.map(o => {
                  const est    = o.estadoCalculado
                  const cfg    = ESTADO_CONFIG[est] || ESTADO_CONFIG['Crédito pendiente']
                  const saldo  = Number(o.saldo ?? o.total ?? 0)
                  const pagado = Number(o.totalPagado ?? 0)
                  const total  = Number(o.total ?? 0)
                  const pct    = total > 0 ? Math.min(100, Math.round((pagado / total) * 100)) : 0
                  const dias   = diasHasta(o.fechaVencimientoPago)
                  const vencida = est === 'Vencida'
                  const proxima = !vencida && dias !== null && dias <= 5

                  return (
                    <tr key={o.id} style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/compras/${o.id}`)}
                      onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      <td style={s.td}>
                        <p style={{ fontWeight: 500, margin: 0 }}>{o.proveedorNombre || '—'}</p>
                      </td>
                      <td style={{ ...s.td, color: '#888', fontSize: 12, fontFamily: 'monospace' }}>{o.numero}</td>
                      <td style={{ ...s.td, fontWeight: 600 }}>{fmt(total, o.moneda || 'CRC')}</td>
                      <td style={{ ...s.td, color: '#3B6D11' }}>{fmt(pagado, o.moneda || 'CRC')}</td>
                      <td style={{ ...s.td, fontWeight: 700, color: saldo <= 0 ? '#3B6D11' : '#A32D2D' }}>
                        {saldo <= 0 ? '✓ Saldado' : fmt(saldo, o.moneda || 'CRC')}
                      </td>
                      <td style={{ ...s.td, fontSize: 12 }}>
                        <span style={{ color: vencida ? '#A32D2D' : proxima ? '#854F0B' : '#666', fontWeight: vencida || proxima ? 500 : 400 }}>
                          {fmtFecha(o.fechaVencimientoPago)}
                          {vencida && <span style={{ marginLeft: 5, fontSize: 10, background: '#FCEBEB', color: '#A32D2D', padding: '1px 5px', borderRadius: 4 }}>Vencida</span>}
                          {proxima && <span style={{ marginLeft: 5, fontSize: 10, background: '#FAEEDA', color: '#854F0B', padding: '1px 5px', borderRadius: 4 }}>{dias}d</span>}
                        </span>
                      </td>
                      <td style={s.td}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: cfg.bg, color: cfg.color }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot }} />
                          {est}
                        </span>
                      </td>
                      <td style={s.td} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {/* Barra de progreso compacta */}
                          <div style={{ width: 48, height: 4, background: '#f0f0f0', borderRadius: 10, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#639922' : '#EF9F27', borderRadius: 10 }} />
                          </div>
                          <span style={{ fontSize: 10, color: '#aaa' }}>{pct}%</span>
                          <button style={s.btnSm} onClick={() => navigate(`/compras/${o.id}`)}>Abonar</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}