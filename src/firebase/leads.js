/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: leads.js
 * Módulo:  Firebase
 * ============================================================
 */

import { db } from './config'
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, orderBy, serverTimestamp, onSnapshot, where
} from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'

const storage = getStorage()

// ── LEADS ──────────────────────────────────────────
const leadsRef = () => collection(db, 'leads')

export const crearLead = (data) =>
  addDoc(leadsRef(), { ...data, creadoEn: serverTimestamp() })

export const actualizarLead = (id, data) =>
  updateDoc(doc(db, 'leads', id), { ...data, actualizadoEn: serverTimestamp() })

export const eliminarLead = (id) =>
  deleteDoc(doc(db, 'leads', id))

export const obtenerLeads = async () => {
  const snap = await getDocs(query(leadsRef(), orderBy('creadoEn', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const obtenerLead = async (id) => {
  const snap = await getDoc(doc(db, 'leads', id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const suscribirLead = (id, callback) =>
  onSnapshot(doc(db, 'leads', id), snap => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() })
  })

// ── NOTAS / CHAT INTERNO ──────────────────────────────────────────
const notasRef = (leadId) => collection(db, 'leads', leadId, 'notas')

export const agregarNota = (leadId, data) =>
  addDoc(notasRef(leadId), { ...data, creadoEn: serverTimestamp() })

export const suscribirNotas = (leadId, callback) => {
  const q = query(notasRef(leadId), orderBy('creadoEn', 'asc'))
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

// ── TIMELINE / ACTIVIDAD ──────────────────────────────────────────
const timelineRef = (leadId) => collection(db, 'leads', leadId, 'timeline')

export const agregarTimeline = (leadId, data) =>
  addDoc(timelineRef(leadId), { ...data, creadoEn: serverTimestamp() })

export const suscribirTimeline = (leadId, callback) => {
  const q = query(timelineRef(leadId), orderBy('creadoEn', 'desc'))
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

// ── ADJUNTOS ──────────────────────────────────────────
const adjuntosRef = (leadId) => collection(db, 'leads', leadId, 'adjuntos')

export const subirAdjunto = async (leadId, file, usuarioNombre) => {
  const nombre = `${Date.now()}_${file.name}`
  const storageRef = ref(storage, `leads/${leadId}/${nombre}`)
  await uploadBytes(storageRef, file)
  const url = await getDownloadURL(storageRef)
  return addDoc(adjuntosRef(leadId), {
    nombre: file.name,
    url,
    tipo: file.type,
    tamano: file.size,
    storageRef: `leads/${leadId}/${nombre}`,
    subidoPor: usuarioNombre,
    creadoEn: serverTimestamp(),
  })
}

export const eliminarAdjunto = async (leadId, adjuntoId, storageRefPath) => {
  await deleteObject(ref(storage, storageRefPath))
  await deleteDoc(doc(db, 'leads', leadId, 'adjuntos', adjuntoId))
}

export const suscribirAdjuntos = (leadId, callback) => {
  const q = query(adjuntosRef(leadId), orderBy('creadoEn', 'desc'))
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

// ── COLUMNAS PIPELINE ──────────────────────────────────────────
const columnasRef = () => collection(db, 'pipeline_columnas')

export const obtenerColumnas = async () => {
  const snap = await getDocs(query(columnasRef(), orderBy('orden')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const crearColumna = (data) =>
  addDoc(columnasRef(), { ...data, creadoEn: serverTimestamp() })

export const actualizarColumna = (id, data) =>
  updateDoc(doc(db, 'pipeline_columnas', id), data)

export const eliminarColumna = (id) =>
  deleteDoc(doc(db, 'pipeline_columnas', id))

// ── ORIGENES ──────────────────────────────────────────
const origenesRef = () => collection(db, 'catalogo_origenes')

export const obtenerOrigenes = async () => {
  const snap = await getDocs(query(origenesRef(), orderBy('nombre')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const crearOrigen = (data) =>
  addDoc(origenesRef(), { ...data, creadoEn: serverTimestamp() })

export const eliminarOrigen = (id) =>
  deleteDoc(doc(db, 'catalogo_origenes', id))

// ── CONTACTOS / EMPRESAS ──────────────────────────────────────────
export const obtenerContactos = async () => {
  const snap = await getDocs(query(collection(db, 'contactos'), orderBy('nombre')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const obtenerEmpresas = async () => {
  const snap = await getDocs(collection(db, 'empresas'))
  return snap.docs.map(d => {
    const data = d.data()
    return { id: d.id, ...data, nombre: data.nombre || data.nombreComercial || data.razonSocial || '' }
  }).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
}

// ── USUARIOS DEL SISTEMA ──────────────────────────────────────────
export const obtenerUsuarios = async () => {
  const snap = await getDocs(collection(db, 'usuarios'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}