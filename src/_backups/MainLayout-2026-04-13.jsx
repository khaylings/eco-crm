/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: MainLayout.jsx
 * Módulo:  Shared
 * ============================================================
 */

import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useState, useRef, useEffect, useCallback } from 'react'
import {
  collection, query, where, onSnapshot,
  orderBy, updateDoc, doc, writeBatch, getDocs, getDoc, setDoc, serverTimestamp
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAlertasVencimiento } from '../../hooks/useAlertasVencimiento'
import { usePermisos } from '../../hooks/usePermisos'
import BotAyuda from './BotAyuda'
import ChatWidget from './ChatWidget'

// ── Cambio 1: agregar Email al nav horizontal ─────────────────────────────────
const NAV_ITEMS_BASE = [
  { path: '/',        label: 'Inicio', end: true },
  { path: '/crm',     label: 'CRM' },
  { path: '/chats',   label: 'Chats WA' },
  { path: '/email',   label: '📧 Correo' },          // ← NUEVO
  {
    label: 'Clientes', grupo: true,
    items: [
      { path: '/contactos', label: 'Contactos' },
      { path: '/activos',   label: 'Activos' },
    ]
  },
  {
    label: 'Comercial', grupo: true,
    items: [
      { path: '/ventas',     label: 'Cotizaciones' },
      { path: '/proyectos',  label: 'Proyectos' },
      { path: '/inventario', label: 'Inventario' },
    ]
  },
  { path: '/ordenes-trabajo', label: 'Ord. Trabajo' },
  { path: '/calendario',      label: 'Calendario' },
  { path: '/configuracion',   label: 'Configuración' },
]

// ── Cambio 2: agregar Email al grid de módulos ────────────────────────────────
const MODULOS_GRID_BASE = [
  { path: '/',                label: 'Inicio',        icono: '🏠', color: '#185FA5', bg: '#E6F1FB' },
  { path: '/crm',             label: 'CRM',           icono: '🎯', color: '#534AB7', bg: '#EEEDFE' },
  { path: '/chats',           label: 'Chats WA',      icono: '💬', color: '#0F6E56', bg: '#E1F5EE' },
  { path: '/email',           label: 'Correo',        icono: '📧', color: '#185FA5', bg: '#E6F1FB' }, // ← NUEVO
  { path: '/contactos',       label: 'Contactos & Empresas', icono: '👤', color: '#185FA5', bg: '#E6F1FB' },
  { path: '/activos',         label: 'Activos',       icono: '❄️', color: '#0F6E56', bg: '#E1F5EE' },
  { path: '/ventas',          label: 'Cotizaciones',  icono: '📄', color: '#3B6D11', bg: '#EAF3DE' },
  { path: '/proyectos',       label: 'Proyectos',     icono: '📁', color: '#2e7d32', bg: '#e8f5e9' },
  { path: '/inventario',      label: 'Inventario',    icono: '📦', color: '#534AB7', bg: '#EEEDFE' },
  { path: '/facturacion',     label: 'Facturación',   icono: '🧾', color: '#3B6D11', bg: '#EAF3DE' },
  { path: '/bancos',          label: 'Bancos',        icono: '🏦', color: '#185FA5', bg: '#E6F1FB' },
  { path: '/ordenes-trabajo', label: 'Ord. Trabajo',  icono: '🔧', color: '#5F5E5A', bg: '#F1EFE8' },
  { path: '/calendario',      label: 'Calendario',    icono: '📅', color: '#993C1D', bg: '#FAECE7' },
  { path: '/configuracion',   label: 'Configuración', icono: '⚙️', color: '#5F5E5A', bg: '#F1EFE8' },
]

const MODULO_FINANZAS = {
  path: '/finanzas', label: 'Finanzas', icono: '💰', color: '#0F6E56', bg: '#E1F5EE',
}

const NOTIF_CONFIG = {
  pago_pendiente:    { icono: '💰', color: '#854F0B', bg: '#FAEEDA', label: 'Pago pendiente' },
  pago_aprobado:     { icono: '✅', color: '#3B6D11', bg: '#EAF3DE', label: 'Pago aprobado' },
  pago_rechazado:    { icono: '❌', color: '#A32D2D', bg: '#FCEBEB', label: 'Pago rechazado' },
  factura_vencida:   { icono: '⏰', color: '#A32D2D', bg: '#FCEBEB', label: 'Factura vencida' },
  factura_proxima:   { icono: '⚠️', color: '#854F0B', bg: '#FAEEDA', label: 'Vence pronto' },
  tasa_recordatorio: { icono: '💱', color: '#185FA5', bg: '#E6F1FB', label: 'Tasa del dólar' },
  mensaje_interno:   { icono: '💬', color: '#185FA5', bg: '#E6F1FB', label: 'Mensaje interno' },
  general:           { icono: '🔔', color: '#534AB7', bg: '#EEEDFE', label: 'Notificación' },
}

const tiempoRelativo = (ts) => {
  if (!ts) return ''
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1)  return 'ahora'
  if (min < 60) return `hace ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24)   return `hace ${h}h`
  return `hace ${Math.floor(h / 24)}d`
}

function WidgetTasas({ puedeEditar }) {
  const [tasas,     setTasas]     = useState({ compra: 0, venta: 0, fecha: '' })
  const [editando,  setEditando]  = useState(false)
  const [form,      setForm]      = useState({ compra: '', venta: '' })
  const [guardando, setGuardando] = useState(false)
  const widgetRef = useRef()

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'configuracion', 'tasas'), snap => {
      if (snap.exists()) setTasas(snap.data())
    })
    return unsub
  }, [])

  useEffect(() => {
    const handleClick = (e) => {
      if (widgetRef.current && !widgetRef.current.contains(e.target)) setEditando(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const abrirEditor = () => {
    if (!puedeEditar) return
    setForm({ compra: tasas.compra || '', venta: tasas.venta || '' })
    setEditando(true)
  }

  const guardar = async () => {
    if (!form.compra || !form.venta) return
    setGuardando(true)
    try {
      const hoy = new Date().toISOString().split('T')[0]
      await setDoc(doc(db, 'configuracion', 'tasas'), {
        compra:         Number(form.compra),
        venta:          Number(form.venta),
        fecha:          hoy,
        actualizadoPor: 'usuario',
        actualizadoEn:  serverTimestamp(),
      })
      setEditando(false)
    } catch (e) { console.error(e) }
    finally { setGuardando(false) }
  }

  const sinTasa = !tasas.compra && !tasas.venta
  const hoy     = new Date().toISOString().split('T')[0]
  const esHoy   = tasas.fecha === hoy
  const color   = sinTasa ? 'rgba(255,255,255,.5)' : esHoy ? '#fff' : '#FAC775'

  return (
    <div ref={widgetRef} style={{ position: 'relative' }}>
      <button
        onClick={abrirEditor}
        title={puedeEditar ? 'Click para actualizar tasas' : 'Tasa del dólar'}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)',
          borderRadius: 7, padding: '4px 10px', cursor: puedeEditar ? 'pointer' : 'default',
          color: '#fff', height: 30,
        }}
      >
        <span style={{ fontSize: 13 }}>💱</span>
        {sinTasa ? (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.6)' }}>Sin tasa</span>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: '.3px' }}>Compra</span>
              <span style={{ fontSize: 12, fontWeight: 600, color }}>{tasas.compra ? `₡${Number(tasas.compra).toLocaleString('es-CR')}` : '—'}</span>
            </div>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,.2)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: '.3px' }}>Venta</span>
              <span style={{ fontSize: 12, fontWeight: 600, color }}>{tasas.venta ? `₡${Number(tasas.venta).toLocaleString('es-CR')}` : '—'}</span>
            </div>
          </div>
        )}
        {!esHoy && !sinTasa && (
          <span style={{ fontSize: 9, background: '#FAC775', color: '#412402', padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>
            {tasas.fecha || 'antigua'}
          </span>
        )}
      </button>

      {editando && puedeEditar && (
        <div style={{
          position: 'absolute', top: 38, right: 0, zIndex: 9999,
          background: '#fff', borderRadius: 10, padding: 16, minWidth: 240,
          boxShadow: '0 8px 32px rgba(0,0,0,.2)', border: '0.5px solid rgba(0,0,0,.1)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>Tasa del dólar hoy</div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 12 }}>
            {new Date().toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }}>Compra ₡</label>
              <input type="number" step="0.01" placeholder="Ej: 510.00" value={form.compra} onChange={e => setForm(f => ({ ...f, compra: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid rgba(0,0,0,.2)', borderRadius: 7, fontSize: 14, fontWeight: 600, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: '#185FA5' }} autoFocus />
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 3 }}>Lo que pagás por $1</div>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }}>Venta ₡</label>
              <input type="number" step="0.01" placeholder="Ej: 520.00" value={form.venta} onChange={e => setForm(f => ({ ...f, venta: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid rgba(0,0,0,.2)', borderRadius: 7, fontSize: 14, fontWeight: 600, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: '#3B6D11' }} />
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 3 }}>Lo que cobrás por $1</div>
            </div>
          </div>
          <div style={{ padding: '8px 10px', background: '#f8f9fb', borderRadius: 7, fontSize: 11, color: '#666', marginBottom: 12 }}>
            💡 <strong>Compra</strong> para órdenes de compra · <strong>Venta</strong> para cotizaciones en CRC
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEditando(false)} style={{ flex: 1, padding: '8px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 12, cursor: 'pointer', background: '#f5f5f5', fontFamily: 'inherit' }}>Cancelar</button>
            <button onClick={guardar} disabled={guardando || !form.compra || !form.venta} style={{ flex: 2, padding: '8px', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: guardando ? 'not-allowed' : 'pointer', background: !form.compra || !form.venta ? '#e0e0e0' : 'var(--eco-primary, #1a3a5c)', color: !form.compra || !form.venta ? '#aaa' : '#fff', fontFamily: 'inherit' }}>
              {guardando ? 'Guardando...' : '✓ Actualizar tasa'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function PanelNotificaciones({ notifs, onMarcarLeida, onMarcarTodasLeidas, onNavegar, onCerrar }) {
  const noLeidas = notifs.filter(n => !n.leida).length
  return (
    <div style={{ position: 'absolute', top: 42, right: 0, width: 380, maxHeight: 520, background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,.18)', border: '0.5px solid rgba(0,0,0,.1)', zIndex: 9999, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: '0.5px solid rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>Notificaciones</span>
          {noLeidas > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: '#E24B4A', color: '#fff', borderRadius: 10, padding: '1px 7px' }}>{noLeidas}</span>}
        </div>
        {noLeidas > 0 && <button onClick={onMarcarTodasLeidas} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#185FA5', fontFamily: 'inherit' }}>Marcar todas como leídas</button>}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {notifs.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#bbb', fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🔔</div>Sin notificaciones
          </div>
        ) : notifs.map(n => {
          const cfg = NOTIF_CONFIG[n.tipo] || NOTIF_CONFIG.general
          return (
            <div key={n.id} onClick={() => { onMarcarLeida(n.id); if (n.link) onNavegar(n.link); onCerrar() }}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', cursor: n.link ? 'pointer' : 'default', borderBottom: '0.5px solid rgba(0,0,0,.05)', background: n.leida ? '#fff' : '#fafbff' }}
              onMouseEnter={e => { if (n.link) e.currentTarget.style.background = '#f5f7fa' }}
              onMouseLeave={e => e.currentTarget.style.background = n.leida ? '#fff' : '#fafbff'}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{cfg.icono}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <p style={{ fontSize: 12, fontWeight: n.leida ? 400 : 600, color: '#1a1a1a', margin: 0, lineHeight: 1.4 }}>{n.titulo}</p>
                  <span style={{ fontSize: 10, color: '#bbb', whiteSpace: 'nowrap', flexShrink: 0 }}>{tiempoRelativo(n.creadoEn)}</span>
                </div>
                {n.cuerpo && <p style={{ fontSize: 11, color: '#888', margin: '3px 0 0', lineHeight: 1.4 }}>{n.cuerpo}</p>}
                <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10, padding: '1px 6px', borderRadius: 6, background: cfg.bg, color: cfg.color, fontWeight: 500 }}>{cfg.label}</span>
              </div>
              {!n.leida && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#E24B4A', flexShrink: 0, marginTop: 4 }} />}
            </div>
          )
        })}
      </div>
      {notifs.length > 0 && (
        <div style={{ padding: '10px 16px', borderTop: '0.5px solid rgba(0,0,0,.06)', flexShrink: 0, textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: '#bbb' }}>Últimas {notifs.length} notificaciones</span>
        </div>
      )}
    </div>
  )
}

function ModalAprobacion({ notif, onAprobar, onRechazar, onCerrar }) {
  const [motivo,    setMotivo]    = useState('')
  const [monto,     setMonto]     = useState(notif.pago?.monto || '')
  const [procesando, setProcesando] = useState(false)
  const handleAprobar  = async () => { setProcesando(true); await onAprobar({ ...notif.pago, monto: Number(monto) }); setProcesando(false) }
  const handleRechazar = async () => { if (!motivo.trim()) return; setProcesando(true); await onRechazar(motivo); setProcesando(false) }
  const mon  = notif.pago?.moneda || 'USD'
  const symb = mon === 'USD' ? '$' : '₡'
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: '#fff', borderRadius: 14, width: '95%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Aprobar pago</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{notif.titulo}</div>
          </div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa' }}>×</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#f8f9fb', borderRadius: 10, padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[['Vendedor', notif.pago?.registradoPor], ['Método', notif.pago?.metodo], ['Fecha', notif.pago?.fecha], ['Referencia', notif.pago?.referencia]].map(([lbl, val]) => (
              <div key={lbl}>
                <p style={{ fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 2px' }}>{lbl}</p>
                <p style={{ fontSize: 12, fontWeight: 500, margin: 0 }}>{val || '—'}</p>
              </div>
            ))}
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4, display: 'block' }}>Monto a aprobar ({mon})</label>
            <input type="number" step="0.01" min="0" value={monto} onChange={e => setMonto(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '0.5px solid rgba(0,0,0,.18)', borderRadius: 7, fontSize: 18, fontWeight: 700, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4, display: 'block' }}>Motivo de rechazo (requerido para rechazar)</label>
            <textarea rows={2} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej: El comprobante no coincide..." style={{ width: '100%', padding: '8px 11px', border: '0.5px solid rgba(0,0,0,.18)', borderRadius: 7, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(0,0,0,.08)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCerrar} style={{ padding: '8px 14px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: '#f5f5f5', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={handleRechazar} disabled={procesando || !motivo.trim()} style={{ padding: '8px 16px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: procesando || !motivo.trim() ? 'not-allowed' : 'pointer', background: procesando || !motivo.trim() ? '#f0f0f0' : '#FCEBEB', color: procesando || !motivo.trim() ? '#bbb' : '#A32D2D', fontFamily: 'inherit' }}>Rechazar</button>
          <button onClick={handleAprobar} disabled={procesando || !monto} style={{ padding: '8px 20px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: procesando || !monto ? 'not-allowed' : 'pointer', background: procesando || !monto ? '#e0e0e0' : '#EAF3DE', color: procesando || !monto ? '#aaa' : '#3B6D11', fontFamily: 'inherit' }}>
            {procesando ? 'Procesando...' : `Aprobar ${symb}${Number(monto || 0).toLocaleString()}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function GrupoNav({ item, isActive, onNavigate }) {
  const [hover,   setHover]   = useState(false)
  const [dropPos, setDropPos] = useState({ left: 0, top: 52 })
  const btnRef     = useRef()
  const timeoutRef = useRef()
  const activo = item.basePath ? isActive(item.basePath) : item.items.some(i => isActive(i.path))
  const mostrar = () => { clearTimeout(timeoutRef.current); if (btnRef.current) { const rect = btnRef.current.getBoundingClientRect(); setDropPos({ left: rect.left, top: rect.bottom }) } setHover(true) }
  const ocultar = () => { timeoutRef.current = setTimeout(() => setHover(false), 120) }
  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }} onMouseEnter={mostrar} onMouseLeave={ocultar}>
      <button ref={btnRef} style={{ height: '100%', padding: '0 14px', background: activo || hover ? 'rgba(255,255,255,.18)' : 'transparent', borderBottom: activo || hover ? '2px solid #fff' : '2px solid transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', color: activo || hover ? '#fff' : 'rgba(255,255,255,.75)', fontSize: 12, fontWeight: activo ? 500 : 400, cursor: 'default', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
        {item.label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: .7, transition: 'transform .2s', transform: hover ? 'rotate(180deg)' : 'rotate(0deg)' }}><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {hover && (
        <div onMouseEnter={mostrar} onMouseLeave={ocultar} style={{ position: 'fixed', left: dropPos.left, top: dropPos.top, zIndex: 9999, background: '#fff', borderRadius: '0 0 10px 10px', minWidth: 190, boxShadow: '0 8px 24px rgba(0,0,0,.15)', border: '0.5px solid rgba(0,0,0,.08)', overflow: 'hidden' }}>
          {item.items.map(sub => {
            const subActivo = isActive(sub.path)
            return (
              <button key={sub.navTo || sub.path} onClick={() => { onNavigate(sub.navTo || sub.path); setHover(false) }}
                style={{ width: '100%', padding: '10px 16px', border: 'none', borderBottom: '0.5px solid #f0f0f0', background: subActivo ? '#EEF3FA' : '#fff', color: subActivo ? '#1a3a5c' : '#1a1a1a', fontSize: 13, fontWeight: subActivo ? 600 : 400, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}
                onMouseEnter={e => { if (!subActivo) e.currentTarget.style.background = '#f5f7fa' }}
                onMouseLeave={e => { if (!subActivo) e.currentTarget.style.background = '#fff' }}>
                {subActivo && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#1a3a5c', flexShrink: 0 }} />}
                {sub.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MenuGrid({ onClose, onNavigate, modulosGrid }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'var(--eco-bg, #f4f6f4)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 52 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--eco-muted, #888)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 32 }}>Módulos del sistema</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 140px)', gap: 14 }}>
        {modulosGrid.map(mod => (
          <button key={mod.path} onClick={() => { onNavigate(mod.path); onClose() }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '24px 12px', background: '#fff', border: '0.5px solid var(--eco-border, #d0d8d0)', borderRadius: 16, cursor: 'pointer', transition: 'transform .15s, background .15s' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.background = 'var(--eco-primary-light, #e8f0f7)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = '#fff' }}>
            <span style={{ fontSize: 32 }}>{mod.icono}</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--eco-text, #1a1a1a)', textAlign: 'center', lineHeight: 1.3 }}>{mod.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Hook de sonido con Web Audio API ──────────────────────────────────────────
function useSonidoNotificacion() {
  const audioCtxRef = useRef(null)

  const tocar = async () => {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') await ctx.resume()
      if (ctx.state !== 'running') return
      const ahora = ctx.currentTime
      const notas = [
        { t: 0,    freq: 587.33, vol: 0.35 },
        { t: 0.11, freq: 739.99, vol: 0.30 },
        { t: 0.22, freq: 987.77, vol: 0.25 },
      ]
      notas.forEach(({ t, freq, vol }) => {
        const osc  = ctx.createOscillator(); const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.type = 'sine'; osc.frequency.setValueAtTime(freq, ahora + t)
        gain.gain.setValueAtTime(0.001, ahora + t)
        gain.gain.exponentialRampToValueAtTime(vol, ahora + t + 0.015)
        gain.gain.setValueAtTime(vol, ahora + t + 0.04)
        gain.gain.exponentialRampToValueAtTime(0.001, ahora + t + 0.18)
        osc.start(ahora + t); osc.stop(ahora + t + 0.2)
        const osc2  = ctx.createOscillator(); const gain2 = ctx.createGain()
        osc2.connect(gain2); gain2.connect(ctx.destination)
        osc2.type = 'triangle'; osc2.frequency.setValueAtTime(freq * 2, ahora + t)
        gain2.gain.setValueAtTime(0.001, ahora + t)
        gain2.gain.exponentialRampToValueAtTime(vol * 0.15, ahora + t + 0.015)
        gain2.gain.exponentialRampToValueAtTime(0.001, ahora + t + 0.12)
        osc2.start(ahora + t); osc2.stop(ahora + t + 0.15)
      })
    } catch(e) { console.warn('Audio error:', e) }
  }

  useEffect(() => {
    const unlock = async () => {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume()
    }
    document.addEventListener('click', unlock)
    document.addEventListener('keydown', unlock)
    return () => { document.removeEventListener('click', unlock); document.removeEventListener('keydown', unlock) }
  }, [])

  return useCallback(tocar, [])
}

export default function MainLayout() {
  const { usuario, cerrarSesion } = useAuth()
  const { esAdmin }               = usePermisos()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [menuOpen,  setMenuOpen]  = useState(false)
  const [gridOpen,  setGridOpen]  = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [botOpen,   setBotOpen]   = useState(false)
  const [notifs,    setNotifs]    = useState([])
  const [modalAprobacion, setModalAprobacion] = useState(null)
  const menuRef  = useRef()
  const notifRef = useRef()

  const reproducirSonido = useSonidoNotificacion()
  const prevNotifsRef    = useRef(null)

  const puedeEditarTasa = usuario?.rol === 'Super Administrador' || usuario?.rol === 'Administrador' || usuario?.rol === 'Supervisor'

  // ── Presencia: rastrear actividad del usuario ──
  const [activo, setActivo] = useState(true)
  const ultimaActividadRef = useRef(Date.now())

  useEffect(() => {
    if (!usuario?.uid) return
    const INTERVALO_UPDATE = 2 * 60 * 1000   // Actualizar Firestore cada 2 min
    const INACTIVO_MS      = 30 * 60 * 1000  // 30 min → inactivo
    const LOGOUT_MS        = 60 * 60 * 1000  // 1 hora → cerrar sesión

    const marcarActivo = () => { ultimaActividadRef.current = Date.now(); setActivo(true) }
    const eventos = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove']
    eventos.forEach(ev => window.addEventListener(ev, marcarActivo, { passive: true }))

    // Actualizar Firestore periódicamente
    const updateFirestore = () => {
      updateDoc(doc(db, 'usuarios', usuario.uid), { ultimaActividad: serverTimestamp(), activo: true }).catch(() => {})
    }
    updateFirestore()
    const intervalFS = setInterval(() => {
      if (Date.now() - ultimaActividadRef.current < INACTIVO_MS) updateFirestore()
    }, INTERVALO_UPDATE)

    // Chequear inactividad
    const intervalCheck = setInterval(() => {
      const diff = Date.now() - ultimaActividadRef.current
      if (diff >= LOGOUT_MS) {
        updateDoc(doc(db, 'usuarios', usuario.uid), { activo: false }).catch(() => {})
        cerrarSesion()
        navigate('/login')
      } else if (diff >= INACTIVO_MS) {
        setActivo(false)
        updateDoc(doc(db, 'usuarios', usuario.uid), { activo: false }).catch(() => {})
      }
    }, 30000)

    // Al cerrar pestaña
    const onUnload = () => {
      navigator.sendBeacon && updateDoc(doc(db, 'usuarios', usuario.uid), { activo: false }).catch(() => {})
    }
    window.addEventListener('beforeunload', onUnload)

    return () => {
      eventos.forEach(ev => window.removeEventListener(ev, marcarActivo))
      clearInterval(intervalFS)
      clearInterval(intervalCheck)
      window.removeEventListener('beforeunload', onUnload)
      updateDoc(doc(db, 'usuarios', usuario.uid), { activo: false }).catch(() => {})
    }
  }, [usuario?.uid])

  // ── Finanzas como dropdown antes de Configuración ────────────────────────────
  const FINANZAS_GRUPO = {
    label: '💰 Finanzas', grupo: true, basePath: '/finanzas',
    items: [
      { path: '/finanzas', navTo: '/finanzas?tab=flujo',             label: 'Flujo de Caja' },
      { path: '/finanzas', navTo: '/finanzas?tab=cxc',              label: 'Cuentas por Cobrar' },
      { path: '/finanzas', navTo: '/finanzas?tab=cxp',              label: 'Cuentas por Pagar' },
      { path: '/finanzas', navTo: '/finanzas?tab=deudas',           label: 'Deudas' },
      { path: '/finanzas', navTo: '/finanzas?tab=estado_resultados', label: 'Estado de Resultados' },
      { path: '/finanzas', navTo: '/finanzas?tab=balance',           label: 'Balance General' },
      { path: '/bancos',                                             label: 'Bancos' },
      { path: '/compras/recurrentes',                                label: 'Gastos Recurrentes' },
      { path: '/compras',                                            label: 'Compras' },
    ]
  }

  const navItems = esAdmin
    ? [...NAV_ITEMS_BASE.slice(0, -1), FINANZAS_GRUPO, NAV_ITEMS_BASE[NAV_ITEMS_BASE.length - 1]]
    : NAV_ITEMS_BASE

  const modulosGrid = esAdmin
    ? [...MODULOS_GRID_BASE.slice(0, -1), MODULO_FINANZAS, MODULOS_GRID_BASE[MODULOS_GRID_BASE.length - 1]]
    : MODULOS_GRID_BASE

  const isActive = (path, end) => {
    if (!path) return false
    if (end) return location.pathname === path
    return location.pathname.startsWith(path)
  }

  useEffect(() => {
    if (!usuario?.uid) return
    const q = query(collection(db, 'notificaciones'), where('destinatarioId', '==', usuario.uid), orderBy('creadoEn', 'desc'))
    const unsub = onSnapshot(q, snap => {
      const nuevas = snap.docs.map(d => ({ id: d.id, ...d.data() })).slice(0, 50)
      const idsNuevas = new Set(nuevas.map(n => n.id))
      if (prevNotifsRef.current === null) {
        prevNotifsRef.current = idsNuevas
      } else {
        const hayNuevas = nuevas.some(n => !prevNotifsRef.current.has(n.id) && !n.leida)
        if (hayNuevas) reproducirSonido()
        prevNotifsRef.current = idsNuevas
      }
      setNotifs(nuevas)
    })
    return unsub
  }, [usuario?.uid])

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current  && !menuRef.current.contains(e.target))  setMenuOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => { setGridOpen(false) }, [location.pathname])

  const marcarLeida = useCallback(async (notifId) => {
    await updateDoc(doc(db, 'notificaciones', notifId), { leida: true })
  }, [])

  const marcarTodasLeidas = useCallback(async () => {
    const noLeidas = notifs.filter(n => !n.leida)
    if (noLeidas.length === 0) return
    const batch = writeBatch(db)
    noLeidas.forEach(n => batch.update(doc(db, 'notificaciones', n.id), { leida: true }))
    await batch.commit()
  }, [notifs])

  const aprobarPago = useCallback(async (pagoAprobado) => {
    const notif = modalAprobacion
    if (!notif?.facturaId) return
    try {
      const facturaRef = doc(db, 'facturas', notif.facturaId)
      const { getDoc: gd } = await import('firebase/firestore')
      const factSnap = await gd(facturaRef)
      if (!factSnap.exists()) return
      const factura = factSnap.data()
      const nuevosPagos = [...(factura.pagos || []), { ...pagoAprobado, aprobado: true, aprobadoPor: usuario?.nombre, aprobadoEn: new Date().toISOString() }]
      const totalPagado = nuevosPagos.reduce((acc, p) => acc + Number(p.monto), 0)
      const saldo  = Math.max(0, Number(factura.total) - totalPagado)
      const estado = saldo <= 0 ? 'Pagada' : totalPagado > 0 ? 'Parcial' : 'Sin Pagar'
      const { serverTimestamp: st } = await import('firebase/firestore')
      await updateDoc(facturaRef, { pagos: nuevosPagos, totalPagado, saldo, estado, actualizadoEn: st() })
      await updateDoc(doc(db, 'notificaciones', notif.id), { leida: true, procesada: true, resultado: 'aprobado' })
      const { addDoc, collection: col, serverTimestamp: st2 } = await import('firebase/firestore')
      await addDoc(col(db, 'notificaciones'), { destinatarioId: notif.vendedorId, tipo: 'pago_aprobado', titulo: `Pago aprobado — ${notif.facturaNumero || ''}`, cuerpo: `Tu pago de $${Number(pagoAprobado.monto).toLocaleString()} fue aprobado.`, link: `/facturacion/${notif.facturaId}`, leida: false, creadoEn: st2() })
      setModalAprobacion(null)
    } catch (e) { console.error('Error aprobando pago:', e) }
  }, [modalAprobacion, usuario])

  const rechazarPago = useCallback(async (motivo) => {
    const notif = modalAprobacion
    if (!notif) return
    try {
      await updateDoc(doc(db, 'notificaciones', notif.id), { leida: true, procesada: true, resultado: 'rechazado', motivoRechazo: motivo })
      const { addDoc, collection: col, serverTimestamp: st } = await import('firebase/firestore')
      await addDoc(col(db, 'notificaciones'), { destinatarioId: notif.vendedorId, tipo: 'pago_rechazado', titulo: `Pago rechazado — ${notif.facturaNumero || ''}`, cuerpo: `Motivo: ${motivo}`, link: `/facturacion/${notif.facturaId}`, leida: false, creadoEn: st() })
      setModalAprobacion(null)
    } catch (e) { console.error('Error rechazando pago:', e) }
  }, [modalAprobacion])

  useAlertasVencimiento(usuario)

  const noLeidas = notifs.filter(n => !n.leida).length
  const handleCerrarSesion = async () => { await cerrarSesion(); navigate('/login') }
  const inicial = usuario?.nombre?.charAt(0)?.toUpperCase() || usuario?.email?.charAt(0)?.toUpperCase() || 'A'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f4f6f4' }}>

      {modalAprobacion && (
        <ModalAprobacion notif={modalAprobacion} onAprobar={aprobarPago} onRechazar={rechazarPago} onCerrar={() => setModalAprobacion(null)} />
      )}

      <header style={{ background: 'var(--eco-primary)', flexShrink: 0, display: 'flex', alignItems: 'center', height: 48, paddingRight: 16, zIndex: 10000, position: 'relative' }}>
        <div onClick={() => setGridOpen(o => !o)} style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,.15)', cursor: 'pointer', background: gridOpen ? 'rgba(255,255,255,.2)' : 'transparent', transition: 'background .15s' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7l9 5 9-5-9-5zM3 17l9 5 9-5M3 12l9 5 9-5" stroke="#fff" strokeWidth="2"/></svg>
        </div>
        <button onClick={() => navigate(-1)} style={{ height: '100%', padding: '0 12px', background: 'transparent', border: 'none', borderRight: '1px solid rgba(255,255,255,.15)', color: 'rgba(255,255,255,.75)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>

        <nav style={{ display: 'flex', alignItems: 'center', flex: 1, height: '100%' }}>
          {navItems.map((item, idx) => {
            if (item.grupo) return <GrupoNav key={idx} item={item} isActive={isActive} onNavigate={navigate} />
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                style={{ height: '100%', padding: '0 14px', background: isActive(item.path, item.end) ? 'rgba(255,255,255,.18)' : 'transparent', borderBottom: isActive(item.path, item.end) ? '2px solid #fff' : '2px solid transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', color: isActive(item.path, item.end) ? '#fff' : 'rgba(255,255,255,.75)', fontSize: 12, fontWeight: isActive(item.path, item.end) ? 500 : 400, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,.1)' }}
                onMouseLeave={e => { if (!isActive(item.path, item.end)) { e.currentTarget.style.color = 'rgba(255,255,255,.75)'; e.currentTarget.style.background = 'transparent' } }}
              >{item.label}</button>
            )
          })}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>

          {/* Bot de ayuda */}
          <button
            onClick={() => { setBotOpen(o => !o); setNotifOpen(false); setMenuOpen(false) }}
            title="Asistente de ayuda"
            style={{ width: 32, height: 32, borderRadius: 8, background: botOpen ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', transition: 'background .15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.22)'}
            onMouseLeave={e => e.currentTarget.style.background = botOpen ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.12)'}>
            ?
          </button>

          {/* Widget tasas */}
          <WidgetTasas puedeEditar={puedeEditarTasa} />

          {/* Campana */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button onClick={() => { setNotifOpen(o => !o); setMenuOpen(false) }}
              style={{ width: 32, height: 32, borderRadius: 8, background: notifOpen ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', transition: 'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.22)'}
              onMouseLeave={e => e.currentTarget.style.background = notifOpen ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.12)'}
              title="Notificaciones">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {noLeidas > 0 && <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, background: '#E24B4A', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', border: '1.5px solid var(--eco-primary)' }}>{noLeidas > 99 ? '99+' : noLeidas}</span>}
            </button>
            {notifOpen && <PanelNotificaciones notifs={notifs} onMarcarLeida={marcarLeida} onMarcarTodasLeidas={marcarTodasLeidas} onNavegar={navigate} onCerrar={() => setNotifOpen(false)} />}
          </div>

          {/* Avatar / menú usuario */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button onClick={() => { setMenuOpen(o => !o); setNotifOpen(false) }}
              style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,.2)', border: '1.5px solid rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500, color: '#fff', cursor: 'pointer', overflow: 'hidden', padding: 0, position: 'relative' }}>
              {usuario?.fotoURL ? <img src={usuario.fotoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : inicial}
            </button>
            <span style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: '50%', background: activo ? '#22c55e' : '#ef4444', border: '2px solid var(--eco-primary)', zIndex: 1 }} title={activo ? 'Activo' : 'Inactivo'} />
            {menuOpen && (
              <div style={{ position: 'absolute', top: 38, right: 0, background: '#fff', border: '1px solid #d0d8d0', borderRadius: 8, minWidth: 200, zIndex: 9999, overflow: 'hidden' }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid #eee' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>{usuario?.nombre || 'Administrador'}</div>
                  <div style={{ fontSize: 11, color: '#8a9e8a', marginTop: 2 }}>{usuario?.email}</div>
                  <div style={{ display: 'inline-block', marginTop: 6, background: 'var(--eco-primary-light)', color: 'var(--eco-primary)', fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 10 }}>{usuario?.rol || 'Administrador'}</div>
                </div>
                <button onClick={() => { setMenuOpen(false); navigate('/configuracion/perfil') }} style={menuBtnSt}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5"/></svg>Mi perfil
                </button>
                {/* ── Cambio 4: acceso rápido a Correo desde el menú de usuario ── */}
                <button onClick={() => { setMenuOpen(false); navigate('/email') }} style={menuBtnSt}>
                  <span style={{ fontSize: 14 }}>📧</span>Correo
                </button>
                <button onClick={() => { setMenuOpen(false); navigate('/configuracion/estetica') }} style={menuBtnSt}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/></svg>Estética
                </button>
                {esAdmin && (
                  <button onClick={() => { setMenuOpen(false); navigate('/finanzas') }} style={menuBtnSt}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>Finanzas
                  </button>
                )}
                <div style={{ borderTop: '1px solid #eee', marginTop: 4 }} />
                <button onClick={handleCerrarSesion} style={{ ...menuBtnSt, color: '#cc3333' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.5"/></svg>Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <ChatWidget onSonido={reproducirSonido} />
      {botOpen  && <BotAyuda onCerrar={() => setBotOpen(false)} />}
      {gridOpen && <MenuGrid onClose={() => setGridOpen(false)} onNavigate={navigate} modulosGrid={modulosGrid} />}
      <main style={{ flex: 1, overflowY: 'auto' }}><Outlet /></main>
    </div>
  )
}

const menuBtnSt = { width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, color: '#1a1a1a', textAlign: 'left', fontFamily: 'inherit' }