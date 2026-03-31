import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import NewFileModal from '../components/NewFileModal'

const FILE_TYPE_META = {
  PDF:  { icon: '📄', color: '#ef4444', bg: '#fef2f2' },
  JPG:  { icon: '🖼️', color: '#8b5cf6', bg: '#f5f3ff' },
  JPEG: { icon: '🖼️', color: '#8b5cf6', bg: '#f5f3ff' },
  PNG:  { icon: '🖼️', color: '#8b5cf6', bg: '#f5f3ff' },
  WEBP: { icon: '🖼️', color: '#8b5cf6', bg: '#f5f3ff' },
  DOCX: { icon: '📝', color: '#2563eb', bg: '#eff6ff' },
  XLSX: { icon: '📊', color: '#16a34a', bg: '#f0fdf4' },
}
const fileMeta = (type) => FILE_TYPE_META[type?.toUpperCase()] || { icon: '📁', color: '#6b7280', bg: '#f9fafb' }

const STATUS_STYLE = {
  active:   { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  complete: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  void:     { color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
}

export default function FileList() {
  const [files, setFiles] = useState([])
  const [tab, setTab] = useState('active')
  const [view, setView] = useState('grid')
  const [showModal, setShowModal] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { fetchFiles() }, [])

  const fetchFiles = async () => {
    const { data } = await supabase
      .from('files')
      .select(`id, filename, file_type, file_url, status, pinned, created_at,
        created_by_user:users!files_created_by_fkey(display_name, avatar_url)`)
      .is('message_id', null)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
    setFiles(data || [])
  }

  const filtered = useMemo(() => {
    if (tab === 'all') return files
    return files.filter(f => f.status === tab)
  }, [files, tab])

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

  const tabs = ['active', 'complete', 'void', 'all']

  return (
    <>
      <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => navigate('/home')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '13px', color: '#6b7280', padding: 0
            }}>← Back</button>
            <h1 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Files</h1>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* View toggle */}
            <div style={{
              display: 'flex', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden'
            }}>
              {[['grid', '⊞'], ['list', '☰']].map(([v, icon]) => (
                <button key={v} onClick={() => setView(v)} style={{
                  padding: '5px 10px', border: 'none', cursor: 'pointer', fontSize: '14px',
                  backgroundColor: view === v ? '#111' : '#fff',
                  color: view === v ? '#fff' : '#6b7280',
                }}>{icon}</button>
              ))}
            </div>
            <button onClick={() => setShowModal(true)} style={{
              fontSize: '12px', padding: '6px 12px', backgroundColor: '#111', color: '#fff',
              border: 'none', borderRadius: '5px', cursor: 'pointer'
            }}>+ Upload</button>
          </div>
        </div>

        {/* Tabs */}
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
            }}>
              {t}
              <span style={{
                marginLeft: '5px', fontSize: '11px',
                color: tab === t ? '#6b7280' : '#9ca3af'
              }}>
                {t === 'all' ? files.length : files.filter(f => f.status === t).length}
              </span>
            </button>
          ))}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div style={{
            backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px',
            padding: '48px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '13px'
          }}>No files</div>
        )}

        {/* Grid view */}
        {view === 'grid' && filtered.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: '12px',
          }}>
            {filtered.map(f => {
              const meta = fileMeta(f.file_type)
              const isVoid = f.status === 'void'
              return (
                <div key={f.id}
                  onClick={() => navigate(`/home/files/${f.id}`)}
                  style={{
                    position: 'relative',
                    backgroundColor: '#fff', border: '1px solid #e5e7eb',
                    borderRadius: '10px', padding: '14px 10px 10px',
                    cursor: 'pointer', textAlign: 'center',
                    opacity: isVoid ? 0.45 : 1,
                    transition: 'box-shadow 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
                    e.currentTarget.style.borderColor = '#d1d5db'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = 'none'
                    e.currentTarget.style.borderColor = '#e5e7eb'
                  }}
                >
                  {/* Pin badge */}
                  {f.pinned && (
                    <span style={{
                      position: 'absolute', top: '6px', right: '7px',
                      fontSize: '10px', opacity: 0.7
                    }}>📌</span>
                  )}

                  {/* File icon with colored background */}
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '12px',
                    backgroundColor: meta.bg, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', margin: '0 auto 10px', fontSize: '26px',
                  }}>
                    {meta.icon}
                  </div>

                  {/* Filename */}
                  <div style={{
                    fontSize: '11.5px', fontWeight: '500', color: isVoid ? '#9ca3af' : '#111',
                    textDecoration: isVoid ? 'line-through' : 'none',
                    wordBreak: 'break-word',
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    lineHeight: '1.4', marginBottom: '6px',
                    minHeight: '32px',
                  }}>{f.filename}</div>

                  {/* Type + status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '10px', color: '#9ca3af' }}>{f.file_type}</span>
                    {f.status !== 'active' && (
                      <span style={{
                        fontSize: '9.5px', padding: '1px 5px', borderRadius: '3px',
                        backgroundColor: STATUS_STYLE[f.status]?.bg,
                        color: STATUS_STYLE[f.status]?.color,
                        border: `1px solid ${STATUS_STYLE[f.status]?.border}`,
                      }}>{f.status}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* List view */}
        {view === 'list' && filtered.length > 0 && (
          <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
            {filtered.map(f => {
              const meta = fileMeta(f.file_type)
              return (
                <div key={f.id}
                  onClick={() => navigate(`/home/files/${f.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 16px', borderBottom: '1px solid #f3f4f6',
                    cursor: 'pointer', backgroundColor: '#fff',
                    opacity: f.status === 'void' ? 0.4 : 1
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                >
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '8px',
                    backgroundColor: meta.bg, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '18px', flexShrink: 0,
                  }}>{meta.icon}</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {f.pinned && <span style={{ fontSize: '10px' }}>📌</span>}
                      <span style={{
                        fontSize: '13px', color: '#111', fontWeight: '500',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        textDecoration: f.status === 'void' ? 'line-through' : 'none'
                      }}>{f.filename}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
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
                  </div>
                </div>
              )
            })}
          </div>
        )}
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
