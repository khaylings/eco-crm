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