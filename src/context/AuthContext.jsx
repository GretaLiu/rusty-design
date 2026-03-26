import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('rd_user')
    if (stored) setUser(JSON.parse(stored))
    setLoading(false)
  }, [])

  const login = async (username, password) => {
    const { data, error } = await supabase.rpc('verify_user', { p_username: username, p_password: password })
    if (error || !data || data.length === 0) throw new Error('Invalid username or password')
    const u = data[0]
    setUser(u)
    localStorage.setItem('rd_user', JSON.stringify(u))
    return u
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('rd_user')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)