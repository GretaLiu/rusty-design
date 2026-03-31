import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import NewFileModal from '../components/NewFileModal'
import FileIcon from '../components/FileIcon'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { LayoutGrid, List, Pin, Archive } from 'lucide-react'

const STATUS_CLS = {
  active:   'text-emerald-700 bg-emerald-50 border-emerald-200',
  complete: 'text-amber-700  bg-amber-50  border-amber-200',
  void:     'text-red-500    bg-red-50    border-red-200',
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

  const tabCount = (t) => t === 'all' ? files.length : files.filter(f => f.status === t).length

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

  return (
    <>
      <div className="px-6 py-6 max-w-[900px] mx-auto">

        {/* Header */}
        <div className="relative flex items-center justify-center mb-5">
          <button
            onClick={() => navigate('/home')}
            className="absolute left-0 text-sm text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer p-0 transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-sm font-semibold text-gray-900 m-0">Files</h1>
          <div className="absolute right-0 flex items-center gap-2">
            {/* View toggle */}
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
            <button
              onClick={() => setShowModal(true)}
              className="text-xs px-3 py-1.5 bg-gray-900 text-white border-none rounded-md cursor-pointer hover:bg-gray-700 transition-colors"
            >
              + Upload
            </button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="w-full mb-4">
            {['active', 'complete', 'void', 'all'].map(t => (
              <TabsTrigger key={t} value={t} className="flex-1 capitalize gap-1.5">
                {t === 'complete' ? 'Archived' : t}
                <span className="text-[11px] opacity-60 tabular-nums">{tabCount(t)}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {['active', 'complete', 'void', 'all'].map(t => (
            <TabsContent key={t} value={t}>
              {filtered.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl py-12 text-center text-sm text-gray-400">
                  No files
                </div>
              ) : view === 'grid' ? (
                /* ── Grid ── */
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
                  {filtered.map(f => (
                    <div
                      key={f.id}
                      onClick={() => navigate(`/home/files/${f.id}`, { state: { fileIds: filtered.map(x => x.id) } })}
                      className={`relative bg-white border border-gray-200 rounded-xl px-3 pt-3.5 pb-2.5 cursor-pointer text-center hover:border-gray-300 hover:shadow-sm transition-all ${f.status === 'void' ? 'opacity-45' : ''}`}
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
                /* ── List ── */
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {filtered.map(f => (
                    <div
                      key={f.id}
                      onClick={() => navigate(`/home/files/${f.id}`, { state: { fileIds: filtered.map(x => x.id) } })}
                      className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors last:border-b-0 ${f.status === 'void' ? 'opacity-45' : ''}`}
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

      {showModal && (
        <NewFileModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); fetchFiles() }}
        />
      )}
    </>
  )
}
