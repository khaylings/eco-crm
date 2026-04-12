/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: useAlertasVencimiento.js
 * Módulo:  Hooks
 * ============================================================
 */

import { useEffect, useRef } from 'react'
import {
  collection, query, where, getDocs,
  addDoc, serverTimestamp, doc, getDoc
} from 'firebase/firestore'
import { db } from '../firebase/config'

const DIAS_ALERTA = 5

const diasHasta = (iso) => {
  if (!iso) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const vence = new Date(iso + 'T00:00:00')
  return Math.ceil((vence - hoy) / 86400000)
}

export function useAlertasVencimiento(usuario) {
  const yaReviso = useRef(false)

  useEffect(() => {
    if (!usuario?.uid || yaReviso.current) return
    yaReviso.current = true
    revisarAlertas(usuario)
  }, [usuario?.uid])
}

async function revisarAlertas(usuario) {
  try {
    await Promise.all([
      revisarVencimientos(usuario),
      revisarTasaDolar(usuario),
    ])
  } catch (e) {
    console.warn('[alertas] Error general:', e)
  }
}

// ── Alertas de vencimiento de facturas ────────────────────────────────────────
async function revisarVencimientos(usuario) {
  try {
    const q = query(collection(db, 'facturas'), where('estado', 'in', ['Sin Pagar', 'Parcial']))
    const snap = await getDocs(q)
    const facturas = snap.docs.map(d => ({ id: d.id, ...d.data() }))

    const hoy = new Date().toISOString().split('T')[0]
    const notifQ = query(
      collection(db, 'notificaciones'),
      where('destinatarioId', '==', usuario.uid),
      where('tipo', 'in', ['factura_vencida', 'factura_proxima'])
    )
    const notifSnap = await getDocs(notifQ)
    const yaNotificadas = new Set(
      notifSnap.docs.map(d => d.data()).filter(n => n.fechaAlerta === hoy).map(n => n.facturaId)
    )

    const nuevas = []
    for (const f of facturas) {
      if (!f.fechaVencimiento || yaNotificadas.has(f.id)) continue
      const dias = diasHasta(f.fechaVencimiento)
      if (dias === null) continue
      if (dias < 0) {
        nuevas.push({ destinatarioId: usuario.uid, tipo: 'factura_vencida', titulo: `Factura vencida — ${f.numero}`, cuerpo: `${f.clienteNombre || 'Cliente'} · Venció hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}`, link: `/facturacion/${f.id}`, facturaId: f.id, facturaNumero: f.numero, fechaAlerta: hoy, leida: false, procesada: false, creadoEn: serverTimestamp() })
      } else if (dias <= DIAS_ALERTA) {
        nuevas.push({ destinatarioId: usuario.uid, tipo: 'factura_proxima', titulo: `Vence en ${dias} día${dias !== 1 ? 's' : ''} — ${f.numero}`, cuerpo: `${f.clienteNombre || 'Cliente'} · Vence el ${f.fechaVencimiento}`, link: `/facturacion/${f.id}`, facturaId: f.id, facturaNumero: f.numero, fechaAlerta: hoy, leida: false, procesada: false, creadoEn: serverTimestamp() })
      }
    }

    await Promise.all(nuevas.map(n => addDoc(collection(db, 'notificaciones'), n)))
    if (nuevas.length > 0) console.log(`[alertas] ${nuevas.length} alerta(s) de vencimiento creadas`)
  } catch (e) {
    console.warn('[alertas] Error revisando vencimientos:', e)
  }
}

// ── Recordatorio diario de tasa del dólar ─────────────────────────────────────
async function revisarTasaDolar(usuario) {
  // Solo para roles con acceso a bancos
  const rolesConAcceso = ['Super Administrador', 'Administrador', 'Supervisor']
  if (!rolesConAcceso.includes(usuario?.rol)) return

  try {
    const hoy = new Date().toISOString().split('T')[0]

    // Ver si ya existe notif de tasa para hoy
    const notifQ = query(
      collection(db, 'notificaciones'),
      where('destinatarioId', '==', usuario.uid),
      where('tipo', '==', 'tasa_recordatorio'),
      where('fechaAlerta', '==', hoy)
    )
    const notifSnap = await getDocs(notifQ)
    if (!notifSnap.empty) return // Ya se notificó hoy

    // Ver si la tasa fue actualizada hoy
    const tasaSnap = await getDoc(doc(db, 'configuracion', 'tasas'))
    if (tasaSnap.exists()) {
      const tasa = tasaSnap.data()
      if (tasa.fecha === hoy) return // Ya está actualizada hoy
    }

    // Crear recordatorio
    await addDoc(collection(db, 'notificaciones'), {
      destinatarioId: usuario.uid,
      tipo:           'tasa_recordatorio',
      titulo:         '💱 Actualizá la tasa del dólar de hoy',
      cuerpo:         tasaSnap.exists()
        ? `Última actualización: ${tasaSnap.data().fecha || 'fecha desconocida'}. Hacé click en el widget 💱 del header para actualizar.`
        : 'No hay tasa registrada. Hacé click en el widget 💱 del header para configurarla.',
      link:           '',
      fechaAlerta:    hoy,
      leida:          false,
      procesada:      false,
      creadoEn:       serverTimestamp(),
    })

    console.log('[alertas] Recordatorio de tasa creado')
  } catch (e) {
    console.warn('[alertas] Error revisando tasa:', e)
  }
}