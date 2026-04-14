/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: ChatsPage.jsx
 * Módulo:  CRM — Chats WhatsApp + Internos
 * ============================================================
 */

import { useEffect, useState, useRef } from 'react'
import { collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDocs, where, getDoc } from 'firebase/firestore'
import { db } from '../../../firebase/config'
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useAuth } from '../../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import ModalNudge from './ModalNudge'
import TabResumenIA from './chats/TabResumenIA'
import ModalNuevoGrupo from './chats/ModalNuevoGrupo'
import { Avatar, EtapaBadge, SectionLabel, Divider, sel } from './chats/ChatComponents'
import { formatFecha, colorFromString } from './chats/helpers'
import { crearNotificacion } from '../../../services/notificaciones'
import UserAvatar from '../../../shared/components/UserAvatar'
import { WASENDER_URL, WASENDER_TOKEN, NUDGE_IMG_URL, ETIQUETAS, ORIGENES, ROLES_SUPERVISOR, ROLES_RESUMEN_IA } from './chats/constants'

function IndicadorLectura({ chatId, miembros, gruposInternos, usuarios, usuarioActualUid, mensajes }) {
  const chatData = gruposInternos.find(g => g.id === chatId)
  const otros = (miembros || []).filter(uid => uid !== usuarioActualUid)
  if (otros.length === 0) return null

  // Buscar si mis mensajes fueron leídos: el otro respondió después de mi último mensaje, o tiene ultimaLectura
  const misMensajes = mensajes.filter(m => m.autorId === usuarioActualUid)
  if (misMensajes.length === 0) return null

  const ultimoMio = misMensajes[misMensajes.length - 1]
  const toMs = (ts) => { if (!ts) return 0; if (ts.toMillis) return ts.toMillis(); if (ts.toDate) return ts.toDate().getTime(); if (ts.seconds) return ts.seconds * 1000; return 0 }
  const ultimoMioMs = toMs(ultimoMio?.timestamp)

  // Verificar si algún otro respondió después de mi último mensaje
  const otroRespondio = mensajes.some(m => m.autorId !== usuarioActualUid && toMs(m.timestamp) > ultimoMioMs)

  // O si tiene ultimaLectura posterior a mi último mensaje
  const otroLeyoPorLectura = chatData && otros.some(uid => {
    const lecMs = toMs(chatData.ultimaLectura?.[uid])
    return lecMs > 0 && lecMs >= ultimoMioMs
  })

  const leido = otroRespondio || otroLeyoPorLectura

  return (
    <div style={{ padding: '4px 16px', background: leido ? '#E1F5EE' : '#FFF8E1', borderBottom: '1px solid #e0e7ef', fontSize: 11, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, color: leido ? '#0F6E56' : '#854F0B', fontWeight: 500 }}>
      {leido ? '✓✓ Chat leído' : '◷ Chat no leído'}
    </div>
  )
}

export default function ChatsPage() {
  const { usuario, currentUser } = useAuth()
  const navigate = useNavigate()
  const usuarioActual = usuario || currentUser

  const [conversaciones,  setConversaciones]  = useState([])
  const [gruposInternos,  setGruposInternos]  = useState([])
  const [chatActivo,      setChatActivo]       = useState(null)
  const [contactoCRM,    setContactoCRM]      = useState(null)
  const [loadingContacto, setLoadingContacto] = useState(false)
  const [leadsCRM,       setLeadsCRM]         = useState([])
  const [modalLead,      setModalLead]        = useState(null) // null | 'tipo' | 'factura' | 'nombre'
  const [nuevoLead,      setNuevoLead]        = useState({})
  const [tareas,          setTareas]           = useState([])
  const [modalTarea,      setModalTarea]       = useState(false)
  const [filtroTareas,    setFiltroTareas]     = useState('pendientes')
  const [tipoActivo,      setTipoActivo]       = useState('wa')
  const [mensajes,        setMensajes]         = useState([])
  const [mensaje,         setMensaje]          = useState('')
  const [enviando,        setEnviando]         = useState(false)
  const [usuarios,        setUsuarios]         = useState([])
  const [columnsPipeline, setColumnsPipeline]  = useState([])
  const [modalRecordatorio, setModalRecordatorio] = useState(false)
  const [formRecordatorio, setFormRecordatorio] = useState({ titulo:'', descripcion:'', fecha:'', hora:'', tipo:'', repetir:'una_vez' })
  const [tiposRecordatorio, setTiposRecordatorio] = useState([])
  const [guardandoRec, setGuardandoRec] = useState(false)
  const [mostrarArchivadas, setMostrarArchivadas] = useState(false)
  const [tabActiva,       setTabActiva]        = useState('mensaje')
  const [filtroLista,     setFiltroLista]      = useState('todos')
  const [busqueda,        setBusqueda]         = useState('')
  const [filtroAgente,    setFiltroAgente]     = useState('todos')
  const [filtroEtapa,     setFiltroEtapa]      = useState('')
  const [filtroEtiqueta,  setFiltroEtiqueta]   = useState('')
  const [verSoloMisChats, setVerSoloMisChats]  = useState(false)
  const [showNuevoGrupo,  setShowNuevoGrupo]   = useState(false)
  const [showNuevoChat,   setShowNuevoChat]    = useState(false)
  const [filtroNoLeidos,  setFiltroNoLeidos]   = useState('todos')
  const [nuevoNumero,     setNuevoNumero]      = useState('')
  const [nudgeActivo,     setNudgeActivo]      = useState(null)
  const [grabando,        setGrabando]         = useState(false)
  const [mediaRecorder,   setMediaRecorder]    = useState(null)
  const [showStickers,    setShowStickers]     = useState(false)
  const [stickers,        setStickers]         = useState([])
  const [imagenPegada,    setImagenPegada]     = useState(null)
  const [imagenModal,     setImagenModal]      = useState(null)
  const [showPlantillas,  setShowPlantillas]   = useState(false)
  const [plantillasWA,    setPlantillasWA]     = useState([])
  const [busqPlantilla,   setBusqPlantilla]    = useState('')
  const [showScrollBtn,   setShowScrollBtn]    = useState(false)
  const [fechaUltimo,     setFechaUltimo]      = useState('')
  const [respondiendo,    setRespondiendo]     = useState(null)
  const [reenviando,      setReenviando]       = useState(null)
  const [showReenviar,    setShowReenviar]     = useState(false)

  const nudgeChatNombre = useRef('')
  const nudgeVisto      = useRef(new Set())
  const mensajesRef     = useRef(null)
  const inputRef        = useRef(null)
  const unsubMsgs       = useRef(null)
  const archivoRef      = useRef(null)

  const esSupervisor = ROLES_SUPERVISOR.includes(usuarioActual?.rol)
  const puedeVerIA   = ROLES_RESUMEN_IA.includes(usuarioActual?.rol)

  const tabsWA = [
    { key: 'mensaje', label: 'Mensaje' },
    { key: 'interno', label: 'Nota interna' },
    ...(puedeVerIA ? [{ key: 'resumen', label: '🤖 Resumen IA' }] : []),
  ]
  const tabsInterno = [
    { key: 'mensaje', label: 'Mensaje' },
    ...(puedeVerIA ? [{ key: 'resumen', label: '🤖 Resumen IA' }] : []),
  ]
  const tabsActuales = tipoActivo === 'wa' ? tabsWA : tabsInterno

  useEffect(() => {
    return onSnapshot(collection(db, 'usuarios'), snap => setUsuarios(snap.docs.map(d => ({ uid: d.id, ...d.data() }))))
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'pipeline_columnas'), orderBy('orden'))
    return onSnapshot(q, snap => setColumnsPipeline(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [])

  useEffect(() => {
    getDocs(collection(db, 'catalogo_tipos_recordatorio')).then(snap => {
      setTiposRecordatorio(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }).catch(() => {})
  }, [])

  // Etapas dinámicas derivadas de pipeline_columnas
  const ETAPAS_PIPELINE = [
    { valor: '', label: 'Todas las etapas' },
    ...columnsPipeline.map(c => ({ valor: c.id, label: c.nombre })),
  ]
  const ETAPAS_LEAD_ACTIVO = columnsPipeline.filter(c => c.nombre !== 'Ganado' && c.nombre !== 'Perdido').map(c => ({ valor: c.id, label: c.nombre }))
  const ETAPA_CONFIG_DYN = Object.fromEntries(columnsPipeline.map(c => [c.id, { label: c.nombre, color: c.color, bg: c.color + '18' }]))

  useEffect(() => {
    const q = query(collection(db, 'conversaciones'), orderBy('timestamp', 'desc'))
    return onSnapshot(q, snap => setConversaciones(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [])

  useEffect(() => {
    if (!usuarioActual?.uid) return
    const q = query(collection(db, 'chats_internos'), where('miembros', 'array-contains', usuarioActual.uid))
    return onSnapshot(q, snap => setGruposInternos(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [usuarioActual?.uid])

  useEffect(() => {
    if (unsubMsgs.current) { unsubMsgs.current(); unsubMsgs.current = null }
    if (!chatActivo) { setMensajes([]); return }
    const col = tipoActivo === 'wa' ? `conversaciones/${chatActivo.id}/mensajes` : `chats_internos/${chatActivo.id}/mensajes`
    const q = query(collection(db, col), orderBy('timestamp', 'asc'))
    unsubMsgs.current = onSnapshot(q, async snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setMensajes(msgs)
      setTimeout(() => { if (mensajesRef.current) mensajesRef.current.scrollTop = mensajesRef.current.scrollHeight }, 50)
      // Procesar media de WhatsApp sin desencriptar
      if (tipoActivo === 'wa') {
        for (const msg of msgs) {
          if (msg.mediaProcesado) continue
          if (!msg.msgRaw) continue
          const tipoMedia = msg.tipo || msg.type || ''
          if (!['image','imagen','audio','video','sticker'].includes(tipoMedia)) continue
          if (msg.mediaUrl && !msg.mediaUrl.includes('mmg.whatsapp.net')) continue
          // Desencriptar y subir a Storage
          try {
            const { decryptMedia } = await import('../../../services/wasenderService')
            const result = await decryptMedia(msg.msgRaw)
            if (result?.data) {
              const base64 = typeof result.data === 'string' ? result.data : result.data?.base64 || result.data?.url
              if (base64) {
                const ext = tipoMedia === 'audio' ? 'ogg' : tipoMedia === 'video' ? 'mp4' : 'jpg'
                const blob = await fetch(base64.startsWith('data:') ? base64 : `data:application/octet-stream;base64,${base64}`).then(r => r.blob())
                const st = getStorage()
                const sRef = storageRef(st, `chat_media/${chatActivo.id}/${msg.id}.${ext}`)
                await uploadBytes(sRef, blob)
                const url = await getDownloadURL(sRef)
                await updateDoc(doc(db, `conversaciones/${chatActivo.id}/mensajes`, msg.id), { mediaUrl: url, mediaProcesado: true })
              }
            }
          } catch (err) { console.error('Error procesando media:', err) }
        }
      }
    })
    if (tipoActivo === 'wa' && chatActivo.noLeidos > 0)
      updateDoc(doc(db, 'conversaciones', chatActivo.id), { noLeidos: 0 }).catch(() => {})
    if (tipoActivo === 'interno') {
      const nl = chatActivo.noLeidos || {}
      const updates = { [`ultimaLectura.${usuarioActual.uid}`]: serverTimestamp() }
      if (nl[usuarioActual?.uid] > 0) updates[`noLeidos.${usuarioActual.uid}`] = 0
      updateDoc(doc(db, 'chats_internos', chatActivo.id), updates).catch(() => {})
    }
    return () => { if (unsubMsgs.current) unsubMsgs.current() }
  }, [chatActivo?.id, tipoActivo])

  useEffect(() => {
    if (mensajesRef.current) mensajesRef.current.scrollTop = mensajesRef.current.scrollHeight
    // Actualizar ultimaLectura cuando llegan mensajes nuevos en chat interno abierto
    if (chatActivo?.id && tipoActivo === 'interno' && mensajes.length > 0) {
      updateDoc(doc(db, 'chats_internos', chatActivo.id), { [`ultimaLectura.${usuarioActual?.uid}`]: serverTimestamp() }).catch(() => {})
    }
  }, [mensajes])

  // Sincronizar chatActivo con datos actualizados de gruposInternos (ultimaLectura, noLeidos, etc.)
  useEffect(() => {
    if (!chatActivo?.id || tipoActivo !== 'interno') return
    const actualizado = gruposInternos.find(g => g.id === chatActivo.id)
    if (actualizado) {
      setChatActivo(prev => ({ ...prev, ultimaLectura: actualizado.ultimaLectura, noLeidos: actualizado.noLeidos }))
    }
  }, [gruposInternos])

  useEffect(() => {
    if (!usuarioActual?.uid || gruposInternos.length === 0) return
    const unsubs = gruposInternos.map(chat =>
      onSnapshot(doc(db, 'chats_internos', chat.id), snap => {
        if (!snap.exists()) return
        const nudge = snap.data()?.nudge
        if (!nudge || nudge.autorId === usuarioActual.uid) return
        if (!(nudge.destinatarios || []).includes(usuarioActual.uid)) return
        const tsKey = `${chat.id}_${nudge.ts}`
        if (nudgeVisto.current.has(tsKey)) return
        nudgeVisto.current.add(tsKey)
        nudgeChatNombre.current = chat.nombre || 'Chat interno'
        setNudgeActivo({ autorNombre: nudge.autorNombre, mensaje: nudge.mensaje, chatId: chat.id })
      })
    )
    return () => unsubs.forEach(u => u())
  }, [gruposInternos, usuarioActual?.uid])

  useEffect(() => {
    getDoc(doc(db, 'configuracion', 'plantillas_wa')).then(snap => { if (snap.exists()) setPlantillasWA(snap.data().plantillas || []) }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!usuarioActual?.uid) return
    const q = query(collection(db, `usuarios/${usuarioActual.uid}/stickers`), orderBy('creadoEn', 'desc'))
    return onSnapshot(q, snap => setStickers(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [usuarioActual?.uid])

  async function enviarNudge() {
    if (!chatActivo || tipoActivo !== 'interno') return
    const nombre = usuarioActual?.nombre || usuarioActual?.email || 'Alguien'
    const texto  = `📳 ${nombre} envió un zumbido`
    const destinatarios = (chatActivo.miembros || []).filter(uid => uid !== usuarioActual?.uid)
    try {
      await addDoc(collection(db, `chats_internos/${chatActivo.id}/mensajes`), { body: texto, tipo: 'nudge', autorId: usuarioActual?.uid, autorNombre: nombre, autorFoto: usuarioActual?.fotoURL || null, timestamp: serverTimestamp() })
      await updateDoc(doc(db, 'chats_internos', chatActivo.id), { nudge: { autorId: usuarioActual?.uid, autorNombre: nombre, mensaje: texto, destinatarios, ts: Date.now() }, ultimoMensaje: texto, ultimoMensajeEn: serverTimestamp() })
      setTimeout(() => updateDoc(doc(db, 'chats_internos', chatActivo.id), { nudge: null }).catch(() => {}), 30000)
    } catch(e) { console.error('Error enviando nudge:', e) }
  }

  const listaFiltrada = (() => {
    const wa = conversaciones.filter(c => {
      if (filtroLista === 'interno') return false
      if (busqueda && !c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) && !c.telefono?.includes(busqueda)) return false
      if (filtroAgente !== 'todos' && c.agente !== filtroAgente) return false
      if (filtroEtapa && !(c.leads || []).some(l => (l.columnaId || l.etapa) === filtroEtapa)) return false
      if (filtroEtiqueta && c.etiqueta !== filtroEtiqueta) return false
      if (esSupervisor && verSoloMisChats && c.agente !== usuarioActual?.uid) return false
      if (!esSupervisor && c.agente && c.agente !== usuarioActual?.uid && !(c.colaboradores||[]).includes(usuarioActual?.uid)) return false
      if (filtroNoLeidos === 'noLeidos' && (c.noLeidos || 0) === 0) return false
      if (filtroNoLeidos === 'leidos' && (c.noLeidos || 0) > 0) return false
      if (!mostrarArchivadas && c.archivada) return false
      if (mostrarArchivadas && !c.archivada) return false
      return true
    }).map(c => ({ ...c, _tipo: 'wa' }))

    const internos = gruposInternos.filter(g => {
      if (filtroLista === 'wa') return false
      if (busqueda && !g.nombre?.toLowerCase().includes(busqueda.toLowerCase())) {
        // También buscar por nombre del otro miembro en chats individuales
        if ((g.miembros||[]).length === 2) {
          const otroUid = g.miembros.find(uid => uid !== usuarioActual?.uid)
          const otroUser = usuarios.find(u => u.uid === otroUid)
          if (otroUser && (otroUser.nombre||otroUser.email||'').toLowerCase().includes(busqueda.toLowerCase())) return true
        }
        return false
      }
      return true
    }).map(g => {
      // Chat individual: mostrar nombre del otro miembro
      if ((g.miembros||[]).length === 2) {
        const otroUid = g.miembros.find(uid => uid !== usuarioActual?.uid)
        const otroUser = usuarios.find(u => u.uid === otroUid)
        if (otroUser) return { ...g, nombre: otroUser.nombre || otroUser.email || g.nombre, _tipo: 'interno' }
      }
      return { ...g, _tipo: 'interno' }
    })

    const getTs = item => {
      const ts = item._tipo === 'interno' ? item.ultimoMensajeEn : item.timestamp
      if (!ts) return 0
      if (ts?.toDate) return ts.toDate().getTime()
      if (ts?.seconds) return ts.seconds * 1000
      if (typeof ts === 'number') return ts * 1000
      return new Date(ts).getTime()
    }
    if (filtroLista === 'wa') return [...wa].sort((a, b) => getTs(b) - getTs(a))
    if (filtroLista === 'interno') return [...internos].sort((a, b) => getTs(b) - getTs(a))
    return [...internos, ...wa].sort((a, b) => getTs(b) - getTs(a))
  })()

  const archivarChat = async (conv) => {
    // Verificar si tiene leads activos
    if (conv.contactoId) {
      try {
        const leadsSnap = await getDocs(query(collection(db, 'leads'), where('contactoId', '==', conv.contactoId)))
        const tieneActivos = leadsSnap.docs.some(d => { const e = d.data().estado; return e !== 'ganado' && e !== 'perdido' })
        if (tieneActivos) { alert('No se puede cerrar: este contacto tiene leads activos'); return }
      } catch {}
    }
    await updateDoc(doc(db, 'conversaciones', conv.id), { archivada: true }).catch(() => {})
    if (chatActivo?.id === conv.id) setChatActivo(null)
  }

  const desarchivarChat = async (conv) => {
    await updateDoc(doc(db, 'conversaciones', conv.id), { archivada: false }).catch(() => {})
  }

  const guardarRecordatorio = async () => {
    if (!formRecordatorio.titulo.trim() || !formRecordatorio.fecha) { alert('Título y fecha son obligatorios'); return }
    setGuardandoRec(true)
    try {
      const data = {
        titulo: formRecordatorio.titulo.trim(),
        descripcion: formRecordatorio.descripcion.trim(),
        fecha: formRecordatorio.fecha,
        hora: formRecordatorio.hora || '',
        tipo: formRecordatorio.tipo || '',
        repetir: formRecordatorio.repetir || 'una_vez',
        contactoId: contactoCRM?.id || '',
        contactoNombre: contactoCRM?.nombre || chatActivo?.nombre || '',
        empresaId: contactoCRM?.empresaId || '',
        empresaNombre: contactoCRM?.empresaNombre || '',
        conversacionId: chatActivo?.id || '',
        vendedorId: chatActivo?.agente || usuarioActual?.uid || '',
        vendedorNombre: usuarios.find(u => u.uid === (chatActivo?.agente || usuarioActual?.uid))?.nombre || '',
        creadoPor: usuarioActual?.uid,
        creadoPorNombre: usuarioActual?.nombre || '',
        estado: 'pendiente',
        creadoEn: serverTimestamp(),
      }
      await addDoc(collection(db, 'recordatorios'), data)
      // Crear evento en calendario
      await addDoc(collection(db, 'eventos'), {
        titulo: `⏰ ${data.titulo}`,
        descripcion: data.descripcion,
        fecha: data.fecha,
        hora: data.hora,
        tipo: 'recordatorio',
        contactoId: data.contactoId,
        contactoNombre: data.contactoNombre,
        asignadoA: data.vendedorId,
        creadoPor: usuarioActual?.uid,
        creadoEn: serverTimestamp(),
      }).catch(() => {})
      // Notificar al vendedor asignado
      if (data.vendedorId && data.vendedorId !== usuarioActual?.uid) {
        await crearNotificacion({
          destinatarioId: data.vendedorId,
          tipo: 'general',
          titulo: `⏰ Recordatorio: ${data.titulo}`,
          cuerpo: `${data.contactoNombre} — ${data.fecha}${data.hora ? ' ' + data.hora : ''}`,
          link: '/calendario',
        }).catch(() => {})
      }
      setModalRecordatorio(false)
      setFormRecordatorio({ titulo:'', descripcion:'', fecha:'', hora:'', tipo:'', repetir:'una_vez' })
    } catch (e) { console.error(e); alert('Error: ' + e.message) }
    finally { setGuardandoRec(false) }
  }

  function seleccionarChat(item) {
    setChatActivo(item); setTipoActivo(item._tipo); setTabActiva('mensaje')
    setShowScrollBtn(false); setFechaUltimo('')
    inputRef.current?.focus()
  }

  async function enviarWA() {
    if (!mensaje.trim() || !chatActivo || enviando) return
    setEnviando(true); const texto = mensaje.trim(); setMensaje('')
    try {
      const telefono = chatActivo.telefono?.replace(/[^0-9]/g, '')
      const res = await fetch(`${WASENDER_URL}/send-message`, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${WASENDER_TOKEN}`}, body:JSON.stringify({ to:`+${telefono}`, text:texto }) })
      const data = await res.json()
      if (data?.success !== false) {
        await addDoc(collection(db, `conversaciones/${chatActivo.id}/mensajes`), { body:texto, fromMe:true, tipo:'texto', timestamp:serverTimestamp(), autorNombre:usuarioActual?.nombre||usuarioActual?.email||'Agente', autorFoto:usuarioActual?.fotoURL||null, ...(respondiendo?{respondiendo:{id:respondiendo.id,body:respondiendo.body,autorNombre:respondiendo.fromMe?(usuarioActual?.nombre||'Agente'):chatActivo.nombre}}:{}) })
        setRespondiendo(null)
        await updateDoc(doc(db, 'conversaciones', chatActivo.id), { ultimoMensaje:texto, timestamp:Math.floor(Date.now()/1000) })
      }
    } catch(e) { console.error(e) } finally { setEnviando(false) }
  }

  async function enviarNotaInterna() {
    if (!mensaje.trim() || !chatActivo || enviando) return
    setEnviando(true); const texto = mensaje.trim(); setMensaje('')
    try {
      await addDoc(collection(db, `conversaciones/${chatActivo.id}/mensajes`), { body:texto, fromMe:true, tipo:'nota_interna', timestamp:serverTimestamp(), autorNombre:usuarioActual?.nombre||usuarioActual?.email||'Agente', autorFoto:usuarioActual?.fotoURL||null })
    } catch(e) { console.error(e) } finally { setEnviando(false) }
  }

  async function enviarInterno() {
    if (!mensaje.trim() || !chatActivo || enviando) return
    setEnviando(true); const texto = mensaje.trim(); setMensaje('')
    try {
      await addDoc(collection(db, `chats_internos/${chatActivo.id}/mensajes`), { body:texto, autorId:usuarioActual?.uid, autorNombre:usuarioActual?.nombre||usuarioActual?.email||'Agente', autorFoto:usuarioActual?.fotoURL||null, timestamp:serverTimestamp(), ...(respondiendo?{respondiendo:{id:respondiendo.id,body:respondiendo.body,autorNombre:respondiendo.autorNombre||'Usuario'}}:{}) })
      setRespondiendo(null)
      const noLeidos = {}
      ;(chatActivo.miembros||[]).forEach(uid => { if(uid!==usuarioActual?.uid) noLeidos[`noLeidos.${uid}`]=(chatActivo.noLeidos?.[uid]||0)+1 })
      await updateDoc(doc(db,'chats_internos',chatActivo.id), { ultimoMensaje:texto, ultimoMensajeEn:serverTimestamp(), [`ultimaLectura.${usuarioActual.uid}`]: serverTimestamp(), ...noLeidos })
    } catch(e) { console.error(e) } finally { setEnviando(false) }
  }

  function enviarMensaje() {
    if (tipoActivo === 'interno') return enviarInterno()
    if (tabActiva === 'interno') return enviarNotaInterna()
    return enviarWA()
  }

  async function guardarStickerFavorito(url) {
    if (!usuarioActual?.uid) return
    await addDoc(collection(db, `usuarios/${usuarioActual.uid}/stickers`), { url, creadoEn: serverTimestamp() }).catch(console.error)
  }

  async function enviarSticker(url) {
    if (!chatActivo) return; setShowStickers(false)
    try {
      if (tipoActivo === 'wa') {
        await fetch(`${WASENDER_URL}/send-image`, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${WASENDER_TOKEN}`}, body:JSON.stringify({ to:`+${chatActivo.telefono?.replace(/[^0-9]/g,'')}`, url, caption:'' }) })
        await addDoc(collection(db, `conversaciones/${chatActivo.id}/mensajes`), { body:'', tipo:'sticker', mediaUrl:url, fromMe:true, timestamp:serverTimestamp(), autorNombre:usuarioActual?.nombre||'Agente', autorFoto:usuarioActual?.fotoURL||null })
        await updateDoc(doc(db,'conversaciones',chatActivo.id), { ultimoMensaje:'🎭 Sticker', timestamp:Math.floor(Date.now()/1000) })
      } else {
        await addDoc(collection(db, `chats_internos/${chatActivo.id}/mensajes`), { body:'', tipo:'sticker', mediaUrl:url, autorId:usuarioActual?.uid, autorNombre:usuarioActual?.nombre||'Agente', autorFoto:usuarioActual?.fotoURL||null, timestamp:serverTimestamp() })
        const noLeidos = {}
        ;(chatActivo.miembros||[]).forEach(uid => { if(uid!==usuarioActual?.uid) noLeidos[`noLeidos.${uid}`]=(chatActivo.noLeidos?.[uid]||0)+1 })
        await updateDoc(doc(db,'chats_internos',chatActivo.id), { ultimoMensaje:'🎭 Sticker', ultimoMensajeEn:serverTimestamp(), ...noLeidos })
      }
    } catch(e) { console.error(e) }
  }

  async function enviarAdjunto(file) {
    if (!file || !chatActivo) return
    const esImagen = file.type.startsWith('image/'); const esVideo = file.type.startsWith('video/'); const esAudio = file.type.startsWith('audio/')
    try {
      const storage = getStorage(); const r = storageRef(storage, `chats/${chatActivo.id}/${Date.now()}_${file.name}`)
      await uploadBytes(r, file); const url = await getDownloadURL(r)
      const tipo = esImagen?'image':esVideo?'video':esAudio?'audio':'file'
      const colPath = tipoActivo==='wa'?`conversaciones/${chatActivo.id}/mensajes`:`chats_internos/${chatActivo.id}/mensajes`
      const datos = { body:file.name, tipo, mediaUrl:url, fromMe:true, timestamp:serverTimestamp(), autorNombre:usuarioActual?.nombre||'Agente', autorFoto:usuarioActual?.fotoURL||null }
      if (tipoActivo==='interno') { datos.autorId=usuarioActual?.uid; delete datos.fromMe }
      await addDoc(collection(db,colPath), datos)
      const label = esImagen?'📷 Imagen':esVideo?'🎬 Video':esAudio?'🎵 Audio':`📎 ${file.name}`
      if (tipoActivo==='wa') { await updateDoc(doc(db,'conversaciones',chatActivo.id), { ultimoMensaje:label, timestamp:Math.floor(Date.now()/1000) }) }
      else { const noLeidos={}; (chatActivo.miembros||[]).forEach(uid=>{if(uid!==usuarioActual?.uid)noLeidos[`noLeidos.${uid}`]=(chatActivo.noLeidos?.[uid]||0)+1}); await updateDoc(doc(db,'chats_internos',chatActivo.id),{ultimoMensaje:label,ultimoMensajeEn:serverTimestamp(),...noLeidos}) }
    } catch(e) { console.error(e) }
  }

  async function ejecutarReenvio(destino) {
    if (!reenviando) return; setShowReenviar(false)
    const texto=reenviando.body||''; const mediaUrl=reenviando.mediaUrl||null; const tipo=reenviando.tipo||'texto'
    try {
      if (destino._tipo==='wa') {
        if(texto) await fetch(`${WASENDER_URL}/send-message`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${WASENDER_TOKEN}`},body:JSON.stringify({to:`+${destino.telefono?.replace(/[^0-9]/g,'')}`,text:`↪ Reenviado:\n${texto}`})})
        await addDoc(collection(db,`conversaciones/${destino.id}/mensajes`),{body:texto,tipo,mediaUrl,fromMe:true,reenviado:true,timestamp:serverTimestamp(),autorNombre:usuarioActual?.nombre||'Agente',autorFoto:usuarioActual?.fotoURL||null})
        await updateDoc(doc(db,'conversaciones',destino.id),{ultimoMensaje:texto||'↪ Reenviado',timestamp:Math.floor(Date.now()/1000)})
      } else {
        await addDoc(collection(db,`chats_internos/${destino.id}/mensajes`),{body:texto,tipo,mediaUrl,reenviado:true,autorId:usuarioActual?.uid,autorNombre:usuarioActual?.nombre||'Agente',autorFoto:usuarioActual?.fotoURL||null,timestamp:serverTimestamp()})
        const noLeidos={}; (destino.miembros||[]).forEach(uid=>{if(uid!==usuarioActual?.uid)noLeidos[`noLeidos.${uid}`]=(destino.noLeidos?.[uid]||0)+1})
        await updateDoc(doc(db,'chats_internos',destino.id),{ultimoMensaje:texto||'↪ Reenviado',ultimoMensajeEn:serverTimestamp(),...noLeidos})
      }
    } catch(e) { console.error(e) }
    setReenviando(null)
  }

  async function toggleGrabacion() {
    if (grabando) { mediaRecorder?.stop(); setGrabando(false); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream); const chunks = []
      mr.ondataavailable = e => chunks.push(e.data)
      mr.onstop = async () => { const blob=new Blob(chunks,{type:'audio/webm'}); const file=new File([blob],`audio_${Date.now()}.webm`,{type:'audio/webm'}); stream.getTracks().forEach(t=>t.stop()); await enviarAdjunto(file) }
      mr.start(); setMediaRecorder(mr); setGrabando(true)
    } catch(e) { console.error(e) }
  }

  async function actualizarConversacion(campo, valor) {
    if (!chatActivo || tipoActivo !== 'wa') return
    await updateDoc(doc(db, 'conversaciones', chatActivo.id), { [campo]: valor })
    setChatActivo(prev => ({ ...prev, [campo]: valor }))
    setConversaciones(prev => prev.map(c => c.id === chatActivo.id ? { ...c, [campo]: valor } : c))
  }

  // Cargar contacto CRM y leads cuando cambia el chat — si no existe, crearlo automáticamente
  useEffect(() => {
    if (!chatActivo?.telefono) { setContactoCRM(null); setLeadsCRM([]); return }
    let cancelado = false
    setLoadingContacto(true)

    async function cargarOCrear() {
      try {
        // 1. Buscar por whatsapp
        let ct = null
        const snap = await getDocs(query(collection(db,'contactos'),where('whatsapp','==',chatActivo.telefono)))
        if (!snap.empty) { ct = { id: snap.docs[0].id, ...snap.docs[0].data() } }

        // 2. Si no encontró, buscar por contactoId
        if (!ct && chatActivo.contactoId) {
          const d = await getDoc(doc(db,'contactos',chatActivo.contactoId))
          if (d.exists()) ct = { id: d.id, ...d.data() }
        }

        // 3. Si sigue sin contacto, crearlo automáticamente
        if (!ct) {
          const nuevo = {
            nombre: chatActivo.nombre || '', telefono: chatActivo.telefono || '',
            whatsapp: chatActivo.telefono || '', correo: '', tipo: 'persona',
            facturacion: { tipoFact: 'fisica', campos: {} },
            origen: 'WhatsApp', creadoEn: serverTimestamp(),
          }
          const ref = await addDoc(collection(db,'contactos'), nuevo)
          ct = { id: ref.id, ...nuevo }
          // Vincular a la conversación
          await updateDoc(doc(db,'conversaciones',chatActivo.id), { contactoId: ref.id }).catch(() => {})
        }

        if (!cancelado) {
          // Cargar observaciones de la empresa si tiene
          if (ct?.empresaId) {
            try { const empSnap = await getDoc(doc(db,'empresas',ct.empresaId)); if (empSnap.exists()) ct._obsEmpresa = empSnap.data().observaciones || '' } catch {}
          }
          setContactoCRM(ct)
          if (ct.id) cargarLeadsContacto(ct.id)
        }
      } catch {
        if (!cancelado) { setContactoCRM(null); setLeadsCRM([]) }
      } finally {
        if (!cancelado) setLoadingContacto(false)
      }
    }

    cargarOCrear()
    return () => { cancelado = true }
  }, [chatActivo?.id, chatActivo?.telefono, chatActivo?.contactoId])

  async function cargarLeadsContacto(contactoId) {
    const snap = await getDocs(query(collection(db,'leads'),where('contactoId','==',contactoId)))
    setLeadsCRM(snap.docs.map(d => ({ id:d.id, ...d.data() })).filter(l => l.estado !== 'perdido'))
  }

  async function guardarContactoCRM(campo, valor) {
    if (!contactoCRM?.id) return
    await updateDoc(doc(db,'contactos',contactoCRM.id), { [campo]: valor })
    setContactoCRM(prev => ({ ...prev, [campo]: valor }))
    // Si cambia el nombre, actualizar también en la conversación y en chatActivo
    if (campo === 'nombre' && chatActivo?.id && tipoActivo === 'wa') {
      await updateDoc(doc(db, 'conversaciones', chatActivo.id), { nombre: valor }).catch(() => {})
      setChatActivo(prev => ({ ...prev, nombre: valor }))
      setConversaciones(prev => prev.map(c => c.id === chatActivo.id ? { ...c, nombre: valor } : c))
    }
  }

  async function guardarFacturacionCRM(tipoFact, campoId, valor) {
    if (!contactoCRM?.id) return
    const fact = contactoCRM.facturacion || { tipoFact: 'fisica', campos: {} }
    const updated = { ...fact, tipoFact, campos: { ...fact.campos, [campoId]: valor } }
    await updateDoc(doc(db,'contactos',contactoCRM.id), { facturacion: updated })
    setContactoCRM(prev => ({ ...prev, facturacion: updated }))
  }

  async function cambiarTipoFactCRM(tipoFact) {
    if (!contactoCRM?.id) return
    const fact = contactoCRM.facturacion || { campos: {} }
    await updateDoc(doc(db,'contactos',contactoCRM.id), { facturacion: { ...fact, tipoFact } })
    setContactoCRM(prev => ({ ...prev, facturacion: { ...fact, tipoFact } }))
  }

  // Cargar tareas del chat interno
  useEffect(() => {
    if (!chatActivo?.id || tipoActivo !== 'interno') { setTareas([]); return }
    const q2 = query(collection(db, `chats_internos/${chatActivo.id}/tareas`), orderBy('creadoEn', 'desc'))
    const unsub = onSnapshot(q2, snap => setTareas(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    return unsub
  }, [chatActivo?.id, tipoActivo])

  async function crearTareaChat(data) {
    if (!chatActivo?.id) return
    const nombre = usuarioActual?.nombre || usuarioActual?.email || 'Alguien'
    await addDoc(collection(db, `chats_internos/${chatActivo.id}/tareas`), {
      ...data, estado: 'pendiente', creadoPor: usuarioActual?.uid, creadoEn: serverTimestamp(),
    })
    // Notificar en el chat
    const asignados = (data.asignados || []).map(uid => usuarios.find(u => u.uid === uid)?.nombre || uid).join(', ')
    await addDoc(collection(db, `chats_internos/${chatActivo.id}/mensajes`), {
      body: `📋 ${nombre} creó tarea: "${data.titulo}" → ${asignados}`, tipo: 'sistema',
      autorId: usuarioActual?.uid, autorNombre: nombre, timestamp: serverTimestamp(),
    })
  }

  async function cambiarEstadoTarea(tareaId, nuevoEstado) {
    if (!chatActivo?.id) return
    await updateDoc(doc(db, `chats_internos/${chatActivo.id}/tareas`, tareaId), { estado: nuevoEstado, actualizadoEn: serverTimestamp() })
    if (nuevoEstado === 'completada') {
      const nombre = usuarioActual?.nombre || usuarioActual?.email || 'Alguien'
      const tarea = tareas.find(t => t.id === tareaId)
      await addDoc(collection(db, `chats_internos/${chatActivo.id}/mensajes`), {
        body: `✅ ${nombre} completó la tarea: "${tarea?.titulo || ''}"`, tipo: 'sistema',
        autorId: usuarioActual?.uid, autorNombre: nombre, timestamp: serverTimestamp(),
      })
    }
  }

  function iniciarCrearLead() {
    if (!contactoCRM) { alert('Primero registra el contacto en CRM'); return }
    if (contactoCRM.tipo === 'empresa' || contactoCRM.empresaNombre) {
      setNuevoLead({}); setModalLead('tipo')
    } else {
      setNuevoLead({ tipoLead:'persona', tipoFactura:'fisica' }); setModalLead('nombre')
    }
  }

  async function finalizarCrearLead(nombre) {
    if (!nombre.trim()) return
    // Obtener primera columna del pipeline
    let columnaId = ''
    try {
      const colSnap = await getDocs(query(collection(db,'pipeline_columnas'),orderBy('orden')))
      if (!colSnap.empty) columnaId = colSnap.docs[0].id
    } catch {}
    const data = {
      nombre: nombre.trim(),
      contactoId: contactoCRM.id,
      cliente: contactoCRM.nombre || '',
      tipoLead: nuevoLead.tipoLead || 'persona',
      tipoFactura: nuevoLead.tipoFactura || 'fisica',
      empresaId: nuevoLead.tipoLead === 'empresa' ? (contactoCRM.empresaId || '') : '',
      empresaNombre: nuevoLead.tipoLead === 'empresa' ? (contactoCRM.empresaNombre || '') : '',
      whatsapp: contactoCRM.whatsapp || chatActivo.telefono || '',
      columnaId,
      prioridad: 'media',
      estado: 'activo',
      origen: 'WhatsApp',
    }
    await addDoc(collection(db,'leads'), { ...data, creadoEn: serverTimestamp() })
    setModalLead(null); setNuevoLead({})
    cargarLeadsContacto(contactoCRM.id)
  }

  function actualizarLead(idx, campo, valor) { const leads=[...(chatActivo.leads||[])]; leads[idx]={...leads[idx],[campo]:valor}; actualizarConversacion('leads',leads) }
  function marcarLead(idx, estado) { const leads=[...(chatActivo.leads||[])]; const lead=leads[idx]; leads[idx]=lead.etapa===estado?{...lead,etapa:lead.etapaAnterior||'negociacion',etapaAnterior:undefined,fechaCierre:undefined}:{...lead,etapaAnterior:lead.etapa,etapa:estado,fechaCierre:new Date().toISOString()}; actualizarConversacion('leads',leads) }
  function reabrirLead(idx) { const leads=[...(chatActivo.leads||[])]; const lead=leads[idx]; leads[idx]={...lead,etapa:lead.etapaAnterior||'negociacion',etapaAnterior:undefined,fechaCierre:undefined}; actualizarConversacion('leads',leads) }
  function crearLead() { actualizarConversacion('leads',[...(chatActivo.leads||[]),{id:Date.now().toString(),nombre:chatActivo.nombre||'Lead sin nombre',etapa:'nuevo',fechaCreacion:new Date().toISOString()}]) }

  async function crearGrupo({ nombre, miembros }) {
    const ref = await addDoc(collection(db,'chats_internos'),{nombre,miembros,tipo:'grupo',creadoPor:usuarioActual?.uid,creadoEn:serverTimestamp(),ultimoMensaje:'',ultimoMensajeEn:serverTimestamp(),noLeidos:{}})
    setShowNuevoGrupo(false); const snap=await getDoc(ref); seleccionarChat({id:snap.id,...snap.data(),_tipo:'interno'})
  }

  function nombresMiembros(miembros=[]) { return miembros.map(uid => uid===usuarioActual?.uid?'Tú':usuarios.find(u=>u.uid===uid)?.nombre||'Usuario').join(', ') }

  async function iniciarChatNuevo() {
    if (!nuevoNumero.trim()) return
    const telefono = nuevoNumero.replace(/[^0-9]/g,'')
    const existente = conversaciones.find(c=>c.telefono?.replace(/[^0-9]/g,'')===telefono)
    if (existente) { seleccionarChat({...existente,_tipo:'wa'}) }
    else { const ref=await addDoc(collection(db,'conversaciones'),{telefono,nombre:telefono,ultimoMensaje:'',timestamp:Math.floor(Date.now()/1000),noLeidos:0,creadoEn:serverTimestamp()}); const snap=await getDoc(ref); seleccionarChat({id:snap.id,...snap.data(),_tipo:'wa'}) }
    setNuevoNumero(''); setShowNuevoChat(false)
  }

  const etiquetaActiva   = ETIQUETAS.find(e => e.valor === chatActivo?.etiqueta) || ETIQUETAS[0]
  const noLeidosInternos = gruposInternos.reduce((acc,g) => acc+(g.noLeidos?.[usuarioActual?.uid]||0), 0)

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden', fontFamily:'inherit', background:'#f5f7fa' }}>

      {nudgeActivo && <ModalNudge nudgeData={nudgeActivo} chatNombre={nudgeChatNombre.current} onCerrar={async () => { if(nudgeActivo.chatId) await updateDoc(doc(db,'chats_internos',nudgeActivo.chatId),{nudge:null}).catch(()=>{}); setNudgeActivo(null) }} />}

      {/* Modal Recordatorio */}
      {modalRecordatorio && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', backdropFilter:'blur(3px)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={e => e.target === e.currentTarget && setModalRecordatorio(false)}>
          <div style={{ background:'#fff', borderRadius:14, width:'95%', maxWidth:440, boxShadow:'0 20px 60px rgba(0,0,0,.2)', overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #f0f2f5', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontWeight:700, fontSize:15 }}>⏰ Nuevo recordatorio</div>
                <div style={{ fontSize:12, color:'#888' }}>{contactoCRM?.nombre || chatActivo?.nombre || ''}</div>
              </div>
              <button onClick={() => setModalRecordatorio(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#aaa' }}>×</button>
            </div>
            <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={{ fontSize:10, fontWeight:600, color:'#888', textTransform:'uppercase', display:'block', marginBottom:3 }}>Título *</label>
                <input value={formRecordatorio.titulo} onChange={e => setFormRecordatorio(f => ({...f, titulo:e.target.value}))} placeholder="Ej: Llamar para seguimiento" style={{ width:'100%', padding:'7px 10px', border:'1px solid #dde3ed', borderRadius:7, fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize:10, fontWeight:600, color:'#888', textTransform:'uppercase', display:'block', marginBottom:3 }}>Descripción</label>
                <textarea value={formRecordatorio.descripcion} onChange={e => setFormRecordatorio(f => ({...f, descripcion:e.target.value}))} placeholder="Detalles adicionales..." style={{ width:'100%', padding:'7px 10px', border:'1px solid #dde3ed', borderRadius:7, fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box', minHeight:50, resize:'vertical' }} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ fontSize:10, fontWeight:600, color:'#888', textTransform:'uppercase', display:'block', marginBottom:3 }}>Fecha *</label>
                  <input type="date" value={formRecordatorio.fecha} onChange={e => setFormRecordatorio(f => ({...f, fecha:e.target.value}))} style={{ width:'100%', padding:'7px 10px', border:'1px solid #dde3ed', borderRadius:7, fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize:10, fontWeight:600, color:'#888', textTransform:'uppercase', display:'block', marginBottom:3 }}>Hora</label>
                  <input type="time" value={formRecordatorio.hora} onChange={e => setFormRecordatorio(f => ({...f, hora:e.target.value}))} style={{ width:'100%', padding:'7px 10px', border:'1px solid #dde3ed', borderRadius:7, fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ fontSize:10, fontWeight:600, color:'#888', textTransform:'uppercase', display:'block', marginBottom:3 }}>Tipo</label>
                  <select value={formRecordatorio.tipo} onChange={e => setFormRecordatorio(f => ({...f, tipo:e.target.value}))} style={{ width:'100%', padding:'7px 10px', border:'1px solid #dde3ed', borderRadius:7, fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }}>
                    <option value="">— Sin tipo —</option>
                    {tiposRecordatorio.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:10, fontWeight:600, color:'#888', textTransform:'uppercase', display:'block', marginBottom:3 }}>Repetir</label>
                  <select value={formRecordatorio.repetir} onChange={e => setFormRecordatorio(f => ({...f, repetir:e.target.value}))} style={{ width:'100%', padding:'7px 10px', border:'1px solid #dde3ed', borderRadius:7, fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }}>
                    <option value="una_vez">Una vez</option>
                    <option value="diario">Diario</option>
                    <option value="semanal">Semanal</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="semestral">Semestral</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ padding:'14px 20px', borderTop:'1px solid #f0f2f5', display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setModalRecordatorio(false)} style={{ padding:'8px 16px', border:'1px solid #dde3ed', borderRadius:8, fontSize:12, cursor:'pointer', background:'#f5f5f5', fontFamily:'inherit' }}>Cancelar</button>
              <button onClick={guardarRecordatorio} disabled={guardandoRec} style={{ padding:'8px 20px', border:'none', borderRadius:8, fontSize:12, fontWeight:600, cursor:guardandoRec?'not-allowed':'pointer', background:guardandoRec?'#e0e0e0':'#185FA5', color:guardandoRec?'#aaa':'#fff', fontFamily:'inherit' }}>
                {guardandoRec ? 'Guardando...' : 'Crear recordatorio'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showNuevoGrupo && <ModalNuevoGrupo usuarios={usuarios} onCrear={crearGrupo} onCerrar={() => setShowNuevoGrupo(false)} usuarioActual={usuarioActual} />}

      {showNuevoChat && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', backdropFilter:'blur(3px)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={e=>e.target===e.currentTarget&&setShowNuevoChat(false)}>
          <div style={{ background:'#fff', borderRadius:14, width:'90%', maxWidth:380, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ padding:'14px 18px', borderBottom:'0.5px solid rgba(0,0,0,.08)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontWeight:600, fontSize:14 }}>Nuevo chat</span>
              <button onClick={()=>setShowNuevoChat(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#aaa' }}>×</button>
            </div>
            <div style={{ padding:18, display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'.5px', display:'block', marginBottom:4 }}>Número de WhatsApp</label>
                <input style={{ width:'100%', padding:'9px 12px', border:'1px solid #e8ecf0', borderRadius:8, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} placeholder="+50688887777" value={nuevoNumero} onChange={e=>setNuevoNumero(e.target.value)} onKeyDown={e=>e.key==='Enter'&&iniciarChatNuevo()} autoFocus />
                <p style={{ fontSize:11, color:'#aaa', marginTop:4 }}>Con código de país. Ej: +506 para Costa Rica</p>
              </div>
              <button onClick={()=>{setShowNuevoChat(false);setShowNuevoGrupo(true)}} style={{ padding:'8px', border:'1px dashed #0F6E56', borderRadius:8, fontSize:12, cursor:'pointer', background:'#f0faf6', color:'#0F6E56', fontFamily:'inherit', fontWeight:500 }}>💬 Chat interno (individual o grupal)</button>
            </div>
            <div style={{ padding:'12px 18px', borderTop:'0.5px solid rgba(0,0,0,.08)', display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={()=>setShowNuevoChat(false)} style={{ padding:'7px 14px', border:'0.5px solid rgba(0,0,0,.15)', borderRadius:7, fontSize:12, cursor:'pointer', background:'#f5f5f5', fontFamily:'inherit' }}>Cancelar</button>
              <button onClick={iniciarChatNuevo} disabled={!nuevoNumero.trim()} style={{ padding:'7px 18px', border:'none', borderRadius:7, fontSize:12, fontWeight:500, cursor:!nuevoNumero.trim()?'not-allowed':'pointer', background:!nuevoNumero.trim()?'#e0e0e0':'var(--eco-primary,#1a3a5c)', color:!nuevoNumero.trim()?'#aaa':'#fff', fontFamily:'inherit' }}>Iniciar chat WA</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ SIDEBAR ════════ */}
      <div style={{ width:'310px', borderRight:'1px solid #e8ecf0', display:'flex', flexDirection:'column', background:'#fff', flexShrink:0, height:'100%' }}>
        <div style={{ padding:'12px 14px 0', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <span style={{ fontSize:14, fontWeight:700, color:'#1a1a1a' }}>Conversaciones</span>
            <button onClick={()=>setShowNuevoChat(true)} style={{ width:28, height:28, borderRadius:8, background:'var(--eco-primary,#1a3a5c)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:18, flexShrink:0 }}>+</button>
          </div>
          <div style={{ position:'relative', marginBottom:10 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}><circle cx="11" cy="11" r="8" stroke="#bbb" strokeWidth="2"/><path d="M21 21l-4.35-4.35" stroke="#bbb" strokeWidth="2" strokeLinecap="round"/></svg>
            <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar..." style={{ width:'100%', padding:'7px 10px 7px 28px', border:'1px solid #e8ecf0', borderRadius:8, fontSize:12, outline:'none', background:'#f7f8fa', color:'#1a1a1a', fontFamily:'inherit', boxSizing:'border-box' }} />
          </div>
          <div style={{ display:'flex', gap:4, marginBottom:10 }}>
            {[
              { key:'todos', label: filtroNoLeidos==='noLeidos'?'🔵 No leídos':filtroNoLeidos==='leidos'?'🟢 Leídos':'Todos' },
              { key:'wa', label:'📱 WA' },
              { key:'interno', label:'💬 Interno', badge:noLeidosInternos },
            ].map(t => (
              <button key={t.key} onClick={() => {
                if(t.key==='todos'){setFiltroLista('todos');setFiltroNoLeidos(f=>f==='todos'?'noLeidos':f==='noLeidos'?'leidos':'todos')}
                else{setFiltroLista(t.key);setFiltroNoLeidos('todos')}
              }} style={{ flex:1, padding:'5px 4px', border:'none', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', position:'relative', borderRadius:7, background:(t.key==='todos'&&filtroLista==='todos')||(t.key!=='todos'&&filtroLista===t.key)?(filtroNoLeidos==='noLeidos'?'#185FA5':filtroNoLeidos==='leidos'?'#3B6D11':'var(--eco-primary,#1a3a5c)'):'#f0f2f5', color:(t.key==='todos'&&filtroLista==='todos')||(t.key!=='todos'&&filtroLista===t.key)?'#fff':'#666' }}>
                {t.label}
                {t.badge>0&&<span style={{ position:'absolute', top:-4, right:-4, background:'#E24B4A', color:'#fff', fontSize:8, fontWeight:700, padding:'0 4px', borderRadius:8, minWidth:14, textAlign:'center', lineHeight:'14px' }}>{t.badge}</span>}
              </button>
            ))}
          </div>
          {filtroLista!=='interno'&&esSupervisor&&(
            <div style={{ display:'flex', gap:6, marginBottom:8 }}>
              <select value={filtroEtapa} onChange={e=>setFiltroEtapa(e.target.value)} style={{ flex:1, padding:'5px 8px', border:'1px solid #e8ecf0', borderRadius:7, fontSize:11, color:'#666', background:'#f7f8fa', fontFamily:'inherit', outline:'none' }}>{ETAPAS_PIPELINE.map(e=><option key={e.valor} value={e.valor}>{e.label}</option>)}</select>
              <select value={filtroAgente} onChange={e=>setFiltroAgente(e.target.value)} style={{ flex:1, padding:'5px 8px', border:'1px solid #e8ecf0', borderRadius:7, fontSize:11, color:'#666', background:'#f7f8fa', fontFamily:'inherit', outline:'none' }}><option value="todos">Todos los agentes</option>{usuarios.map(u=><option key={u.uid} value={u.uid}>{u.nombre||u.email}</option>)}</select>
            </div>
          )}
          {filtroLista==='interno'&&<button onClick={()=>setShowNuevoGrupo(true)} style={{ width:'100%', padding:'7px', border:'1px dashed #0F6E56', borderRadius:8, fontSize:12, cursor:'pointer', background:'#f0faf6', color:'#0F6E56', fontFamily:'inherit', fontWeight:500, marginBottom:8 }}>+ Nuevo grupo interno</button>}
          <div style={{ fontSize:10, color:'#bbb', marginBottom:6, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span>{listaFiltrada.length} conversación{listaFiltrada.length!==1?'es':''}</span>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <button onClick={() => setMostrarArchivadas(v => !v)} style={{ fontSize:10, color:mostrarArchivadas?'#A32D2D':'#888', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit' }}>{mostrarArchivadas?'Ver activas':'📦 Archivadas'}</button>
              {(filtroNoLeidos!=='todos'||filtroEtiqueta||filtroEtapa||busqueda)&&<button onClick={()=>{setFiltroNoLeidos('todos');setFiltroEtiqueta('');setFiltroEtapa('');setBusqueda('')}} style={{ fontSize:10, color:'#185FA5', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit' }}>Limpiar</button>}
            </div>
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', borderTop:'1px solid #f0f2f5' }}>
          {listaFiltrada.length===0&&<div style={{ padding:'2rem', textAlign:'center', color:'#bbb', fontSize:'13px' }}><div style={{ fontSize:28, marginBottom:8 }}>💬</div>Sin conversaciones</div>}
          {listaFiltrada.map(item => {
            const esInterno = item._tipo==='interno'
            const esChatActivo = chatActivo?.id===item.id&&tipoActivo===item._tipo
            const etiq      = ETIQUETAS.find(e=>e.valor===item.etiqueta)
            const leadActivo= (item.leads||[]).filter(l=>l.etapa!=='ganado'&&l.etapa!=='perdido').slice(-1)[0]
            const noLeidos  = esInterno?(item.noLeidos?.[usuarioActual?.uid]||0):(item.noLeidos||0)
            const agenteNombre = !esInterno&&item.agente?usuarios.find(u=>u.uid===item.agente)?.nombre:null
            // Estado activo del otro usuario en chat individual
            const otroUsuarioActivo = esInterno && (item.miembros||[]).length === 2
              ? (() => { const otroUid = (item.miembros||[]).find(uid => uid !== usuarioActual?.uid); const u = usuarios.find(u => u.uid === otroUid); return u?.activo || false })()
              : null
            return (
              <div key={`${item._tipo}-${item.id}`} onClick={()=>seleccionarChat(item)} onMouseEnter={e=>{if(!esChatActivo)e.currentTarget.style.background='#f9fafb'}} onMouseLeave={e=>{if(!esChatActivo)e.currentTarget.style.background='#fff'}}
                style={{ padding:'10px 14px', cursor:'pointer', background:esChatActivo?'#EEF3FA':'#fff', borderLeft:esChatActivo?`3px solid ${esInterno?'#0F6E56':'var(--eco-primary,#1a3a5c)'}`:'3px solid transparent', borderBottom:'1px solid #f5f6f8' }}>
                <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                  <div style={{ position:'relative', flexShrink:0 }}>
                    <Avatar nombre={item.nombre} size={36} interno={esInterno} />
                    {otroUsuarioActivo !== null && <span style={{ position:'absolute', bottom:0, right:0, width:10, height:10, borderRadius:'50%', background:otroUsuarioActivo?'#22c55e':'#ef4444', border:'2px solid #fff' }} />}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                      <span style={{ fontWeight:noLeidos>0?700:600, fontSize:13, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:145 }}>{item.nombre}</span>
                      <span style={{ fontSize:10, color:'#bbb', flexShrink:0, marginLeft:4 }}>{esInterno?formatFecha(item.ultimoMensajeEn):formatFecha(item.timestamp)}</span>
                    </div>
                    <div style={{ fontSize:11, color:noLeidos>0?'#555':'#999', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:4, fontWeight:noLeidos>0?500:400 }}>
                      {esInterno&&<span style={{ color:'#0F6E56', marginRight:4 }}>💬</span>}{item.ultimoMensaje||'...'}
                    </div>
                    <div style={{ display:'flex', gap:4, alignItems:'center', flexWrap:'wrap' }}>
                      {!esInterno&&etiq?.valor&&<span style={{ fontSize:10, padding:'1px 6px', borderRadius:20, background:etiq.color+'18', color:etiq.color, fontWeight:600 }}>{etiq.label}</span>}
                      {!esInterno&&leadActivo&&<EtapaBadge etapa={leadActivo.etapa||leadActivo.columnaId} small columnas={columnsPipeline} />}
                      {!esInterno&&agenteNombre&&<span style={{ fontSize:10, color:'#bbb', display:'flex', alignItems:'center', gap:3 }}><UserAvatar nombre={agenteNombre} uid={item.agente} size={14} />{agenteNombre}</span>}
                      {esInterno&&(item.miembros||[]).length>2&&<span style={{ fontSize:10, color:'#aaa' }}>Chat grupal</span>}
                      {noLeidos>0&&<span style={{ marginLeft:'auto', background:esInterno?'#0F6E56':'var(--eco-primary,#1a3a5c)', color:'#fff', fontSize:10, padding:'1px 7px', borderRadius:10, fontWeight:700 }}>{noLeidos}</span>}
                      {mostrarArchivadas&&!esInterno&&<button onClick={e=>{e.stopPropagation();desarchivarChat(item)}} title="Reactivar chat" style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'#185FA5', fontSize:10, padding:'0 4px', fontFamily:'inherit' }}>↩</button>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ════════ ÁREA DE CHAT ════════ */}
      {chatActivo ? (
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
          <div style={{ padding:'12px 16px', background:'#fff', borderBottom:'1px solid #e0e7ef', display:'flex', alignItems:'center', gap:'10px', flexShrink:0, minHeight:60 }}>
            {(() => {
              const esIndividual = tipoActivo==='interno' && (chatActivo.miembros||[]).length === 2
              const otroActivo = esIndividual ? (() => { const otroUid = (chatActivo.miembros||[]).find(uid => uid !== usuarioActual?.uid); return usuarios.find(u => u.uid === otroUid)?.activo || false })() : null
              return (
                <div style={{ position:'relative', flexShrink:0 }}>
                  <Avatar nombre={chatActivo.nombre} size={38} interno={tipoActivo==='interno'} />
                  {otroActivo !== null && <span style={{ position:'absolute', bottom:0, right:0, width:11, height:11, borderRadius:'50%', background:otroActivo?'#22c55e':'#ef4444', border:'2px solid #fff' }} />}
                </div>
              )
            })()}
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:'14px', color:'#1a1a1a' }}>{chatActivo.nombre}</div>
              <div style={{ fontSize:'12px', color:'#888' }}>
                {tipoActivo==='wa'?chatActivo.telefono:tipoActivo==='interno'&&(chatActivo.miembros||[]).length===2
                  ?(() => { const otroUid=(chatActivo.miembros||[]).find(uid=>uid!==usuarioActual?.uid); const u=usuarios.find(u=>u.uid===otroUid); return u?.activo?'En línea':'Desconectado' })()
                  :nombresMiembros(chatActivo.miembros)}
              </div>
            </div>
            {tipoActivo==='interno'
              ?<span style={{ fontSize:'11px', padding:'3px 10px', borderRadius:'20px', background:'#E1F5EE', color:'#0F6E56', fontWeight:600 }}>💬 Chat interno</span>
              :<>
                <span style={{ fontSize:'11px', padding:'3px 10px', borderRadius:'20px', background:'#EAF3DE', color:'#3B6D11', fontWeight:600 }}>📱 WhatsApp</span>
                <button onClick={()=>archivarChat(chatActivo)} style={{ padding:'3px 10px', borderRadius:20, border:'1px solid #f0f0f0', background:'#fff', color:'#888', fontSize:11, cursor:'pointer', fontFamily:'inherit', fontWeight:500 }} onMouseEnter={e=>{e.currentTarget.style.background='#FCEBEB';e.currentTarget.style.color='#A32D2D';e.currentTarget.style.borderColor='#f09595'}} onMouseLeave={e=>{e.currentTarget.style.background='#fff';e.currentTarget.style.color='#888';e.currentTarget.style.borderColor='#f0f0f0'}}>✕ Cerrar chat</button>
              </>
            }
          </div>

          {tipoActivo==='interno'&&<IndicadorLectura chatId={chatActivo.id} miembros={chatActivo.miembros} gruposInternos={gruposInternos} usuarios={usuarios} usuarioActualUid={usuarioActual?.uid} mensajes={mensajes} />}

          {tabActiva!=='resumen'&&(
            <div ref={mensajesRef}
              onScroll={e=>{const el=e.currentTarget;const dist=el.scrollHeight-el.scrollTop-el.clientHeight;setShowScrollBtn(dist>200);if(mensajes.length>0){const ultimo=mensajes[mensajes.length-1];const ts=ultimo.timestamp;if(ts){const d=ts?.toDate?ts.toDate():new Date(typeof ts==='number'?ts*1000:ts);setFechaUltimo(d.toLocaleDateString('es-CR',{weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}))}}}}
              style={{ flex:1, overflowY:'auto', padding:'14px 16px', display:'flex', flexDirection:'column', gap:'6px', background:tipoActivo==='interno'?'#f0faf6':tabActiva==='interno'?'#FFFBF5':'#f0f4f8', position:'relative' }}>
              {mensajes.length===0&&<div style={{ textAlign:'center', color:'#ccc', fontSize:13, marginTop:40 }}>{tipoActivo==='interno'?'Iniciá la conversación del grupo':'No hay mensajes aún'}</div>}
              {mensajes.map((msg,i) => {
                const esMio  = tipoActivo==='wa'?msg.fromMe:msg.autorId===usuarioActual?.uid
                const esNota = msg.tipo==='nota_interna'
                const esNudge= msg.tipo==='nudge'
                if(esNudge) return (
                  <div key={msg.id||i} style={{ display:'flex', justifyContent:'center', margin:'4px 0' }}>
                    <div style={{ background:'#E6F1FB', border:'1px dashed #5aabff', borderRadius:20, padding:'5px 16px', fontSize:12, color:'#185FA5', fontWeight:500, display:'flex', alignItems:'center', gap:6 }}>
                      <img src={NUDGE_IMG_URL} alt="nudge" style={{ width:18, height:18, objectFit:'contain' }} />{msg.body}<span style={{ fontSize:10, color:'#aaa', marginLeft:4 }}>{formatFecha(msg.timestamp)}</span>
                    </div>
                  </div>
                )
                return (
                  <div key={msg.id||i} style={{ display:'flex', justifyContent:esMio?'flex-end':'flex-start', gap:6, alignItems:'flex-end', position:'relative' }}
                    onMouseEnter={e=>{const btn=e.currentTarget.querySelector('.msg-actions');if(btn)btn.style.opacity='1'}}
                    onMouseLeave={e=>{const btn=e.currentTarget.querySelector('.msg-actions');if(btn)btn.style.opacity='0'}}>
                    {!esMio&&tipoActivo==='interno'&&<Avatar nombre={msg.autorNombre||'?'} foto={msg.autorFoto} size={24} />}
                    <div style={{ maxWidth:'65%' }}>
                      {!esMio&&tipoActivo==='interno'&&<div style={{ fontSize:10, color:colorFromString(msg.autorNombre||''), fontWeight:600, marginBottom:2, paddingLeft:4 }}>{msg.autorNombre}</div>}
                      <div style={{ padding:'9px 13px', borderRadius:esMio?'14px 14px 3px 14px':'14px 14px 14px 3px', background:esNota?'#FAEEDA':esMio?(tipoActivo==='interno'?'#0F6E56':'#1a3a5c'):'#fff', color:esNota?'#854F0B':esMio?'#fff':'#1a1a1a', fontSize:'13px', lineHeight:'1.55', boxShadow:'0 1px 2px rgba(0,0,0,0.06)', border:esNota?'1px dashed #EF9F27':'none' }}>
                        {esNota&&<div style={{ fontSize:10, fontWeight:700, marginBottom:3, opacity:0.8 }}>📝 Nota interna</div>}
                        {msg.reenviado&&<div style={{ fontSize:10, color:esMio?'rgba(255,255,255,0.7)':'#888', marginBottom:3 }}>↪ Reenviado</div>}
                        {msg.respondiendo&&(
                          <div style={{ borderLeft:`3px solid ${esMio?'rgba(255,255,255,0.5)':'var(--eco-primary,#185FA5)'}`, paddingLeft:8, marginBottom:6, opacity:0.8 }}>
                            <div style={{ fontSize:10, fontWeight:700, color:esMio?'rgba(255,255,255,0.9)':'var(--eco-primary,#185FA5)', marginBottom:1 }}>{msg.respondiendo.autorNombre}</div>
                            <div style={{ fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:180 }}>{msg.respondiendo.body}</div>
                          </div>
                        )}
                        {msg.tipo==='sticker'?<div style={{ position:'relative' }}><img src={msg.mediaUrl} alt="sticker" style={{ maxWidth:120, maxHeight:120, borderRadius:8, display:'block' }} /><button onClick={()=>guardarStickerFavorito(msg.mediaUrl)} style={{ position:'absolute', top:2, right:2, background:'rgba(0,0,0,.5)', border:'none', borderRadius:'50%', width:22, height:22, cursor:'pointer', color:'#fff', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center' }}>⭐</button></div>
                        :msg.tipo==='image'||msg.type==='image'||msg.tipo==='imagen'?(()=>{
                          const thumb = msg.thumbnail ? `data:image/jpeg;base64,${msg.thumbnail}` : null
                          const url = msg.mediaUrl && !msg.mediaUrl.includes('mmg.whatsapp.net') ? msg.mediaUrl : thumb
                          return url ? <img src={url} alt="img" style={{ maxWidth:200, maxHeight:200, borderRadius:8, display:'block', cursor:'pointer' }} onClick={()=>setImagenModal(url)} /> : <span style={{ fontSize:'12px', fontStyle:'italic' }}>📷 Imagen</span>
                        })()
                        :msg.tipo==='audio'||msg.type==='audio'?(()=>{
                          const url = msg.mediaUrl && !msg.mediaUrl.includes('mmg.whatsapp.net') ? msg.mediaUrl : null
                          return url ? <audio controls src={url} style={{ maxWidth:220, height:36 }} /> : <span style={{ fontSize:'12px', fontStyle:'italic', display:'flex', alignItems:'center', gap:4 }}>🎵 Audio{msg.mediaUrl ? ' (expirado)' : ''}</span>
                        })()
                        :msg.tipo==='video'||msg.type==='video'?(()=>{
                          const thumb = msg.thumbnail ? `data:image/jpeg;base64,${msg.thumbnail}` : null
                          const url = msg.mediaUrl && !msg.mediaUrl.includes('mmg.whatsapp.net') ? msg.mediaUrl : null
                          return url ? <video controls src={url} style={{ maxWidth:220, borderRadius:8 }} /> : thumb ? <div style={{ position:'relative', cursor:'pointer' }} onClick={()=>setImagenModal(thumb)}><img src={thumb} alt="video" style={{ maxWidth:200, maxHeight:200, borderRadius:8, display:'block', opacity:0.8 }} /><div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:40, height:40, borderRadius:'50%', background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:18 }}>▶</div></div> : <span style={{ fontSize:'12px', fontStyle:'italic' }}>🎬 Video{msg.mediaUrl ? ' (expirado)' : ''}</span>
                        })()
                        :msg.tipo==='file'?<a href={msg.mediaUrl} target="_blank" rel="noreferrer" style={{ color:esMio?'#fff':'#185FA5', fontSize:12 }}>📎 {msg.body}</a>
                        :<span>{msg.body}</span>}
                        <div style={{ fontSize:'10px', marginTop:'4px', textAlign:'right', display:'flex', alignItems:'center', justifyContent:'flex-end', gap:3 }}>
                          <span style={{ opacity:0.6 }}>{formatFecha(msg.timestamp)}</span>
                          {tipoActivo==='wa'&&!esMio&&msg.autorNombre&&<span style={{ opacity:0.6, marginLeft:4 }}>· {msg.autorNombre}</span>}
                          {esMio&&tipoActivo==='wa'&&<span style={{ fontSize:14, lineHeight:1, fontWeight:600 }}>{msg.leido===true?<span style={{ color:'#4FC3F7' }}>✓✓</span>:msg.timestamp?<span style={{ color:'rgba(255,255,255,0.75)' }}>✓✓</span>:<span style={{ color:'rgba(255,255,255,0.45)' }}>✓</span>}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="msg-actions" style={{ opacity:0, transition:'opacity .15s', display:'flex', flexDirection:'column', gap:4, alignSelf:'center', order:esMio?-1:1 }}>
                      <button onClick={()=>{setRespondiendo(msg);inputRef.current?.focus()}} style={{ background:'rgba(0,0,0,.08)', border:'none', borderRadius:6, cursor:'pointer', padding:'4px 8px', display:'flex', alignItems:'center', gap:4, fontSize:11, fontWeight:500, color:'#555', fontFamily:'inherit', whiteSpace:'nowrap' }}>↩ Responder</button>
                      <button onClick={()=>{setReenviando(msg);setShowReenviar(true)}} style={{ background:'rgba(0,0,0,.08)', border:'none', borderRadius:6, cursor:'pointer', padding:'4px 8px', display:'flex', alignItems:'center', gap:4, fontSize:11, fontWeight:500, color:'#555', fontFamily:'inherit', whiteSpace:'nowrap' }}>↪ Reenviar</button>
                    </div>
                  </div>
                )
              })}
              {showScrollBtn&&(
                <div style={{ position:'sticky', bottom:12, display:'flex', justifyContent:'center', pointerEvents:'none', zIndex:10 }}>
                  <button onClick={()=>mensajesRef.current?.scrollTo({top:mensajesRef.current.scrollHeight,behavior:'smooth'})} style={{ pointerEvents:'all', display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'rgba(255,255,255,.95)', border:'1px solid #e0e7ef', borderRadius:20, padding:'6px 16px', cursor:'pointer', boxShadow:'0 4px 16px rgba(0,0,0,.15)', fontFamily:'inherit' }}>
                    {fechaUltimo&&<span style={{ fontSize:10, color:'#888', fontWeight:500 }}>{fechaUltimo}</span>}
                    <span style={{ fontSize:11, color:'var(--eco-primary,#185FA5)', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>Ir al final</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {tabActiva==='resumen'&&(
            <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
              <TabResumenIA chatActivo={chatActivo} mensajes={mensajes} tipoActivo={tipoActivo} />
            </div>
          )}

          {(tipoActivo==='wa'||(tipoActivo==='interno'&&puedeVerIA))&&(
            <div style={{ display:'flex', borderTop:'1px solid #e0e7ef', background:'#fff', flexShrink:0 }}>
              {tabsActuales.map(t=>(
                <button key={t.key} onClick={()=>setTabActiva(t.key)} style={{ padding:'9px 16px', border:'none', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit', background:tabActiva===t.key?'#fff':'#fafafa', color:t.key==='resumen'?(tabActiva===t.key?'#185FA5':'#888'):(tabActiva===t.key?'#1a1a1a':'#aaa'), borderTop:tabActiva===t.key?`2px solid ${t.key==='resumen'?'#185FA5':t.key==='interno'?'#854F0B':'#185FA5'}`:'2px solid transparent', transition:'all .1s' }}>{t.label}</button>
              ))}
            </div>
          )}

          {tabActiva!=='resumen'&&(
            <div style={{ background:tabActiva==='interno'&&tipoActivo==='wa'?'#FFFBF5':'#fff', borderTop:'1px solid #e0e7ef', flexShrink:0 }}>
              {showPlantillas&&tipoActivo==='wa'&&(
                <div style={{ padding:'10px 14px', borderBottom:'1px solid #f0f2f5', background:'#fafafa', maxHeight:240, overflowY:'auto' }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'#888', marginBottom:8, textTransform:'uppercase', letterSpacing:'.5px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    📋 Plantillas WA
                    <input value={busqPlantilla} onChange={e=>setBusqPlantilla(e.target.value)} placeholder="Buscar..." style={{ fontSize:11, border:'0.5px solid #e0e0e0', borderRadius:6, padding:'3px 8px', outline:'none', fontFamily:'inherit', width:130 }} />
                  </div>
                  {plantillasWA.length===0?<div style={{ color:'#ccc', fontSize:12, textAlign:'center', padding:'10px 0' }}>Sin plantillas. Creá una en Configuración → Plantillas → WhatsApp</div>
                    :plantillasWA.filter(p=>!busqPlantilla||p.nombre.toLowerCase().includes(busqPlantilla.toLowerCase())||p.texto.toLowerCase().includes(busqPlantilla.toLowerCase())).map(p=>(
                      <div key={p.id} onClick={()=>{const texto=p.texto.replace(/\{\{nombre\}\}/g,chatActivo?.nombre||'').replace(/\{\{empresa\}\}/g,chatActivo?.empresa||'').replace(/\{\{vendedor\}\}/g,usuarioActual?.nombre||'');setMensaje(texto);setShowPlantillas(false);inputRef.current?.focus()}}
                        style={{ padding:'8px 10px', borderRadius:7, cursor:'pointer', marginBottom:4, border:'0.5px solid #e8ecf0', background:'#fff' }}
                        onMouseEnter={e=>e.currentTarget.style.background='#EEF3FA'} onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                        <div style={{ fontSize:12, fontWeight:600, color:'#1a1a1a', marginBottom:2 }}>{p.nombre}</div>
                        <div style={{ fontSize:11, color:'#888', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.texto}</div>
                      </div>
                    ))
                  }
                </div>
              )}
              {showStickers&&(
                <div style={{ padding:'10px 14px', borderBottom:'1px solid #f0f2f5', background:'#fafafa' }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'#888', marginBottom:8, textTransform:'uppercase', letterSpacing:'.5px' }}>Mis stickers ⭐<span style={{ float:'right', fontSize:10, color:'#bbb', fontWeight:400, textTransform:'none' }}>Guardá con ⭐</span></div>
                  {stickers.length===0?<div style={{ color:'#ccc', fontSize:12, textAlign:'center', padding:'10px 0' }}>Sin stickers guardados aún</div>
                    :<div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>{stickers.map(stk=><img key={stk.id} src={stk.url} alt="sticker" onClick={()=>enviarSticker(stk.url)} style={{ width:56, height:56, objectFit:'contain', borderRadius:8, cursor:'pointer', border:'1px solid #e0e0e0', padding:2, background:'#fff' }} onMouseEnter={e=>e.currentTarget.style.borderColor='var(--eco-primary)'} onMouseLeave={e=>e.currentTarget.style.borderColor='#e0e0e0'} />)}</div>
                  }
                </div>
              )}
              {respondiendo&&(
                <div style={{ padding:'8px 14px', background:'#f0f4f8', borderTop:'1px solid #e0e7ef', display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ flex:1, borderLeft:'3px solid var(--eco-primary,#185FA5)', paddingLeft:8 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--eco-primary,#185FA5)', marginBottom:1 }}>Respondiendo a {respondiendo.fromMe?'ti mismo':(respondiendo.autorNombre||chatActivo?.nombre)}</div>
                    <div style={{ fontSize:12, color:'#555', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:400 }}>{respondiendo.body||'📎 Archivo'}</div>
                  </div>
                  <button onClick={()=>setRespondiendo(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#aaa', fontSize:18, padding:'0 4px' }}>×</button>
                </div>
              )}
              <div style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 14px 0', borderBottom:'0.5px solid #f5f5f5' }}>
                <input ref={archivoRef} type="file" style={{ display:'none' }} accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={e=>{if(e.target.files[0])enviarAdjunto(e.target.files[0]);e.target.value=''}} />
                <button onClick={()=>archivoRef.current?.click()} style={{ width:32, height:32, borderRadius:8, border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#888' }} onMouseEnter={e=>e.currentTarget.style.background='#f0f2f5'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                </button>
                <button onClick={toggleGrabacion} style={{ width:32, height:32, borderRadius:8, border:'none', background:grabando?'#FCEBEB':'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:grabando?'#A32D2D':'#888' }} onMouseEnter={e=>{if(!grabando)e.currentTarget.style.background='#f0f2f5'}} onMouseLeave={e=>{if(!grabando)e.currentTarget.style.background='transparent'}}>
                  {grabando?<svg width="16" height="16" viewBox="0 0 24 24" fill="#A32D2D"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>}
                </button>
                {grabando&&<span style={{ fontSize:11, color:'#A32D2D', fontWeight:600 }}>● Grabando...</span>}
                <button onClick={()=>setShowStickers(s=>!s)} style={{ width:32, height:32, borderRadius:8, border:'none', background:showStickers?'#EAF3DE':'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }} onMouseEnter={e=>{if(!showStickers)e.currentTarget.style.background='#f0f2f5'}} onMouseLeave={e=>{if(!showStickers)e.currentTarget.style.background=showStickers?'#EAF3DE':'transparent'}}>🎭</button>
                {tipoActivo==='wa'&&tabActiva==='mensaje'&&(
                  <button onClick={()=>{setShowPlantillas(s=>!s);setBusqPlantilla('')}} style={{ height:32, padding:'0 10px', borderRadius:8, border:'none', background:showPlantillas?'#E6F1FB':'transparent', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, color:showPlantillas?'#185FA5':'#888', whiteSpace:'nowrap' }} onMouseEnter={e=>{if(!showPlantillas)e.currentTarget.style.background='#f0f2f5'}} onMouseLeave={e=>{if(!showPlantillas)e.currentTarget.style.background=showPlantillas?'#E6F1FB':'transparent'}}>📋 Plantillas</button>
                )}
                {tipoActivo==='interno'&&(
                  <button onClick={enviarNudge} style={{ width:32, height:32, borderRadius:8, border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }} onMouseEnter={e=>e.currentTarget.style.background='#E6F1FB'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <img src={NUDGE_IMG_URL} alt="nudge" style={{ width:22, height:22, objectFit:'contain' }} />
                  </button>
                )}
              </div>
              {imagenPegada&&(
                <div style={{ padding:'8px 14px 0', display:'flex', alignItems:'flex-start', gap:8 }}>
                  <div style={{ position:'relative', display:'inline-block' }}>
                    <img src={imagenPegada.preview} alt="preview" style={{ maxHeight:120, maxWidth:220, borderRadius:8, border:'1px solid #e0e0e0', display:'block' }} />
                    <button onClick={()=>{URL.revokeObjectURL(imagenPegada.preview);setImagenPegada(null)}} style={{ position:'absolute', top:-6, right:-6, width:20, height:20, borderRadius:'50%', background:'#A32D2D', border:'none', color:'#fff', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                  </div>
                  <button onClick={async()=>{await enviarAdjunto(imagenPegada.file);URL.revokeObjectURL(imagenPegada.preview);setImagenPegada(null)}} style={{ padding:'6px 14px', background:'var(--eco-primary,#185FA5)', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', alignSelf:'flex-end' }}>Enviar imagen</button>
                </div>
              )}
              <div style={{ display:'flex', gap:'8px', alignItems:'flex-end', padding:'8px 14px 12px' }}>
                <textarea ref={inputRef} value={mensaje} onChange={e=>setMensaje(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();enviarMensaje()}}}
                  onPaste={e=>{const items=e.clipboardData?.items;if(!items)return;for(const item of items){if(item.type.startsWith('image/')){e.preventDefault();const file=item.getAsFile();if(file){const preview=URL.createObjectURL(file);setImagenPegada({file,preview})}return}}}}
                  placeholder={tipoActivo==='interno'?'Escribe un mensaje interno...':tabActiva==='interno'?'Nota interna (solo visible para el equipo)...':'Escribe un mensaje de WhatsApp...'}
                  rows={3} style={{ flex:1, padding:'10px 12px', border:`1px solid ${tabActiva==='interno'&&tipoActivo==='wa'?'#EF9F27':'#dde3ed'}`, borderRadius:'10px', fontSize:'13px', color:'#1a1a1a', background:tabActiva==='interno'&&tipoActivo==='wa'?'#FFFBF5':'#fff', fontFamily:'inherit', outline:'none', resize:'none', lineHeight:1.5 }}
                />
                <button onClick={enviarMensaje} disabled={enviando||!mensaje.trim()} style={{ padding:'10px 20px', height:'fit-content', alignSelf:'flex-end', background:tipoActivo==='interno'?'#0F6E56':tabActiva==='interno'?'#854F0B':'var(--eco-primary,#1a3a5c)', color:'#fff', border:'none', borderRadius:'10px', fontSize:'13px', fontWeight:600, cursor:enviando||!mensaje.trim()?'not-allowed':'pointer', opacity:enviando||!mensaje.trim()?0.5:1, fontFamily:'inherit' }}>
                  {enviando?'...':'Enviar'}
                </button>
              </div>
            </div>
          )}
        </div>
      ):(
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'10px', background:'#f0f4f8', color:'#aaa' }}>
          <div style={{ fontSize:'2.5rem' }}>💬</div>
          <span style={{ fontSize:'14px' }}>Seleccioná una conversación</span>
          <span style={{ fontSize:12, color:'#ccc' }}>WhatsApp o canal interno</span>
        </div>
      )}

      {/* ════════ PANEL DERECHO ════════ */}
      {chatActivo&&(
        <div style={{ width:'270px', borderLeft:'1px solid #e0e7ef', background:'#fff', display:'flex', flexDirection:'column', flexShrink:0, overflowY:'auto' }}>
          {tipoActivo==='wa'&&(
            <>
              <div style={{ padding:'10px 14px', flex:1, overflowY:'auto' }}>
                {/* Agente */}
                <div style={{ display:'flex', alignItems:'center', gap:'4px', marginBottom:'8px' }}>
                  <span style={{ fontSize:9, color:'#8a99b3', fontWeight:600 }}>Agente:</span>
                  <select value={chatActivo.agente||''} onChange={e=>actualizarConversacion('agente',e.target.value)} style={{ ...sel, fontSize:'11px', padding:'2px 6px', flex:1 }}><option value="">Sin asignar</option>{usuarios.map(u=><option key={u.uid} value={u.uid}>{u.nombre||u.email}</option>)}</select>
                </div>
                {/* ── CONTACTO CRM ── */}
                {loadingContacto ? (
                  <div style={{ fontSize:'11px', color:'#aaa', textAlign:'center', padding:'8px 0' }}>Cargando contacto...</div>
                ) : contactoCRM && (<>
                  <div style={{ fontSize:'10px', color:'#2e7d32', fontWeight:600, marginBottom:'6px' }}>✓ Contacto CRM vinculado</div>
                  {/* Tipo */}
                  <div style={{ display:'flex', gap:'4px', marginBottom:'6px' }}>
                    {[['persona','👤 Persona'],['empresa','🏢 Empresa']].map(([val,lbl])=>(
                      <button key={val} onClick={()=>guardarContactoCRM('tipo',val)} style={{ flex:1, padding:'5px', borderRadius:'7px', border:`1.5px solid ${contactoCRM.tipo===val?(val==='empresa'?'#c5d8f8':'#a5d6a7'):'#dde3ed'}`, background:contactoCRM.tipo===val?(val==='empresa'?'#e8f0fe':'#e8f5e9'):'#fff', cursor:'pointer', fontFamily:'inherit', fontSize:'11px', fontWeight:600, color:contactoCRM.tipo===val?(val==='empresa'?'#1a3a5c':'#2e7d32'):'#888' }}>{lbl}</button>
                    ))}
                  </div>
                  {/* Datos del contacto */}
                  <div style={{ display:'flex', flexDirection:'column', gap:'3px', marginBottom:'6px' }}>
                    {[
                      {c:'nombre',l:'Nombre',p:'Nombre completo'},
                      ...(contactoCRM.tipo==='empresa' ? [{c:'empresaNombre',l:'Empresa',p:'Nombre empresa'},{c:'cargo',l:'Cargo',p:'Cargo'}] : []),
                      {c:'correo',l:'Email',p:'correo@email.com'},
                      {c:'whatsapp',l:'WhatsApp',p:'8888-8888'},
                      {c:'provincia',l:'Provincia',p:'Provincia'},
                    ].map(f=>(
                      <div key={f.c} style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                        <span style={{ color:'#8a99b3', minWidth:50, fontSize:9, fontWeight:600 }}>{f.l}</span>
                        <input value={contactoCRM[f.c]||''} placeholder={f.p} onBlur={e=>guardarContactoCRM(f.c,e.target.value)} onChange={e=>setContactoCRM(prev=>({...prev,[f.c]:e.target.value}))}
                          style={{ flex:1, border:'none', borderBottom:'1px solid transparent', outline:'none', fontSize:11, color:'#1a1a1a', fontWeight:500, padding:'2px 0', fontFamily:'inherit', background:'transparent' }}
                          onFocus={e=>e.target.style.borderBottomColor='#2563eb'} onMouseLeave={e=>{if(document.activeElement!==e.target)e.target.style.borderBottomColor='transparent'}} />
                      </div>
                    ))}
                  </div>
                  <Divider />
                  {/* Facturación */}
                  <SectionLabel>Facturación</SectionLabel>
                  <div style={{ display:'flex', gap:'4px', marginBottom:'6px' }}>
                    {[['fisica','👤 Física'],['juridica','🏢 Jurídica']].map(([val,lbl])=>(
                      <button key={val} onClick={()=>cambiarTipoFactCRM(val)} style={{ flex:1, padding:'5px', borderRadius:'7px', border:`1.5px solid ${(contactoCRM.facturacion?.tipoFact||'fisica')===val?(val==='juridica'?'#c5d8f8':'#a5d6a7'):'#dde3ed'}`, background:(contactoCRM.facturacion?.tipoFact||'fisica')===val?(val==='juridica'?'#e8f0fe':'#e8f5e9'):'#fff', cursor:'pointer', fontFamily:'inherit', fontSize:'10px', fontWeight:600, color:(contactoCRM.facturacion?.tipoFact||'fisica')===val?(val==='juridica'?'#1a3a5c':'#2e7d32'):'#888' }}>{lbl}</button>
                    ))}
                  </div>
                  <div style={{ background:'#f8fafc', borderRadius:'6px', padding:'6px 8px', border:'1px solid #e8edf5', marginBottom:'8px' }}>
                    {((contactoCRM.facturacion?.tipoFact||'fisica')==='juridica'
                      ? [{id:'razonSocial',l:'Razón social',p:'Empresa S.A.'},{id:'cedulaJuridica',l:'Cédula jur.',p:'3-101-XXXXXX'},{id:'correoFacturacion',l:'Correo fact.',p:'facturacion@empresa.com'}]
                      : [{id:'nombreFiscal',l:'Nombre fiscal',p:'Nombre completo'},{id:'cedulaFisica',l:'Cédula',p:'1-1234-5678'},{id:'correoFacturacion',l:'Correo fact.',p:'correo@email.com'}]
                    ).map(f=>(
                      <div key={f.id} style={{ display:'flex', alignItems:'center', gap:'4px', marginBottom:'3px' }}>
                        <span style={{ color:'#8a99b3', minWidth:55, fontSize:9, fontWeight:600 }}>{f.l}</span>
                        <input value={contactoCRM.facturacion?.campos?.[f.id]||''} placeholder={f.p}
                          onChange={e=>{const v=e.target.value; setContactoCRM(prev=>({...prev,facturacion:{...prev.facturacion,campos:{...prev.facturacion?.campos,[f.id]:v}}}))}}
                          onBlur={e=>guardarFacturacionCRM(contactoCRM.facturacion?.tipoFact||'fisica',f.id,e.target.value)}
                          style={{ flex:1, border:'none', borderBottom:'1px solid transparent', outline:'none', fontSize:11, color:'#1a1a1a', fontWeight:500, padding:'2px 0', fontFamily:'inherit', background:'transparent' }}
                          onFocus={e=>e.target.style.borderBottomColor='#2563eb'} />
                      </div>
                    ))}
                  </div>
                </>)}
                <Divider />
                {/* ── OBSERVACIONES ── */}
                <SectionLabel>Observaciones del contacto</SectionLabel>
                <textarea value={contactoCRM?.observaciones||''} onChange={e=>setContactoCRM(prev=>({...prev,observaciones:e.target.value}))} onBlur={e=>guardarContactoCRM('observaciones',e.target.value)} placeholder="Notas sobre este contacto..." style={{ width:'100%', border:'1px solid #e8ecf0', borderRadius:6, padding:'6px 8px', fontSize:11, outline:'none', fontFamily:'inherit', resize:'vertical', minHeight:40, boxSizing:'border-box', color:'#1a1a1a' }} />
                {contactoCRM?.empresaId && (
                  <>
                    <SectionLabel style={{ marginTop:6 }}>Observaciones de la empresa</SectionLabel>
                    <textarea value={contactoCRM?._obsEmpresa||''} onChange={e=>setContactoCRM(prev=>({...prev,_obsEmpresa:e.target.value}))} onBlur={async e=>{if(contactoCRM?.empresaId){await updateDoc(doc(db,'empresas',contactoCRM.empresaId),{observaciones:e.target.value}).catch(()=>{})}}} placeholder="Notas sobre la empresa..." style={{ width:'100%', border:'1px solid #e8ecf0', borderRadius:6, padding:'6px 8px', fontSize:11, outline:'none', fontFamily:'inherit', resize:'vertical', minHeight:40, boxSizing:'border-box', color:'#1a1a1a' }} />
                  </>
                )}
                <Divider />
                {/* ── RECORDATORIO ── */}
                <SectionLabel>Recordatorio</SectionLabel>
                <button onClick={()=>setModalRecordatorio(true)} style={{ width:'100%', padding:'7px', border:'1px dashed #185FA5', borderRadius:7, background:'#f8faff', color:'#185FA5', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>⏰ Crear recordatorio</button>
                <Divider />
                {/* ── LEADS CRM ── */}
                <SectionLabel>Leads activos ({leadsCRM.length})</SectionLabel>
                {leadsCRM.length===0&&<div style={{ fontSize:'11px', color:'#bbb', textAlign:'center', padding:'6px 0' }}>Sin leads abiertos</div>}
                {leadsCRM.map(lead=>(
                  <div key={lead.id} onClick={()=>navigate(`/crm/lead/${lead.id}`)} style={{ border:'1px solid #dde3ed', borderRadius:'8px', padding:'8px 10px', marginBottom:'6px', background:'#fafbfd', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#f0f4f8'} onMouseLeave={e=>e.currentTarget.style.background='#fafbfd'}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'12px', fontWeight:600, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lead.nombre||'Sin nombre'}</div>
                      <div style={{ fontSize:'10px', color:'#888' }}>{lead.tipoLead==='empresa'?'🏢':'👤'} {lead.origen||'—'}</div>
                    </div>
                    <EtapaBadge etapa={lead.columnaId||lead.etapa} columnas={columnsPipeline} />
                  </div>
                ))}
                <button onClick={iniciarCrearLead} style={{ width:'100%', padding:'8px', marginBottom:'6px', background:'var(--eco-primary,#1a3a5c)', color:'#fff', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>+ Crear lead</button>
                <Divider />
                {/* ── COLABORADORES ── */}
                <SectionLabel>Colaboradores</SectionLabel>
                {(chatActivo.colaboradores||[]).length>0 && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'4px', marginBottom:'6px' }}>
                    {(chatActivo.colaboradores||[]).map(uid=>{
                      const u=usuarios.find(u=>u.uid===uid)
                      return (
                        <div key={uid} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 8px', background:'#f8fafc', borderRadius:6, fontSize:11 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <Avatar nombre={u?.nombre||u?.email||'?'} size={20} />
                            <span style={{ fontWeight:500, color:'#1a1a1a' }}>{u?.nombre||u?.email||uid}</span>
                          </div>
                          <button onClick={()=>actualizarConversacion('colaboradores',(chatActivo.colaboradores||[]).filter(c=>c!==uid))}
                            style={{ background:'none', border:'none', cursor:'pointer', color:'#ccc', fontSize:14, padding:'0 2px' }}
                            onMouseEnter={e=>e.currentTarget.style.color='#E24B4A'} onMouseLeave={e=>e.currentTarget.style.color='#ccc'}>×</button>
                        </div>
                      )
                    })}
                  </div>
                )}
                <select onChange={e=>{
                  const uid=e.target.value; if(!uid) return
                  if((chatActivo.colaboradores||[]).includes(uid)) return
                  actualizarConversacion('colaboradores',[...(chatActivo.colaboradores||[]),uid])
                  e.target.value=''
                }} style={{ ...sel, fontSize:'11px', padding:'5px 8px', marginBottom:'6px' }}>
                  <option value="">+ Pedir ayuda a...</option>
                  {usuarios.filter(u=>u.uid!==chatActivo.agente&&!(chatActivo.colaboradores||[]).includes(u.uid)).map(u=>(
                    <option key={u.uid} value={u.uid}>{u.nombre||u.email}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          {/* ── MODAL CREAR LEAD ── */}
          {modalLead && (
            <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.4)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}
              onClick={e=>e.target===e.currentTarget&&setModalLead(null)}>
              <div style={{ background:'#fff', borderRadius:14, width:'90%', maxWidth:340, padding:20, boxShadow:'0 10px 40px rgba(0,0,0,.2)' }}>
                {modalLead==='tipo' && (<>
                  <div style={{ fontSize:14, fontWeight:700, color:'#1a3a5c', marginBottom:12 }}>¿Este lead es para...?</div>
                  <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                    <button onClick={()=>{setNuevoLead({tipoLead:'empresa',tipoFactura:'juridica'});setModalLead('nombre')}} style={{ flex:1, padding:'14px 8px', borderRadius:12, border:'1.5px solid #c5d8f8', background:'#e8f0fe', cursor:'pointer', fontFamily:'inherit', textAlign:'center' }}>
                      <div style={{ fontSize:24, marginBottom:4 }}>🏢</div>
                      <div style={{ fontSize:12, fontWeight:700, color:'#1a3a5c' }}>{contactoCRM?.empresaNombre||'Empresa'}</div>
                    </button>
                    <button onClick={()=>{setNuevoLead({tipoLead:'persona'});setModalLead('factura')}} style={{ flex:1, padding:'14px 8px', borderRadius:12, border:'1.5px solid #a5d6a7', background:'#e8f5e9', cursor:'pointer', fontFamily:'inherit', textAlign:'center' }}>
                      <div style={{ fontSize:24, marginBottom:4 }}>👤</div>
                      <div style={{ fontSize:12, fontWeight:700, color:'#2e7d32' }}>Personal</div>
                    </button>
                  </div>
                  <button onClick={()=>setModalLead(null)} style={{ width:'100%', padding:6, background:'none', border:'none', cursor:'pointer', fontSize:11, color:'#888', fontFamily:'inherit' }}>Cancelar</button>
                </>)}
                {modalLead==='factura' && (<>
                  <div style={{ fontSize:14, fontWeight:700, color:'#1a3a5c', marginBottom:6 }}>Factura a nombre de:</div>
                  <div style={{ fontSize:11, color:'#888', marginBottom:12 }}>El lead es personal, ¿pero la factura va a nombre de la empresa?</div>
                  <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                    <button onClick={()=>{setNuevoLead(p=>({...p,tipoFactura:'juridica'}));setModalLead('nombre')}} style={{ flex:1, padding:'12px 8px', borderRadius:12, border:'1.5px solid #c5d8f8', background:'#e8f0fe', cursor:'pointer', fontFamily:'inherit', textAlign:'center' }}>
                      <div style={{ fontSize:18, marginBottom:2 }}>🏢</div>
                      <div style={{ fontSize:11, fontWeight:600, color:'#1a3a5c' }}>Empresa</div>
                    </button>
                    <button onClick={()=>{setNuevoLead(p=>({...p,tipoFactura:'fisica'}));setModalLead('nombre')}} style={{ flex:1, padding:'12px 8px', borderRadius:12, border:'1.5px solid #a5d6a7', background:'#e8f5e9', cursor:'pointer', fontFamily:'inherit', textAlign:'center' }}>
                      <div style={{ fontSize:18, marginBottom:2 }}>👤</div>
                      <div style={{ fontSize:11, fontWeight:600, color:'#2e7d32' }}>Personal</div>
                    </button>
                  </div>
                  <button onClick={()=>setModalLead('tipo')} style={{ width:'100%', padding:6, background:'none', border:'none', cursor:'pointer', fontSize:11, color:'#888', fontFamily:'inherit' }}>← Volver</button>
                </>)}
                {modalLead==='nombre' && (<>
                  <div style={{ fontSize:14, fontWeight:700, color:'#1a3a5c', marginBottom:4 }}>Nombre del lead</div>
                  <div style={{ fontSize:11, color:'#888', marginBottom:10 }}>
                    {nuevoLead.tipoLead==='empresa'?'🏢 Empresa':'👤 Personal'} · Factura {nuevoLead.tipoFactura==='juridica'?'🏢 jurídica':'👤 física'}
                  </div>
                  <input id="input-nombre-lead" placeholder="Ej: Mantenimiento 3 equipos" autoFocus
                    style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #dde3ed', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none', marginBottom:12 }}
                    onFocus={e=>e.target.style.borderColor='#1a3a5c'} onBlur={e=>e.target.style.borderColor='#dde3ed'}
                    onKeyDown={e=>{if(e.key==='Enter')finalizarCrearLead(e.target.value)}} />
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={()=>setModalLead(contactoCRM?.empresaNombre?'tipo':null)} style={{ flex:1, padding:8, border:'1px solid #dde3ed', borderRadius:8, background:'#fff', cursor:'pointer', fontSize:12, fontFamily:'inherit', color:'#888' }}>Cancelar</button>
                    <button onClick={()=>finalizarCrearLead(document.getElementById('input-nombre-lead')?.value||'')} style={{ flex:1, padding:8, border:'none', borderRadius:8, background:'var(--eco-primary,#1a3a5c)', color:'#fff', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit' }}>Crear lead</button>
                  </div>
                </>)}
              </div>
            </div>
          )}
          {tipoActivo==='interno'&&(
            <div style={{ padding:'14px 14px', overflowY:'auto', flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <div style={{ width:36, height:36, borderRadius:'50%', background:'#0F6E56', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>💬</div>
                <div><div style={{ fontWeight:700, fontSize:13 }}>{chatActivo.nombre}</div><div style={{ fontSize:10, color:'#888' }}>Chat grupal</div></div>
              </div>
              {/* Miembros compacto */}
              <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:10 }}>
                {(chatActivo.miembros||[]).map(uid=>{const u=usuarios.find(u=>u.uid===uid);return(
                  <div key={uid} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px', background:'#f0faf6', borderRadius:12, fontSize:10 }}>
                    <Avatar nombre={u?.nombre||'?'} size={16} />
                    <span style={{ fontWeight:500 }}>{(u?.nombre||u?.email||'').split(' ')[0]}</span>
                  </div>
                )})}
              </div>
              <Divider />
              {/* ── TAREAS ── */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                <SectionLabel>Tareas ({tareas.filter(t=>t.estado!=='completada').length})</SectionLabel>
                <button onClick={()=>setModalTarea(true)} style={{ background:'none', border:'1px solid #0F6E56', borderRadius:6, padding:'3px 8px', fontSize:10, fontWeight:600, color:'#0F6E56', cursor:'pointer', fontFamily:'inherit' }}>+ Nueva</button>
              </div>
              <div style={{ display:'flex', gap:3, marginBottom:8 }}>
                {[['pendientes','Pendientes'],['mias','Mis tareas'],['todas','Todas']].map(([k,l])=>(
                  <button key={k} onClick={()=>setFiltroTareas(k)} style={{ padding:'3px 8px', borderRadius:6, fontSize:9, fontWeight:600, cursor:'pointer', fontFamily:'inherit', border:`1px solid ${filtroTareas===k?'#0F6E56':'#dde3ed'}`, background:filtroTareas===k?'#0F6E56':'#fff', color:filtroTareas===k?'#fff':'#888' }}>{l}</button>
                ))}
              </div>
              {tareas.filter(t=>{
                if(filtroTareas==='pendientes') return t.estado!=='completada'
                if(filtroTareas==='mias') return (t.asignados||[]).includes(usuarioActual?.uid)&&t.estado!=='completada'
                return true
              }).map(t=>{
                const prioColor={alta:'#E24B4A',media:'#EF9F27',baja:'#888'}
                return (
                  <div key={t.id} style={{ border:'1px solid #e8edf5', borderRadius:8, padding:'8px 10px', marginBottom:6, background:t.estado==='completada'?'#f0faf4':'#fafbfd' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', gap:6 }}>
                      <button onClick={()=>cambiarEstadoTarea(t.id, t.estado==='completada'?'pendiente':'completada')}
                        style={{ width:18, height:18, borderRadius:4, border:`1.5px solid ${t.estado==='completada'?'#0F6E56':'#ccc'}`, background:t.estado==='completada'?'#0F6E56':'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
                        {t.estado==='completada'&&<span style={{ color:'#fff', fontSize:11, lineHeight:1 }}>✓</span>}
                      </button>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:t.estado==='completada'?'#888':'#1a1a1a', textDecoration:t.estado==='completada'?'line-through':'none' }}>{t.titulo}</div>
                        {t.descripcion&&<div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>{t.descripcion}</div>}
                        <div style={{ display:'flex', gap:4, marginTop:4, flexWrap:'wrap', alignItems:'center' }}>
                          <span style={{ fontSize:8, padding:'1px 5px', borderRadius:4, background:prioColor[t.prioridad||'media']+'20', color:prioColor[t.prioridad||'media'], fontWeight:700 }}>{(t.prioridad||'media').toUpperCase()}</span>
                          {(t.asignados||[]).map(uid=>{const u=usuarios.find(u=>u.uid===uid);return(
                            <span key={uid} style={{ fontSize:9, color:'#888' }}>{(u?.nombre||'').split(' ')[0]}</span>
                          )})}
                          {t.fechaLimite&&<span style={{ fontSize:9, color:new Date(t.fechaLimite)<new Date()?'#E24B4A':'#888' }}>📅 {t.fechaLimite}</span>}
                        </div>
                      </div>
                    </div>
                    {t.estado!=='completada'&&t.estado!=='progreso'&&(
                      <button onClick={()=>cambiarEstadoTarea(t.id,'progreso')} style={{ width:'100%', marginTop:6, padding:4, border:'1px solid #e8edf5', borderRadius:5, background:'#fff', cursor:'pointer', fontSize:10, color:'#0F6E56', fontWeight:600, fontFamily:'inherit' }}>▶ En progreso</button>
                    )}
                  </div>
                )
              })}
              {tareas.filter(t=>filtroTareas==='pendientes'?t.estado!=='completada':true).length===0&&(
                <div style={{ fontSize:11, color:'#bbb', textAlign:'center', padding:'10px 0' }}>Sin tareas</div>
              )}
            </div>
          )}
          {/* ── MODAL NUEVA TAREA ── */}
          {modalTarea&&(
            <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.4)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}
              onClick={e=>e.target===e.currentTarget&&setModalTarea(false)}>
              <div style={{ background:'#fff', borderRadius:14, width:'90%', maxWidth:340, padding:20, boxShadow:'0 10px 40px rgba(0,0,0,.2)' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#0F6E56', marginBottom:12 }}>Nueva tarea</div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  <div>
                    <span style={{ fontSize:10, color:'#8a99b3', fontWeight:600 }}>Título *</span>
                    <input id="tarea-titulo" placeholder="¿Qué hay que hacer?" autoFocus
                      style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #dde3ed', borderRadius:8, fontSize:12, fontFamily:'inherit', outline:'none' }}
                      onFocus={e=>e.target.style.borderColor='#0F6E56'} onBlur={e=>e.target.style.borderColor='#dde3ed'} />
                  </div>
                  <div>
                    <span style={{ fontSize:10, color:'#8a99b3', fontWeight:600 }}>Descripción</span>
                    <textarea id="tarea-desc" rows={2} placeholder="Detalles (opcional)"
                      style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #dde3ed', borderRadius:8, fontSize:11, fontFamily:'inherit', outline:'none', resize:'vertical' }} />
                  </div>
                  <div>
                    <span style={{ fontSize:10, color:'#8a99b3', fontWeight:600 }}>Asignar a</span>
                    <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:4 }}>
                      {(chatActivo?.miembros||[]).map(uid=>{const u=usuarios.find(u=>u.uid===uid);return(
                        <label key={uid} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:8, border:'1px solid #dde3ed', fontSize:10, cursor:'pointer', background:'#fff' }}>
                          <input type="checkbox" defaultChecked={uid===usuarioActual?.uid} data-uid={uid} style={{ width:12, height:12, accentColor:'#0F6E56' }} />
                          {(u?.nombre||u?.email||'').split(' ')[0]}
                        </label>
                      )})}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <div style={{ flex:1 }}>
                      <span style={{ fontSize:10, color:'#8a99b3', fontWeight:600 }}>Prioridad</span>
                      <select id="tarea-prio" defaultValue="media" style={{ width:'100%', padding:'6px 8px', border:'1.5px solid #dde3ed', borderRadius:8, fontSize:11, fontFamily:'inherit' }}>
                        <option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option>
                      </select>
                    </div>
                    <div style={{ flex:1 }}>
                      <span style={{ fontSize:10, color:'#8a99b3', fontWeight:600 }}>Fecha límite</span>
                      <input id="tarea-fecha" type="date" style={{ width:'100%', padding:'6px 8px', border:'1.5px solid #dde3ed', borderRadius:8, fontSize:11, fontFamily:'inherit' }} />
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, marginTop:14 }}>
                  <button onClick={()=>setModalTarea(false)} style={{ flex:1, padding:8, border:'1px solid #dde3ed', borderRadius:8, background:'#fff', cursor:'pointer', fontSize:12, fontFamily:'inherit', color:'#888' }}>Cancelar</button>
                  <button onClick={()=>{
                    const titulo=document.getElementById('tarea-titulo')?.value
                    if(!titulo?.trim()){alert('El título es obligatorio');return}
                    const checks=document.querySelectorAll('[data-uid]:checked')
                    const asignados=Array.from(checks).map(c=>c.dataset.uid)
                    crearTareaChat({
                      titulo:titulo.trim(),
                      descripcion:document.getElementById('tarea-desc')?.value||'',
                      asignados,
                      prioridad:document.getElementById('tarea-prio')?.value||'media',
                      fechaLimite:document.getElementById('tarea-fecha')?.value||'',
                    })
                    setModalTarea(false)
                  }} style={{ flex:1, padding:8, border:'none', borderRadius:8, background:'#0F6E56', color:'#fff', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit' }}>Crear tarea</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showReenviar&&reenviando&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', backdropFilter:'blur(3px)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={()=>setShowReenviar(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:14, width:'90%', maxWidth:400, maxHeight:'70vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ padding:'14px 18px', borderBottom:'0.5px solid #eee', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontWeight:600, fontSize:14 }}>↪ Reenviar a...</span>
              <button onClick={()=>setShowReenviar(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#aaa' }}>×</button>
            </div>
            <div style={{ padding:'8px 14px', borderBottom:'0.5px solid #f0f0f0', background:'#fafafa' }}>
              <div style={{ fontSize:11, color:'#888', fontWeight:600, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:6 }}>Mensaje a reenviar</div>
              <div style={{ fontSize:12, color:'#555', borderLeft:'3px solid var(--eco-primary,#185FA5)', paddingLeft:8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{reenviando.body||'📎 Archivo'}</div>
            </div>
            <div style={{ flex:1, overflowY:'auto' }}>
              {[...conversaciones.map(c=>({...c,_tipo:'wa'})),...gruposInternos.map(g=>({...g,_tipo:'interno'}))].map(dest=>(
                <div key={`${dest._tipo}-${dest.id}`} onClick={()=>ejecutarReenvio(dest)} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 18px', cursor:'pointer', borderBottom:'0.5px solid #f5f5f5' }} onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'} onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:dest._tipo==='interno'?'#0F6E56':'var(--eco-primary,#185FA5)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:14, flexShrink:0 }}>{dest._tipo==='interno'?'💬':(dest.nombre?.[0]||'?').toUpperCase()}</div>
                  <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{dest.nombre}</div><div style={{ fontSize:10, color:'#aaa' }}>{dest._tipo==='interno'?'💬 Interno':'📱 WhatsApp'}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {imagenModal&&(
        <div onClick={()=>setImagenModal(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', cursor:'zoom-out' }}>
          <div onClick={e=>e.stopPropagation()} style={{ position:'relative', maxWidth:'90vw', maxHeight:'90vh' }}>
            <img src={imagenModal} alt="img" style={{ maxWidth:'90vw', maxHeight:'90vh', objectFit:'contain', borderRadius:10, display:'block', boxShadow:'0 8px 40px rgba(0,0,0,.5)' }} />
            <button onClick={()=>setImagenModal(null)} style={{ position:'absolute', top:-14, right:-14, width:32, height:32, borderRadius:'50%', background:'#fff', border:'none', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(0,0,0,.3)', color:'#333' }}>×</button>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  )
}
