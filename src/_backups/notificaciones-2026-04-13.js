/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: notificaciones.js
 * Módulo:  Services
 * ============================================================
 */

import { collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'

/**
 * Crea una notificación para un usuario específico.
 */
export async function crearNotificacion({
  destinatarioId,
  tipo = 'general',
  titulo,
  cuerpo = '',
  link = '',
  facturaId = null,
  facturaNumero = null,
  vendedorId = null,
  pago = null,
  meta = null,
}) {
  if (!destinatarioId || !titulo) {
    console.warn('[notificaciones] Faltan parámetros obligatorios')
    return null
  }
  try {
    const ref = await addDoc(collection(db, 'notificaciones'), {
      destinatarioId,
      tipo,
      titulo,
      cuerpo,
      link,
      facturaId,
      facturaNumero,
      vendedorId,
      pago,
      meta,
      leida:     false,
      procesada: false,
      creadoEn:  serverTimestamp(),
    })
    return ref.id
  } catch (e) {
    console.error('[notificaciones] Error creando notificación:', e)
    return null
  }
}

/**
 * Notifica a todos los usuarios con permiso de aprobar pagos (bancos).
 */
export async function notificarAprobadores(params) {
  try {
    const rolesSnap = await getDocs(collection(db, 'roles'))
    const rolesConPermiso = rolesSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(r => r.permisos?.['bancos_Aprobar pagos pendientes'])
      .map(r => r.nombre)

    const usuariosSnap = await getDocs(collection(db, 'usuarios'))
    const aprobadores = usuariosSnap.docs
      .map(d => ({ uid: d.id, ...d.data() }))
      .filter(u => rolesConPermiso.includes(u.rol) || u.rol === 'Super Administrador' || u.rol === 'Administrador')

    await Promise.all(aprobadores.map(u => crearNotificacion({ ...params, destinatarioId: u.uid })))
  } catch (e) {
    console.error('[notificaciones] Error notificando aprobadores:', e)
  }
}

/**
 * Registra un pago pendiente de aprobación y notifica a los aprobadores.
 */
export async function registrarPagoPendiente({ factura, pago, vendedor }) {
  return notificarAprobadores({
    tipo:          'pago_pendiente',
    titulo:        `Pago pendiente — ${factura.numero}`,
    cuerpo:        `${vendedor?.nombre || 'Un vendedor'} registró un pago de $${Number(pago.monto).toLocaleString()} (${pago.metodo})`,
    link:          `/facturacion/${factura.id}`,
    facturaId:     factura.id,
    facturaNumero: factura.numero,
    vendedorId:    vendedor?.uid || null,
    pago: {
      ...pago,
      moneda:        factura.moneda,
      registradoPor: vendedor?.nombre || 'Vendedor',
    },
  })
}

/**
 * Solicita eliminación de una factura — notifica solo a Super Administradores.
 */
export async function solicitarEliminacionFactura({ factura, solicitante, observacion }) {
  try {
    const usuariosSnap = await getDocs(collection(db, 'usuarios'))
    const superAdmins = usuariosSnap.docs
      .map(d => ({ uid: d.id, ...d.data() }))
      .filter(u => u.rol === 'Super Administrador')

    await Promise.all(superAdmins.map(u => crearNotificacion({
      destinatarioId: u.uid,
      tipo:           'eliminacion_factura',
      titulo:         `Solicitud de eliminación — ${factura.numero}`,
      cuerpo:         `${solicitante?.nombre || 'Un usuario'} solicita eliminar esta factura. Observación: ${observacion}`,
      link:           `/facturacion/${factura.id}`,
      facturaId:      factura.id,
      facturaNumero:  factura.numero,
      vendedorId:     solicitante?.uid || null,
      meta: {
        accion:      'eliminar_factura',
        observacion,
        solicitante: solicitante?.nombre || 'Usuario',
        clienteNombre: factura.clienteNombre,
        total:       factura.total,
        moneda:      factura.moneda,
      },
    })))
  } catch (e) {
    console.error('[notificaciones] Error solicitando eliminación:', e)
  }
}