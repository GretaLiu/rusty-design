import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Folder } from 'lucide-react'

const ALLOWED_TYPES = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]

const ALLOWED_EXT = '.pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx'

const fileIcon = (type) => {
  const t = type?.toUpperCase()
  if (t === 'PDF') return '📄'
  if (['JPG', 'JPEG', 'PNG', 'WEBP'].includes(t)) return '🖼️'
  if (t === 'DOCX') return '📝'
  if (t === 'XLSX') return '📊'
  return '📁'
}

export default function NewFileModal({ messageId = null, allowFolder = true, onClose, onCreated }) {
  const { user } = useAuth()
  const [files, setFiles] = useState([])
  const [folderName, setFolderName] = useState(null) // non-null = folder upload mode
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

  const handleFolderInput = (e) => {
    const incoming = Array.from(e.target.files)
    if (incoming.length === 0) return
    // Extract folder name from the first file's webkitRelativePath
    const firstPath = incoming[0].webkitRelativePath
    const name = firstPath ? firstPath.split('/')[0] : 'Uploaded Folder'
    setFolderName(name)
    addFiles(incoming)
  }

  const clearFolderMode = () => {
    setFolderName(null)
    setFiles([])
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = () => setDragging(false)

  const removeFile = (i) => {
    setFiles(prev => {
      const next = prev.filter((_, idx) => idx !== i)
      if (next.length === 0) setFolderName(null)
      return next
    })
  }

  const handleUpload = async () => {
    if (files.length === 0) return
    setUploading(true)
    setUploadError('')

    let folderId = null

    // If folder upload, create the folder record first
    if (folderName) {
      const { data: folderRow, error: folderErr } = await supabase
        .from('file_folders')
        .insert({ name: folderName, created_by: user.id })
        .select()
        .single()
      if (folderErr || !folderRow) {
        setUploadError('Failed to create folder record.')
        setUploading(false)
        return
      }
      folderId = folderRow.id
      await supabase.from('activity_log').insert({
        entity_type: 'folder', entity_id: folderId,
        action: 'created', performed_by: user.id
      })
    }

    let done = 0
    const failed = []
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('files').upload(path, file)
      if (uploadErr) {
        failed.push(file.name)
        done++
        setProgress(Math.round((done / files.length) * 100))
        continue
      }
      const { data: { publicUrl } } = supabase.storage.from('files').getPublicUrl(path)
      const { data: fileRow } = await supabase.from('files').insert({
        ...(messageId ? { message_id: messageId } : {}),
        ...(folderId ? { folder_id: folderId } : {}),
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
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="w-[500px] max-w-[95vw] flex flex-col max-h-[85vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base font-bold">Upload Files</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-1 min-h-0 flex-1">

          {/* Folder mode banner */}
          {folderName && (
            <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <Folder size={14} className="text-amber-500 shrink-0" />
              <span className="text-xs text-amber-800 flex-1">
                Uploading as folder: <span className="font-semibold">{folderName}</span>
              </span>
              <button
                onClick={clearFolderMode}
                className="text-amber-400 hover:text-amber-600 text-xs bg-transparent border-none cursor-pointer"
              >
                Cancel folder
              </button>
            </div>
          )}

          {/* Drop zone (only shown when not in folder mode) */}
          {!folderName && (
            <div
              ref={dropRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => document.getElementById('file-input-modal').click()}
              className={`shrink-0 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragging ? 'border-gray-900 bg-gray-50' : 'border-gray-300 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="text-3xl mb-2">📂</div>
              <p className="text-sm text-gray-500">
                Drag &amp; drop files here, or{' '}
                <span className="text-gray-900 font-semibold">click to browse</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">PDF, images, Word, Excel</p>
              <input
                id="file-input-modal"
                type="file"
                multiple
                className="hidden"
                accept={ALLOWED_EXT}
                onChange={e => addFiles(e.target.files)}
              />
            </div>
          )}

          {/* Upload folder button (only shown when not in folder mode and no files yet) */}
          {allowFolder && !folderName && files.length === 0 && (
            <div className="shrink-0 flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400 shrink-0">or</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
          )}
          {allowFolder && !folderName && files.length === 0 && (
            <button
              onClick={() => document.getElementById('folder-input-modal').click()}
              className="shrink-0 flex items-center justify-center gap-2 border border-gray-200 rounded-lg py-3 text-sm text-gray-600 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <Folder size={15} className="text-amber-400" />
              Upload a folder
              <input
                id="folder-input-modal"
                type="file"
                multiple
                webkitdirectory=""
                className="hidden"
                onChange={handleFolderInput}
              />
            </button>
          )}

          {/* File list */}
          {files.length > 0 && (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5">
              {files.map((f, i) => {
                const ext = f.name.split('.').pop().toUpperCase()
                return (
                  <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-md border border-gray-100">
                    <span className="text-base shrink-0">{fileIcon(ext)}</span>
                    <span className="flex-1 text-sm text-gray-900 truncate">{f.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                    <button
                      onClick={() => removeFile(i)}
                      className="text-gray-400 hover:text-gray-600 text-sm leading-none shrink-0 cursor-pointer bg-transparent border-none"
                    >✕</button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Progress bar */}
          {uploading && (
            <div className="shrink-0 space-y-1.5">
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gray-900 transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 text-center">Uploading... {progress}%</p>
            </div>
          )}

          {uploadError && (
            <p className="shrink-0 text-xs text-red-500">{uploadError}</p>
          )}

          <div className="shrink-0 flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={uploading} className="text-sm">
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
              className="text-sm bg-gray-900 hover:bg-gray-800 text-white"
            >
              {uploading
                ? `Uploading ${progress}%`
                : folderName
                  ? `Upload folder (${files.length} file${files.length !== 1 ? 's' : ''})`
                  : `Upload${files.length > 0 ? ` (${files.length})` : ''}`
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
