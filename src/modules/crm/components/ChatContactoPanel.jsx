/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: ChatContactoPanel.jsx
 * Módulo:  CRM
 * ============================================================
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, addDoc, getDocs, query, where, serverTimestamp, doc, updateDoc, getDoc, setDoc
} from 'firebase/firestore'
import { db } from '../../../firebase/firestore'
import {
  obtenerLeadsPorWhatsapp, crearLead, actualizarLead,
  obtenerColumnas, obtenerOrigenes
} from '../../../firebase/contactos'

const PRIORIDADES = ['Baja', 'Media', 'Alta']

const stageColor = (nombre) => {
  if (!nombre) return { background: '#F1EFE8', color: '#444441' }
  const n = nombre.toLowerCase()
  if (n.includes('ganado')) return { background: '#EAF3DE', color: '#27500A' }
  if (n.includes('perdido')) return { background: '#FCEBEB', color: '#791F1F' }
  if (n.includes('nuevo')) return { background: '#E6F1FB', color: '#0C447C' }
  return { background: '#FAEEDA', color: '#633806' }
}

const chipColor = (tipo, val) => {
  if (tipo === 'prioridad') {
    if (val === 'Alta') return { background: '#FCEBEB', color: '#791F1F' }
    if (val === 'Media') return { background: '#FAEEDA', color: '#633806' }
    return { background: '#F1EFE8', color: '#444441' }
  }
  return { background: '#F1EFE8', color: '#444441' }
}

// Campos de facturación por defecto
const CAMPOS_FACT_FISICO_DEFAULT = [
  { id: 'nombreFiscal',      label: 'Nombre completo fiscal',        tipo: 'text',   placeholder: 'Ej: Juan Pérez Rodríguez' },
  { id: 'cedulaFisica',      label: 'Número de cédula física',       tipo: 'text',   placeholder: 'Ej: 1-1234-5678' },
  { id: 'codigoActividad',   label: 'Código de actividad económica', tipo: 'text',   placeholder: 'Ej: 46900' },
  { id: 'correoFacturacion', label: 'Correo de facturación',         tipo: 'email',  placeholder: 'facturacion@correo.com' },
  { id: 'direccionFiscal',   label: 'Dirección fiscal',              tipo: 'text',   placeholder: 'Dirección exacta' },
  { id: 'condicionPago',     label: 'Condición de pago',             tipo: 'select', opciones: ['Contado', '8 días', '15 días', '30 días', '45 días', '60 días', '90 días'] },
]

const CAMPOS_FACT_JURIDICO_DEFAULT = [
  { id: 'razonSocial',       label: 'Razón social',                  tipo: 'text',   placeholder: 'Ej: Distribuidora ABC S.A.' },
  { id: 'cedulaJuridica',    label: 'Cédula jurídica',               tipo: 'text',   placeholder: 'Ej: 3-101-123456' },
  { id: 'codigoActividad',   label: 'Código de actividad económica', tipo: 'text',   placeholder: 'Ej: 46900' },
  { id: 'correoFacturacion', label: 'Correo de facturación',         tipo: 'email',  placeholder: 'facturacion@empresa.com' },
  { id: 'direccionFiscal',   label: 'Dirección fiscal',              tipo: 'text',   placeholder: 'Dirección exacta para facturas' },
  { id: 'condicionPago',     label: 'Condición de pago',             tipo: 'select', opciones: ['Contado', '8 días', '15 días', '30 días', '45 días', '60 días', '90 días'] },
]

function parsearOpcionesSelect(placeholder) {
  if (!placeholder) return []
  return placeholder.split(',').map(o => o.trim()).filter(Boolean)
}

function Campo({ label, value, onChange, placeholder, type = 'text', multiline }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 4, fontWeight: 500 }}>{label}</div>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ ...s.input, minHeight: 48, resize: 'none' }} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={s.input} />
      )}
    </div>
  )
}

// ─── Formulario crear contacto ────────────────────────────────────────────────
function FormularioContacto({ telefono, nombreChat, chatId, onGuardado }) {
  const [tab, setTab] = useState('info')
  const [tipo, setTipo] = useState('fisico')
  const [form, setForm] = useState(() => {
    const partes = (nombreChat || '').trim().split(' ')
    const esSoloNumero = /^[0-9]+$/.test((nombreChat || '').trim())
    return {
      nombre: esSoloNumero ? '' : (partes[0] || ''),
      apellido: esSoloNumero ? '' : (partes.slice(1).join(' ') || ''),
      telefono: telefono || '',
      email: '', observacion: '',
      razonSocial: '', cedulaJuridica: '', telefonoEmpresa: telefono || '', cargo: '',
    }
  })
  const [facturacion, setFacturacion] = useState({ tipoFact: 'fisica', campos: {} })
  const [camposFactConfig, setCamposFactConfig] = useState({ fisica: CAMPOS_FACT_FISICO_DEFAULT, juridica: CAMPOS_FACT_JURIDICO_DEFAULT })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const setFact = (k, v) => setFacturacion(f => ({ ...f, [k]: v }))
  const setCampoFact = (id, valor) => setFacturacion(f => ({ ...f, campos: { ...f.campos, [id]: valor } }))

  useEffect(() => {
    getDoc(doc(db, 'configuracion', 'camposFacturacion')).then(snap => {
      if (snap.exists()) {
        const data = snap.data()
        setCamposFactConfig({
          fisica: data.fisica?.length ? data.fisica : CAMPOS_FACT_FISICO_DEFAULT,
          juridica: data.juridica?.length ? data.juridica : CAMPOS_FACT_JURIDICO_DEFAULT,
        })
      }
    }).catch(() => {})
  }, [])

  const handleGuardar = async () => {
    if (tipo === 'fisico' && !form.nombre.trim()) return setError('El nombre es requerido')
    if (tipo === 'juridico' && !form.razonSocial.trim()) return setError('La razón social es requerida')
    setGuardando(true); setError('')
    try {
      if (tipo === 'fisico') {
        const nombreCompleto = [form.nombre.trim(), form.apellido.trim()].filter(Boolean).join(' ')
        await addDoc(collection(db, 'clientes'), {
          tipo: 'fisico', nombre: form.nombre.trim(), apellido: form.apellido.trim(),
          email: form.email.trim(), telefono: form.telefono.trim() || telefono || '',
          whatsapp: telefono || '', observacion: form.observacion.trim(),
          facturacion, creadoEn: serverTimestamp(), origen: 'WhatsApp',
        })
        if (chatId && nombreCompleto)
          await updateDoc(doc(db, 'conversaciones', chatId), { nombre: nombreCompleto })
      } else {
        const empresaRef = await addDoc(collection(db, 'clientes'), {
          tipo: 'juridico', razonSocial: form.razonSocial.trim(),
          cedulaJuridica: form.cedulaJuridica.trim(), telefono: form.telefonoEmpresa.trim(),
          email: form.email.trim(), observacion: form.observacion.trim(),
          facturacion, creadoEn: serverTimestamp(), origen: 'WhatsApp',
          contactoNombre: form.nombre.trim(), contactoCargo: form.cargo.trim(),
          contactoWhatsapp: telefono || '',
        })
        if (form.nombre.trim()) {
          await addDoc(collection(db, 'contactos'), {
            nombre: form.nombre.trim(), cargo: form.cargo.trim(),
            whatsapp: telefono || '', email: form.email.trim(),
            empresaId: empresaRef.id, empresaNombre: form.razonSocial.trim(),
            facturacion, creadoEn: serverTimestamp(),
          })
        }
        if (chatId && form.razonSocial.trim())
          await updateDoc(doc(db, 'conversaciones', chatId), { nombre: form.razonSocial.trim() })
      }
      onGuardado?.()
    } catch (e) {
      console.error(e); setError('Error al guardar. Intentá de nuevo.')
    } finally { setGuardando(false) }
  }

  const camposActivos = camposFactConfig[facturacion.tipoFact] || []

  return (
    <div style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px 0', fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
        Crear contacto
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', padding: '6px 16px 0', gap: 0, borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
        {[{ k: 'info', l: 'Info. contacto' }, { k: 'fact', l: '🧾 Datos fact.' }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 11, fontFamily: 'inherit', fontWeight: tab === t.k ? 600 : 400,
            color: tab === t.k ? '#1a3a5c' : 'var(--color-text-tertiary)',
            borderBottom: `2px solid ${tab === t.k ? '#1a3a5c' : 'transparent'}`,
            marginBottom: -1,
          }}>{t.l}</button>
        ))}
      </div>

      <div style={{ padding: '12px 16px' }}>
        {/* ── TAB INFO ── */}
        {tab === 'info' && (
          <>
            {/* Tipo físico / jurídico */}
            <div style={{ display: 'flex', background: 'var(--color-background-secondary)', borderRadius: 8, padding: 3, marginBottom: 12, gap: 2 }}>
              {[{ val: 'fisico', label: 'Físico' }, { val: 'juridico', label: 'Jurídico' }].map(t => (
                <button key={t.val} onClick={() => setTipo(t.val)} style={{
                  flex: 1, padding: '5px 8px', fontSize: 12, fontWeight: tipo === t.val ? 500 : 400,
                  borderRadius: 6, border: 'none',
                  background: tipo === t.val ? '#1a3a5c' : 'transparent',
                  color: tipo === t.val ? '#fff' : 'var(--color-text-secondary)',
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                }}>{t.label}</button>
              ))}
            </div>

            {tipo === 'fisico' && (<>
              <Campo label="Nombre" value={form.nombre} onChange={v => set('nombre', v)} placeholder="Nombre" />
              <Campo label="Apellido" value={form.apellido} onChange={v => set('apellido', v)} placeholder="Apellido" />
              <Campo label="Teléfono" value={form.telefono} onChange={v => set('telefono', v)} placeholder="506..." />
              <Campo label="Email" value={form.email} onChange={v => set('email', v)} placeholder="correo@ejemplo.com" type="email" />
              <Campo label="Observación" value={form.observacion} onChange={v => set('observacion', v)} placeholder="Notas..." multiline />
            </>)}

            {tipo === 'juridico' && (<>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Empresa</div>
              <Campo label="Razón social" value={form.razonSocial} onChange={v => set('razonSocial', v)} placeholder="Nombre legal" />
              <Campo label="Cédula jurídica" value={form.cedulaJuridica} onChange={v => set('cedulaJuridica', v)} placeholder="3-101-000000" />
              <Campo label="Tel. empresa" value={form.telefonoEmpresa} onChange={v => set('telefonoEmpresa', v)} placeholder="506..." />
              <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)', margin: '10px 0 8px' }} />
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Contacto</div>
              <Campo label="Nombre" value={form.nombre} onChange={v => set('nombre', v)} placeholder="Nombre del contacto" />
              <Campo label="Cargo" value={form.cargo} onChange={v => set('cargo', v)} placeholder="Gerente, Dueño..." />
              <Campo label="Email" value={form.email} onChange={v => set('email', v)} placeholder="correo@ejemplo.com" type="email" />
              <Campo label="Observación" value={form.observacion} onChange={v => set('observacion', v)} placeholder="Notas..." multiline />
            </>)}
          </>
        )}

        {/* ── TAB DATOS FACT. ── */}
        {tab === 'fact' && (
          <>
            {/* Selector físico / jurídico */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>Tipo de facturación</div>
              <div style={{ display: 'flex', background: 'var(--color-background-secondary)', borderRadius: 8, padding: 3, gap: 2 }}>
                {[{ val: 'fisica', label: '👤 Física' }, { val: 'juridica', label: '🏢 Jurídica' }].map(t => (
                  <button key={t.val} onClick={() => setFact('tipoFact', t.val)} style={{
                    flex: 1, padding: '5px 8px', fontSize: 11, fontWeight: facturacion.tipoFact === t.val ? 500 : 400,
                    borderRadius: 6, border: 'none',
                    background: facturacion.tipoFact === t.val ? '#1a3a5c' : 'transparent',
                    color: facturacion.tipoFact === t.val ? '#fff' : 'var(--color-text-secondary)',
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                  }}>{t.label}</button>
                ))}
              </div>
            </div>

            <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)', marginBottom: 10 }} />

            {/* Campos dinámicos */}
            {camposActivos.map(campo => (
              <div key={campo.id} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 4, fontWeight: 500 }}>{campo.label}</div>
                {campo.tipo === 'select' ? (
                  <select
                    value={facturacion.campos?.[campo.id] || ''}
                    onChange={e => setCampoFact(campo.id, e.target.value)}
                    style={{ ...s.input }}>
                    <option value="">— Seleccionar —</option>
                    {(campo.opciones || parsearOpcionesSelect(campo.placeholder)).map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : campo.tipo === 'textarea' ? (
                  <textarea
                    value={facturacion.campos?.[campo.id] || ''}
                    onChange={e => setCampoFact(campo.id, e.target.value)}
                    placeholder={campo.placeholder}
                    style={{ ...s.input, minHeight: 48, resize: 'none' }} />
                ) : (
                  <input
                    type={campo.tipo}
                    value={facturacion.campos?.[campo.id] || ''}
                    onChange={e => setCampoFact(campo.id, e.target.value)}
                    placeholder={campo.placeholder}
                    style={s.input} />
                )}
              </div>
            ))}

            {camposActivos.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '16px 0', fontSize: 12 }}>
                Sin campos configurados.<br />
                <span style={{ fontSize: 11 }}>Configurá en Configuración → Campos fact.</span>
              </div>
            )}
          </>
        )}

        {error && <div style={{ fontSize: 11, color: '#A32D2D', margin: '4px 0 6px' }}>{error}</div>}

        <button onClick={handleGuardar} disabled={guardando} style={{
          width: '100%', padding: '10px', background: '#1a3a5c', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500,
          cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando ? 0.7 : 1,
          fontFamily: 'inherit', marginTop: 8,
        }}>{guardando ? 'Guardando...' : tipo === 'juridico' ? 'Guardar empresa y contacto' : 'Guardar contacto'}</button>
      </div>
    </div>
  )
}

// ─── Formulario editar contacto existente ─────────────────────────────────────
function FormularioEditarContacto({ contacto, chatId, onGuardado, onCancelar }) {
  const [tab, setTab] = useState('info')
  const [form, setForm] = useState({
    nombre: contacto.nombre || '',
    apellido: contacto.apellido || '',
    email: contacto.email || '',
    telefono: contacto.telefono || '',
    observacion: contacto.observacion || '',
  })
  const [facturacion, setFacturacion] = useState(contacto.facturacion || { tipoFact: 'fisica', campos: {} })
  const [camposFactConfig, setCamposFactConfig] = useState({ fisica: CAMPOS_FACT_FISICO_DEFAULT, juridica: CAMPOS_FACT_JURIDICO_DEFAULT })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const setFact = (k, v) => setFacturacion(f => ({ ...f, [k]: v }))
  const setCampoFact = (id, valor) => setFacturacion(f => ({ ...f, campos: { ...f.campos, [id]: valor } }))

  useEffect(() => {
    getDoc(doc(db, 'configuracion', 'camposFacturacion')).then(snap => {
      if (snap.exists()) {
        const data = snap.data()
        setCamposFactConfig({
          fisica: data.fisica?.length ? data.fisica : CAMPOS_FACT_FISICO_DEFAULT,
          juridica: data.juridica?.length ? data.juridica : CAMPOS_FACT_JURIDICO_DEFAULT,
        })
      }
    }).catch(() => {})
  }, [])

  const handleGuardar = async () => {
    if (!form.nombre.trim()) return setError('El nombre es requerido')
    setGuardando(true); setError('')
    try {
      await updateDoc(doc(db, 'clientes', contacto.id), {
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        email: form.email.trim(),
        telefono: form.telefono.trim(),
        observacion: form.observacion.trim(),
        facturacion,
      })
      const nombreCompleto = [form.nombre.trim(), form.apellido.trim()].filter(Boolean).join(' ')
      if (chatId && nombreCompleto)
        await updateDoc(doc(db, 'conversaciones', chatId), { nombre: nombreCompleto })
      onGuardado?.()
    } catch (e) {
      console.error(e); setError('Error al guardar.')
    } finally { setGuardando(false) }
  }

  const camposActivos = camposFactConfig[facturacion.tipoFact] || []

  return (
    <div style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 0' }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Editar contacto</span>
        <button onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--color-text-tertiary)' }}>✕</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', padding: '6px 16px 0', gap: 0, borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
        {[{ k: 'info', l: 'Info. contacto' }, { k: 'fact', l: '🧾 Datos fact.' }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 11, fontFamily: 'inherit', fontWeight: tab === t.k ? 600 : 400,
            color: tab === t.k ? '#1a3a5c' : 'var(--color-text-tertiary)',
            borderBottom: `2px solid ${tab === t.k ? '#1a3a5c' : 'transparent'}`,
            marginBottom: -1,
          }}>{t.l}</button>
        ))}
      </div>

      <div style={{ padding: '12px 16px' }}>
        {/* ── TAB INFO ── */}
        {tab === 'info' && (
          <>
            <Campo label="Nombre" value={form.nombre} onChange={v => set('nombre', v)} placeholder="Nombre" />
            <Campo label="Apellido" value={form.apellido} onChange={v => set('apellido', v)} placeholder="Apellido" />
            <Campo label="Email" value={form.email} onChange={v => set('email', v)} placeholder="correo@ejemplo.com" type="email" />
            <Campo label="Teléfono" value={form.telefono} onChange={v => set('telefono', v)} placeholder="506..." />
            <Campo label="Observación" value={form.observacion} onChange={v => set('observacion', v)} placeholder="Notas..." multiline />
          </>
        )}

        {/* ── TAB DATOS FACT. ── */}
        {tab === 'fact' && (
          <>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>Tipo de facturación</div>
              <div style={{ display: 'flex', background: 'var(--color-background-secondary)', borderRadius: 8, padding: 3, gap: 2 }}>
                {[{ val: 'fisica', label: '👤 Física' }, { val: 'juridica', label: '🏢 Jurídica' }].map(t => (
                  <button key={t.val} onClick={() => setFact('tipoFact', t.val)} style={{
                    flex: 1, padding: '5px 8px', fontSize: 11, fontWeight: facturacion.tipoFact === t.val ? 500 : 400,
                    borderRadius: 6, border: 'none',
                    background: facturacion.tipoFact === t.val ? '#1a3a5c' : 'transparent',
                    color: facturacion.tipoFact === t.val ? '#fff' : 'var(--color-text-secondary)',
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                  }}>{t.label}</button>
                ))}
              </div>
            </div>

            <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)', marginBottom: 10 }} />

            {camposActivos.map(campo => (
              <div key={campo.id} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 4, fontWeight: 500 }}>{campo.label}</div>
                {campo.tipo === 'select' ? (
                  <select
                    value={facturacion.campos?.[campo.id] || ''}
                    onChange={e => setCampoFact(campo.id, e.target.value)}
                    style={{ ...s.input }}>
                    <option value="">— Seleccionar —</option>
                    {(campo.opciones || parsearOpcionesSelect(campo.placeholder)).map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : campo.tipo === 'textarea' ? (
                  <textarea
                    value={facturacion.campos?.[campo.id] || ''}
                    onChange={e => setCampoFact(campo.id, e.target.value)}
                    placeholder={campo.placeholder}
                    style={{ ...s.input, minHeight: 48, resize: 'none' }} />
                ) : (
                  <input
                    type={campo.tipo}
                    value={facturacion.campos?.[campo.id] || ''}
                    onChange={e => setCampoFact(campo.id, e.target.value)}
                    placeholder={campo.placeholder}
                    style={s.input} />
                )}
              </div>
            ))}

            {camposActivos.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '16px 0', fontSize: 12 }}>
                Sin campos configurados.
              </div>
            )}
          </>
        )}

        {error && <div style={{ fontSize: 11, color: '#A32D2D', margin: '4px 0 6px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={onCancelar} style={{ flex: 1, padding: '8px', background: 'none', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--color-text-secondary)' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={guardando} style={{ flex: 2, padding: '8px', background: '#1a3a5c', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando ? 0.7 : 1, fontFamily: 'inherit' }}>
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ChatContactoPanel({ chat, usuariosDisponibles = [], puedeAsignar }) {
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [columnas, setColumnas] = useState([])
  const [origenes, setOrigenes] = useState([])
  const [filtro, setFiltro] = useState('todos')
  const [expandido, setExpandido] = useState(null)
  const [editando, setEditando] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [creandoLead, setCreandoLead] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [contactoGuardado, setContactoGuardado] = useState(false)
  const [tieneContacto, setTieneContacto] = useState(false)
  const [contactoData, setContactoData] = useState(null)
  const [verificandoContacto, setVerificandoContacto] = useState(false)
  const [editandoContacto, setEditandoContacto] = useState(false)

  useEffect(() => {
    if (!chat?.telefono) return
    setVerificandoContacto(true)
    const buscar = async () => {
      const tel = chat.telefono?.replace(/[^0-9]/g, '') || ''
      try {
        const q = query(collection(db, 'clientes'), where('whatsapp', '==', tel))
        const snap = await getDocs(q)
        if (!snap.empty) {
          setTieneContacto(true)
          setContactoData({ id: snap.docs[0].id, ...snap.docs[0].data() })
        } else {
          setTieneContacto(false)
          setContactoData(null)
        }
      } catch {
        setTieneContacto(false)
        setContactoData(null)
      }
      setVerificandoContacto(false)
    }
    buscar()
  }, [chat?.telefono, contactoGuardado])

  useEffect(() => {
    if (!chat?.telefono) return
    obtenerColumnas().then(setColumnas)
    obtenerOrigenes().then(setOrigenes)
    cargarLeads()
  }, [chat?.telefono])

  const cargarLeads = async () => {
    if (!chat?.telefono) return
    const data = await obtenerLeadsPorWhatsapp(chat.telefono)
    setLeads(data)
    if (data.length > 0 && !expandido) setExpandido(data[0].id)
  }

  const leadsFiltrados = leads.filter(l => {
    if (filtro === 'todos') return true
    if (filtro === 'abiertos') return l.estado !== 'ganado' && l.estado !== 'perdido'
    return l.estado === filtro
  })

  const toggleExpand = (id) => setExpandido(prev => prev === id ? null : id)
  const iniciarEdicion = (leadId, campo, valorActual) => setEditando(prev => ({ ...prev, [`${leadId}_${campo}`]: valorActual ?? '' }))
  const cancelarEdicion = (leadId, campo) => setEditando(prev => { const n = { ...prev }; delete n[`${leadId}_${campo}`]; return n })

  const guardarCampo = async (leadId, campo) => {
    const key = `${leadId}_${campo}`
    const valor = editando[key]
    setGuardando(true)
    await actualizarLead(leadId, { [campo]: valor })
    await cargarLeads()
    cancelarEdicion(leadId, campo)
    setGuardando(false)
  }

  const marcarEstado = async (leadId, estado) => {
    await actualizarLead(leadId, { estado })
    await cargarLeads()
  }

  const handleCrearLead = async () => {
    if (!nuevoNombre.trim()) return
    if (columnas.length === 0) return alert('Creá al menos una etapa en el pipeline primero')
    await crearLead({
      nombre: nuevoNombre.trim(), whatsapp: chat.telefono,
      columnaId: columnas[0].id, origen: 'WhatsApp', prioridad: 'Media', estado: 'abierto',
    })
    setNuevoNombre(''); setCreandoLead(false)
    await cargarLeads()
  }

  const nombreContacto = chat?.nombre || chat?.telefono || '—'
  const inicialesContacto = nombreContacto.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)

  if (!chat) return (
    <div style={s.empty}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--color-text-tertiary)' }}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginTop: 8 }}>Seleccioná un chat</p>
    </div>
  )

  return (
    <div style={s.panel}>
      {/* ── BLOQUE CONTACTO ── */}
      <div style={s.contactBlock}>
        <div style={s.avatar}>{inicialesContacto}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.contactName}>{nombreContacto}</div>
          {chat.empresa && <div style={s.contactSub}>{chat.empresa}{chat.sede ? ` · ${chat.sede}` : ''}</div>}
          <div style={s.contactPhone}>{chat.telefono}</div>
        </div>
        {tieneContacto && !editandoContacto && (
          <button onClick={() => setEditandoContacto(true)} title="Editar contacto"
            style={{ background: 'none', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 2l3 3-8 8H3v-3L11 2z" /></svg>
            Editar
          </button>
        )}
      </div>

      {/* ── FORMULARIO EDITAR CONTACTO ── */}
      {editandoContacto && contactoData && (
        <FormularioEditarContacto
          contacto={contactoData}
          chatId={chat.id}
          onGuardado={() => { setEditandoContacto(false); setContactoGuardado(true); setTimeout(() => setContactoGuardado(false), 3000) }}
          onCancelar={() => setEditandoContacto(false)}
        />
      )}

      {/* ── FORMULARIO CREAR CONTACTO ── */}
      {!verificandoContacto && !tieneContacto && !contactoGuardado && !editandoContacto && (
        <FormularioContacto
          telefono={chat.telefono}
          nombreChat={chat.nombre}
          chatId={chat.id}
          onGuardado={() => { setContactoGuardado(true); setTieneContacto(true) }}
        />
      )}

      {contactoGuardado && (
        <div style={{ padding: '8px 12px', background: '#EAF3DE', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#3B6D11" strokeWidth="2"><path d="M13 4L6 11l-3-3" /></svg>
          <span style={{ fontSize: 12, color: '#3B6D11', fontWeight: 500 }}>✓ Contacto guardado</span>
        </div>
      )}

      {/* ── SEPARADOR LEADS ── */}
      <div style={{ padding: '10px 16px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.6px' }}>Leads</span>
      </div>

      {/* ── FILTROS LEADS ── */}
      <div style={s.filterRow}>
        {['todos', 'abiertos', 'ganados', 'perdidos'].map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{ ...s.filterPill, ...(filtro === f ? s.filterPillOn : {}) }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* ── LISTA DE LEADS ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {leadsFiltrados.length === 0 && (
          <div style={{ padding: '14px 12px', textAlign: 'center', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            Sin leads {filtro !== 'todos' ? `(${filtro})` : ''}
          </div>
        )}

        {leadsFiltrados.map(lead => {
          const abierto = expandido === lead.id
          const colNombre = columnas.find(c => c.id === lead.columnaId)?.nombre || lead.columnaId || '—'
          const sc = stageColor(lead.estado === 'ganado' ? 'ganado' : lead.estado === 'perdido' ? 'perdido' : colNombre)
          return (
            <div key={lead.id} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
              <div style={{ ...s.leadRow, background: abierto ? 'var(--color-background-secondary)' : 'transparent' }}
                onClick={() => toggleExpand(lead.id)}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
                  style={{ color: 'var(--color-text-tertiary)', flexShrink: 0, transition: 'transform .2s', transform: abierto ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  <path d="M4 6l4 4 4-4" />
                </svg>
                <span style={s.leadName}>{lead.nombre}</span>
                <span style={{ ...s.chip, ...sc, fontSize: 10, padding: '2px 7px' }}>
                  {lead.estado === 'ganado' ? 'Ganado' : lead.estado === 'perdido' ? 'Perdido' : colNombre}
                </span>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
                  style={{ color: 'var(--color-text-tertiary)', flexShrink: 0, cursor: 'pointer' }}
                  onClick={e => { e.stopPropagation(); navigate(`/crm/lead/${lead.id}`) }} title="Abrir ficha completa">
                  <path d="M6 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-3M9 1h6v6M15 1L8 8" />
                </svg>
              </div>
              {abierto && (
                <div style={s.leadDetail}>
                  <CampoEditable label="Etapa" valor={colNombre} editKey={`${lead.id}_columnaId`} editando={editando}
                    onEdit={() => iniciarEdicion(lead.id, 'columnaId', lead.columnaId)}
                    onCancel={() => cancelarEdicion(lead.id, 'columnaId')}
                    onSave={() => guardarCampo(lead.id, 'columnaId')}
                    onChange={v => setEditando(p => ({ ...p, [`${lead.id}_columnaId`]: v }))}
                    tipo="select" opciones={columnas.map(c => ({ value: c.id, label: c.nombre }))} chipStyle={sc} />
                  <CampoEditable label="Origen" valor={lead.origen || '—'} editKey={`${lead.id}_origen`} editando={editando}
                    onEdit={() => iniciarEdicion(lead.id, 'origen', lead.origen)}
                    onCancel={() => cancelarEdicion(lead.id, 'origen')}
                    onSave={() => guardarCampo(lead.id, 'origen')}
                    onChange={v => setEditando(p => ({ ...p, [`${lead.id}_origen`]: v }))}
                    tipo="select" opciones={origenes.map(o => ({ value: o.nombre, label: o.nombre }))} chipStyle={chipColor('origen')} />
                  <CampoEditable label="Vendedor" valor={lead.vendedor || '—'} editKey={`${lead.id}_vendedor`} editando={editando}
                    onEdit={() => iniciarEdicion(lead.id, 'vendedor', lead.vendedor)}
                    onCancel={() => cancelarEdicion(lead.id, 'vendedor')}
                    onSave={() => guardarCampo(lead.id, 'vendedor')}
                    onChange={v => setEditando(p => ({ ...p, [`${lead.id}_vendedor`]: v }))}
                    tipo="select" opciones={usuariosDisponibles.map(u => ({ value: u.nombre, label: u.nombre }))}
                    chipStyle={chipColor('origen')} textoLibre />
                  <CampoEditable label="Prioridad" valor={lead.prioridad || 'Media'} editKey={`${lead.id}_prioridad`} editando={editando}
                    onEdit={() => iniciarEdicion(lead.id, 'prioridad', lead.prioridad || 'Media')}
                    onCancel={() => cancelarEdicion(lead.id, 'prioridad')}
                    onSave={() => guardarCampo(lead.id, 'prioridad')}
                    onChange={v => setEditando(p => ({ ...p, [`${lead.id}_prioridad`]: v }))}
                    tipo="select" opciones={PRIORIDADES.map(p => ({ value: p, label: p }))} chipStyle={chipColor('prioridad', lead.prioridad)} />
                  <CampoEditable label="Tags" valor={(lead.tags || []).join(', ') || '—'} editKey={`${lead.id}_tags`} editando={editando}
                    onEdit={() => iniciarEdicion(lead.id, 'tags', (lead.tags || []).join(', '))}
                    onCancel={() => cancelarEdicion(lead.id, 'tags')}
                    onSave={async () => {
                      const key = `${lead.id}_tags`
                      const arr = (editando[key] || '').split(',').map(t => t.trim()).filter(Boolean)
                      setGuardando(true)
                      await actualizarLead(lead.id, { tags: arr })
                      await cargarLeads()
                      cancelarEdicion(lead.id, 'tags')
                      setGuardando(false)
                    }}
                    onChange={v => setEditando(p => ({ ...p, [`${lead.id}_tags`]: v }))}
                    tipo="texto" chipStyle={{ background: '#EEEDFE', color: '#3C3489' }}
                    esTags tagsArr={lead.tags || []} />
                  {lead.estado !== 'ganado' && lead.estado !== 'perdido' && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      <button style={{ ...s.actionBtn, ...s.actionSuccess }} onClick={() => marcarEstado(lead.id, 'ganado')}>Ganado</button>
                      <button style={{ ...s.actionBtn, ...s.actionDanger }} onClick={() => marcarEstado(lead.id, 'perdido')}>Perdido</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        <div style={{ padding: '10px 12px' }}>
          {creandoLead ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input autoFocus value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCrearLead(); if (e.key === 'Escape') setCreandoLead(false) }}
                placeholder="Nombre del lead..." style={s.inputInline} />
              <button onClick={handleCrearLead} style={s.btnGuardar}>✓</button>
              <button onClick={() => setCreandoLead(false)} style={s.btnCancelar}>✕</button>
            </div>
          ) : (
            <button onClick={() => setCreandoLead(true)} style={s.btnNuevoLead}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3v10M3 8h10" /></svg>
              Nuevo lead
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── CampoEditable ────────────────────────────────────────────────────────────
function CampoEditable({ label, valor, editKey, editando, onEdit, onCancel, onSave, onChange, tipo, opciones = [], chipStyle, textoLibre, esTags, tagsArr }) {
  const enEdicion = editKey in editando
  return (
    <div style={s.inlineField}>
      <span style={s.fieldLabel}>{label}</span>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, flexWrap: 'wrap' }}>
        {enEdicion ? (
          <>
            {tipo === 'select' ? (
              <select autoFocus value={editando[editKey]} onChange={e => onChange(e.target.value)} style={s.selectInline}>
                {opciones.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                {textoLibre && <option value={editando[editKey]}>{editando[editKey]}</option>}
              </select>
            ) : (
              <input autoFocus value={editando[editKey]} onChange={e => onChange(e.target.value)}
                style={s.inputInline} placeholder={esTags ? 'tag1, tag2, ...' : ''} />
            )}
            <button onClick={onSave} style={s.miniBtn}>✓</button>
            <button onClick={onCancel} style={{ ...s.miniBtn, color: 'var(--color-text-tertiary)' }}>✕</button>
          </>
        ) : (
          <>
            {esTags ? (
              tagsArr.length > 0
                ? tagsArr.map((t, i) => <span key={i} style={{ ...s.chip, ...chipStyle }}>{t}</span>)
                : <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>—</span>
            ) : (
              <span style={{ ...s.chip, ...chipStyle }}>{valor}</span>
            )}
            <svg onClick={onEdit} width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
              style={{ color: 'var(--color-text-tertiary)', cursor: 'pointer', flexShrink: 0 }}>
              <path d="M11 2l3 3-8 8H3v-3L11 2z" />
            </svg>
          </>
        )}
      </div>
    </div>
  )
}

const s = {
  panel: { display: 'flex', flexDirection: 'column', height: '100%', background: '#ffffff', borderLeft: '0.5px solid var(--color-border-tertiary)', overflow: 'hidden' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24 },
  contactBlock: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px', borderBottom: '0.5px solid var(--color-border-tertiary)', flexShrink: 0 },
  avatar: { width: 38, height: 38, borderRadius: '50%', background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, color: '#0C447C', flexShrink: 0 },
  contactName: { fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' },
  contactSub: { fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 1 },
  contactPhone: { fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 1 },
  input: { width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: 'var(--color-text-primary)', background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  filterRow: { display: 'flex', gap: 4, padding: '8px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', overflowX: 'auto', flexShrink: 0 },
  filterPill: { padding: '3px 8px', borderRadius: 20, border: '0.5px solid var(--color-border-tertiary)', background: 'none', fontSize: 11, color: 'var(--color-text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)' },
  filterPillOn: { background: '#E6F1FB', borderColor: '#85B7EB', color: '#0C447C', fontWeight: 500 },
  leadRow: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', cursor: 'pointer', transition: 'background .12s' },
  leadName: { flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  leadDetail: { padding: '8px 12px 12px', background: 'var(--color-background-secondary)' },
  inlineField: { display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '0.5px solid var(--color-border-tertiary)' },
  fieldLabel: { fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.5px', width: 52, flexShrink: 0 },
  chip: { display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500 },
  selectInline: { fontSize: 12, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, padding: '2px 6px', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', maxWidth: 110 },
  inputInline: { flex: 1, fontSize: 12, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, padding: '3px 7px', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', minWidth: 0 },
  miniBtn: { fontSize: 11, padding: '2px 6px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', background: 'none', cursor: 'pointer', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' },
  actionBtn: { flex: 1, padding: '6px 8px', borderRadius: 8, border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-primary)', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' },
  actionSuccess: { color: '#3B6D11', borderColor: '#C0DD97' },
  actionDanger: { color: '#A32D2D', borderColor: '#F7C1C1' },
  btnNuevoLead: { width: '100%', padding: '7px', borderRadius: 8, border: '0.5px dashed var(--color-border-secondary)', background: 'none', fontSize: 12, color: 'var(--color-text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnGuardar: { padding: '3px 8px', borderRadius: 6, border: '0.5px solid #C0DD97', background: '#EAF3DE', color: '#3B6D11', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)' },
  btnCancelar: { padding: '3px 8px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', background: 'none', color: 'var(--color-text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)' },
}