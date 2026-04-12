/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: ActivoForm.jsx
 * Módulo:  Activos
 * ============================================================
 */

import { useState, useEffect } from 'react'
import { crearActivo } from '../../../firebase/contactos'
import { obtenerSedes } from '../../../firebase/contactos'

const TIPOS_EQUIPO = ['Mini Split', 'Cassette', 'Piso techo', 'Ventana', 'Chiller', 'Fan Coil', 'Manejadora', 'Condensadora', 'VRF', 'Otro']
const ESTADOS_EQUIPO = ['Operativo', 'En mantenimiento', 'Fuera de servicio', 'En garantía']

export default function ActivoForm({ empresas = [], sedes = [], onClose, onGuardado, activoInicial }) {
  const [form, setForm] = useState({
    tipo: '', marca: '', modelo: '', capacidadBTU: '', nroSerie: '',
    ubicacion: '', fechaInstalacion: '', garantiaHasta: '',
    estado: 'Operativo', observaciones: '',
    empresaId: '', sedeId: '',
    ...activoInicial,
  })
  const [sedesEmpresa, setSedesEmpresa] = useState([])
  const [cargandoSedes, setCargandoSedes] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (form.empresaId) cargarSedes(form.empresaId)
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const cargarSedes = async (empresaId) => {
    setCargandoSedes(true)
    const data = await obtenerSedes(empresaId)
    setSedesEmpresa(data)
    setCargandoSedes(false)
  }

  const handleEmpresaChange = (e) => {
    const id = e.target.value
    set('empresaId', id)
    set('sedeId', '')
    if (id) cargarSedes(id)
    else setSedesEmpresa([])
  }

  const empresaSeleccionada = empresas.find(e => e.id === form.empresaId)
  const sedeSeleccionada = sedesEmpresa.find(s => s.id === form.sedeId)

  const guardar = async () => {
    if (!form.tipo) return alert('El tipo de equipo es requerido')
    if (!form.empresaId) return alert('Seleccioná una empresa')
    setGuardando(true)
    await crearActivo({
      ...form,
      propietarioTipo: form.sedeId ? 'sede' : 'empresa',
      propietarioId: form.sedeId || form.empresaId,
      propietarioNombre: sedeSeleccionada
        ? `${empresaSeleccionada?.nombre} - ${sedeSeleccionada.nombre}`
        : empresaSeleccionada?.nombre || '',
    })
    setGuardando(false)
    onGuardado()
  }

  const s = est

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.header}>
          <h2 style={s.titulo}>Nuevo activo</h2>
          <button style={s.btnX} onClick={onClose}>✕</button>
        </div>

        <div style={s.cuerpo}>

          {/* Empresa y sede */}
          <div style={s.seccion}>Ubicación del equipo</div>
          <div style={s.campo}>
            <label style={s.label}>Empresa *</label>
            <select style={s.input} value={form.empresaId} onChange={handleEmpresaChange}>
              <option value="">— Seleccionar empresa —</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>

          {form.empresaId && (
            <div style={s.campo}>
              <label style={s.label}>
                Sede
                {cargandoSedes && <span style={{ fontWeight: 400, color: '#999', marginLeft: 6 }}>Cargando...</span>}
              </label>
              {sedesEmpresa.length > 0 ? (
                <select style={s.input} value={form.sedeId} onChange={e => set('sedeId', e.target.value)}>
                  <option value="">— Sin sede específica —</option>
                  {sedesEmpresa.map(s => <option key={s.id} value={s.id}>{s.nombre}{s.provincia ? ` (${s.provincia})` : ''}</option>)}
                </select>
              ) : !cargandoSedes ? (
                <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0' }}>Esta empresa no tiene sedes. El equipo se asignará directo a la empresa.</p>
              ) : null}
            </div>
          )}

          {/* Datos del equipo */}
          <div style={{ ...s.seccion, marginTop: 16 }}>Datos del equipo</div>

          <div style={s.campo}>
            <label style={s.label}>Tipo de equipo *</label>
            <select style={s.input} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
              <option value="">— Seleccionar —</option>
              {TIPOS_EQUIPO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div style={s.fila}>
            <div style={s.campo}>
              <label style={s.label}>Marca</label>
              <input style={s.input} value={form.marca} onChange={e => set('marca', e.target.value)} placeholder="Ej: Carrier, Daikin" />
            </div>
            <div style={s.campo}>
              <label style={s.label}>Modelo</label>
              <input style={s.input} value={form.modelo} onChange={e => set('modelo', e.target.value)} placeholder="Ej: 40MBFQ12" />
            </div>
          </div>

          <div style={s.fila}>
            <div style={s.campo}>
              <label style={s.label}>Capacidad (BTU)</label>
              <input style={s.input} value={form.capacidadBTU} onChange={e => set('capacidadBTU', e.target.value)} placeholder="Ej: 12000" />
            </div>
            <div style={s.campo}>
              <label style={s.label}>Nro. de serie</label>
              <input style={s.input} value={form.nroSerie} onChange={e => set('nroSerie', e.target.value)} />
            </div>
          </div>

          <div style={s.campo}>
            <label style={s.label}>Ubicación en sede</label>
            <input style={s.input} value={form.ubicacion} onChange={e => set('ubicacion', e.target.value)} placeholder="Ej: Sala de servidores, Oficina 3" />
          </div>

          <div style={s.fila}>
            <div style={s.campo}>
              <label style={s.label}>Fecha instalación</label>
              <input style={s.input} type="date" value={form.fechaInstalacion} onChange={e => set('fechaInstalacion', e.target.value)} />
            </div>
            <div style={s.campo}>
              <label style={s.label}>Garantía hasta</label>
              <input style={s.input} type="date" value={form.garantiaHasta} onChange={e => set('garantiaHasta', e.target.value)} />
            </div>
          </div>

          <div style={s.campo}>
            <label style={s.label}>Estado</label>
            <select style={s.input} value={form.estado} onChange={e => set('estado', e.target.value)}>
              {ESTADOS_EQUIPO.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          <div style={s.campo}>
            <label style={s.label}>Observaciones</label>
            <textarea style={{ ...s.input, minHeight: 70, resize: 'vertical' }} value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
          </div>

        </div>

        <div style={s.pie}>
          <button style={s.btnCancelar} onClick={onClose}>Cancelar</button>
          <button style={s.btnGuardar} onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando...' : 'Crear activo'}
          </button>
        </div>
      </div>
    </div>
  )
}

const est = {
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' },
  modal:      { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '0.5px solid #eee' },
  titulo:     { margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1a1a1a' },
  btnX:       { background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#666' },
  cuerpo:     { overflowY: 'auto', padding: '1.5rem', flex: 1 },
  pie:        { padding: '1rem 1.5rem', borderTop: '0.5px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' },
  seccion:    { fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 },
  campo:      { marginBottom: '1rem', flex: 1 },
  fila:       { display: 'flex', gap: '1rem' },
  label:      { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#444', marginBottom: '0.35rem' },
  input:      { width: '100%', padding: '0.6rem 0.85rem', border: '1.5px solid #dde3ed', borderRadius: 8, fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  btnCancelar:{ padding: '0.6rem 1.25rem', border: '1.5px solid #dde3ed', borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#444', fontFamily: 'inherit' },
  btnGuardar: { padding: '0.6rem 1.5rem', border: 'none', borderRadius: 8, background: '#1a3a5c', color: '#fff', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' },
}