import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const ALLOWED_TYPES = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]

export default function NewMessageModal({ users, onClose, onCreated }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const textareaRef = useRef(null)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [mentioning, setMentioning] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [mentionPos, setMentionPos] = useState(0)
  const [pendingMentions, setPendingMentions] = useState([])
  const [todos, setTodos] = useState([])
  const [todoText, setTodoText] = useState('')
  const [todoAssignee, setTodoAssignee] = useState('')
  const [files, setFiles] = useState([])
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const dropRef = useRef(null)

  // ── @mention ───────────────────────────────────────────────────────────────

  const handleBodyChange = (e) => {
    const val = e.target.value
    setBody(val)
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
    const before = body.slice(0, mentionPos)
    const after = body.slice(textareaRef.current.selectionStart)
    setBody(`${before}@${u.display_name} ${after}`)
    setMentioning(false)
    setPendingMentions(prev => [...prev.filter(x => x.id !== u.id), u])
    textareaRef.current.focus()
  }

  const filteredUsers = users.filter(u =>
    u.display_name.toLowerCase().includes(mentionSearch.toLowerCase())
  )

  // ── Todos ──────────────────────────────────────────────────────────────────

  const addTodo = () => {
    if (!todoText.trim() || !todoAssignee) return
    const assignedUser = users.find(u => u.id === todoAssignee)
    setTodos(prev => [...prev, { text: todoText.trim(), assigned_to: todoAssignee, assignedUser }])
    setTodoText('')
    setTodoAssignee('')
  }

  const removeTodo = (i) => setTodos(prev => prev.filter((_, idx) => idx !== i))

  // ── Files ──────────────────────────────────────────────────────────────────

  const addValidFiles = useCallback((selected) => {
    const valid = selected.filter(f => ALLOWED_TYPES.includes(f.type))
    const invalid = selected.filter(f => !ALLOWED_TYPES.includes(f.type))
    if (invalid.length > 0) alert(`Skipped ${invalid.length} unsupported file(s). Only PDF, images, Word, Excel allowed.`)
    setFiles(prev => [...prev, ...valid.map(f => ({ file: f, filename: f.name }))])
  }, [])

  const handleFileSelect = (e) => {
    addValidFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = (e) => {
    if (!dropRef.current?.contains(e.relatedTarget)) setDragging(false)
  }
  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    addValidFiles(Array.from(e.dataTransfer.files))
  }
  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i))

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) return
    setSubmitting(true)

    const { data: msg } = await supabase
      .from('messages')
      .insert({ title: title.trim(), created_by: user.id })
      .select().single()
    if (!msg) { setSubmitting(false); return }

    const { data: reply } = await supabase
      .from('message_replies')
      .insert({ message_id: msg.id, body: body.trim(), created_by: user.id })
      .select().single()

    if (reply && pendingMentions.length > 0) {
      await supabase.from('reply_mentions').insert(
        pendingMentions.map(u => ({ reply_id: reply.id, user_id: u.id, read: false }))
      )
    }

    if (todos.length > 0) {
      const todoRows = todos.map(t => ({
        message_id: msg.id,
        text: t.text,
        assigned_to: t.assigned_to,
        created_by: user.id
      }))
      const { data: insertedTodos } = await supabase.from('todos').insert(todoRows).select()
      if (insertedTodos) {
        await supabase.from('activity_log').insert(
          insertedTodos.map(t => ({
            entity_type: 'todo', entity_id: t.id,
            action: 'created', performed_by: user.id
          }))
        )
      }
    }

    for (const { file, filename } of files) {
      const ext = filename.split('.').pop()
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      await supabase.storage.from('files').upload(path, file)
      const { data: { publicUrl } } = supabase.storage.from('files').getPublicUrl(path)
      const { data: fileRow } = await supabase.from('files').insert({
        message_id: msg.id, filename, file_url: publicUrl,
        file_type: ext.toUpperCase(), created_by: user.id
      }).select().single()
      if (fileRow) {
        await supabase.from('activity_log').insert({
          entity_type: 'file', entity_id: fileRow.id,
          action: 'uploaded', performed_by: user.id
        })
      }
    }

    await supabase.from('activity_log').insert({
      entity_type: 'message', entity_id: msg.id,
      action: 'created', performed_by: user.id
    })

    setSubmitting(false)
    onCreated()
    navigate(`/home/messages/${msg.id}`)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="w-[580px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">New Message</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Message title"
              className="w-full px-2.5 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5 relative">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              ref={textareaRef}
              value={body}
              onChange={handleBodyChange}
              placeholder="Write your message... (type @ to mention someone)"
              rows={4}
              className="w-full px-2.5 py-2 border border-gray-300 rounded-md text-sm resize-y leading-relaxed focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
            {mentioning && filteredUsers.length > 0 && (
              <div className="absolute top-full left-0 bg-white border border-gray-200 rounded-md shadow-md overflow-hidden z-10">
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
          </div>

          {/* Todos */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Todos{' '}
              <span className="text-xs text-gray-400 font-normal normal-case">optional</span>
            </label>
            {todos.map((t, i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-md border border-gray-100">
                <span className="flex-1 text-sm text-gray-900">{t.text}</span>
                <span className="text-xs text-gray-500">{t.assignedUser?.display_name}</span>
                <button
                  onClick={() => removeTodo(i)}
                  className="text-gray-400 hover:text-gray-600 text-sm leading-none cursor-pointer bg-transparent border-none"
                >✕</button>
              </div>
            ))}
            <div className="flex gap-1.5">
              <input
                value={todoText}
                onChange={e => setTodoText(e.target.value)}
                placeholder="Todo text"
                onKeyDown={e => e.key === 'Enter' && addTodo()}
                className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
              <select
                value={todoAssignee}
                onChange={e => setTodoAssignee(e.target.value)}
                className={`px-2.5 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 ${
                  todoText.trim() && !todoAssignee
                    ? 'border-orange-400 ring-2 ring-orange-200'
                    : 'border-gray-300'
                } ${todoAssignee ? 'text-gray-900' : 'text-gray-400'}`}
              >
                <option value="">Assign to…</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
              </select>
              <button
                onClick={addTodo}
                disabled={!todoText.trim() || !todoAssignee}
                className={`px-2.5 py-1.5 border border-gray-200 rounded-md text-sm leading-none shrink-0 transition-colors cursor-pointer ${
                  todoText.trim() && todoAssignee
                    ? 'bg-gray-900 text-white hover:bg-gray-800'
                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                }`}
              >✓</button>
            </div>
          </div>

          {/* Files */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Files{' '}
              <span className="text-xs text-gray-400 font-normal normal-case">optional</span>
            </label>
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-md border border-gray-100">
                <span className="flex-1 text-sm text-gray-900">{f.filename}</span>
                <span className="text-xs text-gray-400">{(f.file.size / 1024).toFixed(0)} KB</span>
                <button
                  onClick={() => removeFile(i)}
                  className="text-gray-400 hover:text-gray-600 text-sm leading-none cursor-pointer bg-transparent border-none"
                >✕</button>
              </div>
            ))}
            <label
              ref={dropRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-1.5 py-5 px-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                dragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke={dragging ? '#6366f1' : '#9ca3af'} strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className={`text-sm font-medium ${dragging ? 'text-indigo-600' : 'text-gray-700'}`}>
                Drag &amp; drop files here, or{' '}
                <span className="text-indigo-500 underline">click to browse</span>
              </span>
              <span className="text-xs text-gray-400">PDF, images, Word, Excel</span>
              <input type="file" multiple className="hidden" onChange={handleFileSelect}
                accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx" />
            </label>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="text-sm">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !title.trim() || !body.trim()}
              className="text-sm bg-gray-900 hover:bg-gray-800 text-white"
            >
              {submitting ? 'Posting...' : 'Post'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
