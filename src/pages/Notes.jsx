import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Notes() {
  const { user } = useAuth()
  const [notes, setNotes] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchNotes() }, [])

  const fetchNotes = async () => {
    const { data } = await supabase
      .from('notes')
      .select(`id, title, body, pinned, created_at, updated_at,
        created_by_user:users!notes_created_by_fkey(display_name, avatar_url),
        last_updated_by_user:users!notes_last_updated_by_fkey(display_name, avatar_url)`)
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false })
    setNotes(data || [])
    if (selected) {
      const updated = (data || []).find(n => n.id === selected.id)
      if (updated) setSelected(updated)
    }
  }

  const filtered = notes.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.body.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = async () => {
    if (!newTitle.trim() || !newBody.trim()) return
    setSaving(true)
    const { data } = await supabase.from('notes').insert({
      title: newTitle.trim(),
      body: newBody.trim(),
      created_by: user.id,
      last_updated_by: user.id
    }).select().single()
    setSaving(false)
    setNewTitle(''); setNewBody(''); setShowNewForm(false)
    await fetchNotes()
    if (data) setSelected(data)
  }

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !editBody.trim()) return
    setSaving(true)
    await supabase.from('notes').update({
      title: editTitle.trim(),
      body: editBody.trim(),
      last_updated_by: user.id,
      updated_at: new Date().toISOString()
    }).eq('id', selected.id)
    setSaving(false)
    setEditing(false)
    fetchNotes()
  }

  const togglePin = async (note, e) => {
    e.stopPropagation()
    await supabase.from('notes').update({ pinned: !note.pinned }).eq('id', note.id)
    fetchNotes()
  }

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError('')
    const { data } = await supabase.rpc('verify_user', {
      p_username: user.username, p_password: deletePassword
    })
    if (!data || data.length === 0) {
      setDeleteError('Incorrect password')
      setDeleting(false)
      return
    }
    await supabase.from('notes').delete().eq('id', selected.id)
    setSelected(null)
    setShowDeleteConfirm(false)
    setDeletePassword('')
    setDeleting(false)
    fetchNotes()
  }

  const startEdit = () => {
    setEditTitle(selected.title)
    setEditBody(selected.body)
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setEditTitle('')
    setEditBody('')
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 52px)' }}>

      {/* Sidebar */}
      <div style={{
        width: '280px', flexShrink: 0, borderRight: '1px solid #e5e7eb',
        backgroundColor: '#fff', display: 'flex', flexDirection: 'column'
      }}>
        {/* Search + New */}
        <div style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search notes..."
            style={{
              width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb',
              borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box',
              backgroundColor: '#f9fafb', marginBottom: '8px'
            }} />
          <button onClick={() => { setShowNewForm(true); setSelected(null); setEditing(false) }} style={{
            width: '100%', padding: '7px', backgroundColor: '#111', color: '#fff',
            border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer'
          }}>+ New Note</button>
        </div>

        {/* Note list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <p style={{ padding: '24px 16px', fontSize: '13px', color: '#9ca3af', textAlign: 'center' }}>
              {search ? 'No results' : 'No notes yet'}
            </p>
          )}
          {filtered.map(note => (
            <div key={note.id}
              onClick={() => { setSelected(note); setShowNewForm(false); setEditing(false) }}
              style={{
                padding: '12px 14px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer',
                backgroundColor: selected?.id === note.id ? '#f3f4f6' : '#fff'
              }}
              onMouseEnter={e => { if (selected?.id !== note.id) e.currentTarget.style.backgroundColor = '#f9fafb' }}
              onMouseLeave={e => { if (selected?.id !== note.id) e.currentTarget.style.backgroundColor = '#fff' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{
                  fontSize: '13px', fontWeight: '500', color: '#111',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1
                }}>{note.title}</span>
                <button onClick={e => togglePin(note, e)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '12px', padding: '0 0 0 6px', flexShrink: 0,
                  opacity: note.pinned ? 1 : 0.3
                }}>📌</button>
              </div>
              <p style={{
                margin: 0, fontSize: '11px', color: '#9ca3af',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>{note.body}</p>
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#d1d5db' }}>
                {formatDate(note.updated_at)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Main panel */}
      <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#f9fafb' }}>

        {/* New note form */}
        {showNewForm && (
          <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>New Note</h2>
            <input
              value={newTitle} onChange={e => setNewTitle(e.target.value)}
              placeholder="Title *"
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
                borderRadius: '8px', fontSize: '15px', fontWeight: '500',
                boxSizing: 'border-box', marginBottom: '12px'
              }} />
            <textarea
              value={newBody} onChange={e => setNewBody(e.target.value)}
              placeholder="Write your note..."
              rows={16}
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
                borderRadius: '8px', fontSize: '13px', lineHeight: '1.7',
                resize: 'vertical', boxSizing: 'border-box', marginBottom: '12px'
              }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleCreate} disabled={saving || !newTitle.trim() || !newBody.trim()} style={{
                padding: '8px 20px', backgroundColor: '#111', color: '#fff',
                border: 'none', borderRadius: '6px', fontSize: '13px',
                cursor: saving || !newTitle.trim() || !newBody.trim() ? 'not-allowed' : 'pointer',
                opacity: saving || !newTitle.trim() || !newBody.trim() ? 0.5 : 1
              }}>{saving ? 'Saving...' : 'Save Note'}</button>
              <button onClick={() => { setShowNewForm(false); setNewTitle(''); setNewBody('') }} style={{
                padding: '8px 16px', backgroundColor: '#fff', border: '1px solid #d1d5db',
                borderRadius: '6px', fontSize: '13px', cursor: 'pointer', color: '#374151'
              }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Selected note */}
        {selected && !showNewForm && (
          <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px' }}>

            {/* Note header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editing ? (
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    style={{
                      width: '100%', padding: '6px 8px', border: '1px solid #d1d5db',
                      borderRadius: '6px', fontSize: '22px', fontWeight: '700',
                      boxSizing: 'border-box'
                    }} />
                ) : (
                  <h1 style={{ fontSize: '22px', fontWeight: '700', margin: 0, wordBreak: 'break-word' }}>
                    {selected.title}
                  </h1>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {!editing ? (
                  <>
                    <button onClick={startEdit} style={{
                      fontSize: '12px', padding: '4px 10px', border: '1px solid #e5e7eb',
                      borderRadius: '5px', cursor: 'pointer', backgroundColor: '#fff', color: '#374151'
                    }}>Edit</button>
                    {!showDeleteConfirm ? (
                      <button onClick={() => setShowDeleteConfirm(true)} style={{
                        fontSize: '12px', padding: '4px 10px', border: '1px solid #fee2e2',
                        borderRadius: '5px', cursor: 'pointer', backgroundColor: '#fff', color: '#ef4444'
                      }}>Delete</button>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input type="password" placeholder="Your password" value={deletePassword}
                          onChange={e => { setDeletePassword(e.target.value); setDeleteError('') }}
                          style={{
                            padding: '3px 8px', border: `1px solid ${deleteError ? '#ef4444' : '#d1d5db'}`,
                            borderRadius: '5px', fontSize: '12px', width: '130px'
                          }} />
                        <button onClick={handleDelete} disabled={deleting || !deletePassword} style={{
                          fontSize: '12px', padding: '3px 10px', backgroundColor: '#ef4444', color: '#fff',
                          border: 'none', borderRadius: '5px', cursor: 'pointer',
                          opacity: deleting || !deletePassword ? 0.6 : 1
                        }}>{deleting ? '...' : 'Confirm'}</button>
                        <button onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteError('') }} style={{
                          fontSize: '12px', padding: '3px 10px', backgroundColor: '#fff', color: '#374151',
                          border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer'
                        }}>Cancel</button>
                        {deleteError && <span style={{ fontSize: '12px', color: '#ef4444' }}>{deleteError}</span>}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <button onClick={handleSaveEdit} disabled={saving} style={{
                      fontSize: '12px', padding: '4px 10px', backgroundColor: '#111', color: '#fff',
                      border: 'none', borderRadius: '5px', cursor: 'pointer',
                      opacity: saving ? 0.6 : 1
                    }}>{saving ? 'Saving...' : 'Save'}</button>
                    <button onClick={cancelEdit} style={{
                      fontSize: '12px', padding: '4px 10px', border: '1px solid #d1d5db',
                      borderRadius: '5px', cursor: 'pointer', backgroundColor: '#fff', color: '#374151'
                    }}>Cancel</button>
                  </>
                )}
              </div>
            </div>

            {/* Meta */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#9ca3af' }}>
                <span>Created by</span>
                <img src={selected.created_by_user?.avatar_url} alt=""
                  style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }} />
                <span>{selected.created_by_user?.display_name}</span>
                <span>· {formatDate(selected.created_at)}</span>
              </div>
              {selected.last_updated_by_user && selected.updated_at !== selected.created_at && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#9ca3af' }}>
                  <span>Updated by</span>
                  <img src={selected.last_updated_by_user?.avatar_url} alt=""
                    style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }} />
                  <span>{selected.last_updated_by_user?.display_name}</span>
                  <span>· {formatDate(selected.updated_at)}</span>
                </div>
              )}
            </div>

            {/* Body */}
            {editing ? (
              <textarea value={editBody} onChange={e => setEditBody(e.target.value)}
                rows={20}
                style={{
                  width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
                  borderRadius: '8px', fontSize: '13px', lineHeight: '1.7',
                  resize: 'vertical', boxSizing: 'border-box'
                }} />
            ) : (
              <div style={{
                fontSize: '14px', lineHeight: '1.8', color: '#374151',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word', textAlign: 'left'
              }}>
                {selected.body}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!selected && !showNewForm && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', flexDirection: 'column', gap: '12px'
          }}>
            <span style={{ fontSize: '32px' }}>📋</span>
            <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>Select a note or create a new one</p>
          </div>
        )}
      </div>
    </div>
  )
}