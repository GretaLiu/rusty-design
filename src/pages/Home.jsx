import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import NewMessageModal from '../components/NewMessageModal'
import NewTodoModal from '../components/NewTodoModal'
import NewFileModal from '../components/NewFileModal'

const styles = {
  wrap: { display: 'flex', gap: '24px', padding: '24px', alignItems: 'flex-start' },
  card: {
    flex: 1, backgroundColor: '#fff', border: '1px solid #e5e7eb',
    borderRadius: '8px', overflow: 'hidden', minWidth: 0
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', borderBottom: '1px solid #e5e7eb'
  },
  title: { fontSize: '14px', fontWeight: '600', color: '#111' },
  newBtn: {
    fontSize: '12px', color: '#fff', backgroundColor: '#111',
    border: 'none', borderRadius: '5px', padding: '4px 10px', cursor: 'pointer'
  },
  viewAll: {
    fontSize: '12px', color: '#6b7280', background: 'none',
    border: 'none', padding: 0, cursor: 'pointer'
  },
  row: {
    padding: '10px 16px', borderBottom: '1px solid #f3f4f6',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
    backgroundColor: '#fff', transition: 'background 0.1s'
  },
  empty: { padding: '24px 16px', fontSize: '13px', color: '#9ca3af', textAlign: 'center' }
}

const hoverOn = e => e.currentTarget.style.backgroundColor = '#f9fafb'
const hoverOff = e => e.currentTarget.style.backgroundColor = '#fff'

// ─── Message Board ────────────────────────────────────────────────────────────

function MessageBoard({ users }) {
  const [messages, setMessages] = useState([])
  const [showModal, setShowModal] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { fetchMessages() }, [])

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select(`
        id, title, archived, created_at,
        created_by_user:users!messages_created_by_fkey(display_name, avatar_url),
        replies:message_replies(id),
        todos(id, completed),
        mentions:message_replies(reply_mentions(read, user_id))
      `)
      .eq('archived', false)
      .order('created_at', { ascending: false })
    setMessages(data || [])
  }

  const hasUnread = (msg) =>
    msg.mentions?.some(r => r.reply_mentions?.some(m => !m.read && m.user_id === user?.id))

  const openTodos = (msg) =>
    msg.todos?.filter(t => !t.completed).length || 0

  return (
    <>
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.title}>Message Board</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button style={styles.newBtn} onClick={() => setShowModal(true)}>+ New</button>
            <button style={styles.viewAll} onClick={() => navigate('/home/messages')}>View all →</button>
          </div>
        </div>
        <div>
          {messages.length === 0 && <p style={styles.empty}>No active messages</p>}
          {messages.map(msg => (
            <div key={msg.id} style={styles.row}
              onClick={() => navigate(`/home/messages/${msg.id}`)}
              onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
              <img src={msg.created_by_user?.avatar_url} alt=""
                style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {hasUnread(msg) && (
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0 }} />
                  )}
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {msg.title}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '3px' }}>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                    {msg.replies?.length || 0} {msg.replies?.length === 1 ? 'reply' : 'replies'}
                  </span>
                  {openTodos(msg) > 0 && (
                    <span style={{ fontSize: '11px', color: '#f59e0b' }}>
                      {openTodos(msg)} open todo{openTodos(msg) > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <NewMessageModal
          users={users}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); fetchMessages() }}
        />
      )}
    </>
  )
}

// ─── Todo Panel ───────────────────────────────────────────────────────────────

function TodoPanel({ users }) {
  const [todos, setTodos] = useState([])
  const [showModal, setShowModal] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { fetchTodos() }, [user])

  const fetchTodos = async () => {
    if (!user) return
    const { data } = await supabase
      .from('todos')
      .select(`id, text, completed,
        assigned_user:users!todos_assigned_to_fkey(display_name, avatar_url)`)
      .eq('assigned_to', user.id)
      .eq('completed', false)
      .order('created_at', { ascending: false })
      .limit(8)
    setTodos(data || [])
  }

  const toggleComplete = async (e, todo) => {
    e.stopPropagation()
    await supabase.from('todos').update({
      completed: true, completed_by: user.id, completed_at: new Date().toISOString()
    }).eq('id', todo.id)
    await supabase.from('activity_log').insert({
      entity_type: 'todo', entity_id: todo.id,
      action: 'completed', performed_by: user.id
    })
    fetchTodos()
  }

  return (
    <>
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.title}>My Todos</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button style={styles.newBtn} onClick={() => setShowModal(true)}>+ New</button>
            <button style={styles.viewAll} onClick={() => navigate('/home/todos')}>View all →</button>
          </div>
        </div>
        <div>
          {todos.length === 0 && <p style={styles.empty}>No open todos</p>}
          {todos.map(todo => (
            <div key={todo.id} style={styles.row}
              onClick={() => navigate(`/home/todos/${todo.id}`)}
              onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
              <button onClick={e => toggleComplete(e, todo)} style={{
                width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                border: '2px solid #d1d5db', background: 'none', cursor: 'pointer', padding: 0
              }} />
              <span style={{ fontSize: '13px', color: '#111', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {todo.text}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <img src={todo.assigned_user?.avatar_url} alt=""
                  style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <NewTodoModal
          users={users}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); fetchTodos() }}
        />
      )}
    </>
  )
}

// ─── File Panel ───────────────────────────────────────────────────────────────

function FilePanel() {
  const [files, setFiles] = useState([])
  const [showModal, setShowModal] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { fetchFiles() }, [])

  const fetchFiles = async () => {
    const { data } = await supabase
      .from('files')
      .select(`id, filename, file_type, status, pinned, created_at,
        created_by_user:users!files_created_by_fkey(display_name, avatar_url)`)
      .is('message_id', null)
      .neq('status', 'void')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(8)
    setFiles(data || [])
  }

  const fileIcon = (type) => {
    const t = type?.toUpperCase()
    if (t === 'PDF') return '📄'
    if (['JPG','JPEG','PNG','WEBP'].includes(t)) return '🖼️'
    if (t === 'DOCX') return '📝'
    if (t === 'XLSX') return '📊'
    return '📁'
  }

  return (
    <>
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.title}>Files</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button style={styles.newBtn} onClick={() => setShowModal(true)}>+ Upload</button>
            <button style={styles.viewAll} onClick={() => navigate('/home/files')}>View all →</button>
          </div>
        </div>
        <div>
          {files.length === 0 && <p style={styles.empty}>No files</p>}
          {files.map(f => (
            <div key={f.id} style={styles.row}
              onClick={() => navigate(`/home/files/${f.id}`)}
              onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
              <span style={{ fontSize: '16px', flexShrink: 0 }}>{fileIcon(f.file_type)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {f.pinned && <span style={{ fontSize: '10px', color: '#f59e0b' }}>📌</span>}
                  <span style={{ fontSize: '13px', color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {f.filename}
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                  {f.status === 'complete' ? '✓ Complete · ' : ''}{f.file_type}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <NewFileModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); fetchFiles() }}
        />
      )}
    </>
  )
}

// ─── Home ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [users, setUsers] = useState([])

  useEffect(() => {
    supabase.from('users').select('id, display_name, avatar_url').then(({ data }) => setUsers(data || []))
  }, [])

  return (
    <div style={styles.wrap}>
      <MessageBoard users={users} />
      <TodoPanel users={users} />
      <FilePanel />
    </div>
  )
}