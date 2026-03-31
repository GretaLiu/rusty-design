import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function TodoDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [todo, setTodo] = useState(null)
  const [log, setLog] = useState([])
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [users, setUsers] = useState([])
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchAll() }, [id])

  const fetchAll = async () => {
    const { data: t } = await supabase
      .from('todos')
      .select(`id, text, completed, completed_at, created_at, message_id,
        assigned_user:users!todos_assigned_to_fkey(display_name, avatar_url),
        created_by_user:users!todos_created_by_fkey(display_name, avatar_url),
        completed_by_user:users!todos_completed_by_fkey(display_name),
        message:messages(id, title),
        edits:todo_edits(id, old_text, new_text, edited_at,
          edited_by_user:users!todo_edits_edited_by_fkey(display_name, avatar_url))`)
      .eq('id', id)
      .single()
    setTodo(t)
    setEditText(t?.text || '')

    const { data: l } = await supabase
      .from('activity_log')
      .select(`id, action, created_at,
        performed_by_user:users!activity_log_performed_by_fkey(display_name, avatar_url)`)
      .eq('entity_type', 'todo')
      .eq('entity_id', id)
      .order('created_at', { ascending: false })
    setLog(l || [])

    const { data: u } = await supabase.from('users').select('id, display_name, avatar_url')
    setUsers(u || [])
  }

  const toggleComplete = async () => {
    const newVal = !todo.completed
    await supabase.from('todos').update({
      completed: newVal,
      completed_by: newVal ? user.id : null,
      completed_at: newVal ? new Date().toISOString() : null
    }).eq('id', id)
    await supabase.from('activity_log').insert({
      entity_type: 'todo', entity_id: id,
      action: newVal ? 'completed' : 'reopened', performed_by: user.id
    })
    fetchAll()
  }

  const handleEdit = async () => {
    if (!editText.trim() || editText === todo.text) { setEditing(false); return }
    await supabase.from('todo_edits').insert({
      todo_id: id, old_text: todo.text, new_text: editText.trim(), edited_by: user.id
    })
    await supabase.from('todos').update({ text: editText.trim() }).eq('id', id)
    await supabase.from('activity_log').insert({
      entity_type: 'todo', entity_id: id,
      action: 'edited', performed_by: user.id
    })
    setEditing(false)
    fetchAll()
  }

  const handleDelete = async () => {
    setDeleting(true)
    await supabase.from('todos').delete().eq('id', id)
    navigate(todo.message_id ? `/home/messages/${todo.message_id}` : '/home/todos')
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  })

  if (!todo) return null

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#6b7280', padding: 0
        }}>← Back</button>
      </div>

      {/* Todo */}
      <div style={{
        backgroundColor: '#fff', border: '1px solid #e5e7eb',
        borderRadius: '8px', padding: '20px', marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
          <button onClick={toggleComplete} style={{
            width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, marginTop: '2px',
            border: `2px solid ${todo.completed ? '#10b981' : '#d1d5db'}`,
            backgroundColor: todo.completed ? '#10b981' : 'transparent',
            cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {todo.completed && <span style={{ color: '#fff', fontSize: '11px' }}>✓</span>}
          </button>
          <div style={{ flex: 1 }}>
            {editing ? (
              <div>
                <input value={editText} onChange={e => setEditText(e.target.value)}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleEdit(); if (e.key === 'Escape') setEditing(false) }}
                  style={{
                    width: '100%', padding: '6px 8px', border: '1px solid #d1d5db',
                    borderRadius: '6px', fontSize: '15px', boxSizing: 'border-box', marginBottom: '8px'
                  }} />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={handleEdit} style={{
                    fontSize: '12px', padding: '3px 10px', backgroundColor: '#111', color: '#fff',
                    border: 'none', borderRadius: '5px', cursor: 'pointer'
                  }}>Save</button>
                  <button onClick={() => { setEditing(false); setEditText(todo.text) }} style={{
                    fontSize: '12px', padding: '3px 10px', backgroundColor: '#fff', color: '#374151',
                    border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer'
                  }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '15px', fontWeight: '500',
                  color: todo.completed ? '#9ca3af' : '#111',
                  textDecoration: todo.completed ? 'line-through' : 'none'
                }}>{todo.text}</span>
                <button onClick={() => setEditing(true)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '12px', color: '#9ca3af', padding: '0 4px'
                }}>Edit</button>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '24px', fontSize: '12px', color: '#6b7280' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Assigned to</span>
            <img src={todo.assigned_user?.avatar_url} alt=""
              style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }} />
            <span style={{ fontWeight: '500', color: '#374151' }}>{todo.assigned_user?.display_name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Created by</span>
            <img src={todo.created_by_user?.avatar_url} alt=""
              style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }} />
            <span style={{ fontWeight: '500', color: '#374151' }}>{todo.created_by_user?.display_name}</span>
          </div>
        </div>

        {todo.message && (
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f3f4f6' }}>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>From message: </span>
            <button onClick={() => navigate(`/home/messages/${todo.message.id}`)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '12px', color: '#2563eb', padding: 0
            }}>{todo.message.title}</button>
          </div>
        )}

        {todo.completed && (
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f3f4f6', fontSize: '12px', color: '#9ca3af' }}>
            Completed by {todo.completed_by_user?.display_name} · {formatDate(todo.completed_at)}
          </div>
        )}
      </div>

      {/* Edit history */}
      {todo.edits?.length > 0 && (
        <div style={{
          backgroundColor: '#fff', border: '1px solid #e5e7eb',
          borderRadius: '8px', padding: '16px', marginBottom: '20px'
        }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', margin: '0 0 12px' }}>Edit History</h3>
          {todo.edits.map(edit => (
            <div key={edit.id} style={{ marginBottom: '10px', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <img src={edit.edited_by_user?.avatar_url} alt=""
                  style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }} />
                <span style={{ color: '#6b7280' }}>{edit.edited_by_user?.display_name} · {formatDate(edit.edited_at)}</span>
              </div>
              <div style={{ paddingLeft: '22px' }}>
                <span style={{ color: '#9ca3af', textDecoration: 'line-through' }}>{edit.old_text}</span>
                <span style={{ color: '#9ca3af', margin: '0 6px' }}>→</span>
                <span style={{ color: '#111' }}>{edit.new_text}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Activity log */}
      <div style={{
        backgroundColor: '#fff', border: '1px solid #e5e7eb',
        borderRadius: '8px', padding: '16px'
      }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', margin: '0 0 12px' }}>Activity</h3>
        {log.length === 0 && <p style={{ fontSize: '13px', color: '#9ca3af' }}>No activity</p>}
        {log.map(entry => (
          <div key={entry.id} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            marginBottom: '8px', fontSize: '12px'
          }}>
            <img src={entry.performed_by_user?.avatar_url} alt=""
              style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            <span style={{ color: '#374151' }}>
              <span style={{ fontWeight: '500' }}>{entry.performed_by_user?.display_name}</span>
              {' '}{entry.action} this todo
            </span>
            <span style={{ color: '#9ca3af', marginLeft: 'auto', flexShrink: 0 }}>
              {formatDate(entry.created_at)}
            </span>
          </div>
        ))}
      </div>

      {/* Danger zone */}
      <div style={{
        marginTop: '48px', borderTop: '1px solid #fee2e2', paddingTop: '24px'
      }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#ef4444', margin: '0 0 6px' }}>Danger Zone</h3>
        <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 16px' }}>
          Permanently delete this todo. This cannot be undone.
        </p>
        {!showDelete ? (
          <button onClick={() => setShowDelete(true)} style={{
            fontSize: '12px', padding: '6px 14px', backgroundColor: '#fff', color: '#ef4444',
            border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer'
          }}>Delete this todo</button>
        ) : (
          <div style={{
            border: '1px solid #fca5a5', borderRadius: '8px', padding: '16px', backgroundColor: '#fff5f5'
          }}>
            <p style={{ fontSize: '12px', color: '#374151', margin: '0 0 10px' }}>
              Type <strong style={{ fontFamily: 'monospace' }}>{todo.text}</strong> to confirm deletion:
            </p>
            <input
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder={todo.text}
              style={{
                padding: '6px 10px', border: '1px solid #fca5a5', borderRadius: '6px',
                fontSize: '13px', width: '100%', boxSizing: 'border-box', marginBottom: '10px',
                backgroundColor: '#fff'
              }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleDelete}
                disabled={deleting || deleteConfirmText !== todo.text}
                style={{
                  fontSize: '12px', padding: '6px 14px', backgroundColor: '#ef4444', color: '#fff',
                  border: 'none', borderRadius: '6px', cursor: 'pointer',
                  opacity: deleting || deleteConfirmText !== todo.text ? 0.4 : 1
                }}>{deleting ? 'Deleting...' : 'I understand, delete permanently'}</button>
              <button onClick={() => { setShowDelete(false); setDeleteConfirmText('') }} style={{
                fontSize: '12px', padding: '6px 14px', backgroundColor: '#fff', color: '#374151',
                border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer'
              }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}