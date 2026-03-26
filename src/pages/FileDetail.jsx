import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const fileIcon = (type) => {
  const t = type?.toUpperCase()
  if (t === 'PDF') return '📄'
  if (['JPG','JPEG','PNG','WEBP'].includes(t)) return '🖼️'
  if (t === 'DOCX') return '📝'
  if (t === 'XLSX') return '📊'
  return '📁'
}

export default function FileDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [file, setFile] = useState(null)
  const [log, setLog] = useState([])
  const [showDelete, setShowDelete] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchAll() }, [id])

  const fetchAll = async () => {
    const { data: f } = await supabase
      .from('files')
      .select(`id, filename, file_type, file_url, status, pinned, created_at, message_id,
        created_by_user:users!files_created_by_fkey(display_name, avatar_url),
        message:messages(id, title)`)
      .eq('id', id)
      .single()
    setFile(f)

    const { data: l } = await supabase
      .from('activity_log')
      .select(`id, action, created_at,
        performed_by_user:users!activity_log_performed_by_fkey(display_name, avatar_url)`)
      .eq('entity_type', 'file')
      .eq('entity_id', id)
      .order('created_at', { ascending: false })
    setLog(l || [])
  }

  const updateStatus = async (status) => {
    await supabase.from('files').update({ status }).eq('id', id)
    await supabase.from('activity_log').insert({
      entity_type: 'file', entity_id: id, action: status, performed_by: user.id
    })
    fetchAll()
  }

  const togglePin = async () => {
    await supabase.from('files').update({ pinned: !file.pinned }).eq('id', id)
    await supabase.from('activity_log').insert({
      entity_type: 'file', entity_id: id,
      action: file.pinned ? 'unpinned' : 'pinned', performed_by: user.id
    })
    fetchAll()
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
    const path = file.file_url.split('/files/')[1]
    await supabase.storage.from('files').remove([path])
    await supabase.from('files').delete().eq('id', id)
    navigate(file.message_id ? `/home/messages/${file.message_id}` : '/home/files')
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  })

  const isImage = (type) => ['JPG','JPEG','PNG','WEBP'].includes(type?.toUpperCase())

  if (!file) return null

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#6b7280', padding: 0
        }}>← Back</button>
        {!showDelete
          ? <button onClick={() => setShowDelete(true)} style={{
              fontSize: '12px', padding: '3px 10px', backgroundColor: '#fff', color: '#ef4444',
              border: '1px solid #fee2e2', borderRadius: '5px', cursor: 'pointer'
            }}>Delete</button>
          : (
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
              <button onClick={() => { setShowDelete(false); setDeletePassword(''); setDeleteError('') }} style={{
                fontSize: '12px', padding: '3px 10px', backgroundColor: '#fff', color: '#374151',
                border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer'
              }}>Cancel</button>
              {deleteError && <span style={{ fontSize: '12px', color: '#ef4444' }}>{deleteError}</span>}
            </div>
          )
        }
      </div>

      {/* File info */}
      <div style={{
        backgroundColor: '#fff', border: '1px solid #e5e7eb',
        borderRadius: '8px', padding: '20px', marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
          <span style={{ fontSize: '32px', flexShrink: 0 }}>{fileIcon(file.file_type)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              {file.pinned && <span style={{ fontSize: '12px' }}>📌</span>}
              <span style={{
                fontSize: '15px', fontWeight: '500', color: '#111',
                wordBreak: 'break-word',
                textDecoration: file.status === 'void' ? 'line-through' : 'none'
              }}>{file.filename}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '11px', padding: '2px 7px', borderRadius: '4px',
                backgroundColor: file.status === 'active' ? '#f0fdf4' : file.status === 'complete' ? '#eff6ff' : '#fef2f2',
                color: file.status === 'active' ? '#16a34a' : file.status === 'complete' ? '#2563eb' : '#ef4444',
                border: `1px solid ${file.status === 'active' ? '#bbf7d0' : file.status === 'complete' ? '#bfdbfe' : '#fecaca'}`
              }}>{file.status}</span>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>{file.file_type}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '24px', fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Uploaded by</span>
            <img src={file.created_by_user?.avatar_url} alt=""
              style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }} />
            <span style={{ fontWeight: '500', color: '#374151' }}>{file.created_by_user?.display_name}</span>
          </div>
          <span>{formatDate(file.created_at)}</span>
        </div>

        {file.message && (
          <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #f3f4f6' }}>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>From message: </span>
            <button onClick={() => navigate(`/home/messages/${file.message.id}`)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '12px', color: '#2563eb', padding: 0
            }}>{file.message.title}</button>
          </div>
        )}

        {/* Actions */}
        {file.status !== 'void' && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <a href={file.file_url} target="_blank" rel="noreferrer" style={{
              fontSize: '12px', padding: '5px 12px', backgroundColor: '#111', color: '#fff',
              borderRadius: '6px', textDecoration: 'none'
            }}>Open file ↗</a>
            <button onClick={togglePin} style={{
              fontSize: '12px', padding: '5px 12px', border: '1px solid #e5e7eb',
              borderRadius: '6px', cursor: 'pointer', backgroundColor: '#fff', color: '#374151'
            }}>{file.pinned ? '📌 Unpin' : 'Pin'}</button>
            {file.status === 'active' && (
              <button onClick={() => updateStatus('complete')} style={{
                fontSize: '12px', padding: '5px 12px', border: '1px solid #e5e7eb',
                borderRadius: '6px', cursor: 'pointer', backgroundColor: '#fff', color: '#374151'
              }}>Mark Complete</button>
            )}
            {file.status === 'complete' && (
              <button onClick={() => updateStatus('active')} style={{
                fontSize: '12px', padding: '5px 12px', border: '1px solid #e5e7eb',
                borderRadius: '6px', cursor: 'pointer', backgroundColor: '#fff', color: '#374151'
              }}>Reactivate</button>
            )}
            <button onClick={() => updateStatus('void')} style={{
              fontSize: '12px', padding: '5px 12px', border: '1px solid #fee2e2',
              borderRadius: '6px', cursor: 'pointer', backgroundColor: '#fff', color: '#ef4444'
            }}>Void</button>
          </div>
        )}
      </div>

      {/* Preview */}
      {file.status !== 'void' && isImage(file.file_type) && (
        <div style={{
          backgroundColor: '#fff', border: '1px solid #e5e7eb',
          borderRadius: '8px', padding: '16px', marginBottom: '20px'
        }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', margin: '0 0 12px' }}>Preview</h3>
          <img src={file.file_url} alt={file.filename}
            style={{ maxWidth: '100%', borderRadius: '6px', display: 'block' }} />
        </div>
      )}

      {file.status !== 'void' && file.file_type === 'PDF' && (
        <div style={{
          backgroundColor: '#fff', border: '1px solid #e5e7eb',
          borderRadius: '8px', padding: '16px', marginBottom: '20px'
        }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', margin: '0 0 12px' }}>Preview</h3>
          <iframe src={file.file_url} style={{ width: '100%', height: '500px', border: 'none', borderRadius: '6px' }} />
        </div>
      )}

      {/* Activity log */}
      <div style={{
        backgroundColor: '#fff', border: '1px solid #e5e7eb',
        borderRadius: '8px', padding: '16px'
      }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', margin: '0 0 12px' }}>Activity</h3>
        {log.length === 0 && <p style={{ fontSize: '13px', color: '#9ca3af' }}>No activity</p>}
        {log.map(entry => (
          <div key={entry.id} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            marginBottom: '8px', fontSize: '12px'
          }}>
            <img src={entry.performed_by_user?.avatar_url} alt=""
              style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            <span style={{ color: '#374151' }}>
              <span style={{ fontWeight: '500' }}>{entry.performed_by_user?.display_name}</span>
              {' '}{entry.action} this file
            </span>
            <span style={{ color: '#9ca3af', marginLeft: 'auto', flexShrink: 0 }}>
              {formatDate(entry.created_at)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}