/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: FinanzasPage.jsx
 * Módulo:  Finanzas
 *
 * Pestañas:
 *   Dashboard → Estado de Resultados → Balance General →
 *   CxC → CxP → Compras → Proveedores → Gastos → Deudas → Flujo de Caja
 *
 * Fuentes:
 *   CxC          → colección 'facturas'           (saldo pendiente)
 *   CxP          → colección 'ordenes_compra'     (crédito pendiente)
 *   Compras      → colección 'ordenes_compra'     (todas)
 *   Proveedores  → colección 'proveedores'
 *   Gastos       → colección 'gastos_recurrentes'
 *   Deudas       → colección 'deudas'             (nueva)
 *   Inventario   → colecciones 'productos' + 'movimientosInventario' (PEPS)
 *   Flujo        → facturas[].pagos[] + ordenes_compra pagadas
 *   T/C          → configuracion/tasas
 * ============================================================
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  collection, onSnapshot, query, orderBy, where,
  addDoc, updateDoc, deleteDoc, doc, getDocs, serverTimestamp, getDoc
} from 'firebase/firestore'
import { db } from '../../../firebase/config'
import { useNavigate, useLocation } from 'react-router-dom'
import { usePermisos } from '../../../hooks/usePermisos'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtUSD = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtCRC = (n) => '₡' + Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 0 })
const fmt    = (n, mon = 'USD') => mon === 'USD' ? fmtUSD(n) : fmtCRC(n)

const toUSD = (monto, moneda, tc) => {
  if (!monto) return 0
  return moneda === 'USD' ? Number(monto) : Number(monto) / (tc || 520)
}

const fmtFecha = (iso) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const today = () => new Date().toISOString().split('T')[0]

const diasRestantes = (iso) => {
  if (!iso) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const vence = new Date(iso + 'T00:00:00')
  return Math.ceil((vence - hoy) / 86400000)
}

const diasHastaDelMes = (diaDelMes) => {
  if (!diaDelMes) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const mes = hoy.getMonth(), anio = hoy.getFullYear()
  let vence = new Date(anio, mes, diaDelMes)
  if (vence < hoy) vence = new Date(anio, mes + 1, diaDelMes)
  return Math.ceil((vence - hoy) / 86400000)
}

const calcularEstadoFactura = (f) => {
  if (f.estado === 'Incobrable') return 'Incobrable'
  const saldo  = Number(f.saldo  ?? f.total ?? 0)
  const pagado = Number(f.totalPagado ?? 0)
  if (saldo <= 0 && pagado > 0) return 'Pagada'
  if (pagado > 0 && saldo > 0)  return 'Parcial'
  return 'Sin Pagar'
}

const getMesAnio = (iso) => {
  if (!iso) return null
  return iso.substring(0, 7) // 'YYYY-MM'
}

// ─── Paleta ───────────────────────────────────────────────────────────────────
const C = {
  primary: 'var(--eco-primary, #1a3a5c)',
  green:   { bg: '#EAF3DE', text: '#3B6D11', dot: '#639922' },
  amber:   { bg: '#FAEEDA', text: '#854F0B', dot: '#EF9F27' },
  red:     { bg: '#FCEBEB', text: '#A32D2D', dot: '#E24B4A' },
  blue:    { bg: '#E6F1FB', text: '#185FA5', dot: '#2271C3' },
  purple:  { bg: '#EEEDFE', text: '#3C3489', dot: '#7F77DD' },
  gray:    { bg: '#F1EFE8', text: '#5F5E5A', dot: '#9E9C96' },
}

// ─── Componentes base ─────────────────────────────────────────────────────────
function Badge({ label, palette }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: palette.bg, color: palette.text }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: palette.dot }} />
      {label}
    </span>
  )
}

function MetCard({ label, valor, sub, palette, onClick }) {
  return (
    <div onClick={onClick} style={{ background: '#fff', border: `1.5px solid ${palette?.bg || 'rgba(0,0,0,.07)'}`, borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 160, cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow .15s' }}
      onMouseEnter={e => onClick && (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.08)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: palette?.text || C.primary, letterSpacing: '-0.5px' }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

const S = {
  inp:   { padding: '7px 12px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff', fontFamily: 'inherit', color: '#1a1a1a' },
  lbl:   { fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4, display: 'block' },
  inp2:  { width: '100%', padding: '8px 11px', border: '0.5px solid rgba(0,0,0,.18)', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box', color: '#1a1a1a' },
  btnSm: { padding: '4px 12px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: '#fff', fontFamily: 'inherit' },
  th:    { padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em', background: '#fafafa', borderBottom: '0.5px solid rgba(0,0,0,.06)' },
  td:    { padding: '11px 14px', borderBottom: '0.5px solid rgba(0,0,0,.05)', verticalAlign: 'middle', fontSize: 13 },
  card:  { background: '#fff', border: '0.5px solid rgba(0,0,0,.08)', borderRadius: 12, overflow: 'hidden' },
}

// ─── Modal abono CxC ──────────────────────────────────────────────────────────
function ModalAbonoCxC({ factura, cuentas, onGuardar, onCerrar }) {
  const [form, setForm] = useState({ monto: '', metodo: 'Transferencia', fecha: today(), referencia: '', notas: '', cuentaId: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState('')
  const saldo = Number(factura.saldo ?? factura.total ?? 0)
  const upd   = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const cuentasFiltradas = cuentas.filter(c => c.activa !== false)

  const handleGuardar = async () => {
    const monto = Number(form.monto)
    if (!monto || monto <= 0)       { setError('Ingresá un monto válido.'); return }
    if (monto > saldo + 0.01)       { setError(`El monto supera el saldo (${fmt(saldo, factura.moneda)})`); return }
    if (!form.cuentaId)             { setError('Seleccioná la cuenta donde ingresa el pago.'); return }
    setError(''); setGuardando(true)
    const cuenta = cuentas.find(c => c.id === form.cuentaId)
    await onGuardar(factura, { ...form, monto, cuentaNombre: cuenta?.nombre || '' })
    setGuardando(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: '#fff', borderRadius: 14, width: '95%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><div style={{ fontSize: 15, fontWeight: 600 }}>Registrar abono</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{factura.numero} · {factura.clienteNombre}</div></div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa' }}>×</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: '#f8f9fb', borderRadius: 10, padding: '12px 14px' }}>
            <div><p style={{ fontSize: 10, color: '#aaa', margin: '0 0 2px', textTransform: 'uppercase' }}>Total factura</p>
              <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{fmt(factura.total, factura.moneda)}</p></div>
            <div><p style={{ fontSize: 10, color: '#aaa', margin: '0 0 2px', textTransform: 'uppercase' }}>Saldo pendiente</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#A32D2D', margin: 0 }}>{fmt(saldo, factura.moneda)}</p></div>
          </div>
          <div>
            <label style={S.lbl}>Monto ({factura.moneda}) *</label>
            <input style={{ ...S.inp2, fontSize: 20, fontWeight: 700, color: C.primary }} type="number" min="0" step="0.01"
              placeholder="0.00" value={form.monto} onChange={e => upd('monto', e.target.value)} autoFocus />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {[25, 50, 75, 100].map(pct => (
                <button key={pct} onClick={() => upd('monto', (saldo * pct / 100).toFixed(2))}
                  style={{ padding: '3px 10px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: '#fff', fontFamily: 'inherit' }}>{pct}%</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={S.lbl}>Método</label>
              <select style={S.inp2} value={form.metodo} onChange={e => upd('metodo', e.target.value)}>
                {['Transferencia', 'SINPE', 'Efectivo', 'Cheque', 'Tarjeta', 'Otro'].map(m => <option key={m}>{m}</option>)}
              </select></div>
            <div><label style={S.lbl}>Fecha</label>
              <input style={S.inp2} type="date" value={form.fecha} onChange={e => upd('fecha', e.target.value)} /></div>
          </div>
          <div><label style={S.lbl}>Referencia</label>
            <input style={S.inp2} placeholder="Número de transferencia..." value={form.referencia} onChange={e => upd('referencia', e.target.value)} /></div>
          <div>
            <label style={S.lbl}>Cuenta donde ingresa *</label>
            <select style={S.inp2} value={form.cuentaId} onChange={e => upd('cuentaId', e.target.value)}>
              <option value="">— Seleccioná una cuenta —</option>
              {cuentasFiltradas.map(c => (
                <option key={c.id} value={c.id}>{c.nombre} ({c.moneda}){c.ultimos4 ? ` •••• ${c.ultimos4}` : ''}</option>
              ))}
            </select>
          </div>
          <div><label style={S.lbl}>Notas</label>
            <textarea style={{ ...S.inp2, resize: 'vertical' }} rows={2} value={form.notas} onChange={e => upd('notas', e.target.value)} /></div>
          {error && <div style={{ padding: '8px 12px', background: '#FCEBEB', borderRadius: 7, fontSize: 12, color: '#A32D2D' }}>{error}</div>}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(0,0,0,.08)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCerrar} style={{ padding: '8px 16px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: '#f5f5f5', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={guardando} style={{ padding: '8px 22px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: guardando ? 'not-allowed' : 'pointer', background: guardando ? '#e0e0e0' : C.primary, color: '#fff', fontFamily: 'inherit' }}>
            {guardando ? 'Guardando...' : 'Registrar abono'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal abono deuda ────────────────────────────────────────────────────────
function ModalAbonoDeuda({ deuda, cuentas = [], onGuardar, onCerrar }) {
  const [form, setForm] = useState({ monto: '', metodo: 'Transferencia', fecha: today(), notas: '', cuentaId: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState('')
  const saldo = Number(deuda.saldo ?? deuda.monto ?? 0)
  const upd   = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const cuentasFiltradas = cuentas.filter(c => c.activa !== false && c.tipo !== 'Tarjeta de crédito')

  const handleGuardar = async () => {
    const monto = Number(form.monto)
    if (!monto || monto <= 0)   { setError('Ingresá un monto válido.'); return }
    if (monto > saldo + 0.01)   { setError(`El monto supera el saldo (${fmt(saldo, deuda.moneda)})`); return }
    if (!form.cuentaId)         { setError('Seleccioná la cuenta bancaria.'); return }
    setError(''); setGuardando(true)
    const cuenta = cuentas.find(c => c.id === form.cuentaId)
    await onGuardar(deuda, { ...form, monto, cuentaNombre: cuenta?.nombre || '' })
    setGuardando(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: '#fff', borderRadius: 14, width: '95%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><div style={{ fontSize: 15, fontWeight: 600 }}>Abonar a deuda</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{deuda.descripcion} · {deuda.tipo === 'yo_debo' ? 'Le debo a' : 'Me debe'}: {deuda.acreedor}</div></div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa' }}>×</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: '#f8f9fb', borderRadius: 10, padding: '12px 14px' }}>
            <div><p style={{ fontSize: 10, color: '#aaa', margin: '0 0 2px', textTransform: 'uppercase' }}>Monto original</p>
              <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{fmt(deuda.monto, deuda.moneda)}</p></div>
            <div><p style={{ fontSize: 10, color: '#aaa', margin: '0 0 2px', textTransform: 'uppercase' }}>Saldo pendiente</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#A32D2D', margin: 0 }}>{fmt(saldo, deuda.moneda)}</p></div>
          </div>
          <div>
            <label style={S.lbl}>Monto del abono ({deuda.moneda}) *</label>
            <input style={{ ...S.inp2, fontSize: 18, fontWeight: 700 }} type="number" min="0" step="0.01"
              placeholder="0.00" value={form.monto} onChange={e => upd('monto', e.target.value)} autoFocus />
            <button onClick={() => upd('monto', saldo.toFixed(2))} style={{ marginTop: 6, padding: '3px 10px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: '#fff', fontFamily: 'inherit' }}>
              Saldar completo</button>
          </div>
          <div>
            <label style={S.lbl}>{deuda.tipo === 'yo_debo' ? 'Cuenta de salida (de dónde sale el pago)' : 'Cuenta de entrada (dónde ingresa)'} *</label>
            <select style={S.inp2} value={form.cuentaId} onChange={e => upd('cuentaId', e.target.value)}>
              <option value="">— Seleccioná una cuenta —</option>
              {cuentasFiltradas.map(c => (
                <option key={c.id} value={c.id}>{c.nombre} ({c.moneda}){c.ultimos4 ? ` •••• ${c.ultimos4}` : ''}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={S.lbl}>Método</label>
              <select style={S.inp2} value={form.metodo} onChange={e => upd('metodo', e.target.value)}>
                {['Transferencia', 'SINPE', 'Efectivo', 'Cheque', 'Otro'].map(m => <option key={m}>{m}</option>)}
              </select></div>
            <div><label style={S.lbl}>Fecha</label>
              <input style={S.inp2} type="date" value={form.fecha} onChange={e => upd('fecha', e.target.value)} /></div>
          </div>
          <div><label style={S.lbl}>Notas</label>
            <textarea style={{ ...S.inp2, resize: 'vertical' }} rows={2} value={form.notas} onChange={e => upd('notas', e.target.value)} /></div>
          {error && <div style={{ padding: '8px 12px', background: '#FCEBEB', borderRadius: 7, fontSize: 12, color: '#A32D2D' }}>{error}</div>}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(0,0,0,.08)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCerrar} style={{ padding: '8px 16px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: '#f5f5f5', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={guardando} style={{ padding: '8px 22px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: guardando ? 'not-allowed' : 'pointer', background: guardando ? '#e0e0e0' : C.primary, color: '#fff', fontFamily: 'inherit' }}>
            {guardando ? 'Guardando...' : 'Registrar abono'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal costo producto (desde notificación Balance) ────────────────────────
function ModalCostoProducto({ producto, onGuardar, onCerrar }) {
  const [precioCompra, setPrecioCompra] = useState(producto.precioCompra || '')
  const [costo, setCosto]               = useState(producto.costo || '')
  const [guardando, setGuardando]       = useState(false)

  const handleGuardar = async () => {
    if (!precioCompra && !costo) return
    setGuardando(true)
    await onGuardar(producto.id, { precioCompra: Number(precioCompra) || 0, costo: Number(costo) || 0 })
    setGuardando(false)
    onCerrar()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: '#fff', borderRadius: 14, width: '95%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><div style={{ fontSize: 15, fontWeight: 600 }}>Actualizar precios</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{producto.nombre}</div></div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa' }}>×</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '10px 14px', background: C.amber.bg, borderRadius: 8, fontSize: 12, color: C.amber.text }}>
            ⚠️ Este producto no tiene precio configurado. Sin precio no se puede valorizar el inventario en el Balance General.
          </div>
          <div>
            <label style={S.lbl}>Precio de compra (USD) — de la última orden recibida</label>
            <input style={{ ...S.inp2, fontSize: 18, fontWeight: 700 }} type="number" min="0" step="0.01"
              placeholder="0.00" value={precioCompra} onChange={e => setPrecioCompra(e.target.value)} autoFocus />
          </div>
          <div>
            <label style={S.lbl}>Costo interno (USD) — precio que vos definís</label>
            <input style={{ ...S.inp2, fontSize: 16, fontWeight: 600 }} type="number" min="0" step="0.01"
              placeholder="0.00" value={costo} onChange={e => setCosto(e.target.value)} />
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(0,0,0,.08)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCerrar} style={{ padding: '8px 16px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: '#f5f5f5', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={guardando || (!precioCompra && !costo)} style={{ padding: '8px 22px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: C.primary, color: '#fff', fontFamily: 'inherit' }}>
            {guardando ? 'Guardando...' : 'Guardar precios'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal deuda ──────────────────────────────────────────────────────────────
function ModalDeuda({ deuda, onGuardar, onCerrar }) {
  const [form, setForm] = useState({
    descripcion: deuda?.descripcion || '', acreedor: deuda?.acreedor || '',
    tipo: deuda?.tipo || 'yo_debo', monto: deuda?.monto || '',
    moneda: deuda?.moneda || 'USD', fecha: deuda?.fecha || today(),
    usado_para: deuda?.usado_para || '', estado: deuda?.estado || 'pendiente',
    notas: deuda?.notas || '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState('')
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleGuardar = async () => {
    if (!form.descripcion.trim()) { setError('La descripción es obligatoria.'); return }
    if (!form.acreedor.trim())    { setError('Indicá el acreedor.'); return }
    if (!form.monto || Number(form.monto) <= 0) { setError('Ingresá un monto válido.'); return }
    setError(''); setGuardando(true)
    await onGuardar({ ...form, monto: Number(form.monto) })
    setGuardando(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: '#fff', borderRadius: 14, width: '95%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,.2)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{deuda ? 'Editar deuda' : 'Nueva deuda'}</div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa' }}>×</button>
        </div>
        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={S.lbl}>Tipo de deuda</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[{ val: 'yo_debo', label: '🔴 Yo debo', desc: 'La empresa debe a alguien' }, { val: 'empresa_debe', label: '🟢 Me deben', desc: 'Alguien le debe a la empresa' }].map(t => (
                <button key={t.val} onClick={() => upd('tipo', t.val)} style={{ padding: '10px 12px', border: `2px solid ${form.tipo === t.val ? C.primary : 'rgba(0,0,0,.12)'}`, borderRadius: 8, cursor: 'pointer', background: form.tipo === t.val ? C.primary : '#fff', color: form.tipo === t.val ? '#fff' : '#555', fontFamily: 'inherit', textAlign: 'left' }}>
                  <p style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>{t.label}</p>
                  <p style={{ fontSize: 10, margin: 0, opacity: .75 }}>{t.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div><label style={S.lbl}>Descripción *</label>
            <input style={S.inp2} placeholder="Ej: Préstamo para pagar alquiler" value={form.descripcion} onChange={e => upd('descripcion', e.target.value)} autoFocus /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={S.lbl}>{form.tipo === 'yo_debo' ? 'A quién le debo' : 'Quién me debe'} *</label>
              <input style={S.inp2} placeholder="Ej: Papá, Banco, Socio" value={form.acreedor} onChange={e => upd('acreedor', e.target.value)} /></div>
            <div><label style={S.lbl}>Se usó para</label>
              <input style={S.inp2} placeholder="Ej: Alquiler, materiales" value={form.usado_para} onChange={e => upd('usado_para', e.target.value)} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><label style={S.lbl}>Monto *</label>
              <input style={{ ...S.inp2, fontSize: 16, fontWeight: 700 }} type="number" min="0" step="0.01" placeholder="0.00" value={form.monto} onChange={e => upd('monto', e.target.value)} /></div>
            <div><label style={S.lbl}>Moneda</label>
              <select style={S.inp2} value={form.moneda} onChange={e => upd('moneda', e.target.value)}>
                <option value="USD">USD $</option><option value="CRC">CRC ₡</option>
              </select></div>
            <div><label style={S.lbl}>Fecha</label>
              <input style={S.inp2} type="date" value={form.fecha} onChange={e => upd('fecha', e.target.value)} /></div>
          </div>
          <div>
            <label style={S.lbl}>Estado</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ val: 'pendiente', label: 'Pendiente' }, { val: 'pagada', label: 'Saldada' }].map(e => (
                <button key={e.val} onClick={() => upd('estado', e.val)} style={{ padding: '6px 16px', border: `1.5px solid ${form.estado === e.val ? C.primary : 'rgba(0,0,0,.12)'}`, borderRadius: 7, cursor: 'pointer', background: form.estado === e.val ? C.primary : '#fff', color: form.estado === e.val ? '#fff' : '#555', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }}>{e.label}</button>
              ))}
            </div>
          </div>
          <div><label style={S.lbl}>Notas</label>
            <textarea style={{ ...S.inp2, resize: 'vertical' }} rows={2} placeholder="Detalles adicionales..." value={form.notas} onChange={e => upd('notas', e.target.value)} /></div>
          {error && <div style={{ padding: '8px 12px', background: '#FCEBEB', borderRadius: 7, fontSize: 12, color: '#A32D2D' }}>{error}</div>}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(0,0,0,.08)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onCerrar} style={{ padding: '8px 16px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: '#f5f5f5', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={guardando} style={{ padding: '8px 22px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: guardando ? 'not-allowed' : 'pointer', background: guardando ? '#e0e0e0' : C.primary, color: '#fff', fontFamily: 'inherit' }}>
            {guardando ? 'Guardando...' : deuda ? 'Guardar' : 'Crear deuda'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Dashboard ───────────────────────────────────────────────────────────
// ─── Gráfico: Flujo de Caja (Chart.js) ──────────────────────────────────────
function GraficoFlujo({ facturas, ordenes, deudas, tc }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const [periodo, setPeriodo] = useState('diario')
  const [fechaHasta, setFechaHasta] = useState('')

  const chartData = useMemo(() => {
    const hoy = new Date(); hoy.setHours(0,0,0,0)

    // Recopilar todos los movimientos pendientes
    const allMovs = []
    facturas.filter(f => f.estadoCalculado === 'Sin Pagar' || f.estadoCalculado === 'Parcial').forEach(f => {
      if (f.fechaVencimiento) allMovs.push({ date: f.fechaVencimiento, usd: toUSD(f.saldo ?? 0, f.moneda, tc), type: 'cobrar' })
    })
    ordenes.filter(o => o.estadoCalculado === 'Crédito pendiente' || o.estadoCalculado === 'Vencida').forEach(o => {
      const fecha = o.fechaVencimientoPago || o.fecha
      if (fecha) allMovs.push({ date: fecha, usd: toUSD(o.saldo ?? o.total ?? 0, o.moneda, tc), type: 'pagar' })
    })
    deudas.filter(d => d.estado === 'pendiente').forEach(d => {
      const fecha = d.fechaVencimiento || d.fecha
      if (fecha) allMovs.push({ date: fecha, usd: toUSD(d.saldo ?? d.monto ?? 0, d.moneda, tc), type: d.tipo === 'yo_debo' ? 'pagar' : 'cobrar' })
    })

    // Generar labels según periodo
    let labels = []
    if (periodo === 'diario') {
      for (let i = 0; i < 7; i++) {
        const d = new Date(hoy); d.setDate(d.getDate() + i)
        labels.push(d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }))
      }
    } else if (periodo === 'semanal') {
      for (let i = 0; i < 8; i++) {
        const d = new Date(hoy); d.setDate(d.getDate() + i * 7)
        const d2 = new Date(d); d2.setDate(d2.getDate() + 6)
        labels.push(d.toLocaleDateString('es', { day: 'numeric', month: 'short' }) + ' – ' + d2.toLocaleDateString('es', { day: 'numeric', month: 'short' }))
      }
    } else {
      const endD = fechaHasta ? new Date(fechaHasta + 'T00:00:00') : new Date(hoy)
      endD.setHours(0,0,0,0)
      if (endD <= hoy) endD.setDate(hoy.getDate() + 6)
      const maxDays = Math.min(Math.round((endD - hoy) / 86400000) + 1, 60)
      for (let i = 0; i < maxDays; i++) {
        const d = new Date(hoy); d.setDate(d.getDate() + i)
        labels.push(d.toLocaleDateString('es', { day: 'numeric', month: 'short' }))
      }
    }

    const cobrarData = new Array(labels.length).fill(0)
    const pagarData = new Array(labels.length).fill(0)

    allMovs.forEach(m => {
      const d = new Date(m.date + 'T00:00:00')
      let idx = -1
      if (periodo === 'diario') {
        const diff = Math.round((d - hoy) / 86400000)
        if (diff >= 0 && diff < 7) idx = diff
      } else if (periodo === 'semanal') {
        const diff = Math.round((d - hoy) / 86400000)
        const week = Math.floor(diff / 7)
        if (diff >= 0 && week < 8) idx = week
      } else {
        const diff = Math.round((d - hoy) / 86400000)
        if (diff >= 0 && diff < labels.length) idx = diff
      }
      if (idx >= 0) {
        if (m.type === 'cobrar') cobrarData[idx] += m.usd
        else pagarData[idx] += m.usd
      }
    })

    // Saldo acumulado (disponible actual + cobros - pagos)
    const cobrado = facturas.reduce((s, f) => s + (f.pagos || []).reduce((ss, p) => ss + toUSD(p.monto, f.moneda, tc), 0), 0)
    const pagado = ordenes.reduce((s, o) => s + (o.pagos || []).reduce((ss, p) => ss + toUSD(p.monto, o.moneda, tc), 0), 0)
    const initBal = cobrado - pagado

    const balData = []
    let running = initBal
    for (let i = 0; i < labels.length; i++) {
      running += cobrarData[i] - pagarData[i]
      balData.push(parseFloat(running.toFixed(2)))
    }

    return { labels, cobrarData, pagarData, balData }
  }, [facturas, ordenes, deudas, tc, periodo, fechaHasta])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    import('chart.js').then(({ Chart, registerables }) => {
      Chart.register(...registerables)

      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }

      chartRef.current = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: chartData.labels,
          datasets: [
            {
              label: 'Por Cobrar',
              data: chartData.cobrarData,
              backgroundColor: 'rgba(37,99,235,.7)',
              borderColor: '#2563eb',
              borderWidth: 1.5,
              borderRadius: 6,
              order: 2,
            },
            {
              label: 'Por Pagar',
              data: chartData.pagarData,
              backgroundColor: 'rgba(239,68,68,.7)',
              borderColor: '#ef4444',
              borderWidth: 1.5,
              borderRadius: 6,
              order: 2,
            },
            {
              label: 'Saldo acumulado',
              data: chartData.balData,
              type: 'line',
              borderColor: '#f59e0b',
              backgroundColor: 'rgba(245,158,11,.08)',
              borderWidth: 2.5,
              pointRadius: 4,
              pointBackgroundColor: '#f59e0b',
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
              tension: 0.4,
              fill: true,
              order: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              position: 'top',
              labels: {
                font: { family: 'Inter, sans-serif', size: 12, weight: '600' },
                usePointStyle: true,
                padding: 20,
              },
            },
            tooltip: {
              backgroundColor: '#1e293b',
              titleFont: { family: 'Inter, sans-serif', size: 12 },
              bodyFont: { family: 'monospace', size: 12 },
              padding: 12,
              callbacks: {
                label: ctx => ` ${ctx.dataset.label}: $${ctx.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { family: 'Inter, sans-serif', size: 11 }, color: '#64748b' },
            },
            y: {
              grid: { color: 'rgba(0,0,0,.04)' },
              ticks: {
                font: { family: 'monospace', size: 11 },
                color: '#64748b',
                callback: v => '$' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toLocaleString('en-US')),
              },
              border: { display: false },
            },
          },
        },
      })
    })

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [chartData])

  const btnSt = (active) => ({
    padding: '5px 12px', border: `1.5px solid ${active ? '#2563eb' : '#e2e8f0'}`,
    borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    background: active ? '#2563eb' : '#fff', color: active ? '#fff' : '#64748b',
  })

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,.06)', boxShadow: '0 1px 3px rgba(0,0,0,.05)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#94a3b8', margin: '0 0 3px' }}>Proyección</p>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#1e293b', margin: 0 }}>Flujo de Caja</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setPeriodo('diario')} style={btnSt(periodo === 'diario')}>Diario</button>
          <button onClick={() => setPeriodo('semanal')} style={btnSt(periodo === 'semanal')}>Semanal</button>
          <button onClick={() => setPeriodo('personalizado')} style={btnSt(periodo === 'personalizado')}>Personalizado</button>
          {periodo === 'personalizado' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Hasta:</span>
              <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
                style={{ border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontFamily: 'monospace', color: '#1e293b', outline: 'none' }} />
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: '20px 20px 16px', position: 'relative', height: 320 }}>
        <canvas ref={canvasRef} />
      </div>
      <div style={{ padding: '10px 20px 16px', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: '#2563eb' }} /> Por cobrar (entradas)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: '#ef4444' }} /> Por pagar (salidas)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
          <div style={{ width: 12, height: 3, background: '#f59e0b', borderRadius: 2 }} /> Saldo acumulado
        </div>
      </div>
    </div>
  )
}

function TabDashboard({ facturas, ordenes, gastos, deudas, tc, setTab }) {
  const cxcPendiente = useMemo(() =>
    facturas.filter(f => f.estadoCalculado === 'Sin Pagar' || f.estadoCalculado === 'Parcial')
      .reduce((s, f) => s + toUSD(f.saldo ?? 0, f.moneda, tc), 0)
  , [facturas, tc])

  const cxpPendiente = useMemo(() =>
    ordenes.filter(o => o.estadoCalculado === 'Crédito pendiente' || o.estadoCalculado === 'Vencida')
      .reduce((s, o) => s + toUSD(o.saldo ?? o.total ?? 0, o.moneda, tc), 0)
  , [ordenes, tc])

  const pasivos = useMemo(() =>
    deudas.filter(d => d.tipo === 'yo_debo' && d.estado === 'pendiente')
      .reduce((s, d) => s + toUSD(d.saldo ?? d.monto ?? 0, d.moneda, tc), 0)
  , [deudas, tc])

  const activos = useMemo(() =>
    deudas.filter(d => d.tipo === 'empresa_debe' && d.estado === 'pendiente')
      .reduce((s, d) => s + toUSD(d.saldo ?? d.monto ?? 0, d.moneda, tc), 0)
  , [deudas, tc])

  const posicionNeta = cxcPendiente + activos - cxpPendiente - pasivos

  const vencidasCxC  = facturas.filter(f => { const est = f.estadoCalculado; const dias = diasRestantes(f.fechaVencimiento); return (est === 'Sin Pagar' || est === 'Parcial') && dias !== null && dias < 0 }).length
  const urgenteCxP   = ordenes.filter(o => { const dias = diasRestantes(o.fechaVencimientoPago); return (o.estadoCalculado === 'Crédito pendiente') && dias !== null && dias <= 3 }).length
  const urgentesGastos = gastos.filter(g => g.activo !== false && g.diaDelMes && (diasHastaDelMes(g.diaDelMes) ?? 999) <= 3).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Posición neta */}
      <div style={{ background: posicionNeta >= 0 ? 'linear-gradient(135deg,#0a1f3c,#1a3a6c)' : 'linear-gradient(135deg,#2a0a0a,#4a1010)', borderRadius: 20, padding: '32px', textAlign: 'center', boxShadow: '0 8px 32px rgba(10,22,40,.25)' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.14em', margin: '0 0 10px' }}>Posición financiera neta (USD)</p>
        <p style={{ fontSize: 42, fontWeight: 800, color: posicionNeta >= 0 ? '#86efac' : '#fca5a5', margin: 0, letterSpacing: '-2px', fontFamily: 'monospace' }}>
          {posicionNeta >= 0 ? '+' : ''}{fmtUSD(posicionNeta)}
        </p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', margin: '10px 0 0' }}>CxC + Activos − CxP − Pasivos · T/C ₡{tc}</p>
      </div>

      {/* Cuadrante */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[
          { label: '↑ CxC — Por cobrar', val: fmtUSD(cxcPendiente), palette: C.green, sub: `${facturas.filter(f => f.estadoCalculado === 'Sin Pagar' || f.estadoCalculado === 'Parcial').length} facturas${vencidasCxC > 0 ? ` · ${vencidasCxC} vencidas` : ''}`, tab: 'cxc' },
          { label: '↓ CxP — Por pagar',  val: fmtUSD(cxpPendiente), palette: C.amber, sub: `${ordenes.filter(o => o.estadoCalculado === 'Crédito pendiente' || o.estadoCalculado === 'Vencida').length} órdenes${urgenteCxP > 0 ? ` · ${urgenteCxP} urgentes` : ''}`, tab: 'cxp' },
          { label: '🟢 Activos — Me deben', val: fmtUSD(activos),   palette: C.blue, sub: `${deudas.filter(d => d.tipo === 'empresa_debe' && d.estado === 'pendiente').length} deudas pendientes`, tab: 'deudas' },
          { label: '🔴 Pasivos — Yo debo',  val: fmtUSD(pasivos),   palette: C.red,  sub: `${deudas.filter(d => d.tipo === 'yo_debo' && d.estado === 'pendiente').length} deudas pendientes`, tab: 'deudas' },
        ].map(item => (
          <div key={item.label} onClick={() => setTab(item.tab)} style={{ background: '#fff', border: `1.5px solid ${item.palette.bg}`, borderRadius: 14, padding: '20px 22px', cursor: 'pointer', transition: 'box-shadow .15s' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.08)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
            <p style={{ fontSize: 10, fontWeight: 700, color: item.palette.text, textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 6px' }}>{item.label}</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: item.palette.text, margin: 0, letterSpacing: '-1px', fontFamily: 'monospace' }}>{item.val}</p>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '6px 0 0' }}>{item.sub}</p>
          </div>
        ))}
      </div>

      {/* Alertas */}
      {(vencidasCxC > 0 || urgenteCxP > 0 || urgentesGastos > 0) && (
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,.08)', borderRadius: 12, padding: '16px 20px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 12px' }}>⚠️ Atención requerida</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {vencidasCxC > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: C.red.bg, borderRadius: 8 }}><span style={{ fontSize: 16 }}>🔴</span><p style={{ margin: 0, fontSize: 13, color: C.red.text, fontWeight: 500 }}>{vencidasCxC} factura{vencidasCxC > 1 ? 's' : ''} vencida{vencidasCxC > 1 ? 's' : ''} — Contactar clientes</p></div>}
            {urgenteCxP > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: C.amber.bg, borderRadius: 8 }}><span style={{ fontSize: 16 }}>🟡</span><p style={{ margin: 0, fontSize: 13, color: C.amber.text, fontWeight: 500 }}>{urgenteCxP} orden{urgenteCxP > 1 ? 'es' : ''} de compra vence{urgenteCxP === 1 ? '' : 'n'} en 3 días</p></div>}
            {urgentesGastos > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: C.amber.bg, borderRadius: 8 }}><span style={{ fontSize: 16 }}>🟡</span><p style={{ margin: 0, fontSize: 13, color: C.amber.text, fontWeight: 500 }}>{urgentesGastos} gasto{urgentesGastos > 1 ? 's' : ''} recurrente{urgentesGastos > 1 ? 's' : ''} vence{urgentesGastos === 1 ? '' : 'n'} en 3 días</p></div>}
          </div>
        </div>
      )}

      {/* Gráfico Disponible vs Por Pagar */}
      <GraficoFlujo facturas={facturas} ordenes={ordenes} deudas={deudas} tc={tc} />

      {/* Tabla Flujo de caja */}
      <div style={{ marginTop: 20 }}>
        <TabFlujo facturas={facturas} ordenes={ordenes} tc={tc} />
      </div>
    </div>
  )
}

// ─── Tab: Estado de Resultados ────────────────────────────────────────────────
function TabEstadoResultados({ facturas, ordenes, gastos, tc }) {
  const [vista, setVista]       = useState('mensual')
  const [mesSelec, setMesSelec] = useState(() => today().substring(0, 7))
  const [anioSelec, setAnioSelec] = useState(() => new Date().getFullYear())

  // Generar meses disponibles desde facturas
  const mesesDisponibles = useMemo(() => {
    const set = new Set()
    facturas.forEach(f => { (f.pagos || []).forEach(p => { if (p.fecha) set.add(p.fecha.substring(0, 7)) }) })
    ordenes.filter(o => o.estado === 'Pagada').forEach(o => {
      const fecha = o.actualizadoEn?.toDate ? o.actualizadoEn.toDate().toISOString() : o.creadoEn?.toDate ? o.creadoEn.toDate().toISOString() : null
      if (fecha) set.add(fecha.substring(0, 7))
    })
    return [...set].sort().reverse()
  }, [facturas, ordenes])

  const aniosDisponibles = useMemo(() => {
    const set = new Set(mesesDisponibles.map(m => m.substring(0, 4)))
    return [...set].sort().reverse()
  }, [mesesDisponibles])

  // Filtrar por período
  const filtrarPorPeriodo = (fecha) => {
    if (!fecha) return false
    if (vista === 'mensual') return fecha.startsWith(mesSelec)
    return fecha.startsWith(String(anioSelec))
  }

  // Ingresos: pagos de facturas
  const ingresos = useMemo(() => {
    const movs = []
    facturas.forEach(f => {
      ;(f.pagos || []).forEach(p => {
        if (!p.fecha || !filtrarPorPeriodo(p.fecha)) return
        movs.push({ concepto: `Pago — ${f.clienteNombre || f.numero}`, monto: toUSD(p.monto, f.moneda, tc), fecha: p.fecha, ref: f.numero })
      })
    })
    return movs.sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [facturas, mesSelec, anioSelec, vista, tc])

  // Gastos operativos: órdenes de compra pagadas
  const gastosOp = useMemo(() => {
    const movs = []
    ordenes.filter(o => o.estado === 'Pagada').forEach(o => {
      const pags = o.pagos || []
      pags.forEach(p => {
        if (!p.fecha || !filtrarPorPeriodo(p.fecha)) return
        movs.push({ concepto: `Compra — ${o.proveedorNombre || o.numero}`, monto: toUSD(p.monto, o.moneda, tc), fecha: p.fecha, ref: o.numero })
      })
      // Si no tiene pagos detallados pero estado Pagada, usar total
      if (pags.length === 0) {
        const fecha = o.creadoEn?.toDate ? o.creadoEn.toDate().toISOString().substring(0, 10) : null
        if (fecha && filtrarPorPeriodo(fecha)) {
          movs.push({ concepto: `Compra — ${o.proveedorNombre || o.numero}`, monto: toUSD(o.total, o.moneda, tc), fecha, ref: o.numero })
        }
      }
    })
    return movs.sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [ordenes, mesSelec, anioSelec, vista, tc])

  const totalIngresos = ingresos.reduce((s, i) => s + i.monto, 0)
  const totalGastos   = gastosOp.reduce((s, g) => s + g.monto, 0)
  const utilidadBruta = totalIngresos - totalGastos
  const margen        = totalIngresos > 0 ? (utilidadBruta / totalIngresos) * 100 : 0

  // Vista anual por mes
  const datosAnuales = useMemo(() => {
    if (vista !== 'anual') return []
    const meses = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0')
      return `${anioSelec}-${m}`
    })
    return meses.map(mes => {
      const ing = facturas.flatMap(f => (f.pagos || []).filter(p => p.fecha?.startsWith(mes)).map(p => toUSD(p.monto, f.moneda, tc))).reduce((s, v) => s + v, 0)
      const gas = ordenes.filter(o => o.estado === 'Pagada').flatMap(o => {
        const pags = o.pagos || []
        if (pags.length > 0) return pags.filter(p => p.fecha?.startsWith(mes)).map(p => toUSD(p.monto, o.moneda, tc))
        const fecha = o.creadoEn?.toDate ? o.creadoEn.toDate().toISOString().substring(0, 10) : null
        return (fecha?.startsWith(mes)) ? [toUSD(o.total, o.moneda, tc)] : []
      }).reduce((s, v) => s + v, 0)
      const labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
      return { mes, label: labels[parseInt(mes.split('-')[1]) - 1], ingresos: ing, gastos: gas, utilidad: ing - gas }
    })
  }, [facturas, ordenes, anioSelec, vista, tc])

  return (
    <div>
      {/* Controles */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 0, background: '#f1f5f9', borderRadius: 10, padding: 4 }}>
          {[['mensual', '📅 Mensual'], ['anual', '📊 Anual']].map(([val, lbl]) => (
            <button key={val} onClick={() => setVista(val)} style={{ padding: '8px 18px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: vista === val ? '#fff' : 'transparent', color: vista === val ? C.primary : '#94a3b8', boxShadow: vista === val ? '0 1px 4px rgba(0,0,0,.1)' : 'none' }}>{lbl}</button>
          ))}
        </div>
        {vista === 'mensual' ? (
          <select style={{ ...S.inp, fontSize: 13 }} value={mesSelec} onChange={e => setMesSelec(e.target.value)}>
            {mesesDisponibles.length === 0 && <option value={mesSelec}>{mesSelec}</option>}
            {mesesDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        ) : (
          <select style={{ ...S.inp, fontSize: 13 }} value={anioSelec} onChange={e => setAnioSelec(Number(e.target.value))}>
            {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
      </div>

      {/* Métricas */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <MetCard label="Ingresos" valor={fmtUSD(totalIngresos)} palette={C.green} sub={`${ingresos.length} pagos`} />
        <MetCard label="Gastos operativos" valor={fmtUSD(totalGastos)} palette={C.red} sub={`${gastosOp.length} pagos`} />
        <MetCard label="Utilidad bruta" valor={fmtUSD(utilidadBruta)} palette={utilidadBruta >= 0 ? C.green : C.red} sub={`Margen: ${margen.toFixed(1)}%`} />
      </div>

      {/* Vista anual — tabla por mes */}
      {vista === 'anual' && (
        <div style={{ ...S.card, marginBottom: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Mes', 'Ingresos', 'Gastos', 'Utilidad', 'Margen'].map(h => <th key={h} style={S.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {datosAnuales.map(d => (
                <tr key={d.mes} onMouseEnter={e => e.currentTarget.style.background = '#fafbff'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ ...S.td, fontWeight: 600 }}>{d.label}</td>
                  <td style={{ ...S.td, color: C.green.text, fontWeight: 500 }}>{d.ingresos > 0 ? fmtUSD(d.ingresos) : <span style={{ color: '#94a3b8' }}>—</span>}</td>
                  <td style={{ ...S.td, color: C.red.text }}>{d.gastos > 0 ? fmtUSD(d.gastos) : <span style={{ color: '#94a3b8' }}>—</span>}</td>
                  <td style={{ ...S.td, fontWeight: 700, color: d.utilidad >= 0 ? C.green.text : C.red.text }}>
                    {d.ingresos === 0 && d.gastos === 0 ? <span style={{ color: '#94a3b8' }}>—</span> : (d.utilidad >= 0 ? '+' : '') + fmtUSD(d.utilidad)}
                  </td>
                  <td style={{ ...S.td, color: '#94a3b8', fontSize: 12 }}>
                    {d.ingresos > 0 ? `${((d.utilidad / d.ingresos) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
              {/* Total */}
              <tr style={{ background: '#f8fafc', borderTop: '2px solid rgba(0,0,0,.08)' }}>
                <td style={{ ...S.td, fontWeight: 700 }}>Total {anioSelec}</td>
                <td style={{ ...S.td, fontWeight: 700, color: C.green.text }}>{fmtUSD(datosAnuales.reduce((s, d) => s + d.ingresos, 0))}</td>
                <td style={{ ...S.td, fontWeight: 700, color: C.red.text }}>{fmtUSD(datosAnuales.reduce((s, d) => s + d.gastos, 0))}</td>
                <td style={{ ...S.td, fontWeight: 800, color: utilidadBruta >= 0 ? C.green.text : C.red.text }}>{(utilidadBruta >= 0 ? '+' : '') + fmtUSD(datosAnuales.reduce((s, d) => s + d.utilidad, 0))}</td>
                <td style={{ ...S.td, fontWeight: 700 }}>{totalIngresos > 0 ? `${margen.toFixed(1)}%` : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Detalle mensual */}
      {vista === 'mensual' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Ingresos */}
          <div style={S.card}>
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(0,0,0,.06)', fontWeight: 600, fontSize: 13, color: C.green.text }}>↑ Ingresos — {fmtUSD(totalIngresos)}</div>
            {ingresos.length === 0 ? <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Sin ingresos en este período</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>{ingresos.map((i, idx) => (
                  <tr key={idx} onMouseEnter={e => e.currentTarget.style.background = '#f8fff8'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ ...S.td, fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{fmtFecha(i.fecha)}</td>
                    <td style={{ ...S.td }}>{i.concepto}</td>
                    <td style={{ ...S.td, fontWeight: 700, color: C.green.text, textAlign: 'right' }}>{fmtUSD(i.monto)}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
          {/* Gastos */}
          <div style={S.card}>
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(0,0,0,.06)', fontWeight: 600, fontSize: 13, color: C.red.text }}>↓ Gastos — {fmtUSD(totalGastos)}</div>
            {gastosOp.length === 0 ? <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Sin gastos en este período</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>{gastosOp.map((g, idx) => (
                  <tr key={idx} onMouseEnter={e => e.currentTarget.style.background = '#fff8f8'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ ...S.td, fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{fmtFecha(g.fecha)}</td>
                    <td style={{ ...S.td }}>{g.concepto}</td>
                    <td style={{ ...S.td, fontWeight: 700, color: C.red.text, textAlign: 'right' }}>{fmtUSD(g.monto)}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Balance General ─────────────────────────────────────────────────────
function TabBalanceGeneral({ facturas, ordenes, deudas, tc, onActualizarPrecio }) {
  const [productosSinPrecio, setProductosSinPrecio] = useState([])
  const [valorInventario, setValorInventario]       = useState(0)
  const [modalCosto, setModalCosto]                 = useState(null)
  const [loadingInv, setLoadingInv]                 = useState(true)

  // Calcular inventario con PEPS
  useEffect(() => {
    const calcular = async () => {
      setLoadingInv(true)
      try {
        const [prodsSnap, movsSnap] = await Promise.all([
          getDocs(collection(db, 'productos')),
          getDocs(query(collection(db, 'movimientosInventario'), orderBy('fecha', 'asc')))
        ])
        const productos  = prodsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        const movimientos = movsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        const sinPrecio  = []
        let totalValor   = 0

        for (const prod of productos.filter(p => p.rastrearStock)) {
          const entradas = movimientos.filter(m => m.productoId === prod.id && m.tipo === 'entrada')
            .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
          const salidas = movimientos.filter(m => m.productoId === prod.id && m.tipo !== 'entrada')
            .reduce((s, m) => s + Math.abs(m.cantidad || 0), 0)
          const stockTotal = entradas.reduce((s, e) => s + (e.cantidad || 0), 0) - salidas
          if (stockTotal <= 0) continue

          // PEPS — consumir entradas más antiguas primero
          let stockRestante = stockTotal
          let valorProd     = 0
          let necesitaPrecio = false

          for (const entrada of entradas) {
            if (stockRestante <= 0) break
            const unidades = Math.min(entrada.cantidad || 0, stockRestante)
            // Costo en USD del movimiento
            let costoUSD = entrada.costo ? Number(entrada.costo) : null
            if (!costoUSD) {
              // Fallback: precioCompra del producto (guardado en CRC) → convertir a USD
              if (prod.precioCompra) {
                costoUSD = Number(prod.precioCompra) > 1000
                  ? Number(prod.precioCompra) / tc  // probablemente en CRC
                  : Number(prod.precioCompra)        // probablemente en USD
              } else if (prod.costo) {
                costoUSD = Number(prod.costo)
              } else {
                necesitaPrecio = true
                costoUSD = 0
              }
            }
            valorProd += unidades * costoUSD
            stockRestante -= unidades
          }

          if (necesitaPrecio) {
            sinPrecio.push({ id: prod.id, nombre: prod.nombre, precioCompra: prod.precioCompra, costo: prod.costo })
          }
          totalValor += valorProd
        }

        setValorInventario(totalValor)
        setProductosSinPrecio(sinPrecio)
      } catch (e) {
        console.error('Error calculando inventario:', e)
      }
      setLoadingInv(false)
    }
    calcular()
  }, [tc])

  // Activos
  const cxcPendiente = useMemo(() =>
    facturas.filter(f => f.estadoCalculado === 'Sin Pagar' || f.estadoCalculado === 'Parcial')
      .reduce((s, f) => s + toUSD(f.saldo ?? 0, f.moneda, tc), 0)
  , [facturas, tc])

  const activosDeudas = useMemo(() =>
    deudas.filter(d => d.tipo === 'empresa_debe' && d.estado === 'pendiente')
      .reduce((s, d) => s + toUSD(d.saldo ?? d.monto ?? 0, d.moneda, tc), 0)
  , [deudas, tc])

  const totalActivos = cxcPendiente + valorInventario + activosDeudas

  // Pasivos
  const cxpOrdenes = useMemo(() =>
    ordenes.filter(o => o.estadoCalculado === 'Crédito pendiente' || o.estadoCalculado === 'Vencida')
      .reduce((s, o) => s + toUSD(o.saldo ?? o.total ?? 0, o.moneda, tc), 0)
  , [ordenes, tc])

  const pasivosDeudas = useMemo(() =>
    deudas.filter(d => d.tipo === 'yo_debo' && d.estado === 'pendiente')
      .reduce((s, d) => s + toUSD(d.saldo ?? d.monto ?? 0, d.moneda, tc), 0)
  , [deudas, tc])

  const totalPasivos   = cxpOrdenes + pasivosDeudas
  const patrimonio     = totalActivos - totalPasivos

  const handleGuardarPrecio = async (productoId, datos) => {
    await updateDoc(doc(db, 'productos', productoId), datos)
    setProductosSinPrecio(prev => prev.filter(p => p.id !== productoId))
    onActualizarPrecio && onActualizarPrecio()
  }

  return (
    <div>
      {modalCosto && (
        <ModalCostoProducto producto={modalCosto} onGuardar={handleGuardarPrecio} onCerrar={() => setModalCosto(null)} />
      )}

      {/* Alerta productos sin precio */}
      {productosSinPrecio.length > 0 && (
        <div style={{ background: C.amber.bg, border: `1.5px solid ${C.amber.dot}`, borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.amber.text, margin: '0 0 10px' }}>
            ⚠️ {productosSinPrecio.length} producto{productosSinPrecio.length > 1 ? 's' : ''} sin precio — el inventario está incompleto
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {productosSinPrecio.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#fff', borderRadius: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{p.nombre}</span>
                <button onClick={() => setModalCosto(p)} style={{ padding: '4px 12px', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: C.amber.text, color: '#fff', fontFamily: 'inherit' }}>
                  + Ingresar precio
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Balance */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Activos */}
        <div style={S.card}>
          <div style={{ padding: '14px 18px', borderBottom: '0.5px solid rgba(0,0,0,.06)', background: C.green.bg }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.green.text, textTransform: 'uppercase', letterSpacing: '.08em', margin: 0 }}>Activos</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: C.green.text, margin: '4px 0 0', fontFamily: 'monospace' }}>{fmtUSD(totalActivos)}</p>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {[
                { label: 'CxC — Cuentas por cobrar', val: cxcPendiente, sub: `${facturas.filter(f => f.estadoCalculado === 'Sin Pagar' || f.estadoCalculado === 'Parcial').length} facturas pendientes` },
                { label: `Inventario ${loadingInv ? '(calculando...)' : '(PEPS)'}`, val: valorInventario, sub: productosSinPrecio.length > 0 ? `⚠️ ${productosSinPrecio.length} sin precio` : 'Valorizado a costo PEPS' },
                { label: 'Deudas activas — me deben', val: activosDeudas, sub: `${deudas.filter(d => d.tipo === 'empresa_debe' && d.estado === 'pendiente').length} deudas` },
              ].map(item => (
                <tr key={item.label} onMouseEnter={e => e.currentTarget.style.background = '#f8fff8'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={S.td}>
                    <p style={{ fontWeight: 500, margin: 0 }}>{item.label}</p>
                    <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>{item.sub}</p>
                  </td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: C.green.text, fontFamily: 'monospace' }}>{fmtUSD(item.val)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pasivos + Patrimonio */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={S.card}>
            <div style={{ padding: '14px 18px', borderBottom: '0.5px solid rgba(0,0,0,.06)', background: C.red.bg }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.red.text, textTransform: 'uppercase', letterSpacing: '.08em', margin: 0 }}>Pasivos</p>
              <p style={{ fontSize: 24, fontWeight: 800, color: C.red.text, margin: '4px 0 0', fontFamily: 'monospace' }}>{fmtUSD(totalPasivos)}</p>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  { label: 'CxP — Crédito pendiente', val: cxpOrdenes, sub: `${ordenes.filter(o => o.estadoCalculado === 'Crédito pendiente' || o.estadoCalculado === 'Vencida').length} órdenes` },
                  { label: 'Deudas pasivas — yo debo', val: pasivosDeudas, sub: `${deudas.filter(d => d.tipo === 'yo_debo' && d.estado === 'pendiente').length} deudas` },
                ].map(item => (
                  <tr key={item.label} onMouseEnter={e => e.currentTarget.style.background = '#fff8f8'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={S.td}>
                      <p style={{ fontWeight: 500, margin: 0 }}>{item.label}</p>
                      <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>{item.sub}</p>
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: C.red.text, fontFamily: 'monospace' }}>{fmtUSD(item.val)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Patrimonio */}
          <div style={{ background: patrimonio >= 0 ? 'linear-gradient(135deg,#0f2340,#1a4a30)' : 'linear-gradient(135deg,#2a0a0a,#4a1010)', borderRadius: 12, padding: '20px 22px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.12em', margin: '0 0 8px' }}>Patrimonio neto</p>
            <p style={{ fontSize: 28, fontWeight: 800, color: patrimonio >= 0 ? '#86efac' : '#fca5a5', margin: 0, fontFamily: 'monospace', letterSpacing: '-1px' }}>
              {patrimonio >= 0 ? '+' : ''}{fmtUSD(patrimonio)}
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', margin: '6px 0 0' }}>Activos − Pasivos · T/C ₡{tc}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: CxC ─────────────────────────────────────────────────────────────────
function TabCxC({ facturas, cuentas, onAbono, navigate }) {
  const [busqueda, setBusqueda] = useState('')
  const [filtro,   setFiltro]   = useState('pendientes')
  const [modalFac, setModalFac] = useState(null)

  const ESTADO_CFG = { 'Sin Pagar': C.red, 'Parcial': C.amber, 'Pagada': C.green, 'Incobrable': C.purple }

  const filtradas = useMemo(() => facturas.filter(f => {
    const est = f.estadoCalculado
    if (filtro === 'pendientes' && est !== 'Sin Pagar' && est !== 'Parcial') return false
    if (filtro === 'pagadas'    && est !== 'Pagada') return false
    if (busqueda) { const q = busqueda.toLowerCase(); if (!f.clienteNombre?.toLowerCase().includes(q) && !f.numero?.toLowerCase().includes(q)) return false }
    return true
  }), [facturas, filtro, busqueda])

  const totalPendiente = useMemo(() => facturas.filter(f => f.estadoCalculado === 'Sin Pagar' || f.estadoCalculado === 'Parcial').reduce((s, f) => s + Number(f.saldo ?? 0), 0), [facturas])
  const vencidas = useMemo(() => facturas.filter(f => { const dias = diasRestantes(f.fechaVencimiento); return (f.estadoCalculado === 'Sin Pagar' || f.estadoCalculado === 'Parcial') && dias !== null && dias < 0 }), [facturas])

  return (
    <div>
      {modalFac && <ModalAbonoCxC factura={modalFac} cuentas={cuentas} onGuardar={async (f, p) => { await onAbono(f, p); setModalFac(null) }} onCerrar={() => setModalFac(null)} />}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <MetCard label="Por cobrar" valor={fmtUSD(totalPendiente)} palette={C.blue} sub={`${filtradas.filter(f => f.estadoCalculado === 'Sin Pagar' || f.estadoCalculado === 'Parcial').length} facturas pendientes`} />
        <MetCard label="Vencidas" valor={vencidas.length} palette={C.red} sub={vencidas.length > 0 ? `${fmtUSD(vencidas.reduce((s, f) => s + Number(f.saldo ?? 0), 0))} en riesgo` : 'Sin vencidas'} />
        <MetCard label="Total facturas" valor={facturas.length} palette={C.gray} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <input style={{ ...S.inp, width: 230 }} placeholder="Buscar cliente o número..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        {[['pendientes', 'Pendientes'], ['pagadas', 'Pagadas'], ['todas', 'Todas']].map(([val, lbl]) => (
          <button key={val} onClick={() => setFiltro(val)} style={{ ...S.btnSm, background: filtro === val ? C.primary : '#fff', color: filtro === val ? '#fff' : '#555', borderColor: filtro === val ? 'transparent' : 'rgba(0,0,0,.15)' }}>{lbl}</button>
        ))}
      </div>
      <div style={S.card}>
        {filtradas.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}><div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>Sin facturas {filtro === 'pendientes' ? 'pendientes' : ''}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['#', 'Cliente', 'Total', 'Saldo', 'Estado', 'Vencimiento', ''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {filtradas.map(f => {
                  const est = f.estadoCalculado; const cfg = ESTADO_CFG[est] || C.gray
                  const dias = diasRestantes(f.fechaVencimiento)
                  const vencida = (est === 'Sin Pagar' || est === 'Parcial') && dias !== null && dias < 0
                  const proxima = !vencida && dias !== null && dias <= 5 && (est === 'Sin Pagar' || est === 'Parcial')
                  return (
                    <tr key={f.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/facturacion/${f.id}`)} onMouseEnter={e => e.currentTarget.style.background = '#fafbff'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11, color: '#94a3b8' }}>{f.numero}</td>
                      <td style={S.td}><p style={{ fontWeight: 500, margin: 0 }}>{f.clienteNombre || '—'}</p>{f.vendedorNombre && <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{f.vendedorNombre}</p>}</td>
                      <td style={{ ...S.td, fontWeight: 500 }}>{fmt(f.total, f.moneda)}</td>
                      <td style={{ ...S.td, fontWeight: 700, color: Number(f.saldo) <= 0 ? '#94a3b8' : '#A32D2D' }}>{Number(f.saldo) <= 0 ? '—' : fmt(f.saldo, f.moneda)}</td>
                      <td style={S.td}><Badge label={est} palette={cfg} /></td>
                      <td style={{ ...S.td, fontSize: 12 }}>
                        <span style={{ color: vencida ? '#A32D2D' : proxima ? '#854F0B' : '#666' }}>
                          {fmtFecha(f.fechaVencimiento)}
                          {vencida && <span style={{ marginLeft: 5, fontSize: 9, background: '#FCEBEB', color: '#A32D2D', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>VENC.</span>}
                          {proxima && <span style={{ marginLeft: 5, fontSize: 9, background: '#FAEEDA', color: '#854F0B', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>{dias}d</span>}
                        </span>
                      </td>
                      <td style={S.td} onClick={e => e.stopPropagation()}>
                        {(est === 'Sin Pagar' || est === 'Parcial') && (
                          <button onClick={() => setModalFac(f)} style={{ padding: '5px 12px', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: C.green.bg, color: C.green.text, fontFamily: 'inherit' }}>+ Abono</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab: CxP ─────────────────────────────────────────────────────────────────
function TabCxP({ ordenes, navigate }) {
  const pendientes = useMemo(() => ordenes.filter(o => o.estadoCalculado === 'Crédito pendiente' || o.estadoCalculado === 'Vencida')
    .sort((a, b) => (diasRestantes(a.fechaVencimientoPago) ?? 9999) - (diasRestantes(b.fechaVencimientoPago) ?? 9999))
  , [ordenes])

  const ESTADO_CFG = {
    'Crédito pendiente': C.amber,
    'Vencida':           C.red,
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <MetCard label="Por pagar" valor={fmtUSD(pendientes.reduce((s, o) => s + Number(o.saldo ?? o.total ?? 0), 0))} palette={C.amber} sub={`${pendientes.length} órdenes con crédito`} />
        <MetCard label="Vencidas" valor={pendientes.filter(o => o.estadoCalculado === 'Vencida').length} palette={C.red} />
      </div>
      <div style={S.card}>
        {pendientes.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}><div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>Sin créditos pendientes</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Proveedor', '#', 'Total', 'Saldo', 'Estado', 'Vencimiento', ''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {pendientes.map(o => {
                  const cfg = ESTADO_CFG[o.estadoCalculado] || C.amber
                  const dias = diasRestantes(o.fechaVencimientoPago)
                  const vencida = o.estadoCalculado === 'Vencida'
                  const proxima = !vencida && dias !== null && dias <= 5
                  const saldo = Number(o.saldo ?? o.total ?? 0)
                  const total = Number(o.total ?? 0)
                  const pct   = total > 0 ? Math.min(100, Math.round(((total - saldo) / total) * 100)) : 0
                  return (
                    <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/compras/${o.id}`)} onMouseEnter={e => e.currentTarget.style.background = '#fafafa'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td style={{ ...S.td, fontWeight: 500 }}>{o.proveedorNombre || '—'}</td>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11, color: '#94a3b8' }}>{o.numero}</td>
                      <td style={{ ...S.td, fontWeight: 500 }}>{fmt(o.total, o.moneda)}</td>
                      <td style={{ ...S.td, fontWeight: 700, color: '#A32D2D' }}>{fmt(saldo, o.moneda)}</td>
                      <td style={S.td}><Badge label={o.estadoCalculado} palette={cfg} /></td>
                      <td style={{ ...S.td, fontSize: 12 }}>
                        <span style={{ color: vencida ? '#A32D2D' : proxima ? '#854F0B' : '#666' }}>
                          {fmtFecha(o.fechaVencimientoPago)}
                          {vencida && <span style={{ marginLeft: 5, fontSize: 9, background: '#FCEBEB', color: '#A32D2D', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>VENC.</span>}
                          {proxima && <span style={{ marginLeft: 5, fontSize: 9, background: '#FAEEDA', color: '#854F0B', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>{dias}d</span>}
                        </span>
                      </td>
                      <td style={S.td} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 48, height: 4, background: '#f0f0f0', borderRadius: 10, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#639922' : '#EF9F27', borderRadius: 10 }} />
                          </div>
                          <span style={{ fontSize: 10, color: '#94a3b8' }}>{pct}%</span>
                          <button onClick={() => navigate(`/compras/${o.id}`)} style={{ ...S.btnSm, fontSize: 11 }}>Abonar</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab: Compras ─────────────────────────────────────────────────────────────
function TabCompras({ ordenes, navigate }) {
  const [busqueda,     setBusqueda]     = useState('')
  const [filtroEstado, setFiltroEstado] = useState('Todos')

  const ESTADO_CFG = {
    'Borrador':          C.gray,
    'Enviada':           C.blue,
    'Recibida':          C.green,
    'Pagada':            C.green,
    'Crédito pendiente': C.amber,
    'Vencida':           C.red,
    'Cancelada':         C.purple,
  }

  const filtradas = useMemo(() => ordenes.filter(o => {
    if (filtroEstado !== 'Todos' && o.estadoCalculado !== filtroEstado) return false
    if (busqueda) { const q = busqueda.toLowerCase(); if (!o.proveedorNombre?.toLowerCase().includes(q) && !o.numero?.toLowerCase().includes(q)) return false }
    return true
  }), [ordenes, filtroEstado, busqueda])

  const ESTADOS = ['Todos', 'Borrador', 'Enviada', 'Recibida', 'Crédito pendiente', 'Pagada', 'Vencida']

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input style={{ ...S.inp, width: 220 }} placeholder="Buscar proveedor o número..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {ESTADOS.map(e => (
              <button key={e} onClick={() => setFiltroEstado(e)} style={{ ...S.btnSm, fontSize: 11, background: filtroEstado === e ? C.primary : '#fff', color: filtroEstado === e ? '#fff' : '#555', borderColor: filtroEstado === e ? 'transparent' : 'rgba(0,0,0,.15)' }}>{e}</button>
            ))}
          </div>
        </div>
        <button onClick={() => navigate('/compras/nueva')} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: C.primary, color: '#fff', fontFamily: 'inherit' }}>+ Nueva orden</button>
      </div>
      <div style={S.card}>
        {filtradas.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}><div style={{ fontSize: 32, marginBottom: 8 }}>🛒</div>Sin órdenes de compra</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['#', 'Proveedor', 'Tipo', 'Total', 'Estado', 'Vencimiento', 'Fecha', ''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {filtradas.map(o => {
                  const cfg  = ESTADO_CFG[o.estadoCalculado] || C.gray
                  const dias = diasRestantes(o.fechaVencimientoPago)
                  const vencida = o.estadoCalculado === 'Vencida'
                  const proxima = !vencida && o.estadoCalculado === 'Crédito pendiente' && dias !== null && dias <= 5
                  return (
                    <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/compras/${o.id}`)} onMouseEnter={e => e.currentTarget.style.background = '#fafafa'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11, color: '#94a3b8' }}>{o.numero}</td>
                      <td style={{ ...S.td, fontWeight: 500 }}>{o.proveedorNombre || '—'}{o.descripcion && <p style={{ fontSize: 11, color: '#94a3b8', margin: '1px 0 0' }}>{o.descripcion}</p>}</td>
                      <td style={S.td}><Badge label={o.tipo === 'inventariable' ? 'Inventario' : 'Gasto'} palette={o.tipo === 'inventariable' ? C.blue : C.amber} /></td>
                      <td style={{ ...S.td, fontWeight: 600 }}>{fmt(o.total, o.moneda)}</td>
                      <td style={S.td}><Badge label={o.estadoCalculado} palette={cfg} /></td>
                      <td style={{ ...S.td, fontSize: 12 }}>
                        {o.fechaVencimientoPago ? (
                          <span style={{ color: vencida ? '#A32D2D' : proxima ? '#854F0B' : '#666' }}>
                            {fmtFecha(o.fechaVencimientoPago)}
                            {vencida && <span style={{ marginLeft: 5, fontSize: 9, background: '#FCEBEB', color: '#A32D2D', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>VENC.</span>}
                            {proxima && <span style={{ marginLeft: 5, fontSize: 9, background: '#FAEEDA', color: '#854F0B', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>{dias}d</span>}
                          </span>
                        ) : <span style={{ color: '#ccc' }}>—</span>}
                      </td>
                      <td style={{ ...S.td, fontSize: 12, color: '#94a3b8' }}>{o.creadoEn?.toDate ? o.creadoEn.toDate().toLocaleDateString('es-CR') : '—'}</td>
                      <td style={S.td} onClick={e => e.stopPropagation()}>
                        <button onClick={() => navigate(`/compras/${o.id}`)} style={S.btnSm}>Ver</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab: Proveedores ─────────────────────────────────────────────────────────
function TabProveedores({ proveedores, onNuevo, onEditar }) {
  const [busqueda, setBusqueda]   = useState('')
  const [soloActivos, setSoloActivos] = useState(true)
  const [modal, setModal]         = useState(false)
  const [editando, setEditando]   = useState(null)
  const [guardando, setGuardando] = useState(false)

  const filtrados = proveedores.filter(p => {
    if (soloActivos && p.activo === false) return false
    if (busqueda) { const q = busqueda.toLowerCase(); if (!p.nombreComercial?.toLowerCase().includes(q) && !p.razonSocial?.toLowerCase().includes(q)) return false }
    return true
  })

  const guardarProveedor = async (form) => {
    setGuardando(true)
    if (editando) {
      await updateDoc(doc(db, 'proveedores', editando.id), { ...form, actualizadoEn: serverTimestamp() })
    } else {
      await addDoc(collection(db, 'proveedores'), { ...form, productos: [], creadoEn: serverTimestamp() })
    }
    setModal(false); setEditando(null); setGuardando(false)
  }

  const [formProv, setFormProv] = useState({ nombreComercial: '', razonSocial: '', cedula: '', contacto: '', telefono: '', email: '', direccion: '', notas: '', activo: true })
  const abrirModal = (p = null) => {
    setEditando(p)
    setFormProv(p ? { nombreComercial: p.nombreComercial || '', razonSocial: p.razonSocial || '', cedula: p.cedula || '', contacto: p.contacto || '', telefono: p.telefono || '', email: p.email || '', direccion: p.direccion || '', notas: p.notas || '', activo: p.activo !== false } : { nombreComercial: '', razonSocial: '', cedula: '', contacto: '', telefono: '', email: '', direccion: '', notas: '', activo: true })
    setModal(true)
  }

  return (
    <div>
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={{ background: '#fff', borderRadius: 14, width: '95%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,.2)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{editando ? 'Editar proveedor' : 'Nuevo proveedor'}</div>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa' }}>×</button>
            </div>
            <div style={{ padding: 20, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[['nombreComercial', 'Nombre comercial *', ''], ['razonSocial', 'Razón social', ''], ['cedula', 'Cédula / RUC', ''], ['contacto', 'Contacto principal', ''], ['telefono', 'Teléfono', ''], ['email', 'Email', 'email'], ['direccion', 'Dirección', '']].map(([k, lbl, type]) => (
                <div key={k} style={k === 'direccion' ? { gridColumn: '1/-1' } : {}}>
                  <label style={S.lbl}>{lbl}</label>
                  <input style={S.inp2} type={type || 'text'} value={formProv[k]} onChange={e => setFormProv(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.lbl}>Notas</label>
                <textarea style={{ ...S.inp2, resize: 'vertical' }} rows={2} value={formProv.notas} onChange={e => setFormProv(f => ({ ...f, notas: e.target.value }))} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, gridColumn: '1/-1' }}>
                <input type="checkbox" checked={formProv.activo} onChange={e => setFormProv(f => ({ ...f, activo: e.target.checked }))} style={{ accentColor: C.primary, width: 15, height: 15 }} />
                Proveedor activo
              </label>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(0,0,0,.08)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
              <button onClick={() => setModal(false)} style={{ padding: '8px 16px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: '#f5f5f5', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={() => guardarProveedor(formProv)} disabled={guardando || !formProv.nombreComercial.trim()} style={{ padding: '8px 22px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: C.primary, color: '#fff', fontFamily: 'inherit' }}>
                {guardando ? 'Guardando...' : editando ? 'Guardar' : 'Crear proveedor'}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input style={{ ...S.inp, width: 240 }} placeholder="Buscar proveedor..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={soloActivos} onChange={e => setSoloActivos(e.target.checked)} style={{ accentColor: C.primary }} />Solo activos
          </label>
        </div>
        <button onClick={() => abrirModal()} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: C.primary, color: '#fff', fontFamily: 'inherit' }}>+ Nuevo proveedor</button>
      </div>

      <div style={S.card}>
        {filtrados.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}><div style={{ fontSize: 32, marginBottom: 8 }}>🏢</div>Sin proveedores</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Proveedor', 'Contacto', 'Teléfono', 'Email', 'Estado', ''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {filtrados.map(p => (
                <tr key={p.id} onMouseEnter={e => e.currentTarget.style.background = '#fafafa'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={S.td}><p style={{ fontWeight: 600, margin: 0 }}>{p.nombreComercial}</p>{p.razonSocial && p.razonSocial !== p.nombreComercial && <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{p.razonSocial}</p>}{p.cedula && <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>{p.cedula}</p>}</td>
                  <td style={{ ...S.td, color: '#666' }}>{p.contacto || '—'}</td>
                  <td style={{ ...S.td, color: '#666' }}>{p.telefono || '—'}</td>
                  <td style={{ ...S.td, color: '#666', fontSize: 12 }}>{p.email || '—'}</td>
                  <td style={S.td}><Badge label={p.activo !== false ? 'Activo' : 'Inactivo'} palette={p.activo !== false ? C.green : C.gray} /></td>
                  <td style={S.td} onClick={e => e.stopPropagation()}>
                    <button onClick={() => abrirModal(p)} style={S.btnSm}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── Tab: Gastos Recurrentes ──────────────────────────────────────────────────
function TabGastosRecurrentes({ gastos, navigate }) {
  const [filtro, setFiltro] = useState('urgentes')
  const FREQ_LABEL = { mensual: 'Mensual', bimestral: 'Bimestral', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual', semanal: 'Semanal' }

  const activos = useMemo(() => gastos.filter(g => g.activo !== false), [gastos])
  const filtrados = useMemo(() => {
    return activos.filter(g => {
      if (filtro === 'urgentes') return g.diaDelMes && (diasHastaDelMes(g.diaDelMes) ?? 999) <= 7
      if (filtro === 'proximos') return g.diaDelMes && (diasHastaDelMes(g.diaDelMes) ?? 999) <= 30
      return true
    }).sort((a, b) => (diasHastaDelMes(a.diaDelMes) ?? 999) - (diasHastaDelMes(b.diaDelMes) ?? 999))
  }, [activos, filtro])

  const totalMensualCRC = activos.filter(g => g.moneda !== 'USD' && g.frecuencia === 'mensual').reduce((s, g) => s + Number(g.monto || 0), 0)
  const totalMensualUSD = activos.filter(g => g.moneda === 'USD' && g.frecuencia === 'mensual').reduce((s, g) => s + Number(g.monto || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {totalMensualCRC > 0 && <MetCard label="Gastos fijos/mes (CRC)" valor={fmtCRC(totalMensualCRC)} palette={C.amber} />}
        {totalMensualUSD > 0 && <MetCard label="Gastos fijos/mes (USD)" valor={fmtUSD(totalMensualUSD)} palette={C.amber} />}
        <MetCard label="Gastos activos" valor={activos.length} palette={C.gray} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['urgentes', '🔴 7 días'], ['proximos', '🟡 30 días'], ['todos', 'Todos']].map(([val, lbl]) => (
            <button key={val} onClick={() => setFiltro(val)} style={{ ...S.btnSm, background: filtro === val ? C.primary : '#fff', color: filtro === val ? '#fff' : '#555', borderColor: filtro === val ? 'transparent' : 'rgba(0,0,0,.15)' }}>{lbl}</button>
          ))}
        </div>
        <button onClick={() => navigate('/compras/recurrentes')} style={{ padding: '7px 14px', border: `1px solid ${C.primary}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'transparent', color: C.primary, fontFamily: 'inherit' }}>Gestionar gastos →</button>
      </div>
      {filtrados.length === 0 ? (
        <div style={{ ...S.card, padding: '48px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}><div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>Sin gastos {filtro === 'urgentes' ? 'urgentes' : 'próximos'}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {filtrados.map(g => {
            const dias = diasHastaDelMes(g.diaDelMes)
            const muyUrgente = dias !== null && dias <= 2
            const urgente    = dias !== null && dias <= (g.alertaDias || 5)
            return (
              <div key={g.id} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', border: `1.5px solid ${muyUrgente ? '#E24B4A' : urgente ? '#EF9F27' : 'rgba(0,0,0,.08)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.nombre}</p>
                    <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                      <Badge label={FREQ_LABEL[g.frecuencia] || g.frecuencia} palette={C.amber} />
                      {g.categoria && <Badge label={g.categoria} palette={C.gray} />}
                    </div>
                  </div>
                  <p style={{ fontSize: 18, fontWeight: 700, color: C.primary, margin: '0 0 0 8px', flexShrink: 0 }}>{fmt(g.monto, g.moneda || 'USD')}</p>
                </div>
                {g.proveedor && <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 8px' }}>🏢 {g.proveedor}</p>}
                <div style={{ padding: '8px 10px', borderRadius: 7, marginBottom: 12, background: muyUrgente ? '#FCEBEB' : urgente ? '#FAEEDA' : '#f8f9fb' }}>
                  <p style={{ fontSize: 11, margin: 0, fontWeight: urgente ? 600 : 400, color: muyUrgente ? '#A32D2D' : urgente ? '#854F0B' : '#94a3b8' }}>
                    {dias === null ? '📅 Sin fecha' : `${muyUrgente ? '🔴' : urgente ? '🟡' : '📅'} Día ${g.diaDelMes} — ${dias === 0 ? 'hoy' : `en ${dias}d`}`}
                  </p>
                </div>
                <button onClick={() => navigate('/compras/nueva', { state: { gastoRecurrente: g } })} style={{ width: '100%', padding: '8px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: C.primary, color: '#fff', fontFamily: 'inherit' }}>
                  + Registrar este período
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Deudas ──────────────────────────────────────────────────────────────
function TabDeudas({ deudas, cuentas, onNueva, onEditar, onEliminar, onMarcarPagada, onAbono }) {
  const [filtro,      setFiltro]      = useState('pendientes')
  const [confirmElim, setConfirmElim] = useState(null)
  const [modalAbono,  setModalAbono]  = useState(null)

  const filtradas = useMemo(() => deudas.filter(d => {
    if (filtro === 'pendientes' && d.estado !== 'pendiente') return false
    if (filtro === 'pagadas'    && d.estado !== 'pagada')    return false
    return true
  }), [deudas, filtro])

  const yoDebo      = deudas.filter(d => d.tipo === 'yo_debo'      && d.estado === 'pendiente')
  const empresaDebe = deudas.filter(d => d.tipo === 'empresa_debe' && d.estado === 'pendiente')

  return (
    <div>
      {modalAbono && (
        <ModalAbonoDeuda deuda={modalAbono} cuentas={cuentas} onGuardar={async (d, abono) => { await onAbono(d, abono); setModalAbono(null) }} onCerrar={() => setModalAbono(null)} />
      )}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <MetCard label="Yo debo (pasivos)" valor={`${yoDebo.length} deuda${yoDebo.length !== 1 ? 's' : ''}`} palette={C.red} sub={yoDebo.length > 0 ? fmtUSD(yoDebo.reduce((s, d) => s + Number(d.saldo ?? d.monto ?? 0), 0)) : ''} />
        <MetCard label="Me deben (activos)" valor={`${empresaDebe.length} deuda${empresaDebe.length !== 1 ? 's' : ''}`} palette={C.green} sub={empresaDebe.length > 0 ? fmtUSD(empresaDebe.reduce((s, d) => s + Number(d.saldo ?? d.monto ?? 0), 0)) : ''} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['pendientes', 'Pendientes'], ['pagadas', 'Saldadas'], ['todas', 'Todas']].map(([val, lbl]) => (
            <button key={val} onClick={() => setFiltro(val)} style={{ ...S.btnSm, background: filtro === val ? C.primary : '#fff', color: filtro === val ? '#fff' : '#555', borderColor: filtro === val ? 'transparent' : 'rgba(0,0,0,.15)' }}>{lbl}</button>
          ))}
        </div>
        <button onClick={onNueva} style={{ padding: '7px 16px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: C.primary, color: '#fff', fontFamily: 'inherit' }}>+ Nueva deuda</button>
      </div>
      {filtradas.length === 0 ? (
        <div style={{ ...S.card, padding: '48px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}><div style={{ fontSize: 32, marginBottom: 8 }}>🤝</div>Sin deudas {filtro === 'pendientes' ? 'pendientes' : filtro === 'pagadas' ? 'saldadas' : ''}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtradas.map(d => {
            const palette   = d.tipo === 'yo_debo' ? C.red : C.green
            const pendiente = d.estado === 'pendiente'
            const saldo     = Number(d.saldo ?? d.monto ?? 0)
            const monto     = Number(d.monto ?? 0)
            const pct       = monto > 0 ? Math.round(((monto - saldo) / monto) * 100) : 0
            return (
              <div key={d.id} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: `1.5px solid ${pendiente ? palette.bg : 'rgba(0,0,0,.06)'}`, display: 'flex', alignItems: 'center', gap: 16, opacity: pendiente ? 1 : 0.65 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: palette.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                  {d.tipo === 'yo_debo' ? '🔴' : '🟢'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.descripcion}</p>
                    <Badge label={d.tipo === 'yo_debo' ? 'Yo debo' : 'Me deben'} palette={palette} />
                    {!pendiente && <Badge label="Saldada" palette={C.green} />}
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#94a3b8', flexWrap: 'wrap' }}>
                    <span>👤 {d.acreedor}</span>
                    {d.usado_para && <span>📌 {d.usado_para}</span>}
                    <span>📅 {fmtFecha(d.fecha)}</span>
                  </div>
                  {/* Barra de progreso si tiene abonos */}
                  {monto > 0 && saldo < monto && (
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 4, background: '#f0f0f0', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#639922' : palette.dot, borderRadius: 10 }} />
                      </div>
                      <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>Pagado {pct}%</span>
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontSize: 18, fontWeight: 700, color: palette.text, margin: 0 }}>{fmt(saldo, d.moneda)}</p>
                  {saldo !== monto && <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0' }}>de {fmt(monto, d.moneda)}</p>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {pendiente && (
                    <button onClick={() => setModalAbono(d)} style={{ padding: '5px 10px', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: palette.bg, color: palette.text, fontFamily: 'inherit' }}>+ Abono</button>
                  )}
                  <button onClick={() => onEditar(d)} style={{ ...S.btnSm, fontSize: 14 }}>✎</button>
                  {confirmElim === d.id ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => { onEliminar(d.id); setConfirmElim(null) }} style={{ padding: '4px 8px', border: 'none', borderRadius: 5, fontSize: 11, cursor: 'pointer', background: '#FCEBEB', color: '#A32D2D', fontFamily: 'inherit', fontWeight: 600 }}>Sí</button>
                      <button onClick={() => setConfirmElim(null)} style={S.btnSm}>No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmElim(d.id)} style={{ ...S.btnSm, color: '#ddd', fontSize: 14 }} onMouseEnter={e => e.currentTarget.style.color = '#E24B4A'} onMouseLeave={e => e.currentTarget.style.color = '#ddd'}>✕</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Flujo de Caja ────────────────────────────────────────────────────────
function TabFlujo({ facturas, ordenes, tc }) {
  const [vista, setVista] = useState('historico')

  // Histórico: pagos recibidos + pagos realizados
  const movimientos = useMemo(() => {
    const movs = []
    facturas.forEach(f => {
      ;(f.pagos || []).forEach(p => {
        if (!p.fecha) return
        movs.push({ id: `${f.id}-${p.fecha}-${p.monto}`, fecha: p.fecha, tipo: 'ingreso', concepto: `Cobro — ${f.clienteNombre || f.numero}`, monto: toUSD(p.monto, f.moneda, tc), montoOriginal: p.monto, moneda: f.moneda, ref: f.numero })
      })
    })
    ordenes.filter(o => o.estado === 'Pagada' || o.totalPagado > 0).forEach(o => {
      ;(o.pagos || []).forEach(p => {
        if (!p.fecha) return
        movs.push({ id: `${o.id}-${p.fecha}-${p.monto}`, fecha: p.fecha, tipo: 'egreso', concepto: `Pago — ${o.proveedorNombre || o.numero}`, monto: toUSD(p.monto, o.moneda, tc), montoOriginal: p.monto, moneda: o.moneda, ref: o.numero })
      })
    })
    return movs.sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [facturas, ordenes, tc])

  // Proyección: CxC pendiente vs CxP + créditos pendientes
  const proyeccion = useMemo(() => {
    const items = []
    facturas.filter(f => f.estadoCalculado === 'Sin Pagar' || f.estadoCalculado === 'Parcial').forEach(f => {
      items.push({ id: f.id, tipo: 'entrada', concepto: `Por cobrar — ${f.clienteNombre || f.numero}`, monto: toUSD(f.saldo ?? 0, f.moneda, tc), fecha: f.fechaVencimiento || '—', dias: diasRestantes(f.fechaVencimiento) })
    })
    ordenes.filter(o => o.estadoCalculado === 'Crédito pendiente' || o.estadoCalculado === 'Vencida').forEach(o => {
      items.push({ id: o.id, tipo: 'salida', concepto: `Por pagar — ${o.proveedorNombre || o.numero}`, monto: toUSD(o.saldo ?? o.total ?? 0, o.moneda, tc), fecha: o.fechaVencimientoPago || '—', dias: diasRestantes(o.fechaVencimientoPago) })
    })
    return items.sort((a, b) => (a.dias ?? 999) - (b.dias ?? 999))
  }, [facturas, ordenes, tc])

  const totalIngresos  = movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
  const totalEgresos   = movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0)
  const totalEntradas  = proyeccion.filter(i => i.tipo === 'entrada').reduce((s, i) => s + i.monto, 0)
  const totalSalidas   = proyeccion.filter(i => i.tipo === 'salida').reduce((s, i) => s + i.monto, 0)
  const flujoNeto      = totalEntradas - totalSalidas

  return (
    <div>
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: '#f1f5f9', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {[['historico', '📊 Histórico real'], ['proyeccion', '🔮 Proyección']].map(([val, lbl]) => (
          <button key={val} onClick={() => setVista(val)} style={{ padding: '8px 20px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: vista === val ? '#fff' : 'transparent', color: vista === val ? C.primary : '#94a3b8', boxShadow: vista === val ? '0 1px 4px rgba(0,0,0,.1)' : 'none' }}>{lbl}</button>
        ))}
      </div>

      {vista === 'historico' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <MetCard label="Ingresos cobrados" valor={fmtUSD(totalIngresos)} palette={C.green} sub={`${movimientos.filter(m => m.tipo === 'ingreso').length} pagos`} />
            <MetCard label="Egresos pagados"   valor={fmtUSD(totalEgresos)}  palette={C.red}   sub={`${movimientos.filter(m => m.tipo === 'egreso').length} pagos`} />
            <MetCard label="Balance neto" valor={fmtUSD(totalIngresos - totalEgresos)} palette={totalIngresos >= totalEgresos ? C.green : C.red} />
          </div>
          <div style={S.card}>
            {movimientos.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}><div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>Sin movimientos registrados aún</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Fecha', 'Concepto', 'Tipo', 'Monto original', 'USD equiv.'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {movimientos.map(m => (
                      <tr key={m.id} onMouseEnter={e => e.currentTarget.style.background = '#fafbff'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                        <td style={{ ...S.td, fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{fmtFecha(m.fecha)}</td>
                        <td style={{ ...S.td, fontWeight: 500 }}>{m.concepto}</td>
                        <td style={S.td}><Badge label={m.tipo === 'ingreso' ? '↑ Ingreso' : '↓ Egreso'} palette={m.tipo === 'ingreso' ? C.green : C.red} /></td>
                        <td style={{ ...S.td, fontWeight: 600 }}>{fmt(m.montoOriginal, m.moneda)}</td>
                        <td style={{ ...S.td, fontWeight: 700, color: m.tipo === 'ingreso' ? C.green.text : C.red.text, fontFamily: 'monospace' }}>{fmtUSD(m.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {vista === 'proyeccion' && (
        <div>
          <div style={{ background: flujoNeto >= 0 ? 'linear-gradient(135deg,#0f2340,#1a4a30)' : 'linear-gradient(135deg,#2a0a0a,#4a1a1a)', borderRadius: 16, padding: '24px 28px', marginBottom: 20, textAlign: 'center' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.12em', margin: '0 0 8px' }}>Flujo neto proyectado (USD)</p>
            <p style={{ fontSize: 36, fontWeight: 800, color: flujoNeto >= 0 ? '#86efac' : '#fca5a5', margin: 0, letterSpacing: '-1px', fontFamily: 'monospace' }}>{flujoNeto >= 0 ? '+' : ''}{fmtUSD(flujoNeto)}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', margin: '8px 0 0' }}>Entradas: {fmtUSD(totalEntradas)} — Salidas: {fmtUSD(totalSalidas)}</p>
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <MetCard label="Entradas esperadas" valor={fmtUSD(totalEntradas)} palette={C.green} sub={`${proyeccion.filter(i => i.tipo === 'entrada').length} facturas por cobrar`} />
            <MetCard label="Salidas proyectadas" valor={fmtUSD(totalSalidas)} palette={C.red} sub={`${proyeccion.filter(i => i.tipo === 'salida').length} compromisos`} />
          </div>
          <div style={S.card}>
            {proyeccion.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}><div style={{ fontSize: 32, marginBottom: 8 }}>🔮</div>Sin compromisos proyectados</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Vencimiento', 'Concepto', 'Flujo', 'USD equiv.'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {proyeccion.map(i => (
                      <tr key={i.id} onMouseEnter={e => e.currentTarget.style.background = '#fafbff'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                        <td style={{ ...S.td, fontSize: 12 }}>
                          <span style={{ color: i.dias !== null && i.dias < 0 ? '#A32D2D' : i.dias !== null && i.dias <= 7 ? '#854F0B' : '#94a3b8' }}>
                            {fmtFecha(i.fecha)}
                            {i.dias !== null && i.dias <= 30 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700 }}>{i.dias < 0 ? '(vencida)' : i.dias === 0 ? '(hoy)' : `(${i.dias}d)`}</span>}
                          </span>
                        </td>
                        <td style={{ ...S.td, fontWeight: 500 }}>{i.concepto}</td>
                        <td style={S.td}><Badge label={i.tipo === 'entrada' ? '↑ Entrada' : '↓ Salida'} palette={i.tipo === 'entrada' ? C.green : C.red} /></td>
                        <td style={{ ...S.td, fontWeight: 700, color: i.tipo === 'entrada' ? C.green.text : C.red.text, fontFamily: 'monospace' }}>{fmtUSD(i.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab Bancos ───────────────────────────────────────────────────────────────
function TabBancos({ cuentas, cuentasLoaded, tc }) {
  const saldoPorCuenta = useMemo(() => {
    // Calculamos el saldo de cada cuenta usando saldoInicial (sin movimientos aquí — los movimientos los tiene BancosPage)
    // Mostramos el saldo inicial como base visual; para saldo real el usuario va a /bancos
    const map = {}
    cuentas.forEach(c => { map[c.id] = Number(c.saldoInicial || 0) })
    return map
  }, [cuentas])

  const totales = useMemo(() => {
    let totalCRC = 0, totalUSD = 0
    cuentas.filter(c => c.activa !== false).forEach(c => {
      const s = saldoPorCuenta[c.id] || 0
      if (c.moneda === 'USD') totalUSD += s
      else totalCRC += s
    })
    return { totalCRC, totalUSD, totalEnCRC: totalCRC + totalUSD * (tc || 520) }
  }, [cuentas, saldoPorCuenta, tc])

  const TIPO_COLOR = {
    'Cuenta corriente':   { bg: '#E6F1FB', color: '#185FA5' },
    'Cuenta de ahorros':  { bg: '#EAF3DE', color: '#3B6D11' },
    'Tarjeta de crédito': { bg: '#FCEBEB', color: '#A32D2D' },
    'Tarjeta débito':     { bg: '#FAEEDA', color: '#854F0B' },
    'Caja chica':         { bg: '#EEEDFE', color: '#3C3489' },
    'Otro':               { bg: '#F1EFE8', color: '#5F5E5A' },
  }

  const activas = cuentas.filter(c => c.activa !== false)

  return (
    <div>
      {/* Totales */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,.08)', borderRadius: 10, padding: '16px 22px', flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>Total en CRC</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.primary }}>₡{totales.totalCRC.toLocaleString('es-CR', { minimumFractionDigits: 0 })}</div>
        </div>
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,.08)', borderRadius: 10, padding: '16px 22px', flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>Total en USD</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.primary }}>${totales.totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,.08)', borderRadius: 10, padding: '16px 22px', flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>Equivalente total (CRC)</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.green.text }}>₡{totales.totalEnCRC.toLocaleString('es-CR', { minimumFractionDigits: 0 })}</div>
        </div>
      </div>

      {/* Cuentas */}
      {!cuentasLoaded ? (
        <div style={{ padding: '48px 20px', textAlign: 'center', color: '#bbb', fontSize: 13 }}>Cargando cuentas...</div>
      ) : activas.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center', color: '#bbb', fontSize: 13 }}>
          No hay cuentas bancarias. Creá una en el módulo de Bancos.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {activas.map(c => {
            const saldo = saldoPorCuenta[c.id] || 0
            const tc_ = TIPO_COLOR[c.tipo] || TIPO_COLOR['Otro']
            return (
              <div key={c.id} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,.08)', borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: tc_.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🏦</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{c.tipo}{c.ultimos4 ? ` •••• ${c.ultimos4}` : ''}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2 }}>Saldo</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: saldo >= 0 ? C.green.text : C.red.text }}>
                      {c.moneda === 'USD' ? '$' : '₡'}{Math.abs(saldo).toLocaleString(c.moneda === 'USD' ? 'en-US' : 'es-CR', { minimumFractionDigits: c.moneda === 'USD' ? 2 : 0 })}
                    </div>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: tc_.bg, color: tc_.color }}>{c.tipo}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <p style={{ fontSize: 11, color: '#bbb', marginTop: 16, textAlign: 'center' }}>
        Los saldos reflejan el saldo inicial de cada cuenta. Para ver movimientos detallados, usá el módulo <strong>Bancos</strong>.
      </p>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function FinanzasPage() {
  const navigate       = useNavigate()
  const { esAdmin, rol } = usePermisos()

  if (!esAdmin) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <p style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', color: '#1a1a1a' }}>Acceso restringido</p>
        <p style={{ fontSize: 13 }}>El módulo Finanzas es solo para Administradores.</p>
      </div>
    )
  }

  const location = useLocation()
  const [tab,       setTab]       = useState(() => new URLSearchParams(location.search).get('tab') || 'flujo')
  const [facturas,  setFacturas]  = useState([])
  const [ordenes,   setOrdenes]   = useState([])
  const [gastos,    setGastos]    = useState([])
  const [deudas,    setDeudas]    = useState([])
  const [proveedores, setProveedores] = useState([])
  const [cuentas,        setCuentas]        = useState([])
  const [cuentasLoaded,  setCuentasLoaded]  = useState(false)
  const [tc,        setTc]        = useState(520)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    const t = new URLSearchParams(location.search).get('tab')
    if (t) setTab(t)
  }, [location.search])

  // Modal deuda
  const [modalDeuda,    setModalDeuda]    = useState(false)
  const [editandoDeuda, setEditandoDeuda] = useState(null)

  // ── Firestore listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, 'facturas'), orderBy('creadoEn', 'desc')), snap => {
      setFacturas(snap.docs.map(d => { const data = { id: d.id, ...d.data() }; data.estadoCalculado = calcularEstadoFactura(data); return data }))
      setLoading(false)
    })
    const u2 = onSnapshot(query(collection(db, 'ordenes_compra'), orderBy('creadoEn', 'desc')), snap => {
      setOrdenes(snap.docs.map(d => {
        const data = { id: d.id, ...d.data() }
        let estado = data.estado || 'Borrador'
        if (estado === 'Crédito pendiente' && data.fechaVencimientoPago) {
          const dias = diasRestantes(data.fechaVencimientoPago)
          if (dias !== null && dias < 0) estado = 'Vencida'
        }
        data.estadoCalculado = estado
        return data
      }))
    })
    const u3 = onSnapshot(collection(db, 'gastos_recurrentes'), snap => {
      setGastos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    const u4 = onSnapshot(query(collection(db, 'deudas'), orderBy('fecha', 'desc')), snap => {
      setDeudas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    const u5 = onSnapshot(collection(db, 'proveedores'), snap => {
      setProveedores(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    const u6 = onSnapshot(doc(db, 'configuracion', 'tasas'), snap => {
      if (snap.exists()) { const v = snap.data().venta || snap.data().compra; if (v) setTc(Number(v)) }
    })
    const u7 = onSnapshot(collection(db, 'cuentas_bancarias'), snap => {
      setCuentas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCuentasLoaded(true)
    })
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7() }
  }, [])

  // ── Acciones CxC ──────────────────────────────────────────────────────────────
  const handleAbonoCxC = useCallback(async (factura, pago) => {
    const nuevosPagos = [...(factura.pagos || []), { ...pago, registradoPor: 'Finanzas', registradoEn: new Date().toISOString() }]
    const totalPagado = nuevosPagos.reduce((acc, p) => acc + Number(p.monto), 0)
    const saldo       = Math.max(0, Number(factura.total) - totalPagado)
    const estado      = saldo <= 0 ? 'Pagada' : totalPagado > 0 ? 'Parcial' : 'Sin Pagar'
    await updateDoc(doc(db, 'facturas', factura.id), { pagos: nuevosPagos, totalPagado, saldo, estado, actualizadoEn: serverTimestamp() })
    // Registrar ingreso en movimientos bancarios
    if (pago.cuentaId) {
      await addDoc(collection(db, 'movimientos_bancarios'), {
        tipo:           'ingreso',
        cuentaId:       pago.cuentaId,
        moneda:         factura.moneda || 'USD',
        monto:          Number(pago.monto),
        fecha:          pago.fecha,
        descripcion:    `Abono factura ${factura.numero} — ${factura.clienteNombre}`,
        categoria:      'Ventas / Cobros',
        metodo:         pago.metodo,
        referencia:     pago.referencia || '',
        facturaId:      factura.id,
        facturaNumero:  factura.numero,
        creadoEn:       serverTimestamp(),
      })
    }
  }, [])

  // ── Acciones Deudas ───────────────────────────────────────────────────────────
  const handleGuardarDeuda = useCallback(async (form) => {
    const monto = Number(form.monto)
    if (editandoDeuda) {
      await updateDoc(doc(db, 'deudas', editandoDeuda.id), { ...form, monto, actualizadoEn: serverTimestamp() })
    } else {
      await addDoc(collection(db, 'deudas'), { ...form, monto, saldo: monto, abonos: [], creadoEn: serverTimestamp() })
    }
    setModalDeuda(false); setEditandoDeuda(null)
  }, [editandoDeuda])

  const handleEliminarDeuda = useCallback(async (id) => {
    await deleteDoc(doc(db, 'deudas', id))
  }, [])

  const handleMarcarPagadaDeuda = useCallback(async (deuda) => {
    await updateDoc(doc(db, 'deudas', deuda.id), { estado: 'pagada', saldo: 0, actualizadoEn: serverTimestamp() })
  }, [])

  const handleAbonoDeuda = useCallback(async (deuda, abono) => {
    const nuevosAbonos  = [...(deuda.abonos || []), { ...abono, registradoEn: new Date().toISOString() }]
    const totalAbonado  = nuevosAbonos.reduce((s, a) => s + Number(a.monto), 0)
    const nuevoSaldo    = Math.max(0, Number(deuda.monto) - totalAbonado)
    const nuevoEstado   = nuevoSaldo <= 0 ? 'pagada' : 'pendiente'
    await updateDoc(doc(db, 'deudas', deuda.id), { abonos: nuevosAbonos, saldo: nuevoSaldo, estado: nuevoEstado, actualizadoEn: serverTimestamp() })
    // Generar movimiento bancario automático
    if (abono.cuentaId) {
      const esYoDebo = deuda.tipo === 'yo_debo'
      const cuenta = cuentas.find(c => c.id === abono.cuentaId)
      await addDoc(collection(db, 'movimientos_bancarios'), {
        tipo: esYoDebo ? 'egreso' : 'ingreso',
        cuentaId: abono.cuentaId,
        monto: abono.monto,
        moneda: cuenta?.moneda || deuda.moneda || 'USD',
        fecha: abono.fecha,
        descripcion: `Abono deuda — ${deuda.descripcion} (${deuda.acreedor})`,
        categoria: esYoDebo ? 'Compras / Pagos' : 'Ventas / Cobros',
        metodo: abono.metodo || 'Transferencia',
        referencia: abono.notas || '',
        deudaId: deuda.id,
        registradoPor: 'Sistema',
        creadoEn: serverTimestamp(),
      })
    }
  }, [cuentas])

  const TABS = [
    { id: 'flujo',            label: '💸 Flujo de Caja'      },
    { id: 'cxc',              label: '↑ CxC'                 },
    { id: 'cxp',              label: '↓ CxP'                 },
    { id: 'deudas',           label: '🤝 Deudas'             },
  ]

  return (
    <div style={{ padding: '24px 28px', minHeight: '100vh', background: 'var(--eco-bg, #f5f6f8)' }}>

      {modalDeuda && (
        <ModalDeuda deuda={editandoDeuda} onGuardar={handleGuardarDeuda} onCerrar={() => { setModalDeuda(false); setEditandoDeuda(null) }} />
      )}

      {/* Header + Métricas */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.primary, margin: 0 }}>Finanzas</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!loading && (() => {
            const cxc = facturas.filter(f => f.estadoCalculado === 'Sin Pagar' || f.estadoCalculado === 'Parcial').reduce((s, f) => s + toUSD(f.saldo ?? 0, f.moneda, tc), 0)
            const cxp = ordenes.filter(o => o.estadoCalculado === 'Crédito pendiente' || o.estadoCalculado === 'Vencida').reduce((s, o) => s + toUSD(o.saldo ?? o.total ?? 0, o.moneda, tc), 0)
            const pas = deudas.filter(d => d.tipo === 'yo_debo' && d.estado === 'pendiente').reduce((s, d) => s + toUSD(d.saldo ?? d.monto ?? 0, d.moneda, tc), 0)
            const act = deudas.filter(d => d.tipo === 'empresa_debe' && d.estado === 'pendiente').reduce((s, d) => s + toUSD(d.saldo ?? d.monto ?? 0, d.moneda, tc), 0)
            const neta = cxc + act - cxp - pas
            return [
              { label: 'CxC', valor: fmtUSD(cxc), color: '#3B6D11' },
              { label: 'CxP', valor: fmtUSD(cxp), color: '#854F0B' },
              { label: 'Pasivos', valor: fmtUSD(pas), color: '#A32D2D' },
              { label: 'Activos', valor: fmtUSD(act), color: '#185FA5' },
              { label: 'Neta', valor: `${neta >= 0 ? '+' : ''}${fmtUSD(neta)}`, color: neta >= 0 ? '#3B6D11' : '#A32D2D' },
            ].map(m => (
              <div key={m.label} style={{ background: '#fff', border: `1.5px solid ${m.color}33`, borderRadius: 8, padding: '4px 12px', textAlign: 'center', minWidth: 80 }}>
                <p style={{ fontSize: 9, color: '#888', margin: 0, textTransform: 'uppercase', letterSpacing: '.5px' }}>{m.label}</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: m.color, margin: 0 }}>{m.valor}</p>
              </div>
            ))
          })()}
          {tab === 'deudas' && (
            <button onClick={() => { setEditandoDeuda(null); setModalDeuda(true) }} style={{ padding: '8px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: C.primary, color: '#fff', fontFamily: 'inherit' }}>+ Nueva deuda</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '7px 14px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s', background: tab === t.id ? C.primary : '#fff', color: tab === t.id ? '#fff' : '#94a3b8', boxShadow: tab === t.id ? '0 2px 8px rgba(0,0,0,.12)' : '0 1px 3px rgba(0,0,0,.05)', border: tab === t.id ? 'none' : '0.5px solid rgba(0,0,0,.08)' }}>{t.label}</button>
        ))}
      </div>

      {/* Contenido */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>Cargando datos financieros...
        </div>
      ) : (
        <>
          {tab === 'estado_resultados' && <TabEstadoResultados  facturas={facturas} ordenes={ordenes} gastos={gastos} tc={tc} />}
          {tab === 'balance'           && <TabBalanceGeneral    facturas={facturas} ordenes={ordenes} deudas={deudas} tc={tc} />}
          {tab === 'bancos'            && <TabBancos            cuentas={cuentas} cuentasLoaded={cuentasLoaded} tc={tc} />}
          {tab === 'flujo'             && <TabDashboard          facturas={facturas} ordenes={ordenes} gastos={gastos} deudas={deudas} tc={tc} setTab={setTab} />}
          {tab === 'cxc'               && <TabCxC               facturas={facturas} cuentas={cuentas} onAbono={handleAbonoCxC} navigate={navigate} />}
          {tab === 'cxp'               && <TabCxP               ordenes={ordenes} navigate={navigate} />}
          {tab === 'deudas'            && <TabDeudas            deudas={deudas} cuentas={cuentas} onNueva={() => { setEditandoDeuda(null); setModalDeuda(true) }} onEditar={d => { setEditandoDeuda(d); setModalDeuda(true) }} onEliminar={handleEliminarDeuda} onMarcarPagada={handleMarcarPagadaDeuda} onAbono={handleAbonoDeuda} />}
        </>
      )}
    </div>
  )
}