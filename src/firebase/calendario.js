/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: calendario.js
 * Módulo:  Firebase
 * ============================================================
 */

import { db } from './config'
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, orderBy, serverTimestamp, onSnapshot
} from 'firebase/firestore'

// ── REFERENCIAS ──────────────────────────────────────────
const eventosRef = () => collection(db, 'eventos')
const tiposServicioRef = () => collection(db, 'catalogo_tipos_servicio')
const filtrosCalendarioRef = () => collection(db, 'catalogo_filtros_calendario')

// ── EVENTOS ──────────────────────────────────────────
export const crearEvento = (data) =>
  addDoc(eventosRef(), {
    ...data,
    aprobado: data.aprobado ?? false,
    esIncidencia: data.esIncidencia ?? false,
    statusOT: data.statusOT ?? 'pendiente',
    creadoEn: serverTimestamp(),
  })

export const actualizarEvento = (id, data) =>
  updateDoc(doc(db, 'eventos', id), {
    ...data,
    actualizadoEn: serverTimestamp(),
  })

export const eliminarEvento = (id) =>
  deleteDoc(doc(db, 'eventos', id))

export const obtenerEventos = async () => {
  const snap = await getDocs(query(eventosRef(), orderBy('creadoEn', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const suscribirEventos = (callback) => {
  const q = query(eventosRef(), orderBy('creadoEn', 'desc'))
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

export const moverEvento = (id, fechaInicio, fechaFin) =>
  updateDoc(doc(db, 'eventos', id), {
    fechaInicio,
    fechaFin,
    actualizadoEn: serverTimestamp(),
  })

// ── TIPOS DE SERVICIO ──────────────────────────────────────────
export const crearTipoServicio = (data) =>
  addDoc(tiposServicioRef(), { ...data, creadoEn: serverTimestamp() })

export const actualizarTipoServicio = (id, data) =>
  updateDoc(doc(db, 'catalogo_tipos_servicio', id), data)

export const eliminarTipoServicio = (id) =>
  deleteDoc(doc(db, 'catalogo_tipos_servicio', id))

export const obtenerTiposServicio = async () => {
  const snap = await getDocs(query(tiposServicioRef(), orderBy('nombre')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const suscribirTiposServicio = (callback) => {
  const q = query(tiposServicioRef(), orderBy('nombre'))
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

// ── FILTROS CONFIGURABLES ──────────────────────────────────────────
export const crearFiltro = (data) =>
  addDoc(filtrosCalendarioRef(), { ...data, creadoEn: serverTimestamp() })

export const actualizarFiltro = (id, data) =>
  updateDoc(doc(db, 'catalogo_filtros_calendario', id), data)

export const eliminarFiltro = (id) =>
  deleteDoc(doc(db, 'catalogo_filtros_calendario', id))

export const obtenerFiltros = async () => {
  const snap = await getDocs(query(filtrosCalendarioRef(), orderBy('nombre')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ── NOTAS INTERNAS DEL EVENTO (chat OT) ──────────────────────────────────────────
const notasEventoRef = (eventoId) => collection(db, 'eventos', eventoId, 'notas')

export const agregarNotaEvento = (eventoId, data) =>
  addDoc(notasEventoRef(eventoId), { ...data, creadoEn: serverTimestamp() })

export const obtenerNotasEvento = async (eventoId) => {
  const snap = await getDocs(query(notasEventoRef(eventoId), orderBy('creadoEn', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const suscribirNotasEvento = (eventoId, callback) => {
  const q = query(notasEventoRef(eventoId), orderBy('creadoEn', 'asc'))
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}
