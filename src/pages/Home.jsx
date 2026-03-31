import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import NewMessageModal from '../components/NewMessageModal'
import NewTodoModal from '../components/NewTodoModal'
import NewFileModal from '../components/NewFileModal'
import FileIcon from '../components/FileIcon'

// ─── Shared card shell ────────────────────────────────────────────────────────

function Card({ title, actions, children }) {
  return (
    <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function CardNewBtn({ onClick, label = '+ New' }) {
  return (
    <button
      onClick={onClick}
      className="text-xs text-white bg-gray-900 hover:bg-gray-700 rounded-md px-2.5 py-1 cursor-pointer border-none transition-colors"
    >
      {label}
    </button>
  )
}

function CardViewAll({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-xs text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer transition-colors p-0"
    >
      View all →
    </button>
  )
}

function EmptyState({ text }) {
  return (
    <p className="py-8 text-center text-sm text-gray-400">{text}</p>
  )
}

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
      <Card
        title="Tickets"
        actions={<>
          <CardNewBtn onClick={() => setShowModal(true)} />
          <CardViewAll onClick={() => navigate('/home/messages')} />
        </>}
      >
        {messages.length === 0
          ? <EmptyState text="No active messages" />
          : messages.map(msg => (
            <div
              key={msg.id}
              onClick={() => navigate(`/home/messages/${msg.id}`)}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors last:border-b-0"
            >
              <img
                src={msg.created_by_user?.avatar_url} alt=""
                className="w-7 h-7 rounded-full object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {hasUnread(msg) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  )}
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {msg.title}
                  </span>
                </div>
                <div className="flex gap-2.5 mt-0.5">
                  <span className="text-xs text-gray-400">
                    {msg.replies?.length || 0} {msg.replies?.length === 1 ? 'reply' : 'replies'}
                  </span>
                  {openTodos(msg) > 0 && (
                    <span className="text-xs text-amber-500">
                      {openTodos(msg)} open todo{openTodos(msg) > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        }
      </Card>

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
      <Card
        title="My Todos"
        actions={<>
          <CardNewBtn onClick={() => setShowModal(true)} />
          <CardViewAll onClick={() => navigate('/home/todos')} />
        </>}
      >
        {todos.length === 0
          ? <EmptyState text="No open todos" />
          : todos.map(todo => (
            <div
              key={todo.id}
              onClick={() => navigate(`/home/todos/${todo.id}`)}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors last:border-b-0"
            >
              <button
                onClick={e => toggleComplete(e, todo)}
                className="w-4 h-4 rounded-full shrink-0 border-2 border-gray-300 hover:border-emerald-400 bg-transparent cursor-pointer p-0 transition-colors"
              />
              <span className="flex-1 min-w-0 text-sm text-gray-800 truncate">
                {todo.text}
              </span>
              <img
                src={todo.assigned_user?.avatar_url} alt=""
                className="w-5 h-5 rounded-full object-cover shrink-0"
              />
            </div>
          ))
        }
      </Card>

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
      .limit(12)
    setFiles(data || [])
  }

  return (
    <>
      <Card
        title="Files"
        actions={<>
          <CardNewBtn onClick={() => setShowModal(true)} label="+ Upload" />
          <CardViewAll onClick={() => navigate('/home/files')} />
        </>}
      >
        {files.length === 0
          ? <EmptyState text="No files" />
          : (
            <div className="grid grid-cols-4 gap-2 p-3">
              {files.map(f => (
                  <div
                    key={f.id}
                    onClick={() => navigate(`/home/files/${f.id}`)}
                    className="relative bg-white border border-gray-100 rounded-xl px-2 pt-3 pb-2 cursor-pointer text-center hover:border-gray-300 hover:shadow-sm transition-all"
                  >
                    {f.pinned && (
                      <span className="absolute top-1.5 right-1.5 text-amber-400 opacity-70">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                      </span>
                    )}
                    <div className="flex justify-center mb-2">
                      <FileIcon type={f.file_type} size="sm" />
                    </div>
                    <div className="text-[10.5px] text-gray-700 font-medium leading-snug break-words line-clamp-2">
                      {f.filename}
                    </div>
                    {f.status === 'complete' && (
                      <div className="text-[9px] text-emerald-600 mt-0.5 font-medium">✓ complete</div>
                    )}
                  </div>
              ))}
            </div>
          )
        }
      </Card>

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
    <div className="flex gap-5 p-6 items-start max-w-[1200px] mx-auto">
      <Tickets users={users} />
      <TodoPanel users={users} />
      <FilePanel />
    </div>
  )
}
