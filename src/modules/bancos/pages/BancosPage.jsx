/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: BancosPage.jsx
 * Módulo:  Bancos
 * ============================================================
 */

import { useState, useEffect, useMemo } from 'react'
import {
  collection, onSnapshot, query, orderBy, addDoc,
  updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { db } from '../../../firebase/config'
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

const genId = () => Math.random().toString(36).slice(2, 10)

const TIPOS_CUENTA = ['Cuenta corriente', 'Cuenta de ahorros', 'Tarjeta de crédito', 'Tarjeta débito', 'Caja chica', 'Otro']
const MONEDAS      = ['CRC', 'USD']
const BANCOS_CR    = ['BAC', 'BCR', 'BNCR (Nacional)', 'Scotiabank', 'Davivienda', 'Promerica', 'Coopealianza', 'Mutual Alajuela', 'Otro']
const CATEGORIAS   = ['Ventas / Cobros', 'Compras / Pagos', 'Nómina', 'Servicios', 'Impuestos', 'Transferencia interna', 'Ajuste / Diferencia', 'Otro']
const METODOS      = ['Transferencia', 'SINPE Móvil', 'Efectivo', 'Tarjeta débito', 'Tarjeta crédito', 'Cheque', 'Depósito', 'Otro']

// ── Colores por tipo de cuenta ────────────────────────────────────────────────
const TIPO_COLOR = {
  'Cuenta corriente':   { bg: '#E6F1FB', color: '#185FA5' },
  'Cuenta de ahorros':  { bg: '#EAF3DE', color: '#3B6D11' },
  'Tarjeta de crédito': { bg: '#FCEBEB', color: '#A32D2D' },
  'Tarjeta débito':     { bg: '#FAEEDA', color: '#854F0B' },
  'Caja chica':         { bg: '#EEEDFE', color: '#3C3489' },
  'Otro':               { bg: '#F1EFE8', color: '#5F5E5A' },
}

// ── Modal cuenta ──────────────────────────────────────────────────────────────
function ModalCuenta({ cuenta, onGuardar, onCerrar }) {
  const [form, setForm] = useState({
    nombre:       cuenta?.nombre       || '',
    banco:        cuenta?.banco        || 'BCR',
    tipo:         cuenta?.tipo         || 'Cuenta corriente',
    moneda:       cuenta?.moneda       || 'CRC',
    ultimos4:     cuenta?.ultimos4     || '',
    saldoInicial: cuenta?.saldoInicial ?? 0,
    color:        cuenta?.color        || '#185FA5',
    activa:       cuenta?.activa       ?? true,
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState('')

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleGuardar = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setGuardando(true)
    await onGuardar(form)
    setGuardando(false)
  }

  const s = {
    lbl: { fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4, display: 'block' },
    inp: { width: '100%', padding: '8px 11px', border: '0.5px solid rgba(0,0,0,.18)', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fff', color: 'inherit', fontFamily: 'inherit', boxSizing: 'border-box' },
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: '#fff', borderRadius: 14, width: '95%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>

        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{cuenta ? 'Editar cuenta' : 'Nueva cuenta bancaria'}</div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa' }}>×</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={s.lbl}>Nombre de la cuenta</label>
            <input style={s.inp} placeholder="Ej: BCR Corriente Principal" value={form.nombre} onChange={e => upd('nombre', e.target.value)} autoFocus />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={s.lbl}>Banco</label>
              <select style={s.inp} value={form.banco} onChange={e => upd('banco', e.target.value)}>
                {BANCOS_CR.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label style={s.lbl}>Tipo de cuenta</label>
              <select style={s.inp} value={form.tipo} onChange={e => upd('tipo', e.target.value)}>
                {TIPOS_CUENTA.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={s.lbl}>Moneda</label>
              <select style={s.inp} value={form.moneda} onChange={e => upd('moneda', e.target.value)}>
                {MONEDAS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={s.lbl}>Últimos 4 dígitos</label>
              <input style={s.inp} maxLength={4} placeholder="0000" value={form.ultimos4}
                onChange={e => upd('ultimos4', e.target.value.replace(/\D/g, '').slice(0, 4))} />
            </div>
            <div>
              <label style={s.lbl}>Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="color" value={form.color} onChange={e => upd('color', e.target.value)}
                  style={{ width: 40, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
                <span style={{ fontSize: 12, color: '#888', fontFamily: 'monospace' }}>{form.color}</span>
              </div>
            </div>
          </div>

          <div>
            <label style={s.lbl}>Saldo inicial ({form.moneda})</label>
            <input style={s.inp} type="number" step="0.01" value={form.saldoInicial}
              onChange={e => upd('saldoInicial', Number(e.target.value))} />
            <p style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>El saldo actual se calcula sumando todos los movimientos a este valor.</p>
          </div>

          {error && <div style={{ padding: '8px 12px', background: '#FCEBEB', borderRadius: 7, fontSize: 12, color: '#A32D2D' }}>{error}</div>}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(0,0,0,.08)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCerrar} style={{ padding: '8px 16px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: '#f5f5f5', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={guardando} style={{ padding: '8px 22px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: guardando ? 'not-allowed' : 'pointer', background: guardando ? '#e0e0e0' : 'var(--eco-primary, #1a3a5c)', color: guardando ? '#aaa' : '#fff', fontFamily: 'inherit' }}>
            {guardando ? 'Guardando...' : cuenta ? 'Guardar cambios' : 'Crear cuenta'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal movimiento ──────────────────────────────────────────────────────────
function ModalMovimiento({ cuentas, cuentaPreseleccionada, movimiento, onGuardar, onCerrar }) {
  const [form, setForm] = useState({
    tipo:        movimiento?.tipo        || 'ingreso',
    cuentaId:    movimiento?.cuentaId    || cuentaPreseleccionada?.id || cuentas[0]?.id || '',
    monto:       movimiento?.monto       || '',
    moneda:      movimiento?.moneda      || cuentaPreseleccionada?.moneda || 'CRC',
    fecha:       movimiento?.fecha       || new Date().toISOString().split('T')[0],
    descripcion: movimiento?.descripcion || '',
    categoria:   movimiento?.categoria   || 'Ventas / Cobros',
    metodo:      movimiento?.metodo      || 'Transferencia',
    referencia:  movimiento?.referencia  || '',
    // Para transferencias
    cuentaDestinoId: movimiento?.cuentaDestinoId || '',
    tasaCambio:      movimiento?.tasaCambio      || 519.5,
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState('')

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const cuentaOrigen  = cuentas.find(c => c.id === form.cuentaId)
  const cuentaDestino = cuentas.find(c => c.id === form.cuentaDestinoId)
  const esTransferencia = form.tipo === 'transferencia'
  const necesitaTasa = esTransferencia && cuentaOrigen?.moneda !== cuentaDestino?.moneda

  const handleGuardar = async () => {
    if (!form.monto || Number(form.monto) <= 0) { setError('Ingresá un monto válido.'); return }
    if (!form.descripcion.trim()) { setError('La descripción es obligatoria.'); return }
    if (esTransferencia && !form.cuentaDestinoId) { setError('Seleccioná la cuenta destino.'); return }
    if (esTransferencia && form.cuentaId === form.cuentaDestinoId) { setError('La cuenta origen y destino no pueden ser la misma.'); return }
    setError('')
    setGuardando(true)
    await onGuardar({ ...form, monto: Number(form.monto), moneda: cuentaOrigen?.moneda || form.moneda })
    setGuardando(false)
  }

  const s = {
    lbl: { fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4, display: 'block' },
    inp: { width: '100%', padding: '8px 11px', border: '0.5px solid rgba(0,0,0,.18)', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fff', color: 'inherit', fontFamily: 'inherit', boxSizing: 'border-box' },
  }

  const TIPOS = [
    { key: 'ingreso',       label: 'Ingreso',       color: '#3B6D11', bg: '#EAF3DE' },
    { key: 'egreso',        label: 'Egreso',        color: '#A32D2D', bg: '#FCEBEB' },
    { key: 'transferencia', label: 'Transferencia', color: '#185FA5', bg: '#E6F1FB' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: '#fff', borderRadius: 14, width: '95%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,.2)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{movimiento ? 'Editar movimiento' : 'Nuevo movimiento'}</div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa' }}>×</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>

          {/* Tipo */}
          <div>
            <label style={s.lbl}>Tipo</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {TIPOS.map(t => (
                <button key={t.key} onClick={() => { upd('tipo', t.key); if (t.key !== 'ingreso') upd('categoria', t.key === 'egreso' ? 'Compras / Pagos' : 'Transferencia interna') }}
                  style={{ flex: 1, padding: '8px 0', border: `1.5px solid ${form.tipo === t.key ? t.color : 'rgba(0,0,0,.12)'}`, borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: form.tipo === t.key ? t.bg : '#fff', color: form.tipo === t.key ? t.color : '#888', fontFamily: 'inherit', transition: 'all .15s' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cuenta origen */}
          <div>
            <label style={s.lbl}>{esTransferencia ? 'Cuenta origen' : 'Cuenta'}</label>
            <select style={s.inp} value={form.cuentaId} onChange={e => { upd('cuentaId', e.target.value); const c = cuentas.find(x => x.id === e.target.value); if(c) upd('moneda', c.moneda) }}>
              {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.moneda}) •••• {c.ultimos4 || '????'}</option>)}
            </select>
          </div>

          {/* Cuenta destino (solo transferencia) */}
          {esTransferencia && (
            <div>
              <label style={s.lbl}>Cuenta destino</label>
              <select style={s.inp} value={form.cuentaDestinoId} onChange={e => upd('cuentaDestinoId', e.target.value)}>
                <option value="">Seleccionar cuenta destino...</option>
                {cuentas.filter(c => c.id !== form.cuentaId).map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.moneda}) •••• {c.ultimos4 || '????'}</option>)}
              </select>
              {necesitaTasa && (
                <div style={{ marginTop: 8 }}>
                  <label style={s.lbl}>Tipo de cambio (₡ por $)</label>
                  <input style={s.inp} type="number" step="0.01" value={form.tasaCambio} onChange={e => upd('tasaCambio', Number(e.target.value))} />
                  <p style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                    {cuentaOrigen?.moneda === 'USD'
                      ? `$${Number(form.monto||0).toFixed(2)} = ₡${Math.round(Number(form.monto||0) * form.tasaCambio).toLocaleString('es-CR')}`
                      : `₡${Number(form.monto||0).toLocaleString('es-CR')} = $${(Number(form.monto||0) / form.tasaCambio).toFixed(2)}`}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Monto + Fecha */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={s.lbl}>Monto ({cuentaOrigen?.moneda || form.moneda})</label>
              <input style={{ ...s.inp, fontSize: 17, fontWeight: 600 }} type="number" min="0" step="0.01" placeholder="0.00" value={form.monto} onChange={e => upd('monto', e.target.value)} autoFocus />
            </div>
            <div>
              <label style={s.lbl}>Fecha</label>
              <input style={s.inp} type="date" value={form.fecha} onChange={e => upd('fecha', e.target.value)} />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label style={s.lbl}>Descripción</label>
            <input style={s.inp} placeholder="Ej: Pago factura FAC-001 cliente XYZ" value={form.descripcion} onChange={e => upd('descripcion', e.target.value)} />
          </div>

          {/* Categoría + Método */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={s.lbl}>Categoría</label>
              <select style={s.inp} value={form.categoria} onChange={e => upd('categoria', e.target.value)}>
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={s.lbl}>Método</label>
              <select style={s.inp} value={form.metodo} onChange={e => upd('metodo', e.target.value)}>
                {METODOS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Referencia */}
          <div>
            <label style={s.lbl}>Referencia / Comprobante (opcional)</label>
            <input style={s.inp} placeholder="Nº transferencia, SINPE, cheque..." value={form.referencia} onChange={e => upd('referencia', e.target.value)} />
          </div>

          {error && <div style={{ padding: '8px 12px', background: '#FCEBEB', borderRadius: 7, fontSize: 12, color: '#A32D2D' }}>{error}</div>}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(0,0,0,.08)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onCerrar} style={{ padding: '8px 16px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: '#f5f5f5', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={guardando} style={{ padding: '8px 22px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: guardando ? 'not-allowed' : 'pointer', background: guardando ? '#e0e0e0' : 'var(--eco-primary, #1a3a5c)', color: guardando ? '#aaa' : '#fff', fontFamily: 'inherit' }}>
            {guardando ? 'Guardando...' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta de cuenta ─────────────────────────────────────────────────────────
function TarjetaCuenta({ cuenta, saldo, seleccionada, onClick, onEditar }) {
  const cfg = TIPO_COLOR[cuenta.tipo] || TIPO_COLOR['Otro']
  const mon = cuenta.moneda || 'CRC'
  return (
    <div onClick={onClick} style={{
      background: '#fff', border: `1.5px solid ${seleccionada ? cuenta.color || 'var(--eco-primary, #1a3a5c)' : 'rgba(0,0,0,.08)'}`,
      borderRadius: 12, padding: '16px 18px', cursor: 'pointer', transition: 'all .15s',
      boxShadow: seleccionada ? `0 4px 16px ${cuenta.color}22` : 'none',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Barra de color superior */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: cuenta.color || 'var(--eco-primary, #1a3a5c)', borderRadius: '12px 12px 0 0' }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 4 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cuenta.nombre}</p>
          <p style={{ fontSize: 11, color: '#888', margin: 0 }}>{cuenta.banco} {cuenta.ultimos4 ? `•••• ${cuenta.ultimos4}` : ''}</p>
        </div>
        <button onClick={e => { e.stopPropagation(); onEditar() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 14, padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = '#888'}
          onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
          title="Editar cuenta">✎</button>
      </div>

      <div style={{ marginTop: 12 }}>
        <p style={{ fontSize: 11, color: '#aaa', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Saldo actual</p>
        <p style={{ fontSize: 20, fontWeight: 700, margin: 0, color: saldo < 0 ? '#A32D2D' : '#1a1a1a', letterSpacing: '-0.5px' }}>
          {fmt(saldo, mon)}
        </p>
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: cfg.bg, color: cfg.color, fontWeight: 500 }}>{cuenta.tipo}</span>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: mon === 'USD' ? '#E6F1FB' : '#FAEEDA', color: mon === 'USD' ? '#185FA5' : '#854F0B', fontWeight: 500 }}>{mon}</span>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function BancosPage() {
  const { puede } = usePermisos()

  const puedeVerSaldos     = puede('bancos', 'Ver saldos')
  const puedeRegistrar     = puede('bancos', 'Registrar movimientos')
  const puedeAdminCuentas  = puede('bancos', 'Administrar cuentas')

  const [cuentas,       setCuentas]       = useState([])
  const [movimientos,   setMovimientos]   = useState([])
  const [cuentaActiva,  setCuentaActiva]  = useState(null)
  const [loadingC,      setLoadingC]      = useState(true)
  const [loadingM,      setLoadingM]      = useState(true)

  const [showModalCuenta, setShowModalCuenta]     = useState(false)
  const [editandoCuenta,  setEditandoCuenta]      = useState(null)
  const [showModalMov,    setShowModalMov]         = useState(false)
  const [editandoMov,     setEditandoMov]          = useState(null)
  const [confirmElim,     setConfirmElim]          = useState(null)

  const [filtroTipo,   setFiltroTipo]   = useState('todos')
  const [filtroCat,    setFiltroCat]    = useState('todas')
  const [busqueda,     setBusqueda]     = useState('')
  const [fechaDesde,   setFechaDesde]   = useState('')
  const [fechaHasta,   setFechaHasta]   = useState('')

  // ── Suscripciones Firestore ───────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'cuentas_bancarias'), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setCuentas(data)
      if (!cuentaActiva && data.length > 0) setCuentaActiva(data[0])
      setLoadingC(false)
    })
    return unsub
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'movimientos_bancarios'), orderBy('fecha', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setMovimientos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoadingM(false)
    })
    return unsub
  }, [])

  // ── Saldo calculado por cuenta ────────────────────────────────────────────
  const saldoPorCuenta = useMemo(() => {
    const map = {}
    cuentas.forEach(c => { map[c.id] = Number(c.saldoInicial || 0) })
    movimientos.forEach(m => {
      if (m.tipo === 'ingreso')        map[m.cuentaId]        = (map[m.cuentaId]        || 0) + Number(m.monto)
      if (m.tipo === 'egreso')         map[m.cuentaId]        = (map[m.cuentaId]        || 0) - Number(m.monto)
      if (m.tipo === 'transferencia') {
        map[m.cuentaId]        = (map[m.cuentaId]        || 0) - Number(m.monto)
        const mon1 = cuentas.find(c => c.id === m.cuentaId)?.moneda
        const mon2 = cuentas.find(c => c.id === m.cuentaDestinoId)?.moneda
        let montoDestino = Number(m.monto)
        if (mon1 && mon2 && mon1 !== mon2) {
          montoDestino = mon1 === 'USD' ? m.monto * (m.tasaCambio || 519.5) : m.monto / (m.tasaCambio || 519.5)
        }
        map[m.cuentaDestinoId] = (map[m.cuentaDestinoId] || 0) + montoDestino
      }
    })
    return map
  }, [cuentas, movimientos])

  // ── Totales globales ──────────────────────────────────────────────────────
  const totales = useMemo(() => {
    const tasa = 519.5
    let totalCRC = 0, totalUSD = 0
    cuentas.forEach(c => {
      const s = saldoPorCuenta[c.id] || 0
      if (c.moneda === 'USD') totalUSD += s
      else totalCRC += s
    })
    return { totalCRC, totalUSD, totalEnCRC: totalCRC + totalUSD * tasa }
  }, [cuentas, saldoPorCuenta])

  // ── Movimientos filtrados ─────────────────────────────────────────────────
  const movFiltrados = useMemo(() => {
    return movimientos.filter(m => {
      if (cuentaActiva) {
        const perteneceAcuenta = m.cuentaId === cuentaActiva.id || m.cuentaDestinoId === cuentaActiva.id
        if (!perteneceAcuenta) return false
      }
      if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false
      if (filtroCat !== 'todas' && m.categoria !== filtroCat) return false
      if (busqueda) {
        const q = busqueda.toLowerCase()
        if (!m.descripcion?.toLowerCase().includes(q) && !m.referencia?.toLowerCase().includes(q)) return false
      }
      if (fechaDesde && m.fecha < fechaDesde) return false
      if (fechaHasta && m.fecha > fechaHasta) return false
      return true
    })
  }, [movimientos, cuentaActiva, filtroTipo, filtroCat, busqueda, fechaDesde, fechaHasta])

  // ── CRUD cuentas ──────────────────────────────────────────────────────────
  const guardarCuenta = async (form) => {
    if (editandoCuenta) {
      await updateDoc(doc(db, 'cuentas_bancarias', editandoCuenta.id), { ...form, actualizadoEn: serverTimestamp() })
    } else {
      await addDoc(collection(db, 'cuentas_bancarias'), { ...form, creadoEn: serverTimestamp() })
    }
    setShowModalCuenta(false); setEditandoCuenta(null)
  }

  // ── CRUD movimientos ──────────────────────────────────────────────────────
  const guardarMovimiento = async (form) => {
    const payload = {
      ...form,
      id: genId(),
      registradoPor: 'Usuario',
      creadoEn: serverTimestamp(),
    }
    if (editandoMov) {
      await updateDoc(doc(db, 'movimientos_bancarios', editandoMov.id), { ...payload })
    } else {
      await addDoc(collection(db, 'movimientos_bancarios'), payload)
    }
    setShowModalMov(false); setEditandoMov(null)
  }

  const eliminarMovimiento = async (id) => {
    await deleteDoc(doc(db, 'movimientos_bancarios', id))
    setConfirmElim(null)
  }

  // ── Estilos ───────────────────────────────────────────────────────────────
  const s = {
    page:    { padding: '24px 28px', minHeight: '100vh', background: 'var(--eco-bg, #f5f6f8)' },
    card:    { background: '#fff', border: '0.5px solid rgba(0,0,0,.08)', borderRadius: 10, overflow: 'hidden' },
    inp:     { padding: '7px 11px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff', color: 'inherit', fontFamily: 'inherit' },
    th:      { padding: '9px 14px', textAlign: 'left', fontWeight: 500, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '0.5px solid rgba(0,0,0,.06)', background: '#fafafa' },
    td:      { padding: '11px 14px', borderBottom: '0.5px solid rgba(0,0,0,.05)', verticalAlign: 'middle', fontSize: 13 },
    btnPrim: { padding: '8px 18px', background: 'var(--eco-primary, #1a3a5c)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
    btnSm:   { padding: '4px 12px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: '#fff', fontFamily: 'inherit' },
  }

  const tipoConfig = {
    ingreso:        { label: 'Ingreso',        color: '#3B6D11', bg: '#EAF3DE', signo: '+' },
    egreso:         { label: 'Egreso',         color: '#A32D2D', bg: '#FCEBEB', signo: '−' },
    transferencia:  { label: 'Transferencia',  color: '#185FA5', bg: '#E6F1FB', signo: '⇄' },
  }

  return (
    <div style={s.page}>

      {/* Modales */}
      {showModalCuenta && (
        <ModalCuenta cuenta={editandoCuenta} onGuardar={guardarCuenta} onCerrar={() => { setShowModalCuenta(false); setEditandoCuenta(null) }} />
      )}
      {showModalMov && (
        <ModalMovimiento
          cuentas={cuentas}
          cuentaPreseleccionada={cuentaActiva}
          movimiento={editandoMov}
          onGuardar={guardarMovimiento}
          onCerrar={() => { setShowModalMov(false); setEditandoMov(null) }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <p style={{ fontSize: 20, fontWeight: 500, color: 'var(--eco-primary, #1a3a5c)', margin: 0 }}>Bancos</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {puedeRegistrar && (
            <button style={{ ...s.btnPrim, background: '#3B6D11' }} onClick={() => setShowModalMov(true)}>+ Movimiento</button>
          )}
          {puedeAdminCuentas && (
            <button style={s.btnPrim} onClick={() => { setEditandoCuenta(null); setShowModalCuenta(true) }}>+ Nueva cuenta</button>
          )}
        </div>
      </div>

      {/* Métricas globales */}
      {puedeVerSaldos && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Total en CRC', valor: fmt(totales.totalCRC, 'CRC'), color: '#185FA5' },
            { label: 'Total en USD', valor: fmt(totales.totalUSD, 'USD'), color: '#3B6D11' },
            { label: 'Equivalente total', valor: fmt(totales.totalEnCRC, 'CRC'), sub: 'CRC + USD convertido', color: 'var(--eco-primary, #1a3a5c)' },
          ].map(m => (
            <div key={m.label} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,.08)', borderRadius: 10, padding: '14px 18px', flex: 1, minWidth: 160 }}>
              <p style={{ fontSize: 11, color: '#888', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 6px' }}>{m.label}</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: m.color, margin: 0, letterSpacing: '-0.5px' }}>{m.valor}</p>
              {m.sub && <p style={{ fontSize: 10, color: '#bbb', margin: '2px 0 0' }}>{m.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Tarjetas de cuentas */}
      {loadingC ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>Cargando cuentas...</div>
      ) : cuentas.length === 0 ? (
        <div style={{ ...s.card, padding: 40, textAlign: 'center', color: '#999', fontSize: 13, marginBottom: 20 }}>
          No hay cuentas bancarias. {puedeAdminCuentas && <span style={{ color: 'var(--eco-primary, #1a3a5c)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setShowModalCuenta(true)}>Creá la primera.</span>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
          {cuentas.map(c => (
            <TarjetaCuenta
              key={c.id}
              cuenta={c}
              saldo={puedeVerSaldos ? (saldoPorCuenta[c.id] || 0) : null}
              seleccionada={cuentaActiva?.id === c.id}
              onClick={() => setCuentaActiva(cuentaActiva?.id === c.id ? null : c)}
              onEditar={() => { setEditandoCuenta(c); setShowModalCuenta(true) }}
            />
          ))}
          {/* Tarjeta "todas" */}
          <div onClick={() => setCuentaActiva(null)} style={{
            background: cuentaActiva === null ? 'var(--eco-primary, #1a3a5c)' : '#fff',
            border: `1.5px solid ${cuentaActiva === null ? 'var(--eco-primary, #1a3a5c)' : 'rgba(0,0,0,.08)'}`,
            borderRadius: 12, padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: cuentaActiva === null ? '#fff' : '#888', fontSize: 13, fontWeight: 500,
          }}>
            Ver todos los movimientos
          </div>
        </div>
      )}

      {/* Tabla de movimientos */}
      <div style={s.card}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 16px', borderBottom: '0.5px solid rgba(0,0,0,.06)', flexWrap: 'wrap' }}>
          <input style={{ ...s.inp, width: 200 }} placeholder="Buscar descripción..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />

          {/* Filtro tipo */}
          <div style={{ display: 'flex', gap: 5 }}>
            {[['todos','Todos'], ['ingreso','Ingresos'], ['egreso','Egresos'], ['transferencia','Transferencias']].map(([k, l]) => (
              <button key={k} onClick={() => setFiltroTipo(k)} style={{
                ...s.btnSm,
                background:  filtroTipo === k ? 'var(--eco-primary, #1a3a5c)' : '#fff',
                color:       filtroTipo === k ? '#fff' : '#555',
                borderColor: filtroTipo === k ? 'transparent' : 'rgba(0,0,0,.15)',
              }}>{l}</button>
            ))}
          </div>

          {/* Fechas */}
          <input style={s.inp} type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} title="Desde" />
          <input style={s.inp} type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} title="Hasta" />

          {/* Categoría */}
          <select style={s.inp} value={filtroCat} onChange={e => setFiltroCat(e.target.value)}>
            <option value="todas">Todas las categorías</option>
            {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
          </select>

          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#aaa' }}>
            {movFiltrados.length} movimiento{movFiltrados.length !== 1 ? 's' : ''}
            {cuentaActiva ? ` — ${cuentaActiva.nombre}` : ' — Todas las cuentas'}
          </span>
        </div>

        {/* Tabla */}
        {loadingM ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>Cargando movimientos...</div>
        ) : movFiltrados.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>
            {movimientos.length === 0 ? 'Sin movimientos. Registrá el primero.' : 'Sin resultados para ese filtro.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={s.th}>Fecha</th>
                <th style={s.th}>Tipo</th>
                <th style={s.th}>Descripción</th>
                <th style={s.th}>Categoría</th>
                <th style={s.th}>Cuenta</th>
                <th style={s.th}>Método</th>
                {puedeVerSaldos && <th style={{ ...s.th, textAlign: 'right' }}>Monto</th>}
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {movFiltrados.map((m, i) => {
                const cfg     = tipoConfig[m.tipo] || tipoConfig.ingreso
                const cuenta  = cuentas.find(c => c.id === m.cuentaId)
                const cuentaD = cuentas.find(c => c.id === m.cuentaDestinoId)
                const esEntrada = m.tipo === 'ingreso' || (m.tipo === 'transferencia' && cuentaActiva?.id === m.cuentaDestinoId)
                const mon     = cuenta?.moneda || 'CRC'

                return (
                  <tr key={m.id || i}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td style={{ ...s.td, color: '#888', fontSize: 12 }}>{fmtFecha(m.fecha)}</td>
                    <td style={s.td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: cfg.bg, color: cfg.color }}>
                        <span style={{ fontSize: 12 }}>{cfg.signo}</span>
                        {cfg.label}
                      </span>
                    </td>
                    <td style={s.td}>
                      <p style={{ fontWeight: 500, margin: 0 }}>{m.descripcion}</p>
                      {m.referencia && <p style={{ fontSize: 11, color: '#aaa', margin: '1px 0 0' }}>Ref: {m.referencia}</p>}
                      {m.tipo === 'transferencia' && cuentaD && (
                        <p style={{ fontSize: 11, color: '#185FA5', margin: '1px 0 0' }}>→ {cuentaD.nombre}</p>
                      )}
                    </td>
                    <td style={{ ...s.td, fontSize: 12, color: '#666' }}>{m.categoria || '—'}</td>
                    <td style={{ ...s.td, fontSize: 12 }}>
                      {cuenta ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: cuenta.color || '#888', flexShrink: 0 }} />
                          {cuenta.nombre}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ ...s.td, fontSize: 12, color: '#666' }}>{m.metodo || '—'}</td>
                    {puedeVerSaldos && (
                      <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, fontSize: 14, color: m.tipo === 'egreso' ? '#A32D2D' : m.tipo === 'ingreso' ? '#3B6D11' : '#185FA5' }}>
                        {m.tipo === 'egreso' ? '−' : m.tipo === 'ingreso' ? '+' : '⇄'}
                        {fmt(m.monto, mon)}
                      </td>
                    )}
                    <td style={s.td} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        {puedeRegistrar && (
                          confirmElim === m.id ? (
                            <>
                              <span style={{ fontSize: 11, color: '#A32D2D' }}>¿Eliminar?</span>
                              <button style={{ padding: '2px 8px', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer', background: '#FCEBEB', color: '#A32D2D', fontFamily: 'inherit' }} onClick={() => eliminarMovimiento(m.id)}>Sí</button>
                              <button style={{ padding: '2px 8px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 4, fontSize: 11, cursor: 'pointer', background: '#fff', fontFamily: 'inherit' }} onClick={() => setConfirmElim(null)}>No</button>
                            </>
                          ) : (
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 15, padding: '2px 5px', borderRadius: 4 }}
                              onMouseEnter={e => e.currentTarget.style.color = '#E24B4A'}
                              onMouseLeave={e => e.currentTarget.style.color = '#ddd'}
                              onClick={() => setConfirmElim(m.id)} title="Eliminar">✕</button>
                          )
                        )}
                      </div>
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