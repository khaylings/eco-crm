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
  updateDoc, deleteDoc, doc, getDoc, serverTimestamp
} from 'firebase/firestore'
import { db } from '../../../firebase/config'
import { usePermisos } from '../../../hooks/usePermisos'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n, mon = 'USD') =>
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
const MONEDAS      = ['USD', 'CRC']
const CATEGORIAS   = ['Ventas / Cobros', 'Compras / Pagos', 'Nómina', 'Servicios', 'Impuestos', 'Transferencia interna', 'Ajuste / Diferencia', 'Pago crédito', 'Otro']
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
function ModalCuenta({ cuenta, cuentas = [], gruposTdc = [], onGuardar, onCerrar }) {
  const esTDC = (t) => t === 'Tarjeta de crédito'

  const [form, setForm] = useState({
    nombre:       cuenta?.nombre       || '',
    tipo:         cuenta?.tipo         || 'Cuenta corriente',
    moneda:       cuenta?.moneda       || 'USD',
    ultimos4:     cuenta?.ultimos4     || '',
    saldoInicial: cuenta?.saldoInicial ?? 0,
    color:        cuenta?.color        || '#185FA5',
    activa:       cuenta?.activa       ?? true,
    // Campos TDC
    limiteTdc:    cuenta?.limiteTdc    ?? '',
    grupoTdc:     cuenta?.grupoTdc    || '',
    fechaCorte:   cuenta?.fechaCorte  ?? '',
    fechaPago:    cuenta?.fechaPago   ?? '',
    monedaLimite: cuenta?.monedaLimite || 'USD',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState('')

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const mostrarTDC = esTDC(form.tipo)

  const handleGuardar = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    if (mostrarTDC && (!form.limiteTdc || Number(form.limiteTdc) <= 0)) { setError('El límite de crédito es obligatorio para TDC.'); return }
    setGuardando(true)
    const data = { ...form, limiteTdc: Number(form.limiteTdc || 0) }
    if (!mostrarTDC) { delete data.limiteTdc; delete data.grupoTdc; delete data.fechaCorte; delete data.fechaPago; delete data.monedaLimite }
    await onGuardar(data)
    setGuardando(false)
  }

  const s = {
    lbl: { fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4, display: 'block' },
    inp: { width: '100%', padding: '8px 11px', border: '0.5px solid rgba(0,0,0,.18)', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fff', color: 'inherit', fontFamily: 'inherit', boxSizing: 'border-box' },
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: '#fff', borderRadius: 14, width: '95%', maxWidth: 540, boxShadow: '0 20px 60px rgba(0,0,0,.2)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{cuenta ? 'Editar cuenta' : 'Nueva cuenta'}</div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa' }}>×</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
          <div>
            <label style={s.lbl}>Nombre de la cuenta</label>
            <input style={s.inp} placeholder="Ej: Visa BAC Principal" value={form.nombre} onChange={e => upd('nombre', e.target.value)} autoFocus />
          </div>

          <div>
            <label style={s.lbl}>Tipo de cuenta</label>
            <select style={s.inp} value={form.tipo} onChange={e => upd('tipo', e.target.value)}>
              {TIPOS_CUENTA.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: mostrarTDC ? '1fr 1fr' : '1fr 1fr 1fr', gap: 12 }}>
            {/* Moneda solo para cuentas NO TDC — TDC es multimoneda */}
            {!mostrarTDC && (
              <div>
                <label style={s.lbl}>Moneda</label>
                <select style={s.inp} value={form.moneda} onChange={e => upd('moneda', e.target.value)}>
                  {MONEDAS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            )}
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

          {/* Saldo inicial */}
          <div>
            <label style={s.lbl}>{mostrarTDC ? 'Saldo actual adeudado (USD)' : `Saldo inicial (${form.moneda})`}</label>
            <input style={s.inp} type="number" step="0.01" value={form.saldoInicial}
              onChange={e => upd('saldoInicial', Number(e.target.value))} />
            <p style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
              {mostrarTDC ? 'Lo que debés actualmente en esta tarjeta. Los movimientos se suman a este valor.' : 'El saldo actual se calcula sumando todos los movimientos a este valor.'}
            </p>
          </div>

          {/* ── Campos TDC ── */}
          {mostrarTDC && (
            <div style={{ background: '#fef5f5', border: '1px solid #f0d0d0', borderRadius: 10, padding: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#A32D2D', textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 10px' }}>Configuración Tarjeta de Crédito</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={s.lbl}>Límite de crédito *</label>
                  <input style={{ ...s.inp, fontSize: 16, fontWeight: 600 }} type="number" min="0" step="0.01" placeholder="0.00"
                    value={form.limiteTdc} onChange={e => upd('limiteTdc', e.target.value)} />
                </div>
                <div>
                  <label style={s.lbl}>Moneda del límite</label>
                  <select style={s.inp} value={form.monedaLimite} onChange={e => upd('monedaLimite', e.target.value)}>
                    {MONEDAS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                <div>
                  <label style={s.lbl}>Día de corte (1-31)</label>
                  <input style={s.inp} type="number" min="1" max="31" placeholder="15"
                    value={form.fechaCorte} onChange={e => upd('fechaCorte', Number(e.target.value))} />
                </div>
                <div>
                  <label style={s.lbl}>Día de pago (1-31)</label>
                  <input style={s.inp} type="number" min="1" max="31" placeholder="5"
                    value={form.fechaPago} onChange={e => upd('fechaPago', Number(e.target.value))} />
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <label style={s.lbl}>Grupo de tarjetas (límite compartido)</label>
                <select style={s.inp} value={form.grupoTdc} onChange={e => upd('grupoTdc', e.target.value)}>
                  <option value="">Sin grupo (límite independiente)</option>
                  {gruposTdc.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                </select>
                <p style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>Las tarjetas del mismo grupo comparten el límite. Creá grupos en Configuración → Cuentas.</p>
              </div>

            </div>
          )}

          {error && <div style={{ padding: '8px 12px', background: '#FCEBEB', borderRadius: 7, fontSize: 12, color: '#A32D2D' }}>{error}</div>}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(0,0,0,.08)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
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
    moneda:      movimiento?.moneda      || cuentaPreseleccionada?.moneda || 'USD',
    fecha:       movimiento?.fecha       || new Date().toISOString().split('T')[0],
    descripcion: movimiento?.descripcion || '',
    categoria:   movimiento?.categoria   || 'Ventas / Cobros',
    metodo:      movimiento?.metodo      || 'Transferencia',
    referencia:  movimiento?.referencia  || '',
    // Para transferencias
    cuentaDestinoId: movimiento?.cuentaDestinoId || '',
    tasaCambio:      movimiento?.tasaCambio      || 500,
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState('')

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const cuentaOrigen  = cuentas.find(c => c.id === form.cuentaId)
  const cuentaDestino = cuentas.find(c => c.id === form.cuentaDestinoId)
  const esTransferencia = form.tipo === 'transferencia'
  const esTDC = cuentaOrigen?.tipo === 'Tarjeta de crédito'
  const necesitaTasa = esTransferencia && cuentaOrigen?.moneda !== cuentaDestino?.moneda

  const handleGuardar = async () => {
    if (!form.monto || Number(form.monto) <= 0) { setError('Ingresá un monto válido.'); return }
    if (!form.descripcion.trim()) { setError('La descripción es obligatoria.'); return }
    if (esTransferencia && !form.cuentaDestinoId) { setError('Seleccioná la cuenta destino.'); return }
    if (esTransferencia && form.cuentaId === form.cuentaDestinoId) { setError('La cuenta origen y destino no pueden ser la misma.'); return }
    setError('')
    setGuardando(true)
    // Para TDC, la moneda la elige el usuario; para otras, va la moneda de la cuenta
    const monedaFinal = esTDC ? form.moneda : (cuentaOrigen?.moneda || form.moneda)
    await onGuardar({ ...form, monto: Number(form.monto), moneda: monedaFinal })
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

          {/* Moneda (solo para TDC, multimoneda) */}
          {esTDC && !esTransferencia && (
            <div>
              <label style={s.lbl}>Moneda del gasto</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {MONEDAS.map(m => (
                  <button key={m} onClick={() => upd('moneda', m)} style={{
                    flex: 1, padding: '7px 0', border: `1.5px solid ${form.moneda === m ? '#854F0B' : 'rgba(0,0,0,.12)'}`,
                    borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    background: form.moneda === m ? '#FAEEDA' : '#fff', color: form.moneda === m ? '#854F0B' : '#888',
                    fontFamily: 'inherit', transition: 'all .15s',
                  }}>{m === 'CRC' ? '₡ Colones' : '$ Dólares'}</button>
                ))}
              </div>
            </div>
          )}

          {/* Monto + Fecha */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={s.lbl}>Monto ({esTDC ? form.moneda : (cuentaOrigen?.moneda || form.moneda)})</label>
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

// ── Tarjeta de cuenta (compacta) ─────────────────────────────────────────────
function TarjetaCuenta({ cuenta, saldo, tdcInfo, seleccionada, onClick, onEditar }) {
  const mon = cuenta.moneda || 'USD'
  const esTDC = cuenta.tipo === 'Tarjeta de crédito'
  const tdc = esTDC ? tdcInfo : null

  // Valor principal a mostrar
  let valorPrincipal, colorValor
  if (esTDC && tdc) {
    valorPrincipal = fmt(tdc.disponible, tdc.monedaLimite)
    colorValor = tdc.disponible < 0 ? '#A32D2D' : tdc.disponible < tdc.limite * 0.2 ? '#854F0B' : '#3B6D11'
  } else {
    valorPrincipal = saldo !== null ? fmt(saldo, mon) : '••••'
    colorValor = saldo < 0 ? '#A32D2D' : '#1a1a1a'
  }

  return (
    <div onClick={onClick} style={{
      background: seleccionada ? 'var(--eco-primary, #1a3a5c)' : '#fff',
      border: `1.5px solid ${seleccionada ? 'var(--eco-primary, #1a3a5c)' : 'rgba(0,0,0,.08)'}`,
      borderRadius: 8, padding: '8px 10px', cursor: 'pointer', transition: 'all .15s',
      borderTop: `3px solid ${cuenta.color || 'var(--eco-primary, #1a3a5c)'}`,
      position: 'relative',
    }}>
      <p style={{ fontSize: 11, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: seleccionada ? '#fff' : '#1a1a1a' }}>
        {cuenta.nombre}
      </p>
      <p style={{ fontSize: 14, fontWeight: 700, margin: '4px 0 0', color: seleccionada ? '#fff' : colorValor, letterSpacing: '-0.3px' }}>
        {valorPrincipal}
      </p>
      <button onClick={e => { e.stopPropagation(); onEditar() }} style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', cursor: 'pointer', color: seleccionada ? 'rgba(255,255,255,.4)' : '#ddd', fontSize: 11, padding: '1px 3px', borderRadius: 3 }}
        onMouseEnter={e => e.currentTarget.style.color = seleccionada ? '#fff' : '#888'}
        onMouseLeave={e => e.currentTarget.style.color = seleccionada ? 'rgba(255,255,255,.4)' : '#ddd'}
        title="Editar cuenta">✎</button>
    </div>
  )
}

// ── Modal crédito bancario ───────────────────────────────────────────────────
function ModalCredito({ credito, cuentas, onGuardar, onCerrar }) {
  const hoy = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    nombre:       credito?.nombre       || '',
    cuentaVinculadaId: credito?.cuentaVinculadaId || '',
    montoOriginal: credito?.montoOriginal ?? '',
    tasaInteres:  credito?.tasaInteres  ?? '',
    plazoMeses:   credito?.plazoMeses   ?? '',
    fechaInicio:  credito?.fechaInicio  || hoy,
    moneda:       credito?.moneda       || 'USD',
    notas:        credito?.notas        || '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState('')

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Cálculo cuota mensual (sistema francés)
  const cuotaMensual = useMemo(() => {
    const P = Number(form.montoOriginal)
    const r = Number(form.tasaInteres) / 100 / 12
    const n = Number(form.plazoMeses)
    if (!P || !r || !n) return 0
    return (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  }, [form.montoOriginal, form.tasaInteres, form.plazoMeses])

  const totalPagar = cuotaMensual * Number(form.plazoMeses || 0)
  const totalIntereses = totalPagar - Number(form.montoOriginal || 0)

  const handleGuardar = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    if (!form.montoOriginal || Number(form.montoOriginal) <= 0) { setError('El monto original es obligatorio.'); return }
    if (!form.tasaInteres || Number(form.tasaInteres) <= 0) { setError('La tasa de interés es obligatoria.'); return }
    if (!form.plazoMeses || Number(form.plazoMeses) <= 0) { setError('El plazo en meses es obligatorio.'); return }
    if (!form.cuentaVinculadaId) { setError('Seleccioná una cuenta bancaria vinculada.'); return }
    setGuardando(true)
    await onGuardar({
      ...form,
      montoOriginal: Number(form.montoOriginal),
      tasaInteres:   Number(form.tasaInteres),
      plazoMeses:    Number(form.plazoMeses),
      cuotaMensual,
    })
    setGuardando(false)
  }

  const s = {
    lbl: { fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4, display: 'block' },
    inp: { width: '100%', padding: '8px 11px', border: '0.5px solid rgba(0,0,0,.18)', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fff', color: 'inherit', fontFamily: 'inherit', boxSizing: 'border-box' },
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: '#fff', borderRadius: 14, width: '95%', maxWidth: 540, boxShadow: '0 20px 60px rgba(0,0,0,.2)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{credito ? 'Editar crédito' : 'Nuevo crédito bancario'}</div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa' }}>×</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
          <div>
            <label style={s.lbl}>Nombre del crédito</label>
            <input style={s.inp} placeholder="Ej: Préstamo vehículo BCR" value={form.nombre} onChange={e => upd('nombre', e.target.value)} autoFocus />
          </div>

          <div>
            <label style={s.lbl}>Moneda</label>
            <select style={s.inp} value={form.moneda} onChange={e => upd('moneda', e.target.value)}>
              {MONEDAS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label style={s.lbl}>Cuenta bancaria vinculada</label>
            <select style={s.inp} value={form.cuentaVinculadaId} onChange={e => upd('cuentaVinculadaId', e.target.value)}>
              <option value="">Seleccionar cuenta...</option>
              {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.moneda}) •••• {c.ultimos4 || '????'}</option>)}
            </select>
            <p style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Los pagos de cuotas se descontarán de esta cuenta.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={s.lbl}>Monto original ({form.moneda})</label>
              <input style={{ ...s.inp, fontSize: 15, fontWeight: 600 }} type="number" min="0" step="0.01" placeholder="0.00" value={form.montoOriginal} onChange={e => upd('montoOriginal', e.target.value)} />
            </div>
            <div>
              <label style={s.lbl}>Tasa interés anual (%)</label>
              <input style={s.inp} type="number" min="0" step="0.01" placeholder="12.5" value={form.tasaInteres} onChange={e => upd('tasaInteres', e.target.value)} />
            </div>
            <div>
              <label style={s.lbl}>Plazo (meses)</label>
              <input style={s.inp} type="number" min="1" step="1" placeholder="36" value={form.plazoMeses} onChange={e => upd('plazoMeses', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={s.lbl}>Fecha de inicio</label>
              <input style={s.inp} type="date" value={form.fechaInicio} onChange={e => upd('fechaInicio', e.target.value)} />
            </div>
            <div>
              <label style={s.lbl}>Notas (opcional)</label>
              <input style={s.inp} placeholder="Observaciones..." value={form.notas} onChange={e => upd('notas', e.target.value)} />
            </div>
          </div>

          {/* Resumen calculado */}
          {cuotaMensual > 0 && (
            <div style={{ background: '#f0f6ff', border: '1px solid #d0e2f5', borderRadius: 10, padding: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#185FA5', textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 8px' }}>Resumen del crédito</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <p style={{ fontSize: 10, color: '#888', margin: '0 0 2px' }}>Cuota mensual</p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: '#185FA5', margin: 0 }}>{fmt(cuotaMensual, form.moneda)}</p>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: '#888', margin: '0 0 2px' }}>Total a pagar</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#333', margin: 0 }}>{fmt(totalPagar, form.moneda)}</p>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: '#888', margin: '0 0 2px' }}>Total intereses</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#A32D2D', margin: 0 }}>{fmt(totalIntereses, form.moneda)}</p>
                </div>
              </div>
            </div>
          )}

          {error && <div style={{ padding: '8px 12px', background: '#FCEBEB', borderRadius: 7, fontSize: 12, color: '#A32D2D' }}>{error}</div>}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(0,0,0,.08)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onCerrar} style={{ padding: '8px 16px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: '#f5f5f5', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={guardando} style={{ padding: '8px 22px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: guardando ? 'not-allowed' : 'pointer', background: guardando ? '#e0e0e0' : 'var(--eco-primary, #1a3a5c)', color: guardando ? '#aaa' : '#fff', fontFamily: 'inherit' }}>
            {guardando ? 'Guardando...' : credito ? 'Guardar cambios' : 'Crear crédito'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal pago de cuota ──────────────────────────────────────────────────────
function ModalPagoCuota({ credito, cuentas, onPagar, onCerrar }) {
  const hoy = new Date().toISOString().split('T')[0]
  const [fecha, setFecha] = useState(hoy)
  const [montoPago, setMontoPago] = useState(credito?.cuotaMensual || 0)
  const [referencia, setReferencia] = useState('')
  const [pagando, setPagando] = useState(false)

  const cuenta = cuentas.find(c => c.id === credito?.cuentaVinculadaId)

  const handlePagar = async () => {
    setPagando(true)
    await onPagar({ fecha, monto: Number(montoPago), referencia })
    setPagando(false)
  }

  const s = {
    lbl: { fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4, display: 'block' },
    inp: { width: '100%', padding: '8px 11px', border: '0.5px solid rgba(0,0,0,.18)', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fff', color: 'inherit', fontFamily: 'inherit', boxSizing: 'border-box' },
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: '#fff', borderRadius: 14, width: '95%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>

        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Pagar cuota — {credito?.nombre}</div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa' }}>×</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 12, fontSize: 12, color: '#666' }}>
            Cuenta de débito: <strong>{cuenta?.nombre || 'Sin cuenta'}</strong> ({cuenta?.moneda || '—'})
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={s.lbl}>Monto del pago ({credito?.moneda || 'USD'})</label>
              <input style={{ ...s.inp, fontSize: 17, fontWeight: 600 }} type="number" min="0" step="0.01" value={montoPago} onChange={e => setMontoPago(e.target.value)} />
              <p style={{ fontSize: 10, color: '#aaa', marginTop: 3 }}>Cuota sugerida: {fmt(credito?.cuotaMensual, credito?.moneda)}</p>
            </div>
            <div>
              <label style={s.lbl}>Fecha del pago</label>
              <input style={s.inp} type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
          </div>

          <div>
            <label style={s.lbl}>Referencia / Comprobante (opcional)</label>
            <input style={s.inp} placeholder="Nº comprobante..." value={referencia} onChange={e => setReferencia(e.target.value)} />
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(0,0,0,.08)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCerrar} style={{ padding: '8px 16px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: '#f5f5f5', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={handlePagar} disabled={pagando} style={{ padding: '8px 22px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: pagando ? 'not-allowed' : 'pointer', background: pagando ? '#e0e0e0' : '#A32D2D', color: pagando ? '#aaa' : '#fff', fontFamily: 'inherit' }}>
            {pagando ? 'Procesando...' : 'Registrar pago'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta de crédito bancario ──────────────────────────────────────────────
function TarjetaCredito({ credito, pagosRealizados, onEditar, onPagar, onVerDetalle }) {
  const mon = credito.moneda || 'USD'
  const totalPagado = pagosRealizados.reduce((sum, p) => sum + Number(p.monto || 0), 0)
  const saldoPendiente = (credito.cuotaMensual * credito.plazoMeses) - totalPagado
  const cuotasPagadas = pagosRealizados.length
  const progreso = credito.plazoMeses > 0 ? Math.min((cuotasPagadas / credito.plazoMeses) * 100, 100) : 0

  return (
    <div style={{
      background: '#fff', border: '1.5px solid rgba(0,0,0,.08)', borderRadius: 12,
      padding: '16px 18px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#854F0B', borderRadius: '12px 12px 0 0' }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 4 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{credito.nombre}</p>
          <p style={{ fontSize: 11, color: '#888', margin: 0 }}>{credito.plazoMeses} meses · {credito.tasaInteres}%</p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onEditar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 14, padding: '2px 6px', borderRadius: 4 }}
            onMouseEnter={e => e.currentTarget.style.color = '#888'}
            onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
            title="Editar">✎</button>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <p style={{ fontSize: 10, color: '#aaa', margin: 0, textTransform: 'uppercase', letterSpacing: '.5px' }}>Saldo pendiente</p>
          <p style={{ fontSize: 10, color: '#aaa', margin: 0 }}>{cuotasPagadas}/{credito.plazoMeses} cuotas</p>
        </div>
        <p style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px', color: saldoPendiente > 0 ? '#A32D2D' : '#3B6D11' }}>
          {fmt(Math.max(saldoPendiente, 0), mon)}
        </p>

        {/* Barra de progreso */}
        <div style={{ background: '#f0f0f0', borderRadius: 10, height: 6, overflow: 'hidden' }}>
          <div style={{ width: `${progreso}%`, height: '100%', background: progreso >= 100 ? '#3B6D11' : '#854F0B', borderRadius: 10, transition: 'width .3s' }} />
        </div>
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#FAEEDA', color: '#854F0B', fontWeight: 500 }}>
          Cuota: {fmt(credito.cuotaMensual, mon)}
        </span>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: mon === 'USD' ? '#E6F1FB' : '#FAEEDA', color: mon === 'USD' ? '#185FA5' : '#854F0B', fontWeight: 500 }}>{mon}</span>
        {progreso >= 100 && (
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#EAF3DE', color: '#3B6D11', fontWeight: 500 }}>Pagado</span>
        )}
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
        {progreso < 100 && (
          <button onClick={onPagar} style={{ flex: 1, padding: '7px 0', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: '#A32D2D', color: '#fff', fontFamily: 'inherit' }}>
            Pagar cuota
          </button>
        )}
        <button onClick={onVerDetalle} style={{ flex: 1, padding: '7px 0', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 12, cursor: 'pointer', background: '#fff', fontFamily: 'inherit', color: '#555' }}>
          Ver detalle
        </button>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function BancosPage() {
  const { puede } = usePermisos()
  const [tasaCambioGlobal, setTasaCambioGlobal] = useState(500)
  useEffect(() => {
    getDoc(doc(db, 'configuracion_segura', 'integraciones')).then(snap => {
      if (snap.exists()) {
        const tc = snap.data().tasa_cambio
        if (tc) setTasaCambioGlobal(Number(tc))
      }
    }).catch(() => {})
  }, [])

  const puedeVerSaldos     = puede('bancos', 'Ver saldos')
  const puedeRegistrar     = puede('bancos', 'Registrar movimientos')
  const puedeAdminCuentas  = puede('bancos', 'Administrar cuentas')

  const [cuentas,       setCuentas]       = useState([])
  const [movimientos,   setMovimientos]   = useState([])
  const [gruposTdc,     setGruposTdc]     = useState([])
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

  // ── Tab activa ────────────────────────────────────────────────────────────
  const [tabActiva, setTabActiva] = useState('cuentas')

  // ── Estado créditos ───────────────────────────────────────────────────────
  const [creditos,          setCreditos]          = useState([])
  const [pagosCredito,      setPagosCredito]      = useState([])
  const [loadingCreditos,   setLoadingCreditos]   = useState(true)
  const [showModalCredito,  setShowModalCredito]  = useState(false)
  const [editandoCredito,   setEditandoCredito]   = useState(null)
  const [showModalPago,     setShowModalPago]     = useState(false)
  const [creditoPago,       setCreditoPago]       = useState(null)
  const [creditoDetalle,    setCreditoDetalle]    = useState(null)
  const [confirmElimCredito, setConfirmElimCredito] = useState(null)

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

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'grupos_tdc'), snap => {
      setGruposTdc(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'creditos_bancarios'), snap => {
      setCreditos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoadingCreditos(false)
    })
    return unsub
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'pagos_credito'), orderBy('fecha', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setPagosCredito(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  // ── Saldo calculado por cuenta (cuentas normales) ─────────────────────────
  const saldoPorCuenta = useMemo(() => {
    const map = {}
    cuentas.forEach(c => {
      if (c.tipo !== 'Tarjeta de crédito') {
        map[c.id] = Number(c.saldoInicial || 0)
      }
    })
    movimientos.forEach(m => {
      const cuenta = cuentas.find(c => c.id === m.cuentaId)
      if (cuenta?.tipo === 'Tarjeta de crédito') return // TDC se calcula aparte
      if (m.tipo === 'ingreso')        map[m.cuentaId]        = (map[m.cuentaId]        || 0) + Number(m.monto)
      if (m.tipo === 'egreso')         map[m.cuentaId]        = (map[m.cuentaId]        || 0) - Number(m.monto)
      if (m.tipo === 'transferencia') {
        map[m.cuentaId]        = (map[m.cuentaId]        || 0) - Number(m.monto)
        const mon1 = cuenta?.moneda
        const mon2 = cuentas.find(c => c.id === m.cuentaDestinoId)?.moneda
        let montoDestino = Number(m.monto)
        if (mon1 && mon2 && mon1 !== mon2) {
          montoDestino = mon1 === 'USD' ? m.monto * (m.tasaCambio || tasaCambioGlobal) : m.monto / (m.tasaCambio || tasaCambioGlobal)
        }
        map[m.cuentaDestinoId] = (map[m.cuentaDestinoId] || 0) + montoDestino
      }
    })
    return map
  }, [cuentas, movimientos, tasaCambioGlobal])

  // ── TDC: consumo por tarjeta y disponible por grupo ───────���──────────────
  const tdcInfo = useMemo(() => {
    const tarjetas = cuentas.filter(c => c.tipo === 'Tarjeta de crédito')
    if (tarjetas.length === 0) return {}

    // Calcular consumo neto por tarjeta (saldoInicial + egresos - pagos), multimoneda
    const consumoPorTarjeta = {} // { cuentaId: { CRC: x, USD: y } }
    tarjetas.forEach(t => {
      consumoPorTarjeta[t.id] = { CRC: 0, USD: 0 }
      // Saldo inicial = deuda preexistente, va en la moneda de la tarjeta
      const monInicial = t.moneda || 'USD'
      consumoPorTarjeta[t.id][monInicial] += Number(t.saldoInicial || 0)
    })

    movimientos.forEach(m => {
      const cuenta = tarjetas.find(c => c.id === m.cuentaId)
      if (!cuenta) return
      const mon = m.moneda || cuenta.moneda || 'USD'
      if (m.tipo === 'egreso')  consumoPorTarjeta[cuenta.id][mon] += Number(m.monto)
      if (m.tipo === 'ingreso') consumoPorTarjeta[cuenta.id][mon] -= Number(m.monto) // pago = reduce consumo
    })

    // Agrupar por grupo TDC
    const grupos = {} // { grupoKey: { limite, monedaLimite, tasa, tarjetas: [...ids] } }
    tarjetas.forEach(t => {
      const key = t.grupoTdc || `__solo_${t.id}`
      if (!grupos[key]) {
        grupos[key] = {
          limite: Number(t.limiteTdc || 0),
          monedaLimite: t.monedaLimite || 'USD',
          tasa: tasaCambioGlobal,
          tarjetas: [],
        }
      }
      grupos[key].tarjetas.push(t.id)
      // Tomar el límite más alto del grupo (por si varía)
      if (Number(t.limiteTdc || 0) > grupos[key].limite) {
        grupos[key].limite = Number(t.limiteTdc)
        grupos[key].monedaLimite = t.monedaLimite || 'USD'
        grupos[key].tasa = tasaCambioGlobal
      }
    })

    // Calcular disponible por tarjeta
    const info = {} // { cuentaId: { consumoCRC, consumoUSD, consumoEnLimite, limite, disponible, grupo, monedaLimite, tasa } }
    Object.entries(grupos).forEach(([key, g]) => {
      // Sumar consumo total del grupo convertido a moneda del límite
      let consumoTotalEnLimite = 0
      g.tarjetas.forEach(id => {
        const c = consumoPorTarjeta[id] || { CRC: 0, USD: 0 }
        if (g.monedaLimite === 'USD') {
          consumoTotalEnLimite += c.USD + (c.CRC / g.tasa)
        } else {
          consumoTotalEnLimite += c.CRC + (c.USD * g.tasa)
        }
      })

      g.tarjetas.forEach(id => {
        const c = consumoPorTarjeta[id] || { CRC: 0, USD: 0 }
        // Consumo individual en moneda del límite
        let consumoIndiv = g.monedaLimite === 'USD'
          ? c.USD + (c.CRC / g.tasa)
          : c.CRC + (c.USD * g.tasa)

        info[id] = {
          consumoCRC: c.CRC,
          consumoUSD: c.USD,
          saldoActual: consumoIndiv, // lo que debés en esta tarjeta
          consumoIndividual: consumoIndiv,
          consumoGrupo: consumoTotalEnLimite,
          limite: g.limite,
          disponible: g.limite - consumoTotalEnLimite,
          grupo: key.startsWith('__solo_') ? null : key,
          grupoNombre: key.startsWith('__solo_') ? null : (gruposTdc.find(gr => gr.id === key)?.nombre || key),
          monedaLimite: g.monedaLimite,
          tasa: g.tasa,
          tarjetasEnGrupo: g.tarjetas.length,
        }
      })
    })

    return info
  }, [cuentas, movimientos, gruposTdc, tasaCambioGlobal])

  // ── Totales globales ──────────────────────────────────────────────────────
  const totales = useMemo(() => {
    const tasa = tasaCambioGlobal
    let totalCRC = 0, totalUSD = 0
    cuentas.forEach(c => {
      if (c.tipo === 'Tarjeta de crédito') return // TDC no suma a saldos, es deuda
      const s = saldoPorCuenta[c.id] || 0
      if (c.moneda === 'USD') totalUSD += s
      else totalCRC += s
    })
    const totalEnUSD = totalUSD + (tasa > 0 ? totalCRC / tasa : 0)
    return { totalCRC, totalUSD, totalEnUSD }
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

  // ── CRUD créditos ─────────────────────────────────────────────────────────
  const guardarCredito = async (form) => {
    if (editandoCredito) {
      await updateDoc(doc(db, 'creditos_bancarios', editandoCredito.id), { ...form, actualizadoEn: serverTimestamp() })
    } else {
      await addDoc(collection(db, 'creditos_bancarios'), { ...form, estado: 'activo', creadoEn: serverTimestamp() })
    }
    setShowModalCredito(false); setEditandoCredito(null)
  }

  const eliminarCredito = async (id) => {
    await deleteDoc(doc(db, 'creditos_bancarios', id))
    setConfirmElimCredito(null)
  }

  // ── Pago de cuota (registra pago + egreso en cuenta vinculada) ────────────
  const pagarCuota = async (credito, { fecha, monto, referencia }) => {
    const cuenta = cuentas.find(c => c.id === credito.cuentaVinculadaId)
    // 1. Registrar pago del crédito
    await addDoc(collection(db, 'pagos_credito'), {
      creditoId: credito.id,
      fecha,
      monto,
      referencia,
      creadoEn: serverTimestamp(),
    })
    // 2. Generar egreso automático en la cuenta vinculada
    await addDoc(collection(db, 'movimientos_bancarios'), {
      tipo: 'egreso',
      cuentaId: credito.cuentaVinculadaId,
      monto,
      moneda: cuenta?.moneda || credito.moneda,
      fecha,
      descripcion: `Pago cuota — ${credito.nombre}`,
      categoria: 'Pago crédito',
      metodo: 'Transferencia',
      referencia,
      creditoId: credito.id,
      registradoPor: 'Sistema',
      creadoEn: serverTimestamp(),
    })
    setShowModalPago(false); setCreditoPago(null)
  }

  // ── Pagos agrupados por crédito ───────────────────────────────────────────
  const pagosPorCredito = useMemo(() => {
    const map = {}
    pagosCredito.forEach(p => {
      if (!map[p.creditoId]) map[p.creditoId] = []
      map[p.creditoId].push(p)
    })
    return map
  }, [pagosCredito])

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
        <ModalCuenta cuenta={editandoCuenta} cuentas={cuentas} gruposTdc={gruposTdc} onGuardar={guardarCuenta} onCerrar={() => { setShowModalCuenta(false); setEditandoCuenta(null) }} />
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

      {/* Header + Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <p style={{ fontSize: 20, fontWeight: 500, color: 'var(--eco-primary, #1a3a5c)', margin: 0 }}>Bancos</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {tabActiva === 'cuentas' && puedeVerSaldos && (
            <>
              {[
                { label: 'CRC', valor: fmt(totales.totalCRC, 'CRC'), color: '#185FA5' },
                { label: 'USD', valor: fmt(totales.totalUSD, 'USD'), color: '#3B6D11' },
                { label: 'Total', valor: fmt(totales.totalEnUSD, 'USD'), color: '#1a3a5c' },
              ].map(t => (
                <div key={t.label} style={{ background: '#fff', border: `1.5px solid ${t.color}33`, borderRadius: 8, padding: '6px 14px', textAlign: 'center', minWidth: 110 }}>
                  <p style={{ fontSize: 9, color: '#888', margin: 0, textTransform: 'uppercase', letterSpacing: '.5px' }}>{t.label}</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: t.color, margin: 0 }}>{t.valor}</p>
                </div>
              ))}
            </>
          )}
          {tabActiva === 'cuentas' && puedeRegistrar && (
            <button style={{ ...s.btnPrim, background: '#3B6D11' }} onClick={() => setShowModalMov(true)}>+ Movimiento</button>
          )}
          {tabActiva === 'creditos' && puedeAdminCuentas && (
            <button style={s.btnPrim} onClick={() => { setEditandoCredito(null); setShowModalCredito(true) }}>+ Nuevo crédito</button>
          )}
        </div>
      </div>

      {/* Pestañas + Filtros */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, borderBottom: '2px solid rgba(0,0,0,.06)' }}>
        {[
          { id: 'cuentas', label: 'Cuentas & Movimientos' },
          { id: 'creditos', label: `Créditos${creditos.length ? ` (${creditos.length})` : ''}` },
        ].map(tab => (
          <button key={tab.id} onClick={() => setTabActiva(tab.id)} style={{
            padding: '10px 16px', border: 'none', borderBottom: `2.5px solid ${tabActiva === tab.id ? 'var(--eco-primary, #1a3a5c)' : 'transparent'}`,
            background: 'none', fontSize: 13, fontWeight: tabActiva === tab.id ? 600 : 400,
            color: tabActiva === tab.id ? 'var(--eco-primary, #1a3a5c)' : '#888',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s', marginBottom: -2, flexShrink: 0,
          }}>{tab.label}</button>
        ))}
        {/* Filtros a la derecha, solo en tab cuentas */}
        {tabActiva === 'cuentas' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', marginBottom: -2, flexWrap: 'wrap' }}>
            {/* Grupos TDC */}
            {(() => {
              const gruposConTarjetas = gruposTdc.filter(g => cuentas.some(c => c.grupoTdc === g.id))
              if (gruposConTarjetas.length === 0) return null
              return gruposConTarjetas.map(g => {
                const tarjetasGrupo = cuentas.filter(c => c.grupoTdc === g.id)
                let saldoTotal = 0
                tarjetasGrupo.forEach(t => { const info = tdcInfo[t.id]; if (info) saldoTotal += info.saldoActual })
                const limite = tarjetasGrupo.reduce((max, t) => Math.max(max, Number(t.limiteTdc || 0)), 0)
                const disponible = limite - saldoTotal
                return (
                  <div key={g.id} style={{ background: '#fff', border: '1.5px solid #854F0B33', borderRadius: 6, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: '#854F0B', fontWeight: 600 }}>{g.nombre}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: disponible < 0 ? '#A32D2D' : '#3B6D11' }}>{fmt(disponible, 'USD')}</span>
                  </div>
                )
              })
            })()}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <input style={{ ...s.inp, borderRadius: '6px 0 0 6px', borderRight: 'none', width: 105, fontSize: 11, padding: '5px 8px' }} type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} title="Desde" />
              <input style={{ ...s.inp, borderRadius: '0 6px 6px 0', width: 105, fontSize: 11, padding: '5px 8px' }} type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} title="Hasta" />
            </div>
            <select style={{ ...s.inp, fontSize: 11, padding: '5px 8px' }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="ingreso">Ingresos</option>
              <option value="egreso">Egresos</option>
              <option value="transferencia">Transferencias</option>
            </select>
            <input style={{ ...s.inp, width: 120, fontSize: 11, padding: '5px 8px' }} placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
        )}
      </div>

      {/* ═══════════════ TAB: CUENTAS & MOVIMIENTOS ═══════════════ */}
      {tabActiva === 'cuentas' && <>

      {/* Tarjetas de cuentas */}
      {loadingC ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>Cargando cuentas...</div>
      ) : cuentas.length === 0 ? (
        <div style={{ ...s.card, padding: 40, textAlign: 'center', color: '#999', fontSize: 13, marginBottom: 20 }}>
          No hay cuentas bancarias. {puedeAdminCuentas && <span style={{ color: 'var(--eco-primary, #1a3a5c)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setShowModalCuenta(true)}>Creá la primera.</span>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 6, marginBottom: 16 }}>
          {cuentas.map(c => (
            <TarjetaCuenta
              key={c.id}
              cuenta={c}
              saldo={puedeVerSaldos ? (saldoPorCuenta[c.id] || 0) : null}
              tdcInfo={tdcInfo[c.id]}
              seleccionada={cuentaActiva?.id === c.id}
              onClick={() => setCuentaActiva(cuentaActiva?.id === c.id ? null : c)}
              onEditar={() => { setEditandoCuenta(c); setShowModalCuenta(true) }}
            />
          ))}
        </div>
      )}

      {/* Tabla de movimientos */}
      <div style={s.card}>

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
                const mon     = m.moneda || cuenta?.moneda || 'USD'

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

      </>}

      {/* ═══════════════ TAB: CRÉDITOS BANCARIOS ═══════════════ */}
      {tabActiva === 'creditos' && <>

        {/* Modales créditos */}
        {showModalCredito && (
          <ModalCredito credito={editandoCredito} cuentas={cuentas} onGuardar={guardarCredito} onCerrar={() => { setShowModalCredito(false); setEditandoCredito(null) }} />
        )}
        {showModalPago && creditoPago && (
          <ModalPagoCuota credito={creditoPago} cuentas={cuentas} onPagar={(data) => pagarCuota(creditoPago, data)} onCerrar={() => { setShowModalPago(false); setCreditoPago(null) }} />
        )}

        {/* Resumen créditos */}
        {creditos.length > 0 && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {(() => {
              let totalDeuda = 0, totalPagadoG = 0
              creditos.forEach(cr => {
                const total = cr.cuotaMensual * cr.plazoMeses
                const pagado = (pagosPorCredito[cr.id] || []).reduce((s, p) => s + Number(p.monto || 0), 0)
                totalDeuda += total
                totalPagadoG += pagado
              })
              return [
                { label: 'Créditos activos', valor: creditos.filter(c => c.estado === 'activo').length, color: '#854F0B', prefix: '' },
                { label: 'Total pagado', valor: fmt(totalPagadoG, 'CRC'), color: '#3B6D11' },
                { label: 'Saldo total pendiente', valor: fmt(Math.max(totalDeuda - totalPagadoG, 0), 'CRC'), color: '#A32D2D' },
              ].map(m => (
                <div key={m.label} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,.08)', borderRadius: 10, padding: '14px 18px', flex: 1, minWidth: 160 }}>
                  <p style={{ fontSize: 11, color: '#888', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 6px' }}>{m.label}</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: m.color, margin: 0, letterSpacing: '-0.5px' }}>{m.prefix !== undefined ? m.valor : m.valor}</p>
                </div>
              ))
            })()}
          </div>
        )}

        {/* Tarjetas de créditos */}
        {loadingCreditos ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>Cargando créditos...</div>
        ) : creditos.length === 0 ? (
          <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,.08)', borderRadius: 10, padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>
            No hay créditos bancarios. {puedeAdminCuentas && <span style={{ color: 'var(--eco-primary, #1a3a5c)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setShowModalCredito(true)}>Creá el primero.</span>}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 20 }}>
            {creditos.map(cr => (
              <TarjetaCredito
                key={cr.id}
                credito={cr}
                pagosRealizados={pagosPorCredito[cr.id] || []}
                onEditar={() => { setEditandoCredito(cr); setShowModalCredito(true) }}
                onPagar={() => { setCreditoPago(cr); setShowModalPago(true) }}
                onVerDetalle={() => setCreditoDetalle(creditoDetalle?.id === cr.id ? null : cr)}
              />
            ))}
          </div>
        )}

        {/* Detalle del crédito seleccionado — tabla de amortización / pagos */}
        {creditoDetalle && (() => {
          const cr = creditoDetalle
          const pagos = pagosPorCredito[cr.id] || []
          const mon = cr.moneda || 'USD'
          const P = cr.montoOriginal
          const r = cr.tasaInteres / 100 / 12
          const n = cr.plazoMeses
          const cuota = cr.cuotaMensual

          // Generar tabla de amortización
          const amortizacion = []
          let saldo = P
          for (let i = 1; i <= n; i++) {
            const interes = saldo * r
            const capital = cuota - interes
            saldo = Math.max(saldo - capital, 0)
            const fechaCuota = new Date(cr.fechaInicio)
            fechaCuota.setMonth(fechaCuota.getMonth() + i)
            const fechaStr = fechaCuota.toISOString().split('T')[0]
            const pagado = pagos.find((p, idx) => idx === i - 1)
            amortizacion.push({ num: i, fecha: fechaStr, capital, interes, cuota, saldoRestante: saldo, pagado: !!pagado, montoPagado: pagado?.monto })
          }

          return (
            <div style={{ ...s.card, marginBottom: 20 }}>
              <div style={{ padding: '14px 18px', borderBottom: '0.5px solid rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{cr.nombre}</span>
                  <span style={{ fontSize: 12, color: '#888', marginLeft: 10 }}>Tabla de amortización</span>
                </div>
                {puedeAdminCuentas && (
                  <button onClick={() => { setConfirmElimCredito(confirmElimCredito === cr.id ? null : cr.id) }}
                    style={{ padding: '4px 12px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: confirmElimCredito === cr.id ? '#FCEBEB' : '#fff', color: confirmElimCredito === cr.id ? '#A32D2D' : '#888', fontFamily: 'inherit' }}>
                    {confirmElimCredito === cr.id ? '¿Confirmar eliminar?' : 'Eliminar crédito'}
                  </button>
                )}
                {confirmElimCredito === cr.id && (
                  <div style={{ display: 'flex', gap: 4, marginLeft: 6 }}>
                    <button onClick={() => { eliminarCredito(cr.id); setCreditoDetalle(null) }} style={{ padding: '4px 10px', border: 'none', borderRadius: 5, fontSize: 11, cursor: 'pointer', background: '#A32D2D', color: '#fff', fontFamily: 'inherit' }}>Sí, eliminar</button>
                    <button onClick={() => setConfirmElimCredito(null)} style={{ padding: '4px 10px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 5, fontSize: 11, cursor: 'pointer', background: '#fff', fontFamily: 'inherit' }}>No</button>
                  </div>
                )}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={s.th}>#</th>
                      <th style={s.th}>Fecha</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Capital</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Interés</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Cuota</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Saldo</th>
                      <th style={s.th}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {amortizacion.map(row => (
                      <tr key={row.num} style={{ background: row.pagado ? '#f8fdf5' : '' }}>
                        <td style={{ ...s.td, color: '#888' }}>{row.num}</td>
                        <td style={{ ...s.td, color: '#888' }}>{fmtFecha(row.fecha)}</td>
                        <td style={{ ...s.td, textAlign: 'right' }}>{fmt(row.capital, mon)}</td>
                        <td style={{ ...s.td, textAlign: 'right', color: '#A32D2D' }}>{fmt(row.interes, mon)}</td>
                        <td style={{ ...s.td, textAlign: 'right', fontWeight: 600 }}>{fmt(row.cuota, mon)}</td>
                        <td style={{ ...s.td, textAlign: 'right' }}>{fmt(row.saldoRestante, mon)}</td>
                        <td style={s.td}>
                          {row.pagado
                            ? <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#EAF3DE', color: '#3B6D11', fontWeight: 500 }}>Pagado</span>
                            : <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#f5f5f5', color: '#aaa', fontWeight: 500 }}>Pendiente</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Historial de pagos realizados */}
              {pagos.length > 0 && (
                <div style={{ padding: '14px 18px', borderTop: '0.5px solid rgba(0,0,0,.06)' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, margin: '0 0 8px', color: '#555' }}>Pagos realizados ({pagos.length})</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {pagos.map((p, i) => (
                      <div key={p.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#f8f9fa', borderRadius: 6, fontSize: 12 }}>
                        <span style={{ color: '#888' }}>{fmtFecha(p.fecha)}</span>
                        <span style={{ fontWeight: 600, color: '#3B6D11' }}>+{fmt(p.monto, mon)}</span>
                        {p.referencia && <span style={{ color: '#aaa', fontSize: 11 }}>Ref: {p.referencia}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })()}

      </>}

    </div>
  )
}