/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: auth.js
 * Módulo:  Firebase
 * ============================================================
 */

import { getAuth } from 'firebase/auth'
import app from './config'

const auth = getAuth(app)
export default auth