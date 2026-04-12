/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: Roles.jsx
 * Módulo:  Configuracion
 * ============================================================
 */

import { useState, useEffect } from 'react'
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore'
import { db } from '../../../firebase/firestore'
import { usePermisos } from '../../../hooks/usePermisos'
import { useAuth } from '../../../context/AuthContext'

const MODULOS = [
  { key: 'inicio', label: 'Inicio' },
  {
    key: 'crm', label: 'CRM / Leads',
    subs: ['Ver leads', 'Ver leads de todos los vendedores', 'Crear lead', 'Editar lead', 'Reasignar lead a otro vendedor', 'Marcar como Perdido', 'Eliminar lead'],
  },
  {
    key: 'chats', label: 'Chats WA',
    subs: ['Ver chats', 'Ver chats de todos los vendedores', 'Enviar mensajes', 'Asignar/reasignar conversación', 'Solicitar ayuda en conversación', 'Crear lead desde chat'],
  },
  {
    key: 'contactos', label: 'Contactos',
    subs: ['Ver', 'Crear', 'Editar', 'Eliminar'],
  },
  {
    key: 'ventas', label: 'Cotizaciones',
    subs: ['Ver cotizaciones', 'Ver cotizaciones de todos', 'Ver precios y costos', 'Crear cotización', 'Editar cotización', 'Aprobar cotización manualmente', 'Enviar enlace al cliente', 'Eliminar cotización'],
  },
  {
    key: 'facturas', label: 'Facturas',
    subs: [
      'Ver facturas',
      'Ver facturas de todos',
      'Ver precios y montos',
      'Crear factura desde cotización aprobada',
      'Registrar pagos',
      'Marcar como incobrable',
      'Eliminar factura',
    ],
  },
  {
    key: 'compras', label: 'Compras',
    subs: ['Ver', 'Crear orden', 'Editar orden', 'Aprobar orden', 'Eliminar orden'],
  },
  {
    key: 'inventario', label: 'Inventario',
    subs: ['Ver productos', 'Ver costos de productos', 'Ver stock', 'Agregar producto', 'Editar producto', 'Ajustar stock manualmente', 'Eliminar producto'],
  },
  {
    key: 'calendario', label: 'Calendario',
    subs: ['Ver eventos', 'Ver eventos de todos', 'Crear evento', 'Editar evento', 'Eliminar evento'],
  },
  {
    key: 'reportes', label: 'Reportes',
    subs: ['Ver reportes propios', 'Ver reportes de todos', 'Ver comisiones del equipo', 'Exportar reportes'],
  },
  {
    key: 'configuracion', label: 'Configuración',
    subs: ['Mi Empresa', 'Usuarios', 'Roles', 'Catálogos', 'Estética', 'Conectores WhatsApp', 'Metas y comisiones'],
  },
]

const ACCIONES_CRITICAS = [
  'Marcar como Perdido', 'Eliminar lead', 'Eliminar cotización',
  'Eliminar factura', 'Eliminar orden', 'Eliminar producto', 'Eliminar evento',
  'Marcar como incobrable',
]

const ACCIONES_VISIBILIDAD = [
  'Ver leads de todos los vendedores', 'Ver chats de todos los vendedores',
  'Ver cotizaciones de todos', 'Ver facturas de todos', 'Ver eventos de todos',
  'Ver reportes de todos', 'Ver comisiones del equipo', 'Ver costos de productos',
  'Ver precios y montos', 'Ver precios y costos',
]

const ROLES_DEFAULT = [
  {
    nombre: 'Administrador', color: '#1a6e3c',
    permisos: Object.fromEntries(
      MODULOS.flatMap(m => [
        [m.key, true],
        ...(m.subs || []).map(s => [`${m.key}_${s}`, true]),
      ])
    ),
  },
  {
    nombre: 'Supervisor', color: '#185FA5',
    permisos: Object.fromEntries(
      MODULOS.flatMap(m => {
        const off = ['crm_Eliminar lead', 'ventas_Eliminar cotización', 'facturas_Eliminar factura', 'configuracion_Roles']
        return [
          [m.key, true],
          ...(m.subs || []).map(s => [`${m.key}_${s}`, !off.includes(`${m.key}_${s}`)]),
        ]
      })
    ),
  },
  {
    nombre: 'Vendedor', color: '#854F0B',
    permisos: {
      inicio: true,
      crm: true,
      'crm_Ver leads': true,
      'crm_Crear lead': true,
      'crm_Editar lead': true,
      chats: true,
      'chats_Ver chats': true,
      'chats_Enviar mensajes': true,
      'chats_Solicitar ayuda en conversación': true,
      'chats_Crear lead desde chat': true,
      contactos: true,
      'contactos_Ver': true,
      'contactos_Crear': true,
      'contactos_Editar': true,
      ventas: true,
      'ventas_Ver cotizaciones': true,
      'ventas_Ver precios y costos': true,
      'ventas_Crear cotización': true,
      'ventas_Editar cotización': true,
      'ventas_Enviar enlace al cliente': true,
      facturas: true,
      'facturas_Ver facturas': true,
      'facturas_Ver precios y montos': true,
      'facturas_Crear factura desde cotización aprobada': true,
      'facturas_Registrar pagos': true,
      inventario: true,
      'inventario_Ver productos': true,
      'inventario_Ver stock': true,
      calendario: true,
      'calendario_Ver eventos': true,
      'calendario_Crear evento': true,
      'calendario_Editar evento': true,
      reportes: true,
      'reportes_Ver reportes propios': true,
    },
  },
  {
    nombre: 'Técnico', color: '#534AB7',
    permisos: {
      inicio: true,
      crm: true,
      'crm_Ver leads': true,
      chats: true,
      'chats_Ver chats': true,
      contactos: true,
      'contactos_Ver': true,
      calendario: true,
      'calendario_Ver eventos': true,
      'calendario_Editar evento': true,
      inventario: true,
      'inventario_Ver productos': true,
      'inventario_Ver stock': true,
    },
  },
  {
    nombre: 'Solo lectura', color: '#5F5E5A',
    permisos: {
      inicio: true,
      crm: true,
      'crm_Ver leads': true,
      contactos: true,
      'contactos_Ver': true,
      ventas: true,
      'ventas_Ver cotizaciones': true,
      facturas: true,
      'facturas_Ver facturas': true,
      inventario: true,
      'inventario_Ver productos': true,
      calendario: true,
      'calendario_Ver eventos': true,
      reportes: true,
      'reportes_Ver reportes propios': true,
    },
  },
]

export default function Roles() {
  const { esAdmin: esAdminPermisos } = usePermisos()
  const authCtx = useAuth()
  const yo = authCtx.usuario || authCtx.currentUser || authCtx.user || null
  const miRol = yo?.rol || ''

  const usuarioEsAdmin = esAdminPermisos ||
    miRol === 'Super Administrador' ||
    miRol === 'Administrador'

  const soloLectura = !usuarioEsAdmin

  const [roles, setRoles]         = useState([])
  const [rolActivo, setRolActivo] = useState(null)
  const [permisos, setPermisos]   = useState({})
  const [nuevoRol, setNuevoRol]   = useState('')
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg]             = useState('')

  const cargar = async () => {
    const snap = await getDocs(collection(db, 'roles'))
    if (snap.empty) {
      for (const r of ROLES_DEFAULT) await addDoc(collection(db, 'roles'), r)
      const snap2 = await getDocs(collection(db, 'roles'))
      const data = snap2.docs.map(d => ({ id: d.id, ...d.data() }))
      setRoles(data); setRolActivo(data[0]); setPermisos(data[0]?.permisos || {})
    } else {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setRoles(data); setRolActivo(data[0]); setPermisos(data[0]?.permisos || {})
    }
  }

  useEffect(() => { cargar() }, [])

  const seleccionarRol = (rol) => {
    setRolActivo(rol); setPermisos(rol.permisos || {}); setMsg('')
  }

  const toggleModulo = (key) => {
    if (soloLectura) return
    setPermisos(p => ({ ...p, [key]: !p[key] }))
  }

  const toggleSub = (modKey, sub) => {
    if (soloLectura) return
    const k = `${modKey}_${sub}`
    setPermisos(p => ({ ...p, [k]: !p[k] }))
  }

  const guardar = async () => {
    if (!rolActivo) return
    setGuardando(true)
    try {
      await setDoc(doc(db, 'roles', rolActivo.id), { ...rolActivo, permisos }, { merge: true })
      setMsg('✓ Permisos guardados')
      cargar()
    } catch {
      setMsg('Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const agregarRol = async () => {
    if (!nuevoRol.trim()) return
    await addDoc(collection(db, 'roles'), { nombre: nuevoRol.trim(), color: '#888', permisos: {} })
    setNuevoRol(''); cargar()
  }

  const eliminarRol = async (id) => {
    const rol = roles.find(r => r.id === id)
    if (rol?.nombre === 'Administrador' || rol?.nombre === 'Super Administrador') return
    await deleteDoc(doc(db, 'roles', id)); cargar()
  }

  const esRolAdmin = rolActivo?.nombre === 'Administrador' || rolActivo?.nombre === 'Super Administrador'

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 600 }}>

      {/* ── Lista de roles ── */}
      <div style={{ width: 200, background: '#fff', borderRight: '1px solid #d0d8d0', padding: '10px 0', flexShrink: 0 }}>
        <div style={{ fontSize: 9, color: '#8a9e8a', textTransform: 'uppercase', letterSpacing: '.7px', padding: '8px 14px 4px' }}>Roles</div>
        {roles.map(r => (
          <div key={r.id} onClick={() => seleccionarRol(r)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 14px', cursor: 'pointer', fontSize: 12,
            color: rolActivo?.id === r.id ? 'var(--eco-primary)' : '#1a1a1a',
            background: rolActivo?.id === r.id ? 'var(--eco-primary-light)' : 'transparent',
            borderLeft: `3px solid ${rolActivo?.id === r.id ? 'var(--eco-primary)' : 'transparent'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color || '#888' }} />
              {r.nombre}
            </div>
            {r.nombre !== 'Administrador' && r.nombre !== 'Super Administrador' && usuarioEsAdmin && (
              <button onClick={e => { e.stopPropagation(); eliminarRol(r.id) }} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 13, padding: 0,
              }}>×</button>
            )}
          </div>
        ))}

        <div style={{ padding: '10px 10px 0', borderTop: '1px solid #eee', marginTop: 8 }}>
          {usuarioEsAdmin ? (
            <>
              <input
                value={nuevoRol}
                onChange={e => setNuevoRol(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && agregarRol()}
                placeholder="Nuevo rol..."
                style={{ width: '100%', border: '1px solid #d0d8d0', borderRadius: 4, padding: '5px 8px', fontSize: 11, outline: 'none', boxSizing: 'border-box' }}
              />
              <button onClick={agregarRol} style={{
                width: '100%', marginTop: 5, background: 'var(--eco-primary)', color: '#fff',
                border: 'none', borderRadius: 4, padding: '5px', fontSize: 11, cursor: 'pointer',
              }}>+ Agregar</button>
            </>
          ) : (
            <p style={{ fontSize: 10, color: '#bbb', textAlign: 'center', margin: '8px 0 0', fontStyle: 'italic' }}>
              Solo admin puede crear roles
            </p>
          )}
        </div>
      </div>

      {/* ── Panel de permisos ── */}
      <div style={{ flex: 1, padding: 20, overflowY: 'auto', background: '#f4f6f4' }}>
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 500, color: '#1a1a1a', margin: 0 }}>
              Permisos — {rolActivo?.nombre}
            </h2>
            <p style={{ fontSize: 11, color: '#8a9e8a', marginTop: 2 }}>
              {esRolAdmin
                ? 'Este rol tiene acceso total a todo el sistema'
                : 'Configura qué puede ver y hacer este rol'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {msg && <span style={{ fontSize: 12, color: msg.startsWith('✓') ? 'var(--eco-primary)' : '#cc3333' }}>{msg}</span>}
            {!esRolAdmin && (
              <button
                onClick={guardar}
                disabled={guardando || soloLectura}
                style={{
                  background: soloLectura ? '#ccc' : 'var(--eco-primary)',
                  color: '#fff', border: 'none', borderRadius: 6,
                  padding: '7px 18px', fontSize: 12,
                  cursor: soloLectura ? 'not-allowed' : 'pointer', fontWeight: 500,
                }}
                title={soloLectura ? 'Solo el Administrador puede modificar permisos' : ''}
              >
                {guardando ? 'Guardando...' : 'Guardar permisos'}
              </button>
            )}
          </div>
        </div>

        {/* Banner solo lectura */}
        {soloLectura && !esRolAdmin && (
          <div style={{ background: '#FAEEDA', border: '0.5px solid #FAC775', borderRadius: 8, padding: '9px 14px', marginBottom: 12, fontSize: 12, color: '#854F0B', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🔒</span>
            <span>Solo el <strong>Administrador</strong> puede modificar los permisos de los roles. Estás en modo lectura.</span>
          </div>
        )}

        {/* Leyenda */}
        {!esRolAdmin && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 11, color: '#666' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#FEF3C7', border: '0.5px solid #FCA5A5', display: 'inline-block' }} />
              Acción crítica
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#EFF6FF', border: '0.5px solid #BFDBFE', display: 'inline-block' }} />
              Visibilidad
            </span>
          </div>
        )}

        {/* Reglas fijas */}
        {!esRolAdmin && (
          <div style={{ background: '#fff', border: '0.5px solid #d0d8d0', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 11, color: '#5c6b5c' }}>
            <div style={{ fontWeight: 600, marginBottom: 6, color: '#1a1a1a', fontSize: 11 }}>Reglas fijas del sistema (no editables):</div>
            <div>· Las facturas solo se pueden crear desde una cotización en estado <strong>Aceptada</strong>.</div>
            <div>· Una cotización genera solo una factura (admite pagos parciales).</div>
            <div>· Los estados Sin Pagar → Parcial → Pagada cambian automáticamente al registrar pagos.</div>
            <div>· Eliminar facturas siempre requiere el permiso <strong>"Eliminar factura"</strong> activo.</div>
            <div>· La pista de carreras es visible para todos (solo muestra % de avance, sin montos).</div>
          </div>
        )}

        {/* Contenido */}
        {esRolAdmin ? (
          <div style={{ background: '#fff', border: '1.5px solid var(--eco-primary-light)', borderRadius: 8, padding: 20, fontSize: 13, color: '#5c6b5c' }}>
            El rol <strong>{rolActivo?.nombre}</strong> tiene acceso completo a todos los módulos y configuraciones del sistema. No se puede restringir.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {MODULOS.map(mod => (
              <div key={mod.key} style={{ background: '#fff', border: '1.5px solid var(--eco-primary-light)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: mod.subs && permisos[mod.key] ? '1px solid #eee' : 'none' }}>
                  <input
                    type="checkbox"
                    checked={!!permisos[mod.key]}
                    onChange={() => toggleModulo(mod.key)}
                    style={{ accentColor: 'var(--eco-primary)', width: 14, height: 14, cursor: soloLectura ? 'not-allowed' : 'pointer' }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>{mod.label}</span>
                  {mod.subs && (
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: '#aaa' }}>
                      {mod.subs.filter(s => !!permisos[`${mod.key}_${s}`]).length}/{mod.subs.length} activos
                    </span>
                  )}
                </div>

                {mod.subs && permisos[mod.key] && (
                  <div style={{ padding: '8px 14px 12px 36px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {mod.subs.map(sub => {
                      const esCritico     = ACCIONES_CRITICAS.includes(sub)
                      const esVisibilidad = ACCIONES_VISIBILIDAD.includes(sub)
                      return (
                        <label key={sub} style={{
                          display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
                          cursor: soloLectura ? 'not-allowed' : 'pointer',
                          padding: '3px 8px', borderRadius: 6,
                          color: esCritico ? '#991B1B' : esVisibilidad ? '#1e40af' : '#5c6b5c',
                          background: esCritico ? '#FFF5F5' : esVisibilidad ? '#EFF6FF' : 'transparent',
                          border: esCritico ? '0.5px solid #FCA5A5' : esVisibilidad ? '0.5px solid #BFDBFE' : 'none',
                        }}>
                          <input
                            type="checkbox"
                            checked={!!permisos[`${mod.key}_${sub}`]}
                            onChange={() => toggleSub(mod.key, sub)}
                            disabled={soloLectura}
                            style={{
                              accentColor: esCritico ? '#991B1B' : esVisibilidad ? '#1e40af' : 'var(--eco-primary)',
                              cursor: soloLectura ? 'not-allowed' : 'pointer',
                            }}
                          />
                          {sub}
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}