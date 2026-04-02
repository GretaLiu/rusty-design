import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import NewFileModal from '../components/NewFileModal'
import NewFolderModal from '../components/NewFolderModal'
import FileIcon from '../components/FileIcon'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { LayoutGrid, List, Pin, Archive, Folder, FolderOpen, ChevronDown, ChevronRight, FolderPlus, ExternalLink, CheckSquare, Search, X, Download } from 'lucide-react'

const STATUS_BADGE = {
  complete: 'text-amber-600 bg-amber-50',
  void:     'text-red-400   bg-red-50',
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
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
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

  const toggleSelectMode = () => {
    setSelectMode(prev => !prev)
    setSelectedIds(new Set())
  }

  const toggleSelect = (e, fileId) => {
    e.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(fileId) ? next.delete(fileId) : next.add(fileId)
      return next
    })
  }

  const OPENABLE = ['PDF', 'JPG', 'JPEG', 'PNG', 'WEBP']

  const openSelected = () => {
    const toOpen = files.filter(f => selectedIds.has(f.id) && OPENABLE.includes(f.file_type?.toUpperCase()))
    toOpen.forEach(f => {
      window.open(f.file_url, '_blank', 'noreferrer')
    })
  }

  const downloadSelected = async () => {
    const toDownload = files.filter(f => selectedIds.has(f.id))
    for (const f of toDownload) {
      const res = await fetch(f.file_url)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = f.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
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
          <div className="w-13 h-13 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
            <Folder size={26} className="text-blue-400" strokeWidth={1.5} />
          </div>
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

  const pinnedFiles = useMemo(() => filteredStandalone.filter(f => f.pinned), [filteredStandalone])
  const unpinnedFiles = useMemo(() => filteredStandalone.filter(f => !f.pinned), [filteredStandalone])

  const isEmpty = filteredStandalone.length === 0 && visibleFolders.length === 0

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return null
    return files.filter(f => f.filename.toLowerCase().includes(q))
  }, [searchQuery, files])

  const folderById = useMemo(() => {
    const map = {}
    folders.forEach(f => { map[f.id] = f })
    return map
  }, [folders])

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

        {/* Search bar */}
        <div className="relative mb-3">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search files…"
            className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-gray-400 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer p-0 leading-none"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Search results */}
        {searchResults && (
          <div className="mb-2">
            <p className="text-xs text-gray-400 mb-3">
              {searchResults.length === 0 ? 'No results' : `${searchResults.length} result${searchResults.length > 1 ? 's' : ''}`}
              {' '}for "<span className="text-gray-600">{searchQuery}</span>"
            </p>
            {searchResults.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {searchResults.map(f => {
                  const parentFolder = f.folder_id ? folderById[f.folder_id] : null
                  return (
                    <div
                      key={f.id}
                      onClick={() => navigate(`/home/files/${f.id}`)}
                      className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors last:border-b-0"
                    >
                      <FileIcon type={f.file_type} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {f.pinned && <Pin size={10} className="text-amber-400 shrink-0" strokeWidth={2} />}
                          <span className="text-sm font-medium text-gray-900 truncate">{f.filename}</span>
                          {STATUS_BADGE[f.status] && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[f.status]}`}>
                              {f.status === 'complete' ? 'archived' : f.status}
                            </span>
                          )}
                        </div>
                        {parentFolder && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Folder size={10} className="text-blue-400 shrink-0" strokeWidth={1.5} />
                            <span className="text-xs text-gray-400 truncate">{parentFolder.name}</span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 uppercase shrink-0">{f.file_type}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className={searchResults ? 'hidden' : 'w-full'}>
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
              {showUpload && !selectMode && (
                <button
                  onClick={() => setShowFileModal(true)}
                  className="text-xs px-3 py-1.5 bg-gray-900 text-white border-none rounded-md cursor-pointer hover:bg-gray-700 transition-colors"
                >
                  + Upload
                </button>
              )}
              {showNewFolder && !selectMode && (
                <button
                  onClick={() => setShowFolderModal(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <FolderPlus size={13} /> New Folder
                </button>
              )}
              <button
                onClick={toggleSelectMode}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
              >
                {selectMode ? <X size={13} /> : <CheckSquare size={13} />}
                {selectMode ? 'Cancel' : 'Select'}
              </button>
              {selectMode && selectedIds.size > 0 && (
                <>
                  <button
                    onClick={openSelected}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-900 text-white border-none rounded-md cursor-pointer hover:bg-gray-700 transition-colors font-medium"
                  >
                    <ExternalLink size={12} /> Open {selectedIds.size}
                  </button>
                  <button
                    onClick={downloadSelected}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-900 text-white border-none rounded-md cursor-pointer hover:bg-gray-700 transition-colors font-medium"
                  >
                    <Download size={12} /> Download {selectedIds.size}
                  </button>
                </>
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
                <div className="space-y-3">
                  {pinnedFiles.length > 0 && (
                    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
                      {pinnedFiles.map(f => (
                        <div
                          key={f.id}
                          draggable={!selectMode && f.status !== 'void'}
                          onDragStart={e => handleDragStart(e, f.id)}
                          onDragEnd={handleDragEnd}
                          onClick={e => selectMode ? toggleSelect(e, f.id) : navigate(`/home/files/${f.id}`, { state: { fileIds: filteredStandalone.map(x => x.id) } })}
                          className={`relative bg-white border rounded-xl px-3 pt-3.5 pb-2.5 cursor-pointer text-center hover:border-gray-300 hover:shadow-sm transition-all select-none ${
                            selectMode && selectedIds.has(f.id)
                              ? 'border-gray-900 ring-1 ring-gray-900'
                              : 'border-gray-200'
                          } ${draggingFileId === f.id ? 'opacity-50 scale-95' : ''}`}
                        >
                          {selectMode ? (
                            <span className={`absolute top-2 right-2 w-3.5 h-3.5 rounded border-2 flex items-center justify-center ${
                              selectedIds.has(f.id) ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-300'
                            }`}>
                              {selectedIds.has(f.id) && <span className="w-1.5 h-1.5 bg-white rounded-sm block" />}
                            </span>
                          ) : (
                            <span className="absolute top-2 right-2 text-amber-400">
                              <Pin size={11} strokeWidth={2} />
                            </span>
                          )}
                          <div className="flex justify-center mb-2.5">
                            <FileIcon type={f.file_type} size="lg" />
                          </div>
                          <div className="text-[11px] font-medium leading-snug break-words line-clamp-2 mb-1.5 text-gray-800">
                            {f.filename}
                          </div>
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            <span className="text-[10px] text-gray-400 uppercase tracking-wide">{f.file_type}</span>
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
                  )}
                  {pinnedFiles.length > 0 && (visibleFolders.length > 0 || unpinnedFiles.length > 0) && (
                    <div className="border-t border-gray-100" />
                  )}
                  {(visibleFolders.length > 0 || unpinnedFiles.length > 0) && (
                    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
                      {visibleFolders.map(folder => (
                        <FolderGridCard key={folder.id} folder={folder} />
                      ))}
                      {unpinnedFiles.map(f => (
                        <div
                          key={f.id}
                          draggable={!selectMode && f.status !== 'void'}
                          onDragStart={e => handleDragStart(e, f.id)}
                          onDragEnd={handleDragEnd}
                          onClick={e => selectMode ? toggleSelect(e, f.id) : navigate(`/home/files/${f.id}`, { state: { fileIds: filteredStandalone.map(x => x.id) } })}
                          className={`relative bg-white border rounded-xl px-3 pt-3.5 pb-2.5 cursor-pointer text-center hover:border-gray-300 hover:shadow-sm transition-all select-none ${
                            selectMode && selectedIds.has(f.id)
                              ? 'border-gray-900 ring-1 ring-gray-900'
                              : 'border-gray-200'
                          } ${f.status === 'void' ? 'opacity-45' : ''} ${draggingFileId === f.id ? 'opacity-50 scale-95' : ''}`}
                        >
                          {selectMode && (
                            <span className={`absolute top-2 right-2 w-3.5 h-3.5 rounded border-2 flex items-center justify-center ${
                              selectedIds.has(f.id) ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-300'
                            }`}>
                              {selectedIds.has(f.id) && <span className="w-1.5 h-1.5 bg-white rounded-sm block" />}
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
                            {STATUS_BADGE[f.status] && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${STATUS_BADGE[f.status]}`}>
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
                  )}
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
                      draggable={!selectMode && f.status !== 'void'}
                      onDragStart={e => handleDragStart(e, f.id)}
                      onDragEnd={handleDragEnd}
                      onClick={e => selectMode ? toggleSelect(e, f.id) : navigate(`/home/files/${f.id}`, { state: { fileIds: filteredStandalone.map(x => x.id) } })}
                      className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors last:border-b-0 select-none ${
                        selectMode && selectedIds.has(f.id) ? 'bg-gray-50' : ''
                      } ${f.status === 'void' ? 'opacity-45' : ''} ${draggingFileId === f.id ? 'opacity-50' : ''}`}
                    >
                      {selectMode && (
                        <span className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${
                          selectedIds.has(f.id) ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-300'
                        }`}>
                          {selectedIds.has(f.id) && <span className="w-1.5 h-1.5 bg-white rounded-sm block" />}
                        </span>
                      )}
                      <FileIcon type={f.file_type} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {f.pinned && <Pin size={10} className="text-amber-400 shrink-0" strokeWidth={2} />}
                          <span className={`text-sm font-medium truncate ${f.status === 'void' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                            {f.filename}
                          </span>
                          {STATUS_BADGE[f.status] && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[f.status]}`}>
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
                      {!selectMode && <ActionButtons f={f} />}
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
