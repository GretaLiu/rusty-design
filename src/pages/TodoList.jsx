import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import NewTodoModal from '../components/NewTodoModal'

const tabStyle = (active) => ({
  flex: 1, padding: '6px', border: 'none', borderRadius: '6px', cursor: 'pointer',
  fontSize: '13px', fontWeight: active ? '600' : '400',
  backgroundColor: active ? '#fff' : 'transparent',
  color: active ? '#111' : '#6b7280',
  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
})

export default function TodoList() {
  const [tab, setTab] = useState('active')
  const [myTodos, setMyTodos] = useState([])
  const [otherTodos, setOtherTodos] = useState([])
  const [log, setLog] = useState([])
  const [users, setUsers] = useState([])
  const [showModal, setShowModal] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { fetchUsers() }, [])
  useEffect(() => {
    if (tab === 'active') fetchTodos(false)
    else if (tab === 'completed') fetchTodos(true)
    else fetchLog()
  }, [tab, user])

  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('id, display_name, avatar_url')
    setUsers(data || [])
  }

  const fetchTodos = async (completed) => {
    if (!user) return
    const fields = `id, text, completed, completed_at, created_at, message_id,
      assigned_user:users!todos_assigned_to_fkey(display_name, avatar_url),
      created_by_user:users!todos_created_by_fkey(display_name),
      message:messages(title)`

    const { data: mine } = await supabase
      .from('todos').select(fields)
      .eq('assigned_to', user.id).eq('completed', completed)
      .order('created_at', { ascending: false })
    setMyTodos(mine || [])

    const { data: others } = await supabase
      .from('todos').select(fields)
      .neq('assigned_to', user.id).eq('completed', completed)
      .order('created_at', { ascending: false })
    setOtherTodos(others || [])
  }

  const fetchLog = async () => {
    const { data } = await supabase
      .from('activity_log')
      .select(`id, action, created_at, entity_id,
        performed_by_user:users!activity_log_performed_by_fkey(display_name, avatar_url)`)
      .eq('entity_type', 'todo')
      .order('created_at', { ascending: false })
      .limit(100)
    setLog(data || [])
  }

  const toggleComplete = async (e, todo) => {
    e.stopPropagation()
    const newVal = !todo.completed
    await supabase.from('todos').update({
      completed: newVal,
      completed_by: newVal ? user.id : null,
      completed_at: newVal ? new Date().toISOString() : null
    }).eq('id', todo.id)
    await supabase.from('activity_log').insert({
      entity_type: 'todo', entity_id: todo.id,
      action: newVal ? 'completed' : 'reopened', performed_by: user.id
    })
    if (tab === 'active') fetchTodos(false)
    else fetchTodos(true)
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  })

  const TodoRow = ({ todo }) => (
    <div onClick={() => navigate(`/home/todos/${todo.id}`)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 14px', borderBottom: '1px solid #f3f4f6',
        cursor: 'pointer', backgroundColor: '#fff'
      }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9fafb'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
    >
      <button onClick={e => toggleComplete(e, todo)} style={{
        width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${todo.completed ? '#10b981' : '#d1d5db'}`,
        backgroundColor: todo.completed ? '#10b981' : 'transparent',
        cursor: 'pointer', padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {todo.completed && <span style={{ color: '#fff', fontSize: '9px' }}>✓</span>}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: '13px', display: 'block',
          color: todo.completed ? '#9ca3af' : '#111',
          textDecoration: todo.completed ? 'line-through' : 'none',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>{todo.text}</span>
        {todo.message?.title && (
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>↳ {todo.message.title}</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <img src={todo.assigned_user?.avatar_url} alt=""
          style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
        <span style={{ fontSize: '11px', color: '#9ca3af' }}>{todo.assigned_user?.display_name}</span>
      </div>
    </div>
  )

  const Column = ({ title, todos }) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid #e5e7eb',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#111' }}>{title}</span>
        <span style={{ fontSize: '11px', color: '#9ca3af' }}>{todos.length}</span>
      </div>
      {todos.length === 0
        ? <p style={{ padding: '24px 14px', fontSize: '13px', color: '#9ca3af', textAlign: 'center' }}>
            {tab === 'active' ? 'No open todos' : 'No completed todos'}
          </p>
        : todos.map(t => <TodoRow key={t.id} todo={t} />)
      }
    </div>
  )

  const actionLabel = (action) => {
    const map = {
      created: 'created a todo',
      completed: 'completed a todo',
      reopened: 'reopened a todo',
      edited: 'edited a todo',
      deleted: 'deleted a todo'
    }
    return map[action] || action
  }

  return (
    <>
      <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => navigate('/home')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '13px', color: '#6b7280', padding: 0
            }}>← Back</button>
            <h1 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Todos</h1>
          </div>
          <button onClick={() => setShowModal(true)} style={{
            fontSize: '12px', padding: '4px 12px', backgroundColor: '#111', color: '#fff',
            border: 'none', borderRadius: '5px', cursor: 'pointer'
          }}>+ New Todo</button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: '4px', marginBottom: '16px',
          backgroundColor: '#f3f4f6', borderRadius: '8px', padding: '4px'
        }}>
          {['active', 'completed', 'log'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={tabStyle(tab === t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Active / Completed: two columns */}
        {(tab === 'active' || tab === 'completed') && (
          <div style={{
            backgroundColor: '#fff', border: '1px solid #e5e7eb',
            borderRadius: '8px', overflow: 'hidden', display: 'flex'
          }}>
            <Column title="Assigned to Me" todos={myTodos} />
            <div style={{ width: '1px', backgroundColor: '#e5e7eb', flexShrink: 0 }} />
            <Column title="Others" todos={otherTodos} />
          </div>
        )}

        {/* Log tab */}
        {tab === 'log' && (
          <div style={{
            backgroundColor: '#fff', border: '1px solid #e5e7eb',
            borderRadius: '8px', overflow: 'hidden'
          }}>
            {log.length === 0 && (
              <p style={{ padding: '24px', fontSize: '13px', color: '#9ca3af', textAlign: 'center' }}>
                No activity yet
              </p>
            )}
            {log.map(entry => (
              <div key={entry.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 16px', borderBottom: '1px solid #f3f4f6', fontSize: '13px'
              }}>
                <img src={entry.performed_by_user?.avatar_url} alt=""
                  style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                <span style={{ color: '#374151' }}>
                  <span style={{ fontWeight: '500' }}>{entry.performed_by_user?.display_name}</span>
                  {' '}{actionLabel(entry.action)}
                </span>
                <button
                  onClick={() => navigate(`/home/todos/${entry.entity_id}`)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '11px', color: '#2563eb', padding: 0, flexShrink: 0
                  }}>view →</button>
                <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: 'auto', flexShrink: 0 }}>
                  {formatDate(entry.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <NewTodoModal
          users={users}
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false)
            if (tab === 'active') fetchTodos(false)
          }}
        />
      )}
    </>
  )
}