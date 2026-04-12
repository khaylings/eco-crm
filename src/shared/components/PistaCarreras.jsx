/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: PistaCarreras.jsx
 * Módulo:  Shared / Components
 * ============================================================
 */

import { useState, useEffect } from 'react'
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'

const ROLES_SUPERIORES = ['Administrador', 'Supervisor', 'admin', 'supervisor']

const COLORES = [
  { bg: '#185FA5', border: '#B5D4F4', text: '#fff', chip: '#E6F1FB', chipText: '#0C447C' },
  { bg: '#3B6D11', border: '#9FE1CB', text: '#fff', chip: '#EAF3DE', chipText: '#27500A' },
  { bg: '#854F0B', border: '#FAC775', text: '#fff', chip: '#FAEEDA', chipText: '#633806' },
  { bg: '#534AB7', border: '#AFA9EC', text: '#fff', chip: '#EEEDFE', chipText: '#3C3489' },
  { bg: '#A32D2D', border: '#F7C1C1', text: '#fff', chip: '#FCEBEB', chipText: '#791F1F' },
  { bg: '#0F6E56', border: '#5DCAA5', text: '#fff', chip: '#E1F5EE', chipText: '#085041' },
]

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function baseSinIva(f) {
  const base = Number(f.base || 0)
  if (base > 0) return base
  return Number(f.total || 0) / 1.13
}

export default function PistaCarreras({ mes: mesProp, anio: anioProp }) {
  const { usuario } = useAuth()
  const esSuperior = ROLES_SUPERIORES.includes(usuario?.rol)

  const ahora = new Date()
  const mes  = mesProp  ?? ahora.getMonth()
  const anio = anioProp ?? ahora.getFullYear()
  const [corredores, setCorredores] = useState([])
  const [metaEquipo, setMetaEquipo] = useState(0)
  const [totalEquipo, setTotalEquipo] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [vistaDetalle, setVistaDetalle] = useState(false)

  const docId = `${anio}-${String(mes + 1).padStart(2, '0')}`

  useEffect(() => { cargar() }, [mesProp, anioProp, usuario?.uid])

  const cargar = async () => {
    if (!usuario?.uid) return
    setCargando(true)
    try {
      const snapU = await getDocs(collection(db, 'usuarios'))
      const vendedores = snapU.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.activo !== false && !['Solo lectura','Técnico'].includes(u.rol))

      const metaSnap = await getDoc(doc(db, 'metas', docId))
      const metasData = metaSnap.exists() ? (metaSnap.data().vendedores || {}) : {}

      const fechaDesde = `${anio}-${String(mes+1).padStart(2,'0')}-01`
      const fechaHasta = `${anio}-${String(mes+1).padStart(2,'0')}-31`

      const snapF = await getDocs(query(
        collection(db, 'facturas'),
        where('fechaEmision', '>=', fechaDesde),
        where('fechaEmision', '<=', fechaHasta)
      ))
      const facturas = snapF.docs.map(d => ({ id: d.id, ...d.data() }))

      const ventasPorVendedor = {}
      facturas.forEach(f => {
        const vid = f.vendedorId
        if (!vid) return
        ventasPorVendedor[vid] = (ventasPorVendedor[vid] || 0) + baseSinIva(f)
      })

      let sumaEquipo = 0, sumaMetaEquipo = 0

      const lista = vendedores.map((v, idx) => {
        const meta = metasData[v.id] || {}
        const metaNum = Number(meta.meta || 0)
        const vendido = ventasPorVendedor[v.id] || 0
        const pct = metaNum > 0 ? Math.min((vendido / metaNum) * 100, 100) : 0
        const cumplio = vendido >= metaNum && metaNum > 0

        let comision = 0
        const tasa = cumplio ? Number(meta.comisionSiCumple || 0) : Number(meta.comisionNoCumple || 0)
        if (meta.comisionTipo === 'fijo') comision = tasa
        else comision = vendido * tasa / 100

        sumaEquipo     += vendido
        sumaMetaEquipo += metaNum

        return { ...v, meta: metaNum, vendido, pct: Math.round(pct), cumplio, comision, color: COLORES[idx % COLORES.length] }
      })

      lista.sort((a, b) => b.pct - a.pct)

      setCorredores(lista)
      setTotalEquipo(sumaEquipo)
      setMetaEquipo(sumaMetaEquipo)
    } catch (e) {
      console.error('Error pista:', e)
    } finally {
      setCargando(false)
    }
  }

  const fmt = (n) => '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })
  const pctEquipo = metaEquipo > 0 ? Math.min(Math.round((totalEquipo / metaEquipo) * 100), 100) : 0
  const esPropio = (c) => c.id === usuario?.uid

  return (
    <div style={{ background: '#ffffff', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 14, overflow: 'hidden', marginTop: 14 }}>

      {/* Header */}
      <div style={{ padding: '12px 18px', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>Pista de carreras</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{MESES[mes]} {anio}</span>

        <button onClick={() => setVistaDetalle(v => !v)}
          style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--color-text-secondary)' }}>
          {vistaDetalle ? 'Ver pista' : 'Ver detalle'}
        </button>
      </div>

      {cargando ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Cargando...</div>
      ) : !vistaDetalle ? (
        <div style={{ padding: '20px 18px 14px' }}>

          {/* PISTA ÚNICA */}
          <div style={{ position: 'relative', paddingBottom: 28, paddingTop: 20 }}>

            {/* Asfalto */}
            <div style={{ position: 'relative', height: 54, background: '#1a2a3a', borderRadius: 10 }}>

              {/* Línea central punteada */}
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, transform: 'translateY(-50%)',
                background: 'repeating-linear-gradient(90deg,rgba(255,255,255,.18) 0,rgba(255,255,255,.18) 16px,transparent 16px,transparent 32px)' }} />

              {/* Líneas de referencia */}
              {[25,50,75].map(p => (
                <div key={p} style={{ position: 'absolute', left: `${p}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,.07)' }} />
              ))}

              {/* Bandera meta */}
              <div style={{ position: 'absolute', right: -2, top: -16, fontSize: 18, lineHeight: 1 }}>🏁</div>
              <div style={{ position: 'absolute', right: 0, top: -16, bottom: -4, width: 1, background: 'rgba(255,255,255,.25)' }} />

              {/* Avatares de corredores */}
              {corredores.map((c, idx) => {
                const left = Math.max(2, Math.min(c.pct, 97))
                const solapado = corredores.slice(0, idx).some(prev => Math.abs(prev.pct - c.pct) < 5)
                const topOffset = solapado ? (idx % 2 === 0 ? 4 : 22) : 12
                return (
                  <div key={c.id} style={{ position: 'absolute', left: `${left}%`, top: topOffset, transform: 'translateX(-50%)', zIndex: 10 + idx, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: c.color.bg, border: `2px solid ${c.color.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 500, color: '#fff',
                      overflow: 'hidden', flexShrink: 0,
                    }}>
                      {c.fotoURL
                        ? <img src={c.fotoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                        : c.nombre?.charAt(0)?.toUpperCase()}
                    </div>
                  </div>
                )
              })}

            </div>

            {/* Marcas de % */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingRight: 2 }}>
              {['0%','25%','50%','75%','meta'].map(l => (
                <span key={l} style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{l}</span>
              ))}
            </div>
          </div>

          {/* Chips de posición */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {corredores.map((c, idx) => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', borderRadius: 20, flex: 1, minWidth: 110,
                background: c.color.chip,
              }}>
                <span style={{ fontSize: 10, fontWeight: 500, color: c.color.chipText }}>{idx + 1}°</span>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: c.color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, color: '#fff', overflow: 'hidden', flexShrink: 0 }}>
                  {c.fotoURL
                    ? <img src={c.fotoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    : c.nombre?.charAt(0)?.toUpperCase()}
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: c.color.chipText, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.nombre?.split(' ')[0]}
                </span>
                <span style={{ fontSize: 10, fontWeight: 500, color: c.color.chipText }}>{c.pct}%</span>
                {c.cumplio && c.meta > 0 && <span style={{ fontSize: 9, background: '#3B6D11', color: '#fff', padding: '1px 5px', borderRadius: 10 }}>✓</span>}
              </div>
            ))}
          </div>

          {/* Meta equipo */}
          {metaEquipo > 0 && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '0.5px solid var(--color-border-tertiary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>Meta equipo</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  {pctEquipo}%
                  {esSuperior && <span style={{ marginLeft: 6, color: 'var(--color-text-tertiary)' }}>{fmt(totalEquipo)} / {fmt(metaEquipo)}</span>}
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--color-background-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pctEquipo}%`, background: pctEquipo >= 100 ? '#3B6D11' : '#1a3a5c', borderRadius: 4, transition: 'width .6s ease' }} />
              </div>
            </div>
          )}
        </div>

      ) : (
        /* VISTA DETALLE */
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--color-background-secondary)', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                {['Pos.','Vendedor','Meta (sin IVA)','Facturado','Avance','Estado','Comisión est.'].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.4px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corredores.map((c, idx) => {
                const mostrarMontos = esSuperior || esPropio(c)
                const mostrarComision = esSuperior || esPropio(c)
                return (
                  <tr key={c.id} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)', background: esPropio(c) ? 'var(--color-background-info)' : 'transparent' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{idx + 1}°</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: c.color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', overflow: 'hidden', flexShrink: 0 }}>
                          {c.fotoURL ? <img src={c.fotoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : c.nombre?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{c.nombre}</div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{c.rol}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)' }}>{mostrarMontos && c.meta > 0 ? fmt(c.meta) : '—'}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 500 }}>{mostrarMontos ? fmt(c.vendido) : '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 70, height: 6, background: 'var(--color-background-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${c.pct}%`, background: c.color.bg, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 12 }}>{c.pct}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {c.meta === 0
                        ? <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>Sin meta</span>
                        : c.cumplio
                          ? <span style={{ fontSize: 11, background: '#EAF3DE', color: '#3B6D11', padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>✓ Cumplida</span>
                          : <span style={{ fontSize: 11, background: '#FAEEDA', color: '#854F0B', padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>En progreso</span>
                      }
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 500, color: c.cumplio ? '#3B6D11' : '#854F0B' }}>
                      {mostrarComision && c.comision > 0 ? fmt(c.comision) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {esSuperior && metaEquipo > 0 && (
              <tfoot>
                <tr style={{ borderTop: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)' }}>
                  <td colSpan={2} style={{ padding: '9px 14px', fontWeight: 500, fontSize: 12 }}>Total equipo</td>
                  <td style={{ padding: '9px 14px', fontWeight: 500 }}>{fmt(metaEquipo)}</td>
                  <td style={{ padding: '9px 14px', fontWeight: 500 }}>{fmt(totalEquipo)}</td>
                  <td style={{ padding: '9px 14px', fontWeight: 500 }}>{pctEquipo}%</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}