/**
 * ============================================================
 * ECO-CRM — Sistema de Gestión Empresarial
 * Archivo: MiEmpresa.jsx
 * Módulo:  Configuracion
 * ============================================================
 */

import { useState, useRef, useEffect } from 'react'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../../firebase/firestore'
import { useEmpresa } from '../../../context/EmpresaContext'

const MONEDAS = [
  { value: "AED", label: "AED — Dírham de los Emiratos Árabes Unidos" },
  { value: "ARS", label: "ARS — Peso argentino" },
  { value: "AUD", label: "AUD — Dólar australiano" },
  { value: "BRL", label: "BRL — Real brasileño" },
  { value: "CAD", label: "CAD — Dólar canadiense" },
  { value: "CHF", label: "CHF — Franco suizo" },
  { value: "CLP", label: "CLP — Peso chileno" },
  { value: "CNY", label: "CNY — Yuan chino" },
  { value: "COP", label: "COP — Peso colombiano" },
  { value: "CRC", label: "CRC — Colón costarricense ₡" },
  { value: "DKK", label: "DKK — Corona danesa" },
  { value: "DOP", label: "DOP — Peso dominicano" },
  { value: "EUR", label: "EUR — Euro €" },
  { value: "GBP", label: "GBP — Libra esterlina £" },
  { value: "GTQ", label: "GTQ — Quetzal guatemalteco" },
  { value: "HNL", label: "HNL — Lempira hondureño" },
  { value: "HUF", label: "HUF — Forinto húngaro" },
  { value: "INR", label: "INR — Rupia india ₹" },
  { value: "JPY", label: "JPY — Yen japonés ¥" },
  { value: "KRW", label: "KRW — Won surcoreano ₩" },
  { value: "MXN", label: "MXN — Peso mexicano" },
  { value: "NIO", label: "NIO — Córdoba nicaragüense" },
  { value: "NOK", label: "NOK — Corona noruega" },
  { value: "NZD", label: "NZD — Dólar neozelandés" },
  { value: "PAB", label: "PAB — Balboa panameño" },
  { value: "PEN", label: "PEN — Sol peruano" },
  { value: "PHP", label: "PHP — Peso filipino" },
  { value: "PLN", label: "PLN — Esloti polaco" },
  { value: "PYG", label: "PYG — Guaraní paraguayo" },
  { value: "SEK", label: "SEK — Corona sueca" },
  { value: "SGD", label: "SGD — Dólar de Singapur" },
  { value: "TRY", label: "TRY — Lira turca" },
  { value: "USD", label: "USD — Dólar estadounidense $" },
  { value: "UYU", label: "UYU — Peso uruguayo" },
  { value: "VES", label: "VES — Bolívar venezolano" },
  { value: "ZAR", label: "ZAR — Rand sudafricano" },
]

// ── Campos de facturación por defecto ─────────────────────────────────────────
const CAMPOS_FACT_FISICO_DEFAULT = [
  { id: 'nombreFiscal',      label: 'Nombre completo fiscal',         tipo: 'text',   placeholder: 'Ej: Juan Pérez Rodríguez' },
  { id: 'cedulaFisica',      label: 'Número de cédula física',        tipo: 'text',   placeholder: 'Ej: 1-1234-5678' },
  { id: 'codigoActividad',   label: 'Código de actividad económica',  tipo: 'text',   placeholder: 'Ej: 46900' },
  { id: 'correoFacturacion', label: 'Correo de facturación',          tipo: 'email',  placeholder: 'facturacion@correo.com' },
  { id: 'direccionFiscal',   label: 'Dirección fiscal',               tipo: 'text',   placeholder: 'Dirección exacta' },
  { id: 'condicionPago',     label: 'Condición de pago',              tipo: 'select', placeholder: 'Contado,8 días,15 días,30 días,45 días,60 días,90 días' },
]

const CAMPOS_FACT_JURIDICO_DEFAULT = [
  { id: 'razonSocial',       label: 'Razón social',                   tipo: 'text',   placeholder: 'Ej: Distribuidora ABC S.A.' },
  { id: 'cedulaJuridica',    label: 'Cédula jurídica',                tipo: 'text',   placeholder: 'Ej: 3-101-123456' },
  { id: 'codigoActividad',   label: 'Código de actividad económica',  tipo: 'text',   placeholder: 'Ej: 46900' },
  { id: 'correoFacturacion', label: 'Correo de facturación',          tipo: 'email',  placeholder: 'facturacion@empresa.com' },
  { id: 'direccionFiscal',   label: 'Dirección fiscal',               tipo: 'text',   placeholder: 'Dirección exacta para facturas' },
  { id: 'condicionPago',     label: 'Condición de pago',              tipo: 'select', placeholder: 'Contado,8 días,15 días,30 días,45 días,60 días,90 días' },
]

const TIPOS_CAMPO_FACT = ['text', 'email', 'tel', 'number', 'select', 'textarea']
const TIPOS_CAMPO_FACT_LABELS = { text: 'Texto', email: 'Email', tel: 'Teléfono', number: 'Número', select: 'Opciones', textarea: 'Área de texto' }

// ── Componentes base ──────────────────────────────────────────────────────────
function SectionCard({ icon, title, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #d0d8d0', marginBottom: 14, borderRadius: 'var(--eco-radius, 0px)' }}>
      <div style={{ padding: '11px 16px', borderBottom: '1px solid #d0d8d0', display: 'flex', alignItems: 'center', gap: 8, background: '#f9fbf9' }}>
        {icon}
        <span style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a' }}>{title}</span>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 10, fontWeight: 500, color: '#5c6b5c', textTransform: 'uppercase', letterSpacing: '.5px' }}>
        {label}{required && <span style={{ color: '#cc3333', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

const inputStyle = {
  border: '1.5px solid #d0d8d0', borderRadius: 'var(--eco-radius, 3px)',
  padding: '8px 10px', fontSize: 12, color: '#1a1a1a',
  background: '#fff', width: '100%', outline: 'none', fontFamily: 'inherit',
}

function Input({ ...props }) {
  const [focused, setFocused] = useState(false)
  return (
    <input {...props}
      style={{ ...inputStyle, borderColor: focused ? 'var(--eco-primary)' : '#d0d8d0', background: focused ? '#f7fbf8' : '#fff' }}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
  )
}

function TextArea({ ...props }) {
  const [focused, setFocused] = useState(false)
  return (
    <textarea {...props}
      style={{ ...inputStyle, resize: 'vertical', borderColor: focused ? 'var(--eco-primary)' : '#d0d8d0', background: focused ? '#f7fbf8' : '#fff' }}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
  )
}

function Grid({ children, cols = 2 }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10 }}>{children}</div>
}

const LOGO_FIELD_MAP = {
  'Logo principal':  'logoPrincipal',
  'Logo secundario': 'logoSecundario',
  'Isotipo':         'isotipo',
  'Favicon':         'favicon',
}

function LogoSlot({ label, hint, value, onChange }) {
  const fileRef = useRef()
  const [preview, setPreview] = useState(value || null)
  const [uploading, setUploading] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)

  useEffect(() => { if (value && value !== preview) setPreview(value) }, [value])

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    setUploading(true)
    try {
      const storageRef = ref(storage, `empresa/logos/${label.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      onChange(url)
      setPreview(url)
      const campo = LOGO_FIELD_MAP[label] || label.replace(/\s+/g, '_').toLowerCase()
      await setDoc(doc(db, 'configuracion', 'empresa'), { [campo]: url }, { merge: true })
      setGuardadoOk(true)
      setTimeout(() => setGuardadoOk(false), 3000)
    } catch (err) { console.error('Error subiendo logo:', err) }
    finally { setUploading(false) }
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 500, color: '#1a1a1a', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 10, color: '#8a9e8a', marginBottom: 7, lineHeight: 1.4 }}>{hint}</div>
      <div onClick={() => fileRef.current.click()} style={{ border: '1.5px dashed #d0d8d0', borderRadius: 'var(--eco-radius, 3px)', height: 72, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, background: '#f7f9f7', cursor: 'pointer', marginBottom: 7, overflow: 'hidden' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--eco-primary)'; e.currentTarget.style.background = 'var(--eco-primary-light)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#d0d8d0'; e.currentTarget.style.background = '#f7f9f7' }}>
        {preview
          ? <img src={preview} alt={label} style={{ maxHeight: 56, maxWidth: '90%', objectFit: 'contain' }} />
          : <><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="#8a9e8a" strokeWidth="1.5"/></svg><span style={{ fontSize: 10, color: '#8a9e8a' }}>{uploading ? 'Subiendo...' : 'Cargar imagen'}</span></>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => fileRef.current.click()} style={{ border: '1px solid var(--eco-primary)', color: 'var(--eco-primary)', background: 'transparent', borderRadius: 'var(--eco-radius, 3px)', padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}>
          {uploading ? 'Subiendo...' : preview ? 'Cambiar imagen' : 'Seleccionar archivo'}
        </button>
        {guardadoOk && <span style={{ fontSize: 11, color: 'var(--eco-primary)' }}>✓ Guardado</span>}
      </div>
    </div>
  )
}

const TIPOS_CAMPO = ['Texto', 'Número', 'Fecha', 'URL', 'Teléfono', 'Email']

function CamposAdicionales({ campos, onChange }) {
  const agregar = () => onChange([...campos, { id: Date.now(), etiqueta: '', tipo: 'Texto', valor: '' }])
  const eliminar = (id) => onChange(campos.filter(c => c.id !== id))
  const editar = (id, key, val) => onChange(campos.map(c => c.id === id ? { ...c, [key]: val } : c))

  return (
    <div>
      <div style={{ fontSize: 11, color: '#5c6b5c', marginBottom: 10 }}>Agrega campos personalizados que aparecerán en la ficha de empresa y documentos.</div>
      {campos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 28px', gap: 6, fontSize: 10, color: '#8a9e8a', paddingBottom: 5, borderBottom: '1px solid #d0d8d0', marginBottom: 6 }}>
          <span>Etiqueta del campo</span><span>Tipo</span><span />
        </div>
      )}
      {campos.map(c => (
        <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 28px', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <input value={c.etiqueta} onChange={e => editar(c.id, 'etiqueta', e.target.value)} placeholder="Nombre del campo" style={{ ...inputStyle }} />
          <select value={c.tipo} onChange={e => editar(c.id, 'tipo', e.target.value)} style={{ border: '1.5px solid #d0d8d0', borderRadius: 'var(--eco-radius, 3px)', padding: '6px 4px', fontSize: 11, color: '#1a1a1a', background: '#fff' }}>
            {TIPOS_CAMPO.map(t => <option key={t}>{t}</option>)}
          </select>
          <button onClick={() => eliminar(c.id)} style={{ width: 28, height: 28, border: '1px solid #d0d8d0', background: 'transparent', borderRadius: 'var(--eco-radius, 3px)', cursor: 'pointer', fontSize: 14, color: '#5c6b5c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
      ))}
      <button onClick={agregar} style={{ border: '1.5px dashed var(--eco-primary)', color: 'var(--eco-primary)', background: 'transparent', borderRadius: 'var(--eco-radius, 3px)', padding: '6px 14px', fontSize: 11, cursor: 'pointer', marginTop: 6 }}>+ Agregar campo</button>
    </div>
  )
}

// ── Campos de Facturación configurables ───────────────────────────────────────
function CamposFacturacion({ campos, onChange, tipo }) {
  const agregar = () => onChange([...campos, { id: `fact_${Date.now()}`, label: '', tipo: 'text', placeholder: '' }])
  const eliminar = (id) => onChange(campos.filter(c => c.id !== id))
  const editar = (id, key, val) => onChange(campos.map(c => c.id === id ? { ...c, [key]: val } : c))
  const mover = (idx, dir) => {
    const arr = [...campos]
    const swap = idx + dir
    if (swap < 0 || swap >= arr.length) return
    ;[arr[idx], arr[swap]] = [arr[swap], arr[idx]]
    onChange(arr)
  }

  return (
    <div>
      <div style={{ fontSize: 11, color: '#5c6b5c', marginBottom: 10 }}>
        Define qué campos aparecen en la sección <strong>Datos fact. {tipo === 'fisica' ? '(Física)' : '(Jurídica)'}</strong> de contactos y empresas.
        {tipo === 'select' && <span> Para campos tipo "Opciones", separa las opciones con comas en el placeholder.</span>}
      </div>

      {campos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 1fr 52px', gap: 6, fontSize: 10, color: '#8a9e8a', paddingBottom: 5, borderBottom: '1px solid #d0d8d0', marginBottom: 6 }}>
          <span>Etiqueta visible</span><span>Tipo</span><span>Placeholder / Opciones</span><span />
        </div>
      )}

      {campos.map((c, idx) => (
        <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 1fr 52px', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <input value={c.label} onChange={e => editar(c.id, 'label', e.target.value)}
            placeholder="Ej: Cédula jurídica" style={{ ...inputStyle }} />
          <select value={c.tipo} onChange={e => editar(c.id, 'tipo', e.target.value)}
            style={{ border: '1.5px solid #d0d8d0', borderRadius: 'var(--eco-radius, 3px)', padding: '6px 4px', fontSize: 11, color: '#1a1a1a', background: '#fff' }}>
            {TIPOS_CAMPO_FACT.map(t => <option key={t} value={t}>{TIPOS_CAMPO_FACT_LABELS[t]}</option>)}
          </select>
          <input value={c.placeholder} onChange={e => editar(c.id, 'placeholder', e.target.value)}
            placeholder={c.tipo === 'select' ? 'Opción 1,Opción 2,Opción 3' : 'Texto de ejemplo'}
            style={{ ...inputStyle }} />
          <div style={{ display: 'flex', gap: 3 }}>
            <button onClick={() => mover(idx, -1)} disabled={idx === 0}
              style={{ width: 22, height: 28, border: '1px solid #d0d8d0', background: 'transparent', borderRadius: 'var(--eco-radius, 3px)', cursor: idx === 0 ? 'default' : 'pointer', fontSize: 11, color: idx === 0 ? '#ccc' : '#5c6b5c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↑</button>
            <button onClick={() => mover(idx, 1)} disabled={idx === campos.length - 1}
              style={{ width: 22, height: 28, border: '1px solid #d0d8d0', background: 'transparent', borderRadius: 'var(--eco-radius, 3px)', cursor: idx === campos.length - 1 ? 'default' : 'pointer', fontSize: 11, color: idx === campos.length - 1 ? '#ccc' : '#5c6b5c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↓</button>
            <button onClick={() => eliminar(c.id)}
              style={{ width: 22, height: 28, border: '1px solid #fca5a5', background: 'transparent', borderRadius: 'var(--eco-radius, 3px)', cursor: 'pointer', fontSize: 13, color: '#c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>
      ))}

      <button onClick={agregar} style={{ border: '1.5px dashed var(--eco-primary)', color: 'var(--eco-primary)', background: 'transparent', borderRadius: 'var(--eco-radius, 3px)', padding: '6px 14px', fontSize: 11, cursor: 'pointer', marginTop: 6 }}>
        + Agregar campo
      </button>
    </div>
  )
}

// ── Apariencia ────────────────────────────────────────────────────────────────
function AparienciaPanel() {
  const [primaryColor, setPrimaryColor] = useState('#1a3a5c')
  const [radius, setRadius] = useState('0')
  const [guardado, setGuardado] = useState(false)

  const COLORES = ['#1a3a5c','#0F6E56','#534AB7','#854F0B','#A32D2D','#185FA5','#2e7d32','#5F5E5A','#993C1D']

  const aplicarColor = (col) => {
    setPrimaryColor(col)
    document.documentElement.style.setProperty('--eco-primary', col)
    document.documentElement.style.setProperty('--eco-primary-light', col + '22')
  }

  const aplicarRadius = (r) => {
    setRadius(r)
    document.documentElement.style.setProperty('--eco-radius', r + 'px')
  }

  const guardar = async () => {
    await setDoc(doc(db, 'configuracion', 'estetica'), { primaryColor, radius }, { merge: true })
    setGuardado(true)
    setTimeout(() => setGuardado(false), 3000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 500, color: '#5c6b5c', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>Color principal</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {COLORES.map(col => (
            <div key={col} onClick={() => aplicarColor(col)} style={{
              width: 38, height: 38, borderRadius: '50%', background: col, cursor: 'pointer',
              border: primaryColor === col ? '3px solid #1a1a1a' : '3px solid transparent',
              transition: 'border .15s',
            }} title={col} />
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 4 }}>
            <input type="color" value={primaryColor} onChange={e => aplicarColor(e.target.value)}
              style={{ width: 38, height: 38, border: '1px solid #d0d8d0', borderRadius: '50%', cursor: 'pointer', padding: 2 }} />
            <span style={{ fontSize: 12, color: '#888', fontFamily: 'monospace' }}>{primaryColor}</span>
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 500, color: '#5c6b5c', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>Radio de bordes</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ val: '0', label: 'Recto' }, { val: '6', label: 'Suave' }, { val: '12', label: 'Redondeado' }].map(op => (
            <button key={op.val} onClick={() => aplicarRadius(op.val)} style={{
              padding: '8px 20px', borderRadius: parseInt(op.val) + 'px', fontSize: 12,
              border: radius === op.val ? '2px solid #1a1a1a' : '1px solid #d0d8d0',
              background: radius === op.val ? '#1a1a1a' : '#fff',
              color: radius === op.val ? '#fff' : '#1a1a1a',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
            }}>{op.label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8, borderTop: '1px solid #d0d8d0' }}>
        <button onClick={guardar} style={{
          background: 'var(--eco-primary)', color: '#fff', border: 'none',
          padding: '8px 24px', borderRadius: 'var(--eco-radius, 3px)',
          fontSize: 12, fontWeight: 500, cursor: 'pointer',
        }}>Guardar apariencia</button>
        {guardado && <span style={{ fontSize: 12, color: 'var(--eco-primary)' }}>✓ Guardado</span>}
      </div>
    </div>
  )
}

// ── Nav secciones ─────────────────────────────────────────────────────────────
const NAV_SECCIONES = [
  { id: 'basicos',    label: 'Datos básicos' },
  { id: 'logos',      label: 'Logos e imágenes' },
  { id: 'documentos', label: 'Datos documentos' },
  { id: 'campos',     label: 'Campos adicionales' },
  { id: 'camposfact', label: 'Campos fact.' },
  { id: 'apariencia', label: 'Apariencia' },
]

export default function MiEmpresa() {
  const { empresa } = useEmpresa()
  const [activo, setActivo] = useState('basicos')
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)

  const [form, setForm] = useState({
    razonSocial: '', nombreComercial: '', cedulaJuridica: '', actividadEconomica: '',
    telefono: '', email: '', sitioWeb: '', pais: '', direccion: '', slogan: '',
    moneda: '', monedaSecundaria: '', regimen: '',
    logoPrincipal: '', logoSecundario: '', isotipo: '', favicon: '',
    numeroPyme: '', ccss: '', representanteLegal: '', cedulaRepresentante: '',
    licenciaCFIA: '', cuentaIBAN: '', piePagina: '', camposExtra: [],
  })

  // Campos de facturación configurables
  const [camposFactFisica, setCamposFactFisica] = useState(CAMPOS_FACT_FISICO_DEFAULT)
  const [camposFactJuridica, setCamposFactJuridica] = useState(CAMPOS_FACT_JURIDICO_DEFAULT)
  const [guardandoFact, setGuardandoFact] = useState(false)
  const [guardadoFact, setGuardadoFact] = useState(false)
  const [tabFact, setTabFact] = useState('fisica')

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  useEffect(() => {
    if (empresa) setForm({ ...empresa, camposExtra: empresa.camposExtra || [] })
    // Cargar campos de facturación desde Firestore
    getDoc(doc(db, 'configuracion', 'camposFacturacion')).then(snap => {
      if (snap.exists()) {
        const data = snap.data()
        if (data.fisica?.length) setCamposFactFisica(data.fisica)
        if (data.juridica?.length) setCamposFactJuridica(data.juridica)
      }
    }).catch(() => {})
  }, [empresa])

  const guardar = async () => {
    setGuardando(true)
    try {
      await setDoc(doc(db, 'configuracion', 'empresa'), form, { merge: true })
      setGuardado(true)
      setTimeout(() => setGuardado(false), 3000)
    } catch (err) { console.error('Error guardando empresa:', err) }
    finally { setGuardando(false) }
  }

  const guardarCamposFact = async () => {
    setGuardandoFact(true)
    try {
      await setDoc(doc(db, 'configuracion', 'camposFacturacion'), {
        fisica: camposFactFisica,
        juridica: camposFactJuridica,
      }, { merge: true })
      setGuardadoFact(true)
      setTimeout(() => setGuardadoFact(false), 3000)
    } catch (err) { console.error('Error guardando campos fact.:', err) }
    finally { setGuardandoFact(false) }
  }

  const SaveBar = () => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 14, borderTop: '1px solid #d0d8d0', marginTop: 4 }}>
      {guardado && <span style={{ fontSize: 12, color: 'var(--eco-primary)', alignSelf: 'center' }}>✓ Cambios guardados</span>}
      <button style={{ border: '1px solid #d0d8d0', background: 'transparent', color: '#5c6b5c', padding: '7px 16px', fontSize: 12, borderRadius: 'var(--eco-radius, 3px)', cursor: 'pointer' }} onClick={() => setForm({ ...empresa })}>Cancelar</button>
      <button style={{ background: 'var(--eco-primary)', color: '#fff', border: 'none', padding: '7px 20px', fontSize: 12, borderRadius: 'var(--eco-radius, 3px)', cursor: 'pointer', fontWeight: 500, opacity: guardando ? .7 : 1 }} onClick={guardar} disabled={guardando}>
        {guardando ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', height: '100%', minHeight: 600 }}>
      <nav style={{ background: '#fff', borderRight: '1px solid #d0d8d0', padding: '10px 0' }}>
        <div style={{ fontSize: 9, color: '#8a9e8a', textTransform: 'uppercase', letterSpacing: '.7px', padding: '8px 14px 3px' }}>Empresa</div>
        {NAV_SECCIONES.map(s => (
          <button key={s.id} onClick={() => setActivo(s.id)} style={{
            width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 12,
            color: activo === s.id ? 'var(--eco-primary)' : '#5c6b5c',
            background: activo === s.id ? 'var(--eco-primary-light)' : 'transparent',
            border: 'none', borderLeft: `3px solid ${activo === s.id ? 'var(--eco-primary)' : 'transparent'}`,
            cursor: 'pointer', fontWeight: activo === s.id ? 500 : 400,
          }}>
            {s.label}
          </button>
        ))}
      </nav>

      <div style={{ padding: 20, overflowY: 'auto', background: '#f4f6f4' }}>
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, color: '#1a1a1a', margin: 0 }}>Datos de la empresa</h2>
          <p style={{ fontSize: 12, color: '#5c6b5c', marginTop: 3 }}>Información básica, logos y datos legales</p>
        </div>

        {!empresa?.razonSocial && (
          <div style={{ background: '#fffbe6', border: '1px solid #e8d87a', borderRadius: 'var(--eco-radius, 3px)', padding: '10px 14px', fontSize: 12, color: '#7a6a00', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            ⚠️ No hay datos guardados aún. Llenás los campos y presionás <strong style={{ marginLeft: 4 }}>Guardar cambios</strong>.
          </div>
        )}

        {activo === 'basicos' && (
          <SectionCard icon="🏢" title="Datos básicos">
            <Grid>
              <Field label="Razón Social" required><Input value={form.razonSocial} onChange={e => set('razonSocial', e.target.value)} placeholder="Ej: Eco Ingeniería S.A." /></Field>
              <Field label="Nombre Comercial"><Input value={form.nombreComercial} onChange={e => set('nombreComercial', e.target.value)} placeholder="Ej: Eco Ingeniería" /></Field>
              <Field label="Cédula Jurídica"><Input value={form.cedulaJuridica} onChange={e => set('cedulaJuridica', e.target.value)} placeholder="3-101-XXXXXX" /></Field>
              <Field label="Actividad Económica"><Input value={form.actividadEconomica} onChange={e => set('actividadEconomica', e.target.value)} placeholder="Ej: Ingeniería y construcción" /></Field>
              <Field label="Teléfono"><Input value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+506 2222-3333" /></Field>
              <Field label="Correo Electrónico"><Input value={form.email} onChange={e => set('email', e.target.value)} placeholder="info@empresa.com" /></Field>
              <Field label="Sitio Web"><Input value={form.sitioWeb} onChange={e => set('sitioWeb', e.target.value)} placeholder="www.ecoingenieria.com" /></Field>
              <Field label="País"><Input value={form.pais} onChange={e => set('pais', e.target.value)} /></Field>
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Dirección"><Input value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Provincia, Cantón, Dirección exacta" /></Field>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Slogan / Descripción corta"><Input value={form.slogan} onChange={e => set('slogan', e.target.value)} placeholder="Ej: Soluciones de refrigeración con respaldo técnico" /></Field>
              </div>
              <Field label="Moneda principal *">
                <select value={form.moneda} onChange={e => set('moneda', e.target.value)} style={{ ...inputStyle }}>
                  {MONEDAS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </Field>
              <Field label="Moneda secundaria">
                <select value={form.monedaSecundaria} onChange={e => set('monedaSecundaria', e.target.value)} style={{ ...inputStyle }}>
                  <option value="">— Sin moneda secundaria —</option>
                  {MONEDAS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </Field>
              <Field label="Régimen Tributario">
                <select value={form.regimen} onChange={e => set('regimen', e.target.value)} style={{ ...inputStyle }}>
                  <option value="">-- Seleccionar --</option>
                  <option value="simplificado">Régimen Simplificado</option>
                  <option value="traditional">Régimen Tradicional</option>
                </select>
              </Field>
            </Grid>
            <SaveBar />
          </SectionCard>
        )}

        {activo === 'logos' && (
          <SectionCard icon="🖼️" title="Logos e imágenes">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <LogoSlot label="Logo principal" hint="Horizontal con nombre. Se usa en cotizaciones y documentos." value={form.logoPrincipal} onChange={url => set('logoPrincipal', url)} />
              <LogoSlot label="Logo secundario" hint="Versión alternativa (oscuro/claro). Para fondos distintos." value={form.logoSecundario} onChange={url => set('logoSecundario', url)} />
              <LogoSlot label="Isotipo" hint="Símbolo solo, sin texto. Para sidebar y encabezados." value={form.isotipo} onChange={url => set('isotipo', url)} />
              <LogoSlot label="Favicon" hint="Ícono de pestaña del navegador. PNG 32×32 px, máx. 200 KB." value={form.favicon} onChange={url => set('favicon', url)} />
            </div>
            <SaveBar />
          </SectionCard>
        )}

        {activo === 'documentos' && (
          <SectionCard icon="📄" title="Datos para documentos legales">
            <Grid>
              <Field label="Número PYME (MEIC)"><Input value={form.numeroPyme} onChange={e => set('numeroPyme', e.target.value)} placeholder="PYME-2024-XXXXX" /></Field>
              <Field label="Inscripción CCSS (Patrono)"><Input value={form.ccss} onChange={e => set('ccss', e.target.value)} placeholder="Número patronal" /></Field>
              <Field label="Representante Legal"><Input value={form.representanteLegal} onChange={e => set('representanteLegal', e.target.value)} placeholder="Nombre completo" /></Field>
              <Field label="Cédula Representante"><Input value={form.cedulaRepresentante} onChange={e => set('cedulaRepresentante', e.target.value)} placeholder="X-XXXX-XXXX" /></Field>
              <Field label="Licencia CFIA (si aplica)"><Input value={form.licenciaCFIA} onChange={e => set('licenciaCFIA', e.target.value)} placeholder="Número de licencia" /></Field>
              <Field label="Cuenta IBAN (SINPE)"><Input value={form.cuentaIBAN} onChange={e => set('cuentaIBAN', e.target.value)} placeholder="CR00 0000 0000 0000 0000 00" /></Field>
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Texto pie de página en cotizaciones">
                  <TextArea value={form.piePagina} onChange={e => set('piePagina', e.target.value)} rows={3} placeholder="Ej: Precios sujetos a cambio. Garantía de 12 meses en mano de obra." />
                </Field>
              </div>
            </Grid>
            <SaveBar />
          </SectionCard>
        )}

        {activo === 'campos' && (
          <SectionCard icon="➕" title="Campos adicionales personalizados">
            <CamposAdicionales campos={form.camposExtra} onChange={campos => set('camposExtra', campos)} />
            <SaveBar />
          </SectionCard>
        )}

        {/* ── NUEVA SECCIÓN: Campos de Facturación ── */}
        {activo === 'camposfact' && (
          <SectionCard icon="🧾" title="Campos de facturación">
            <div style={{ fontSize: 11, color: '#5c6b5c', marginBottom: 14, lineHeight: 1.6 }}>
              Define los campos que aparecerán en el tab <strong>Datos fact.</strong> de contactos y empresas.
              Los cambios aplican globalmente a todos los registros.
            </div>

            {/* Tabs física / jurídica */}
            <div style={{ display: 'flex', borderBottom: '1px solid #d0d8d0', marginBottom: 16 }}>
              {[
                { k: 'fisica',   l: '👤 Física',   desc: 'Persona natural' },
                { k: 'juridica', l: '🏢 Jurídica',  desc: 'Empresa' },
              ].map(t => (
                <button key={t.k} onClick={() => setTabFact(t.k)} style={{
                  padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 12, fontFamily: 'inherit',
                  color: tabFact === t.k ? 'var(--eco-primary)' : '#5c6b5c',
                  borderBottom: `2px solid ${tabFact === t.k ? 'var(--eco-primary)' : 'transparent'}`,
                  marginBottom: -1, fontWeight: tabFact === t.k ? 600 : 400,
                }}>
                  {t.l} <span style={{ fontSize: 10, color: '#999', marginLeft: 4 }}>{t.desc}</span>
                </button>
              ))}
            </div>

            {tabFact === 'fisica' && (
              <CamposFacturacion
                campos={camposFactFisica}
                onChange={setCamposFactFisica}
                tipo="fisica"
              />
            )}
            {tabFact === 'juridica' && (
              <CamposFacturacion
                campos={camposFactJuridica}
                onChange={setCamposFactJuridica}
                tipo="juridica"
              />
            )}

            {/* Botón guardar campos fact. */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 14, borderTop: '1px solid #d0d8d0', marginTop: 16 }}>
              {guardadoFact && <span style={{ fontSize: 12, color: 'var(--eco-primary)', alignSelf: 'center' }}>✓ Campos guardados</span>}
              <button
                onClick={() => {
                  setCamposFactFisica(CAMPOS_FACT_FISICO_DEFAULT)
                  setCamposFactJuridica(CAMPOS_FACT_JURIDICO_DEFAULT)
                }}
                style={{ border: '1px solid #d0d8d0', background: 'transparent', color: '#5c6b5c', padding: '7px 16px', fontSize: 12, borderRadius: 'var(--eco-radius, 3px)', cursor: 'pointer' }}>
                Restaurar por defecto
              </button>
              <button
                style={{ background: 'var(--eco-primary)', color: '#fff', border: 'none', padding: '7px 20px', fontSize: 12, borderRadius: 'var(--eco-radius, 3px)', cursor: 'pointer', fontWeight: 500, opacity: guardandoFact ? .7 : 1 }}
                onClick={guardarCamposFact}
                disabled={guardandoFact}>
                {guardandoFact ? 'Guardando...' : 'Guardar campos'}
              </button>
            </div>
          </SectionCard>
        )}

        {activo === 'apariencia' && (
          <SectionCard icon="🎨" title="Apariencia">
            <AparienciaPanel />
          </SectionCard>
        )}
      </div>
    </div>
  )
}