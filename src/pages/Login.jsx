import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/home')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', backgroundColor: '#f9fafb'
    }}>
      <div style={{
        backgroundColor: '#fff', padding: '40px', borderRadius: '8px',
        border: '1px solid #e5e7eb', width: '320px'
      }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '24px', textAlign: 'center' }}>
          Rusty Design
        </h1>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#374151', marginBottom: '6px' }}>
              Username
            </label>
            <input
              value={username} onChange={e => setUsername(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', border: '1px solid #d1d5db',
                borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#374151', marginBottom: '6px' }}>
              Password
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', border: '1px solid #d1d5db',
                borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box'
              }}
            />
          </div>
          {error && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '9px', backgroundColor: '#111', color: '#fff',
            border: 'none', borderRadius: '6px', fontSize: '14px', cursor: 'pointer'
          }}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}