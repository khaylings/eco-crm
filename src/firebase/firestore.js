/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: firestore.js
 * Módulo:  Firebase
 * ============================================================
 */

import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import app from './config'

export const db = getFirestore(app)
export const storage = getStorage(app)