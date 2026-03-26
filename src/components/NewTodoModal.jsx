import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function NewTodoModal({ users, onClose, onCreated }) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!text.trim() || !assignedTo) return
    setSubmitting(true)
    const { data: todo } = await supabase
      .from('todos')
      .insert({ text: text.trim(), assigned_to: assignedTo, created_by: user.id })
      .select().single()
    if (todo) {
      await supabase.from('activity_log').insert({
        entity_type: 'todo', entity_id: todo.id,
        action: 'created', performed_by: user.id
      })
    }
    setSubmitting(false)
    onCreated()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
    }} onClick={onClose}>
      <div style={{
        backgroundColor: '#fff', borderRadius: '10px', width: '420px', maxWidth: '95vw',
        padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>New Todo</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af' }}>✕</button>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>
            TASK <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input value={text} onChange={e => setText(e.target.value)}
            placeholder="What needs to be done?"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{
              width: '100%', padding: '8px 10px', border: '1px solid #d1d5db',
              borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box'
            }} />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>
            ASSIGN TO <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
            style={{
              width: '100%', padding: '8px 10px', border: '1px solid #d1d5db',
              borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box',
              color: assignedTo ? '#111' : '#9ca3af'
            }}>
            <option value="">Select person...</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', backgroundColor: '#fff', border: '1px solid #d1d5db',
            borderRadius: '6px', fontSize: '13px', cursor: 'pointer', color: '#374151'
          }}>Cancel</button>
          <button onClick={handleSubmit} disabled={submitting || !text.trim() || !assignedTo} style={{
            padding: '8px 20px', backgroundColor: '#111', color: '#fff',
            border: 'none', borderRadius: '6px', fontSize: '13px',
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting || !text.trim() || !assignedTo ? 0.5 : 1
          }}>{submitting ? 'Adding...' : 'Add Todo'}</button>
        </div>
      </div>
    </div>
  )
}