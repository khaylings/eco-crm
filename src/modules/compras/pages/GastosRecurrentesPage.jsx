/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: GastosRecurrentesPage.jsx
 * Módulo:  Compras
 * ============================================================
 */

import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { db } from '../../../firebase/config'
import { useNavigate } from 'react-router-dom'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n, mon = 'CRC') =>
  mon === 'USD'
    ? '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '₡' + Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 0 })

const FRECUENCIAS = [
  { val: 'mensual',   label: 'Mensual',   desc: 'Se repite cada mes' },
  { val: 'bimestral', label: 'Bimestral', desc: 'Cada 2 meses' },
  { val: 'trimestral',label: 'Trimestral',desc: 'Cada 3 meses' },
  { val: 'semestral', label: 'Semestral', desc: 'Cada 6 meses' },
  { val: 'anual',     label: 'Anual',     desc: 'Una vez al año' },
  { val: 'semanal',   label: 'Semanal',   desc: 'Cada semana' },
]

const CATEGORIAS = ['Alquiler', 'Servicios públicos', 'Internet / Telefonía', 'Seguros', 'Suscripciones', 'Nómina', 'Impuestos', 'Mantenimiento', 'Transporte', 'Otro']

const diasHastaVencimiento = (diaDelMes) => {
  if (!diaDelMes) return null
  const hoy  = new Date()
  const mes  = hoy.getMonth()
  const anio = hoy.getFullYear()
  let vence  = new Date(anio, mes, diaDelMes)
  if (vence < hoy) vence = new Date(anio, mes + 1, diaDelMes) // próximo mes
  return Math.ceil((vence - hoy) / 86400000)
}

const proximaFecha = (diaDelMes) => {
  if (!diaDelMes) return '—'
  const hoy  = new Date()
  const mes  = hoy.getMonth()
  const anio = hoy.getFullYear()
  let vence  = new Date(anio, mes, diaDelMes)
  if (vence <= hoy) vence = new Date(anio, mes + 1, diaDelMes)
  return vence.toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ── Modal gasto recurrente ────────────────────────────────────────────────────
function ModalGasto({ gasto, onGuardar, onCerrar }) {
  const [form, setForm] = useState({
    nombre:      gasto?.nombre      || '',
    categoria:   gasto?.categoria   || 'Otro',
    monto:       gasto?.monto       || '',
    moneda:      gasto?.moneda      || 'CRC',
    frecuencia:  gasto?.frecuencia  || 'mensual',
    diaDelMes:   gasto?.diaDelMes   || '',
    proveedor:   gasto?.proveedor   || '',
    notas:       gasto?.notas       || '',
    activo:      gasto?.activo      ?? true,
    alertaDias:  gasto?.alertaDias  || 5,
  })
  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState('')

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleGuardar = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    if (!form.monto || Number(form.monto) <= 0) { setError('Ingresá un monto válido.'); return }
    setError('')
    setGuardando(true)
    await onGuardar({ ...form, monto: Number(form.monto) })
    setGuardando(false)
  }

  const s = {
    lbl: { fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4, display: 'block' },
    inp: { width: '100%', padding: '8px 11px', border: '0.5px solid rgba(0,0,0,.18)', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fff', color: 'inherit', fontFamily: 'inherit', boxSizing: 'border-box' },
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: '#fff', borderRadius: 14, width: '95%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,.2)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{gasto ? 'Editar gasto recurrente' : 'Nuevo gasto recurrente'}</div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa' }}>×</button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={s.lbl}>Nombre del gasto *</label>
            <input style={s.inp} placeholder="Ej: Alquiler oficina, Internet, Electricidad" value={form.nombre} onChange={e => upd('nombre', e.target.value)} autoFocus />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={s.lbl}>Categoría</label>
              <select style={s.inp} value={form.categoria} onChange={e => upd('categoria', e.target.value)}>
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={s.lbl}>Proveedor / Empresa</label>
              <input style={s.inp} placeholder="Ej: CNFL, ICE, Kolbi" value={form.proveedor} onChange={e => upd('proveedor', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={s.lbl}>Monto estimado *</label>
              <input style={{ ...s.inp, fontSize: 16, fontWeight: 600 }} type="number" min="0" step="0.01" placeholder="0.00" value={form.monto} onChange={e => upd('monto', e.target.value)} />
            </div>
            <div>
              <label style={s.lbl}>Moneda</label>
              <select style={s.inp} value={form.moneda} onChange={e => upd('moneda', e.target.value)}>
                <option value="CRC">CRC — Colón ₡</option>
                <option value="USD">USD — Dólar $</option>
              </select>
            </div>
          </div>

          <div>
            <label style={s.lbl}>Frecuencia</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {FRECUENCIAS.map(f => (
                <button key={f.val} onClick={() => upd('frecuencia', f.val)} style={{
                  padding: '8px 10px', border: `1.5px solid ${form.frecuencia === f.val ? 'var(--eco-primary, #1a3a5c)' : 'rgba(0,0,0,.12)'}`,
                  borderRadius: 8, cursor: 'pointer', background: form.frecuencia === f.val ? 'var(--eco-primary, #1a3a5c)' : '#fff',
                  color: form.frecuencia === f.val ? '#fff' : '#555', fontFamily: 'inherit', textAlign: 'left',
                }}>
                  <p style={{ fontWeight: 600, fontSize: 12, margin: 0 }}>{f.label}</p>
                  <p style={{ fontSize: 10, margin: 0, opacity: 0.75 }}>{f.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={s.lbl}>Día del mes de vencimiento</label>
              <input style={s.inp} type="number" min="1" max="31" placeholder="Ej: 1, 15, 30" value={form.diaDelMes} onChange={e => upd('diaDelMes', Number(e.target.value))} />
              <p style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>Día en que cae el pago cada período</p>
            </div>
            <div>
              <label style={s.lbl}>Alertar con {form.alertaDias} días de anticipación</label>
              <input style={s.inp} type="range" min="1" max="30" value={form.alertaDias} onChange={e => upd('alertaDias', Number(e.target.value))} />
              <p style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>Días antes para recibir recordatorio</p>
            </div>
          </div>

          <div>
            <label style={s.lbl}>Notas</label>
            <textarea style={{ ...s.inp, resize: 'vertical' }} rows={2} placeholder="Información adicional..." value={form.notas} onChange={e => upd('notas', e.target.value)} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={form.activo} onChange={e => upd('activo', e.target.checked)} style={{ width: 15, height: 15, accentColor: 'var(--eco-primary, #1a3a5c)' }} />
            Gasto activo (aparece en recordatorios)
          </label>

          {error && <div style={{ padding: '8px 12px', background: '#FCEBEB', borderRadius: 7, fontSize: 12, color: '#A32D2D' }}>{error}</div>}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(0,0,0,.08)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onCerrar} style={{ padding: '8px 16px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: '#f5f5f5', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={guardando} style={{ padding: '8px 22px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: guardando ? 'not-allowed' : 'pointer', background: guardando ? '#e0e0e0' : 'var(--eco-primary, #1a3a5c)', color: guardando ? '#aaa' : '#fff', fontFamily: 'inherit' }}>
            {guardando ? 'Guardando...' : gasto ? 'Guardar cambios' : 'Crear gasto'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function GastosRecurrentesPage() {
  const navigate = useNavigate()

  const [gastos,        setGastos]       = useState([])
  const [loading,       setLoading]      = useState(true)
  const [modal,         setModal]        = useState(false)
  const [editando,      setEditando]     = useState(null)
  const [confirmElim,   setConfirmElim]  = useState(null)
  const [filtroFrecuencia, setFiltroFrec] = useState('todas')

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'gastos_recurrentes'), snap => {
      setGastos(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
        const da = diasHastaVencimiento(a.diaDelMes) ?? 999
        const db_ = diasHastaVencimiento(b.diaDelMes) ?? 999
        return da - db_
      }))
      setLoading(false)
    })
    return unsub
  }, [])

  const guardar = async (form) => {
    if (editando) {
      await updateDoc(doc(db, 'gastos_recurrentes', editando.id), { ...form, actualizadoEn: serverTimestamp() })
    } else {
      await addDoc(collection(db, 'gastos_recurrentes'), { ...form, creadoEn: serverTimestamp() })
    }
    setModal(false)
    setEditando(null)
  }

  const eliminar = async (id) => {
    await deleteDoc(doc(db, 'gastos_recurrentes', id))
    setConfirmElim(null)
  }

  const registrarGasto = (gasto) => {
    // Navegar a nueva orden de compra pre-llenada con los datos del gasto recurrente
    navigate('/compras/nueva', { state: { gastoRecurrente: gasto } })
  }

  const filtrados = gastos.filter(g => {
    if (filtroFrecuencia !== 'todas' && g.frecuencia !== filtroFrecuencia) return false
    return true
  })

  const totalMensual = gastos
    .filter(g => g.activo !== false && g.frecuencia === 'mensual')
    .reduce((acc, g) => acc + Number(g.monto || 0), 0)

  const s = {
    page:  { padding: '24px 28px', minHeight: '100vh', background: 'var(--eco-bg, #f5f6f8)' },
    card:  { background: '#fff', border: '0.5px solid rgba(0,0,0,.08)', borderRadius: 10, overflow: 'hidden' },
    inp:   { padding: '7px 12px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff', color: 'inherit', fontFamily: 'inherit' },
    btnP:  { padding: '8px 18px', background: 'var(--eco-primary, #1a3a5c)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
    btnSm: { padding: '4px 12px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: '#fff', fontFamily: 'inherit' },
  }

  return (
    <div style={s.page}>

      {modal && (
        <ModalGasto gasto={editando} onGuardar={guardar} onCerrar={() => { setModal(false); setEditando(null) }} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={{ ...s.btnSm, padding: '5px 10px' }} onClick={() => navigate('/compras')}>← Compras</button>
          <p style={{ fontSize: 20, fontWeight: 500, color: 'var(--eco-primary, #1a3a5c)', margin: 0 }}>Gastos recurrentes</p>
        </div>
        <button style={s.btnP} onClick={() => { setEditando(null); setModal(true) }}>+ Nuevo gasto</button>
      </div>

      {/* Métrica mensual */}
      {totalMensual > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,.08)', borderRadius: 10, padding: '14px 18px', minWidth: 200 }}>
            <p style={{ fontSize: 11, color: '#888', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 6px' }}>Gastos fijos mensuales</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#854F0B', margin: 0 }}>{fmt(totalMensual, 'CRC')}</p>
          </div>
          <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,.08)', borderRadius: 10, padding: '14px 18px', flex: 1 }}>
            <p style={{ fontSize: 11, color: '#888', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 6px' }}>Próximos vencimientos</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {gastos.filter(g => g.activo !== false && g.diaDelMes && (diasHastaVencimiento(g.diaDelMes) ?? 999) <= 7).map(g => {
                const dias = diasHastaVencimiento(g.diaDelMes)
                return (
                  <span key={g.id} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: dias === 0 ? '#FCEBEB' : dias <= 3 ? '#FAEEDA' : '#EAF3DE', color: dias === 0 ? '#A32D2D' : dias <= 3 ? '#854F0B' : '#3B6D11' }}>
                    {g.nombre} · {dias === 0 ? 'hoy' : `${dias}d`}
                  </span>
                )
              })}
              {gastos.filter(g => g.activo !== false && g.diaDelMes && (diasHastaVencimiento(g.diaDelMes) ?? 999) <= 7).length === 0 && (
                <span style={{ fontSize: 12, color: '#aaa' }}>Sin vencimientos en los próximos 7 días</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['todas', 'Todas'], ...FRECUENCIAS.map(f => [f.val, f.label])].map(([val, lbl]) => (
          <button key={val} onClick={() => setFiltroFrec(val)} style={{
            ...s.btnSm,
            background:  filtroFrecuencia === val ? 'var(--eco-primary, #1a3a5c)' : '#fff',
            color:       filtroFrecuencia === val ? '#fff' : '#555',
            borderColor: filtroFrecuencia === val ? 'transparent' : 'rgba(0,0,0,.15)',
          }}>{lbl}</button>
        ))}
      </div>

      {/* Tarjetas */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>Cargando...</div>
      ) : filtrados.length === 0 ? (
        <div style={{ ...s.card, padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>
          {gastos.length === 0 ? 'No hay gastos recurrentes. Creá el primero.' : 'Sin resultados para ese filtro.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {filtrados.map(g => {
            const dias       = diasHastaVencimiento(g.diaDelMes)
            const proxima    = proximaFecha(g.diaDelMes)
            const urgente    = dias !== null && dias <= (g.alertaDias || 5)
            const muyUrgente = dias !== null && dias <= 2
            const frec       = FRECUENCIAS.find(f => f.val === g.frecuencia)

            return (
              <div key={g.id} style={{
                background: '#fff', borderRadius: 10, padding: '16px 18px',
                border: `1.5px solid ${muyUrgente ? '#E24B4A' : urgente ? '#EF9F27' : 'rgba(0,0,0,.08)'}`,
                opacity: g.activo === false ? 0.6 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.nombre}</p>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: '#FAEEDA', color: '#854F0B', fontWeight: 500 }}>{frec?.label || g.frecuencia}</span>
                      <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: '#F1EFE8', color: '#5F5E5A' }}>{g.categoria}</span>
                      {g.activo === false && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: '#F1EFE8', color: '#888' }}>Inactivo</span>}
                    </div>
                  </div>
                  <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--eco-primary, #1a3a5c)', margin: 0, flexShrink: 0, marginLeft: 8 }}>
                    {fmt(g.monto, g.moneda || 'CRC')}
                  </p>
                </div>

                {g.proveedor && <p style={{ fontSize: 12, color: '#888', margin: '0 0 8px' }}>🏢 {g.proveedor}</p>}

                {/* Próximo vencimiento */}
                {g.diaDelMes ? (
                  <div style={{ padding: '8px 10px', borderRadius: 7, background: muyUrgente ? '#FCEBEB' : urgente ? '#FAEEDA' : '#f8f9fb', marginBottom: 12 }}>
                    <p style={{ fontSize: 11, color: muyUrgente ? '#A32D2D' : urgente ? '#854F0B' : '#888', margin: 0, fontWeight: urgente ? 600 : 400 }}>
                      {muyUrgente ? '🔴' : urgente ? '🟡' : '📅'} Próximo: {proxima}
                      {dias !== null && <span style={{ marginLeft: 6, fontWeight: 600 }}>({dias === 0 ? 'hoy' : `en ${dias}d`})</span>}
                    </p>
                  </div>
                ) : (
                  <div style={{ padding: '8px 10px', borderRadius: 7, background: '#f8f9fb', marginBottom: 12 }}>
                    <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>Sin fecha de vencimiento configurada</p>
                  </div>
                )}

                {g.notas && <p style={{ fontSize: 11, color: '#999', fontStyle: 'italic', margin: '0 0 12px' }}>{g.notas}</p>}

                {/* Acciones */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={{ flex: 1, padding: '7px', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: 'var(--eco-primary, #1a3a5c)', color: '#fff', fontFamily: 'inherit' }}
                    onClick={() => registrarGasto(g)}>
                    + Registrar este mes
                  </button>
                  <button style={{ padding: '7px 12px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 12, cursor: 'pointer', background: '#fff', fontFamily: 'inherit' }}
                    onClick={() => { setEditando(g); setModal(true) }}>✎</button>
                  {confirmElim === g.id ? (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <button style={{ padding: '5px 10px', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: '#FCEBEB', color: '#A32D2D', fontFamily: 'inherit' }} onClick={() => eliminar(g.id)}>Sí</button>
                      <button style={{ padding: '5px 8px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: '#fff', fontFamily: 'inherit' }} onClick={() => setConfirmElim(null)}>No</button>
                    </div>
                  ) : (
                    <button style={{ padding: '7px 10px', border: '0.5px solid rgba(0,0,0,.12)', borderRadius: 7, fontSize: 14, cursor: 'pointer', background: '#fff', color: '#ccc', fontFamily: 'inherit' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#E24B4A'}
                      onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
                      onClick={() => setConfirmElim(g.id)}>✕</button>
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