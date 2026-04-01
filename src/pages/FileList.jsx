import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import NewFileModal from '../components/NewFileModal'
import NewFolderModal from '../components/NewFolderModal'
import FileIcon from '../components/FileIcon'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { LayoutGrid, List, Pin, Archive, Folder, FolderOpen, ChevronDown, ChevronRight, FolderPlus } from 'lucide-react'

const STATUS_CLS = {
  active:   'text-emerald-700 bg-emerald-50 border-emerald-200',
  complete: 'text-amber-700  bg-amber-50  border-amber-200',
  void:     'text-red-500    bg-red-50    border-red-200',
}

const TAB_TO_FOLDER_STATUS = {
  active:   'active',
  complete: 'archived',
  all:      null,
}

export default function FileList() {
  const [files, setFiles] = useState([])
  const [folders, setFolders] = useState([])
  const [tab, setTab] = useState('active')
  const [view, setView] = useState('grid')
  const [showFileModal, setShowFileModal] = useState(false)
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState(new Set())
  const [dragOverFolderId, setDragOverFolderId] = useState(null)
  const [draggingFileId, setDraggingFileId] = useState(null)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: filesData }, { data: foldersData }] = await Promise.all([
      supabase
        .from('files')
        .select(`id, filename, file_type, file_url, status, pinned, folder_id, created_at,
          created_by_user:users!files_created_by_fkey(display_name, avatar_url)`)
        .is('message_id', null)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('file_folders')
        .select('id, name, status, created_at, created_by_user:users!file_folders_created_by_fkey(display_name)')
        .order('created_at', { ascending: false })
    ])
    setFiles(filesData || [])
    setFolders(foldersData || [])
  }

  const filesByFolder = useMemo(() => {
    const map = {}
    files.forEach(f => {
      if (f.folder_id) {
        if (!map[f.folder_id]) map[f.folder_id] = []
        map[f.folder_id].push(f)
      }
    })
    return map
  }, [files])

  const standaloneFiles = useMemo(() => files.filter(f => !f.folder_id), [files])

  const visibleFolders = useMemo(() => {
    if (tab === 'void') return []
    if (tab === 'all') return folders
    const folderStatus = TAB_TO_FOLDER_STATUS[tab]
    return folders.filter(f => f.status === folderStatus)
  }, [folders, tab])

  const filteredStandalone = useMemo(() => {
    if (tab === 'all') return standaloneFiles
    return standaloneFiles.filter(f => f.status === (tab === 'complete' ? 'complete' : tab))
  }, [standaloneFiles, tab])

  const tabCount = (t) => {
    if (t === 'void') return standaloneFiles.filter(f => f.status === 'void').length
    if (t === 'all') return standaloneFiles.length + folders.length
    if (t === 'active') return standaloneFiles.filter(f => f.status === 'active').length + folders.filter(f => f.status === 'active').length
    if (t === 'complete') return standaloneFiles.filter(f => f.status === 'complete').length + folders.filter(f => f.status === 'archived').length
    return 0
  }

  const defaultFolderStatus = tab === 'complete' ? 'archived' : 'active'

  // Only show Upload on active tab; New Folder on active + archived
  const showUpload = tab === 'active'
  const showNewFolder = tab !== 'void'

  const updateStatus = async (e, file, status) => {
    e.stopPropagation()
    const update = { status }
    if (status === 'complete' || status === 'void') update.folder_id = null
    await supabase.from('files').update(update).eq('id', file.id)
    await supabase.from('activity_log').insert({
      entity_type: 'file', entity_id: file.id,
      action: status, performed_by: user.id
    })
    fetchAll()
  }

  const togglePin = async (e, file) => {
    e.stopPropagation()
    await supabase.from('files').update({ pinned: !file.pinned }).eq('id', file.id)
    await supabase.from('activity_log').insert({
      entity_type: 'file', entity_id: file.id,
      action: file.pinned ? 'unpinned' : 'pinned', performed_by: user.id
    })
    fetchAll()
  }

  const toggleFolderExpand = (e, folderId) => {
    e.stopPropagation()
    setExpandedFolders(prev => {
      const next = new Set(prev)
      next.has(folderId) ? next.delete(folderId) : next.add(folderId)
      return next
    })
  }

  const handleDragStart = (e, fileId) => {
    e.dataTransfer.setData('fileId', fileId)
    setDraggingFileId(fileId)
  }

  const handleDragEnd = () => {
    setDraggingFileId(null)
    setDragOverFolderId(null)
  }

  const handleDragOver = (e, folderId) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverFolderId(folderId)
  }

  const handleDragLeave = () => {
    setDragOverFolderId(null)
  }

  const handleDropOnFolder = async (e, folderId) => {
    e.preventDefault()
    e.stopPropagation()
    const fileId = e.dataTransfer.getData('fileId')
    setDragOverFolderId(null)
    setDraggingFileId(null)
    if (!fileId) return
    await supabase.from('files').update({ folder_id: folderId }).eq('id', fileId)
    await supabase.from('activity_log').insert({
      entity_type: 'file', entity_id: fileId,
      action: 'moved_to_folder', performed_by: user.id
    })
    fetchAll()
  }

  const ActionButtons = ({ f }) => (
    <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
      {f.status !== 'void' && (
        <button
          onClick={e => togglePin(e, f)}
          className={`text-xs px-2 py-1 border rounded cursor-pointer transition-colors ${
            f.pinned
              ? 'border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100'
              : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
          }`}
        >
          {f.pinned ? 'Unpin' : 'Pin'}
        </button>
      )}
      {f.status === 'active' && (
        <button
          onClick={e => updateStatus(e, f, 'complete')}
          title="Archive"
          className="text-gray-300 hover:text-amber-500 cursor-pointer bg-transparent border-none p-1 leading-none transition-colors"
        >
          <Archive size={14} strokeWidth={1.8} />
        </button>
      )}
      {f.status !== 'void' && (
        <button
          onClick={e => updateStatus(e, f, 'void')}
          className="text-xs px-2 py-1 border border-red-200 rounded bg-white text-red-400 cursor-pointer hover:bg-red-50 transition-colors"
        >
          Void
        </button>
      )}
    </div>
  )

  const FolderGridCard = ({ folder }) => {
    const isDragOver = dragOverFolderId === folder.id
    const folderFiles = filesByFolder[folder.id] || []
    return (
      <div
        onDragOver={e => handleDragOver(e, folder.id)}
        onDragLeave={handleDragLeave}
        onDrop={e => handleDropOnFolder(e, folder.id)}
        onClick={() => navigate(`/home/files/folders/${folder.id}`)}
        className={`relative bg-white border rounded-xl px-3 pt-3.5 pb-2.5 cursor-pointer text-center transition-all ${
          isDragOver
            ? 'border-blue-400 bg-blue-50 shadow-sm scale-[1.02]'
            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
        }`}
      >
        <div className="flex justify-center mb-2.5">
          <Folder size={32} className="text-blue-400" strokeWidth={1.5} />
        </div>
        <div className="text-[11px] font-medium leading-snug break-words line-clamp-2 mb-1 text-gray-800">
          {folder.name}
        </div>
        <div className="text-[10px] text-gray-400">
          {folderFiles.length} {folderFiles.length === 1 ? 'file' : 'files'}
        </div>
        {isDragOver && (
          <div className="absolute inset-0 rounded-xl flex items-center justify-center pointer-events-none">
            <span className="text-xs font-medium text-blue-600 bg-blue-50/90 px-2 py-1 rounded-md border border-blue-200">
              Drop to add
            </span>
          </div>
        )}
      </div>
    )
  }

  const FolderListRow = ({ folder }) => {
    const isDragOver = dragOverFolderId === folder.id
    const isExpanded = expandedFolders.has(folder.id)
    const folderFiles = filesByFolder[folder.id] || []
    return (
      <div
        onDragOver={e => handleDragOver(e, folder.id)}
        onDragLeave={handleDragLeave}
        onDrop={e => handleDropOnFolder(e, folder.id)}
        className={`transition-colors ${isDragOver ? 'bg-blue-50' : ''}`}
      >
        <div
          className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => navigate(`/home/files/folders/${folder.id}`)}
        >
          <div className="shrink-0">
            {isExpanded
              ? <FolderOpen size={18} className="text-blue-400" strokeWidth={1.5} />
              : <Folder size={18} className="text-blue-400" strokeWidth={1.5} />
            }
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-900">{folder.name}</span>
            <span className="text-xs text-gray-400 ml-2">
              {folderFiles.length} {folderFiles.length === 1 ? 'file' : 'files'}
            </span>
          </div>
          {isDragOver && (
            <span className="text-xs text-blue-500 font-medium shrink-0 mr-1">Drop to add</span>
          )}
          <button
            onClick={e => toggleFolderExpand(e, folder.id)}
            title={isExpanded ? 'Collapse' : 'Expand'}
            className="p-1 text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer shrink-0"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>

        {isExpanded && (
          <div className="bg-gray-50/60 border-b border-gray-100">
            {folderFiles.length === 0 ? (
              <div className="pl-10 pr-4 py-3">
                <span className="text-xs text-gray-400">No files in this folder</span>
              </div>
            ) : folderFiles.map(f => (
              <div
                key={f.id}
                onClick={() => navigate(`/home/files/${f.id}`, { state: { fileIds: folderFiles.map(x => x.id) } })}
                className="flex items-center gap-3 pl-10 pr-4 py-2.5 cursor-pointer hover:bg-gray-100/60 transition-colors"
              >
                <FileIcon type={f.file_type} size="sm" />
                <span className="flex-1 text-sm text-gray-800 truncate">{f.filename}</span>
                <span className="text-xs text-gray-400 uppercase shrink-0">{f.file_type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const isEmpty = filteredStandalone.length === 0 && visibleFolders.length === 0

  return (
    <>
      <div className="px-6 py-6 max-w-[900px] mx-auto">

        {/* Header — just back + title */}
        <div className="relative flex items-center justify-center mb-5">
          <button
            onClick={() => navigate('/home')}
            className="absolute left-0 text-sm text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer p-0 transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-sm font-semibold text-gray-900 m-0">Files</h1>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="w-full mb-3">
            {['active', 'complete', 'void', 'all'].map(t => (
              <TabsTrigger key={t} value={t} className="flex-1 capitalize gap-1.5">
                {t === 'complete' ? 'Archived' : t}
                <span className="text-[11px] opacity-60 tabular-nums">{tabCount(t)}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Toolbar — below tabs, context-aware */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {showNewFolder && (
                <button
                  onClick={() => setShowFolderModal(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <FolderPlus size={13} /> New Folder
                </button>
              )}
              {showUpload && (
                <button
                  onClick={() => setShowFileModal(true)}
                  className="text-xs px-3 py-1.5 bg-gray-900 text-white border-none rounded-md cursor-pointer hover:bg-gray-700 transition-colors"
                >
                  + Upload
                </button>
              )}
            </div>
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setView('grid')}
                className={`p-2 cursor-pointer border-none transition-colors ${view === 'grid' ? 'bg-gray-900 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}
                title="Grid view"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setView('list')}
                className={`p-2 cursor-pointer border-none transition-colors ${view === 'list' ? 'bg-gray-900 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}
                title="List view"
              >
                <List size={14} />
              </button>
            </div>
          </div>

          {['active', 'complete', 'void', 'all'].map(t => (
            <TabsContent key={t} value={t}>
              {isEmpty ? (
                <div className="bg-white border border-gray-200 rounded-xl py-12 text-center text-sm text-gray-400">
                  No files
                </div>
              ) : view === 'grid' ? (
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
                  {visibleFolders.map(folder => (
                    <FolderGridCard key={folder.id} folder={folder} />
                  ))}
                  {filteredStandalone.map(f => (
                    <div
                      key={f.id}
                      draggable={f.status !== 'void'}
                      onDragStart={e => handleDragStart(e, f.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => navigate(`/home/files/${f.id}`, { state: { fileIds: filteredStandalone.map(x => x.id) } })}
                      className={`relative bg-white border border-gray-200 rounded-xl px-3 pt-3.5 pb-2.5 cursor-pointer text-center hover:border-gray-300 hover:shadow-sm transition-all select-none ${
                        f.status === 'void' ? 'opacity-45' : ''
                      } ${draggingFileId === f.id ? 'opacity-50 scale-95' : ''}`}
                    >
                      {f.pinned && (
                        <span className="absolute top-2 right-2 text-amber-400">
                          <Pin size={11} strokeWidth={2} />
                        </span>
                      )}
                      <div className="flex justify-center mb-2.5">
                        <FileIcon type={f.file_type} size="lg" />
                      </div>
                      <div className={`text-[11px] font-medium leading-snug break-words line-clamp-2 mb-1.5 ${f.status === 'void' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                        {f.filename}
                      </div>
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide">{f.file_type}</span>
                        {f.status !== 'active' && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border ${STATUS_CLS[f.status]}`}>
                            {f.status === 'complete' ? 'archived' : f.status}
                          </span>
                        )}
                      </div>
                      {f.status === 'active' && (
                        <button
                          onClick={e => updateStatus(e, f, 'complete')}
                          title="Archive"
                          className="absolute bottom-2 right-2.5 text-gray-300 hover:text-amber-500 cursor-pointer bg-transparent border-none p-0 leading-none transition-colors"
                        >
                          <Archive size={16} strokeWidth={1.8} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {visibleFolders.map(folder => (
                    <FolderListRow key={folder.id} folder={folder} />
                  ))}
                  {visibleFolders.length > 0 && filteredStandalone.length > 0 && (
                    <div className="h-px bg-gray-100 mx-4" />
                  )}
                  {filteredStandalone.map(f => (
                    <div
                      key={f.id}
                      draggable={f.status !== 'void'}
                      onDragStart={e => handleDragStart(e, f.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => navigate(`/home/files/${f.id}`, { state: { fileIds: filteredStandalone.map(x => x.id) } })}
                      className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors last:border-b-0 select-none ${
                        f.status === 'void' ? 'opacity-45' : ''
                      } ${draggingFileId === f.id ? 'opacity-50' : ''}`}
                    >
                      <FileIcon type={f.file_type} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {f.pinned && <Pin size={10} className="text-amber-400 shrink-0" strokeWidth={2} />}
                          <span className={`text-sm font-medium truncate ${f.status === 'void' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                            {f.filename}
                          </span>
                          {f.status !== 'active' && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${STATUS_CLS[f.status]}`}>
                              {f.status === 'complete' ? 'archived' : f.status}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">{f.created_by_user?.display_name}</span>
                          <span className="text-xs text-gray-300">·</span>
                          <span className="text-xs text-gray-400">
                            {new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </div>
                      <ActionButtons f={f} />
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {showFileModal && (
        <NewFileModal
          onClose={() => setShowFileModal(false)}
          onCreated={() => { setShowFileModal(false); fetchAll() }}
        />
      )}

      {showFolderModal && (
        <NewFolderModal
          defaultStatus={defaultFolderStatus}
          onClose={() => setShowFolderModal(false)}
          onCreated={() => { setShowFolderModal(false); fetchAll() }}
        />
      )}
    </>
  )
}
