import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import FileIcon from '../components/FileIcon'
import { Folder, Pin, Archive, LogOut } from 'lucide-react'

export default function FolderDetail() {
  const { folderId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [folder, setFolder] = useState(null)
  const [files, setFiles] = useState([])
  const [view, setView] = useState('grid')
  const [showDismiss, setShowDismiss] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [dragOverTop, setDragOverTop] = useState(false)
  const [draggingFileId, setDraggingFileId] = useState(null)

  useEffect(() => { fetchAll() }, [folderId])

  const fetchAll = async () => {
    const [{ data: folderData }, { data: filesData }] = await Promise.all([
      supabase
        .from('file_folders')
        .select('id, name, status, created_at, created_by_user:users!file_folders_created_by_fkey(display_name, avatar_url)')
        .eq('id', folderId)
        .single(),
      supabase
        .from('files')
        .select(`id, filename, file_type, file_url, status, pinned, created_at,
          created_by_user:users!files_created_by_fkey(display_name, avatar_url)`)
        .eq('folder_id', folderId)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
    ])
    setFolder(folderData)
    setFiles(filesData || [])
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })

  const archiveFile = async (e, file) => {
    e.stopPropagation()
    await supabase.from('files').update({ status: 'complete', folder_id: null }).eq('id', file.id)
    await supabase.from('activity_log').insert({
      entity_type: 'file', entity_id: file.id,
      action: 'complete', performed_by: user.id
    })
    fetchAll()
  }

  const moveOut = async (fileId) => {
    await supabase.from('files').update({ folder_id: null }).eq('id', fileId)
    await supabase.from('activity_log').insert({
      entity_type: 'file', entity_id: fileId,
      action: 'moved_out_of_folder', performed_by: user.id
    })
    fetchAll()
  }

  const handleDismiss = async () => {
    setDismissing(true)
    await supabase.from('file_folders').delete().eq('id', folderId)
    await supabase.from('activity_log').insert({
      entity_type: 'folder', entity_id: folderId,
      action: 'dismissed', performed_by: user.id
    })
    navigate('/home/files')
  }

  const handleDragStart = (e, fileId) => {
    e.dataTransfer.setData('fileId', fileId)
    setDraggingFileId(fileId)
  }

  const handleDragEnd = () => {
    setDraggingFileId(null)
    setDragOverTop(false)
  }

  const handleDropTop = async (e) => {
    e.preventDefault()
    const fileId = e.dataTransfer.getData('fileId')
    setDragOverTop(false)
    setDraggingFileId(null)
    if (!fileId) return
    await moveOut(fileId)
  }

  if (!folder) return null

  return (
    <div className="max-w-[900px] mx-auto px-6 py-6">

      {/* Back */}
      <div className="relative flex items-center justify-center mb-5">
        <button
          onClick={() => navigate('/home/files')}
          className="absolute left-0 text-sm text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer p-0 transition-colors"
        >
          ← Back
        </button>
        <div className="flex items-center gap-2">
          <Folder size={15} className="text-blue-400" strokeWidth={1.5} />
          <h1 className="text-sm font-semibold text-gray-900 m-0">{folder.name}</h1>
        </div>
      </div>

      {/* Folder meta */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-400 m-0">
          {files.length} {files.length === 1 ? 'file' : 'files'}
          {' · '}Created by{' '}
          <span className="text-gray-600">{folder.created_by_user?.display_name}</span>
          {' · '}{formatDate(folder.created_at)}
        </p>
      </div>

      {/* Top-level drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOverTop(true) }}
        onDragLeave={() => setDragOverTop(false)}
        onDrop={handleDropTop}
        className={`flex items-center gap-2 px-4 py-2.5 mb-4 border-2 border-dashed rounded-xl text-xs font-medium transition-all ${
          dragOverTop
            ? 'border-blue-400 bg-blue-50 text-blue-600'
            : 'border-gray-200 text-gray-400 bg-white'
        }`}
      >
        <LogOut size={12} className={dragOverTop ? 'text-blue-500' : 'text-gray-300'} />
        {dragOverTop ? 'Release to move to top level' : 'Drag a file here to remove from folder'}
      </div>

      {/* Files grid */}
      {files.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl py-12 text-center text-sm text-gray-400">
          No files in this folder
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
          {files.map(f => (
            <div
              key={f.id}
              draggable
              onDragStart={e => handleDragStart(e, f.id)}
              onDragEnd={handleDragEnd}
              onClick={() => navigate(`/home/files/${f.id}`, { state: { fileIds: files.map(x => x.id) } })}
              className={`relative bg-white border border-gray-200 rounded-xl px-3 pt-3.5 pb-2.5 cursor-pointer text-center hover:border-gray-300 hover:shadow-sm transition-all select-none ${
                draggingFileId === f.id ? 'opacity-50 scale-95' : ''
              }`}
            >
              {f.pinned && (
                <span className="absolute top-2 right-2 text-amber-400">
                  <Pin size={11} strokeWidth={2} />
                </span>
              )}
              <div className="flex justify-center mb-2.5">
                <FileIcon type={f.file_type} size="lg" />
              </div>
              <div className="text-[11px] font-medium leading-snug break-words line-clamp-2 mb-1 text-gray-800">
                {f.filename}
              </div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">
                {f.file_type}
              </div>
              {/* Archive quick action — bottom right, only on hover area */}
              <button
                onClick={e => archiveFile(e, f)}
                title="Archive file"
                className="absolute bottom-2 right-2.5 text-gray-300 hover:text-amber-500 cursor-pointer bg-transparent border-none p-0 leading-none transition-colors"
              >
                <Archive size={14} strokeWidth={1.8} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Danger zone — Dismiss folder */}
      <div className="mt-12 border-t border-red-100 pt-6">
        <h3 className="text-xs font-semibold text-red-500 mb-1 mt-0">Danger Zone</h3>
        <p className="text-xs text-gray-400 mb-4">
          Remove this folder. Files inside will return to the top level and will not be deleted.
        </p>
        {!showDismiss ? (
          <button
            onClick={() => setShowDismiss(true)}
            className="text-xs px-3.5 py-1.5 bg-white text-red-400 border border-red-200 rounded-md cursor-pointer hover:bg-red-50 transition-colors"
          >
            Dismiss folder
          </button>
        ) : (
          <div className="border border-red-200 rounded-lg p-4 bg-red-50">
            <p className="text-xs text-gray-600 mb-3">
              This folder will be removed.{' '}
              {files.length > 0
                ? <><strong>{files.length} {files.length === 1 ? 'file' : 'files'}</strong> inside will return to the top level.</>
                : 'The folder is currently empty.'
              }
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDismiss}
                disabled={dismissing}
                className={`text-xs px-3.5 py-1.5 bg-red-500 text-white border-none rounded-md cursor-pointer hover:bg-red-600 transition-colors ${dismissing ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {dismissing ? 'Dismissing…' : 'Dismiss folder'}
              </button>
              <button
                onClick={() => setShowDismiss(false)}
                className="text-xs px-3.5 py-1.5 bg-white text-gray-600 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
