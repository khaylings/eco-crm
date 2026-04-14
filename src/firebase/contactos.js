/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: contactos.js
 * Módulo:  Firebase
 * ============================================================
 */

import { db } from './config'
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, orderBy, serverTimestamp
} from 'firebase/firestore'

const empresasRef = () => collection(db, 'empresas')
const contactosRef = () => collection(db, 'contactos')
const sedesRef = (empresaId) => collection(db, 'empresas', empresaId, 'sedes')
const activosRef = () => collection(db, 'activos')
const serviciosRef = (activoId) => collection(db, 'activos', activoId, 'servicios')

// ── EMPRESAS ──────────────────────────────────────────
export const crearEmpresa = (data) =>
  addDoc(empresasRef(), { ...data, creadoEn: serverTimestamp() })

export const actualizarEmpresa = (id, data) =>
  updateDoc(doc(db, 'empresas', id), data)

export const eliminarEmpresa = (id) =>
  deleteDoc(doc(db, 'empresas', id))

export const obtenerEmpresas = async () => {
  const snap = await getDocs(empresasRef())
  return snap.docs.map(d => {
    const data = d.data()
    return { id: d.id, ...data, nombre: data.nombre || data.nombreComercial || data.razonSocial || '' }
  }).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
}

export const obtenerEmpresa = async (id) => {
  const snap = await getDoc(doc(db, 'empresas', id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// ── SEDES ──────────────────────────────────────────
export const crearSede = (empresaId, data) =>
  addDoc(sedesRef(empresaId), { ...data, creadoEn: serverTimestamp() })

export const actualizarSede = (empresaId, sedeId, data) =>
  updateDoc(doc(db, 'empresas', empresaId, 'sedes', sedeId), data)

export const eliminarSede = (empresaId, sedeId) =>
  deleteDoc(doc(db, 'empresas', empresaId, 'sedes', sedeId))

export const obtenerSedes = async (empresaId) => {
  const snap = await getDocs(sedesRef(empresaId))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const obtenerTodasLasSedes = async () => {
  const empresas = await getDocs(empresasRef())
  const todas = []
  for (const emp of empresas.docs) {
    const sedes = await getDocs(sedesRef(emp.id))
    sedes.docs.forEach(s => todas.push({
      id: s.id,
      empresaId: emp.id,
      empresaNombre: emp.data().nombre,
      ...s.data()
    }))
  }
  return todas
}

// ── CONTACTOS ──────────────────────────────────────────
export const crearContacto = (data) =>
  addDoc(contactosRef(), { ...data, creadoEn: serverTimestamp() })

export const actualizarContacto = (id, data) =>
  updateDoc(doc(db, 'contactos', id), data)

export const eliminarContacto = (id) =>
  deleteDoc(doc(db, 'contactos', id))

export const obtenerContactos = async () => {
  const snap = await getDocs(query(contactosRef(), orderBy('nombre')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const obtenerContacto = async (id) => {
  const snap = await getDoc(doc(db, 'contactos', id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const obtenerContactosPorEmpresa = async (empresaId) => {
  const snap = await getDocs(query(contactosRef(), where('empresaId', '==', empresaId)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const obtenerContactosPorSede = async (sedeId) => {
  const snap = await getDocs(query(contactosRef(), where('sedeId', '==', sedeId)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ── ACTIVOS ──────────────────────────────────────────
export const crearActivo = (data) =>
  addDoc(activosRef(), { ...data, creadoEn: serverTimestamp() })

export const actualizarActivo = (id, data) =>
  updateDoc(doc(db, 'activos', id), data)

export const eliminarActivo = (id) =>
  deleteDoc(doc(db, 'activos', id))

export const obtenerActivosPorPropietario = async (tipo, id) => {
  const snap = await getDocs(
    query(activosRef(), where('propietarioTipo', '==', tipo), where('propietarioId', '==', id))
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const obtenerActivosPorSede = async (sedeId) => {
  const snap = await getDocs(query(activosRef(), where('sedeId', '==', sedeId)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ── SERVICIOS ──────────────────────────────────────────
export const crearServicio = (activoId, data) =>
  addDoc(serviciosRef(activoId), { ...data, creadoEn: serverTimestamp() })

export const obtenerServicios = async (activoId) => {
  const snap = await getDocs(query(serviciosRef(activoId), orderBy('fecha', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const eliminarServicio = (activoId, servicioId) =>
  deleteDoc(doc(db, 'activos', activoId, 'servicios', servicioId))

// ── COLUMNAS PIPELINE ──────────────────────────────────────────
const columnasRef = () => collection(db, 'pipeline_columnas')

export const crearColumna = (data) =>
  addDoc(columnasRef(), { ...data, creadoEn: serverTimestamp() })

export const actualizarColumna = (id, data) =>
  updateDoc(doc(db, 'pipeline_columnas', id), data)

export const eliminarColumna = (id) =>
  deleteDoc(doc(db, 'pipeline_columnas', id))

export const obtenerColumnas = async () => {
  const snap = await getDocs(query(columnasRef(), orderBy('orden')))
  const cols = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  cols.sort((a, b) => { if (a.fija && !b.fija) return 1; if (!a.fija && b.fija) return -1; return (a.orden ?? 0) - (b.orden ?? 0) })
  return cols
}

// ── LEADS ──────────────────────────────────────────
const leadsRef = () => collection(db, 'leads')

export const crearLead = (data) =>
  addDoc(leadsRef(), { ...data, creadoEn: serverTimestamp() })

export const actualizarLead = (id, data) =>
  updateDoc(doc(db, 'leads', id), data)

export const eliminarLead = (id) =>
  deleteDoc(doc(db, 'leads', id))

export const obtenerLeads = async () => {
  const snap = await getDocs(query(leadsRef(), orderBy('creadoEn', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const obtenerLeadsPorContacto = async (contactoId) => {
  const snap = await getDocs(query(leadsRef(), where('contactoId', '==', contactoId)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const obtenerLeadsPorWhatsapp = async (telefono) => {
  const snap = await getDocs(query(leadsRef(), where('whatsapp', '==', telefono)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ── MENSAJES INTERNOS DEL LEAD ──────────────────────────────────────────
const notasLeadRef = (leadId) => collection(db, 'leads', leadId, 'notas')

export const agregarNotaLead = (leadId, data) =>
  addDoc(notasLeadRef(leadId), { ...data, creadoEn: serverTimestamp() })

export const obtenerNotasLead = async (leadId) => {
  const snap = await getDocs(query(notasLeadRef(leadId), orderBy('creadoEn', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ── ORÍGENES (catálogo editable) ──────────────────────────────────────────
const origenesRef = () => collection(db, 'catalogo_origenes')

export const crearOrigen = (data) =>
  addDoc(origenesRef(), { ...data, creadoEn: serverTimestamp() })

export const eliminarOrigen = (id) =>
  deleteDoc(doc(db, 'catalogo_origenes', id))

export const obtenerOrigenes = async () => {
  const snap = await getDocs(query(origenesRef(), orderBy('nombre')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}