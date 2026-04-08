import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import MainLayout from '../shared/layouts/MainLayout'
import Login from '../pages/Login'
import CRMPage from '../modules/crm/pages/CRMPage'
import VentasPage from '../modules/ventas/pages/VentasPage'
import ComprasPage from '../modules/compras/pages/ComprasPage'
import InventarioPage from '../modules/inventario/pages/InventarioPage'
import CalendarioPage from '../modules/calendario/pages/CalendarioPage'
import MiEmpresa from '../modules/configuracion/pages/MiEmpresa'
import ChatsPage from '../modules/crm/pages/ChatsPage'
import Conectores from '../modules/configuracion/pages/Conectores'
import WhatsAppConector from '../modules/configuracion/pages/WhatsAppConector'

function RutaProtegida({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RutaProtegida>
              <MainLayout />
            </RutaProtegida>
          }
        >
          <Route index element={<Navigate to="/crm" replace />} />
          <Route path="crm" element={<CRMPage />} />
          <Route path="chats" element={<ChatsPage />} />
          <Route path="ventas" element={<VentasPage />} />
          <Route path="compras" element={<ComprasPage />} />
          <Route path="inventario" element={<InventarioPage />} />
          <Route path="calendario" element={<CalendarioPage />} />
          <Route path="configuracion/empresa" element={<MiEmpresa />} />
          <Route path="configuracion/conectores" element={<Conectores />} />
          <Route path="configuracion/conectores/whatsapp" element={<WhatsAppConector />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}