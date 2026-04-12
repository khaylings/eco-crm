/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: CRMPage.jsx
 * Módulo:  CRM
 * ============================================================
 */
import { AuthProvider } from './context/AuthContext'
import { EmpresaProvider } from './context/EmpresaContext'
import AppRouter from './router/index'

export default function App() {
  return (
    <AuthProvider>
      <EmpresaProvider>
        <AppRouter />
      </EmpresaProvider>
    </AuthProvider>
  )
}