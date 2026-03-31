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
    <div className="min-h-screen flex flex-col">
      <nav className="flex items-center justify-between px-6 h-13 border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <img src="/rusty-design-logo.svg" alt="Rusty Design Dispatch" className="h-10" />
          </div>
          <div className="flex items-center gap-1">
            {[
              { to: '/home', label: 'Home' },
              { to: '/inventory', label: 'Inventory' },
              { to: '/notes', label: 'Notes' },
            ].map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `text-sm px-3 py-1.5 rounded-md transition-colors no-underline ${
                    isActive
                      ? 'text-gray-900 font-semibold bg-gray-100'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50 font-normal'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <img
            src={user?.avatar_url}
            alt={user?.display_name}
            className="w-7 h-7 rounded-full object-cover"
          />
          <span className="text-sm text-gray-700 font-medium">{user?.display_name}</span>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer px-2 py-1 transition-colors"
          >
            Logout
          </button>
        </div>
      </nav>
      <main className="flex-1 bg-gray-50">
        <Outlet />
      </main>
    </div>
  )
}
