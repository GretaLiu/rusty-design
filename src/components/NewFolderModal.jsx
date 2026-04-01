import { useState, useEffect, useRef } from 'react'
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

export default function NewFolderModal({ defaultStatus = 'active', onClose, onCreated }) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    setError('')
    const { data: folderRow, error: err } = await supabase
      .from('file_folders')
      .insert({ name: trimmed, status: defaultStatus, created_by: user.id })
      .select()
      .single()
    if (err || !folderRow) {
      setError('Failed to create folder. Please try again.')
      setSaving(false)
      return
    }
    await supabase.from('activity_log').insert({
      entity_type: 'folder', entity_id: folderRow.id,
      action: 'created', performed_by: user.id
    })
    setSaving(false)
    onCreated(folderRow)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleCreate()
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="w-[380px] max-w-[95vw]">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Folder size={16} className="text-blue-400" />
            New Folder
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-1">
          <div>
            <input
              ref={inputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Folder name"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400 box-border"
            />
            {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className={`px-2 py-0.5 rounded border text-[11px] ${
              defaultStatus === 'active'
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-amber-700 bg-amber-50 border-amber-200'
            }`}>
              {defaultStatus === 'active' ? 'Active' : 'Archived'}
            </span>
            <span>folder</span>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving} className="text-sm">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !name.trim()}
              className="text-sm bg-gray-900 hover:bg-gray-800 text-white"
            >
              {saving ? 'Creating…' : 'Create folder'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
