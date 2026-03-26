import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import NewFileModal from '../components/NewFileModal'

const fileIcon = (type) => {
  const t = type?.toUpperCase()
  if (t === 'PDF') return '📄'
  if (['JPG','JPEG','PNG','WEBP'].includes(t)) return '🖼️'
  if (t === 'DOCX') return '📝'
  if (t === 'XLSX') return '📊'
  return '📁'
}

export default function FileList() {
  const [files, setFiles] = useState([])
  const [tab, setTab] = useState('active')
  const [showModal, setShowModal] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { fetchFiles() }, [tab])

  const fetchFiles = async () => {
    let query = supabase
      .from('files')
      .select(`id, filename, file_type, file_url, status, pinned, created_at,
        created_by_user:users!files_created_by_fkey(display_name, avatar_url)`)
      .is('message_id', null)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (tab === 'active') query = query.eq('status', 'active')
    else if (tab === 'complete') query = query.eq('status', 'complete')
    else if (tab === 'void') query = query.eq('status', 'void')

    const { data } = await query
    setFiles(data || [])
  }

  const updateStatus = async (e, file, status) => {
    e.stopPropagation()
    await supabase.from('files').update({ status }).eq('id', file.id)
    await supabase.from('activity_log').insert({
      entity_type: 'file', entity_id: file.id,
      action: status, performed_by: user.id
    })
    fetchFiles()
  }

  const togglePin = async (e, file) => {
    e.stopPropagation()
    await supabase.from('files').update({ pinned: !file.pinned }).eq('id', file.id)
    await supabase.from('activity_log').insert({
      entity_type: 'file', entity_id: file.id,
      action: file.pinned ? 'unpinned' : 'pinned', performed_by: user.id
    })
    fetchFiles()
  }

  const deleteFile = async (e, file) => {
    e.stopPropagation()
    if (!window.confirm('Delete this file?')) return
    const path = file.file_url.split('/files/')[1]
    await supabase.storage.from('files').remove([path])
    await supabase.from('files').delete().eq('id', file.id)
    fetchFiles()
  }

  const tabs = ['active', 'complete', 'void', 'all']

  return (
    <>
      <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => navigate('/home')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '13px', color: '#6b7280', padding: 0
            }}>← Back</button>
            <h1 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Files</h1>
          </div>
          <button onClick={() => setShowModal(true)} style={{
            fontSize: '12px', padding: '4px 12px', backgroundColor: '#111', color: '#fff',
            border: 'none', borderRadius: '5px', cursor: 'pointer'
          }}>+ Upload</button>
        </div>

        <div style={{
          display: 'flex', gap: '4px', marginBottom: '16px',
          backgroundColor: '#f3f4f6', borderRadius: '8px', padding: '4px'
        }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '6px', border: 'none', borderRadius: '6px', cursor: 'pointer',
              fontSize: '13px', fontWeight: tab === t ? '600' : '400',
              backgroundColor: tab === t ? '#fff' : 'transparent',
              color: tab === t ? '#111' : '#6b7280',
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              textTransform: 'capitalize'
            }}>{t}</button>
          ))}
        </div>

        <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
          {files.length === 0 && (
            <p style={{ padding: '24px', fontSize: '13px', color: '#9ca3af', textAlign: 'center' }}>No files</p>
          )}
          {files.map(f => (
            <div key={f.id}
              onClick={() => navigate(`/home/files/${f.id}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', borderBottom: '1px solid #f3f4f6',
                cursor: 'pointer', backgroundColor: '#fff',
                opacity: f.status === 'void' ? 0.4 : 1
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9fafb'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
            >
              <span style={{ fontSize: '20px', flexShrink: 0 }}>{fileIcon(f.file_type)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {f.pinned && <span style={{ fontSize: '11px' }}>📌</span>}
                  {f.status === 'void'
                    ? <span style={{ fontSize: '13px', color: '#9ca3af', textDecoration: 'line-through' }}>{f.filename}</span>
                    : <a href={f.file_url} target="_blank" rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'none' }}>{f.filename}</a>
                  }
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '2px' }}>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>{f.created_by_user?.display_name}</span>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                    {new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                {f.status !== 'void' && (
                  <button onClick={e => togglePin(e, f)} style={{
                    fontSize: '11px', padding: '2px 8px', border: '1px solid #e5e7eb',
                    borderRadius: '4px', cursor: 'pointer', backgroundColor: '#fff', color: '#6b7280'
                  }}>{f.pinned ? 'Unpin' : 'Pin'}</button>
                )}
                {f.status === 'active' && (
                  <button onClick={e => updateStatus(e, f, 'complete')} style={{
                    fontSize: '11px', padding: '2px 8px', border: '1px solid #e5e7eb',
                    borderRadius: '4px', cursor: 'pointer', backgroundColor: '#fff', color: '#6b7280'
                  }}>Complete</button>
                )}
                {f.status !== 'void' && (
                  <button onClick={e => updateStatus(e, f, 'void')} style={{
                    fontSize: '11px', padding: '2px 8px', border: '1px solid #fee2e2',
                    borderRadius: '4px', cursor: 'pointer', backgroundColor: '#fff', color: '#ef4444'
                  }}>Void</button>
                )}
                <button onClick={e => deleteFile(e, f)} style={{
                  fontSize: '11px', padding: '2px 8px', border: '1px solid #fee2e2',
                  borderRadius: '4px', cursor: 'pointer', backgroundColor: '#fff', color: '#ef4444'
                }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <NewFileModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); fetchFiles() }}
        />
      )}
    </>
  )
}