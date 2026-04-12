/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: fechas.js
 * Módulo:  Calendario
 * ============================================================
 */

// ────────────────────────────────────────────────
// Utilidades de fecha para ECO-CRM Calendario
// ────────────────────────────────────────────────

export function dateToStr(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function strToDate(str) {
  if (!str) return null;
  // Si es un Timestamp de Firestore
  if (str?.toDate) return str.toDate();
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function sameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isInRange(evento, date) {
  const start = strToDate(evento.fechaInicio);
  const end = strToDate(evento.fechaFin || evento.fechaInicio);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return d >= s && d <= e;
}

export function isMultiday(evento) {
  if (!evento.fechaFin) return false;
  return evento.fechaInicio !== evento.fechaFin;
}

export function getDiffDays(fechaInicio, fechaFin) {
  const s = strToDate(fechaInicio);
  const e = strToDate(fechaFin || fechaInicio);
  return Math.round((e - s) / (1000 * 60 * 60 * 24));
}

export function addDays(dateStr, days) {
  const d = strToDate(dateStr);
  d.setDate(d.getDate() + days);
  return dateToStr(d);
}

export function getWeekDays(date) {
  const d = new Date(date);
  let dow = d.getDay();
  if (dow === 0) dow = 7;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow + 1);
  return Array.from({ length: 7 }, (_, i) =>
    new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
  );
}

export function getMonthDays(date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const first = new Date(y, m, 1);
  let dow = first.getDay();
  if (dow === 0) dow = 7;

  const days = [];
  for (let i = 1; i < dow; i++) days.push(new Date(y, m, 1 - dow + i));
  const last = new Date(y, m + 1, 0).getDate();
  for (let d = 1; d <= last; d++) days.push(new Date(y, m, d));
  while (days.length % 7 !== 0) {
    days.push(new Date(y, m + 1, days.length - (last + dow - 2)));
  }
  return days;
}

export function formatDateLabel(date, options = {}) {
  return date.toLocaleDateString('es-CR', options).replace(/^\w/, c => c.toUpperCase());
}

export function formatMonthYear(date) {
  return formatDateLabel(date, { month: 'long', year: 'numeric' });
}

export function formatDayFull(date) {
  return formatDateLabel(date, { weekday: 'long', day: 'numeric', month: 'long' });
}
