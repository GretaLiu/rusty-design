import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: '52px', borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#fff'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <span style={{ fontWeight: '700', fontSize: '16px' }}>Rusty Design</span>
          <NavLink to="/home" style={({ isActive }) => ({
            fontSize: '14px', textDecoration: 'none',
            color: isActive ? '#111' : '#6b7280', fontWeight: isActive ? '600' : '400'
          })}>Home</NavLink>
          <NavLink to="/inventory" style={({ isActive }) => ({
            fontSize: '14px', textDecoration: 'none',
            color: isActive ? '#111' : '#6b7280', fontWeight: isActive ? '600' : '400'
          })}>Inventory</NavLink>
          <NavLink to="/notes" style={({ isActive }) => ({
            fontSize: '14px', textDecoration: 'none',
            color: isActive ? '#111' : '#6b7280', fontWeight: isActive ? '600' : '400'
          })}>Notes</NavLink>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={user?.avatar_url} alt={user?.display_name}
          style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} />
          <span style={{ fontSize: '14px', color: '#374151' }}>{user?.display_name}</span>
          <button onClick={handleLogout} style={{
            fontSize: '13px', color: '#6b7280', background: 'none',
            border: 'none', cursor: 'pointer', padding: '4px 8px'
          }}>Logout</button>
        </div>
      </nav>
      <main style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        <Outlet />
      </main>
    </div>
  )
}