import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import NewTodoModal from '../components/NewTodoModal'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

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

export default function TodoList() {
  const [tab, setTab] = useState('active')
  const [myTodos, setMyTodos] = useState([])
  const [otherTodos, setOtherTodos] = useState([])
  const [log, setLog] = useState([])
  const [users, setUsers] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [completePrompt, setCompletePrompt] = useState(null) // { todo, note }
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

  const toggleComplete = (e, todo) => {
    e.stopPropagation()
    if (!todo.completed) {
      setCompletePrompt({ todo, note: todo.note || '' })
    } else {
      doToggleComplete(todo, false, null)
    }
  }

  const doToggleComplete = async (todo, newVal, note) => {
    const updates = {
      completed: newVal,
      completed_by: newVal ? user.id : null,
      completed_at: newVal ? new Date().toISOString() : null,
    }
    if (newVal && note !== null) updates.note = note
    await supabase.from('todos').update(updates).eq('id', todo.id)
    await supabase.from('activity_log').insert({
      entity_type: 'todo', entity_id: todo.id,
      action: newVal ? 'completed' : 'reopened', performed_by: user.id
    })
    setCompletePrompt(null)
    if (tab === 'active') fetchTodos(false)
    else fetchTodos(true)
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  })

  const actionLabel = (action) => ({
    created: 'created a todo',
    completed: 'completed a todo',
    reopened: 'reopened a todo',
    edited: 'edited a todo',
    deleted: 'deleted a todo',
  }[action] || action)

  const TodoRow = ({ todo }) => (
    <div
      onClick={() => navigate(`/home/todos/${todo.id}`)}
      className="flex items-center gap-3 px-3.5 py-2.5 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors last:border-b-0"
    >
      {todo.completed ? (
        <button
          onClick={e => toggleComplete(e, todo)}
          className="w-4 h-4 rounded-full shrink-0 border-2 border-emerald-500 bg-emerald-500 flex items-center justify-center p-0 cursor-pointer"
        >
          <span className="text-white text-[9px] leading-none">✓</span>
        </button>
      ) : (
        <TodoDot onClick={e => toggleComplete(e, todo)} />
      )}
      <div className="flex-1 min-w-0">
        <span className={`text-sm block truncate ${todo.completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
          {todo.text}
        </span>
        {todo.message?.title && (
          <span className="text-xs text-gray-400">↳ {todo.message.title}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <img
          src={todo.assigned_user?.avatar_url} alt=""
          className="w-5 h-5 rounded-full object-cover"
        />
        <span className="hidden sm:inline text-xs text-gray-400">{todo.assigned_user?.display_name}</span>
      </div>
    </div>
  )

  const Column = ({ title, todos: colTodos }) => (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-gray-100">
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{title}</span>
        <span className="text-xs text-gray-400 tabular-nums">{colTodos.length}</span>
      </div>
      {colTodos.length === 0
        ? <p className="py-8 text-center text-sm text-gray-400">
            {tab === 'active' ? 'No open todos' : 'No completed todos'}
          </p>
        : colTodos.map(t => <TodoRow key={t.id} todo={t} />)
      }
    </div>
  )

  const TwoColumnLayout = () => (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col sm:flex-row">
      <Column title="Assigned to Me" todos={myTodos} />
      <div className="h-px sm:h-auto sm:w-px bg-gray-100 shrink-0" />
      <Column title="Others" todos={otherTodos} />
    </div>
  )

  return (
    <>
      <div className="px-4 sm:px-6 py-4 sm:py-6 max-w-[1000px] mx-auto">
        <div className="relative flex items-center justify-center mb-5">
          <button
            onClick={() => navigate('/home')}
            className="absolute left-0 text-sm text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer p-0 transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-sm font-semibold text-gray-900 m-0">Todos</h1>
          <button
            onClick={() => setShowModal(true)}
            className="absolute right-0 text-xs px-3 py-1.5 bg-gray-900 text-white border-none rounded-md cursor-pointer hover:bg-gray-700 transition-colors"
          >
            + New Todo
          </button>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="active" className="flex-1">Active</TabsTrigger>
            <TabsTrigger value="completed" className="flex-1">Completed</TabsTrigger>
            <TabsTrigger value="log" className="flex-1">Log</TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <TwoColumnLayout />
          </TabsContent>

          <TabsContent value="completed">
            <TwoColumnLayout />
          </TabsContent>

          <TabsContent value="log">
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {log.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-400">No activity yet</p>
              )}
              {log.map(entry => (
                <div
                  key={entry.id}
                  className="flex items-start sm:items-center gap-2.5 px-4 py-2.5 border-b border-gray-50 last:border-b-0"
                >
                  <img
                    src={entry.performed_by_user?.avatar_url} alt=""
                    className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5 sm:mt-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-600">
                      <span className="font-medium text-gray-900">{entry.performed_by_user?.display_name}</span>
                      {' '}{actionLabel(entry.action)}
                    </span>
                    <span className="block sm:hidden text-xs text-gray-400 tabular-nums mt-0.5">
                      {formatDate(entry.created_at)}
                    </span>
                  </div>
                  <button
                    onClick={() => navigate(`/home/todos/${entry.entity_id}`)}
                    className="text-xs text-blue-500 hover:text-blue-700 bg-transparent border-none cursor-pointer p-0 shrink-0 transition-colors"
                  >
                    view →
                  </button>
                  <span className="hidden sm:inline text-xs text-gray-400 shrink-0 tabular-nums">
                    {formatDate(entry.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
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

      {completePrompt && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-5 w-[400px] max-w-[95vw]">
            <h3 className="text-sm font-semibold text-gray-900 mb-1 mt-0">Mark as complete</h3>
            <p className="text-xs text-gray-400 mb-1">
              <span className="text-gray-600 font-medium">{completePrompt.todo.text}</span>
            </p>
            <p className="text-xs text-gray-400 mb-3">Optionally add or update a note before completing.</p>
            <textarea
              value={completePrompt.note}
              onChange={e => setCompletePrompt(p => ({ ...p, note: e.target.value }))}
              autoFocus
              rows={3}
              placeholder="Add a note (optional)..."
              className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 box-border resize-none mb-3"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCompletePrompt(null)}
                className="text-xs px-3 py-1.5 bg-white text-gray-600 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => doToggleComplete(completePrompt.todo, true, completePrompt.note.trim() || null)}
                className="text-xs px-3 py-1.5 bg-emerald-600 text-white border-none rounded-md cursor-pointer hover:bg-emerald-700 transition-colors"
              >
                Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
