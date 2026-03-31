import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

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
  const [files, setFiles] = useState([]) // { file, filename }
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

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragging(true)
  }

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

    // 1. create message
    const { data: msg } = await supabase
      .from('messages')
      .insert({ title: title.trim(), created_by: user.id })
      .select().single()

    if (!msg) { setSubmitting(false); return }

    // 2. create first reply
    const { data: reply } = await supabase
      .from('message_replies')
      .insert({ message_id: msg.id, body: body.trim(), created_by: user.id })
      .select().single()

    // 3. mentions
    if (reply && pendingMentions.length > 0) {
      await supabase.from('reply_mentions').insert(
        pendingMentions.map(u => ({ reply_id: reply.id, user_id: u.id, read: false }))
      )
    }

    // 4. todos
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

    // 5. files
    for (const { file, filename } of files) {
      const ext = filename.split('.').pop()
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      await supabase.storage.from('files').upload(path, file)
      const { data: { publicUrl } } = supabase.storage.from('files').getPublicUrl(path)
      const { data: fileRow } = await supabase.from('files').insert({
        message_id: msg.id,
        filename,
        file_url: publicUrl,
        file_type: ext.toUpperCase(),
        created_by: user.id
      }).select().single()
      if (fileRow) {
        await supabase.from('activity_log').insert({
          entity_type: 'file', entity_id: fileRow.id,
          action: 'uploaded', performed_by: user.id
        })
      }
    }

    // 6. message activity log
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
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
    }} onClick={onClose}>
      <div style={{
        backgroundColor: '#fff', borderRadius: '10px', width: '580px', maxWidth: '95vw',
        maxHeight: '90vh', overflow: 'auto', padding: '24px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
      }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>New Message</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af' }}>✕</button>
        </div>

        {/* Title */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>
            TITLE <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Message title"
            style={{
              width: '100%', padding: '8px 10px', border: '1px solid #d1d5db',
              borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box'
            }} />
        </div>

        {/* Body */}
        <div style={{ marginBottom: '20px', position: 'relative' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>
            MESSAGE <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <textarea
            ref={textareaRef}
            value={body} onChange={handleBodyChange}
            placeholder="Write your message... (type @ to mention someone)"
            rows={4}
            style={{
              width: '100%', padding: '8px 10px', border: '1px solid #d1d5db',
              borderRadius: '6px', fontSize: '13px', resize: 'vertical',
              boxSizing: 'border-box', lineHeight: '1.5'
            }} />
          {mentioning && filteredUsers.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0,
              backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)', overflow: 'hidden', zIndex: 10
            }}>
              {filteredUsers.map(u => (
                <div key={u.id} onMouseDown={() => insertMention(u)}
                  style={{ padding: '8px 14px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}>
                  <img src={u.avatar_url} alt="" style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
                  {u.display_name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Todos */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
            TODOS <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '400' }}>optional</span>
          </label>
          {todos.map((t, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px',
              padding: '7px 10px', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #f3f4f6'
            }}>
              <span style={{ flex: 1, fontSize: '13px', color: '#111' }}>{t.text}</span>
              <span style={{ fontSize: '11px', color: '#6b7280' }}>{t.assignedUser?.display_name}</span>
              <button onClick={() => removeTodo(i)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '14px', padding: '0 2px'
              }}>✕</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '6px' }}>
            <input value={todoText} onChange={e => setTodoText(e.target.value)}
              placeholder="Todo text"
              onKeyDown={e => e.key === 'Enter' && addTodo()}
              style={{
                flex: 1, padding: '7px 10px', border: '1px solid #d1d5db',
                borderRadius: '6px', fontSize: '13px'
              }} />
            <select value={todoAssignee} onChange={e => setTodoAssignee(e.target.value)}
              style={{
                padding: '7px 10px',
                border: `1px solid ${todoText.trim() && !todoAssignee ? '#f97316' : '#d1d5db'}`,
                borderRadius: '6px', fontSize: '13px', color: todoAssignee ? '#111' : '#9ca3af',
                outline: todoText.trim() && !todoAssignee ? '2px solid #fed7aa' : 'none',
                transition: 'border-color 0.15s'
              }}>
              <option value="">Assign to…</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
            </select>
            <button onClick={addTodo} disabled={!todoText.trim() || !todoAssignee} title="Add todo" style={{
              padding: '7px 10px',
              backgroundColor: todoText.trim() && todoAssignee ? '#111' : '#f3f4f6',
              border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '14px',
              cursor: todoText.trim() && todoAssignee ? 'pointer' : 'not-allowed',
              color: todoText.trim() && todoAssignee ? '#fff' : '#d1d5db',
              lineHeight: 1, flexShrink: 0, transition: 'background-color 0.15s, color 0.15s'
            }}>✓</button>
          </div>
        </div>

        {/* Files */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
            FILES <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '400' }}>optional</span>
          </label>
          {files.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px',
              padding: '7px 10px', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #f3f4f6'
            }}>
              <span style={{ fontSize: '13px', flex: 1, color: '#111' }}>{f.filename}</span>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                {(f.file.size / 1024).toFixed(0)} KB
              </span>
              <button onClick={() => removeFile(i)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '14px', padding: '0 2px'
              }}>✕</button>
            </div>
          ))}
          <label
            ref={dropRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '6px', padding: '20px 16px',
              border: `2px dashed ${dragging ? '#6366f1' : '#d1d5db'}`,
              borderRadius: '8px', cursor: 'pointer',
              backgroundColor: dragging ? '#f5f3ff' : '#fafafa',
              transition: 'border-color 0.15s, background-color 0.15s'
            }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={dragging ? '#6366f1' : '#9ca3af'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span style={{ fontSize: '13px', color: dragging ? '#6366f1' : '#374151', fontWeight: '500' }}>
              Drag &amp; drop files here, or{' '}
              <span style={{ color: '#6366f1', textDecoration: 'underline' }}>click to browse</span>
            </span>
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>PDF, images, Word, Excel</span>
            <input type="file" multiple style={{ display: 'none' }} onChange={handleFileSelect}
              accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx" />
          </label>
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', backgroundColor: '#fff', border: '1px solid #d1d5db',
            borderRadius: '6px', fontSize: '13px', cursor: 'pointer', color: '#374151'
          }}>Cancel</button>
          <button onClick={handleSubmit} disabled={submitting || !title.trim() || !body.trim()} style={{
            padding: '8px 20px', backgroundColor: '#111', color: '#fff',
            border: 'none', borderRadius: '6px', fontSize: '13px',
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting || !title.trim() || !body.trim() ? 0.5 : 1
          }}>
            {submitting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  )
}