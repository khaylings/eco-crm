/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: ContactoForm.jsx
 * Módulo:  Contactos
 * ============================================================
 */

import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../../../firebase/firestore'
import { crearContacto, actualizarContacto, obtenerEmpresas, obtenerSedes } from '../../../firebase/contactos'

const PROVINCIAS = ['San José', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste', 'Puntarenas', 'Limón']

const CAMPOS_FACT_FISICO_DEFAULT = [
  { id: 'nombreFiscal',      label: 'Nombre completo fiscal',         tipo: 'text',   placeholder: 'Ej: Juan Pérez Rodríguez' },
  { id: 'cedulaFisica',      label: 'Número de cédula física',        tipo: 'text',   placeholder: 'Ej: 1-1234-5678' },
  { id: 'codigoActividad',   label: 'Código de actividad económica',  tipo: 'text',   placeholder: 'Ej: 46900' },
  { id: 'correoFacturacion', label: 'Correo de facturación',          tipo: 'email',  placeholder: 'facturacion@correo.com' },
  { id: 'direccionFiscal',   label: 'Dirección fiscal',               tipo: 'text',   placeholder: 'Dirección exacta' },
  { id: 'condicionPago',     label: 'Condición de pago',              tipo: 'select', opciones: ['Contado', '8 días', '15 días', '30 días', '45 días', '60 días', '90 días'] },
]

const CAMPOS_FACT_JURIDICO_DEFAULT = [
  { id: 'razonSocial',       label: 'Razón social',                   tipo: 'text',   placeholder: 'Ej: Distribuidora ABC S.A.' },
  { id: 'cedulaJuridica',    label: 'Cédula jurídica',                tipo: 'text',   placeholder: 'Ej: 3-101-123456' },
  { id: 'codigoActividad',   label: 'Código de actividad económica',  tipo: 'text',   placeholder: 'Ej: 46900' },
  { id: 'correoFacturacion', label: 'Correo de facturación',          tipo: 'email',  placeholder: 'facturacion@empresa.com' },
  { id: 'direccionFiscal',   label: 'Dirección fiscal',               tipo: 'text',   placeholder: 'Dirección exacta para facturas' },
  { id: 'condicionPago',     label: 'Condición de pago',              tipo: 'select', opciones: ['Contado', '8 días', '15 días', '30 días', '45 días', '60 días', '90 días'] },
]

export default function ContactoForm({ contacto, onClose, onGuardado }) {
  const [tab, setTab] = useState('info')
  const [form, setForm] = useState({
    nombre: '', tipo: 'persona', telefono: '', whatsapp: '',
    correo: '', provincia: '', empresaId: '', empresaNombre: '',
    sedeId: '', sedeNombre: '', cargo: '', notas: '', etiquetas: ''
  })
  const [facturacion, setFacturacion] = useState({
    tipoFact: 'fisica', // 'fisica' | 'juridica'
    campos: {}
  })
  const [camposFactConfig, setCamposFactConfig] = useState({ fisica: CAMPOS_FACT_FISICO_DEFAULT, juridica: CAMPOS_FACT_JURIDICO_DEFAULT })
  const [empresas, setEmpresas] = useState([])
  const [sedes, setSedes] = useState([])
  const [cargandoSedes, setCargandoSedes] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    obtenerEmpresas().then(setEmpresas)
    // Cargar config de campos de facturación desde Firestore
    getDoc(doc(db, 'configuracion', 'camposFacturacion')).then(snap => {
      if (snap.exists()) {
        const data = snap.data()
        setCamposFactConfig({
          fisica: data.fisica?.length ? data.fisica : CAMPOS_FACT_FISICO_DEFAULT,
          juridica: data.juridica?.length ? data.juridica : CAMPOS_FACT_JURIDICO_DEFAULT,
        })
      }
    }).catch(() => {})

    if (contacto) {
      setForm({ ...form, ...contacto, etiquetas: contacto.etiquetas?.join(', ') || '' })
      if (contacto.facturacion) setFacturacion(contacto.facturacion)
      if (contacto.empresaId) cargarSedes(contacto.empresaId)
    }
  }, [])

  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }))
  const setFact = (campo, valor) => setFacturacion(f => ({ ...f, [campo]: valor }))
  const setCampoFact = (id, valor) => setFacturacion(f => ({ ...f, campos: { ...f.campos, [id]: valor } }))

  const cargarSedes = async (empresaId) => {
    if (!empresaId) { setSedes([]); return }
    setCargandoSedes(true)
    const data = await obtenerSedes(empresaId)
    setSedes(data)
    setCargandoSedes(false)
  }

  const handleEmpresaChange = (e) => {
    const id = e.target.value
    const emp = empresas.find(x => x.id === id)
    set('empresaId', id)
    set('empresaNombre', emp?.nombre || '')
    set('sedeId', '')
    set('sedeNombre', '')
    cargarSedes(id)
  }

  const handleSedeChange = (e) => {
    const id = e.target.value
    const sede = sedes.find(s => s.id === id)
    set('sedeId', id)
    set('sedeNombre', sede?.nombre || '')
  }

  const desvincularEmpresa = () => {
    set('empresaId', '')
    set('empresaNombre', '')
    set('sedeId', '')
    set('sedeNombre', '')
    setSedes([])
  }

  const desvincularSede = () => {
    set('sedeId', '')
    set('sedeNombre', '')
  }

  const handleSubmit = async () => {
    if (!form.nombre.trim()) return alert('El nombre es requerido')
    setGuardando(true)
    const data = {
      ...form,
      etiquetas: form.etiquetas ? form.etiquetas.split(',').map(e => e.trim()).filter(Boolean) : [],
      facturacion,
    }
    if (contacto?.id) await actualizarContacto(contacto.id, data)
    else await crearContacto(data)
    setGuardando(false)
    onGuardado()
  }

  const s = estilos
  const camposActivos = camposFactConfig[facturacion.tipoFact] || []

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        {/* HEADER */}
        <div style={s.modalHeader}>
          <h2 style={s.modalTitulo}>{contacto ? 'Editar contacto' : 'Nuevo contacto'}</h2>
          <button style={s.btnCerrar} onClick={onClose}>✕</button>
        </div>

        {/* TABS */}
        <div style={s.tabs}>
          {[
            { k: 'info', l: 'Info. contacto' },
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
              {/* Tipo */}
              <div style={s.campo}>
                <label style={s.label}>Tipo de contacto</label>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {['persona', 'empresa'].map(t => (
                    <button key={t} type="button"
                      style={{ ...s.opcionTipo, ...(form.tipo === t ? s.opcionTipoActivo : {}) }}
                      onClick={() => {
                        set('tipo', t)
                        if (t === 'persona') desvincularEmpresa()
                      }}>
                      {t === 'persona' ? '👤 Persona natural' : '🏢 Representante de empresa'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nombre */}
              <div style={s.campo}>
                <label style={s.label}>Nombre completo *</label>
                <input style={s.input} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Juan Pérez" />
              </div>

              {/* Empresa */}
              {form.tipo === 'empresa' && (
                <>
                  <div style={s.campo}>
                    <label style={s.label}>Empresa</label>
                    {form.empresaId ? (
                      <div style={s.vinculoBox}>
                        <span style={s.vinculoNombre}>🏢 {form.empresaNombre}</span>
                        <button style={s.btnDesvincular} onClick={desvincularEmpresa}>Desvincular empresa</button>
                      </div>
                    ) : (
                      <select style={s.input} value={form.empresaId} onChange={handleEmpresaChange}>
                        <option value="">— Seleccionar empresa —</option>
                        {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                      </select>
                    )}
                  </div>

                  {form.empresaId && (
                    <div style={s.campo}>
                      <label style={s.label}>
                        Sede {cargandoSedes && <span style={{ fontWeight: 400, color: '#999', marginLeft: 6 }}>Cargando...</span>}
                      </label>
                      {form.sedeId ? (
                        <div style={s.vinculoBox}>
                          <span style={s.vinculoNombre}>📍 {form.sedeNombre}</span>
                          <button style={s.btnDesvincular} onClick={desvincularSede}>Desvincular sede</button>
                        </div>
                      ) : sedes.length > 0 ? (
                        <select style={s.input} value={form.sedeId} onChange={handleSedeChange}>
                          <option value="">— Sin sede específica —</option>
                          {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}{s.provincia ? ` (${s.provincia})` : ''}</option>)}
                        </select>
                      ) : !cargandoSedes ? (
                        <div style={{ fontSize: 12, color: '#999', padding: '6px 0' }}>Esta empresa no tiene sedes registradas</div>
                      ) : null}
                    </div>
                  )}

                  <div style={s.campo}>
                    <label style={s.label}>Cargo / puesto</label>
                    <input style={s.input} value={form.cargo} onChange={e => set('cargo', e.target.value)} placeholder="Ej: Gerente de operaciones" />
                  </div>
                </>
              )}

              <div style={s.fila}>
                <div style={s.campo}>
                  <label style={s.label}>Teléfono</label>
                  <input style={s.input} value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="8888-8888" />
                </div>
                <div style={s.campo}>
                  <label style={s.label}>WhatsApp</label>
                  <input style={s.input} value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="8888-8888" />
                </div>
              </div>

              <div style={s.campo}>
                <label style={s.label}>Correo electrónico</label>
                <input style={s.input} type="email" value={form.correo} onChange={e => set('correo', e.target.value)} placeholder="correo@ejemplo.com" />
              </div>

              <div style={s.campo}>
                <label style={s.label}>Provincia</label>
                <select style={s.input} value={form.provincia} onChange={e => set('provincia', e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div style={s.campo}>
                <label style={s.label}>Etiquetas (separadas por coma)</label>
                <input style={s.input} value={form.etiquetas} onChange={e => set('etiquetas', e.target.value)} placeholder="Ej: cliente, prioritario, referido" />
              </div>

              <div style={s.campo}>
                <label style={s.label}>Notas</label>
                <textarea style={{ ...s.input, minHeight: '80px', resize: 'vertical' }} value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Información adicional..." />
              </div>
            </>
          )}

          {/* ── TAB DATOS FACT. ── */}
          {tab === 'fact' && (
            <>
              {/* Selector físico / jurídico */}
              <div style={s.campo}>
                <label style={s.label}>Tipo de facturación</label>
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: 4 }}>
                  {[
                    { k: 'fisica',   l: '👤 Física',   desc: 'Persona natural / cédula física' },
                    { k: 'juridica', l: '🏢 Jurídica',  desc: 'Empresa / cédula jurídica' },
                  ].map(t => (
                    <button key={t.k} type="button"
                      style={{ ...s.opcionTipo, ...(facturacion.tipoFact === t.k ? s.opcionTipoActivo : {}) }}
                      onClick={() => setFact('tipoFact', t.k)}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{t.l}</div>
                      <div style={{ fontSize: 11, opacity: .75, marginTop: 2 }}>{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={s.separador} />

              {/* Campos dinámicos */}
              {camposActivos.map(campo => (
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

              {camposActivos.length === 0 && (
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
            {guardando ? 'Guardando...' : contacto ? 'Guardar cambios' : 'Crear contacto'}
          </button>
        </div>
      </div>
    </div>
  )
}

const estilos = {
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' },
  modal: { backgroundColor: '#fff', borderRadius: '16px', width: '100%', maxWidth: '580px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid #eee', flexShrink: 0 },
  modalTitulo: { margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1a1a1a' },
  btnCerrar: { background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#666', padding: '0.25rem' },
  tabs: { display: 'flex', borderBottom: '1px solid #eee', padding: '0 1.5rem', flexShrink: 0 },
  tab: { padding: '0.75rem 1rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.88rem', color: '#666', borderBottom: '2px solid transparent', marginBottom: '-1px', fontWeight: 500, fontFamily: 'inherit' },
  tabActivo: { color: '#1a3a5c', borderBottomColor: '#1a3a5c', fontWeight: 700 },
  cuerpo: { overflowY: 'auto', padding: '1.5rem', flex: 1 },
  pie: { padding: '1rem 1.5rem', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexShrink: 0 },
  campo: { marginBottom: '1rem', flex: 1 },
  fila: { display: 'flex', gap: '1rem' },
  separador: { height: 1, background: '#f0f0f0', margin: '4px 0 16px' },
  label: { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#444', marginBottom: '0.35rem' },
  input: { width: '100%', padding: '0.6rem 0.85rem', border: '1.5px solid #dde3ed', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', color: '#1a1a1a' },
  opcionTipo: { flex: 1, padding: '0.65rem', border: '1.5px solid #dde3ed', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, color: '#444', fontFamily: 'inherit', textAlign: 'left' },
  opcionTipoActivo: { backgroundColor: '#1a3a5c', color: '#fff', borderColor: '#1a3a5c' },
  vinculoBox: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.85rem', border: '1.5px solid #d0eaff', borderRadius: '8px', background: '#f0f7ff' },
  vinculoNombre: { fontSize: '0.88rem', fontWeight: 600, color: '#1a3a5c' },
  btnDesvincular: { fontSize: '0.75rem', color: '#c0392b', background: 'none', border: '1px solid #c0392b', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnCancelar: { padding: '0.6rem 1.25rem', border: '1.5px solid #dde3ed', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#444', fontFamily: 'inherit' },
  btnGuardar: { padding: '0.6rem 1.5rem', border: 'none', borderRadius: '8px', backgroundColor: '#1a3a5c', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', fontFamily: 'inherit' },
}