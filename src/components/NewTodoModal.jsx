import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export default function NewTodoModal({ users, onClose, onCreated }) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!text.trim() || !assignedTo) return
    setSubmitting(true)
    const { data: todo } = await supabase
      .from('todos')
      .insert({ text: text.trim(), assigned_to: assignedTo, created_by: user.id, note: note.trim() || null })
      .select().single()
    if (todo) {
      await supabase.from('activity_log').insert({
        entity_type: 'todo', entity_id: todo.id,
        action: 'created', performed_by: user.id
      })
    }
    setSubmitting(false)
    onCreated()
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="w-[420px] max-w-[95vw]">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">New Todo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Task <span className="text-red-500">*</span>
            </label>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full px-2.5 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Assign to <span className="text-red-500">*</span>
            </label>
            <select
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              className="w-full px-2.5 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 text-gray-700"
            >
              <option value="">Select person...</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.display_name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Note <span className="text-gray-400 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Any additional context..."
              rows={2}
              className="w-full px-2.5 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="text-sm">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !text.trim() || !assignedTo}
              className="text-sm bg-gray-900 hover:bg-gray-800 text-white"
            >
              {submitting ? 'Adding...' : 'Add Todo'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
