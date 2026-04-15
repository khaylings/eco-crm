/**
 * formatMoneda.js — Helper centralizado de formato de moneda
 *
 * Reglas:
 * - CRC → ₡1,234,567 (formato costarricense, sin decimales)
 * - USD → $1,234.56 (formato americano, 2 decimales)
 * - Conversión CRC→USD usa la tasa guardada en el documento, NO la del día
 * - Nunca se modifica una tasa ya guardada
 */

/**
 * Formatea un monto según su moneda
 * @param {number} n - Monto
 * @param {string} moneda - 'USD' o 'CRC'
 * @returns {string} Monto formateado con símbolo
 */
export function fmt(n, moneda = 'USD') {
  const num = Number(n || 0)
  if (moneda === 'CRC') {
    return '₡' + num.toLocaleString('es-CR', { maximumFractionDigits: 0 })
  }
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Formatea un monto sin decimales (para tarjetas/resúmenes)
 * @param {number} n - Monto
 * @param {string} moneda - 'USD' o 'CRC'
 * @returns {string} Monto formateado sin decimales
 */
export function fmtCorto(n, moneda = 'USD') {
  const num = Number(n || 0)
  if (moneda === 'CRC') {
    return '₡' + num.toLocaleString('es-CR', { maximumFractionDigits: 0 })
  }
  return '$' + num.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

/**
 * Convierte un monto a USD usando la tasa del documento
 * @param {number} monto - Monto original
 * @param {string} moneda - 'USD' o 'CRC'
 * @param {number} tasaDoc - Tasa de cambio guardada en el documento
 * @returns {number} Monto en USD
 */
export function toUSD(monto, moneda, tasaDoc) {
  const num = Number(monto || 0)
  if (!moneda || moneda === 'USD') return num
  const tasa = Number(tasaDoc || 0)
  if (tasa <= 0) return num // si no hay tasa, devolver el monto tal cual
  return num / tasa
}

/**
 * Convierte un monto a CRC usando la tasa del documento
 * @param {number} monto - Monto original
 * @param {string} moneda - 'USD' o 'CRC'
 * @param {number} tasaDoc - Tasa de cambio guardada en el documento
 * @returns {number} Monto en CRC
 */
export function toCRC(monto, moneda, tasaDoc) {
  const num = Number(monto || 0)
  if (moneda === 'CRC') return num
  const tasa = Number(tasaDoc || 0)
  if (tasa <= 0) return num
  return num * tasa
}

/**
 * Formatea un monto convirtiéndolo a USD si es CRC (para totales mixtos)
 * Usa la tasa del documento, no la del día
 * @param {number} monto - Monto original
 * @param {string} moneda - 'USD' o 'CRC'
 * @param {number} tasaDoc - Tasa guardada en el documento
 * @returns {string} Monto formateado en USD
 */
export function fmtEnUSD(monto, moneda, tasaDoc) {
  return fmt(toUSD(monto, moneda, tasaDoc), 'USD')
}

/**
 * Devuelve el símbolo de la moneda
 * @param {string} moneda - 'USD' o 'CRC'
 * @returns {string} '$' o '₡'
 */
export function simbolo(moneda) {
  return moneda === 'CRC' ? '₡' : '$'
}
