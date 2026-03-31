import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const ALLOWED_TYPES = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]

const ALLOWED_EXT = '.pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx'

const fileIcon = (type) => {
  const t = type?.toUpperCase()
  if (t === 'PDF') return '📄'
  if (['JPG','JPEG','PNG','WEBP'].includes(t)) return '🖼️'
  if (t === 'DOCX') return '📝'
  if (t === 'XLSX') return '📊'
  return '📁'
}

export default function NewFileModal({ messageId = null, onClose, onCreated }) {
  const { user } = useAuth()
  const [files, setFiles] = useState([])
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const dropRef = useRef(null)

  const addFiles = (incoming) => {
    const valid = Array.from(incoming).filter(f => ALLOWED_TYPES.includes(f.type))
    const invalid = Array.from(incoming).filter(f => !ALLOWED_TYPES.includes(f.type))
    if (invalid.length > 0) alert(`Skipped ${invalid.length} unsupported file(s). Only PDF, images, Word, Excel allowed.`)
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size))
      return [...prev, ...valid.filter(f => !existing.has(f.name + f.size))]
    })
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = () => setDragging(false)

  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i))

  const handleUpload = async () => {
    if (files.length === 0) return
    setUploading(true)
    setUploadError('')
    let done = 0
    const failed = []
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage.from('files').upload(path, file)
      if (uploadError) {
        failed.push(file.name)
        done++
        setProgress(Math.round((done / files.length) * 100))
        continue
      }
      const { data: { publicUrl } } = supabase.storage.from('files').getPublicUrl(path)
      const { data: fileRow } = await supabase.from('files').insert({
        ...(messageId ? { message_id: messageId } : {}),
        filename: file.name,
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
      done++
      setProgress(Math.round((done / files.length) * 100))
    }
    setUploading(false)
    if (failed.length > 0) {
      setUploadError(`Failed to upload: ${failed.join(', ')}`)
    } else {
      onCreated()
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
    }} onClick={onClose}>
      <div style={{
        backgroundColor: '#fff', borderRadius: '10px', width: '500px', maxWidth: '95vw',
        padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
      }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>Upload Files</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af' }}>✕</button>
        </div>

        {/* Drop zone */}
        <div
          ref={dropRef}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{
            border: `2px dashed ${dragging ? '#111' : '#d1d5db'}`,
            borderRadius: '8px', padding: '32px 16px', textAlign: 'center',
            backgroundColor: dragging ? '#f9fafb' : '#fff',
            transition: 'all 0.15s', marginBottom: '16px', cursor: 'pointer'
          }}
          onClick={() => document.getElementById('file-input-modal').click()}
        >
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>📂</div>
          <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
            Drag & drop files here, or <span style={{ color: '#111', fontWeight: '600' }}>click to browse</span>
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#9ca3af' }}>
            PDF, images, Word, Excel
          </p>
          <input id="file-input-modal" type="file" multiple style={{ display: 'none' }}
            accept={ALLOWED_EXT} onChange={e => addFiles(e.target.files)} />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div style={{ marginBottom: '20px', maxHeight: '200px', overflowY: 'auto' }}>
            {files.map((f, i) => {
              const ext = f.name.split('.').pop().toUpperCase()
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px',
                  backgroundColor: '#f9fafb', borderRadius: '6px', marginBottom: '4px',
                  border: '1px solid #f3f4f6'
                }}>
                  <span style={{ fontSize: '16px', flexShrink: 0 }}>{fileIcon(ext)}</span>
                  <span style={{ flex: 1, fontSize: '13px', color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <span style={{ fontSize: '11px', color: '#9ca3af', flexShrink: 0 }}>{(f.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => removeFile(i)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#9ca3af', fontSize: '14px', padding: '0 2px', flexShrink: 0
                  }}>✕</button>
                </div>
              )
            })}
          </div>
        )}

        {/* Progress */}
        {uploading && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ height: '4px', backgroundColor: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', backgroundColor: '#111', width: `${progress}%`, transition: 'width 0.2s' }} />
            </div>
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px', textAlign: 'center' }}>
              Uploading... {progress}%
            </p>
          </div>
        )}

        {uploadError && (
          <p style={{ fontSize: '12px', color: '#ef4444', marginBottom: '12px' }}>{uploadError}</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onClose} disabled={uploading} style={{
            padding: '8px 16px', backgroundColor: '#fff', border: '1px solid #d1d5db',
            borderRadius: '6px', fontSize: '13px', cursor: 'pointer', color: '#374151',
            opacity: uploading ? 0.5 : 1
          }}>Cancel</button>
          <button onClick={handleUpload} disabled={uploading || files.length === 0} style={{
            padding: '8px 20px', backgroundColor: '#111', color: '#fff',
            border: 'none', borderRadius: '6px', fontSize: '13px',
            cursor: uploading || files.length === 0 ? 'not-allowed' : 'pointer',
            opacity: uploading || files.length === 0 ? 0.5 : 1
          }}>
            {uploading ? `Uploading ${progress}%` : `Upload ${files.length > 0 ? `(${files.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}