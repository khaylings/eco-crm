/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: EmpresaForm.jsx
 * Módulo:  Empresas
 * ============================================================
 */

import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../../firebase/firestore'
import { crearEmpresa, actualizarEmpresa } from '../../../firebase/contactos'

const PROVINCIAS = ['San José', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste', 'Puntarenas', 'Limón']
const SECTORES = ['Comercial', 'Industrial', 'Residencial', 'Hotelero', 'Salud', 'Educación', 'Gobierno', 'Tecnología', 'Alimentario', 'Otro']

const CAMPOS_FACT_JURIDICO_DEFAULT = [
  { id: 'razonSocial',       label: 'Razón social',                   tipo: 'text',   placeholder: 'Ej: Distribuidora ABC S.A.' },
  { id: 'cedulaJuridica',    label: 'Cédula jurídica',                tipo: 'text',   placeholder: 'Ej: 3-101-123456' },
  { id: 'codigoActividad',   label: 'Código de actividad económica',  tipo: 'text',   placeholder: 'Ej: 46900' },
  { id: 'correoFacturacion', label: 'Correo de facturación',          tipo: 'email',  placeholder: 'facturacion@empresa.com' },
  { id: 'direccionFiscal',   label: 'Dirección fiscal',               tipo: 'text',   placeholder: 'Dirección exacta para facturas' },
  { id: 'condicionPago',     label: 'Condición de pago',              tipo: 'select', opciones: ['Contado', '8 días', '15 días', '30 días', '45 días', '60 días', '90 días'] },
]

export default function EmpresaForm({ empresa, onClose, onGuardado }) {
  const [tab, setTab] = useState('info')
  const [form, setForm] = useState({
    nombre: '', ruc: '', telefono: '', correo: '', provincia: '',
    direccion: '', sector: '', sitioWeb: '', notas: ''
  })
  const [facturacion, setFacturacion] = useState({ campos: {} })
  const [camposFactConfig, setCamposFactConfig] = useState(CAMPOS_FACT_JURIDICO_DEFAULT)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    // Cargar config de campos de facturación jurídica desde Firestore
    getDoc(doc(db, 'configuracion', 'camposFacturacion')).then(snap => {
      if (snap.exists() && snap.data().juridica?.length) {
        setCamposFactConfig(snap.data().juridica)
      }
    }).catch(() => {})

    if (empresa) {
      setForm({ ...form, ...empresa })
      if (empresa.facturacion) setFacturacion(empresa.facturacion)
    }
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setCampoFact = (id, valor) => setFacturacion(f => ({ ...f, campos: { ...f.campos, [id]: valor } }))

  const handleSubmit = async () => {
    if (!form.nombre.trim()) return alert('El nombre es requerido')
    setGuardando(true)
    const data = { ...form, facturacion }
    if (empresa?.id) await actualizarEmpresa(empresa.id, data)
    else await crearEmpresa(data)
    setGuardando(false)
    onGuardado()
  }

  const s = estilos

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        {/* HEADER */}
        <div style={s.header}>
          <h2 style={s.titulo}>{empresa ? 'Editar empresa' : 'Nueva empresa'}</h2>
          <button style={s.btnCerrar} onClick={onClose}>✕</button>
        </div>

        {/* TABS */}
        <div style={s.tabs}>
          {[
            { k: 'info', l: 'Info. empresa' },
            { k: 'fact', l: '🧾 Datos fact.' },
          ].map(t => (
            <button key={t.k} style={{ ...s.tab, ...(tab === t.k ? s.tabActivo : {}) }} onClick={() => setTab(t.k)}>
              {t.l}
            </button>
          ))}
        </div>

        <div style={s.cuerpo}>

          {/* ── TAB INFO ── */}
          {tab === 'info' && (
            <>
              {[
                { label: 'Nombre de la empresa *', key: 'nombre', placeholder: 'Ej: Distribuidora ABC S.A.' },
                { label: 'Cédula jurídica / RUC',  key: 'ruc',    placeholder: 'Ej: 3-101-123456' },
                { label: 'Sector / industria',     key: 'sector', tipo: 'select', opciones: SECTORES },
                { label: 'Teléfono principal',      key: 'telefono', placeholder: '2222-2222' },
                { label: 'Correo general',          key: 'correo',   tipo: 'email', placeholder: 'info@empresa.com' },
                { label: 'Provincia',               key: 'provincia', tipo: 'select', opciones: PROVINCIAS },
                { label: 'Dirección',               key: 'direccion', placeholder: 'Dirección principal' },
                { label: 'Sitio web',               key: 'sitioWeb',  placeholder: 'https://www.empresa.com' },
                { label: 'Notas',                   key: 'notas',     tipo: 'textarea' },
              ].map(({ label, key, tipo, placeholder, opciones }) => (
                <div key={key} style={s.campo}>
                  <label style={s.label}>{label}</label>
                  {tipo === 'select' ? (
                    <select style={s.input} value={form[key]} onChange={e => set(key, e.target.value)}>
                      <option value="">— Seleccionar —</option>
                      {opciones.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : tipo === 'textarea' ? (
                    <textarea style={{ ...s.input, minHeight: '80px', resize: 'vertical' }} value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder} />
                  ) : (
                    <input style={s.input} type={tipo || 'text'} value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder} />
                  )}
                </div>
              ))}
            </>
          )}

          {/* ── TAB DATOS FACT. ── */}
          {tab === 'fact' && (
            <>
              {/* Indicador siempre jurídica */}
              <div style={s.badgeJuridica}>
                🏢 Facturación jurídica — aplica a esta empresa
              </div>

              <div style={s.separador} />

              {/* Campos dinámicos */}
              {camposFactConfig.map(campo => (
                <div key={campo.id} style={s.campo}>
                  <label style={s.label}>{campo.label}</label>
                  {campo.tipo === 'select' ? (
                    <select style={s.input} value={facturacion.campos?.[campo.id] || ''}
                      onChange={e => setCampoFact(campo.id, e.target.value)}>
                      <option value="">— Seleccionar —</option>
                      {campo.opciones.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : campo.tipo === 'textarea' ? (
                    <textarea style={{ ...s.input, minHeight: 70, resize: 'vertical' }}
                      value={facturacion.campos?.[campo.id] || ''}
                      onChange={e => setCampoFact(campo.id, e.target.value)}
                      placeholder={campo.placeholder} />
                  ) : (
                    <input style={s.input} type={campo.tipo}
                      value={facturacion.campos?.[campo.id] || ''}
                      onChange={e => setCampoFact(campo.id, e.target.value)}
                      placeholder={campo.placeholder} />
                  )}
                </div>
              ))}

              {camposFactConfig.length === 0 && (
                <div style={{ textAlign: 'center', color: '#999', padding: '2rem', fontSize: 13 }}>
                  No hay campos configurados.<br />
                  <span style={{ fontSize: 12 }}>Configúralos en Configuración → Campos fact.</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* PIE */}
        <div style={s.pie}>
          <button style={s.btnCancelar} onClick={onClose}>Cancelar</button>
          <button style={s.btnGuardar} onClick={handleSubmit} disabled={guardando}>
            {guardando ? 'Guardando...' : empresa ? 'Guardar cambios' : 'Crear empresa'}
          </button>
        </div>
      </div>
    </div>
  )
}

const estilos = {
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' },
  modal: { backgroundColor: '#fff', borderRadius: '16px', width: '100%', maxWidth: '540px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid #eee', flexShrink: 0 },
  titulo: { margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1a1a1a' },
  btnCerrar: { background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#666' },
  tabs: { display: 'flex', borderBottom: '1px solid #eee', padding: '0 1.5rem', flexShrink: 0 },
  tab: { padding: '0.75rem 1rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.88rem', color: '#666', borderBottom: '2px solid transparent', marginBottom: '-1px', fontWeight: 500, fontFamily: 'inherit' },
  tabActivo: { color: '#1a3a5c', borderBottomColor: '#1a3a5c', fontWeight: 700 },
  cuerpo: { overflowY: 'auto', padding: '1.5rem', flex: 1 },
  pie: { padding: '1rem 1.5rem', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexShrink: 0 },
  campo: { marginBottom: '1rem' },
  separador: { height: 1, background: '#f0f0f0', margin: '4px 0 16px' },
  label: { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#444', marginBottom: '0.35rem' },
  input: { width: '100%', padding: '0.6rem 0.85rem', border: '1.5px solid #dde3ed', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', color: '#1a1a1a' },
  badgeJuridica: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#e8f0fe', color: '#1a3a5c', border: '1px solid #c5d8f8', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, marginBottom: 4 },
  btnCancelar: { padding: '0.6rem 1.25rem', border: '1.5px solid #dde3ed', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#444', fontFamily: 'inherit' },
  btnGuardar: { padding: '0.6rem 1.5rem', border: 'none', borderRadius: '8px', backgroundColor: '#1a3a5c', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', fontFamily: 'inherit' },
}