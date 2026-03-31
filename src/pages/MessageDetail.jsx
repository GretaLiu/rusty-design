import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import FileIcon from '../components/FileIcon'

export default function MessageDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [message, setMessage] = useState(null)
  const [replies, setReplies] = useState([])
  const [todos, setTodos] = useState([])
  const [files, setFiles] = useState([])
  const [users, setUsers] = useState([])
  const [replyBody, setReplyBody] = useState('')
  const [mentioning, setMentioning] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [mentionPos, setMentionPos] = useState(0)
  const [pendingMentions, setPendingMentions] = useState([])
  const [showTodoForm, setShowTodoForm] = useState(false)
  const [todoText, setTodoText] = useState('')
  const [todoAssignee, setTodoAssignee] = useState('')
  const [uploading, setUploading] = useState(false)
  const [archiveConfirm, setArchiveConfirm] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => { fetchAll(); fetchUsers() }, [id])

  const fetchAll = async () => {
    const { data: msg } = await supabase
      .from('messages')
      .select(`id, title, archived, created_at,
        created_by_user:users!messages_created_by_fkey(display_name, avatar_url)`)
      .eq('id', id).single()
    setMessage(msg)

    const { data: r } = await supabase
      .from('message_replies')
      .select(`id, body, created_at,
        created_by_user:users!message_replies_created_by_fkey(display_name, avatar_url),
        reply_mentions(id, read, user_id,
          mentioned_user:users!reply_mentions_user_id_fkey(display_name))`)
      .eq('message_id', id)
      .order('created_at', { ascending: true })
    setReplies(r || [])

    const { data: t } = await supabase
      .from('todos')
      .select(`id, text, completed, completed_at, created_at,
        assigned_user:users!todos_assigned_to_fkey(display_name, avatar_url),
        created_by_user:users!todos_created_by_fkey(display_name),
        completed_by_user:users!todos_completed_by_fkey(display_name)`)
      .eq('message_id', id)
      .order('created_at', { ascending: true })
    setTodos(t || [])

    const { data: f } = await supabase
      .from('files')
      .select(`id, filename, file_type, file_url, status, pinned, created_at,
        created_by_user:users!files_created_by_fkey(display_name, avatar_url)`)
      .eq('message_id', id)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
    setFiles(f || [])

    await supabase
      .from('reply_mentions')
      .update({ read: true })
      .eq('user_id', user.id)
      .in('reply_id', (r || []).map(x => x.id))
  }

  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('id, display_name, avatar_url')
    setUsers(data || [])
  }

  // ── @mention ───────────────────────────────────────────────────────────────

  const handleReplyChange = (e) => {
    const val = e.target.value
    setReplyBody(val)
    const cursor = e.target.selectionStart
    const before = val.slice(0, cursor)
    const match = before.match(/@(\w*)$/)
    if (match) {
      setMentioning(true)
      setMentionSearch(match[1])
      setMentionPos(cursor - match[0].length)
    } else {
      setMentioning(false)
      setMentionSearch('')
    }
  }

  const insertMention = (u) => {
    const before = replyBody.slice(0, mentionPos)
    const after = replyBody.slice(textareaRef.current.selectionStart)
    setReplyBody(`${before}@${u.display_name} ${after}`)
    setMentioning(false)
    setPendingMentions(prev => [...prev.filter(x => x.id !== u.id), u])
    textareaRef.current.focus()
  }

  const filteredUsers = users.filter(u =>
    u.display_name.toLowerCase().includes(mentionSearch.toLowerCase())
  )

  // ── Reply ──────────────────────────────────────────────────────────────────

  const handlePostReply = async () => {
    if (!replyBody.trim()) return
    const { data: reply } = await supabase
      .from('message_replies')
      .insert({ message_id: id, body: replyBody.trim(), created_by: user.id })
      .select().single()
    if (reply && pendingMentions.length > 0) {
      await supabase.from('reply_mentions').insert(
        pendingMentions.map(u => ({ reply_id: reply.id, user_id: u.id, read: false }))
      )
    }
    await supabase.from('activity_log').insert({
      entity_type: 'message', entity_id: id,
      action: 'replied', performed_by: user.id
    })
    setReplyBody('')
    setPendingMentions([])
    fetchAll()
  }

  // ── Todo ───────────────────────────────────────────────────────────────────

  const handleAddTodo = async () => {
    if (!todoText.trim() || !todoAssignee) return
    const { data: t } = await supabase
      .from('todos')
      .insert({ message_id: id, text: todoText.trim(), assigned_to: todoAssignee, created_by: user.id })
      .select().single()
    if (t) {
      await supabase.from('activity_log').insert({
        entity_type: 'todo', entity_id: t.id,
        action: 'created', performed_by: user.id
      })
    }
    setTodoText(''); setTodoAssignee(''); setShowTodoForm(false)
    fetchAll()
  }

  const toggleTodo = async (todo) => {
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

  // ── File ───────────────────────────────────────────────────────────────────

  const handleUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files)
    if (selectedFiles.length === 0) return
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    const valid = selectedFiles.filter(f => allowed.includes(f.type))
    const invalid = selectedFiles.filter(f => !allowed.includes(f.type))
    if (invalid.length > 0) alert(`Skipped ${invalid.length} unsupported file(s).`)
    if (valid.length === 0) return
    setUploading(true)
    for (const file of valid) {
      const ext = file.name.split('.').pop()
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage.from('files').upload(path, file)
      if (uploadError) continue
      const { data: { publicUrl } } = supabase.storage.from('files').getPublicUrl(path)
      const { data: fileRow } = await supabase.from('files')
        .insert({ message_id: id, filename: file.name, file_url: publicUrl, file_type: ext.toUpperCase(), created_by: user.id })
        .select().single()
      if (fileRow) {
        await supabase.from('activity_log').insert({
          entity_type: 'file', entity_id: fileRow.id,
          action: 'uploaded', performed_by: user.id
        })
      }
    }
    setUploading(false)
    fetchAll()
    e.target.value = ''
  }

  const updateFileStatus = async (file, status) => {
    await supabase.from('files').update({ status }).eq('id', file.id)
    await supabase.from('activity_log').insert({
      entity_type: 'file', entity_id: file.id,
      action: status, performed_by: user.id
    })
    fetchAll()
  }

  const togglePin = async (file) => {
    await supabase.from('files').update({ pinned: !file.pinned }).eq('id', file.id)
    await supabase.from('activity_log').insert({
      entity_type: 'file', entity_id: file.id,
      action: file.pinned ? 'unpinned' : 'pinned', performed_by: user.id
    })
    fetchAll()
  }

  // ── Archive ────────────────────────────────────────────────────────────────

  const canArchive = todos.every(t => t.completed) && files.every(f => f.status !== 'active')

  const handleArchive = async () => {
    await supabase.from('messages').update({ archived: true }).eq('id', id)
    await supabase.from('activity_log').insert({
      entity_type: 'message', entity_id: id,
      action: 'archived', performed_by: user.id
    })
    fetchAll()
    setArchiveConfirm(false)
  }

  const handleUnarchive = async () => {
    await supabase.from('messages').update({ archived: false }).eq('id', id)
    await supabase.from('activity_log').insert({
      entity_type: 'message', entity_id: id,
      action: 'unarchived', performed_by: user.id
    })
    fetchAll()
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    setDeleting(true)
    await supabase.from('messages').delete().eq('id', id)
    navigate('/home')
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })

  const formatTime = (d) => new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric'
  }) + ' ' + new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  if (!message) return null

  const openCount = todos.filter(t => !t.completed).length
  const activeFiles = files.filter(f => f.status === 'active').length

  return (
    <div className="max-w-[720px] mx-auto px-6 py-6">

      {/* ── Header bar ── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer p-0 transition-colors"
        >
          ← Back
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {message.archived ? (
            <button
              onClick={handleUnarchive}
              className="text-xs px-3 py-1.5 bg-white text-gray-600 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
            >
              Reactivate
            </button>
          ) : archiveConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Archive this ticket?</span>
              <button
                onClick={handleArchive}
                className="text-xs px-3 py-1.5 bg-gray-900 text-white border-none rounded-md cursor-pointer hover:bg-gray-700 transition-colors"
              >
                Yes, archive
              </button>
              <button
                onClick={() => setArchiveConfirm(false)}
                className="text-xs px-3 py-1.5 bg-white text-gray-600 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => canArchive && setArchiveConfirm(true)}
              title={!canArchive ? 'All todos must be complete and no active files before archiving' : ''}
              className={`text-xs px-3 py-1.5 bg-white border rounded-md transition-colors ${
                canArchive
                  ? 'text-gray-600 border-gray-300 cursor-pointer hover:bg-gray-50'
                  : 'text-gray-300 border-gray-200 cursor-not-allowed'
              }`}
            >
              Archive
            </button>
          )}
        </div>
      </div>

      {/* ── Title block ── */}
      <div className="mb-5 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-1 mb-0.5 flex-wrap">
          <p className="text-xl font-semibold text-gray-800 m-0">{message.title}</p>
          {message.archived && (
            <span className="text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">
              Archived
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400 flex-wrap">
          <span>{formatDate(message.created_at)}</span>
          {openCount > 0 && (
            <>
              <span>·</span>
              <span className="text-amber-500">{openCount} open todo{openCount > 1 ? 's' : ''}</span>
            </>
          )}
          {activeFiles > 0 && (
            <>
              <span>·</span>
              <span className="text-blue-500">{activeFiles} active file{activeFiles > 1 ? 's' : ''}</span>
            </>
          )}
        </div>
      </div>

      {/* ── Replies ── */}
      <section className="mb-8">
        <div className="flex flex-col gap-4 mb-4">
          {replies.map(reply => (
            <div key={reply.id} className="flex gap-3">
              <img
                src={reply.created_by_user?.avatar_url} alt=""
                className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="text-sm font-semibold text-gray-900">
                    {reply.created_by_user?.display_name}
                  </span>
                  <span className="text-xs text-gray-400">{formatTime(reply.created_at)}</span>
                </div>
                <div className="text-sm text-gray-700 leading-relaxed bg-gray-50 px-3 py-2.5 rounded-lg text-left">
                  {reply.body.split(/(@[\w\s]+?)(?=\s|$|@)/).map((part, i) => {
                    const mentioned = reply.reply_mentions?.some(m =>
                      part.trim() === `@${m.mentioned_user?.display_name}`
                    )
                    return mentioned
                      ? <span key={i} className="text-blue-600 font-medium">{part}</span>
                      : <span key={i}>{part}</span>
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Reply composer */}
        {!message.archived && (
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={replyBody}
              onChange={handleReplyChange}
              placeholder="Reply… (type @ to mention someone)"
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-y leading-relaxed focus:outline-none focus:ring-2 focus:ring-gray-200 box-border"
            />
            {mentioning && filteredUsers.length > 0 && (
              <div className="absolute bottom-full left-0 bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden z-10">
                {filteredUsers.map(u => (
                  <div
                    key={u.id}
                    onMouseDown={() => insertMention(u)}
                    className="flex items-center gap-2 px-3.5 py-2 text-sm cursor-pointer hover:bg-gray-50"
                  >
                    <img src={u.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                    {u.display_name}
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={handlePostReply}
              disabled={!replyBody.trim()}
              className={`mt-2 px-4 py-1.5 text-sm bg-gray-900 text-white border-none rounded-md transition-opacity cursor-pointer hover:bg-gray-700 ${
                !replyBody.trim() ? 'opacity-40 cursor-not-allowed' : ''
              }`}
            >
              Post Reply
            </button>
          </div>
        )}
      </section>

      {/* ── Todos ── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 m-0">
            Todos
            {todos.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                {todos.filter(t => t.completed).length}/{todos.length} done
              </span>
            )}
          </h2>
          {!message.archived && (
            <button
              onClick={() => setShowTodoForm(v => !v)}
              className="text-xs px-2.5 py-1 bg-gray-900 text-white border-none rounded-md cursor-pointer hover:bg-gray-700 transition-colors"
            >
              {showTodoForm ? 'Cancel' : '+ Add'}
            </button>
          )}
        </div>

        {showTodoForm && (
          <div className="p-3 border border-gray-200 rounded-lg mb-3 bg-gray-50 space-y-2">
            <input
              placeholder="Todo text"
              value={todoText}
              onChange={e => setTodoText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTodo()}
              className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 box-border"
            />
            <select
              value={todoAssignee}
              onChange={e => setTodoAssignee(e.target.value)}
              className={`w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 box-border ${todoAssignee ? 'text-gray-900' : 'text-gray-400'}`}
            >
              <option value="">Assign to...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
            </select>
            <button
              onClick={handleAddTodo}
              disabled={!todoText.trim() || !todoAssignee}
              className={`px-3 py-1.5 text-sm bg-gray-900 text-white border-none rounded-md cursor-pointer transition-opacity hover:bg-gray-700 ${
                !todoText.trim() || !todoAssignee ? 'opacity-40 cursor-not-allowed' : ''
              }`}
            >
              Add Todo
            </button>
          </div>
        )}

        {todos.length === 0 && (
          <p className="text-sm text-gray-400">No todos</p>
        )}
        <div className="space-y-1">
          {todos.map(todo => (
            <div
              key={todo.id}
              onClick={() => navigate(`/home/todos/${todo.id}`)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer border border-gray-100 bg-white hover:bg-gray-50 transition-colors"
            >
              <button
                onClick={e => { e.stopPropagation(); toggleTodo(todo) }}
                className={`w-4 h-4 rounded-full shrink-0 border-2 flex items-center justify-center p-0 cursor-pointer transition-colors ${
                  todo.completed
                    ? 'border-emerald-500 bg-emerald-500'
                    : 'border-gray-300 bg-transparent hover:border-emerald-400'
                }`}
              >
                {todo.completed && <span className="text-white text-[9px]">✓</span>}
              </button>
              <span className={`flex-1 text-sm ${todo.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                {todo.text}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <img
                  src={todo.assigned_user?.avatar_url} alt=""
                  className="w-5 h-5 rounded-full object-cover"
                />
                <span className="text-xs text-gray-400">{todo.assigned_user?.display_name}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Files ── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 m-0">Files</h2>
          {!message.archived && (
            <label className={`text-xs px-2.5 py-1 bg-gray-900 text-white rounded-md transition-opacity ${uploading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-700'}`}>
              {uploading ? 'Uploading…' : '+ Upload'}
              <input
                type="file" multiple className="hidden"
                onChange={handleUpload} disabled={uploading}
                accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx"
              />
            </label>
          )}
        </div>

        {files.length === 0 && <p className="text-sm text-gray-400">No files</p>}
        <div className="space-y-1">
          {files.map(f => (
            <div
              key={f.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100 bg-white ${f.status === 'void' ? 'opacity-40' : ''}`}
            >
              <FileIcon type={f.file_type} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {f.pinned && <span className="text-[10px]">📌</span>}
                  {f.status === 'void'
                    ? <span className="text-sm text-gray-400 line-through">{f.filename}</span>
                    : (
                      <a
                        href={f.file_url} target="_blank" rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-sm text-blue-600 hover:underline no-underline"
                      >
                        {f.filename}
                      </a>
                    )
                  }
                  {f.status === 'complete' && (
                    <span className="text-[10px] text-emerald-600 font-medium">✓</span>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {f.created_by_user?.display_name} · {formatDate(f.created_at)}
                </span>
              </div>
              {!message.archived && f.status !== 'void' && (
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => togglePin(f)}
                    className="text-xs px-2 py-1 border border-gray-200 rounded cursor-pointer bg-white text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    {f.pinned ? 'Unpin' : 'Pin'}
                  </button>
                  {f.status === 'active' && (
                    <button
                      onClick={() => updateFileStatus(f, 'complete')}
                      className="text-xs px-2 py-1 border border-gray-200 rounded cursor-pointer bg-white text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      Complete
                    </button>
                  )}
                  <button
                    onClick={() => updateFileStatus(f, 'void')}
                    className="text-xs px-2 py-1 border border-red-200 rounded cursor-pointer bg-white text-red-400 hover:bg-red-50 transition-colors"
                  >
                    Void
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Danger zone ── */}
      <div className="mt-12 border-t border-red-100 pt-6">
        <h3 className="text-xs font-semibold text-red-500 mb-1 mt-0">Danger Zone</h3>
        <p className="text-xs text-gray-400 mb-4">
          Permanently delete this ticket and all its replies, todos, and files. This cannot be undone.
        </p>
        {!showDelete ? (
          <button
            onClick={() => setShowDelete(true)}
            className="text-xs px-3.5 py-1.5 bg-white text-red-400 border border-red-200 rounded-md cursor-pointer hover:bg-red-50 transition-colors"
          >
            Delete this ticket
          </button>
        ) : (
          <div className="border border-red-200 rounded-lg p-4 bg-red-50">
            <p className="text-xs text-gray-600 mb-2.5">
              Type <code className="font-mono bg-white px-1 py-0.5 rounded border border-red-100">{message.title}</code> to confirm:
            </p>
            <input
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder={message.title}
              className="w-full px-2.5 py-1.5 border border-red-200 rounded-md text-sm mb-2.5 bg-white focus:outline-none box-border"
            />
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting || deleteConfirmText !== message.title}
                className={`text-xs px-3.5 py-1.5 bg-red-500 text-white border-none rounded-md cursor-pointer hover:bg-red-600 transition-colors ${
                  deleting || deleteConfirmText !== message.title ? 'opacity-40 cursor-not-allowed' : ''
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
