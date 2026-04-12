/**
 * botEngine.js
 * Motor del bot de WhatsApp.
 * Se llama desde el webhook de Firebase Functions cuando llega un mensaje nuevo.
 *
 * Flujo: Bienvenida → Nombre → Servicio → Ubicación → Urgencia → Handoff
 * Estado se guarda en Firestore: conversaciones/{telefono}.botEstado
 */

const admin = require('firebase-admin')
const fetch = require('node-fetch')

const WASENDER_URL = 'https://wasenderapi.com/api'
const BOT_CONFIG_PATH = 'config/bot'

// ── Pasos del flujo ───────────────────────────────────────────────────────────
const PASOS = ['bienvenida', 'nombre', 'servicio', 'ubicacion', 'urgencia', 'handoff']

// ── Función principal ─────────────────────────────────────────────────────────
async function procesarMensajeBot(telefono, textoRecibido, db, wasenderToken, wasenderSession) {
  // 1. Leer config del bot
  const configSnap = await db.doc(BOT_CONFIG_PATH).get()
  if (!configSnap.exists) return
  const config = configSnap.data()

  // 2. Verificar si el bot está activo
  if (!config.activo) return

  // 3. Verificar horario
  if (config.horarioActivo) {
    const ahora = new Date()
    const hora = ahora.getHours() * 60 + ahora.getMinutes()
    const [hIni, mIni] = config.horarioInicio.split(':').map(Number)
    const [hFin, mFin] = config.horarioFin.split(':').map(Number)
    const inicio = hIni * 60 + mIni
    const fin = hFin * 60 + mFin
    const dias = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']
    const diaActual = dias[ahora.getDay()]

    if (hora < inicio || hora > fin || !config.diasActivos.includes(diaActual)) {
      // Fuera de horario — enviar mensaje de aviso solo si no se envió hoy
      const convRef = db.collection('conversaciones').doc(telefono)
      const conv = await convRef.get()
      const hoyStr = ahora.toDateString()
      if (conv.data()?.ultimoAvisoFueraHorario !== hoyStr) {
        await enviarConDelay(config.mensajeFueraHorario, config, telefono, wasenderToken, wasenderSession, db)
        await convRef.update({ ultimoAvisoFueraHorario: hoyStr })
      }
      return
    }
  }

  // 4. Leer estado actual de la conversación
  const convRef = db.collection('conversaciones').doc(telefono)
  const convSnap = await convRef.get()
  const conv = convSnap.data() || {}

  // Si ya pasó al agente, el bot no interviene
  if (conv.estadoBot === 'agente') return

  const botEstado = conv.botEstado || {}
  const pasoActual = botEstado.paso || 'bienvenida'
  const datos = botEstado.datos || {}

  let respuesta = null
  let nuevoPaso = pasoActual
  let nuevosDatos = { ...datos }

  // 5. Procesar según el paso actual
  switch (pasoActual) {

    case 'bienvenida':
      respuesta = config.mensajeBienvenida
      // Luego de la bienvenida preguntar el nombre
      await enviarConDelay(respuesta, config, telefono, wasenderToken, wasenderSession, db)
      await delay(800)
      respuesta = config.preguntaNombre
      nuevoPaso = 'nombre'
      break

    case 'nombre':
      nuevosDatos.nombre = textoRecibido.trim()
      // Actualizar nombre en la conversación
      await convRef.update({ nombre: nuevosDatos.nombre })
      respuesta = config.preguntaServicio
      nuevoPaso = 'servicio'
      break

    case 'servicio':
      nuevosDatos.servicio = textoRecibido.trim()
      respuesta = config.preguntaUbicacion
      nuevoPaso = 'ubicacion'
      break

    case 'ubicacion':
      nuevosDatos.ubicacion = textoRecibido.trim()
      respuesta = config.preguntaUrgencia
      nuevoPaso = 'urgencia'
      break

    case 'urgencia':
      nuevosDatos.urgencia = textoRecibido.trim()
      respuesta = config.mensajeHandoff
      nuevoPaso = 'handoff'
      break

    default:
      return
  }

  // 6. Enviar respuesta con delay simulado
  await enviarConDelay(respuesta, config, telefono, wasenderToken, wasenderSession, db)

  // 7. Si llegamos al handoff → crear lead y marcar para agente
  if (nuevoPaso === 'handoff') {
    await convRef.update({
      botEstado: { paso: 'handoff', datos: nuevosDatos },
      estadoBot: 'pendiente_agente',
      nombre: nuevosDatos.nombre || conv.nombre || telefono,
    })

    // Crear lead automático si está configurado
    if (config.crearLeadAuto) {
      await crearLeadDesdeBot(telefono, nuevosDatos, db)
    }
  } else {
    await convRef.update({
      botEstado: { paso: nuevoPaso, datos: nuevosDatos },
      estadoBot: 'bot',
    })
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function enviarConDelay(texto, config, telefono, token, session, db) {
  // Calcular delay según largo del mensaje
  const ms = Math.min(
    config.delayMax || 4000,
    (config.delaySt || 60) + texto.length * (config.delayPorCaracter || 40)
  )
  await delay(ms)

  const telefonoLimpio = telefono.replace(/[^0-9]/g, '')
  await fetch(`${WASENDER_URL}/whatsapp-sessions/${session}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: `${telefonoLimpio}@s.whatsapp.net`,
      type: 'text',
      text: { body: texto },
    }),
  })

  // Guardar en Firestore
  await db.collection('conversaciones').doc(telefono).collection('mensajes').add({
    body: texto,
    fromMe: true,
    esBot: true,
    timestamp: Math.floor(Date.now() / 1000),
  })
  await db.collection('conversaciones').doc(telefono).update({
    ultimoMensaje: texto,
    timestamp: Math.floor(Date.now() / 1000),
  })
}

async function crearLeadDesdeBot(telefono, datos, db) {
  // Buscar primera columna del pipeline
  const columnasSnap = await db.collection('pipeline_columnas').orderBy('orden').limit(1).get()
  const columnaId = columnasSnap.empty ? null : columnasSnap.docs[0].id

  await db.collection('leads').add({
    nombre: datos.nombre || `Lead ${telefono}`,
    whatsapp: telefono,
    origen: 'WhatsApp Bot',
    servicio: datos.servicio || '',
    ubicacion: datos.ubicacion || '',
    urgencia: datos.urgencia || '',
    columnaId,
    estado: 'abierto',
    prioridad: datos.urgencia?.includes('1') ? 'Alta' : 'Media',
    creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    creadoPor: 'bot',
  })
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = { procesarMensajeBot }