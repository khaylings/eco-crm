/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: wasenderService.js
 * Módulo:  Services
 * ============================================================
 */

const BASE_URL = import.meta.env.VITE_WASENDER_API_URL;
const PERSONAL_TOKEN = import.meta.env.VITE_WASENDER_PERSONAL_TOKEN;
const SESSION_TOKEN = import.meta.env.VITE_WASENDER_SESSION_TOKEN;
const SESSION_ID = import.meta.env.VITE_WASENDER_SESSION;
const DECRYPT_URL = import.meta.env.VITE_DECRYPT_URL;

const personalHeaders = {
  'Authorization': `Bearer ${PERSONAL_TOKEN}`,
  'Content-Type': 'application/json',
};

const sessionHeaders = {
  'Authorization': `Bearer ${SESSION_TOKEN}`,
  'Content-Type': 'application/json',
};

export const connectSession = async () => {
  const res = await fetch(`${BASE_URL}/whatsapp-sessions/${SESSION_ID}/connect`, {
    method: 'POST',
    headers: personalHeaders,
  });
  return res.json();
};

export const getSessionStatus = async () => {
  const res = await fetch(`${BASE_URL}/whatsapp-sessions/${SESSION_ID}`, {
    headers: personalHeaders,
  });
  return res.json();
};

export const getQRCode = async () => {
  const res = await fetch(`${BASE_URL}/whatsapp-sessions/${SESSION_ID}/qrcode`, {
    headers: personalHeaders,
  });
  const data = await res.json();
  return data?.data?.qrCode || null;
};

export const sendTextMessage = async (to, text) => {
  const res = await fetch(`${BASE_URL}/send-message`, {
    method: 'POST',
    headers: sessionHeaders,
    body: JSON.stringify({ to, text }),
  });
  return res.json();
};

export const getContacts = async () => {
  const res = await fetch(`${BASE_URL}/contacts`, {
    headers: sessionHeaders,
  });
  return res.json();
};

export const decryptMedia = async (msgRaw) => {
  const res = await fetch(`${DECRYPT_URL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msgRaw,
      sessionToken: SESSION_TOKEN,
    }),
  });
  return res.json();
};