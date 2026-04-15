/**
 * DashboardCards — Tarjetas arrastrables del dashboard
 * Cada sección es una tarjeta independiente que se puede reordenar
 */
import { useState } from 'react'
import UserAvatar from './UserAvatar'

const SECCIONES_DEFAULT = [
  { key: 'actividad',        label: 'Actividad reciente',      activa: true },
  { key: 'por_cobrar',       label: 'Por cobrar',              activa: true },
  { key: 'leads_etapa',      label: 'Leads por etapa',         activa: true },
  { key: 'top_cotizaciones', label: 'Top cotizaciones',        activa: true },
  { key: 'cots_vistas',      label: 'Más vistas por cliente',  activa: true },
  { key: 'top_ventas',       label: 'Top ventas / facturas',   activa: true },
  { key: 'cots_por_vencer',  label: 'Por vencer',              activa: true },
  { key: 'leads_recientes',  label: 'Leads recientes',         activa: true },
  { key: 'productos_top',    label: 'Productos más cotizados', activa: false },
]

const STORAGE_KEY = 'eco-crm-dashboard-secciones'

const loadSecciones = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (saved?.length) {
      const keys = saved.map(s => s.key)
      return [...saved, ...SECCIONES_DEFAULT.filter(s => !keys.includes(s.key))]
    }
  } catch {}
  return SECCIONES_DEFAULT
}

const fmt2 = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const tiempoRelativo = (ts) => {
  if (!ts) return ''
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function SeccionHeader({ label }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>{label}</div>
}

function TablaMini({ headers, rows }) {
  if (!rows?.length) return <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: '#ccc', fontStyle: 'italic' }}>Sin datos</div>
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr>{headers.map(h => <th key={h.k} style={{ textAlign: h.right ? 'right' : 'left', padding: '5px 6px', fontSize: 10, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', borderBottom: '0.5px solid #f0f0f0' }}>{h.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ borderBottom: i < rows.length - 1 ? '0.5px solid #f8f8f8' : 'none' }}>
            {row.map((cell, j) => <td key={j} style={{ padding: '6px', textAlign: headers[j]?.right ? 'right' : 'left' }}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Badge({ estado }) {
  const c = { Borrador: '#5F5E5A', Enviada: '#185FA5', Vista: '#3C3489', Aceptada: '#3B6D11', Rechazada: '#A32D2D', Facturada: '#185FA5' }
  return <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 12, background: (c[estado] || '#888') + '18', color: c[estado] || '#888', fontWeight: 500 }}>{estado || '—'}</span>
}

export default function DashboardCards({ datos, actividad, pipeline, metricas, loading, navigate, usuario }) {
  const esAdmin = usuario?.rol === 'Super Administrador' || usuario?.rol === 'Administrador' || usuario?.rol === 'Supervisor'
  const [secciones, setSecciones] = useState(loadSecciones)
  const [dragSec, setDragSec] = useState(null)
  const [dragOverSec, setDragOverSec] = useState(null)
  const [configOpen, setConfigOpen] = useState(false)

  const m = metricas || {}

  const guardar = (nuevas) => {
    setSecciones(nuevas)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nuevas))
  }

  const handleDrop = (targetKey) => {
    if (!dragSec || dragSec === targetKey) { setDragSec(null); setDragOverSec(null); return }
    const arr = [...secciones]
    const from = arr.findIndex(s => s.key === dragSec)
    const to = arr.findIndex(s => s.key === targetKey)
    const [moved] = arr.splice(from, 1)
    arr.splice(to, 0, moved)
    guardar(arr)
    setDragSec(null); setDragOverSec(null)
  }

  const cardStyle = (key) => ({
    background: '#fff', border: dragOverSec === key ? '2px dashed #185FA5' : '0.5px solid rgba(0,0,0,.08)',
    borderRadius: 10, padding: '14px 16px', opacity: dragSec === key ? 0.5 : 1, transition: 'opacity .15s',
  })

  const dragProps = (key) => ({
    draggable: true,
    onDragStart: () => setDragSec(key),
    onDragEnd: () => { setDragSec(null); setDragOverSec(null) },
    onDragOver: e => { e.preventDefault(); setDragOverSec(key) },
    onDragLeave: () => setDragOverSec(null),
    onDrop: e => { e.preventDefault(); handleDrop(key) },
  })

  const handle = <span style={{ cursor: 'grab', color: '#ccc', fontSize: 12, marginRight: 6 }} title="Arrastrar">⠿</span>

  const renderCard = (sec) => {
    const cs = cardStyle(sec.key)
    const dp = dragProps(sec.key)

    switch (sec.key) {
      case 'actividad':
        return (
          <div key={sec.key} style={cs} {...dp}>
            <SeccionHeader label={<>{handle}Actividad reciente</>} />
            {actividad?.length === 0 && !loading && <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: '#ccc', fontStyle: 'italic' }}>Sin actividad</div>}
            {(actividad || []).map((act, i) => (
              <div key={act.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0', borderBottom: i < actividad.length - 1 ? '0.5px solid #f8f8f8' : 'none' }}>
                <UserAvatar nombre={act.nombre} uid={act.uid} size={26} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5 }}>
                    <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{act.nombre}</span> {act.descripcion} <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{act.entidad}</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#bbb', marginTop: 1 }}>{tiempoRelativo(act.ts)}</div>
                </div>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{act.icono}</span>
              </div>
            ))}
          </div>
        )

      case 'por_cobrar':
        const hoyPC = new Date(); hoyPC.setHours(0,0,0,0)
        const facturasPC = (datos?.porCobrar || [])
          .filter(f => esAdmin || f.vendedorId === usuario?.uid)
          .map(f => {
            const vence = f.fechaVencimiento ? new Date(f.fechaVencimiento + 'T00:00:00') : null
            const dias = vence ? Math.round((vence - hoyPC) / 86400000) : 999
            const monto = f.moneda === 'CRC' ? Number(f.saldo || f.total || 0) / Number(f.tasa || 519.5) : Number(f.saldo || f.total || 0)
            return { ...f, dias, montoUSD: monto }
          }).sort((a, b) => a.dias - b.dias)
        return (
          <div key={sec.key} style={cs} {...dp}>
            <SeccionHeader label={<>{handle}Por cobrar</>} />
            <TablaMini
              headers={[{ k: 'c', label: 'Cliente' }, { k: 's', label: 'Monto', right: true }, { k: 'f', label: 'Días', right: true }]}
              rows={facturasPC.map(f => {
                const vencido = f.dias < 0
                return [
                  <span>{f.clienteNombre || '—'}</span>,
                  <span style={{ fontWeight: 500, color: '#A32D2D' }}>${Number(f.montoUSD).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>,
                  <span style={{ fontWeight: 600, color: vencido ? '#A32D2D' : f.dias <= 7 ? '#854F0B' : '#3B6D11' }}>{vencido ? `${f.dias}d` : `+${f.dias}d`}</span>,
                ]
              })}
            />
          </div>
        )

      case 'leads_etapa':
        return (
          <div key={sec.key} style={cs} {...dp}>
            <SeccionHeader label={<>{handle}Leads por etapa</>} />
            {pipeline?.length === 0 && !loading && <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 12, color: '#ccc', fontStyle: 'italic' }}>Sin leads</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {(pipeline || []).map((p, i) => {
                const col = ['#378ADD', '#1D9E75', '#BA7517', '#D4537E', '#639922', '#534AB7'][i % 6]
                return (
                  <div key={p.etapa} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#888', width: 85, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.etapa}</span>
                    <div style={{ flex: 1, height: 5, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(p.pct, 3)}%`, background: col, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#bbb', width: 20, textAlign: 'right', flexShrink: 0 }}>{p.count}</span>
                  </div>
                )
              })}
              <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                <span style={{ fontSize: 11, color: '#3B6D11', fontWeight: 600 }}>● Ganados: {m.leadsGanados || 0}</span>
                <span style={{ fontSize: 11, color: '#A32D2D', fontWeight: 600 }}>● Perdidos: {m.leadsPerdidos || 0}</span>
              </div>
            </div>
            {m.chatsSinResponder > 0 && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '0.5px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => navigate('/chats')}>
                <span>💬</span><span style={{ fontSize: 12, color: '#0F6E56', fontWeight: 500 }}>{m.chatsSinResponder} chats sin atender</span>
              </div>
            )}
          </div>
        )

      case 'top_cotizaciones':
        return (
          <div key={sec.key} style={cs} {...dp}>
            <SeccionHeader label={<>{handle}Top cotizaciones</>} />
            <TablaMini headers={[{ k: 'c', label: 'Cliente' }, { k: 'v', label: 'Vendedor' }, { k: 't', label: 'Monto', right: true }, { k: 'e', label: 'Estado' }]}
              rows={(datos?.topCots || []).map(c => [<span>{c.clienteNombre || '—'}</span>, <span style={{ color: '#888' }}>{c.vendedorNombre || '—'}</span>, <span style={{ fontWeight: 500 }}>{fmt2(c._total)}</span>, <Badge estado={c.estado} />])} />
          </div>
        )

      case 'cots_vistas':
        return (
          <div key={sec.key} style={cs} {...dp}>
            <SeccionHeader label={<>{handle}Más vistas por clientes</>} />
            <TablaMini headers={[{ k: 'c', label: 'Cliente' }, { k: 'v', label: 'Vendedor' }, { k: 'n', label: 'Vistas', right: true }, { k: 'e', label: 'Estado' }]}
              rows={(datos?.masVistas || []).map(c => [<span>{c.clienteNombre || '—'}</span>, <span style={{ color: '#888' }}>{c.vendedorNombre || '—'}</span>, <span style={{ fontWeight: 500 }}>{c.vecesVisto || 1}</span>, <Badge estado={c.estado} />])} />
          </div>
        )

      case 'top_ventas':
        return (
          <div key={sec.key} style={cs} {...dp}>
            <SeccionHeader label={<>{handle}Top ventas / facturas</>} />
            <TablaMini headers={[{ k: 'c', label: 'Cliente' }, { k: 'v', label: 'Vendedor' }, { k: 't', label: 'Sin IVA', right: true }]}
              rows={(datos?.topFacturas || []).map(f => [<span>{f.clienteNombre || '—'}</span>, <span style={{ color: '#888' }}>{f.vendedorNombre || '—'}</span>, <span style={{ fontWeight: 500 }}>{fmt2(f._base)}</span>])} />
          </div>
        )

      case 'cots_por_vencer':
        return (
          <div key={sec.key} style={cs} {...dp}>
            <SeccionHeader label={<>{handle}Por vencer</>} />
            <TablaMini headers={[{ k: 'c', label: 'Cliente' }, { k: 'v', label: 'Vendedor' }, { k: 'f', label: 'Vence' }]}
              rows={(datos?.porVencer || []).map(c => [<span>{c.clienteNombre || '—'}</span>, <span style={{ color: '#888' }}>{c.vendedorNombre || '—'}</span>, <span style={{ fontSize: 11, color: '#854F0B' }}>{c.fechaVencimiento}</span>])} />
          </div>
        )

      case 'leads_recientes':
        return (
          <div key={sec.key} style={cs} {...dp}>
            <SeccionHeader label={<>{handle}Leads recientes</>} />
            <TablaMini headers={[{ k: 'n', label: 'Lead' }, { k: 'v', label: 'Vendedor' }, { k: 'e', label: 'Estado' }]}
              rows={(datos?.leadsRec || []).map(l => [<span style={{ fontWeight: 500 }}>{l.nombre || '—'}</span>, <span style={{ color: '#888' }}>{l.vendedorNombre || '—'}</span>, <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#f0f0f0', color: '#888' }}>{l.estado || 'Activo'}</span>])} />
          </div>
        )

      case 'productos_top':
        return (
          <div key={sec.key} style={cs} {...dp}>
            <SeccionHeader label={<>{handle}Productos más cotizados</>} />
            <TablaMini headers={[{ k: 'p', label: 'Producto' }, { k: 'c', label: 'Veces cotizado', right: true }]}
              rows={(datos?.topProductos || []).map(p => [<span>{p.nombre}</span>, <span style={{ fontWeight: 500 }}>{p.cant}</span>])} />
          </div>
        )

      default: return null
    }
  }

  return (
    <div>
      {/* Toggle secciones */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8, position: 'relative' }}>
        <button onClick={() => setConfigOpen(o => !o)} style={{ padding: '4px 10px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: configOpen ? '#1a3a5c' : '#fff', color: configOpen ? '#fff' : '#888', fontFamily: 'inherit' }}>⚙ Secciones</button>
        {configOpen && (
          <div style={{ position: 'absolute', right: 0, top: 30, zIndex: 999, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, padding: 8, minWidth: 220, boxShadow: '0 4px 20px rgba(0,0,0,.12)' }}>
            {secciones.map(sec => (
              <div key={sec.key} onClick={() => guardar(secciones.map(s => s.key === sec.key ? { ...s, activa: !s.activa } : s))}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ width: 14, height: 14, borderRadius: 3, border: '1px solid', borderColor: sec.activa ? '#1a3a5c' : '#ddd', background: sec.activa ? '#1a3a5c' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {sec.activa && <svg width="9" height="9" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2" stroke="#fff" strokeWidth="1.5" fill="none" /></svg>}
                </div>
                {sec.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grid de tarjetas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {secciones.filter(s => s.activa).map(sec => renderCard(sec))}
      </div>
    </div>
  )
}
