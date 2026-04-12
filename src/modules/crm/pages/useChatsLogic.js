/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: useChatsLogic.js
 * Módulo:  CRM — Hook de lógica de negocio del módulo Chats
 * ============================================================
 */

import { useEffect, useState, useRef } from 'react'
import {
  collection, query, orderBy, onSnapshot, doc,
  updateDoc, addDoc, serverTimestamp, getDocs, where, getDoc,
} from 'firebase/firestore'
import { db } from '../../../firebase/config'
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useAuth } from '../../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import {
  WASENDER_URL, WASENDER_TOKEN, NUDGE_AUDIO_URL,
  ROLES_SUPERVISOR, ROLES_RESUMEN_IA, ETAPAS_CERRADAS,
} from './ChatsHelpers'

export default function useChatsLogic() {
  const { usuario, currentUser } = useAuth()
  const navigate = useNavigate()
  const usuarioActual = usuario || currentUser

  // ── Estado principal ──────────────────────────────────────────────────────
  const [conversaciones,  setConversaciones]  = useState([])
  const [gruposInternos,  setGruposInternos]  = useState([])
  const [chatActivo,      setChatActivo]       = useState(null)
  const [tipoActivo,      setTipoActivo]       = useState('wa')
  const [mensajes,        setMensajes]         = useState([])
  const [mensaje,         setMensaje]          = useState('')
  const [enviando,        setEnviando]         = useState(false)
  const [usuarios,        setUsuarios]         = useState([])
  const [tabActiva,       setTabActiva]        = useState('mensaje')
  const [etapasPipeline,  setEtapasPipeline]   = useState([])

  // ── Estado de filtros ─────────────────────────────────────────────────────
  const [filtroLista,     setFiltroLista]      = useState('todos')
  const [busqueda,        setBusqueda]         = useState('')
  const [filtroAgente,    setFiltroAgente]     = useState('todos')
  const [filtroEtapa,     setFiltroEtapa]      = useState('')
  const [filtroEtiqueta,  setFiltroEtiqueta]   = useState('')
  const [verSoloMisChats, setVerSoloMisChats]  = useState(false)
  const [filtroNoLeidos,  setFiltroNoLeidos]   = useState('todos')
  const [showNuevoGrupo,  setShowNuevoGrupo]   = useState(false)
  const [showNuevoChat,   setShowNuevoChat]    = useState(false)
  const [nuevoNumero,     setNuevoNumero]      = useState('')

  // ── Estado de UI del chat ─────────────────────────────────────────────────
  const [grabando,        setGrabando]         = useState(false)
  const [mediaRecorder,   setMediaRecorder]    = useState(null)
  const [showStickers,    setShowStickers]     = useState(false)
  const [stickers,        setStickers]         = useState([])
  const [imagenPegada,    setImagenPegada]     = useState(null)
  const [imagenModal,     setImagenModal]      = useState(null)
  const [showPlantillas,  setShowPlantillas]   = useState(false)
  const [plantillasWA,    setPlantillasWA]     = useState([])
  const [busqPlantilla,   setBusqPlantilla]    = useState('')
  const [respondiendo,    setRespondiendo]     = useState(null)
  const [reenviando,      setReenviando]       = useState(null)
  const [showReenviar,    setShowReenviar]     = useState(false)

  // ── Isotipo + Nudge ───────────────────────────────────────────────────────
  const [isotipoUrl,      setIsotipoUrl]       = useState(null)
  const [shakingChat,     setShakingChat]      = useState(false)
  const [enviandoNudge,   setEnviandoNudge]    = useState(false)
  const nudgeAudioRef     = useRef(new Audio(NUDGE_AUDIO_URL))
  const ultimoNudgeRef    = useRef(null)

  // ── Refs ──────────────────────────────────────────────────────────────────
  const mensajesRef  = useRef(null)
  const inputRef     = useRef(null)
  const unsubMsgs    = useRef(null)
  const archivoRef   = useRef(null)

  // ── Permisos ──────────────────────────────────────────────────────────────
  const esSupervisor = ROLES_SUPERVISOR.includes(usuarioActual?.rol)
  const puedeVerIA   = ROLES_RESUMEN_IA.includes(usuarioActual?.rol)
  const etapasActivas = etapasPipeline.filter(e => !ETAPAS_CERRADAS.includes(e.valor))

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

  // ── Effects: datos globales ───────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'pipeline_columnas'), orderBy('orden', 'asc'))
    return onSnapshot(q, snap => {
      setEtapasPipeline(snap.docs.map(d => ({
        valor: d.id, label: d.data().nombre, color: d.data().color || '#888', orden: d.data().orden ?? 99,
      })))
    })
  }, [])

  useEffect(() => {
    getDoc(doc(db, 'configuracion', 'empresa')).then(snap => {
      if (snap.exists() && snap.data().isotipo) setIsotipoUrl(snap.data().isotipo)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    getDocs(collection(db, 'usuarios')).then(snap => {
      setUsuarios(snap.docs.map(d => ({ uid: d.id, ...d.data() })))
    })
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'conversaciones'), orderBy('timestamp', 'desc'))
    return onSnapshot(q, snap => setConversaciones(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [])

  useEffect(() => {
    if (!usuarioActual?.uid) return
    const q = query(collection(db, 'chats_internos'), where('miembros', 'array-contains', usuarioActual.uid))
    return onSnapshot(q, snap => setGruposInternos(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [usuarioActual?.uid])

  // ── Effect: mensajes del chat activo ─────────────────────────────────────
  useEffect(() => {
    if (unsubMsgs.current) { unsubMsgs.current(); unsubMsgs.current = null }
    if (!chatActivo) { setMensajes([]); return }
    const col = tipoActivo === 'wa'
      ? `conversaciones/${chatActivo.id}/mensajes`
      : `chats_internos/${chatActivo.id}/mensajes`
    const q = query(collection(db, col), orderBy('timestamp', 'asc'))
    unsubMsgs.current = onSnapshot(q, snap => {
      setMensajes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setTimeout(() => { if (mensajesRef.current) mensajesRef.current.scrollTop = mensajesRef.current.scrollHeight }, 50)
    })
    if (tipoActivo === 'wa' && chatActivo.noLeidos > 0)
      updateDoc(doc(db, 'conversaciones', chatActivo.id), { noLeidos: 0 }).catch(() => {})
    if (tipoActivo === 'interno') {
      const nl = chatActivo.noLeidos || {}
      if (nl[usuarioActual?.uid] > 0)
        updateDoc(doc(db, 'chats_internos', chatActivo.id), { [`noLeidos.${usuarioActual.uid}`]: 0 }).catch(() => {})
    }
    return () => { if (unsubMsgs.current) unsubMsgs.current() }
  }, [chatActivo?.id, tipoActivo])

  useEffect(() => {
    if (mensajesRef.current) mensajesRef.current.scrollTop = mensajesRef.current.scrollHeight
  }, [mensajes])

  // ── Effect: escuchar zumbidos entrantes ───────────────────────────────────
  useEffect(() => {
    if (!chatActivo?.id || !usuarioActual?.uid) return
    const col = tipoActivo === 'wa' ? 'conversaciones' : 'chats_internos'
    const q = query(
      collection(db, 'zumbidos'),
      where('chatId', '==', chatActivo.id),
      where('coleccion', '==', col),
      orderBy('creadoEn', 'desc')
    )
    return onSnapshot(q, snap => {
      if (snap.empty) return
      const ultimo = snap.docs[0]
      const data   = ultimo.data()
      if (
        data.emisorId !== usuarioActual.uid &&
        data.creadoEn?.toDate &&
        (Date.now() - data.creadoEn.toDate().getTime()) < 5000 &&
        ultimo.id !== ultimoNudgeRef.current
      ) {
        ultimoNudgeRef.current = ultimo.id
        setShakingChat(true)
        setTimeout(() => setShakingChat(false), 800)
        try { nudgeAudioRef.current.currentTime = 0; nudgeAudioRef.current.play().catch(() => {}) } catch (e) {}
      }
    })
  }, [chatActivo?.id, tipoActivo, usuarioActual?.uid])

  // ── Effect: stickers ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!usuarioActual?.uid) return
    const q = query(collection(db, `usuarios/${usuarioActual.uid}/stickers`), orderBy('creadoEn', 'desc'))
    return onSnapshot(q, snap => setStickers(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [usuarioActual?.uid])

  // ── Effect: plantillas WA ─────────────────────────────────────────────────
  useEffect(() => {
    getDoc(doc(db, 'configuracion', 'plantillas_wa')).then(snap => {
      if (snap.exists()) setPlantillasWA(snap.data().plantillas || [])
    }).catch(() => {})
  }, [])

  // ── Lista filtrada ────────────────────────────────────────────────────────
  const listaFiltrada = (() => {
    const wa = conversaciones.filter(c => {
      if (filtroLista === 'interno') return false
      if (busqueda && !c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) && !c.telefono?.includes(busqueda)) return false
      if (filtroAgente !== 'todos' && c.agente !== filtroAgente) return false
      if (filtroEtapa && !(c.leads || []).some(l => l.etapa === filtroEtapa)) return false
      if (filtroEtiqueta && c.etiqueta !== filtroEtiqueta) return false
      if (esSupervisor && verSoloMisChats && c.agente !== usuarioActual?.uid) return false
      if (!esSupervisor && c.agente && c.agente !== usuarioActual?.uid) return false
      if (filtroNoLeidos === 'noLeidos' && (c.noLeidos || 0) === 0) return false
      if (filtroNoLeidos === 'leidos' && (c.noLeidos || 0) > 0) return false
      return true
    }).map(c => ({ ...c, _tipo: 'wa' }))

    const internos = gruposInternos.filter(g => {
      if (filtroLista === 'wa') return false
      if (busqueda && !g.nombre?.toLowerCase().includes(busqueda.toLowerCase())) return false
      return true
    }).map(g => ({ ...g, _tipo: 'interno' }))

    const getTs = item => {
      const ts = item._tipo === 'interno' ? item.ultimoMensajeEn : item.timestamp
      if (!ts) return 0
      if (ts?.toDate) return ts.toDate().getTime()
      if (ts?.seconds) return ts.seconds * 1000
      if (typeof ts === 'number') return ts * 1000
      return new Date(ts).getTime()
    }
    const all = filtroLista === 'wa' ? wa : filtroLista === 'interno' ? internos : [...internos, ...wa]
    return all.sort((a, b) => getTs(b) - getTs(a))
  })()

  // ── Acciones de chat ──────────────────────────────────────────────────────
  function seleccionarChat(item) {
    setChatActivo(item)
    setTipoActivo(item._tipo)
    setTabActiva('mensaje')
    inputRef.current?.focus()
  }

  async function enviarWA() {
    if (!mensaje.trim() || !chatActivo || enviando) return
    setEnviando(true)
    const texto = mensaje.trim()
    setMensaje('')
    try {
      const telefono = chatActivo.telefono?.replace(/[^0-9]/g, '')
      const res  = await fetch(`${WASENDER_URL}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${WASENDER_TOKEN}` },
        body: JSON.stringify({ to: `+${telefono}`, text: texto }),
      })
      const data = await res.json()
      if (data?.success !== false) {
        await addDoc(collection(db, `conversaciones/${chatActivo.id}/mensajes`), {
          body: texto, fromMe: true, tipo: 'texto', timestamp: serverTimestamp(),
          autorNombre: usuarioActual?.nombre || usuarioActual?.email || 'Agente',
          autorFoto:   usuarioActual?.fotoURL || null,
          ...(respondiendo ? { respondiendo: { id: respondiendo.id, body: respondiendo.body, autorNombre: respondiendo.fromMe ? (usuarioActual?.nombre || 'Agente') : chatActivo.nombre } } : {}),
        })
        setRespondiendo(null)
        await updateDoc(doc(db, 'conversaciones', chatActivo.id), { ultimoMensaje: texto, timestamp: Math.floor(Date.now() / 1000) })
      }
    } catch (e) { console.error('Error enviando WA:', e) }
    finally { setEnviando(false) }
  }

  async function enviarNotaInterna() {
    if (!mensaje.trim() || !chatActivo || enviando) return
    setEnviando(true)
    const texto = mensaje.trim()
    setMensaje('')
    try {
      await addDoc(collection(db, `conversaciones/${chatActivo.id}/mensajes`), {
        body: texto, fromMe: true, tipo: 'nota_interna', timestamp: serverTimestamp(),
        autorNombre: usuarioActual?.nombre || usuarioActual?.email || 'Agente',
        autorFoto:   usuarioActual?.fotoURL || null,
      })
    } catch (e) { console.error('Error enviando nota:', e) }
    finally { setEnviando(false) }
  }

  async function enviarInterno() {
    if (!mensaje.trim() || !chatActivo || enviando) return
    setEnviando(true)
    const texto = mensaje.trim()
    setMensaje('')
    try {
      await addDoc(collection(db, `chats_internos/${chatActivo.id}/mensajes`), {
        body: texto, autorId: usuarioActual?.uid,
        autorNombre: usuarioActual?.nombre || usuarioActual?.email || 'Agente',
        autorFoto:   usuarioActual?.fotoURL || null,
        timestamp: serverTimestamp(),
        ...(respondiendo ? { respondiendo: { id: respondiendo.id, body: respondiendo.body, autorNombre: respondiendo.autorNombre || 'Usuario' } } : {}),
      })
      setRespondiendo(null)
      const noLeidos = {}
      ;(chatActivo.miembros || []).forEach(uid => {
        if (uid !== usuarioActual?.uid) noLeidos[`noLeidos.${uid}`] = (chatActivo.noLeidos?.[uid] || 0) + 1
      })
      await updateDoc(doc(db, 'chats_internos', chatActivo.id), { ultimoMensaje: texto, ultimoMensajeEn: serverTimestamp(), ...noLeidos })
    } catch (e) { console.error('Error enviando interno:', e) }
    finally { setEnviando(false) }
  }

  function enviarMensaje() {
    if (tipoActivo === 'interno') return enviarInterno()
    if (tabActiva === 'interno') return enviarNotaInterna()
    return enviarWA()
  }

  // ── Nudge / Zumbido ───────────────────────────────────────────────────────
  async function enviarNudge() {
    if (!chatActivo || enviandoNudge) return
    setEnviandoNudge(true)
    setShakingChat(true)
    setTimeout(() => setShakingChat(false), 800)
    try { nudgeAudioRef.current.currentTime = 0; nudgeAudioRef.current.play().catch(() => {}) } catch (e) {}
    try {
      const col = tipoActivo === 'wa' ? 'conversaciones' : 'chats_internos'
      await addDoc(collection(db, 'zumbidos'), {
        chatId: chatActivo.id, coleccion: col,
        emisorId: usuarioActual?.uid,
        emisorNombre: usuarioActual?.nombre || 'Agente',
        creadoEn: serverTimestamp(),
      })
    } catch (e) { console.error('Error enviando nudge:', e) }
    finally { setTimeout(() => setEnviandoNudge(false), 3000) }
  }

  // ── Stickers ──────────────────────────────────────────────────────────────
  async function guardarStickerFavorito(url) {
    if (!usuarioActual?.uid) return
    try { await addDoc(collection(db, `usuarios/${usuarioActual.uid}/stickers`), { url, creadoEn: serverTimestamp() }) } catch (e) {}
  }

  async function enviarSticker(url) {
    if (!chatActivo) return
    setShowStickers(false)
    try {
      if (tipoActivo === 'wa') {
        await fetch(`${WASENDER_URL}/send-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${WASENDER_TOKEN}` },
          body: JSON.stringify({ to: `+${chatActivo.telefono?.replace(/[^0-9]/g, '')}`, url, caption: '' }),
        })
        await addDoc(collection(db, `conversaciones/${chatActivo.id}/mensajes`), {
          body: '', tipo: 'sticker', mediaUrl: url, fromMe: true, timestamp: serverTimestamp(),
          autorNombre: usuarioActual?.nombre || 'Agente', autorFoto: usuarioActual?.fotoURL || null,
        })
        await updateDoc(doc(db, 'conversaciones', chatActivo.id), { ultimoMensaje: '🎭 Sticker', timestamp: Math.floor(Date.now() / 1000) })
      } else {
        await addDoc(collection(db, `chats_internos/${chatActivo.id}/mensajes`), {
          body: '', tipo: 'sticker', mediaUrl: url, autorId: usuarioActual?.uid,
          autorNombre: usuarioActual?.nombre || 'Agente', autorFoto: usuarioActual?.fotoURL || null,
          timestamp: serverTimestamp(),
        })
        const noLeidos = {}
        ;(chatActivo.miembros || []).forEach(uid => {
          if (uid !== usuarioActual?.uid) noLeidos[`noLeidos.${uid}`] = (chatActivo.noLeidos?.[uid] || 0) + 1
        })
        await updateDoc(doc(db, 'chats_internos', chatActivo.id), { ultimoMensaje: '🎭 Sticker', ultimoMensajeEn: serverTimestamp(), ...noLeidos })
      }
    } catch (e) { console.error('Error enviando sticker:', e) }
  }

  // ── Adjuntos ──────────────────────────────────────────────────────────────
  async function enviarAdjunto(file) {
    if (!file || !chatActivo) return
    const esImagen = file.type.startsWith('image/')
    const esVideo  = file.type.startsWith('video/')
    const esAudio  = file.type.startsWith('audio/')
    try {
      const storage = getStorage()
      const r = storageRef(storage, `chats/${chatActivo.id}/${Date.now()}_${file.name}`)
      await uploadBytes(r, file)
      const url  = await getDownloadURL(r)
      const tipo = esImagen ? 'image' : esVideo ? 'video' : esAudio ? 'audio' : 'file'
      const colPath = tipoActivo === 'wa' ? `conversaciones/${chatActivo.id}/mensajes` : `chats_internos/${chatActivo.id}/mensajes`
      const datos = { body: file.name, tipo, mediaUrl: url, fromMe: true, timestamp: serverTimestamp(), autorNombre: usuarioActual?.nombre || 'Agente', autorFoto: usuarioActual?.fotoURL || null }
      if (tipoActivo === 'interno') { datos.autorId = usuarioActual?.uid; delete datos.fromMe }
      await addDoc(collection(db, colPath), datos)
      const label = esImagen ? '📷 Imagen' : esVideo ? '🎬 Video' : esAudio ? '🎵 Audio' : `📎 ${file.name}`
      if (tipoActivo === 'wa') {
        await updateDoc(doc(db, 'conversaciones', chatActivo.id), { ultimoMensaje: label, timestamp: Math.floor(Date.now() / 1000) })
      } else {
        const noLeidos = {}
        ;(chatActivo.miembros || []).forEach(uid => {
          if (uid !== usuarioActual?.uid) noLeidos[`noLeidos.${uid}`] = (chatActivo.noLeidos?.[uid] || 0) + 1
        })
        await updateDoc(doc(db, 'chats_internos', chatActivo.id), { ultimoMensaje: label, ultimoMensajeEn: serverTimestamp(), ...noLeidos })
      }
    } catch (e) { console.error('Error enviando adjunto:', e) }
  }

  // ── Reenviar ──────────────────────────────────────────────────────────────
  async function ejecutarReenvio(destino) {
    if (!reenviando) return
    setShowReenviar(false)
    const { body: texto = '', mediaUrl = null, tipo = 'texto' } = reenviando
    try {
      if (destino._tipo === 'wa') {
        if (texto) await fetch(`${WASENDER_URL}/send-message`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${WASENDER_TOKEN}` }, body: JSON.stringify({ to: `+${destino.telefono?.replace(/[^0-9]/g, '')}`, text: `↪ Reenviado:\n${texto}` }) })
        await addDoc(collection(db, `conversaciones/${destino.id}/mensajes`), { body: texto, tipo, mediaUrl, fromMe: true, reenviado: true, timestamp: serverTimestamp(), autorNombre: usuarioActual?.nombre || 'Agente', autorFoto: usuarioActual?.fotoURL || null })
        await updateDoc(doc(db, 'conversaciones', destino.id), { ultimoMensaje: texto || '↪ Reenviado', timestamp: Math.floor(Date.now() / 1000) })
      } else {
        await addDoc(collection(db, `chats_internos/${destino.id}/mensajes`), { body: texto, tipo, mediaUrl, reenviado: true, autorId: usuarioActual?.uid, autorNombre: usuarioActual?.nombre || 'Agente', autorFoto: usuarioActual?.fotoURL || null, timestamp: serverTimestamp() })
        const noLeidos = {}
        ;(destino.miembros || []).forEach(uid => { if (uid !== usuarioActual?.uid) noLeidos[`noLeidos.${uid}`] = (destino.noLeidos?.[uid] || 0) + 1 })
        await updateDoc(doc(db, 'chats_internos', destino.id), { ultimoMensaje: texto || '↪ Reenviado', ultimoMensajeEn: serverTimestamp(), ...noLeidos })
      }
    } catch (e) { console.error('Error reenviando:', e) }
    setReenviando(null)
  }

  // ── Grabación de audio ────────────────────────────────────────────────────
  async function toggleGrabacion() {
    if (grabando) { mediaRecorder?.stop(); setGrabando(false); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr     = new MediaRecorder(stream)
      const chunks = []
      mr.ondataavailable = e => chunks.push(e.data)
      mr.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const file = new File([blob], `audio_${Date.now()}.webm`, { type: 'audio/webm' })
        stream.getTracks().forEach(t => t.stop())
        await enviarAdjunto(file)
      }
      mr.start(); setMediaRecorder(mr); setGrabando(true)
    } catch (e) { console.error('Error accediendo al micrófono:', e) }
  }

  // ── Conversación ──────────────────────────────────────────────────────────
  async function actualizarConversacion(campo, valor) {
    if (!chatActivo || tipoActivo !== 'wa') return
    await updateDoc(doc(db, 'conversaciones', chatActivo.id), { [campo]: valor })
    setChatActivo(prev => ({ ...prev, [campo]: valor }))
    setConversaciones(prev => prev.map(c => c.id === chatActivo.id ? { ...c, [campo]: valor } : c))
  }

  function actualizarLead(idx, campo, valor) {
    const leads = [...(chatActivo.leads || [])]
    leads[idx] = { ...leads[idx], [campo]: valor }
    actualizarConversacion('leads', leads)
  }

  function marcarLead(idx, estado) {
    const leads = [...(chatActivo.leads || [])]
    const lead  = leads[idx]
    leads[idx]  = lead.etapa === estado
      ? { ...lead, etapa: lead.etapaAnterior || etapasActivas[0]?.valor || 'nuevo', etapaAnterior: undefined, fechaCierre: undefined }
      : { ...lead, etapaAnterior: lead.etapa, etapa: estado, fechaCierre: new Date().toISOString() }
    actualizarConversacion('leads', leads)
  }

  function reabrirLead(idx) {
    const leads = [...(chatActivo.leads || [])]
    const lead  = leads[idx]
    leads[idx]  = { ...lead, etapa: lead.etapaAnterior || etapasActivas[0]?.valor || 'nuevo', etapaAnterior: undefined, fechaCierre: undefined }
    actualizarConversacion('leads', leads)
  }

  function crearLead() {
    const primeraEtapa = etapasActivas[0]?.valor || 'nuevo'
    actualizarConversacion('leads', [...(chatActivo.leads || []), {
      id: Date.now().toString(), nombre: chatActivo.nombre || 'Lead sin nombre', etapa: primeraEtapa, fechaCreacion: new Date().toISOString(),
    }])
  }

  async function crearGrupo({ nombre, miembros }) {
    const ref  = await addDoc(collection(db, 'chats_internos'), { nombre, miembros, tipo: 'grupo', creadoPor: usuarioActual?.uid, creadoEn: serverTimestamp(), ultimoMensaje: '', ultimoMensajeEn: serverTimestamp(), noLeidos: {} })
    setShowNuevoGrupo(false)
    const snap = await getDoc(ref)
    seleccionarChat({ id: snap.id, ...snap.data(), _tipo: 'interno' })
  }

  async function iniciarChatNuevo() {
    if (!nuevoNumero.trim()) return
    const telefono  = nuevoNumero.replace(/[^0-9]/g, '')
    const existente = conversaciones.find(c => c.telefono?.replace(/[^0-9]/g, '') === telefono)
    if (existente) {
      seleccionarChat({ ...existente, _tipo: 'wa' })
    } else {
      const ref  = await addDoc(collection(db, 'conversaciones'), { telefono, nombre: telefono, ultimoMensaje: '', timestamp: Math.floor(Date.now() / 1000), noLeidos: 0, creadoEn: serverTimestamp() })
      const snap = await getDoc(ref)
      seleccionarChat({ id: snap.id, ...snap.data(), _tipo: 'wa' })
    }
    setNuevoNumero('')
    setShowNuevoChat(false)
  }

  function nombresMiembros(miembros = []) {
    return miembros.map(uid => uid === usuarioActual?.uid ? 'Tú' : usuarios.find(u => u.uid === uid)?.nombre || 'Usuario').join(', ')
  }

  const noLeidosInternos = gruposInternos.reduce((acc, g) => acc + (g.noLeidos?.[usuarioActual?.uid] || 0), 0)

  // ── Retorno del hook ──────────────────────────────────────────────────────
  return {
    // estado
    usuarioActual, conversaciones, gruposInternos, chatActivo, tipoActivo,
    mensajes, mensaje, setMensaje, enviando, usuarios, tabActiva, setTabActiva,
    etapasPipeline, etapasActivas, listaFiltrada,
    filtroLista, setFiltroLista, busqueda, setBusqueda,
    filtroAgente, setFiltroAgente, filtroEtapa, setFiltroEtapa,
    filtroEtiqueta, setFiltroEtiqueta, verSoloMisChats, setVerSoloMisChats,
    filtroNoLeidos, setFiltroNoLeidos,
    showNuevoGrupo, setShowNuevoGrupo, showNuevoChat, setShowNuevoChat,
    nuevoNumero, setNuevoNumero,
    grabando, showStickers, setShowStickers, stickers,
    imagenPegada, setImagenPegada, imagenModal, setImagenModal,
    showPlantillas, setShowPlantillas, plantillasWA, busqPlantilla, setBusqPlantilla,
    respondiendo, setRespondiendo, reenviando, setReenviando,
    showReenviar, setShowReenviar,
    isotipoUrl, shakingChat, enviandoNudge,
    // permisos/tabs
    esSupervisor, puedeVerIA, tabsActuales,
    noLeidosInternos,
    // refs
    mensajesRef, inputRef, archivoRef,
    // acciones
    seleccionarChat, enviarMensaje, enviarNudge,
    guardarStickerFavorito, enviarSticker, enviarAdjunto,
    ejecutarReenvio, toggleGrabacion,
    actualizarConversacion, actualizarLead, marcarLead, reabrirLead, crearLead,
    crearGrupo, iniciarChatNuevo, nombresMiembros,
    navigate,
  }
}