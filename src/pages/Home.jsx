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

// ─── Tickets ──────────────────────────────────────────────────────────────────

function Tickets({ users }) {
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
          <span style={styles.title}>Tickets</span>
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

const FILE_TYPE_META = {
  PDF:  { icon: '📄', bg: '#fef2f2' },
  JPG:  { icon: '🖼️', bg: '#f5f3ff' },
  JPEG: { icon: '🖼️', bg: '#f5f3ff' },
  PNG:  { icon: '🖼️', bg: '#f5f3ff' },
  WEBP: { icon: '🖼️', bg: '#f5f3ff' },
  DOCX: { icon: '📝', bg: '#eff6ff' },
  XLSX: { icon: '📊', bg: '#f0fdf4' },
}
const fileMeta = (type) => FILE_TYPE_META[type?.toUpperCase()] || { icon: '📁', bg: '#f9fafb' }

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
      .limit(12)
    setFiles(data || [])
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

        {files.length === 0 && <p style={styles.empty}>No files</p>}

        {files.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            padding: '12px',
          }}>
            {files.map(f => {
              const meta = fileMeta(f.file_type)
              return (
                <div key={f.id}
                  onClick={() => navigate(`/home/files/${f.id}`)}
                  style={{
                    position: 'relative',
                    backgroundColor: '#fafafa', border: '1px solid #f0f0f0',
                    borderRadius: '8px', padding: '10px 8px 8px',
                    cursor: 'pointer', textAlign: 'center',
                    transition: 'box-shadow 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'
                    e.currentTarget.style.borderColor = '#d1d5db'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = 'none'
                    e.currentTarget.style.borderColor = '#f0f0f0'
                  }}
                >
                  {f.pinned && (
                    <span style={{
                      position: 'absolute', top: '4px', right: '5px',
                      fontSize: '9px', opacity: 0.6
                    }}>📌</span>
                  )}
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '8px',
                    backgroundColor: meta.bg, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', margin: '0 auto 6px', fontSize: '18px',
                  }}>
                    {meta.icon}
                  </div>
                  <div style={{
                    fontSize: '10.5px', color: '#374151', fontWeight: '500',
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    lineHeight: '1.35', wordBreak: 'break-word',
                  }}>{f.filename}</div>
                  {f.status === 'complete' && (
                    <div style={{ fontSize: '9px', color: '#16a34a', marginTop: '3px' }}>✓</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
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
      <Tickets users={users} />
      <TodoPanel users={users} />
      <FilePanel />
    </div>
  )
}