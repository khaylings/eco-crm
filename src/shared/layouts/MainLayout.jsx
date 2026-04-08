import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function MainLayout() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{
        flex: 1,
        overflowY: 'auto',
        backgroundColor: '#f0f4f8',
        padding: '2rem',
      }}>
        <Outlet />
      </main>
    </div>
  )
}