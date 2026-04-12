/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: Consecutivos.jsx
 * Módulo:  Configuracion
 * ============================================================
 */

import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../../../firebase/firestore'

const DOCUMENTOS = [
  { key: 'prefijoCotizacion',    label: 'Cotizaciones',       ejemplo: 'CTO-001', default: 'CTO', descripcion: 'Cotizaciones del modulo de Ventas' },
  { key: 'prefijoFactura',       label: 'Facturas',           ejemplo: 'FAC-001', default: 'FAC', descripcion: 'Facturas del modulo de Facturacion' },
  { key: 'prefijoProyecto',      label: 'Proyectos',          ejemplo: 'PRY-001', default: 'PRY', descripcion: 'Proyectos del modulo Comercial' },
  { key: 'prefijoCotProyecto',   label: 'Cotiz. de Proyecto', ejemplo: 'CP-001',  default: 'CP',  descripcion: 'Cotizaciones internas de proyectos' },
  { key: 'prefijoOrdenCompra',   label: 'Ordenes de Compra',  ejemplo: 'OC-001',  default: 'OC',  descripcion: 'Ordenes de compra del modulo Compras' },
  { key: 'prefijoOrdenTrabajo',  label: 'Ordenes de Trabajo', ejemplo: 'OT-001',  default: 'OT',  descripcion: 'Ordenes de trabajo / servicios' },
]

export default function Consecutivos() {
  const [valores, setValores]   = useState({})
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado]   = useState(false)

  useEffect(() => {
    async function cargar() {
      const snap = await getDoc(doc(db, 'config', 'consecutivos'))
      if (snap.exists()) {
        setValores(snap.data())
      } else {
        const defaults = {}
        DOCUMENTOS.forEach(d => { defaults[d.key] = d.default })
        setValores(defaults)
      }
      setCargando(false)
    }
    cargar()
  }, [])

  async function guardar() {
    setGuardando(true)
    await setDoc(doc(db, 'config', 'consecutivos'), valores)
    setGuardando(false)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2500)
  }

  if (cargando) return (
    <div style={{ padding: '40px 32px', color: 'var(--color-text-tertiary)', fontSize: 14 }}>Cargando...</div>
  )

  return (
    <div style={{ padding: '28px 32px', maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.3px' }}>
          Codigos y Consecutivos
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
          Configura los prefijos de los codigos para cada tipo de documento. Los numeros se generan automaticamente.
        </div>
      </div>

      <div style={{ background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#1565c0', marginBottom: 20 }}>
        Ejemplo: si el prefijo de Cotizaciones es <strong>CTO</strong>, los documentos se numeraran como <strong>CTO-001, CTO-002, CTO-003...</strong>
      </div>

      {DOCUMENTOS.map(d => (
        <div key={d.key} style={{ background: 'var(--color-background-primary)', border: '1px solid var(--color-border-secondary)', borderRadius: 12, padding: '18px 20px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)', marginBottom: 2 }}>{d.label}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{d.descripcion}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  Prefijo
                </label>
                <input
                  value={valores[d.key] || d.default}
                  onChange={e => setValores(v => ({ ...v, [d.key]: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') }))}
                  maxLength={10}
                  style={{
                    width: 110, padding: '8px 12px', borderRadius: 8, fontSize: 15,
                    border: '1.5px solid var(--color-border-secondary)',
                    background: 'var(--color-background-secondary)',
                    color: '#2e7d32', fontFamily: 'monospace', fontWeight: 700,
                    outline: 'none', textAlign: 'center', textTransform: 'uppercase', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 18 }}>
                → <strong style={{ fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>
                  {(valores[d.key] || d.default)}-001
                </strong>
              </div>
            </div>
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
        <button onClick={guardar} disabled={guardando} style={{
          padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: '#2e7d32', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
        }}>
          {guardando ? 'Guardando...' : 'Guardar configuracion'}
        </button>
        {guardado && (
          <span style={{ fontSize: 13, color: '#2e7d32', fontWeight: 500 }}>Guardado correctamente</span>
        )}
      </div>

      <div style={{ marginTop: 32, background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 10, padding: '16px 18px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.5px' }}>
          Configuracion actual
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {DOCUMENTOS.map(d => (
            <div key={d.key} style={{ background: 'var(--color-background-primary)', border: '1px solid var(--color-border-secondary)', borderRadius: 8, padding: '6px 12px', fontSize: 12 }}>
              <span style={{ color: 'var(--color-text-tertiary)' }}>{d.label}: </span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2e7d32' }}>{valores[d.key] || d.default}-###</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}