/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: FichaActivoPage.jsx
 * Módulo:  Activos
 * ============================================================
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../../firebase/config'
import { obtenerServicios, crearServicio, eliminarServicio, obtenerEmpresas, obtenerSedes } from '../../../firebase/contactos'

const TIPOS_SERVICIO = ['Instalación', 'Mantenimiento preventivo', 'Mantenimiento correctivo', 'Reparación', 'Diagnóstico', 'Garantía']

const estadoColor = {
  'Operativo':         { bg: '#EAF3DE', color: '#27500A' },
  'En mantenimiento':  { bg: '#FAEEDA', color: '#633806' },
  'Fuera de servicio': { bg: '#FCEBEB', color: '#791F1F' },
  'En garantía':       { bg: '#E6F1FB', color: '#0C447C' },
}

export default function FichaActivoPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [activo, setActivo] = useState(null)
  const [empresa, setEmpresa] = useState(null)
  const [sede, setSede] = useState(null)
  const [servicios, setServicios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalServicio, setModalServicio] = useState(false)
  const [form, setForm] = useState({ fecha: '', tipo: '', tecnico: '', descripcion: '' })
  const [guardando, setGuardando] = useState(false)

  const cargar = async () => {
    setCargando(true)
    const snap = await getDoc(doc(db, 'activos', id))
    if (!snap.exists()) { navigate('/activos'); return }
    const data = { id: snap.id, ...snap.data() }
    setActivo(data)

    const [svcs, emps] = await Promise.all([
      obtenerServicios(id),
      obtenerEmpresas(),
    ])
    setServicios(svcs)

    if (data.empresaId) {
      const emp = emps.find(e => e.id === data.empresaId)
      setEmpresa(emp || null)
      if (data.sedeId && emp) {
        const sedes = await obtenerSedes(emp.id)
        setSede(sedes.find(s => s.id === data.sedeId) || null)
      }
    }
    setCargando(false)
  }

  useEffect(() => { cargar() }, [id])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const guardarServicio = async () => {
    if (!form.fecha || !form.tipo) return alert('Fecha y tipo son requeridos')
    setGuardando(true)
    await crearServicio(id, form)
    // Actualizar fecha último servicio en el activo
    await import('firebase/firestore').then(({ updateDoc, doc: fdoc }) =>
      updateDoc(fdoc(db, 'activos', id), { ultimoServicio: form.fecha })
    )
    setForm({ fecha: '', tipo: '', tecnico: '', descripcion: '' })
    setModalServicio(false)
    setGuardando(false)
    cargar()
  }

  if (cargando) return <div style={{ padding: 40, color: 'var(--color-text-tertiary)' }}>Cargando...</div>
  if (!activo) return null

  const ec = estadoColor[activo.estado] || { bg: '#F1EFE8', color: '#444441' }
  const garantiaVencida = activo.garantiaHasta && new Date(activo.garantiaHasta) < new Date()

  const s = est

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto' }}>

      {/* Volver */}
      <button onClick={() => navigate('/activos')} style={s.btnVolver}>← Volver a activos</button>

      {/* Header */}
      <div style={s.headerCard}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flex: 1 }}>
          <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>❄️</div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
              {activo.tipo}{activo.marca ? ` · ${activo.marca}` : ''}{activo.modelo ? ` ${activo.modelo}` : ''}
            </h1>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <span style={{ ...s.badge, background: ec.bg, color: ec.color }}>{activo.estado}</span>
              {activo.capacidadBTU && <span style={s.tag}>{activo.capacidadBTU} BTU</span>}
              {activo.nroSerie && <span style={s.tag}>S/N: {activo.nroSerie}</span>}
              {garantiaVencida && <span style={{ ...s.badge, background: '#FCEBEB', color: '#A32D2D' }}>⚠ Garantía vencida</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Grid de info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

        <div style={s.infoCard}>
          <div style={s.cardTitulo}>Ubicación</div>
          <InfoFila label="Empresa" valor={empresa?.nombre} />
          <InfoFila label="Sede" valor={sede?.nombre} />
          <InfoFila label="Provincia" valor={sede?.provincia} />
          <InfoFila label="Ubicación" valor={activo.ubicacion} />
        </div>

        <div style={s.infoCard}>
          <div style={s.cardTitulo}>Datos técnicos</div>
          <InfoFila label="Tipo" valor={activo.tipo} />
          <InfoFila label="Marca" valor={activo.marca} />
          <InfoFila label="Modelo" valor={activo.modelo} />
          <InfoFila label="Capacidad" valor={activo.capacidadBTU ? `${activo.capacidadBTU} BTU` : null} />
        </div>

        <div style={s.infoCard}>
          <div style={s.cardTitulo}>Fechas</div>
          <InfoFila label="Instalación" valor={activo.fechaInstalacion} />
          <InfoFila
            label="Garantía hasta"
            valor={activo.garantiaHasta}
            valorStyle={garantiaVencida ? { color: '#A32D2D', fontWeight: 600 } : {}}
          />
          <InfoFila label="Último servicio" valor={activo.ultimoServicio} />
        </div>

        {activo.observaciones && (
          <div style={s.infoCard}>
            <div style={s.cardTitulo}>Observaciones</div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              {activo.observaciones}
            </p>
          </div>
        )}
      </div>

      {/* Historial de servicios */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
          Historial de servicios ({servicios.length})
        </h2>
        <button style={s.btnPrimario} onClick={() => setModalServicio(true)}>+ Registrar servicio</button>
      </div>

      {servicios.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-tertiary)', background: 'var(--color-background-secondary)', borderRadius: 12, border: '0.5px solid var(--color-border-tertiary)' }}>
          <p style={{ fontSize: '1.5rem', margin: 0 }}>🔧</p>
          <p style={{ marginTop: 8, fontSize: 13 }}>Sin servicios registrados</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {servicios.map(sv => (
            <div key={sv.id} style={s.servicioCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={s.servicioBadge}>{sv.tipo}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{sv.fecha}</span>
                  <button onClick={() => eliminarServicio(id, sv.id).then(cargar)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', fontSize: 12 }}>✕</button>
                </div>
              </div>
              {sv.tecnico && <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4 }}>🔧 {sv.tecnico}</div>}
              {sv.descripcion && <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.6 }}>{sv.descripcion}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Modal servicio */}
      {modalServicio && (
        <div style={s.overlay}>
          <div style={s.modalSmall}>
            <div style={s.modalHeader}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Registrar servicio</h3>
              <button style={s.btnX} onClick={() => setModalServicio(false)}>✕</button>
            </div>
            <div style={{ padding: '1.25rem' }}>
              {[
                { label: 'Fecha *', key: 'fecha', tipo: 'date' },
                { label: 'Tipo de servicio *', key: 'tipo', tipo: 'select', opciones: TIPOS_SERVICIO },
                { label: 'Técnico responsable', key: 'tecnico', placeholder: 'Nombre del técnico' },
                { label: 'Descripción', key: 'descripcion', tipo: 'textarea' },
              ].map(({ label, key, tipo, placeholder, opciones }) => (
                <div key={key} style={{ marginBottom: '0.85rem' }}>
                  <label style={s.label}>{label}</label>
                  {tipo === 'select' ? (
                    <select style={s.input} value={form[key]} onChange={e => set(key, e.target.value)}>
                      <option value="">— Seleccionar —</option>
                      {opciones.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : tipo === 'textarea' ? (
                    <textarea style={{ ...s.input, minHeight: 80, resize: 'vertical' }} value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder} />
                  ) : (
                    <input style={s.input} type={tipo || 'text'} value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder} />
                  )}
                </div>
              ))}
            </div>
            <div style={{ padding: '1rem 1.25rem', borderTop: '0.5px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button style={s.btnCancelar} onClick={() => setModalServicio(false)}>Cancelar</button>
              <button style={s.btnGuardar} onClick={guardarServicio} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoFila({ label, valor, valorStyle = {} }) {
  if (!valor) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 500, ...valorStyle }}>{valor}</span>
    </div>
  )
}

const est = {
  btnVolver:    { background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 16, fontFamily: 'inherit' },
  headerCard:   { background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' },
  badge:        { fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 },
  tag:          { fontSize: 12, padding: '2px 10px', borderRadius: 20, background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', border: '0.5px solid var(--color-border-tertiary)' },
  infoCard:     { background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: '1rem 1.25rem' },
  cardTitulo:   { fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 },
  servicioCard: { background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: '1rem 1.25rem' },
  servicioBadge:{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#E6F1FB', color: '#0C447C' },
  btnPrimario:  { background: '#1a3a5c', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' },
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' },
  modalSmall:   { background: '#fff', borderRadius: 12, width: '100%', maxWidth: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' },
  modalHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '0.5px solid #eee' },
  btnX:         { background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#666' },
  label:        { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#444', marginBottom: '0.35rem' },
  input:        { width: '100%', padding: '0.6rem 0.85rem', border: '1.5px solid #dde3ed', borderRadius: 8, fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  btnCancelar:  { padding: '0.6rem 1.25rem', border: '1.5px solid #dde3ed', borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#444', fontFamily: 'inherit' },
  btnGuardar:   { padding: '0.6rem 1.5rem', border: 'none', borderRadius: 8, background: '#1a3a5c', color: '#fff', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' },
}