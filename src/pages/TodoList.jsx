import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import NewTodoModal from '../components/NewTodoModal'

export default function TodoList() {
  const [myTodos, setMyTodos] = useState([])
  const [otherTodos, setOtherTodos] = useState([])
  const [users, setUsers] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { fetchAll() }, [user, showCompleted])

  const fetchAll = async () => {
    if (!user) return
    const { data: allUsers } = await supabase.from('users').select('id, display_name, avatar_url')
    setUsers(allUsers || [])

    const { data: mine } = await supabase
      .from('todos')
      .select(`id, text, completed, completed_at, created_at, message_id,
        assigned_user:users!todos_assigned_to_fkey(display_name, avatar_url),
        created_by_user:users!todos_created_by_fkey(display_name),
        message:messages(title)`)
      .eq('assigned_to', user.id)
      .eq('completed', showCompleted)
      .order('created_at', { ascending: false })
    setMyTodos(mine || [])

    const { data: others } = await supabase
      .from('todos')
      .select(`id, text, completed, completed_at, created_at, message_id,
        assigned_user:users!todos_assigned_to_fkey(display_name, avatar_url),
        created_by_user:users!todos_created_by_fkey(display_name),
        message:messages(title)`)
      .neq('assigned_to', user.id)
      .eq('completed', showCompleted)
      .order('created_at', { ascending: false })
    setOtherTodos(others || [])
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
    fetchAll()
  }

  const deleteTodo = async (e, todo) => {
    e.stopPropagation()
    if (!window.confirm('Delete this todo?')) return
    await supabase.from('todos').delete().eq('id', todo.id)
    fetchAll()
  }

  const TodoRow = ({ todo }) => (
    <div
      onClick={() => navigate(`/home/todos/${todo.id}`)}
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
          fontSize: '13px', color: todo.completed ? '#9ca3af' : '#111',
          textDecoration: todo.completed ? 'line-through' : 'none',
          display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
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
      <button onClick={e => deleteTodo(e, todo)} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#d1d5db', fontSize: '14px', padding: '0 2px', flexShrink: 0
      }}>✕</button>
    </div>
  )

  const Column = ({ title, todos, emptyText }) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        padding: '12px 14px', borderBottom: '1px solid #e5e7eb',
        fontSize: '13px', fontWeight: '600', color: '#111',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <span>{title}</span>
        <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '400' }}>{todos.length}</span>
      </div>
      {todos.length === 0
        ? <p style={{ padding: '24px 14px', fontSize: '13px', color: '#9ca3af', textAlign: 'center' }}>{emptyText}</p>
        : todos.map(t => <TodoRow key={t.id} todo={t} />)
      }
    </div>
  )

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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => setShowCompleted(v => !v)} style={{
              fontSize: '12px', padding: '4px 12px', border: '1px solid #d1d5db',
              borderRadius: '5px', cursor: 'pointer', backgroundColor: '#fff', color: '#374151'
            }}>
              {showCompleted ? 'Show Open' : 'Show Completed'}
            </button>
            <button onClick={() => setShowModal(true)} style={{
              fontSize: '12px', padding: '4px 12px', backgroundColor: '#111', color: '#fff',
              border: 'none', borderRadius: '5px', cursor: 'pointer'
            }}>+ New Todo</button>
          </div>
        </div>

        <div style={{
          backgroundColor: '#fff', border: '1px solid #e5e7eb',
          borderRadius: '8px', overflow: 'hidden',
          display: 'flex'
        }}>
          <Column
            title="Assigned to Me"
            todos={myTodos}
            emptyText={showCompleted ? 'No completed todos' : 'No open todos'}
          />
          <div style={{ width: '1px', backgroundColor: '#e5e7eb', flexShrink: 0 }} />
          <Column
            title="Others"
            todos={otherTodos}
            emptyText={showCompleted ? 'No completed todos' : 'No open todos'}
          />
        </div>
      </div>

      {showModal && (
        <NewTodoModal
          users={users}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); fetchAll() }}
        />
      )}
    </>
  )
}