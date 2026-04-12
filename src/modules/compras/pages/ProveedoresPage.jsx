/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: ProveedoresPage.jsx
 * Módulo:  Compras
 * ============================================================
 */

import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, query, orderBy,
  addDoc, updateDoc, doc, serverTimestamp, getDoc
} from 'firebase/firestore'
import { db } from '../../../firebase/config'
import { useNavigate } from 'react-router-dom'

const genId = () => Math.random().toString(36).slice(2, 10)

// ── Modal proveedor ───────────────────────────────────────────────────────────
function ModalProveedor({ proveedor, onGuardar, onCerrar }) {
  const [form, setForm] = useState({
    nombreComercial: proveedor?.nombreComercial || '',
    razonSocial:     proveedor?.razonSocial     || '',
    cedula:          proveedor?.cedula          || '',
    contacto:        proveedor?.contacto        || '',
    telefono:        proveedor?.telefono        || '',
    telContacto:     proveedor?.telContacto     || '',
    email:           proveedor?.email           || '',
    direccion:       proveedor?.direccion       || '',
    notas:           proveedor?.notas           || '',
    activo:          proveedor?.activo          ?? true,
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState('')

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleGuardar = async () => {
    if (!form.nombreComercial.trim()) { setError('El nombre comercial es obligatorio.'); return }
    setError('')
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
      <div style={{ background: '#fff', borderRadius: 14, width: '95%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,.2)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{proveedor ? 'Editar proveedor' : 'Nuevo proveedor'}</div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa' }}>×</button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={s.lbl}>Nombre comercial *</label>
              <input style={s.inp} placeholder="Ej: Distribuidora ABC" value={form.nombreComercial} onChange={e => upd('nombreComercial', e.target.value)} autoFocus />
            </div>
            <div>
              <label style={s.lbl}>Razón social</label>
              <input style={s.inp} placeholder="Ej: ABC S.A." value={form.razonSocial} onChange={e => upd('razonSocial', e.target.value)} />
            </div>
            <div>
              <label style={s.lbl}>Cédula / RUC</label>
              <input style={s.inp} placeholder="Ej: 3-101-123456" value={form.cedula} onChange={e => upd('cedula', e.target.value)} />
            </div>
            <div>
              <label style={s.lbl}>Contacto principal</label>
              <input style={s.inp} placeholder="Nombre del representante" value={form.contacto} onChange={e => upd('contacto', e.target.value)} />
            </div>
            <div>
              <label style={s.lbl}>Teléfono empresa</label>
              <input style={s.inp} placeholder="+506 2222-3333" value={form.telefono} onChange={e => upd('telefono', e.target.value)} />
            </div>
            <div>
              <label style={s.lbl}>Tel. contacto</label>
              <input style={s.inp} placeholder="+506 8888-9999" value={form.telContacto} onChange={e => upd('telContacto', e.target.value)} />
            </div>
            <div>
              <label style={s.lbl}>Email</label>
              <input style={s.inp} type="email" placeholder="ventas@proveedor.com" value={form.email} onChange={e => upd('email', e.target.value)} />
            </div>
            <div>
              <label style={s.lbl}>Dirección</label>
              <input style={s.inp} placeholder="Dirección física" value={form.direccion} onChange={e => upd('direccion', e.target.value)} />
            </div>
          </div>
          <div>
            <label style={s.lbl}>Notas internas</label>
            <textarea style={{ ...s.inp, resize: 'vertical' }} rows={3} placeholder="Condiciones, tiempos de entrega, etc." value={form.notas} onChange={e => upd('notas', e.target.value)} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={form.activo} onChange={e => upd('activo', e.target.checked)} style={{ width: 15, height: 15, accentColor: 'var(--eco-primary, #1a3a5c)' }} />
            Proveedor activo
          </label>
          {error && <div style={{ padding: '8px 12px', background: '#FCEBEB', borderRadius: 7, fontSize: 12, color: '#A32D2D' }}>{error}</div>}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(0,0,0,.08)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onCerrar} style={{ padding: '8px 16px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: '#f5f5f5', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={guardando} style={{ padding: '8px 22px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: guardando ? 'not-allowed' : 'pointer', background: guardando ? '#e0e0e0' : 'var(--eco-primary, #1a3a5c)', color: guardando ? '#aaa' : '#fff', fontFamily: 'inherit' }}>
            {guardando ? 'Guardando...' : proveedor ? 'Guardar cambios' : 'Crear proveedor'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Panel de productos del proveedor ──────────────────────────────────────────
function PanelProductos({ proveedor, onCerrar }) {
  const [productos, setProductos] = useState(proveedor.productos || [])
  const [guardando, setGuardando] = useState(false)
  const [editIdx,   setEditIdx]   = useState(null)
  const [form,      setForm]      = useState({ nombre: '', precioCompra: '' })

  const guardar = async (nuevos) => {
    setGuardando(true)
    await updateDoc(doc(db, 'proveedores', proveedor.id), { productos: nuevos })
    setProductos(nuevos)
    setGuardando(false)
  }

  const agregar = async () => {
    if (!form.nombre.trim()) return
    const nuevo = { id: genId(), nombre: form.nombre.trim(), precioCompra: Number(form.precioCompra) || 0, agregadoEn: new Date().toISOString() }
    await guardar([...productos, nuevo])
    setForm({ nombre: '', precioCompra: '' })
  }

  const editar = async (idx) => {
    const nuevos = productos.map((p, i) => i === idx ? { ...p, nombre: form.nombre.trim(), precioCompra: Number(form.precioCompra) || 0 } : p)
    await guardar(nuevos)
    setEditIdx(null)
    setForm({ nombre: '', precioCompra: '' })
  }

  const eliminar = async (idx) => {
    await guardar(productos.filter((_, i) => i !== idx))
  }

  const s = {
    inp: { padding: '7px 10px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff', color: 'inherit', fontFamily: 'inherit' },
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: '#fff', borderRadius: 14, width: '95%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,.2)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Productos de {proveedor.nombreComercial || proveedor.razonSocial}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{productos.length} producto{productos.length !== 1 ? 's' : ''} registrado{productos.length !== 1 ? 's' : ''}</div>
          </div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {/* Agregar nuevo */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, padding: 14, background: '#f8f9fb', borderRadius: 10, border: '0.5px solid rgba(0,0,0,.06)' }}>
            <input style={{ ...s.inp, flex: 2 }} placeholder="Nombre del producto" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} onKeyDown={e => e.key === 'Enter' && agregar()} />
            <input style={{ ...s.inp, width: 130 }} type="number" placeholder="Precio compra ₡" value={form.precioCompra} onChange={e => setForm(f => ({ ...f, precioCompra: e.target.value }))} />
            <button onClick={editIdx !== null ? () => editar(editIdx) : agregar} disabled={guardando || !form.nombre.trim()} style={{ padding: '7px 16px', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: guardando || !form.nombre.trim() ? 'not-allowed' : 'pointer', background: !form.nombre.trim() ? '#e0e0e0' : 'var(--eco-primary, #1a3a5c)', color: !form.nombre.trim() ? '#aaa' : '#fff', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {editIdx !== null ? '✓ Editar' : '+ Agregar'}
            </button>
            {editIdx !== null && (
              <button onClick={() => { setEditIdx(null); setForm({ nombre: '', precioCompra: '' }) }} style={{ padding: '7px 12px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 12, cursor: 'pointer', background: '#f5f5f5', fontFamily: 'inherit' }}>×</button>
            )}
          </div>

          {/* Lista */}
          {productos.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: '#ccc', fontSize: 12, background: '#fafafa', borderRadius: 8, border: '0.5px dashed rgba(0,0,0,.1)' }}>
              Sin productos registrados. Agregá el primero arriba.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {productos.map((p, i) => (
                <div key={p.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: editIdx === i ? '#EAF3DE' : '#fafafa', borderRadius: 8, border: `0.5px solid ${editIdx === i ? '#8BC34A' : 'rgba(0,0,0,.06)'}` }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 500, margin: 0, fontSize: 13 }}>{p.nombre}</p>
                    <p style={{ fontSize: 11, color: '#888', margin: '1px 0 0' }}>
                      Precio compra: {p.precioCompra > 0 ? `₡${Number(p.precioCompra).toLocaleString('es-CR')}` : '—'}
                    </p>
                  </div>
                  <button onClick={() => { setEditIdx(i); setForm({ nombre: p.nombre, precioCompra: p.precioCompra || '' }) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 14, padding: '2px 6px' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#185FA5'}
                    onMouseLeave={e => e.currentTarget.style.color = '#aaa'}
                    title="Editar">✎</button>
                  <button onClick={() => eliminar(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 16, padding: '2px 4px', borderRadius: 4 }}
                    onMouseEnter={e => e.currentTarget.style.color = '#E24B4A'}
                    onMouseLeave={e => e.currentTarget.style.color = '#ddd'}
                    title="Eliminar">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(0,0,0,.08)', flexShrink: 0, textAlign: 'right' }}>
          <button onClick={onCerrar} style={{ padding: '8px 20px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: 'var(--eco-primary, #1a3a5c)', color: '#fff', fontFamily: 'inherit' }}>Listo</button>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ProveedoresPage() {
  const navigate = useNavigate()

  const [proveedores,     setProveedores]     = useState([])
  const [loading,         setLoading]         = useState(true)
  const [busqueda,        setBusqueda]        = useState('')
  const [soloActivos,     setSoloActivos]     = useState(true)
  const [modalProv,       setModalProv]       = useState(false)
  const [editandoProv,    setEditandoProv]    = useState(null)
  const [panelProductos,  setPanelProductos]  = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'proveedores'), orderBy('nombreComercial'))
    const unsub = onSnapshot(q, snap => {
      setProveedores(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])

  const guardarProveedor = async (form) => {
    if (editandoProv) {
      await updateDoc(doc(db, 'proveedores', editandoProv.id), { ...form, actualizadoEn: serverTimestamp() })
    } else {
      await addDoc(collection(db, 'proveedores'), { ...form, productos: [], creadoEn: serverTimestamp() })
    }
    setModalProv(false)
    setEditandoProv(null)
  }

  const filtrados = proveedores.filter(p => {
    if (soloActivos && p.activo === false) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      if (!p.nombreComercial?.toLowerCase().includes(q) &&
          !p.razonSocial?.toLowerCase().includes(q) &&
          !p.contacto?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const s = {
    page:  { padding: '24px 28px', minHeight: '100vh', background: 'var(--eco-bg, #f5f6f8)' },
    card:  { background: '#fff', border: '0.5px solid rgba(0,0,0,.08)', borderRadius: 10, overflow: 'hidden' },
    inp:   { padding: '7px 12px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff', color: 'inherit', fontFamily: 'inherit' },
    th:    { padding: '9px 16px', textAlign: 'left', fontWeight: 500, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '0.5px solid rgba(0,0,0,.06)', background: '#fafafa' },
    td:    { padding: '12px 16px', borderBottom: '0.5px solid rgba(0,0,0,.05)', verticalAlign: 'middle', fontSize: 13 },
    btnP:  { padding: '8px 18px', background: 'var(--eco-primary, #1a3a5c)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
    btnSm: { padding: '4px 12px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: '#fff', fontFamily: 'inherit' },
  }

  return (
    <div style={s.page}>

      {modalProv && (
        <ModalProveedor proveedor={editandoProv} onGuardar={guardarProveedor} onCerrar={() => { setModalProv(false); setEditandoProv(null) }} />
      )}

      {panelProductos && (
        <PanelProductos proveedor={panelProductos} onCerrar={() => setPanelProductos(null)} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={{ ...s.btnSm, padding: '5px 10px' }} onClick={() => navigate('/compras')}>← Compras</button>
          <p style={{ fontSize: 20, fontWeight: 500, color: 'var(--eco-primary, #1a3a5c)', margin: 0 }}>Proveedores</p>
        </div>
        <button style={s.btnP} onClick={() => { setEditandoProv(null); setModalProv(true) }}>+ Nuevo proveedor</button>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        <input style={{ ...s.inp, width: 260 }} placeholder="Buscar proveedor..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={soloActivos} onChange={e => setSoloActivos(e.target.checked)} style={{ accentColor: 'var(--eco-primary, #1a3a5c)', width: 14, height: 14 }} />
          Solo activos
        </label>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#aaa' }}>{filtrados.length} proveedor{filtrados.length !== 1 ? 'es' : ''}</span>
      </div>

      {/* Tabla */}
      <div style={s.card}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>Cargando...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>
            {proveedores.length === 0 ? 'No hay proveedores. Creá el primero.' : 'Sin resultados.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={s.th}>Proveedor</th>
                <th style={s.th}>Contacto</th>
                <th style={s.th}>Teléfono</th>
                <th style={s.th}>Email</th>
                <th style={{ ...s.th, textAlign: 'center' }}>Productos</th>
                <th style={s.th}>Estado</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(p => (
                <tr key={p.id}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={s.td}>
                    <p style={{ fontWeight: 600, margin: 0 }}>{p.nombreComercial}</p>
                    {p.razonSocial && p.razonSocial !== p.nombreComercial && (
                      <p style={{ fontSize: 11, color: '#888', margin: '1px 0 0' }}>{p.razonSocial}</p>
                    )}
                    {p.cedula && <p style={{ fontSize: 10, color: '#bbb', margin: 0 }}>{p.cedula}</p>}
                  </td>
                  <td style={{ ...s.td, color: '#666' }}>{p.contacto || '—'}</td>
                  <td style={{ ...s.td, color: '#666' }}>{p.telefono || p.telContacto || '—'}</td>
                  <td style={{ ...s.td, color: '#666', fontSize: 12 }}>{p.email || '—'}</td>
                  <td style={{ ...s.td, textAlign: 'center' }}>
                    <button onClick={() => setPanelProductos(p)} style={{ padding: '3px 10px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: '#f8f9fb', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      📦 {(p.productos || []).length}
                    </button>
                  </td>
                  <td style={s.td}>
                    <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: p.activo !== false ? '#EAF3DE' : '#F1EFE8', color: p.activo !== false ? '#3B6D11' : '#5F5E5A' }}>
                      {p.activo !== false ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={s.td} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={s.btnSm} onClick={() => { setEditandoProv(p); setModalProv(true) }}>Editar</button>
                      <button style={{ ...s.btnSm, color: '#185FA5', borderColor: '#185FA5' }} onClick={() => navigate(`/compras?proveedor=${p.id}`)}>Ver órdenes</button>
                    </div>
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