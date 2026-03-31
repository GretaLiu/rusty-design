import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Pencil, X, Check } from 'lucide-react'

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
    <div className="max-w-[600px] mx-auto px-6 py-6">

      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer p-0 mb-6 transition-colors"
      >
        ← Back
      </button>

      {/* Main card */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">

        {/* Todo text + complete toggle */}
        <div className="flex items-start gap-3 mb-5">
          <button
            onClick={toggleComplete}
            className={`w-5 h-5 rounded-full shrink-0 mt-0.5 border-2 flex items-center justify-center p-0 cursor-pointer transition-colors ${
              todo.completed
                ? 'border-emerald-500 bg-emerald-500'
                : 'border-gray-300 bg-transparent hover:border-emerald-400'
            }`}
          >
            {todo.completed && <span className="text-white text-[10px] leading-none">✓</span>}
          </button>

          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-2">
                <input
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleEdit()
                    if (e.key === 'Escape') { setEditing(false); setEditText(todo.text) }
                  }}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 box-border"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={handleEdit}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 bg-gray-900 text-white border-none rounded-md cursor-pointer hover:bg-gray-700 transition-colors"
                  >
                    <Check size={11} /> Save
                  </button>
                  <button
                    onClick={() => { setEditing(false); setEditText(todo.text) }}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 bg-white text-gray-600 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <X size={11} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <span className={`text-base font-medium leading-snug ${
                  todo.completed ? 'text-gray-400 line-through' : 'text-gray-900'
                }`}>
                  {todo.text}
                </span>
                <button
                  onClick={() => setEditing(true)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer transition-all rounded"
                  title="Edit"
                >
                  <Pencil size={13} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-5 text-xs text-gray-500 mb-4">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Assigned to</span>
            <img src={todo.assigned_user?.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
            <span className="font-medium text-gray-700">{todo.assigned_user?.display_name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Created by</span>
            <img src={todo.created_by_user?.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
            <span className="font-medium text-gray-700">{todo.created_by_user?.display_name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Created</span>
            <span className="text-gray-600">{formatDate(todo.created_at)}</span>
          </div>
        </div>

        {/* From message */}
        {todo.message && (
          <div className="pt-3 border-t border-gray-100 text-xs">
            <span className="text-gray-400">From ticket: </span>
            <button
              onClick={() => navigate(`/home/messages/${todo.message.id}`)}
              className="text-blue-500 hover:text-blue-700 bg-transparent border-none cursor-pointer p-0 transition-colors"
            >
              {todo.message.title}
            </button>
          </div>
        )}

        {/* Completed banner */}
        {todo.completed && (
          <div className={`${todo.message ? 'mt-2' : 'pt-3 border-t border-gray-100 mt-3'} flex items-center gap-1.5 text-xs text-emerald-600`}>
            <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
              <span className="text-white text-[9px]">✓</span>
            </span>
            Completed by <span className="font-medium">{todo.completed_by_user?.display_name}</span>
            <span className="text-gray-400">· {formatDate(todo.completed_at)}</span>
          </div>
        )}
      </div>

      {/* Edit history */}
      {todo.edits?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3 mt-0">
            Edit History
          </h3>
          <div className="space-y-3">
            {todo.edits.map(edit => (
              <div key={edit.id}>
                <div className="flex items-center gap-1.5 mb-1">
                  <img src={edit.edited_by_user?.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                  <span className="text-xs text-gray-500">
                    {edit.edited_by_user?.display_name}
                  </span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-400">{formatDate(edit.edited_at)}</span>
                </div>
                <div className="pl-5.5 flex items-center gap-2 text-xs">
                  <span className="text-gray-400 line-through">{edit.old_text}</span>
                  <span className="text-gray-300">→</span>
                  <span className="text-gray-700">{edit.new_text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity log */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3 mt-0">
          Activity
        </h3>
        {log.length === 0 && <p className="text-sm text-gray-400">No activity</p>}
        <div className="space-y-2">
          {log.map(entry => (
            <div key={entry.id} className="flex items-center gap-2">
              <img
                src={entry.performed_by_user?.avatar_url} alt=""
                className="w-5 h-5 rounded-full object-cover shrink-0"
              />
              <span className="flex-1 text-xs text-gray-600">
                <span className="font-medium text-gray-800">{entry.performed_by_user?.display_name}</span>
                {' '}{entry.action} this todo
              </span>
              <span className="text-xs text-gray-400 shrink-0 tabular-nums">
                {formatDate(entry.created_at)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Danger zone */}
      <div className="mt-12 border-t border-red-100 pt-6">
        <h3 className="text-xs font-semibold text-red-500 mb-1 mt-0">Danger Zone</h3>
        <p className="text-xs text-gray-400 mb-4">
          Permanently delete this todo. This cannot be undone.
        </p>
        {!showDelete ? (
          <button
            onClick={() => setShowDelete(true)}
            className="text-xs px-3.5 py-1.5 bg-white text-red-400 border border-red-200 rounded-md cursor-pointer hover:bg-red-50 transition-colors"
          >
            Delete this todo
          </button>
        ) : (
          <div className="border border-red-200 rounded-lg p-4 bg-red-50">
            <p className="text-xs text-gray-600 mb-2.5">
              Type <code className="font-mono bg-white px-1 py-0.5 rounded border border-red-100">{todo.text}</code> to confirm:
            </p>
            <input
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder={todo.text}
              className="w-full px-2.5 py-1.5 border border-red-200 rounded-md text-sm mb-2.5 bg-white focus:outline-none box-border"
            />
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting || deleteConfirmText !== todo.text}
                className={`text-xs px-3.5 py-1.5 bg-red-500 text-white border-none rounded-md cursor-pointer hover:bg-red-600 transition-colors ${
                  deleting || deleteConfirmText !== todo.text ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                {deleting ? 'Deleting…' : 'I understand, delete permanently'}
              </button>
              <button
                onClick={() => { setShowDelete(false); setDeleteConfirmText('') }}
                className="text-xs px-3.5 py-1.5 bg-white text-gray-600 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
