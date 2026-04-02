import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import NewMessageModal from '../components/NewMessageModal'
import NewTodoModal from '../components/NewTodoModal'
import NewFileModal from '../components/NewFileModal'
import FileIcon from '../components/FileIcon'
import { Pin, Folder } from 'lucide-react'

// ─── Shared card shell ────────────────────────────────────────────────────────

function Card({ title, actions, children }) {
  return (
    <div className="w-full min-w-0 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      <div className="flex-1 min-h-0 sm:min-h-[560px]">{children}</div>
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

// ─── Todo Complete Confirm Modal ──────────────────────────────────────────────

function CompleteConfirmModal({ todo, onConfirm, onCancel }) {
  const [note, setNote] = useState(todo.note || '')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl p-5 w-[400px] max-w-[95vw]">
        <h3 className="text-sm font-semibold text-gray-900 mb-1 mt-0">Mark as complete</h3>
        <p className="text-xs text-gray-600 font-medium mb-0.5 truncate">{todo.text}</p>
        <p className="text-xs text-gray-400 mb-3">Optionally add or update a note before completing.</p>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          autoFocus
          rows={3}
          placeholder="Add a note (optional)..."
          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 box-border resize-none mb-3"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="text-xs px-3 py-1.5 bg-white text-gray-600 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(note.trim() || null)}
            className="text-xs px-3 py-1.5 bg-emerald-600 text-white border-none rounded-md cursor-pointer hover:bg-emerald-700 transition-colors"
          >
            Complete
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Todo Dot ─────────────────────────────────────────────────────────────────

function TodoDot({ onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative w-5 h-5 shrink-0 flex items-center justify-center bg-transparent border-none cursor-pointer p-0"
    >
      {hovered ? (
        <svg className="w-4 h-4 text-emerald-500 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <circle cx="12" cy="12" r="10" className="fill-emerald-50 stroke-emerald-400" strokeWidth={1.5} />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 13l3.5 3.5L17 9" />
        </svg>
      ) : (
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400 opacity-90" />
        </span>
      )}
    </button>
  )
}

// ─── Todo Panel ───────────────────────────────────────────────────────────────

function TodoPanel({ users }) {
  const [todos, setTodos] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [confirmTodo, setConfirmTodo] = useState(null)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { fetchTodos() }, [user])

  const fetchTodos = async () => {
    if (!user) return
    const { data } = await supabase
      .from('todos')
      .select(`id, text, note, completed,
        assigned_user:users!todos_assigned_to_fkey(display_name, avatar_url)`)
      .eq('assigned_to', user.id)
      .eq('completed', false)
      .order('created_at', { ascending: false })
      .limit(8)
    setTodos(data || [])
  }

  const handleDotClick = (e, todo) => {
    e.stopPropagation()
    setConfirmTodo(todo)
  }

  const confirmComplete = async (note) => {
    const todo = confirmTodo
    setConfirmTodo(null)
    await supabase.from('todos').update({
      completed: true,
      completed_by: user.id,
      completed_at: new Date().toISOString(),
      note,
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
        title="Todos"
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
              <TodoDot onClick={e => handleDotClick(e, todo)} />
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

      {confirmTodo && (
        <CompleteConfirmModal
          todo={confirmTodo}
          onConfirm={confirmComplete}
          onCancel={() => setConfirmTodo(null)}
        />
      )}

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
  const [folders, setFolders] = useState([])
  const [showFileModal, setShowFileModal] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: filesData }, { data: foldersData }] = await Promise.all([
      supabase
        .from('files')
        .select(`id, filename, file_type, status, pinned, folder_id, created_at,
          created_by_user:users!files_created_by_fkey(display_name, avatar_url)`)
        .is('message_id', null)
        .eq('status', 'active')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('file_folders')
        .select('id, name, status, created_at')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
    ])
    setFiles(filesData || [])
    setFolders(foldersData || [])
  }

  const filesByFolder = useMemo(() => {
    const map = {}
    files.forEach(f => {
      if (f.folder_id) {
        if (!map[f.folder_id]) map[f.folder_id] = []
        map[f.folder_id].push(f)
      }
    })
    return map
  }, [files])

  const standaloneFiles = useMemo(() => files.filter(f => !f.folder_id), [files])
  const pinnedFiles = useMemo(() => standaloneFiles.filter(f => f.pinned), [standaloneFiles])
  const unpinnedFiles = useMemo(() => standaloneFiles.filter(f => !f.pinned), [standaloneFiles])

  const allFileIds = useMemo(() => standaloneFiles.map(f => f.id), [standaloneFiles])

  const isEmpty = files.length === 0 && folders.length === 0

  const FileCard = ({ f }) => (
    <div
      onClick={() => navigate(`/home/files/${f.id}`, { state: { fileIds: allFileIds } })}
      className="relative bg-white border border-gray-100 rounded-xl px-2 pt-3 pb-2 cursor-pointer text-center hover:border-gray-300 hover:shadow-sm transition-all"
    >
      {f.pinned && (
        <span className="absolute top-1.5 right-1.5 text-amber-400">
          <Pin size={9} strokeWidth={2} />
        </span>
      )}
      <div className="flex justify-center mb-2">
        <FileIcon type={f.file_type} size="sm" />
      </div>
      <div className="text-[10.5px] text-gray-700 font-medium leading-snug break-words line-clamp-2">
        {f.filename}
      </div>
    </div>
  )

  const FolderCard = ({ folder }) => {
    const folderFiles = filesByFolder[folder.id] || []
    return (
      <div
        onClick={() => navigate(`/home/files/folders/${folder.id}`)}
        className="relative bg-white border border-gray-100 rounded-xl px-2 pt-3 pb-2 cursor-pointer text-center hover:border-gray-300 hover:shadow-sm transition-all"
      >
        <div className="flex justify-center mb-2">
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
            <Folder size={18} className="text-blue-400" strokeWidth={1.5} />
          </div>
        </div>
        <div className="text-[10.5px] text-gray-700 font-medium leading-snug break-words line-clamp-2">
          {folder.name}
        </div>
        <div className="text-[9.5px] text-gray-400 mt-0.5">
          {folderFiles.length} {folderFiles.length === 1 ? 'file' : 'files'}
        </div>
      </div>
    )
  }

  return (
    <>
      <Card
        title="Files"
        actions={<>
          <CardNewBtn onClick={() => setShowFileModal(true)} label="+ Upload" />
          <CardViewAll onClick={() => navigate('/home/files')} />
        </>}
      >
        {isEmpty
          ? <EmptyState text="No files" />
          : (
            <div className="p-3 space-y-3">
              {pinnedFiles.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {pinnedFiles.map(f => <FileCard key={f.id} f={f} />)}
                </div>
              )}
              {pinnedFiles.length > 0 && (folders.length > 0 || unpinnedFiles.length > 0) && (
                <div className="border-t border-gray-100" />
              )}
              {(folders.length > 0 || unpinnedFiles.length > 0) && (
                <div className="grid grid-cols-3 gap-2">
                  {folders.map(folder => <FolderCard key={folder.id} folder={folder} />)}
                  {unpinnedFiles.map(f => <FileCard key={f.id} f={f} />)}
                </div>
              )}
            </div>
          )
        }
      </Card>

      {showFileModal && (
        <NewFileModal
          onClose={() => setShowFileModal(false)}
          onCreated={() => { setShowFileModal(false); fetchAll() }}
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
    <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 p-4 sm:p-6 items-start max-w-[1200px] mx-auto">
      <Tickets users={users} />
      <TodoPanel users={users} />
      <FilePanel />
    </div>
  )
}
