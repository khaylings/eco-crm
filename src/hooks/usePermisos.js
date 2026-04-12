/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: usePermisos.js
 * Módulo:  Hooks
 *
 * Uso:
 *   const { puede, puedeVerDe, rol } = usePermisos()
 *   if (puede('facturas', 'Crear factura desde cotización aprobada')) { ... }
 *   if (puedeVerDe('chats', 'Ver chats de todos los vendedores', chat.asignadoA)) { ... }
 * ============================================================
 */

import { useState, useEffect, useContext } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/firestore'
import { AuthContext } from '../context/AuthContext'

// ─── Cache global (evita múltiples lecturas a Firestore) ─────────────────────
let _rolesCache = null
let _listeners = []
let _unsub = null

function notificar() { _listeners.forEach(fn => fn(_rolesCache)) }

function iniciarEscucha() {
  if (_unsub) return
  _unsub = onSnapshot(collection(db, 'roles'), (snap) => {
    _rolesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    notificar()
  }, () => {})
}

// ─── Hook principal ───────────────────────────────────────────────────────────
export function usePermisos() {
  const { usuario } = useContext(AuthContext)
  const [roles, setRoles] = useState(_rolesCache || [])

  useEffect(() => {
    const listener = (data) => setRoles(data || [])
    _listeners.push(listener)
    iniciarEscucha()
    if (_rolesCache) setRoles([..._rolesCache])
    return () => { _listeners = _listeners.filter(l => l !== listener) }
  }, [])

  const rolNombre = usuario?.rol || 'Vendedor'
  const esAdmin = rolNombre === 'Administrador' || rolNombre === 'Super Administrador'

  const esSupervisor = rolNombre === 'Supervisor'

  const rolData = roles.find(r => r.nombre === rolNombre)
  const permisosRol = rolData?.permisos || {}

  /**
   * puede('ventas', 'Crear cotización')        → sub-permiso
   * puede('ventas')                             → acceso al módulo
   */
  const puede = (modulo, accion) => {
    if (esAdmin) return true
    if (!accion) return !!permisosRol[modulo]
    return !!permisosRol[`${modulo}_${accion}`]
  }

  /**
   * Verifica si el usuario puede ver un recurso de otro vendedor.
   * Supervisor y Admin siempre pueden ver todo.
   */
  const puedeVerDe = (modulo, accionTodos, propietarioUid) => {
    if (esAdmin || esSupervisor) return true
    if (puede(modulo, accionTodos)) return true
    return propietarioUid === usuario?.uid
  }

  return {
    puede,
    puedeVerDe,
    esSuperiorOAdmin: esAdmin || esSupervisor,
    esAdmin,
    esSupervisor,
    rol: rolNombre,
    usuario,
  }
}