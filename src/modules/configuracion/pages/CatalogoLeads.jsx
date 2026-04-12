/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: CatalogoLeads.jsx
 * Módulo:  Configuracion
 * ============================================================
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../../../firebase/config'
import { collection, addDoc, getDocs, deleteDoc, doc, orderBy, query } from 'firebase/firestore'

// ─── Estructura del sidebar por bloques ──────────────────────────────────────
const SIDEBAR = [
  {
    grupo: 'Empresa',
    items: [
      { key: 'empresa',  label: 'Mi Empresa',  icon: '🏢', desc: 'Datos, logos e información legal', link: '/configuracion/empresa' },
    ]
  },
  {
    grupo: 'Usuarios',
    items: [
      { key: 'perfil',   label: 'Mi Perfil',  icon: '👤', desc: 'Foto y datos personales',          link: '/configuracion/perfil' },
      { key: 'usuarios', label: 'Usuarios',   icon: '👥', desc: 'Gestión de usuarios del sistema',  link: '/configuracion/usuarios' },
      { key: 'roles',    label: 'Roles',       icon: '🔑', desc: 'Permisos por módulo',              link: '/configuracion/roles' },
    ]
  },
  {
    grupo: 'Chats',
    items: [
      { key: 'conectores', label: 'Conectores',    icon: '🔌', desc: 'WhatsApp y otras integraciones', link: '/configuracion/conectores' },
      { key: 'bot',        label: 'Bot WhatsApp',  icon: '🤖', desc: 'Flujo automático de bienvenida', link: '/configuracion/bot' },
    ]
  },
  {
    grupo: 'Comercial',
    items: [
      { key: 'consecutivos',         label: 'Consecutivos',        icon: '🔢', desc: 'Prefijos y numeración',          link: '/configuracion/consecutivos' },
      { key: 'plantilla_cotizacion', label: 'Plantilla Cotización', icon: '📄', desc: 'Diseño del documento',          link: '/configuracion/plantilla-cotizacion' },
      { key: 'plantilla_proyecto',   label: 'Plantilla Proyecto',  icon: '📁', desc: 'Diseño del documento proyecto',  link: '/configuracion/plantilla-proyecto' },
    ]
  },
  {
    grupo: 'Inventario',
    items: [
      { key: 'inventario_config',  label: 'Configuración',      icon: '📦', desc: 'Categorías, listas de precio e IVA', link: '/configuracion/inventario' },
      { key: 'etiquetas_producto', label: 'Etiquetas producto', icon: '🏷️', desc: 'Técnico, Cliente final, Proyecto...' },
    ]
  },
  {
    grupo: 'Catálogos CRM',
    items: [
      { key: 'origenes', label: 'Orígenes de leads',     icon: '📡', desc: 'De dónde llegan tus leads' },
      { key: 'sectores', label: 'Sectores / industrias', icon: '🏭', desc: 'Rubros de tus clientes' },
    ]
  },
  {
    grupo: 'Catálogos Activos',
    items: [
      { key: 'tipos_equipo',   label: 'Tipos de equipo AC', icon: '❄️', desc: 'Clasificación de equipos' },
      { key: 'estados_equipo', label: 'Estados de equipo',  icon: '🔧', desc: 'Condición operativa del equipo' },
      { key: 'tipos_servicio', label: 'Tipos de servicio',  icon: '📋', desc: 'Categorías de servicio técnico' },
    ]
  },
  {
    grupo: 'Sistema',
    items: [
      { key: 'devtools', label: 'Dev Tools', icon: '🛠️', desc: 'Datos de prueba y reset', link: '/configuracion/devtools' },
    ]
  },
]

const DEFAULTS = {
  origenes:            ['WhatsApp', 'Redes sociales', 'Referido', 'Llamada entrante', 'Web / formulario', 'Visita en sitio', 'Correo electrónico'],
  tipos_equipo:        ['Mini Split', 'Cassette', 'Piso techo', 'Ventana', 'Chiller', 'Fan Coil', 'Manejadora', 'Condensadora', 'VRF', 'Otro'],
  sectores:            ['Comercial', 'Industrial', 'Residencial', 'Hotelero', 'Salud', 'Educación', 'Gobierno', 'Tecnología', 'Alimentario', 'Otro'],
  estados_equipo:      ['Operativo', 'En mantenimiento', 'Fuera de servicio', 'En garantía', 'Por revisar'],
  tipos_servicio:      ['Instalación', 'Mantenimiento preventivo', 'Mantenimiento correctivo', 'Reparación', 'Diagnóstico', 'Garantía', 'Contrato de servicio'],
  etiquetas_producto:  ['Técnico', 'Cliente final', 'Proyecto', 'Mayorista', 'Interno'],
}

const COLECCION = {
  origenes:           'catalogo_origenes',
  tipos_equipo:       'catalogo_tipos_equipo',
  sectores:           'catalogo_sectores',
  estados_equipo:     'catalogo_estados_equipo',
  tipos_servicio:     'catalogo_tipos_servicio',
  etiquetas_producto: 'catalogo_etiquetas_producto',
}

async function obtenerCatalogo(col) {
  const snap = await getDocs(query(collection(db, col), orderBy('nombre')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export default function CatalogoLeads() {
  const navigate = useNavigate()
  const [seccionActiva, setSeccionActiva] = useState('origenes')
  const [items, setItems] = useState([])
  const [nuevo, setNuevo] = useState('')
  const [cargando, setCargando] = useState(false)

  // Encontrar el item activo en el sidebar
  const itemActivo = SIDEBAR.flatMap(g => g.items).find(i => i.key === seccionActiva)
  const coleccion = COLECCION[seccionActiva]

  const cargar = async () => {
    if (!coleccion) return
    setCargando(true)
    const data = await obtenerCatalogo(coleccion)
    setItems(data)
    setCargando(false)
  }

  useEffect(() => { cargar() }, [seccionActiva])

  const agregar = async (nombre) => {
    if (!nombre.trim() || !coleccion) return
    if (items.find(i => i.nombre.toLowerCase() === nombre.toLowerCase())) return
    await addDoc(collection(db, coleccion), { nombre: nombre.trim() })
    setNuevo('')
    cargar()
  }

  const eliminar = async (id) => {
    await deleteDoc(doc(db, coleccion, id))
    cargar()
  }

  const cargarDefaults = async () => {
    const defaults = DEFAULTS[seccionActiva]
    if (!defaults || !coleccion) return
    const existentes = items.map(i => i.nombre.toLowerCase())
    for (const d of defaults) {
      if (!existentes.includes(d.toLowerCase())) {
        await addDoc(collection(db, coleccion), { nombre: d })
      }
    }
    cargar()
  }

  const handleSeccion = (item) => {
    if (item.link) {
      navigate(item.link)
    } else {
      setSeccionActiva(item.key)
      setNuevo('')
    }
  }

  const s = estilos

  return (
    <div style={s.wrapper}>
      {/* ── SIDEBAR ── */}
      <div style={s.menu}>
        <div style={s.menuTitulo}>Configuración</div>

        {SIDEBAR.map(grupo => (
          <div key={grupo.grupo}>
            <div style={s.menuGrupo}>{grupo.grupo}</div>
            {grupo.items.map(item => {
              const activo = seccionActiva === item.key
              return (
                <button
                  key={item.key}
                  style={{ ...s.menuItem, ...(activo ? s.menuItemActivo : {}) }}
                  onClick={() => handleSeccion(item)}
                >
                  <span style={s.menuIcon}>{item.icon}</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={s.menuLabel}>{item.label}</div>
                    <div style={s.menuDesc}>{item.desc}</div>
                  </div>
                  {item.link && (
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="#aaa" strokeWidth="1.5" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                      <path d="M6 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-3M9 1h6v6M15 1L8 8"/>
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* ── CONTENIDO ── */}
      <div style={s.contenido}>
        {coleccion ? (
          <>
            <div style={s.contenidoHeader}>
              <div>
                <h2 style={s.titulo}>{itemActivo?.icon} {itemActivo?.label}</h2>
                <p style={s.sub}>{itemActivo?.desc} · {items.length} elemento{items.length !== 1 ? 's' : ''}</p>
              </div>
              {items.length === 0 && !cargando && DEFAULTS[seccionActiva] && (
                <button style={s.btnDefaults} onClick={cargarDefaults}>↓ Cargar predeterminados</button>
              )}
            </div>

            <div style={s.inputRow}>
              <input
                style={s.input}
                value={nuevo}
                onChange={e => setNuevo(e.target.value)}
                placeholder={`Agregar ${itemActivo?.label.toLowerCase()}...`}
                onKeyDown={e => e.key === 'Enter' && agregar(nuevo)}
              />
              <button style={s.btnAgregar} onClick={() => agregar(nuevo)}>+ Agregar</button>
            </div>

            {cargando ? (
              <p style={{ color: '#999', fontSize: '0.88rem' }}>Cargando...</p>
            ) : items.length === 0 ? (
              <div style={s.vacio}>
                <p style={{ fontSize: '2rem', margin: 0 }}>{itemActivo?.icon}</p>
                <p style={{ color: '#999', fontSize: '0.88rem' }}>Sin elementos. Agrega uno o carga los predeterminados.</p>
              </div>
            ) : (
              <div style={s.grid}>
                {items.map(item => (
                  <div key={item.id} style={s.chip}>
                    <span>{item.nombre}</span>
                    <button style={s.btnX} onClick={() => eliminar(item.id)} title="Eliminar">✕</button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 10, color: '#999' }}>
            <span style={{ fontSize: 32 }}>⚙️</span>
            <span style={{ fontSize: 14 }}>Seleccioná una sección del menú</span>
          </div>
        )}
      </div>
    </div>
  )
}

const estilos = {
  wrapper:         { display: 'flex', height: '100%', alignItems: 'flex-start' },
  menu:            { width: 230, backgroundColor: '#fff', borderRight: '1px solid #e0e7ef', padding: '10px 0', flexShrink: 0, height: '100%', overflowY: 'auto' },
  menuTitulo:      { fontSize: '0.72rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 14px 4px' },
  menuGrupo:       { fontSize: '0.68rem', fontWeight: 600, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '10px 14px 3px', marginTop: 4 },
  menuItem:        { width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '7px 14px', border: 'none', background: 'none', cursor: 'pointer', marginBottom: 1, transition: 'all 0.12s', borderLeft: '3px solid transparent' },
  menuItemActivo:  { backgroundColor: 'var(--eco-primary-light)', borderLeft: '3px solid var(--eco-primary)' },
  menuIcon:        { fontSize: '0.95rem', flexShrink: 0 },
  menuLabel:       { fontSize: '0.82rem', fontWeight: 500, color: '#1a1a1a', lineHeight: 1.2 },
  menuDesc:        { fontSize: '0.68rem', color: '#999', marginTop: 1 },
  contenido:       { flex: 1, backgroundColor: '#f4f6f4', padding: '24px', height: '100%', overflowY: 'auto' },
  contenidoHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' },
  titulo:          { fontSize: '1.1rem', fontWeight: 700, color: '#1a1a1a', margin: 0 },
  sub:             { color: '#888', fontSize: '0.82rem', margin: '0.25rem 0 0' },
  inputRow:        { display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' },
  input:           { flex: 1, padding: '0.6rem 0.85rem', border: '1px solid #d0d8d0', borderRadius: 8, fontSize: '0.9rem', outline: 'none', background: '#fff' },
  btnAgregar:      { padding: '0.6rem 1.25rem', border: 'none', borderRadius: 8, backgroundColor: 'var(--eco-primary)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'nowrap' },
  btnDefaults:     { padding: '0.5rem 1rem', border: '1px solid var(--eco-primary)', borderRadius: 8, background: '#fff', color: 'var(--eco-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap' },
  grid:            { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  chip:            { display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#fff', borderRadius: 8, padding: '0.5rem 0.85rem', fontSize: '0.88rem', fontWeight: 500, color: '#1a1a1a', border: '1px solid #d0d8d0' },
  btnX:            { background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: '0.8rem', padding: 0, lineHeight: 1, flexShrink: 0 },
  vacio:           { textAlign: 'center', padding: '2.5rem', color: '#999' },
}