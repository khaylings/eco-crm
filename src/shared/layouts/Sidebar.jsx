import { NavLink, useNavigate } from 'react-router-dom'
import { useEmpresa } from '../../context/EmpresaContext'
import { signOut } from 'firebase/auth'
import auth from '../../firebase/auth'

const menu = [
  { path: '/crm', label: 'CRM', icon: '👥' },
  { path: '/chats', label: 'Chats', icon: '💬' },
  { path: '/ventas', label: 'Ventas', icon: '📈' },
  { path: '/compras', label: 'Compras', icon: '🛒' },
  { path: '/inventario', label: 'Inventario', icon: '📦' },
  { path: '/calendario', label: 'Calendario', icon: '📅' },
]

export default function Sidebar() {
  const { empresa } = useEmpresa()
  const navigate = useNavigate()

  const cerrarSesion = async () => {
    await signOut(auth)
    navigate('/login')
  }

  const estiloBase = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1.25rem',
    color: '#ffffff',
    textDecoration: 'none',
    borderRadius: '8px',
    fontSize: '0.95rem',
    fontWeight: '500',
    transition: 'all 0.2s',
    borderLeft: '3px solid transparent',
  }

  return (
    <aside style={{
      width: '240px',
      minHeight: '100vh',
      backgroundColor: '#1a3a5c',
      display: 'flex',
      flexDirection: 'column',
      padding: '1.5rem 1rem',
      flexShrink: 0,
    }}>

      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        {empresa?.logoUrl ? (
          <img src={empresa.logoUrl} alt="Logo"
            style={{ maxHeight: '60px', objectFit: 'contain', margin: '0 auto' }} />
        ) : (
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.3rem', lineHeight: 1.2 }}>
            <span style={{ color: '#4caf50', fontWeight: 800 }}>ECO</span>
            <span style={{ color: '#ffffff', fontWeight: 700 }}> INGENIERIA CR</span>
          </div>
        )}
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {menu.map((item) => (
          <NavLink key={item.path} to={item.path}
            style={({ isActive }) => ({
              ...estiloBase,
              backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
              borderLeft: isActive ? '3px solid #4caf50' : '3px solid transparent',
            })}>
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        
        <NavLink to="/configuracion/conectores"
          style={({ isActive }) => ({
            ...estiloBase,
            backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
            borderLeft: isActive ? '3px solid #4caf50' : '3px solid transparent',
          })}>
          <span>🔌</span>
          <span>Conectores</span>
        </NavLink>

        <NavLink to="/configuracion/empresa"
          style={({ isActive }) => ({
            ...estiloBase,
            backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
            borderLeft: isActive ? '3px solid #4caf50' : '3px solid transparent',
          })}>
          <span>⚙️</span>
          <span>Mi Empresa</span>
        </NavLink>

        <button onClick={cerrarSesion}
          style={{
            ...estiloBase,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            textAlign: 'left',
            color: '#ff8a80',
          }}>
          <span>🚪</span>
          <span>Cerrar sesion</span>
        </button>
      </div>
    </aside>
  )
}