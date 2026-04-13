/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: SolicitudesPage.jsx
 * Módulo:  Solicitudes (tab dentro de ChatWidget)
 * ============================================================
 */

import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  collection, addDoc, onSnapshot, updateDoc, doc,
  getDocs, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../../firebase/config'
import { useAuth } from '../../../context/AuthContext'
import { usePermisos } from '../../../hooks/usePermisos'
import { crearNotificacion } from '../../../services/notificaciones'

// ── Mapa de rutas → nombre de módulo ─────────────────────────────────────────
const MODULO_MAP = [
  ['/crm/lead',        'CRM – Ficha Lead'],
  ['/crm',            'CRM'],
  ['/chats',          'Chats WA'],
  ['/email',          'Correo'],
  ['/contactos',      'Contactos'],
  ['/empresas',       'Empresas'],
  ['/activos',        'Activos'],
  ['/ventas',         'Ventas'],
  ['/proyectos',      'Proyectos'],
  ['/inventario',     'Inventario'],
  ['/facturacion',    'Facturación'],
  ['/bancos',         'Bancos'],
  ['/finanzas',       'Finanzas'],
  ['/ordenes-trabajo','Órdenes de Trabajo'],
  ['/calendario',     'Calendario'],
  ['/compras',        'Compras'],
  ['/configuracion',  'Configuración'],
  ['/',               'Inicio'],
]

const PRIORIDAD_ORDEN = { Alta: 0, Media: 1, Baja: 2 }

const PRIORIDAD_ESTILOS = {
  Alta:  { bg: '#FCEBEB', color: '#A32D2D', border: '#f09595' },
  Media: { bg: '#FAEEDA', color: '#854F0B', border: '#f0c070' },
  Baja:  { bg: '#EAF3DE', color: '#3B6D11', border: '#b0d080' },
}

const ESTADO_ESTILOS = {
  pendiente:   { bg: '#FCEBEB', color: '#A32D2D', label: 'Pendiente' },
  resuelto:    { bg: '#EAF3DE', color: '#3B6D11', label: 'Resuelto' },
}

const ESTADO_SIGUIENTE = {
  pendiente:   'resuelto',
  resuelto:    'pendiente',
}

const tiempoRelativo = (ts) => {
  if (!ts) return ''
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1)  return 'ahora'
  if (min < 60) return `hace ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24)   return `hace ${h}h`
  return `hace ${Math.floor(h / 24)}d`
}

// ── Sección de comentarios ────────────────────────────────────────────────────
function Comentarios({ solId, usuario, creadoPor }) {
  const [comentarios, setComentarios] = useState([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const bottomRef = useRef()

  useEffect(() => {
    const q = query(collection(db, `solicitudes/${solId}/comentarios`), orderBy('creadoEn', 'asc'))
    return onSnapshot(q, snap => {
      setComentarios(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    })
  }, [solId])

  const enviar = async () => {
    if (!texto.trim() || enviando) return
    setEnviando(true)
    try {
      await addDoc(collection(db, `solicitudes/${solId}/comentarios`), {
        texto: texto.trim(),
        autorId: usuario.uid,
        autorNombre: usuario.nombre || usuario.email,
        creadoEn: serverTimestamp(),
      })
      // Notificar al otro (si soy el creador notifico al admin, si soy admin notifico al creador)
      const destinatarioId = usuario.uid === creadoPor ? null : creadoPor
      if (destinatarioId) {
        crearNotificacion({
          destinatarioId,
          tipo: 'general',
          titulo: '💬 Nuevo comentario en solicitud',
          cuerpo: `${usuario.nombre || usuario.email}: "${texto.trim().slice(0, 80)}${texto.trim().length > 80 ? '...' : ''}"`,
          link: '/',
        }).catch(() => {})
      }
      setTexto('')
    } catch (e) { console.error(e) }
    finally { setEnviando(false) }
  }

  return (
    <div style={{ borderTop: '0.5px solid #eee', marginTop: 6, paddingTop: 6 }}>
      {comentarios.length > 0 && (
        <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
          {comentarios.map(c => {
            const esMio = c.autorId === usuario.uid
            return (
              <div key={c.id} style={{ display: 'flex', flexDirection: 'column', alignItems: esMio ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '85%', padding: '5px 9px', borderRadius: esMio ? '8px 8px 2px 8px' : '8px 8px 8px 2px', background: esMio ? '#E6F1FB' : '#f5f5f5', fontSize: 11, color: '#1a1a1a', lineHeight: 1.4 }}>
                  {!esMio && <div style={{ fontSize: 9, fontWeight: 600, color: '#185FA5', marginBottom: 2 }}>{c.autorNombre}</div>}
                  {c.texto}
                </div>
                <span style={{ fontSize: 8, color: '#bbb', marginTop: 1 }}>{tiempoRelativo(c.creadoEn)}</span>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          value={texto} onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
          placeholder="Escribe un comentario..."
          style={{ flex: 1, padding: '5px 8px', border: '0.5px solid #ddd', borderRadius: 6, fontSize: 11, outline: 'none', fontFamily: 'inherit' }}
        />
        <button onClick={enviar} disabled={!texto.trim() || enviando} style={{ padding: '5px 10px', border: 'none', borderRadius: 6, background: !texto.trim() ? '#e0e0e0' : 'var(--eco-primary, #185FA5)', color: !texto.trim() ? '#aaa' : '#fff', fontSize: 10, fontWeight: 600, cursor: !texto.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {enviando ? '...' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}

// ── Tarjeta de solicitud ──────────────────────────────────────────────────────
function TarjetaSolicitud({ sol, onCambiarEstado, usuario }) {
  const pr  = PRIORIDAD_ESTILOS[sol.prioridad] || PRIORIDAD_ESTILOS.Media
  const est = ESTADO_ESTILOS[sol.estado]       || ESTADO_ESTILOS.pendiente
  const [imgAbierta, setImgAbierta] = useState(false)
  const [showComentarios, setShowComentarios] = useState(false)
  const [numComentarios, setNumComentarios] = useState(0)

  useEffect(() => {
    return onSnapshot(collection(db, `solicitudes/${sol.id}/comentarios`), snap => setNumComentarios(snap.size))
  }, [sol.id])

  return (
    <div style={{
      background: '#fff', border: '0.5px solid #e8e8e8',
      borderRadius: 10, padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: 7,
    }}>
      {/* Badges superiores */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
          background: sol.tipo === 'Bug' ? '#FCEBEB' : '#EEEDFE',
          color:      sol.tipo === 'Bug' ? '#A32D2D' : '#534AB7',
          border: `0.5px solid ${sol.tipo === 'Bug' ? '#f09595' : '#c4b5fd'}`,
        }}>
          {sol.tipo === 'Bug' ? '🐛 Bug' : '✨ Mejora'}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
          background: pr.bg, color: pr.color, border: `0.5px solid ${pr.border}`,
        }}>
          {sol.prioridad}
        </span>
        <span style={{ fontSize: 10, color: '#bbb', marginLeft: 'auto' }}>
          {tiempoRelativo(sol.creadoEn)}
        </span>
      </div>

      {/* Descripción */}
      <div style={{ fontSize: 12, color: '#1a1a1a', lineHeight: 1.5 }}>
        {sol.descripcion}
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: '#aaa', display: 'flex', alignItems: 'center', gap: 3 }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          {sol.modulo}
        </span>
        <span style={{ fontSize: 10, color: '#aaa', display: 'flex', alignItems: 'center', gap: 3 }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          {sol.creadoPorNombre}
        </span>
      </div>

      {/* Imagen miniatura */}
      {sol.imagen && (
        <>
          <div onClick={() => setImgAbierta(true)} style={{ borderRadius: 7, overflow: 'hidden', cursor: 'pointer', maxHeight: 80, border: '0.5px solid #e0e0e0' }}>
            <img src={sol.imagen} alt="ref" style={{ width: '100%', objectFit: 'cover', display: 'block', maxHeight: 80 }} />
          </div>
          {imgAbierta && (
            <div onClick={() => setImgAbierta(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 10020, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <img src={sol.imagen} alt="ref" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,.4)' }} />
            </div>
          )}
        </>
      )}

      {/* Estado + Comentarios */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => setShowComentarios(s => !s)}
          style={{ fontSize: 10, fontWeight: 500, padding: '3px 10px', borderRadius: 20, background: showComentarios ? '#E6F1FB' : '#f5f5f5', color: showComentarios ? '#185FA5' : '#888', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          💬 {numComentarios > 0 ? numComentarios : ''} {showComentarios ? 'Ocultar' : 'Comentarios'}
        </button>
        <button
          onClick={() => onCambiarEstado(sol, ESTADO_SIGUIENTE[sol.estado])}
          style={{
            fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
            background: est.bg, color: est.color, border: `0.5px solid ${est.color}40`,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {est.label} →
        </button>
      </div>

      {showComentarios && <Comentarios solId={sol.id} usuario={usuario} creadoPor={sol.creadoPor} />}
    </div>
  )
}

// ── Modal de resolución ───────────────────────────────────────────────────────
function ModalResolver({ solicitud, todosUsuarios, usuariosNotif, setUsuariosNotif, onConfirmar, onCerrar, resolviendo }) {
  return (
    <div
      onClick={e => e.target === e.currentTarget && onCerrar()}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)',
        zIndex: 10015, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{ background: '#fff', borderRadius: 14, width: '95%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,.2)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: 'var(--eco-primary, #185FA5)', padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>✅ Marcar como resuelto</div>
            <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 11, marginTop: 2 }}>Elegí a quién notificar</div>
          </div>
          <button onClick={onCerrar} style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 7, width: 28, height: 28, color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Resumen solicitud */}
        <div style={{ padding: '10px 14px', background: '#f8f9fa', borderBottom: '0.5px solid #eee' }}>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 3 }}>Solicitud a resolver:</div>
          <div style={{ fontSize: 12, color: '#1a1a1a', lineHeight: 1.4 }}>
            {solicitud.descripcion?.slice(0, 90)}{solicitud.descripcion?.length > 90 ? '...' : ''}
          </div>
        </div>

        {/* Lista de usuarios */}
        <div style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#444', marginBottom: 8 }}>
            Usuarios a notificar ({usuariosNotif.length})
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {todosUsuarios.map(u => (
              <label key={u.uid} style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
                background: usuariosNotif.includes(u.uid) ? '#E6F1FB' : '#fafafa',
                border: `0.5px solid ${usuariosNotif.includes(u.uid) ? '#93C5FD' : '#e8e8e8'}`,
                transition: 'all .1s',
              }}>
                <input
                  type="checkbox"
                  checked={usuariosNotif.includes(u.uid)}
                  onChange={() => setUsuariosNotif(prev => prev.includes(u.uid) ? prev.filter(x => x !== u.uid) : [...prev, u.uid])}
                  style={{ accentColor: 'var(--eco-primary, #185FA5)', width: 14, height: 14, cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>{u.nombre || u.email}</div>
                  <div style={{ fontSize: 10, color: '#aaa' }}>{u.rol}</div>
                </div>
                {u.uid === solicitud.creadoPor && (
                  <span style={{ fontSize: 9, background: '#E6F1FB', color: '#185FA5', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>Reportó</span>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Acciones */}
        <div style={{ padding: '10px 14px', borderTop: '0.5px solid #eee', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCerrar} style={{ padding: '7px 14px', borderRadius: 8, border: '0.5px solid #d0d0d0', background: '#fff', color: '#555', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={resolviendo}
            style={{
              padding: '7px 16px', borderRadius: 8, border: 'none',
              background: resolviendo ? '#e0e0e0' : 'var(--eco-primary, #185FA5)',
              color: resolviendo ? '#aaa' : '#fff',
              fontSize: 12, fontWeight: 600, cursor: resolviendo ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {resolviendo ? 'Guardando...' : `Resolver${usuariosNotif.length > 0 ? ` y notificar (${usuariosNotif.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tab de Solicitudes (se renderiza dentro de ChatWidget) ────────────────────
export function TabSolicitudes({ onPendientesChange }) {
  const { usuario }  = useAuth()
  const { rol }      = usePermisos()
  const location     = useLocation()
  const esSuperAdmin = rol === 'Super Administrador'
  const fileRef      = useRef()

  // Vista interna: 'form' | 'lista'
  const [vista, setVista] = useState(esSuperAdmin ? 'lista' : 'form')

  // ── Form state
  const [tipo,          setTipo]          = useState(null)
  const [descripcion,   setDescripcion]   = useState('')
  const [prioridad,     setPrioridad]     = useState('Media')
  const [imagen,        setImagen]        = useState(null)
  const [imagenPreview, setImagenPreview] = useState(null)
  const [enviando,      setEnviando]      = useState(false)
  const [enviado,       setEnviado]       = useState(false)
  const [error,         setError]         = useState(null)
  const [similares,     setSimilares]     = useState([])
  const [buscando,      setBuscando]      = useState(false)

  // ── SuperAdmin state
  const [solicitudes,     setSolicitudes]     = useState([])
  const [modalResuelto,   setModalResuelto]   = useState(null)
  const [todosUsuarios,   setTodosUsuarios]   = useState([])
  const [usuariosNotif,   setUsuariosNotif]   = useState([])
  const [resolviendo,     setResolviendo]     = useState(false)
  const [filtroPrioridad, setFiltroPrioridad] = useState('todas')
  const [filtroEstado,    setFiltroEstado]    = useState('activas')

  // ── Detectar módulo actual
  const moduloActual = (() => {
    const path = location.pathname
    for (const [key, val] of MODULO_MAP) {
      if (path.startsWith(key)) return val
    }
    return 'General'
  })()

  // ── Suscribirse a solicitudes (SuperAdmin ve todas)
  useEffect(() => {
    if (!esSuperAdmin) return
    const q = query(collection(db, 'solicitudes'), orderBy('creadoEn', 'desc'))
    return onSnapshot(q, snap => {
      setSolicitudes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [esSuperAdmin])

  // ── Notificar al padre cuántas están pendientes (para el badge del tab)
  useEffect(() => {
    const n = solicitudes.filter(s => s.estado === 'pendiente').length
    onPendientesChange?.(n)
  }, [solicitudes, onPendientesChange])

  // ── Cargar usuarios para modal
  useEffect(() => {
    if (!esSuperAdmin) return
    getDocs(collection(db, 'usuarios')).then(snap => {
      setTodosUsuarios(snap.docs.map(d => ({ uid: d.id, ...d.data() })))
    })
  }, [esSuperAdmin])

  // ── Buscar similares con debounce
  useEffect(() => {
    if (!descripcion || descripcion.length < 10) { setSimilares([]); return }
    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        const snap  = await getDocs(collection(db, 'solicitudes'))
        const todas = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        const palabras = descripcion.toLowerCase().split(/\s+/).filter(p => p.length > 4)
        setSimilares(
          todas
            .filter(s => s.estado !== 'resuelto')
            .filter(s => palabras.some(p => (s.descripcion || '').toLowerCase().includes(p)))
            .slice(0, 3)
        )
      } catch {}
      setBuscando(false)
    }, 600)
    return () => clearTimeout(t)
  }, [descripcion])

  const handleImagen = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImagen(file)
    const reader = new FileReader()
    reader.onload = ev => setImagenPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) return
        setImagen(file)
        const reader = new FileReader()
        reader.onload = ev => setImagenPreview(ev.target.result)
        reader.readAsDataURL(file)
        return
      }
    }
  }

  const resetForm = () => {
    setTipo(null); setDescripcion(''); setPrioridad('Media')
    setImagen(null); setImagenPreview(null)
    setError(null); setSimilares([])
  }

  const enviar = async () => {
    setError(null)
    if (!tipo)              { setError('Elegí si es un Bug o una Mejora'); return }
    if (!descripcion.trim()){ setError('La descripción es obligatoria'); return }
    if (tipo === 'Bug' && !imagen) { setError('Para un bug necesitás adjuntar una imagen'); return }
    setEnviando(true)
    try {
      let imagenUrl = ''
      if (imagen) {
        const sRef = storageRef(storage, `solicitudes/${Date.now()}_${imagen.name}`)
        const snap = await uploadBytes(sRef, imagen)
        imagenUrl  = await getDownloadURL(snap.ref)
      }
      await addDoc(collection(db, 'solicitudes'), {
        tipo,
        descripcion:     descripcion.trim(),
        imagen:          imagenUrl,
        prioridad,
        modulo:          moduloActual,
        creadoPor:       usuario.uid,
        creadoPorNombre: usuario.nombre || usuario.email,
        estado:          'pendiente',
        creadoEn:        serverTimestamp(),
        resueltoPor:     null,
        resueltaEn:      null,
      })
      setEnviado(true)
      setTimeout(() => { setEnviado(false); resetForm() }, 2500)
    } catch {
      setError('Error al enviar. Intentá de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  const cambiarEstado = (sol, nuevoEstado) => {
    if (nuevoEstado === 'resuelto') {
      setModalResuelto({ id: sol.id, sol })
      setUsuariosNotif(sol.creadoPor ? [sol.creadoPor] : [])
      return
    }
    updateDoc(doc(db, 'solicitudes', sol.id), { estado: nuevoEstado })
  }

  const resolverConNotificaciones = async () => {
    if (!modalResuelto) return
    setResolviendo(true)
    try {
      await updateDoc(doc(db, 'solicitudes', modalResuelto.id), {
        estado: 'resuelto', resueltoPor: usuario.uid, resueltaEn: serverTimestamp(),
      })
      await Promise.all(usuariosNotif.map(uid => crearNotificacion({
        destinatarioId: uid,
        tipo:   'general',
        titulo: `✅ Solicitud resuelta — ${modalResuelto.sol.tipo}`,
        cuerpo: `"${modalResuelto.sol.descripcion.slice(0, 80)}${modalResuelto.sol.descripcion.length > 80 ? '...' : ''}" fue marcado como resuelto. ¡Probalo!`,
        link:   '/',
      })))
      setModalResuelto(null); setUsuariosNotif([])
    } catch {}
    setResolviendo(false)
  }

  const solicitudesFiltradas = solicitudes
    .filter(s => filtroEstado === 'activas' ? s.estado !== 'resuelto' : true)
    .filter(s => filtroPrioridad === 'todas' || s.prioridad === filtroPrioridad)
    .sort((a, b) => (PRIORIDAD_ORDEN[a.prioridad] ?? 1) - (PRIORIDAD_ORDEN[b.prioridad] ?? 1))

  const pendientes = solicitudes.filter(s => s.estado === 'pendiente').length

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Barra de vista (solo SuperAdmin) ── */}
      {esSuperAdmin && (
        <div style={{
          padding: '8px 12px', borderBottom: '0.5px solid #eee',
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
          background: '#fafafa',
        }}>
          <button
            onClick={() => setVista('lista')}
            style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 11, fontFamily: 'inherit',
              border: '0.5px solid',
              borderColor: vista === 'lista' ? 'var(--eco-primary, #185FA5)' : '#e0e0e0',
              background:  vista === 'lista' ? '#E6F1FB' : '#fff',
              color:       vista === 'lista' ? 'var(--eco-primary, #185FA5)' : '#666',
              fontWeight:  vista === 'lista' ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            Lista {pendientes > 0 && <span style={{ background: '#A32D2D', color: '#fff', borderRadius: 10, padding: '0 5px', fontSize: 9, fontWeight: 700, marginLeft: 4 }}>{pendientes}</span>}
          </button>
          <button
            onClick={() => { setVista('form'); resetForm() }}
            style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 11, fontFamily: 'inherit',
              border: '0.5px solid',
              borderColor: vista === 'form' ? 'var(--eco-primary, #185FA5)' : '#e0e0e0',
              background:  vista === 'form' ? '#E6F1FB' : '#fff',
              color:       vista === 'form' ? 'var(--eco-primary, #185FA5)' : '#666',
              fontWeight:  vista === 'form' ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            + Nueva
          </button>
        </div>
      )}

      {/* ════ FORMULARIO ════ */}
      {vista === 'form' && (
        <div onPaste={handlePaste} style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Enviado OK */}
          {enviado && (
            <div style={{ textAlign: 'center', padding: '36px 16px' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>¡Reporte enviado!</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 6, lineHeight: 1.5 }}>
                El equipo lo revisará pronto.<br/>Te notificamos cuando esté resuelto.
              </div>
            </div>
          )}

          {!enviado && (
            <>
              {/* Selector tipo */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 8 }}>¿Qué querés reportar? *</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { id: 'Bug',    emoji: '🐛', desc: 'Algo está roto o no funciona' },
                    { id: 'Mejora', emoji: '✨', desc: 'Una idea o función nueva' },
                  ].map(t => (
                    <button key={t.id} onClick={() => setTipo(t.id)} style={{
                      padding: '10px 6px', borderRadius: 10,
                      border: `1.5px solid ${tipo === t.id ? 'var(--eco-primary, #185FA5)' : '#e0e0e0'}`,
                      background: tipo === t.id ? '#E6F1FB' : '#fafafa',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      fontFamily: 'inherit', transition: 'all .12s',
                    }}>
                      <span style={{ fontSize: 22 }}>{t.emoji}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: tipo === t.id ? 'var(--eco-primary, #185FA5)' : '#555' }}>{t.id}</span>
                      <span style={{ fontSize: 10, color: '#999', textAlign: 'center', lineHeight: 1.3 }}>{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {tipo && (
                <>
                  {/* Descripción */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#555' }}>Descripción *</span>
                      <span style={{ fontSize: 10, color: descripcion.length > 180 ? '#A32D2D' : '#bbb' }}>{descripcion.length}/200</span>
                    </div>
                    <textarea
                      value={descripcion}
                      onChange={e => e.target.value.length <= 200 && setDescripcion(e.target.value)}
                      placeholder={tipo === 'Bug' ? 'Describí qué pasó y cómo reproducirlo...' : 'Describí la mejora que querés ver...'}
                      rows={3}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        padding: '8px 10px', border: '0.5px solid #d0d8d0', borderRadius: 8,
                        fontSize: 12, outline: 'none', resize: 'none',
                        fontFamily: 'inherit', background: '#fff', color: '#1a1a1a', lineHeight: 1.45,
                      }}
                    />
                  </div>

                  {/* Similares */}
                  {buscando && (
                    <div style={{ fontSize: 11, color: '#aaa', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 9, height: 9, borderRadius: '50%', border: '1.5px solid #ccc', borderTopColor: 'transparent', animation: 'spin .7s linear infinite', flexShrink: 0 }} />
                      Buscando reportes similares...
                    </div>
                  )}
                  {!buscando && similares.length > 0 && (
                    <div style={{ background: '#FAEEDA', border: '0.5px solid #f0c070', borderRadius: 9, padding: '9px 11px' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#854F0B', marginBottom: 6 }}>⚠️ Ya existe algo parecido</div>
                      {similares.map(s => (
                        <div key={s.id} style={{ fontSize: 11, color: '#5a3800', marginBottom: 4, paddingLeft: 8, borderLeft: '2px solid #f0c070', lineHeight: 1.4 }}>
                          <span style={{ fontWeight: 600 }}>{s.tipo}</span> · {s.descripcion?.slice(0, 50)}{s.descripcion?.length > 50 ? '...' : ''}
                          <span style={{ marginLeft: 5, fontSize: 10, color: ESTADO_ESTILOS[s.estado]?.color }}>[{ESTADO_ESTILOS[s.estado]?.label}]</span>
                        </div>
                      ))}
                      <div style={{ fontSize: 10, color: '#854F0B', marginTop: 5 }}>¿Es distinto? Podés enviarlo igual.</div>
                    </div>
                  )}

                  {/* Prioridad */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 6 }}>Prioridad</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['Alta', 'Media', 'Baja'].map(p => {
                        const pr = PRIORIDAD_ESTILOS[p]
                        return (
                          <button key={p} onClick={() => setPrioridad(p)} style={{
                            flex: 1, padding: '6px 4px', borderRadius: 8,
                            border: `1.5px solid ${prioridad === p ? pr.border : '#e0e0e0'}`,
                            background: prioridad === p ? pr.bg : '#fafafa',
                            color: prioridad === p ? pr.color : '#777',
                            fontWeight: prioridad === p ? 700 : 400,
                            fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .12s',
                          }}>{p}</button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Imagen */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 5 }}>
                      Imagen {tipo === 'Bug' ? <span style={{ color: '#A32D2D' }}>*</span> : <span style={{ color: '#bbb', fontWeight: 400 }}>(opcional)</span>}
                    </div>
                    {!imagenPreview ? (
                      <div
                        onClick={() => fileRef.current?.click()}
                        style={{
                          border: '1.5px dashed #d0d8d0', borderRadius: 9, padding: '16px 12px',
                          textAlign: 'center', cursor: 'pointer', background: '#fafafa',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f0f4f8'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fafafa'}
                      >
                        <div style={{ fontSize: 22, marginBottom: 5 }}>🖼️</div>
                        <div style={{ fontSize: 11, color: '#999' }}>Clic para subir o <strong>Ctrl+V</strong> para pegar</div>
                        <div style={{ fontSize: 10, color: '#ccc', marginTop: 2 }}>PNG, JPG, GIF — máx. 5 MB</div>
                      </div>
                    ) : (
                      <div style={{ position: 'relative', borderRadius: 9, overflow: 'hidden', border: '0.5px solid #d0d8d0' }}>
                        <img src={imagenPreview} alt="preview" style={{ width: '100%', display: 'block', maxHeight: 140, objectFit: 'cover' }} />
                        <button onClick={() => { setImagen(null); setImagenPreview(null) }}
                          style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,.55)', border: 'none', borderRadius: 5, color: '#fff', width: 22, height: 22, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                      </div>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleImagen} style={{ display: 'none' }} />
                  </div>

                  {/* Error */}
                  {error && (
                    <div style={{ padding: '9px 11px', background: '#FCEBEB', borderRadius: 9, color: '#A32D2D', fontSize: 11, border: '0.5px solid #f09595' }}>
                      ⚠️ {error}
                    </div>
                  )}

                  {/* Info módulo */}
                  <div style={{ fontSize: 10, color: '#bbb', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    Módulo: <strong style={{ color: '#999' }}>{moduloActual}</strong>
                  </div>

                  {/* Enviar */}
                  <button
                    onClick={enviar}
                    disabled={enviando}
                    style={{
                      padding: '9px', borderRadius: 9, border: 'none',
                      background: enviando ? '#e0e0e0' : 'var(--eco-primary, #185FA5)',
                      color: enviando ? '#aaa' : '#fff',
                      fontSize: 12, fontWeight: 600, cursor: enviando ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', width: '100%',
                    }}
                  >
                    {enviando ? 'Enviando...' : `Enviar ${tipo === 'Bug' ? 'bug' : 'mejora'}`}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ════ LISTA (SuperAdmin) ════ */}
      {vista === 'lista' && esSuperAdmin && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Filtros */}
          <div style={{ padding: '7px 10px', borderBottom: '0.5px solid #eee', display: 'flex', gap: 5, flexWrap: 'wrap', flexShrink: 0 }}>
            <button onClick={() => setFiltroEstado(filtroEstado === 'activas' ? 'todas' : 'activas')}
              style={{
                padding: '3px 9px', borderRadius: 20, fontSize: 10, fontFamily: 'inherit', cursor: 'pointer',
                border: '0.5px solid', fontWeight: filtroEstado === 'activas' ? 600 : 400,
                borderColor: filtroEstado === 'activas' ? 'var(--eco-primary, #185FA5)' : '#e0e0e0',
                background:  filtroEstado === 'activas' ? '#E6F1FB' : '#fafafa',
                color:       filtroEstado === 'activas' ? 'var(--eco-primary, #185FA5)' : '#777',
              }}>
              {filtroEstado === 'activas' ? 'Solo activas' : 'Todas'}
            </button>
            {['todas', 'Alta', 'Media', 'Baja'].map(f => (
              <button key={f} onClick={() => setFiltroPrioridad(f)}
                style={{
                  padding: '3px 9px', borderRadius: 20, fontSize: 10, fontFamily: 'inherit', cursor: 'pointer',
                  border: '0.5px solid', fontWeight: filtroPrioridad === f ? 600 : 400,
                  borderColor: filtroPrioridad === f ? (f === 'todas' ? 'var(--eco-primary, #185FA5)' : PRIORIDAD_ESTILOS[f]?.border || '#e0e0e0') : '#e0e0e0',
                  background:  filtroPrioridad === f ? (f === 'todas' ? '#E6F1FB' : PRIORIDAD_ESTILOS[f]?.bg || '#fafafa') : '#fafafa',
                  color:       filtroPrioridad === f ? (f === 'todas' ? 'var(--eco-primary, #185FA5)' : PRIORIDAD_ESTILOS[f]?.color || '#555') : '#777',
                }}>
                {f === 'todas' ? 'Todas' : f}
              </button>
            ))}
          </div>

          {/* Tarjetas */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
            {solicitudesFiltradas.length === 0 && (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: '#ccc', fontSize: 12 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
                {filtroEstado === 'activas' ? 'Sin solicitudes activas' : 'Sin solicitudes'}
              </div>
            )}
            {solicitudesFiltradas.map(sol => (
              <TarjetaSolicitud key={sol.id} sol={sol} onCambiarEstado={cambiarEstado} usuario={usuario} />
            ))}
          </div>
        </div>
      )}

      {/* Modal resolución */}
      {modalResuelto && (
        <ModalResolver
          solicitud={modalResuelto.sol}
          todosUsuarios={todosUsuarios}
          usuariosNotif={usuariosNotif}
          setUsuariosNotif={setUsuariosNotif}
          onConfirmar={resolverConNotificaciones}
          onCerrar={() => setModalResuelto(null)}
          resolviendo={resolviendo}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export default TabSolicitudes
