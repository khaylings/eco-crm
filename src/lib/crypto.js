/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: src/lib/crypto.js
 * Módulo:  Utilidades de encriptación AES-256
 *
 * CONFIDENCIAL — Este archivo contiene lógica de seguridad
 * crítica. No distribuir ni modificar sin autorización.
 * ============================================================
 */

/**
 * Encriptación/desencriptación AES-256-GCM usando Web Crypto API nativa.
 * No requiere dependencias externas. Funciona en todos los navegadores modernos.
 *
 * Uso:
 *   import { encrypt, decrypt } from '@/lib/crypto'
 *   const cifrado = await encrypt('mi-api-key-secreta')
 *   const original = await decrypt(cifrado)
 */

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const IV_LENGTH = 12 // bytes para GCM

/**
 * Deriva una clave criptográfica desde la variable de entorno VITE_CRYPTO_SECRET.
 * La clave nunca se almacena en texto plano — se deriva con PBKDF2.
 */
async function deriveKey() {
  const secret = import.meta.env.VITE_CRYPTO_SECRET
  if (!secret) {
    throw new Error('[LK-CRM] VITE_CRYPTO_SECRET no definido en .env')
  }

  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  // Salt fijo derivado del nombre del sistema (no necesita ser secreto)
  const salt = encoder.encode('lkcrm-salt-2024')

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encripta un texto plano.
 * @param {string} plaintext - Texto a encriptar
 * @returns {Promise<string>} - Texto encriptado en base64 (iv:ciphertext)
 */
export async function encrypt(plaintext) {
  if (!plaintext) return ''

  try {
    const key = await deriveKey()
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
    const encoder = new TextEncoder()

    const ciphertext = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      encoder.encode(plaintext)
    )

    // Combinar IV + ciphertext en base64
    const combined = new Uint8Array(iv.length + ciphertext.byteLength)
    combined.set(iv)
    combined.set(new Uint8Array(ciphertext), iv.length)

    return btoa(String.fromCharCode(...combined))
  } catch (err) {
    console.error('[LK-CRM] Error al encriptar:', err.message)
    throw err
  }
}

/**
 * Desencripta un texto previamente encriptado con encrypt().
 * @param {string} encrypted - Texto encriptado en base64
 * @returns {Promise<string>} - Texto original desencriptado
 */
export async function decrypt(encrypted) {
  if (!encrypted) return ''

  try {
    const key = await deriveKey()
    const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0))

    const iv = combined.slice(0, IV_LENGTH)
    const ciphertext = combined.slice(IV_LENGTH)

    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      ciphertext
    )

    return new TextDecoder().decode(decrypted)
  } catch (err) {
    console.error('[LK-CRM] Error al desencriptar — clave incorrecta o dato corrupto')
    return ''
  }
}

/**
 * Ofusca una clave para mostrar en UI (ej: "sk-abc...xyz").
 * Nunca mostrar claves completas en interfaz.
 * @param {string} key - API key o string sensible
 * @returns {string} - Versión ofuscada
 */
export function maskKey(key) {
  if (!key || key.length < 8) return '••••••••'
  return `${key.slice(0, 4)}${'•'.repeat(Math.max(4, key.length - 8))}${key.slice(-4)}`
}