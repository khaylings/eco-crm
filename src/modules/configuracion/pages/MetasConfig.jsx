/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: MetasConfig.jsx
 * Módulo:  Configuracion
 * ============================================================
 */

import { useState, useEffect } from 'react'
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore'
import { db } from '../../../firebase/firestore'
import { usePermisos } from '../../../hooks/usePermisos'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const inp = {
  border: '0.5px solid #d0d8d0', borderRadius: 6, padding: '7px 10px',
  fontSize: 13, outline: 'none', fontFamily: 'inherit',
  background: '#fff', color: '#1a1a1a', width: '100%', boxSizing: 'border-box',
}

export default function MetasConfig() {
  const { esAdmin } = usePermisos()
  const ahora = new Date()
  const [mes, setMes]         = useState(ahora.getMonth())
  const [anio, setAnio]       = useState(ahora.getFullYear())
  const [vendedores, setVendedores] = useState([])
  const [metas, setMetas]     = useState({})
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg]         = useState('')

  const docId = `${anio}-${String(mes + 1).padStart(2, '0')}`

  useEffect(() => { cargar() }, [mes, anio])

  const cargar = async () => {
    const snap = await getDocs(collection(db, 'usuarios'))
    const vends = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.activo !== false && !['Solo lectura','Técnico'].includes(u.rol))
    setVendedores(vends)

    const metaSnap = await getDoc(doc(db, 'metas', docId))
    if (metaSnap.exists()) {
      setMetas(metaSnap.data().vendedores || {})
    } else {
      const init = {}
      vends.forEach(v => {
        init[v.id] = { meta: '', comisionTipo: '%', comisionSiCumple: '', comisionNoCumple: '' }
      })
      setMetas(init)
    }
  }

  const setMeta = (uid, campo, valor) => {
    setMetas(prev => ({ ...prev, [uid]: { ...prev[uid], [campo]: valor } }))
    setMsg('')
  }

  const guardar = async () => {
    if (!esAdmin) return
    setGuardando(true)
    try {
      await setDoc(doc(db, 'metas', docId), {
        mes, anio, periodo: docId,
        vendedores: metas,
        actualizadoEn: new Date().toISOString(),
      })
      setMsg('✓ Metas guardadas')
      setTimeout(() => setMsg(''), 3000)
    } catch (e) {
      setMsg('Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const anios = [ahora.getFullYear() - 1, ahora.getFullYear(), ahora.getFullYear() + 1]

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 500, color: '#1a1a1a', margin: 0 }}>Metas y comisiones</h2>
          <p style={{ fontSize: 12, color: '#888', marginTop: 3 }}>
            La meta se compara contra el monto facturado <strong>sin IVA</strong>. La comisión se calcula sobre ese mismo monto base.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {msg && <span style={{ fontSize: 12, color: msg.startsWith('✓') ? '#3B6D11' : '#cc3333' }}>{msg}</span>}
          {esAdmin && (
            <button onClick={guardar} disabled={guardando} style={{ background: 'var(--eco-primary)', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 18px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
              {guardando ? 'Guardando...' : 'Guardar metas'}
            </button>
          )}
        </div>
      </div>

      {!esAdmin && (
        <div style={{ background: '#FAEEDA', border: '0.5px solid #FAC775', borderRadius: 8, padding: '9px 14px', marginBottom: 16, fontSize: 12, color: '#854F0B', display: 'flex', gap: 8 }}>
          <span>🔒</span>
          <span>Solo el <strong>Administrador</strong> puede configurar metas y comisiones.</span>
        </div>
      )}

      {/* Selector de período */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#888' }}>Período:</span>
        <select value={mes} onChange={e => setMes(Number(e.target.value))}
          style={{ ...inp, width: 140 }}>
          {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select value={anio} onChange={e => setAnio(Number(e.target.value))}
          style={{ ...inp, width: 90 }}>
          {anios.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span style={{ fontSize: 11, color: '#aaa', marginLeft: 4 }}>
          Mostrando: {MESES[mes]} {anio}
        </span>
      </div>

      {/* Tabla de vendedores */}
      <div style={{ background: '#fff', border: '0.5px solid #d0d8d0', borderRadius: 10, overflow: 'hidden' }}>

        {/* Encabezado */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 120px 150px 150px', gap: 0, background: '#f9fbf9', borderBottom: '0.5px solid #eee', padding: '10px 16px' }}>
          {['Vendedor', 'Meta del mes (sin IVA)', 'Tipo comisión', '% / Monto si cumple', '% / Monto si NO cumple'].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '.4px' }}>{h}</span>
          ))}
        </div>

        {vendedores.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: '#bbb', fontSize: 13 }}>No hay vendedores registrados</div>
        )}

        {vendedores.map((v, idx) => {
          const m = metas[v.id] || { meta: '', comisionTipo: '%', comisionSiCumple: '', comisionNoCumple: '' }
          const metaNum = Number(m.meta || 0)
          return (
            <div key={v.id} style={{
              display: 'grid', gridTemplateColumns: '1fr 160px 120px 150px 150px',
              gap: 0, padding: '12px 16px', alignItems: 'center',
              borderBottom: idx < vendedores.length - 1 ? '0.5px solid #f0f0f0' : 'none',
              background: idx % 2 === 0 ? '#fff' : '#fafafa',
            }}>
              {/* Vendedor */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--eco-primary-light, #e8f0fe)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: 'var(--eco-primary, #1a3a5c)', flexShrink: 0, overflow: 'hidden' }}>
                  {v.fotoURL
                    ? <img src={v.fotoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    : v.nombre?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>{v.nombre}</div>
                  <div style={{ fontSize: 11, color: '#aaa' }}>{v.rol}</div>
                </div>
              </div>

              {/* Meta */}
              <div style={{ paddingRight: 12 }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#888' }}>$</span>
                  <input
                    type="number" min="0" value={m.meta}
                    onChange={e => setMeta(v.id, 'meta', e.target.value)}
                    disabled={!esAdmin}
                    placeholder="0.00"
                    style={{ ...inp, paddingLeft: 22, opacity: esAdmin ? 1 : 0.6, cursor: esAdmin ? 'text' : 'default' }}
                  />
                </div>
              </div>

              {/* Tipo comisión */}
              <div style={{ paddingRight: 12 }}>
                <select
                  value={m.comisionTipo}
                  onChange={e => setMeta(v.id, 'comisionTipo', e.target.value)}
                  disabled={!esAdmin}
                  style={{ ...inp, opacity: esAdmin ? 1 : 0.6, cursor: esAdmin ? 'pointer' : 'default' }}
                >
                  <option value="%">Porcentaje (%)</option>
                  <option value="fijo">Monto fijo ($)</option>
                </select>
              </div>

              {/* Si cumple */}
              <div style={{ paddingRight: 12 }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#3B6D11' }}>
                    {m.comisionTipo === '%' ? '%' : '$'}
                  </span>
                  <input
                    type="number" min="0" value={m.comisionSiCumple}
                    onChange={e => setMeta(v.id, 'comisionSiCumple', e.target.value)}
                    disabled={!esAdmin}
                    placeholder={m.comisionTipo === '%' ? 'ej: 5' : 'ej: 200'}
                    style={{ ...inp, paddingLeft: 22, borderColor: '#C0DD97', opacity: esAdmin ? 1 : 0.6, cursor: esAdmin ? 'text' : 'default' }}
                  />
                </div>
                {metaNum > 0 && m.comisionSiCumple && (
                  <div style={{ fontSize: 10, color: '#3B6D11', marginTop: 3 }}>
                    ≈ {m.comisionTipo === '%'
                      ? `$${(metaNum * Number(m.comisionSiCumple) / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                      : `$${Number(m.comisionSiCumple).toLocaleString()}`} si llega a meta
                  </div>
                )}
              </div>

              {/* Si no cumple */}
              <div>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#A32D2D' }}>
                    {m.comisionTipo === '%' ? '%' : '$'}
                  </span>
                  <input
                    type="number" min="0" value={m.comisionNoCumple}
                    onChange={e => setMeta(v.id, 'comisionNoCumple', e.target.value)}
                    disabled={!esAdmin}
                    placeholder={m.comisionTipo === '%' ? 'ej: 2' : 'ej: 100'}
                    style={{ ...inp, paddingLeft: 22, borderColor: '#F7C1C1', opacity: esAdmin ? 1 : 0.6, cursor: esAdmin ? 'text' : 'default' }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Nota */}
      <div style={{ marginTop: 14, padding: '10px 14px', background: '#f5f6f8', borderRadius: 8, fontSize: 11, color: '#888' }}>
        <strong>Nota:</strong> La meta y la comisión se calculan sobre el monto base de las facturas del mes (sin IVA del 13%).
        Si el tipo es <strong>%</strong>, se aplica sobre el total facturado sin IVA.
        Si es <strong>monto fijo</strong>, se paga ese valor independientemente del total, siempre que se cumpla o no la condición.
      </div>
    </div>
  )
}