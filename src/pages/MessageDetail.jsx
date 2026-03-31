import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

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
      .eq('id', id)
      .single()
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

  // ── Archive / Unarchive ────────────────────────────────────────────────────

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

  const fileIcon = (type) => {
    const t = type?.toUpperCase()
    if (t === 'PDF') return '📄'
    if (['JPG', 'JPEG', 'PNG', 'WEBP'].includes(t)) return '🖼️'
    if (t === 'DOCX') return '📝'
    if (t === 'XLSX') return '📊'
    return '📁'
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })

  if (!message) return null

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '8px' }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#6b7280', padding: 0
        }}>← Back</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Archive / Unarchive */}
          {message.archived ? (
            <button onClick={handleUnarchive} style={{
              fontSize: '12px', padding: '3px 10px', backgroundColor: '#fff', color: '#374151',
              border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer'
            }}>Reactivate</button>
          ) : (
            archiveConfirm ? (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Archive this message?</span>
                <button onClick={handleArchive} style={{
                  fontSize: '12px', padding: '3px 10px', backgroundColor: '#111', color: '#fff',
                  border: 'none', borderRadius: '5px', cursor: 'pointer'
                }}>Yes</button>
                <button onClick={() => setArchiveConfirm(false)} style={{
                  fontSize: '12px', padding: '3px 10px', backgroundColor: '#fff', color: '#374151',
                  border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer'
                }}>Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => canArchive && setArchiveConfirm(true)}
                title={!canArchive ? 'All todos must be complete and no active files before archiving' : ''}
                style={{
                  fontSize: '12px', padding: '3px 10px', backgroundColor: '#fff',
                  color: canArchive ? '#374151' : '#d1d5db',
                  border: `1px solid ${canArchive ? '#d1d5db' : '#e5e7eb'}`,
                  borderRadius: '5px', cursor: canArchive ? 'pointer' : 'not-allowed'
                }}>Archive</button>
            )
          )}

        </div>
      </div>

      {/* Title */}
      <div style={{ marginBottom: '28px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
          {message.archived && (
            <span style={{ fontSize: '11px', color: '#9ca3af', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '1px 6px' }}>
              Archived
            </span>
          )}
          <h1 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>{message.title}</h1>
        </div>
        <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
          {message.created_by_user?.display_name} · {formatDate(message.created_at)}
        </p>
      </div>

      {/* Replies */}
      <section style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
          {replies.map(reply => (
            <div key={reply.id} style={{ display: 'flex', gap: '10px' }}>
              <img src={reply.created_by_user?.avatar_url} alt=""
                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#111' }}>
                    {reply.created_by_user?.display_name}
                  </span>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                    {new Date(reply.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {' '}{new Date(reply.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
                <div style={{
                  fontSize: '13px', color: '#374151', lineHeight: '1.6',
                  backgroundColor: '#f9fafb', padding: '10px 12px', borderRadius: '6px',
                  textAlign: 'left'
                }}>
                  {reply.body.split(/(@[\w\s]+?)(?=\s|$|@)/).map((part, i) => {
                    const mentioned = reply.reply_mentions?.some(m =>
                      part.trim() === `@${m.mentioned_user?.display_name}`
                    )
                    return mentioned
                      ? <span key={i} style={{ color: '#2563eb', fontWeight: '500' }}>{part}</span>
                      : <span key={i}>{part}</span>
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Reply input */}
        {!message.archived && (
          <div style={{ position: 'relative' }}>
            <textarea ref={textareaRef} value={replyBody} onChange={handleReplyChange}
              placeholder="Reply... (type @ to mention someone)"
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
                borderRadius: '8px', fontSize: '13px', resize: 'vertical',
                boxSizing: 'border-box', lineHeight: '1.5'
              }} />
            {mentioning && filteredUsers.length > 0 && (
              <div style={{
                position: 'absolute', bottom: '100%', left: 0,
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
            <button onClick={handlePostReply} disabled={!replyBody.trim()} style={{
              marginTop: '8px', padding: '7px 16px', backgroundColor: '#111', color: '#fff',
              border: 'none', borderRadius: '6px', fontSize: '13px',
              cursor: replyBody.trim() ? 'pointer' : 'not-allowed',
              opacity: replyBody.trim() ? 1 : 0.5
            }}>Post Reply</button>
          </div>
        )}
      </section>

      {/* Todos */}
      <section style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '600', margin: 0 }}>Todos</h2>
          {!message.archived && (
            <button onClick={() => setShowTodoForm(v => !v)} style={{
              fontSize: '12px', padding: '3px 10px', backgroundColor: '#111', color: '#fff',
              border: 'none', borderRadius: '5px', cursor: 'pointer'
            }}>{showTodoForm ? 'Cancel' : '+ Add'}</button>
          )}
        </div>

        {showTodoForm && (
          <div style={{
            padding: '12px', border: '1px solid #e5e7eb', borderRadius: '8px',
            marginBottom: '12px', backgroundColor: '#f9fafb'
          }}>
            <input placeholder="Todo text" value={todoText} onChange={e => setTodoText(e.target.value)}
              style={{
                width: '100%', padding: '7px 10px', border: '1px solid #d1d5db',
                borderRadius: '6px', fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box'
              }} />
            <select value={todoAssignee} onChange={e => setTodoAssignee(e.target.value)}
              style={{
                width: '100%', padding: '7px 10px', border: '1px solid #d1d5db',
                borderRadius: '6px', fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box',
                color: todoAssignee ? '#111' : '#9ca3af'
              }}>
              <option value="">Assign to...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
            </select>
            <button onClick={handleAddTodo} disabled={!todoText.trim() || !todoAssignee} style={{
              padding: '6px 14px', backgroundColor: '#111', color: '#fff',
              border: 'none', borderRadius: '6px', fontSize: '13px',
              cursor: !todoText.trim() || !todoAssignee ? 'not-allowed' : 'pointer',
              opacity: !todoText.trim() || !todoAssignee ? 0.5 : 1
            }}>Add Todo</button>
          </div>
        )}

        {todos.length === 0 && <p style={{ fontSize: '13px', color: '#9ca3af' }}>No todos</p>}
        {todos.map(todo => (
          <div key={todo.id}
            onClick={() => navigate(`/home/todos/${todo.id}`)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 12px', borderRadius: '6px', cursor: 'pointer',
              marginBottom: '4px', border: '1px solid #f3f4f6', backgroundColor: '#fff'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9fafb'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
          >
            <button onClick={e => { e.stopPropagation(); toggleTodo(todo) }} style={{
              width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
              border: `2px solid ${todo.completed ? '#10b981' : '#d1d5db'}`,
              backgroundColor: todo.completed ? '#10b981' : 'transparent',
              cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {todo.completed && <span style={{ color: '#fff', fontSize: '9px' }}>✓</span>}
            </button>
            <span style={{
              fontSize: '13px', flex: 1,
              color: todo.completed ? '#9ca3af' : '#111',
              textDecoration: todo.completed ? 'line-through' : 'none'
            }}>{todo.text}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <img src={todo.assigned_user?.avatar_url} alt=""
                style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>{todo.assigned_user?.display_name}</span>
            </div>
          </div>
        ))}
      </section>

      {/* Files */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '600', margin: 0 }}>Files</h2>
          {!message.archived && (
            <label style={{
              fontSize: '12px', padding: '3px 10px', backgroundColor: '#111', color: '#fff',
              borderRadius: '5px', cursor: uploading ? 'not-allowed' : 'pointer',
              opacity: uploading ? 0.6 : 1
            }}>
              {uploading ? 'Uploading...' : '+ Upload'}
              <input type="file" multiple style={{ display: 'none' }} onChange={handleUpload} disabled={uploading}
                accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx" />
            </label>
          )}
        </div>

        {files.length === 0 && <p style={{ fontSize: '13px', color: '#9ca3af' }}>No files</p>}
        {files.map(f => (
          <div key={f.id} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 12px', borderRadius: '6px', marginBottom: '4px',
            border: '1px solid #f3f4f6', opacity: f.status === 'void' ? 0.4 : 1,
            backgroundColor: '#fff'
          }}>
            <span style={{ fontSize: '18px', flexShrink: 0 }}>{fileIcon(f.file_type)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {f.pinned && <span style={{ fontSize: '10px' }}>📌</span>}
                {f.status === 'void'
                  ? <span style={{ fontSize: '13px', color: '#9ca3af', textDecoration: 'line-through' }}>{f.filename}</span>
                  : <a href={f.file_url} target="_blank" rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'none' }}>{f.filename}</a>
                }
              </div>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                {f.status === 'complete' ? '✓ Complete · ' : ''}
                {f.created_by_user?.display_name} · {formatDate(f.created_at)}
              </span>
            </div>
            {!message.archived && f.status !== 'void' && (
              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                <button onClick={() => togglePin(f)} style={{
                  fontSize: '11px', padding: '2px 8px', border: '1px solid #e5e7eb',
                  borderRadius: '4px', cursor: 'pointer', backgroundColor: '#fff', color: '#6b7280'
                }}>{f.pinned ? 'Unpin' : 'Pin'}</button>
                {f.status === 'active' && (
                  <button onClick={() => updateFileStatus(f, 'complete')} style={{
                    fontSize: '11px', padding: '2px 8px', border: '1px solid #e5e7eb',
                    borderRadius: '4px', cursor: 'pointer', backgroundColor: '#fff', color: '#6b7280'
                  }}>Complete</button>
                )}
                <button onClick={() => updateFileStatus(f, 'void')} style={{
                  fontSize: '11px', padding: '2px 8px', border: '1px solid #fee2e2',
                  borderRadius: '4px', cursor: 'pointer', backgroundColor: '#fff', color: '#ef4444'
                }}>Void</button>
              </div>
            )}
          </div>
        ))}
      </section>

      {/* Danger zone */}
      <div style={{
        marginTop: '48px', borderTop: '1px solid #fee2e2', paddingTop: '24px'
      }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#ef4444', margin: '0 0 6px' }}>Danger Zone</h3>
        <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 16px' }}>
          Permanently delete this message and all its replies, todos, and files. This cannot be undone.
        </p>
        {!showDelete ? (
          <button onClick={() => setShowDelete(true)} style={{
            fontSize: '12px', padding: '6px 14px', backgroundColor: '#fff', color: '#ef4444',
            border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer'
          }}>Delete this message</button>
        ) : (
          <div style={{
            border: '1px solid #fca5a5', borderRadius: '8px', padding: '16px', backgroundColor: '#fff5f5'
          }}>
            <p style={{ fontSize: '12px', color: '#374151', margin: '0 0 10px' }}>
              Type <strong style={{ fontFamily: 'monospace' }}>{message.title}</strong> to confirm deletion:
            </p>
            <input
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder={message.title}
              style={{
                padding: '6px 10px', border: '1px solid #fca5a5', borderRadius: '6px',
                fontSize: '13px', width: '100%', boxSizing: 'border-box', marginBottom: '10px',
                backgroundColor: '#fff'
              }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleDelete}
                disabled={deleting || deleteConfirmText !== message.title}
                style={{
                  fontSize: '12px', padding: '6px 14px', backgroundColor: '#ef4444', color: '#fff',
                  border: 'none', borderRadius: '6px', cursor: 'pointer',
                  opacity: deleting || deleteConfirmText !== message.title ? 0.4 : 1
                }}>{deleting ? 'Deleting...' : 'I understand, delete permanently'}</button>
              <button onClick={() => { setShowDelete(false); setDeleteConfirmText('') }} style={{
                fontSize: '12px', padding: '6px 14px', backgroundColor: '#fff', color: '#374151',
                border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer'
              }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}