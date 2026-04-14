/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: InicioPage.jsx
 * Módulo:  Pages — Tablero de ventas
 * ============================================================
 */

import { useState, useEffect, useRef } from 'react'
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import DashboardCards from '../shared/components/DashboardCards'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PistaCarreras from '../shared/components/PistaCarreras'

const ROLES_SUPERIORES = ['Administrador', 'Supervisor', 'admin', 'supervisor', 'Super Administrador']

const PERIODOS = [
  { k: 'mes',       label: 'Este mes' },
  { k: 'trimestre', label: 'Trimestre' },
  { k: 'anio',      label: 'Este año' },
  { k: 'libre',     label: 'Personalizado' },
]

const SECCIONES_DEFAULT = [
  { key: 'top_cotizaciones',   label: 'Top cotizaciones',        activa: true  },
  { key: 'por_cobrar',         label: 'Por cobrar',              activa: true  },
  { key: 'cots_vistas',        label: 'Más vistas por cliente',  activa: true  },
  { key: 'top_ventas',         label: 'Top ventas / facturas',   activa: true  },
  { key: 'cots_por_vencer',    label: 'Por vencer',              activa: true  },
  { key: 'leads_recientes',    label: 'Leads recientes',         activa: false },
  { key: 'productos_top',      label: 'Productos más cotizados', activa: false },
]

const TIPOS_ACTIVIDAD = {
  cotizacion: { bg: '#EAF3DE', color: '#27500A', label: 'Cotización' },
  lead:       { bg: '#E6F1FB', color: '#0C447C', label: 'Lead'       },
  whatsapp:   { bg: '#E1F5EE', color: '#085041', label: 'WhatsApp'   },
  archivo:    { bg: '#F1EFE8', color: '#444441', label: 'Archivo'    },
  factura:    { bg: '#FAEEDA', color: '#633806', label: 'Factura'    },
}

const COLORES_AV = [
  { bg: '#185FA5', color: '#fff' },
  { bg: '#3B6D11', color: '#fff' },
  { bg: '#854F0B', color: '#fff' },
  { bg: '#534AB7', color: '#fff' },
  { bg: '#A32D2D', color: '#fff' },
  { bg: '#0F6E56', color: '#fff' },
]

const saludoHora = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

const rangoPeriodo = (periodo, desde, hasta) => {
  const hoy = new Date()
  let d, h
  if (periodo === 'mes') {
    d = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    h = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59)
  } else if (periodo === 'trimestre') {
    const t = Math.floor(hoy.getMonth() / 3)
    d = new Date(hoy.getFullYear(), t * 3, 1)
    h = new Date(hoy.getFullYear(), t * 3 + 3, 0, 23, 59, 59)
  } else if (periodo === 'anio') {
    d = new Date(hoy.getFullYear(), 0, 1)
    h = new Date(hoy.getFullYear(), 11, 31, 23, 59, 59)
  } else {
    d = desde ? new Date(desde) : new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    h = hasta ? new Date(hasta + 'T23:59:59') : new Date()
  }
  return {
    ts:  { desde: Timestamp.fromDate(d), hasta: Timestamp.fromDate(h) },
    str: { desde: d.toISOString().split('T')[0], hasta: h.toISOString().split('T')[0] },
  }
}

const fmt  = (n) => '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })
const fmt2 = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const baseSinIva = (f) => {
  const base = Number(f.base || 0)
  return base > 0 ? base : Number(f.total || 0) / 1.13
}

const calcTotalCot = (c) => {
  const op = c.opciones?.find(o => o.id === (c.opcionElegida || c.opcionActiva)) || c.opciones?.[0]
  if (!op) return 0
  const sub = (op.productos || []).reduce((a, p) => a + Number(p.precio || 0) * Number(p.cantidad || 1), 0)
  const desc = c.descuentoGlobalTipo === '%' ? sub * (Number(c.descuentoGlobal || 0) / 100) : Number(c.descuentoGlobal || 0)
  return (sub - desc) * 1.13
}

const tiempoRelativo = (ts) => {
  if (!ts) return ''
  const fecha = ts?.toDate ? ts.toDate() : new Date(ts)
  const diff = Math.floor((Date.now() - fecha.getTime()) / 1000)
  if (diff < 60)  return 'hace un momento'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} d`
}

const ESTADO_COLOR = {
  Aceptada:  { bg: '#EAF3DE', color: '#27500A' },
  Enviada:   { bg: '#E6F1FB', color: '#0C447C' },
  Vista:     { bg: '#EEEDFE', color: '#3C3489' },
  Borrador:  { bg: '#F1EFE8', color: '#5F5E5A' },
  Rechazada: { bg: '#FCEBEB', color: '#791F1F' },
}

function Badge({ estado }) {
  const c = ESTADO_COLOR[estado] || ESTADO_COLOR.Borrador
  return (
    <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: c.bg, color: c.color }}>
      {estado}
    </span>
  )
}

function SeccionHeader({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
      <div style={{ width: 3, height: 14, background: 'var(--eco-primary, #1a3a5c)', flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)' }}>{label}</span>
    </div>
  )
}

function TablaCont({ headers, rows }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: 8, border: '0.5px solid var(--color-border-tertiary)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--color-background-secondary)' }}>
            {headers.map(h => (
              <th key={h.k} style={{ padding: '8px 12px', textAlign: h.right ? 'right' : 'left', fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>{h.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={headers.length} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 12, fontStyle: 'italic' }}>Sin datos en este período</td></tr>
          )}
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? 'var(--color-background-primary)' : 'var(--color-background-secondary)', borderBottom: i < rows.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '9px 12px', textAlign: headers[j]?.right ? 'right' : 'left', color: 'var(--color-text-primary)', whiteSpace: headers[j]?.nowrap ? 'nowrap' : 'normal' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AvatarLetras({ nombre, idx }) {
  const seed = (idx !== undefined && idx !== null)
    ? idx
    : (nombre || '?').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const c = COLORES_AV[seed % COLORES_AV.length]
  const iniciales = (nombre || '?').split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
  return (
    <div style={{ width: 30, height: 30, borderRadius: '50%', background: c.bg, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
      {iniciales}
    </div>
  )
}

export default function InicioPage() {
  const navigate  = useNavigate()
  const { usuario } = useAuth()
  const dropRef   = useRef(null)

  const rol        = usuario?.rol || 'Vendedor'
  const esSuperior = ROLES_SUPERIORES.includes(rol)
  const uid        = usuario?.uid
  const nombre     = usuario?.nombre || usuario?.email?.split('@')[0] || 'Usuario'
  const inicialAv  = nombre.charAt(0).toUpperCase()

  const ahora = new Date()
  const [periodo,        setPeriodo]        = useState('mes')
  const [fechaDesde,     setFechaDesde]     = useState('')
  const [fechaHasta,     setFechaHasta]     = useState('')
  const [vendedorFiltro, setVendedorFiltro] = useState('todos')
  const [vendedores,     setVendedores]     = useState([])
  const [secciones,      setSecciones]      = useState(SECCIONES_DEFAULT)
  const [configOpen,     setConfigOpen]     = useState(false)
  const [datos,          setDatos]          = useState(null)
  const [actividad,      setActividad]      = useState([])
  const [pipeline,       setPipeline]       = useState([])
  const [loading,        setLoading]        = useState(true)

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setConfigOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!esSuperior || !uid) return
    getDocs(collection(db, 'usuarios')).then(snap => {
      setVendedores(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.activo !== false && !['Solo lectura', 'Técnico'].includes(u.rol)))
    }).catch(() => {})
  }, [uid])

  useEffect(() => { if (uid) cargar() }, [uid, periodo, fechaDesde, fechaHasta, vendedorFiltro])

  const cargar = async () => {
    if (!uid) return
    setLoading(true)
    const rango = rangoPeriodo(periodo, fechaDesde, fechaHasta)
    const verTodos  = esSuperior && vendedorFiltro === 'todos'
    const uidFiltro = esSuperior && vendedorFiltro !== 'todos' ? vendedorFiltro : uid
    const run = (q) => q ? getDocs(q).catch(() => ({ size: 0, docs: [] })) : Promise.resolve({ size: 0, docs: [] })

    try {
      const filtroVend = verTodos ? [] : [where('vendedorId', '==', uidFiltro)]

      const [leadsActSnap, ganadosSnap, perdidosSnap, cotsPendSnap, chatsSnap, factPendSnap,
             cotsPeriodoSnap, factPeriodoSnap, leadsRecSnap, leadsEtapasSnap] = await Promise.all([
        run(query(collection(db, 'leads'), ...filtroVend, where('estado', 'not-in', ['ganado', 'perdido']))),
        run(query(collection(db, 'leads'), ...filtroVend, where('estado', '==', 'ganado'), where('creadoEn', '>=', rango.ts.desde), where('creadoEn', '<=', rango.ts.hasta))),
        run(query(collection(db, 'leads'), ...filtroVend, where('estado', '==', 'perdido'), where('creadoEn', '>=', rango.ts.desde), where('creadoEn', '<=', rango.ts.hasta))),
        run(query(collection(db, 'cotizaciones'), ...filtroVend, where('estado', 'in', ['Enviada', 'Vista']))),
        run(query(collection(db, 'conversaciones'), ...(verTodos ? [] : [where('agente', '==', uidFiltro)]), where('noLeidos', '>', 0))),
        run(query(collection(db, 'facturas'), ...filtroVend, where('estado', '==', 'Pendiente'))),
        run(query(collection(db, 'cotizaciones'), ...filtroVend, where('creadoEn', '>=', rango.ts.desde), where('creadoEn', '<=', rango.ts.hasta))),
        run(query(collection(db, 'facturas'), ...filtroVend, where('fechaEmision', '>=', rango.str.desde), where('fechaEmision', '<=', rango.str.hasta))),
        run(query(collection(db, 'leads'), ...filtroVend, where('creadoEn', '>=', rango.ts.desde), orderBy('creadoEn', 'desc'))),
        run(query(collection(db, 'leads'), ...filtroVend, where('estado', 'not-in', ['ganado', 'perdido']))),
      ])

      // Métricas
      const cotsAceptadas = cotsPeriodoSnap.docs?.filter(d => d.data().estado === 'Aceptada') || []
      let ventasMes = 0
      cotsAceptadas.forEach(d => {
        const c = d.data()
        const total = calcTotalCot(c)
        ventasMes += c.moneda === 'CRC' ? total / Number(c.tasa || 519.5) : total
      })

      let facturadoSinIva = 0, porCobrarMonto = 0
      factPeriodoSnap.docs?.forEach(d => {
        const f = d.data()
        const base = baseSinIva(f)
        facturadoSinIva += f.moneda === 'CRC' ? base / Number(f.tasa || 519.5) : base
      })
      factPendSnap.docs?.forEach(d => {
        const f = d.data()
        const monto = Number(f.saldo || f.total || 0)
        porCobrarMonto += f.moneda === 'CRC' ? monto / Number(f.tasa || 519.5) : monto
      })

      const cerrados = (ganadosSnap.size || 0) + (perdidosSnap.size || 0)
      const tasaConversion = cerrados > 0 ? Math.round((ganadosSnap.size / cerrados) * 100) : 0

      // Pipeline por etapas
      const etapasCount = {}
      leadsEtapasSnap.docs?.forEach(d => {
        const etapa = d.data().etapa || d.data().estado || 'Sin etapa'
        etapasCount[etapa] = (etapasCount[etapa] || 0) + 1
      })
      const totalPipeline = Object.values(etapasCount).reduce((a, b) => a + b, 0) || 1
      const pipelineArr = Object.entries(etapasCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([etapa, count]) => ({ etapa, count, pct: Math.round((count / totalPipeline) * 100) }))
      setPipeline(pipelineArr)

      // Tablas
      const topCots = (cotsPeriodoSnap.docs || [])
        .map(d => ({ id: d.id, ...d.data(), _total: calcTotalCot(d.data()) }))
        .sort((a, b) => b._total - a._total).slice(0, 7)

      const topFacturas = (factPeriodoSnap.docs || [])
        .map(d => ({ id: d.id, ...d.data(), _base: baseSinIva(d.data()) }))
        .sort((a, b) => b._base - a._base).slice(0, 7)

      const masVistas = (cotsPeriodoSnap.docs || [])
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.vistoPorCliente)
        .sort((a, b) => (b.vecesVisto || 0) - (a.vecesVisto || 0)).slice(0, 7)

      const porCobrar = (factPendSnap.docs || [])
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.fechaVencimiento || '').localeCompare(b.fechaVencimiento || '')).slice(0, 7)

      const hoyStr = new Date().toISOString().split('T')[0]
      const en14   = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
      const porVencer = (cotsPendSnap.docs || [])
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.fechaVencimiento >= hoyStr && c.fechaVencimiento <= en14)
        .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento)).slice(0, 7)

      const leadsRec = (leadsRecSnap.docs || []).slice(0, 7).map(d => ({ id: d.id, ...d.data() }))

      const prodCount = {}
      cotsPeriodoSnap.docs?.forEach(d => {
        const op = d.data().opciones?.[0]
        ;(op?.productos || []).forEach(p => {
          const key = p.nombre || p.productoId || 'Sin nombre'
          prodCount[key] = (prodCount[key] || 0) + Number(p.cantidad || 1)
        })
      })
      const topProductos = Object.entries(prodCount).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([nombre, cant]) => ({ nombre, cant }))

      setDatos({
        metricas: {
          leadsActivos: leadsActSnap.size,
          leadsGanados: ganadosSnap.size,
          leadsPerdidos: perdidosSnap.size,
          tasaConversion,
          ventasMes,
          ventasCount: cotsAceptadas.length,
          cotsPendientes: cotsPendSnap.size,
          chatsSinResponder: chatsSnap.size,
          facturadoSinIva,
          porCobrarCount: factPendSnap.size,
          porCobrarMonto,
        },
        topCots, topFacturas, masVistas, porCobrar, porVencer, leadsRec, topProductos,
      })

      // Actividad reciente — combina leads + cotizaciones recientes
      const acts = []
      ;(leadsRecSnap.docs || []).slice(0, 4).forEach((d, i) => {
        const l = d.data()
        acts.push({
          id: d.id + '_l',
          tipo: 'lead',
          nombre: l.vendedorNombre || 'Agente',
          descripcion: `creó nuevo lead`,
          entidad: l.nombre || 'Sin nombre',
          ts: l.creadoEn,
          idx: i,
        })
      })
      ;(cotsPeriodoSnap.docs || []).slice(0, 4).forEach((d, i) => {
        const c = d.data()
        acts.push({
          id: d.id + '_c',
          tipo: c.estado === 'Aceptada' ? 'cotizacion' : 'cotizacion',
          nombre: c.vendedorNombre || 'Agente',
          descripcion: c.estado === 'Aceptada' ? 'cerró cotización' : 'envió cotización',
          entidad: c.clienteNombre || c.empresaNombre || 'Cliente',
          ts: c.creadoEn,
          idx: i + 4,
        })
      })
      acts.sort((a, b) => {
        const ta = a.ts?.toDate ? a.ts.toDate().getTime() : 0
        const tb = b.ts?.toDate ? b.ts.toDate().getTime() : 0
        return tb - ta
      })
      setActividad(acts.slice(0, 6))

    } catch (e) {
      console.error('Error tablero:', e)
    } finally {
      setLoading(false)
    }
  }

  const m = datos?.metricas || {}
  const secActiva = (key) => secciones.find(s => s.key === key)?.activa

  const TARJETAS = [
    { titulo: 'Leads activos',      valor: m.leadsActivos,    sub: 'en pipeline',               color: '#185FA5', acento: '#185FA5', ruta: '/crm'      },
    { titulo: 'Leads ganados',      valor: m.leadsGanados,    sub: 'en el período',              color: '#3B6D11', acento: '#3B6D11', ruta: '/crm'      },
    { titulo: 'Leads perdidos',     valor: m.leadsPerdidos,   sub: 'en el período',              color: '#A32D2D', acento: '#A32D2D', ruta: '/crm'      },
    { titulo: 'Tasa de conversión', valor: loading ? '—' : `${m.tasaConversion || 0}%`, sub: 'ganados vs cerrados', color: '#534AB7', acento: '#534AB7', ruta: '/crm' },
    { titulo: 'Ventas del período', valor: loading ? '—' : fmt(m.ventasMes),  sub: `${m.ventasCount || 0} cotizaciones aceptadas`, color: '#3B6D11', acento: '#3B6D11', ruta: '/ventas'   },
    { titulo: 'Facturado (sin IVA)',valor: loading ? '—' : fmt(m.facturadoSinIva), sub: 'base imponible (USD)',      color: '#854F0B', acento: '#854F0B', ruta: '/facturas' },
    { titulo: 'Cots. pendientes',   valor: m.cotsPendientes,  sub: 'sin respuesta del cliente',  color: '#854F0B', acento: '#854F0B', ruta: '/ventas'   },
    { titulo: 'Por cobrar',         valor: loading ? '—' : fmt(m.porCobrarMonto), sub: `${m.porCobrarCount || 0} facturas pendientes (USD)`, color: '#A32D2D', acento: '#A32D2D', ruta: '/facturas' },
  ]

  const fechaHoy = ahora.toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' })

  const s = {
    page:  { padding: '20px 28px', minHeight: '100vh', background: 'var(--color-background-tertiary)' },
    card:  { background: '#ffffff', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: '16px 18px' },
    pBtn:  (on) => ({ padding: '4px 11px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '0.5px solid', borderColor: on ? '#1a3a5c' : 'var(--color-border-secondary)', background: on ? '#1a3a5c' : 'transparent', color: on ? '#fff' : 'var(--color-text-secondary)', fontFamily: 'inherit' }),
    grid2: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14 },
  }

  return (
    <div style={s.page}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* ── HEADER ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>

          {/* Saludo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1a3a5c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
              {usuario?.fotoURL
                ? <img src={usuario.fotoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                : inicialAv}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)' }}>{saludoHora()}, {nombre.split(' ')[0]}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 1, textTransform: 'capitalize' }}>{fechaHoy} · Tablero de ventas</div>
            </div>
          </div>

          {/* Controles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>

            {/* Selector vendedor — solo roles superiores */}
            {esSuperior && (
              <select value={vendedorFiltro} onChange={e => setVendedorFiltro(e.target.value)}
                style={{ fontSize: 12, padding: '4px 9px', height: 28, borderRadius: 8, border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', fontFamily: 'inherit', outline: 'none' }}>
                <option value="todos">Todos los vendedores</option>
                {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre || v.email}</option>)}
              </select>
            )}

            {/* Períodos */}
            {PERIODOS.map(p => (
              <button key={p.k} style={s.pBtn(periodo === p.k)} onClick={() => setPeriodo(p.k)}>{p.label}</button>
            ))}

            {/* Fechas libres */}
            {periodo === 'libre' && (
              <>
                <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
                  style={{ fontSize: 12, padding: '3px 8px', height: 28, borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', fontFamily: 'inherit', color: 'var(--color-text-secondary)', outline: 'none' }} />
                <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
                  style={{ fontSize: 12, padding: '3px 8px', height: 28, borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', fontFamily: 'inherit', color: 'var(--color-text-secondary)', outline: 'none' }} />
              </>
            )}

            {/* 3 puntos — configurar secciones */}
            <div ref={dropRef} style={{ position: 'relative' }}>
              <button onClick={() => setConfigOpen(o => !o)}
                style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--color-border-primary)', background: configOpen ? '#1a3a5c' : '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: configOpen ? '#fff' : '#1a3a5c' }} />)}
              </button>

              {configOpen && (
                <div style={{ position: 'absolute', right: 0, top: 32, zIndex: 999, background: '#ffffff', border: '1px solid var(--color-border-secondary)', borderRadius: 10, padding: 8, minWidth: 220, boxShadow: '0 4px 20px rgba(0,0,0,.12)' }}>
                  <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.5px', padding: '2px 8px 8px' }}>Secciones visibles</div>
                  {secciones.map(sec => (
                    <div key={sec.key}
                      onClick={() => setSecciones(prev => prev.map(s => s.key === sec.key ? { ...s, activa: !s.activa } : s))}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, fontSize: 12, color: 'var(--color-text-primary)', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-background-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ width: 14, height: 14, borderRadius: 3, border: '0.5px solid', borderColor: sec.activa ? '#1a3a5c' : 'var(--color-border-secondary)', background: sec.activa ? '#1a3a5c' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {sec.activa && (
                          <svg width="9" height="9" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2" stroke="#fff" strokeWidth="1.5" fill="none" /></svg>
                        )}
                      </div>
                      {sec.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── TARJETAS MÉTRICAS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10, marginBottom: 14 }}>
          {TARJETAS.map(t => (
            <div key={t.titulo}
              onClick={() => navigate(t.ruta)}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,.07)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              style={{ background: '#ffffff', border: '0.5px solid var(--color-border-tertiary)', borderLeft: `3px solid ${t.acento}`, borderRadius: 10, padding: '10px 13px', cursor: 'pointer', transition: 'box-shadow .15s' }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>{t.titulo}</div>
              <div style={{ fontSize: 20, fontWeight: 500, color: t.color, lineHeight: 1.1, marginBottom: 3 }}>{loading ? '—' : (typeof t.valor === 'number' ? t.valor : t.valor)}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{t.sub}</div>
            </div>
          ))}
        </div>

        {/* ── PISTA DE CARRERAS ── */}
        <PistaCarreras
          mes={periodo === 'mes' ? ahora.getMonth()
            : periodo === 'trimestre' ? Math.floor(ahora.getMonth() / 3) * 3
            : 0}
          anio={ahora.getFullYear()}
        />

        {/* ── TARJETAS ARRASTRABLES ── */}
        <DashboardCards datos={datos} actividad={actividad} pipeline={pipeline} metricas={m} loading={loading} navigate={navigate} />

        {/* LEGACY — oculto, reemplazado por DashboardCards */}
        <div style={{ display: 'none' }}>

          {/* Feed actividad */}
          <div style={s.card}>
            <SeccionHeader label="Actividad reciente" />
            {actividad.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>Sin actividad registrada</div>
            )}
            {actividad.map((act, i) => {
              const tipo = TIPOS_ACTIVIDAD[act.tipo] || TIPOS_ACTIVIDAD.lead
              return (
                <div key={act.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 0', borderBottom: i < actividad.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none' }}>
                  <AvatarLetras nombre={act.nombre} idx={act.idx} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                      <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{act.nombre}</span>
                      {' '}{act.descripcion}{' '}
                      <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{act.entidad}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 1 }}>{tiempoRelativo(act.ts)}</div>
                  </div>
                  <span style={{ fontSize: 10, background: tipo.bg, color: tipo.color, padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>{tipo.label}</span>
                </div>
              )
            })}
          </div>

          {/* Pipeline CRM */}
          <div style={s.card}>
            <SeccionHeader label="Pipeline CRM — estado actual" />
            {pipeline.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>Sin leads activos</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {pipeline.map((p, i) => {
                const colores = ['#378ADD', '#1D9E75', '#BA7517', '#D4537E', '#639922', '#534AB7']
                const col = colores[i % colores.length]
                return (
                  <div key={p.etapa} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', width: 90, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.etapa}</span>
                    <div style={{ flex: 1, height: 5, background: 'var(--color-background-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(p.pct, 3)}%`, background: col, borderRadius: 3, transition: 'width .5s ease' }} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', width: 20, textAlign: 'right', flexShrink: 0 }}>{p.count}</span>
                  </div>
                )
              })}
            </div>

            {/* Chats sin atender */}
            {m.chatsSinResponder > 0 && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '0.5px solid var(--color-border-tertiary)' }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Chats sin atender</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate('/chats')}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 500, color: '#0F6E56' }}>{m.chatsSinResponder}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>conversaciones abiertas</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── TABLAS ── */}
        <div style={{ ...s.grid2, marginTop: 14 }}>

          {secActiva('top_cotizaciones') && (
            <div style={s.card}>
              <SeccionHeader label="Top cotizaciones por monto" />
              <TablaCont
                headers={[{ k:'c', label:'Cliente' }, { k:'v', label:'Vendedor' }, { k:'m', label:'Monto', right:true }, { k:'e', label:'Estado' }]}
                rows={(datos?.topCots || []).map(c => [
                  <span style={{ fontSize: 12 }}>{c.clienteNombre || c.empresaNombre || '—'}</span>,
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{c.vendedorNombre || '—'}</span>,
                  <span style={{ fontWeight: 500 }}>{fmt2(c._total)}</span>,
                  <Badge estado={c.estado} />,
                ])}
              />
            </div>
          )}

          {secActiva('por_cobrar') && (
            <div style={s.card}>
              <SeccionHeader label="Por cobrar — facturas pendientes" />
              <TablaCont
                headers={[{ k:'c', label:'Cliente' }, { k:'v', label:'Vendedor' }, { k:'s', label:'Saldo', right:true }, { k:'f', label:'Vence', nowrap:true }]}
                rows={(datos?.porCobrar || []).map(f => {
                  const vence = f.fechaVencimiento || '—'
                  const hoyStr = new Date().toISOString().split('T')[0]
                  const vencido = vence < hoyStr
                  return [
                    <span style={{ fontSize: 12 }}>{f.clienteNombre || '—'}</span>,
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{f.vendedorNombre || '—'}</span>,
                    <span style={{ fontWeight: 500, color: '#A32D2D' }}>{fmt2(f.saldo || f.total || 0)}</span>,
                    <span style={{ fontSize: 11, color: vencido ? '#A32D2D' : 'var(--color-text-tertiary)', fontWeight: vencido ? 500 : 400 }}>{vence}</span>,
                  ]
                })}
              />
            </div>
          )}

          {secActiva('cots_vistas') && (
            <div style={s.card}>
              <SeccionHeader label="Cotizaciones más vistas por clientes" />
              <TablaCont
                headers={[{ k:'c', label:'Cliente' }, { k:'v', label:'Vendedor' }, { k:'n', label:'Vistas', right:true }, { k:'e', label:'Estado' }]}
                rows={(datos?.masVistas || []).map(c => [
                  <span style={{ fontSize: 12 }}>{c.clienteNombre || '—'}</span>,
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{c.vendedorNombre || '—'}</span>,
                  <span style={{ fontWeight: 500 }}>{c.vecesVisto || 1}</span>,
                  <Badge estado={c.estado} />,
                ])}
              />
            </div>
          )}

          {secActiva('top_ventas') && (
            <div style={s.card}>
              <SeccionHeader label="Top ventas / facturas por monto (sin IVA)" />
              <TablaCont
                headers={[{ k:'c', label:'Cliente' }, { k:'v', label:'Vendedor' }, { k:'t', label:'Sin IVA', right:true }]}
                rows={(datos?.topFacturas || []).map(f => [
                  <span style={{ fontSize: 12 }}>{f.clienteNombre || '—'}</span>,
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{f.vendedorNombre || '—'}</span>,
                  <span style={{ fontWeight: 500 }}>{fmt2(f._base)}</span>,
                ])}
              />
            </div>
          )}

          {secActiva('cots_por_vencer') && (
            <div style={s.card}>
              <SeccionHeader label="Cotizaciones por vencer (próximos 14 días)" />
              <TablaCont
                headers={[{ k:'c', label:'Cliente' }, { k:'v', label:'Vendedor' }, { k:'m', label:'Monto', right:true }, { k:'f', label:'Vence', nowrap:true }]}
                rows={(datos?.porVencer || []).map(c => [
                  <span style={{ fontSize: 12 }}>{c.clienteNombre || '—'}</span>,
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{c.vendedorNombre || '—'}</span>,
                  <span style={{ fontWeight: 500 }}>{fmt2(calcTotalCot(c))}</span>,
                  <span style={{ fontSize: 11, color: '#854F0B', fontWeight: 500 }}>{c.fechaVencimiento}</span>,
                ])}
              />
            </div>
          )}

          {secActiva('leads_recientes') && (
            <div style={s.card}>
              <SeccionHeader label="Leads recientes" />
              <TablaCont
                headers={[{ k:'n', label:'Lead' }, { k:'v', label:'Vendedor' }, { k:'e', label:'Estado' }]}
                rows={(datos?.leadsRec || []).map(l => [
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{l.nombre || '—'}</span>,
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{l.vendedorNombre || '—'}</span>,
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' }}>{l.estado || 'Activo'}</span>,
                ])}
              />
            </div>
          )}

          {secActiva('productos_top') && (
            <div style={s.card}>
              <SeccionHeader label="Productos más cotizados" />
              <TablaCont
                headers={[{ k:'p', label:'Producto' }, { k:'c', label:'Veces cotizado', right:true }]}
                rows={(datos?.topProductos || []).map(p => [
                  <span style={{ fontSize: 12 }}>{p.nombre}</span>,
                  <span style={{ fontWeight: 500 }}>{p.cant}</span>,
                ])}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  )
}