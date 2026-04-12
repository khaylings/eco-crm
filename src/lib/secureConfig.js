/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: src/lib/secureConfig.js
 * Módulo:  Carga segura de configuración en runtime
 *
 * CONFIDENCIAL — Gestiona el acceso a datos sensibles del sistema.
 * Las claves se desencriptan en memoria y nunca se loguean.
 * ============================================================
 */

import { db } from '@/firebase/config'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { decrypt, encrypt, maskKey } from './crypto'

/**
 * Colección en Firestore donde se guardan los datos sensibles encriptados.
 * Solo accesible por usuarios con rol "admin" (ver firestore.rules).
 */
const SECURE_COLLECTION = 'configuracion_segura'
const SECURE_DOC = 'integraciones'

/**
 * Cache en memoria de la sesión actual.
 * Se limpia al cerrar sesión / recargar página.
 * NUNCA persiste en localStorage ni cookies.
 */
let _runtimeCache = null

/**
 * Carga la configuración segura desde Firestore y la desencripta en memoria.
 * El resultado se cachea en runtime para minimizar llamadas a Firestore.
 *
 * @returns {Promise<Object>} - Configuración desencriptada
 */
export async function loadSecureConfig() {
  // Retornar cache si ya existe en esta sesión
  if (_runtimeCache) return _runtimeCache

  try {
    const ref = doc(db, SECURE_COLLECTION, SECURE_DOC)
    const snap = await getDoc(ref)

    if (!snap.exists()) {
      return getDefaultConfig()
    }

    const data = snap.data()

    // Desencriptar cada campo sensible
    const config = {
      wasender: {
        apiKey: data.wasender_api_key ? await decrypt(data.wasender_api_key) : '',
        sessionId: data.wasender_session_id ? await decrypt(data.wasender_session_id) : '',
        webhookUrl: data.wasender_webhook_url ? await decrypt(data.wasender_webhook_url) : '',
      },
      sistema: {
        empresaNombre: data.empresa_nombre || '',
        empresaLogo: data.empresa_logo || '',
        monedaBase: data.moneda_base || 'CRC',
        tasaCambio: data.tasa_cambio || 500,
      },
      ui: {
        colorPrimario: data.color_primario || '#1a3a5c',
        colorSecundario: data.color_secundario || '#e8f0f7',
        colorAccent: data.color_accent || '#2563eb',
      },
    }

    // Guardar en cache de sesión (no en storage)
    _runtimeCache = config
    return config

  } catch (err) {
    console.error('[LK-CRM] Error cargando configuración segura:', err.message)
    return getDefaultConfig()
  }
}

/**
 * Guarda la configuración segura encriptando todos los campos sensibles.
 * Solo debe llamarse desde el panel de Configuración con usuario admin.
 *
 * @param {Object} config - Configuración a guardar
 * @param {string} userId - UID del usuario que hace el cambio
 */
export async function saveSecureConfig(config, userId) {
  try {
    const ref = doc(db, SECURE_COLLECTION, SECURE_DOC)

    const payload = {
      // Campos sensibles: encriptados con AES-256
      wasender_api_key: config.wasender?.apiKey
        ? await encrypt(config.wasender.apiKey)
        : '',
      wasender_session_id: config.wasender?.sessionId
        ? await encrypt(config.wasender.sessionId)
        : '',
      wasender_webhook_url: config.wasender?.webhookUrl
        ? await encrypt(config.wasender.webhookUrl)
        : '',

      // Campos no sensibles: texto plano
      empresa_nombre: config.sistema?.empresaNombre || '',
      empresa_logo: config.sistema?.empresaLogo || '',
      moneda_base: config.sistema?.monedaBase || 'CRC',
      tasa_cambio: config.sistema?.tasaCambio || 500,
      color_primario: config.ui?.colorPrimario || '#1a3a5c',
      color_secundario: config.ui?.colorSecundario || '#e8f0f7',
      color_accent: config.ui?.colorAccent || '#2563eb',

      // Auditoría
      _actualizado_por: userId,
      _actualizado_en: serverTimestamp(),
    }

    await setDoc(ref, payload, { merge: true })

    // Invalidar cache para forzar recarga
    _runtimeCache = null

    console.info('[LK-CRM] Configuración guardada por:', userId)
    return true

  } catch (err) {
    console.error('[LK-CRM] Error guardando configuración:', err.message)
    throw err
  }
}

/**
 * Limpia el cache de runtime. Llamar al hacer logout.
 */
export function clearSecureConfigCache() {
  _runtimeCache = null
}

/**
 * Retorna una API key enmascarada para mostrar en UI.
 * @param {string} key
 */
export { maskKey }

function getDefaultConfig() {
  return {
    wasender: { apiKey: '', sessionId: '', webhookUrl: '' },
    sistema: { empresaNombre: '', empresaLogo: '', monedaBase: 'CRC', tasaCambio: 500 },
    ui: { colorPrimario: '#1a3a5c', colorSecundario: '#e8f0f7', colorAccent: '#2563eb' },
  }
}