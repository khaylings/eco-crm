// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVO: functions2/index.js
// ─────────────────────────────────────────────────────────────────────────────

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https')
const { setGlobalOptions } = require('firebase-functions/v2')
const { initializeApp }    = require('firebase-admin/app')
const { getAuth }          = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { getStorage }   = require('firebase-admin/storage')
const nodemailer           = require('nodemailer')
const crypto               = require('crypto')
const { simpleParser }     = require('mailparser')

setGlobalOptions({
  cors: true,
  region: 'us-central1',
})

initializeApp()

// ─── Utilidades AES-256 ───────────────────────────────────────────────────────
const ALGORITHM = 'aes-256-cbc'

function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new Error('ENCRYPTION_KEY no configurada en functions/.env')
  return crypto.createHash('sha256').update(key).digest()
}

function encriptar(texto) {
  const key = getEncryptionKey()
  const iv  = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

function desencriptar(textoEnc) {
  const key = getEncryptionKey()
  const [ivHex, encHex] = textoEnc.split(':')
  const iv        = Buffer.from(ivHex, 'hex')
  const encrypted = Buffer.from(encHex, 'hex')
  const decipher  = crypto.createDecipheriv(ALGORITHM, key, iv)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

// ─── IMAP compartido ──────────────────────────────────────────────────────────
const Imap = require('imap')
const { simpleParser: simpleParserImap } = require('mailparser')

async function leerCuentaImap({ host, port, user, password, email, db }) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user, password, host, port,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 15000,
      authTimeout: 10000,
    })

    imap.once('ready', () => {
      imap.openBox('INBOX', false, async (err) => {
        if (err) { imap.end(); reject(err); return }

        imap.search(['UNSEEN'], async (err, results) => {
          if (err) { imap.end(); reject(err); return }
          if (!results || results.length === 0) { imap.end(); resolve({ nuevos: 0 }); return }

          console.log(`${email}: ${results.length} no leídos`)

          const fetch    = imap.fetch(results, { bodies: '', markSeen: true })
          const promesas = []
          let nuevos     = 0

          fetch.on('message', (msg) => {
            const p = new Promise((res) => {
              let buffer = ''
              msg.on('body', (stream) => {
                stream.on('data', chunk => buffer += chunk.toString('utf8'))
              })
              msg.once('end', async () => {
                try {
                  const parsed       = await simpleParserImap(buffer)
                  const deEmail      = parsed.from?.value?.[0]?.address || ''
                  const de           = parsed.from?.text || deEmail
                  const para         = parsed.to?.text   || email
                  const asunto       = parsed.subject    || '(Sin asunto)'
                  const cuerpoTexto  = parsed.text       || ''
                  const cuerpoHtml   = parsed.html       || ''
                  const fecha        = parsed.date       || new Date()
                  const messageId    = parsed.messageId  || `${Date.now()}@eco-crm`

                  const existe = await db.collection('emails').where('messageId', '==', messageId).limit(1).get()
                  if (!existe.empty) { res(); return }

                  let contactoId = null, contactoNombre = null, leadId = null
                  const ctSnap = await db.collection('contactos').where('email', '==', deEmail).limit(1).get()
                  if (!ctSnap.empty) {
                    contactoId     = ctSnap.docs[0].id
                    contactoNombre = ctSnap.docs[0].data().nombre || ctSnap.docs[0].data().nombreCompleto || deEmail
                    const lSnap = await db.collection('leads').where('contactoId', '==', contactoId).limit(1).get()
                    if (!lSnap.empty) leadId = lSnap.docs[0].id
                  }

                  const adjuntos = (parsed.attachments || []).map(a => ({
                    nombre: a.filename || 'adjunto',
                    tipo:   a.contentType || 'application/octet-stream',
                    tamaño: a.size || 0,
                  }))

                  await db.collection('emails').add({
                    de, deEmail, para, asunto,
                    cuerpoTexto:    cuerpoTexto.slice(0, 5000),
                    cuerpoHtml:     cuerpoHtml.slice(0, 10000),
                    fecha, messageId,
                    direccion:      'entrada',
                    estado:         'no_leido',
                    contactoId:     contactoId     || null,
                    contactoNombre: contactoNombre || deEmail,
                    leadId:         leadId         || null,
                    adjuntos,
                    cuentaEmail:    email,
                    creadoEn:       new Date(),
                  })
                  nuevos++
                } catch(e) { console.error('Error parseando:', e.message) }
                res()
              })
            })
            promesas.push(p)
          })

          fetch.once('end', async () => {
            await Promise.all(promesas)
            imap.end()
            resolve({ nuevos })
          })

          fetch.once('error', (err) => { imap.end(); reject(err) })
        })
      })
    })

    imap.once('error', reject)
    imap.once('end', () => {})
    imap.connect()
  })
}

// ─── Helper para actualizar estado de cuenta ──────────────────────────────────
async function actualizarEstado(db, cuentaId, ok, errorMsg) {
  const ref = db.collection('configuracion_segura').doc('cuentas_email').collection('lista').doc(cuentaId)
  await ref.update({
    estadoConexion:      ok ? 'ok' : 'error',
    ultimaVerificacion:  new Date(),
    ...(ok ? { ultimaSincronizacion: new Date(), errorConexion: null } : { errorConexion: errorMsg }),
  }).catch(() => {})
}

// ─── Filtros de remitentes a excluir ─────────────────────────────────────────
const REMITENTES_EXCLUIDOS = [
  // Eco website / notificaciones propias
  'ecowebsite', 'eco-website', 'noreply@eco', 'no-reply@eco',
  // IA y tech
  'chatgpt', 'openai.com', 'openai llc',
  // ERP / sistemas
  'stelorder', 'stel-order', 'stel order', 'sap.com', 'sap ',
  // Delivery / sistema
  'mail delivery', 'mailer-daemon', 'postmaster',
  'delivery subsystem', 'undelivered mail',
  // Redes sociales
  'meta.com', 'facebook.com', 'instagram.com', 'facebookmail.com',
  // Telecom
  'twilio.com', 'twilio ',
  // Bancos Costa Rica
  'bncr.fi.cr', 'bancobcr', 'baccredomatic', 'bac.net',
  'bancredito', 'scotiabank', 'davivienda', 'promerica',
  'lafise', 'mucap', 'coopeservidores', 'coopenae',
  'banconal', 'cathay',
]

function debeExcluir(deEmail, de, asunto) {
  const haystack = `${(deEmail || '').toLowerCase()} ${(de || '').toLowerCase()} ${(asunto || '').toLowerCase()}`
  return REMITENTES_EXCLUIDOS.some(filtro => haystack.includes(filtro.toLowerCase()))
}

// ─── Cambiar contraseña ───────────────────────────────────────────────────────
exports.cambiarPasswordUsuario = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.')
  const db        = getFirestore()
  const callerDoc = await db.collection('usuarios').doc(request.auth.uid).get()
  if (!callerDoc.exists) throw new HttpsError('not-found', 'Tu usuario no existe.')
  const { esSuperAdmin, tienePermiso } = (() => {
    const d = callerDoc.data()
    return { esSuperAdmin: d.rol === 'Super Administrador', tienePermiso: d.puedeResetearPassword === true }
  })()
  if (!esSuperAdmin && !tienePermiso) throw new HttpsError('permission-denied', 'Sin permiso.')
  const { targetUID, nuevaPassword } = request.data
  if (!targetUID || !nuevaPassword)   throw new HttpsError('invalid-argument', 'Faltan parámetros.')
  if (nuevaPassword.length < 6)       throw new HttpsError('invalid-argument', 'Mínimo 6 caracteres.')
  if (targetUID === request.auth.uid) throw new HttpsError('invalid-argument', 'Usá Mi Perfil para tu propia contraseña.')
  const targetDoc = await db.collection('usuarios').doc(targetUID).get()
  if (targetDoc.exists && targetDoc.data().rol === 'Super Administrador' && !esSuperAdmin)
    throw new HttpsError('permission-denied', 'No podés cambiar la contraseña de un Super Administrador.')
  await getAuth().updateUser(targetUID, { password: nuevaPassword })
  return { success: true }
})

// ─── Crear usuario (Admin SDK — no cambia la sesión del admin) ───────────────
exports.crearUsuario = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.')
  const db        = getFirestore()
  const callerDoc = await db.collection('usuarios').doc(request.auth.uid).get()
  if (!callerDoc.exists) throw new HttpsError('not-found', 'Tu usuario no existe.')
  const callerRol = callerDoc.data().rol
  if (callerRol !== 'Super Administrador' && callerRol !== 'Administrador')
    throw new HttpsError('permission-denied', 'No tenés permiso para crear usuarios.')
  const { email, password, nombre, rol, activo } = request.data
  if (!email || !password || !nombre) throw new HttpsError('invalid-argument', 'Faltan parámetros obligatorios.')
  if (password.length < 6) throw new HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.')
  const userRecord = await getAuth().createUser({ email, password, displayName: nombre })
  await db.collection('usuarios').doc(userRecord.uid).set({
    nombre, email, rol: rol || 'Solo lectura',
    activo: activo !== false, creadoEn: new Date().toISOString(),
    puedeResetearPassword: false,
  })
  return { success: true, uid: userRecord.uid }
})

// ─── Descifrar media WhatsApp ─────────────────────────────────────────────────
exports.decryptMedia = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST')   return res.status(405).send('Method Not Allowed')
  try {
    const { msgRaw, sessionToken } = req.body
    if (!msgRaw || !sessionToken) return res.status(400).json({ error: 'Faltan parámetros' })
    const response = await fetch('https://wasenderapi.com/api/decrypt-media', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { messages: msgRaw } }),
    })
    return res.status(200).json(await response.json())
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

// ─── Bot IA ───────────────────────────────────────────────────────────────────
exports.consultarBot = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.')
  const db        = getFirestore()
  const callerDoc = await db.collection('usuarios').doc(request.auth.uid).get()
  if (!callerDoc.exists) throw new HttpsError('not-found', 'Usuario no encontrado.')
  const { mensajes, systemPrompt } = request.data
  if (!mensajes?.length) throw new HttpsError('invalid-argument', 'Se requiere historial.')
  const integDoc = await db.collection('configuracion_segura').doc('integraciones').get()
  if (!integDoc.exists) throw new HttpsError('not-found', 'Sin configuración de integraciones.')
  const anthropicKey = integDoc.data()?.anthropicKey
  if (!anthropicKey?.startsWith('sk-ant-')) throw new HttpsError('failed-precondition', 'API Key de Anthropic no configurada.')
  const botDoc           = await db.collection('configuracion').doc('bot').get()
  const docPersonalizada = botDoc.exists ? (botDoc.data()?.documentacion || '') : ''
  const systemFinal      = systemPrompt + (docPersonalizada ? `\n\n## INFORMACIÓN DEL NEGOCIO\n${docPersonalizada}` : '')
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1024, system: systemFinal, messages: mensajes }),
    })
    if (!response.ok) { const err = await response.json(); throw new HttpsError('internal', err?.error?.message || `Error ${response.status}`) }
    const data = await response.json()
    return { texto: data.content?.[0]?.text || 'Sin respuesta.' }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    throw new HttpsError('internal', 'Error al conectar con el asistente.')
  }
})

// ─── Guardar cuenta email ─────────────────────────────────────────────────────
exports.guardarCuentaEmail = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.')
  const db        = getFirestore()
  const callerDoc = await db.collection('usuarios').doc(request.auth.uid).get()
  if (!callerDoc.exists) throw new HttpsError('not-found', 'Usuario no encontrado.')
  if (callerDoc.data()?.rol !== 'Super Administrador') throw new HttpsError('permission-denied', 'Solo el Super Administrador puede configurar cuentas.')
  const { id, nombre, email, smtpHost, smtpPuerto, smtpUsuario, smtpPassword, activo } = request.data
  if (!nombre || !email || !smtpHost || !smtpPuerto || !smtpUsuario) throw new HttpsError('invalid-argument', 'Faltan campos obligatorios.')
  const col = db.collection('configuracion_segura').doc('cuentas_email').collection('lista')
  if (id) {
    const existing = await col.doc(id).get()
    if (!existing.exists) throw new HttpsError('not-found', 'Cuenta no encontrada.')
    const update = { nombre, email, smtpHost, smtpPuerto: Number(smtpPuerto), smtpUsuario, activo: activo !== false }
    if (smtpPassword?.trim()) update.smtpPasswordEnc = encriptar(smtpPassword)
    await col.doc(id).update(update)
    return { success: true, id }
  } else {
    if (!smtpPassword?.trim()) throw new HttpsError('invalid-argument', 'La contraseña SMTP es obligatoria.')
    const ref = await col.add({ nombre, email, smtpHost, smtpPuerto: Number(smtpPuerto), smtpUsuario, smtpPasswordEnc: encriptar(smtpPassword), activo: true, creadoEn: new Date() })
    return { success: true, id: ref.id }
  }
})

// ─── Listar cuentas email ─────────────────────────────────────────────────────
exports.listarCuentasEmail = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.')
  const db   = getFirestore()
  const snap = await db.collection('configuracion_segura').doc('cuentas_email').collection('lista').get()
  return {
    cuentas: snap.docs.map(d => {
      const data = d.data()
      return { id: d.id, nombre: data.nombre, email: data.email, smtpHost: data.smtpHost, smtpPuerto: data.smtpPuerto, smtpUsuario: data.smtpUsuario, activo: data.activo, tienePassword: !!data.smtpPasswordEnc }
    })
  }
})

// ─── Eliminar cuenta email ────────────────────────────────────────────────────
exports.eliminarCuentaEmail = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.')
  const db        = getFirestore()
  const callerDoc = await db.collection('usuarios').doc(request.auth.uid).get()
  if (!callerDoc.exists) throw new HttpsError('not-found', 'Usuario no encontrado.')
  if (callerDoc.data()?.rol !== 'Super Administrador') throw new HttpsError('permission-denied', 'Sin permiso.')
  const { id } = request.data
  if (!id) throw new HttpsError('invalid-argument', 'Falta el id.')
  await db.collection('configuracion_segura').doc('cuentas_email').collection('lista').doc(id).delete()
  return { success: true }
})

// ─── Probar SMTP ──────────────────────────────────────────────────────────────
exports.probarSmtp = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.')
  const db        = getFirestore()
  const callerDoc = await db.collection('usuarios').doc(request.auth.uid).get()
  if (!callerDoc.exists) throw new HttpsError('not-found', 'Usuario no encontrado.')
  if (callerDoc.data()?.rol !== 'Super Administrador') throw new HttpsError('permission-denied', 'Sin permiso.')
  const { cuentaId } = request.data
  if (!cuentaId) throw new HttpsError('invalid-argument', 'Falta cuentaId.')
  const snap = await db.collection('configuracion_segura').doc('cuentas_email').collection('lista').doc(cuentaId).get()
  if (!snap.exists) throw new HttpsError('not-found', 'Cuenta no encontrada.')
  const c           = snap.data()
  const password    = desencriptar(c.smtpPasswordEnc)
  const transporter = nodemailer.createTransport({ host: c.smtpHost, port: c.smtpPuerto, secure: c.smtpPuerto === 465, auth: { user: c.smtpUsuario, pass: password }, tls: { rejectUnauthorized: false } })
  try {
    await transporter.verify()
    await actualizarEstado(db, cuentaId, true)
    return { success: true, mensaje: 'Conexión SMTP exitosa ✓' }
  } catch (err) {
    await actualizarEstado(db, cuentaId, false, err.message)
    throw new HttpsError('internal', `Error SMTP: ${err.message}`)
  }
})

// ─── Enviar email ─────────────────────────────────────────────────────────────
exports.enviarEmail = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.')
  const db        = getFirestore()
  const callerDoc = await db.collection('usuarios').doc(request.auth.uid).get()
  if (!callerDoc.exists) throw new HttpsError('not-found', 'Usuario no encontrado.')
  const { cuentaId, para, asunto, cuerpoHtml, cuerpoTexto, cotizacionId, leadId, contactoId } = request.data
  if (!cuentaId || !para || !asunto) throw new HttpsError('invalid-argument', 'Faltan campos: cuentaId, para, asunto.')
  const snap = await db.collection('configuracion_segura').doc('cuentas_email').collection('lista').doc(cuentaId).get()
  if (!snap.exists) throw new HttpsError('not-found', 'Cuenta no encontrada.')
  const c = snap.data()
  if (!c.activo) throw new HttpsError('failed-precondition', 'Cuenta desactivada.')
  const password    = desencriptar(c.smtpPasswordEnc)
  const transporter = nodemailer.createTransport({ host: c.smtpHost, port: c.smtpPuerto, secure: c.smtpPuerto === 465, auth: { user: c.smtpUsuario, pass: password }, tls: { rejectUnauthorized: false } })
  try {
    const info   = await transporter.sendMail({ from: `"${c.nombre}" <${c.email}>`, to: para, subject: asunto, text: cuerpoTexto || '', html: cuerpoHtml || '' })
    const caller = callerDoc.data()
    await db.collection('emails').add({ de: c.email, deCuenta: c.nombre, para, asunto, cuerpoTexto: cuerpoTexto || '', cuerpoHtml: cuerpoHtml || '', fecha: new Date(), direccion: 'salida', estado: 'enviado', messageId: info.messageId, cotizacionId: cotizacionId || null, leadId: leadId || null, contactoId: contactoId || null, enviadoPor: request.auth.uid, enviadoPorNombre: caller?.nombre || '', creadoEn: new Date() })
    return { success: true, messageId: info.messageId }
  } catch (err) {
    throw new HttpsError('internal', `Error al enviar: ${err.message}`)
  }
})

// ─── Sincronizar emails manual ────────────────────────────────────────────────
exports.sincronizarEmailsManual = onRequest(
  { timeoutSeconds: 120, region: 'us-central1' },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*')
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (req.method === 'OPTIONS') return res.status(204).send('')
    if (req.method !== 'POST')   return res.status(405).json({ error: 'Method Not Allowed' })

    const authHeader = req.headers.authorization || ''
    const token      = authHeader.replace('Bearer ', '').trim()
    if (!token) return res.status(401).json({ error: 'Sin token de autenticación' })

    try {
      await getAuth().verifyIdToken(token)
    } catch (e) {
      return res.status(401).json({ error: 'Token inválido' })
    }

    const db   = getFirestore()
    const col  = db.collection('configuracion_segura').doc('cuentas_email').collection('lista')
    const snap = await col.get()

    if (snap.empty) return res.status(200).json({ success: true, totalNuevos: 0, cuentas: [] })

    const resultados = []

    for (const cuentaDoc of snap.docs) {
      const c = cuentaDoc.data()
      if (!c.activo || !c.smtpPasswordEnc) continue

      let password
      try {
        password = desencriptar(c.smtpPasswordEnc)
      } catch(e) {
        resultados.push({ email: c.email, ok: false, error: 'Error desencriptando' })
        await actualizarEstado(db, cuentaDoc.id, false, e.message)
        continue
      }

      try {
        const { nuevos } = await leerCuentaImap({ host: c.smtpHost, port: 993, user: c.smtpUsuario, password, email: c.email, db })
        resultados.push({ email: c.email, ok: true, nuevos })
        await actualizarEstado(db, cuentaDoc.id, true)
      } catch(e) {
        console.error(`Error IMAP ${c.email}:`, e.message)
        resultados.push({ email: c.email, ok: false, error: e.message })
        await actualizarEstado(db, cuentaDoc.id, false, e.message)
      }
    }

    const totalNuevos = resultados.filter(r => r.ok).reduce((acc, r) => acc + (r.nuevos || 0), 0)
    return res.status(200).json({ success: true, totalNuevos, cuentas: resultados })
  }
)

// ─── Recibir email (webhook cPanel) ──────────────────────────────────────────
exports.recibirEmail = onRequest({ cors: true }, async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST')   return res.status(405).send('Method Not Allowed')
  try {
    const db = getFirestore()
    let rawEmail = ''
    if (typeof req.body === 'string')   rawEmail = req.body
    else if (req.body?.raw)             rawEmail = req.body.raw
    else if (req.body?.email)           rawEmail = req.body.email
    else if (req.rawBody)               rawEmail = req.rawBody.toString('utf8')
    else                                rawEmail = JSON.stringify(req.body)
    if (!rawEmail || rawEmail.length < 10) return res.status(200).json({ ok: true, skipped: true })
    const parsed      = await simpleParser(rawEmail)
    const de          = parsed.from?.text || parsed.from?.value?.[0]?.address || 'desconocido'
    const deEmail     = parsed.from?.value?.[0]?.address || de
    const para        = parsed.to?.text   || parsed.to?.value?.[0]?.address   || ''
    const asunto      = parsed.subject    || '(Sin asunto)'
    const cuerpoTexto = parsed.text       || ''
    const cuerpoHtml  = parsed.html       || ''
    const fecha       = parsed.date       || new Date()
    const messageId   = parsed.messageId  || `${Date.now()}@eco-crm`
    const existente   = await db.collection('emails').where('messageId', '==', messageId).limit(1).get()
    if (!existente.empty) return res.status(200).json({ ok: true, duplicado: true })
    let contactoId = null, contactoNombre = null, leadId = null
    const ctSnap = await db.collection('contactos').where('email', '==', deEmail).limit(1).get()
    if (!ctSnap.empty) {
      contactoId     = ctSnap.docs[0].id
      contactoNombre = ctSnap.docs[0].data().nombre || ctSnap.docs[0].data().nombreCompleto || deEmail
      const lSnap = await db.collection('leads').where('contactoId', '==', contactoId).limit(1).get()
      if (!lSnap.empty) leadId = lSnap.docs[0].id
    }
    const adjuntos = (parsed.attachments || []).map(att => ({ nombre: att.filename || 'adjunto', tipo: att.contentType || 'application/octet-stream', tamaño: att.size || 0 }))
    const emailDoc = await db.collection('emails').add({ de, deEmail, para, asunto, cuerpoTexto: cuerpoTexto.slice(0, 5000), cuerpoHtml: cuerpoHtml.slice(0, 10000), fecha, messageId, direccion: 'entrada', estado: 'no_leido', contactoId: contactoId || null, contactoNombre: contactoNombre || deEmail, leadId: leadId || null, adjuntos, creadoEn: new Date() })
    return res.status(200).json({ ok: true, id: emailDoc.id })
  } catch (err) {
    return res.status(200).json({ ok: false, error: err.message })
  }
})

// ─── Auto-fix: convertir Firestore Timestamp a epoch seconds en mensajes ─────
const { onDocumentCreated } = require('firebase-functions/v2/firestore')

exports.fixTimestampMensaje = onDocumentCreated('conversaciones/{convId}/mensajes/{msgId}', async (event) => {
  const data = event.data?.data()
  if (!data?.timestamp) return
  // Si es Firestore Timestamp (tiene toDate), convertir a epoch seconds
  if (data.timestamp.toDate) {
    const epoch = Math.floor(data.timestamp.toDate().getTime() / 1000)
    await event.data.ref.update({ timestamp: epoch })
  }
})

// ─── Polling automático cada 5 minutos ───────────────────────────────────────
const { onSchedule } = require('firebase-functions/v2/scheduler')
const fetch2 = require('node-fetch')

// ─── Monitor WhatsApp — Verifica conexión cada 5 minutos ────────────────────
exports.monitorWhatsApp = onSchedule('every 5 minutes', async () => {
  const db = getFirestore()

  // Leer tokens de WaSender desde configuracion_segura
  const integDoc = await db.collection('configuracion_segura').doc('integraciones').get()
  if (!integDoc.exists) { console.log('Monitor WA: sin config de integraciones'); return }
  const integ = integDoc.data()
  const personalToken = integ.wasenderPersonalToken || integ.wasenderApiKey || ''
  const sessionId = integ.wasenderSessionId || integ.wasenderSession || ''
  if (!personalToken || !sessionId) { console.log('Monitor WA: faltan tokens'); return }

  try {
    // Consultar estado de la sesión
    const res = await fetch2(`https://wasenderapi.com/api/whatsapp-sessions/${sessionId}`, {
      headers: { 'Authorization': `Bearer ${personalToken}`, 'Content-Type': 'application/json' },
    })
    const data = await res.json()
    const status = data?.data?.status || data?.status || 'unknown'
    const phone = data?.data?.phone || data?.phone || sessionId

    console.log(`Monitor WA: sesión ${sessionId} estado=${status}`)

    // Guardar estado actual en Firestore
    await db.collection('configuracion').doc('whatsapp_status').set({
      status,
      phone,
      ultimaVerificacion: FieldValue.serverTimestamp(),
      sessionId,
    }, { merge: true })

    // Si está desconectado, alertar a todos los usuarios
    const connected = ['connected', 'open', 'active', 'authenticated'].includes(status.toLowerCase())

    if (!connected) {
      // Verificar si ya se envió alerta reciente (evitar spam)
      const statusDoc = await db.collection('configuracion').doc('whatsapp_status').get()
      const lastAlert = statusDoc.data()?.ultimaAlerta?.toDate?.() || new Date(0)
      const minSinceAlert = (Date.now() - lastAlert.getTime()) / 60000

      if (minSinceAlert < 15) {
        console.log('Monitor WA: alerta ya enviada hace menos de 15 min')
        return
      }

      // Crear notificación para todos los usuarios
      const usersSnap = await db.collection('usuarios').get()
      const batch = db.batch()

      usersSnap.docs.forEach(userDoc => {
        const notifRef = db.collection('notificaciones').doc()
        batch.set(notifRef, {
          tipo: 'alerta_whatsapp',
          titulo: 'WhatsApp desconectado',
          cuerpo: `La sesión de WhatsApp (${phone}) se ha desconectado. Estado: ${status}. Reconecta desde Configuración > WhatsApp.`,
          destinatarioId: userDoc.id,
          leida: false,
          procesada: false,
          creadoEn: FieldValue.serverTimestamp(),
        })
      })

      await batch.commit()
      await db.collection('configuracion').doc('whatsapp_status').update({
        ultimaAlerta: FieldValue.serverTimestamp(),
        alertaEnviada: true,
      })

      console.log(`Monitor WA: ALERTA enviada a ${usersSnap.size} usuarios — estado: ${status}`)
    } else {
      // Si reconectó, limpiar flag de alerta
      await db.collection('configuracion').doc('whatsapp_status').update({
        alertaEnviada: false,
      })
    }
  } catch (err) {
    console.error('Monitor WA error:', err.message)
  }
})

exports.leerEmailsImap = onSchedule('every 5 minutes', async () => {
  const db   = getFirestore()
  const snap = await db.collection('configuracion_segura').doc('cuentas_email').collection('lista').get()
  if (snap.empty) { console.log('No hay cuentas'); return }
  for (const cuentaDoc of snap.docs) {
    const c = cuentaDoc.data()
    if (!c.activo || !c.smtpPasswordEnc) continue
    let password
    try { password = desencriptar(c.smtpPasswordEnc) }
    catch(e) { await actualizarEstado(db, cuentaDoc.id, false, e.message); continue }
    try {
      const { nuevos } = await leerCuentaImap({ host: c.smtpHost, port: 993, user: c.smtpUsuario, password, email: c.email, db })
      console.log(`✓ ${c.email}: ${nuevos} nuevos`)
      await actualizarEstado(db, cuentaDoc.id, true)
    } catch(e) {
      console.error(`✗ ${c.email}:`, e.message)
      await actualizarEstado(db, cuentaDoc.id, false, e.message)
    }
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// ─── Webhook WaSender — Recibir mensajes entrantes de WhatsApp ───────────────
// ─────────────────────────────────────────────────────────────────────────────
const { procesarMensajeBot } = require('./botEngine')

exports.webhookWaSender = onRequest({ cors: true, timeoutSeconds: 120, memory: '512MiB', maxInstances: 10, minInstances: 0 }, async (req, res) => {
  // ── CORS preflight ──
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(204).send('')

  // ── Verificación GET (WaSender envía GET para verificar el webhook) ──
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', webhook: 'webhookWaSender' })
  }

  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  // ── Verificar secret (comparación segura contra timing attacks) ──
  const secret = req.query.secret || req.headers['x-webhook-secret'] || ''
  const expectedSecret = process.env.WASENDER_WEBHOOK_SECRET
  if (expectedSecret) {
    try {
      const a = Buffer.from(secret)
      const b = Buffer.from(expectedSecret)
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        console.warn('Webhook WaSender: secret inválido')
        return res.status(401).json({ error: 'Unauthorized' })
      }
    } catch {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  try {
    const payload = req.body
    console.log('Webhook WaSender: evento=' + (payload.event || 'unknown') + ' payload=' + JSON.stringify(payload).slice(0, 800))

    // ── Extraer datos del mensaje ──
    // WaSender envía diferentes formatos según el evento
    const evento = payload.event || payload.type || ''

    // Solo procesar UN tipo de evento para evitar duplicados
    // WaSender manda: messages.upsert, messages-personal.received, messages.received
    // Usamos solo messages.upsert como evento principal
    if (evento !== 'messages.upsert') {
      return res.status(200).json({ ok: true, ignored: true, reason: `evento ignorado: ${evento}` })
    }

    // Extraer el mensaje — WaSender envía en data.messages
    const msg = payload.data?.messages || payload.data?.message || payload.message || payload.data || payload
    const key = msg.key || {}
    const fromMe = key.fromMe || msg.fromMe || false

    // Ignorar mensajes enviados por nosotros (ya los guardamos al enviar)
    if (fromMe) {
      return res.status(200).json({ ok: true, ignored: true, reason: 'fromMe' })
    }

    // Extraer teléfono: WaSender usa senderPn o cleanedSenderPn para el número real
    const fromRaw = key.senderPn || key.cleanedSenderPn || key.remoteJid || msg.from || msg.sender || ''
    const telefono = fromRaw.replace(/@.*$/, '').replace(/[^0-9]/g, '')
    if (!telefono || telefono.length < 7) {
      return res.status(200).json({ ok: true, ignored: true, reason: 'teléfono inválido' })
    }

    // Ignorar mensajes de grupos
    const remoteJid = key.remoteJid || ''
    if (remoteJid.includes('@g.us')) {
      return res.status(200).json({ ok: true, ignored: true, reason: 'grupo' })
    }

    // Nombre del contacto
    const pushName = msg.pushName || msg.notifyName || msg.senderName || ''

    // Extraer contenido del mensaje
    const msgContent = msg.message || {}
    const body = msgContent.conversation
      || msgContent.extendedTextMessage?.text
      || msgContent.imageMessage?.caption
      || msgContent.videoMessage?.caption
      || msg.body || msg.text || msg.caption || ''

    // Detectar tipo de mensaje y extraer URL del media
    let tipo = 'texto'
    let mediaUrl = null
    let mimetype = null
    let thumbnail = null
    if (msgContent.imageMessage) {
      tipo = 'image'
      mediaUrl = msgContent.imageMessage.url || msg.mediaUrl || null
      mimetype = msgContent.imageMessage.mimetype || null
      thumbnail = msgContent.imageMessage.jpegThumbnail || null
    } else if (msgContent.videoMessage) {
      tipo = 'video'
      mediaUrl = msgContent.videoMessage.url || msg.mediaUrl || null
      mimetype = msgContent.videoMessage.mimetype || null
      thumbnail = msgContent.videoMessage.jpegThumbnail || null
    } else if (msgContent.audioMessage || msgContent.pttMessage) {
      tipo = 'audio'
      const audioMsg = msgContent.audioMessage || msgContent.pttMessage
      mediaUrl = audioMsg.url || msg.mediaUrl || null
      mimetype = audioMsg.mimetype || null
    } else if (msgContent.documentMessage || msgContent.documentWithCaptionMessage) {
      tipo = 'file'
      const docMsg = msgContent.documentMessage || msgContent.documentWithCaptionMessage?.message?.documentMessage
      mediaUrl = docMsg?.url || msg.mediaUrl || null
      mimetype = docMsg?.mimetype || null
    } else if (msgContent.stickerMessage) {
      tipo = 'sticker'
      mediaUrl = msgContent.stickerMessage.url || msg.mediaUrl || null
      mimetype = msgContent.stickerMessage.mimetype || null
    } else if (msgContent.locationMessage) {
      tipo = 'location'
    }

    const db = getFirestore()
    const now = Math.floor(Date.now() / 1000)

    // ── Buscar o crear conversación ──
    const convsRef = db.collection('conversaciones')
    let convDoc = null
    let convId = null

    // Buscar por teléfono exacto o con variantes (+, sin +, etc.)
    const snapshot = await convsRef.where('telefono', '==', telefono).limit(1).get()
    if (!snapshot.empty) {
      convDoc = snapshot.docs[0]
      convId = convDoc.id
    } else {
      // Buscar con + adelante
      const snapshot2 = await convsRef.where('telefono', '==', `+${telefono}`).limit(1).get()
      if (!snapshot2.empty) {
        convDoc = snapshot2.docs[0]
        convId = convDoc.id
      }
    }

    if (!convId) {
      // Crear nueva conversación
      const nombre = pushName || telefono
      const newRef = await convsRef.add({
        telefono,
        nombre,
        ultimoMensaje: body || `[${tipo}]`,
        timestamp: now,
        noLeidos: 1,
        creadoEn: FieldValue.serverTimestamp(),
      })
      convId = newRef.id
    } else {
      // Actualizar conversación existente y reabrir si estaba cerrada/archivada
      const convData = convDoc.data()
      const noLeidosActual = convData.noLeidos || 0
      await convsRef.doc(convId).update({
        ultimoMensaje: body || `[${tipo}]`,
        timestamp: now,
        noLeidos: noLeidosActual + 1,
        ...(pushName ? { nombre: pushName } : {}),
        ...(convData.archivada ? { archivada: false } : {}),
      })
    }

    // ── Desencriptar media via WaSender API y subir a Firebase Storage ──
    let storageUrl = null
    console.log(`Webhook WaSender: tipo=${tipo}, telefono=${telefono}`)
    if (tipo !== 'texto' && tipo !== 'location') {
      try {
        const integDoc = await db.collection('configuracion_segura').doc('integraciones').get()
        const integData = integDoc.exists ? integDoc.data() : {}
        const sessionToken = integData.wasenderSessionToken || integData.wasenderToken || ''
        if (sessionToken) {
          // Paso 1: Desencriptar via WaSender API — devuelve publicUrl
          const decryptRes = await fetch2('https://wasenderapi.com/api/decrypt-media', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { messages: msg } }),
          })
          const decryptData = await decryptRes.json()
          const publicUrl = decryptData?.publicUrl || decryptData?.data?.publicUrl || decryptData?.url || null
          console.log(`Webhook WaSender: decrypt status=${decryptRes.status}, publicUrl=${publicUrl ? publicUrl.slice(0, 80) : 'null'}`)

          if (publicUrl) {
            // Paso 2: Descargar la imagen desde el publicUrl de WaSender
            const imgRes = await fetch2(publicUrl, { timeout: 20000 })
            if (imgRes.ok) {
              const buffer = await imgRes.buffer()
              console.log(`Webhook WaSender: imagen descargada, tamaño=${buffer.length} bytes`)
              if (buffer.length > 500) {
                // Paso 3: Subir a Firebase Storage
                const ext = tipo === 'audio' ? 'ogg' : tipo === 'video' ? 'mp4' : tipo === 'sticker' ? 'webp' : 'jpg'
                const bucket = getStorage().bucket()
                const filePath = `chat_media/${convId}/${Date.now()}.${ext}`
                const file = bucket.file(filePath)
                await file.save(buffer, { metadata: { contentType: mimetype || 'application/octet-stream' } })
                await file.makePublic()
                storageUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`
                console.log(`Webhook WaSender: media subido a Storage: ${storageUrl}`)
              }
            }
          }
        }
      } catch (mediaErr) {
        console.error('Error procesando media:', mediaErr.message)
      }
    }

    // ── Guardar mensaje en subcollección ──
    const mensajeData = {
      body: body || '',
      fromMe: false,
      tipo,
      timestamp: now,
    }
    mensajeData.mediaUrl = storageUrl || mediaUrl || null
    if (mimetype) mensajeData.mimetype = mimetype
    if (thumbnail && !storageUrl) mensajeData.thumbnail = thumbnail
    mensajeData.mediaProcesado = !!storageUrl

    // Guardar msgRaw para poder desencriptar media después si falló
    if (tipo !== 'texto' && tipo !== 'location' && !storageUrl) {
      try {
        mensajeData.msgRaw = JSON.parse(JSON.stringify(msg))
      } catch (e) { /* ignorar si no se puede serializar */ }
    }

    await convsRef.doc(convId).collection('mensajes').add(mensajeData)

    // ── Llamar al bot si está activo ──
    try {
      if (body) {
        const integDoc = await db.collection('configuracion_segura').doc('integraciones').get()
        const integData = integDoc.exists ? integDoc.data() : {}
        const wasenderToken = integData.wasenderSessionToken || integData.wasenderToken || ''
        const wasenderSession = integData.wasenderSessionId || integData.wasenderSession || ''
        if (wasenderToken && wasenderSession) {
          await procesarMensajeBot(telefono, body, db, wasenderToken, wasenderSession)
        }
      }
    } catch (botErr) {
      console.error('Error en botEngine:', botErr.message)
      // No fallar el webhook por error del bot
    }

    console.log(`Webhook WaSender: mensaje guardado en conversaciones/${convId} de ${telefono}`)
    return res.status(200).json({ ok: true, convId, telefono })

  } catch (err) {
    console.error('Error webhook WaSender:', err)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// ─── Importar emails históricos (2025 en adelante, con filtros) ───────────────
// ─────────────────────────────────────────────────────────────────────────────
exports.importarEmailsHistoricos = onRequest(
  { timeoutSeconds: 540, region: 'us-central1', memory: '512MiB' },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*')
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (req.method === 'OPTIONS') return res.status(204).send('')
    if (req.method !== 'POST')   return res.status(405).json({ error: 'Method Not Allowed' })

    // Verificar token
    const authHeader = req.headers.authorization || ''
    const token      = authHeader.replace('Bearer ', '').trim()
    if (!token) return res.status(401).json({ error: 'Sin token' })
    try {
      await getAuth().verifyIdToken(token)
    } catch(e) {
      return res.status(401).json({ error: 'Token inválido' })
    }

    const db = getFirestore()

    // Parámetros opcionales del body
    const {
      desdeAnio   = 2025,
      limitePorCuenta = 500,  // máximo a procesar por cuenta por llamada
    } = req.body || {}

    const fechaDesde = new Date(`${desdeAnio}-01-01T00:00:00.000Z`)
    console.log(`Importando desde ${fechaDesde.toISOString()}, límite ${limitePorCuenta} por cuenta`)

    const col  = db.collection('configuracion_segura').doc('cuentas_email').collection('lista')
    const snap = await col.get()
    if (snap.empty) return res.status(200).json({ success: true, totalImportados: 0, totalFiltrados: 0, cuentas: [] })

    const resultados = []

    for (const cuentaDoc of snap.docs) {
      const c = cuentaDoc.data()
      if (!c.activo || !c.smtpPasswordEnc) continue

      let password
      try { password = desencriptar(c.smtpPasswordEnc) }
      catch(e) {
        resultados.push({ email: c.email, ok: false, error: 'Error desencriptando' })
        continue
      }

      try {
        const resultado = await importarHistoricosCuenta({
          host: c.smtpHost,
          port: 993,
          user: c.smtpUsuario,
          password,
          email: c.email,
          db,
          fechaDesde,
          limite: limitePorCuenta,
        })
        resultados.push({ email: c.email, ok: true, ...resultado })
        await actualizarEstado(db, cuentaDoc.id, true)
      } catch(e) {
        console.error(`Error histórico ${c.email}:`, e.message)
        resultados.push({ email: c.email, ok: false, error: e.message })
        await actualizarEstado(db, cuentaDoc.id, false, e.message)
      }
    }

    const totalImportados = resultados.reduce((acc, r) => acc + (r.importados || 0), 0)
    const totalFiltrados  = resultados.reduce((acc, r) => acc + (r.filtrados  || 0), 0)
    const totalDuplicados = resultados.reduce((acc, r) => acc + (r.duplicados || 0), 0)

    return res.status(200).json({
      success: true,
      totalImportados,
      totalFiltrados,
      totalDuplicados,
      cuentas: resultados,
    })
  }
)

// ─── Función interna: importar históricos de una cuenta ──────────────────────
async function importarHistoricosCuenta({ host, port, user, password, email, db, fechaDesde, limite }) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user, password, host, port,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 20000,
      authTimeout: 15000,
    })

    imap.once('ready', () => {
      // Abrir en modo solo lectura (true) — NO marca como leídos
      imap.openBox('INBOX', true, async (err) => {
        if (err) { imap.end(); reject(err); return }

        // Buscar desde fecha de inicio del año
        const criterio = ['ALL', ['SINCE', fechaDesde]]

        imap.search(criterio, async (err, results) => {
          if (err) { imap.end(); reject(err); return }
          if (!results || results.length === 0) {
            imap.end()
            resolve({ importados: 0, filtrados: 0, duplicados: 0, total: 0 })
            return
          }

          console.log(`${email}: ${results.length} emails desde ${fechaDesde.getFullYear()}`)

          // Limitar cantidad a procesar
          const aFetch = results.slice(-limite) // los más recientes primero

          // markSeen: false — NO marcar como leídos
          const fetch    = imap.fetch(aFetch, { bodies: '', markSeen: false })
          const promesas = []
          let importados = 0
          let filtrados  = 0
          let duplicados = 0

          fetch.on('message', (msg) => {
            const p = new Promise((res) => {
              let buffer = ''
              msg.on('body', (stream) => {
                stream.on('data', chunk => buffer += chunk.toString('utf8'))
              })
              msg.once('end', async () => {
                try {
                  const parsed      = await simpleParserImap(buffer)
                  const deEmail     = parsed.from?.value?.[0]?.address || ''
                  const de          = parsed.from?.text || deEmail
                  const para        = parsed.to?.text   || email
                  const asunto      = parsed.subject    || '(Sin asunto)'
                  const cuerpoTexto = parsed.text       || ''
                  const cuerpoHtml  = parsed.html       || ''
                  const fecha       = parsed.date       || new Date()
                  const messageId   = parsed.messageId  || `hist-${Date.now()}-${Math.random()}@eco-crm`

                  // ── Filtro de remitentes excluidos ──
                  if (debeExcluir(deEmail, de, asunto)) {
                    filtrados++
                    res()
                    return
                  }

                  // ── Verificar duplicado ──
                  const existe = await db.collection('emails').where('messageId', '==', messageId).limit(1).get()
                  if (!existe.empty) {
                    duplicados++
                    res()
                    return
                  }

                  // ── Vincular a contacto/lead ──
                  let contactoId = null, contactoNombre = null, leadId = null
                  if (deEmail) {
                    const ctSnap = await db.collection('contactos').where('email', '==', deEmail).limit(1).get()
                    if (!ctSnap.empty) {
                      contactoId     = ctSnap.docs[0].id
                      contactoNombre = ctSnap.docs[0].data().nombre || ctSnap.docs[0].data().nombreCompleto || deEmail
                      const lSnap = await db.collection('leads').where('contactoId', '==', contactoId).limit(1).get()
                      if (!lSnap.empty) leadId = lSnap.docs[0].id
                    }
                  }

                  const adjuntos = (parsed.attachments || []).map(a => ({
                    nombre: a.filename || 'adjunto',
                    tipo:   a.contentType || 'application/octet-stream',
                    tamaño: a.size || 0,
                  }))

                  await db.collection('emails').add({
                    de, deEmail, para, asunto,
                    cuerpoTexto:    cuerpoTexto.slice(0, 5000),
                    cuerpoHtml:     cuerpoHtml.slice(0, 10000),
                    fecha, messageId,
                    direccion:      'entrada',
                    estado:         'leido',       // históricos entran como leídos
                    contactoId:     contactoId     || null,
                    contactoNombre: contactoNombre || deEmail,
                    leadId:         leadId         || null,
                    adjuntos,
                    cuentaEmail:    email,
                    importadoHistorico: true,
                    creadoEn:       new Date(),
                  })
                  importados++
                } catch(e) {
                  console.error('Error parseando histórico:', e.message)
                }
                res()
              })
            })
            promesas.push(p)
          })

          fetch.once('end', async () => {
            await Promise.all(promesas)
            imap.end()
            resolve({ importados, filtrados, duplicados, total: aFetch.length })
          })

          fetch.once('error', (err) => { imap.end(); reject(err) })
        })
      })
    })

    imap.once('error', reject)
    imap.once('end', () => {})
    imap.connect()
  })
}