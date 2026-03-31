import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

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
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [numPages, setNumPages] = useState(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [pdfError, setPdfError] = useState(null)
  const [lightbox, setLightbox] = useState(false)

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
      <div style={{ marginBottom: '24px' }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#6b7280', padding: 0
        }}>← Back</button>
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
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <a href={file.file_url} target="_blank" rel="noreferrer" style={{
              fontSize: '12px', padding: '6px 14px', backgroundColor: '#111', color: '#fff',
              borderRadius: '6px', textDecoration: 'none', fontWeight: '500'
            }}>Open file ↗</a>
            <div style={{ width: '1px', height: '20px', backgroundColor: '#e5e7eb' }} />
            <button onClick={togglePin} style={{
              fontSize: '12px', padding: '6px 12px',
              border: file.pinned ? '1px solid #fbbf24' : '1px solid #e5e7eb',
              borderRadius: '6px', cursor: 'pointer',
              backgroundColor: file.pinned ? '#fffbeb' : '#fff',
              color: file.pinned ? '#b45309' : '#6b7280'
            }}>{file.pinned ? '📌 Pinned' : '📌 Pin'}</button>
            {file.status === 'active' && (
              <button onClick={() => updateStatus('complete')} style={{
                fontSize: '12px', padding: '6px 12px',
                border: '1px solid #bbf7d0', borderRadius: '6px', cursor: 'pointer',
                backgroundColor: '#f0fdf4', color: '#15803d'
              }}>✓ Mark Complete</button>
            )}
            {file.status === 'complete' && (
              <button onClick={() => updateStatus('active')} style={{
                fontSize: '12px', padding: '6px 12px',
                border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer',
                backgroundColor: '#fff', color: '#6b7280'
              }}>↺ Reactivate</button>
            )}
            <button onClick={() => updateStatus('void')} style={{
              fontSize: '12px', padding: '6px 12px',
              border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer',
              backgroundColor: '#fff5f5', color: '#dc2626'
            }}>✕ Void</button>
          </div>
        )}
      </div>

      {/* Image preview */}
      {file.status !== 'void' && isImage(file.file_type) && (
        <div style={{
          backgroundColor: '#fff', border: '1px solid #e5e7eb',
          borderRadius: '8px', padding: '16px', marginBottom: '20px'
        }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', margin: '0 0 12px' }}>Preview</h3>
          <div style={{
            backgroundColor: '#f9fafb', borderRadius: '6px', overflow: 'hidden',
            cursor: 'zoom-in', display: 'flex', justifyContent: 'center', alignItems: 'center',
            maxHeight: '320px',
          }} onClick={() => setLightbox(true)}>
            <img
              src={file.file_url}
              alt={file.filename}
              style={{
                maxWidth: '100%', maxHeight: '320px',
                objectFit: 'contain', display: 'block',
                borderRadius: '4px',
              }}
            />
          </div>
          <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '6px', textAlign: 'center' }}>
            Click to expand
          </p>
        </div>
      )}

      {/* PDF preview */}
      {file.status !== 'void' && file.file_type?.toUpperCase() === 'PDF' && (
        <div style={{
          backgroundColor: '#fff', border: '1px solid #e5e7eb',
          borderRadius: '8px', padding: '16px', marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '600', margin: 0 }}>Preview</h3>
            {numPages && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                  disabled={pageNumber <= 1}
                  style={{
                    padding: '3px 8px', fontSize: '12px', border: '1px solid #e5e7eb',
                    borderRadius: '4px', cursor: pageNumber <= 1 ? 'not-allowed' : 'pointer',
                    backgroundColor: '#fff', color: pageNumber <= 1 ? '#d1d5db' : '#374151'
                  }}>‹</button>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>{pageNumber} / {numPages}</span>
                <button
                  onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                  disabled={pageNumber >= numPages}
                  style={{
                    padding: '3px 8px', fontSize: '12px', border: '1px solid #e5e7eb',
                    borderRadius: '4px', cursor: pageNumber >= numPages ? 'not-allowed' : 'pointer',
                    backgroundColor: '#fff', color: pageNumber >= numPages ? '#d1d5db' : '#374151'
                  }}>›</button>
              </div>
            )}
          </div>

          {pdfError ? (
            <div style={{
              backgroundColor: '#f9fafb', borderRadius: '6px', padding: '32px',
              textAlign: 'center', color: '#6b7280', fontSize: '13px'
            }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>📄</div>
              <p style={{ margin: '0 0 12px' }}>Preview unavailable</p>
              <a href={file.file_url} target="_blank" rel="noreferrer" style={{
                fontSize: '12px', padding: '6px 14px', backgroundColor: '#111', color: '#fff',
                borderRadius: '6px', textDecoration: 'none'
              }}>Open file ↗</a>
            </div>
          ) : (
            <div style={{
              backgroundColor: '#f9fafb', borderRadius: '6px', overflow: 'auto',
              display: 'flex', justifyContent: 'center', padding: '16px',
            }}>
              <Document
                file={file.file_url}
                onLoadSuccess={({ numPages }) => { setNumPages(numPages); setPdfError(null) }}
                onLoadError={(err) => setPdfError(err?.message || String(err))}
                onSourceError={(err) => setPdfError(err?.message || String(err))}
                loading={
                  <div style={{ padding: '32px', color: '#9ca3af', fontSize: '13px' }}>Loading PDF…</div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  width={560}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
              </Document>
            </div>
          )}
        </div>
      )}

      {/* Image lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(false)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, cursor: 'zoom-out', padding: '24px',
          }}
        >
          <img
            src={file.file_url}
            alt={file.filename}
            style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '4px' }}
            onClick={e => e.stopPropagation()}
          />
          <button onClick={() => setLightbox(false)} style={{
            position: 'fixed', top: '16px', right: '20px',
            background: 'none', border: 'none', color: '#fff',
            fontSize: '24px', cursor: 'pointer', lineHeight: 1,
          }}>✕</button>
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

      {/* Danger zone */}
      <div style={{
        marginTop: '48px', borderTop: '1px solid #fee2e2', paddingTop: '24px'
      }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#ef4444', margin: '0 0 6px' }}>Danger Zone</h3>
        <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 16px' }}>
          Permanently delete this file from storage and all records. This cannot be undone.
        </p>
        {!showDelete ? (
          <button onClick={() => setShowDelete(true)} style={{
            fontSize: '12px', padding: '6px 14px', backgroundColor: '#fff', color: '#ef4444',
            border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer'
          }}>Delete this file</button>
        ) : (
          <div style={{
            border: '1px solid #fca5a5', borderRadius: '8px', padding: '16px', backgroundColor: '#fff5f5'
          }}>
            <p style={{ fontSize: '12px', color: '#374151', margin: '0 0 10px' }}>
              Type <strong style={{ fontFamily: 'monospace' }}>{file.filename}</strong> to confirm deletion:
            </p>
            <input
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder={file.filename}
              style={{
                padding: '6px 10px', border: '1px solid #fca5a5', borderRadius: '6px',
                fontSize: '13px', width: '100%', boxSizing: 'border-box', marginBottom: '10px',
                backgroundColor: '#fff'
              }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleDelete}
                disabled={deleting || deleteConfirmText !== file.filename}
                style={{
                  fontSize: '12px', padding: '6px 14px', backgroundColor: '#ef4444', color: '#fff',
                  border: 'none', borderRadius: '6px', cursor: 'pointer',
                  opacity: deleting || deleteConfirmText !== file.filename ? 0.4 : 1
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