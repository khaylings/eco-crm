/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: index.jsx
 * Módulo:  Router
 * ============================================================
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import MainLayout from '../shared/layouts/MainLayout'
import Login from '../pages/Login'
import InicioPage from '../pages/InicioPage'
import CRMPage from '../modules/crm/pages/CRMPage'
import ChatsPage from '../modules/crm/pages/ChatsPage'
import ContactosPage from '../modules/contactos/pages/ContactosPage'
import EmpresasPage from '../modules/empresas/pages/EmpresasPage'
import ActivosPage from '../modules/activos/pages/ActivosPage'
import FichaActivoPage from '../modules/activos/pages/FichaActivoPage'
import VentasPage from '../modules/ventas/pages/VentasPage'
import CotizacionForm from '../modules/ventas/pages/CotizacionForm'
import CotizacionPublica from '../pages/CotizacionPublica'

// ── Compras ───────────────────────────────────────────────────────────────────
import ComprasPage from '../modules/compras/pages/ComprasPage'
import OrdenCompraForm from '../modules/compras/pages/OrdenCompraForm'
import ProveedoresPage from '../modules/compras/pages/ProveedoresPage'
import GastosRecurrentesPage from '../modules/compras/pages/GastosRecurrentesPage'

import InventarioPage from '../modules/inventario/pages/InventarioPage'
import CalendarioPage from '../modules/calendario/pages/CalendarioPage'
import OrdenTrabajoPage from '../modules/ordentrabajo/pages/OrdenTrabajoPage'
import FichaLeadPage from '../modules/leads/pages/FichaLeadPage'
import Conectores from '../modules/configuracion/pages/Conectores'
import WhatsAppConector from '../modules/configuracion/pages/WhatsAppConector'
import MiPerfil from '../modules/configuracion/pages/MiPerfil'
import Usuarios from '../modules/configuracion/pages/Usuarios'
import Roles from '../modules/configuracion/pages/Roles'
import DevToolsPage from '../modules/configuracion/pages/DevToolsPage'
import PlantillaProyecto from '../modules/configuracion/pages/PlantillaProyecto'
import PlantillaCotizacion from '../modules/configuracion/pages/PlantillaCotizacion'
import ConfiguracionInventario from '../modules/configuracion/pages/ConfiguracionInventario'

// ── Proyectos ──────────────────────────────────────────────────────────────────
import ProyectosPage from '../modules/proyectos/pages/ProyectosPage'
import ProyectoDetalle from '../modules/proyectos/pages/ProyectoDetalle'
import CotizadorProyecto from '../modules/proyectos/pages/CotizadorProyecto'

// ── Facturación ────────────────────────────────────────────────────────────────
import FacturacionPage from '../modules/facturacion/pages/FacturacionPage'
import FacturaDetalle from '../modules/facturacion/pages/FacturaDetalle'

// ── Bancos ─────────────────────────────────────────────────────────────────────
import BancosPage from '../modules/bancos/pages/BancosPage'

// ── Finanzas ───────────────────────────────────────────────────────────────────
import FinanzasPage from '../modules/finanzas/pages/FinanzasPage'

// ── Operaciones ───────────────────────────────────────────────────────────────
import OperacionesPage from '../modules/operaciones/pages/OperacionesPage'

// ── Configuración ──────────────────────────────────────────────────────────────
import ConfiguracionPage from '../modules/configuracion/pages/ConfiguracionPage'

// ── Email (carpeta: correo) ────────────────────────────────────────────────────
import EmailPage from '../modules/correo/pages/EmailPage'

function RutaProtegida({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Ruta pública — portal del cliente */}
        <Route path="/cotizacion/:id" element={<CotizacionPublica />} />

        <Route path="/" element={<RutaProtegida><MainLayout /></RutaProtegida>}>
          <Route index element={<InicioPage />} />
          <Route path="crm" element={<CRMPage />} />
          <Route path="crm/lead/:id" element={<FichaLeadPage />} />
          <Route path="chats" element={<ChatsPage />} />

          {/* ── Email ── */}
          <Route path="email" element={<EmailPage />} />

          <Route path="contactos" element={<ContactosPage />} />
          <Route path="empresas" element={<ContactosPage />} />
          <Route path="activos" element={<ActivosPage />} />
          <Route path="activos/:id" element={<FichaActivoPage />} />
          <Route path="ventas" element={<VentasPage />} />
          <Route path="ventas/cotizacion/:id" element={<CotizacionForm />} />

          {/* ── Compras ── */}
          <Route path="compras" element={<ComprasPage />} />
          <Route path="compras/nueva" element={<OrdenCompraForm />} />
          <Route path="compras/proveedores" element={<ProveedoresPage />} />
          <Route path="compras/recurrentes" element={<GastosRecurrentesPage />} />
          <Route path="compras/:id" element={<OrdenCompraForm />} />

          <Route path="inventario" element={<InventarioPage />} />
          <Route path="calendario" element={<CalendarioPage />} />
          <Route path="operaciones" element={<OperacionesPage />} />
          <Route path="ordenes-trabajo" element={<OrdenTrabajoPage />} />

          {/* ── Proyectos ── */}
          <Route path="proyectos" element={<ProyectosPage />} />
          <Route path="proyectos/:id" element={<ProyectoDetalle />} />
          <Route path="proyectos/:proyId/cotizacion/:cotId" element={<CotizadorProyecto />} />

          {/* ── Facturación ── */}
          <Route path="facturacion" element={<FacturacionPage />} />
          <Route path="facturacion/:id" element={<FacturaDetalle />} />

          {/* ── Bancos ── */}
          <Route path="bancos" element={<BancosPage />} />

          {/* ── Finanzas ── */}
          <Route path="finanzas" element={<FinanzasPage />} />

          {/* ── Configuración ── */}
          <Route path="configuracion" element={<ConfiguracionPage />} />
          <Route path="configuracion/conectores" element={<Conectores />} />
          <Route path="configuracion/conectores/whatsapp" element={<WhatsAppConector />} />
          <Route path="configuracion/perfil" element={<MiPerfil />} />
          <Route path="configuracion/usuarios" element={<Usuarios />} />
          <Route path="configuracion/roles" element={<Roles />} />
          <Route path="configuracion/devtools" element={<DevToolsPage />} />
          <Route path="configuracion/plantilla-proyecto" element={<PlantillaProyecto />} />
          <Route path="configuracion/plantilla-cotizacion" element={<PlantillaCotizacion />} />
          <Route path="configuracion/inventario" element={<ConfiguracionInventario />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}