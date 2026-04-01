import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Pencil, X, Check, ChevronLeft, ChevronRight, Search, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const PAGE_SIZE = 100

const tableConfig = {
  ready: { label: 'Ready to Ship', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  pending: { label: 'Pending Return', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  clearance: { label: 'Clearance', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' }
}

const emptyRow = { product_sku: '', quantity: 0, location: '', notes: '' }

const inputStyle = {
  padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: '4px',
  fontSize: '12px', width: '100%', boxSizing: 'border-box'
}

function HistoryPanel({ tableName, externalSearch = '' }) {
  const [selectedDate, setSelectedDate] = useState(null)
  const [snapshot, setSnapshot] = useState([])
  const [availableDates, setAvailableDates] = useState([])

  useEffect(() => {
    fetchAvailableDates()
  }, [tableName])

  useEffect(() => {
    if (selectedDate) fetchSnapshot()
  }, [selectedDate, tableName])

  const fetchAvailableDates = async () => {
    const { data } = await supabase
      .from('inventory_history')
      .select('snapshot_date')
      .eq('table_name', tableName)
      .order('snapshot_date', { ascending: false })
    const dates = [...new Set((data || []).map(d => d.snapshot_date))]
    setAvailableDates(dates)
    if (dates.length > 0) setSelectedDate(dates[0])
  }

  const fetchSnapshot = async () => {
    const { data } = await supabase
      .from('inventory_history')
      .select('product_sku, product_name, quantity, location, notes')
      .eq('table_name', tableName)
      .eq('snapshot_date', selectedDate)
      .order('product_sku', { ascending: true })
    setSnapshot(data || [])
  }

  const currentIndex = availableDates.indexOf(selectedDate)
  const hasPrev = currentIndex < availableDates.length - 1
  const hasNext = currentIndex > 0

  const formatDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })

  const filtered = snapshot.filter(r => {
    if (!externalSearch.trim()) return true
    const q = externalSearch.toLowerCase()
    return (
      r.product_sku?.toLowerCase().includes(q) ||
      r.product_name?.toLowerCase().includes(q) ||
      r.location?.toLowerCase().includes(q) ||
      r.notes?.toLowerCase().includes(q)
    )
  })

  if (availableDates.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
        No snapshots yet. Snapshots are taken every day at midnight.
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
      {/* date nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => hasPrev && setSelectedDate(availableDates[currentIndex + 1])}
            disabled={!hasPrev}
            style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: '4px', cursor: hasPrev ? 'pointer' : 'not-allowed', color: hasPrev ? '#374151' : '#d1d5db', padding: '3px 6px', display: 'flex', alignItems: 'center', backgroundColor: '#fff' }}
          ><ChevronLeft size={13} /></button>

          <input type="date" value={selectedDate || ''}
            min={availableDates[availableDates.length - 1]}
            max={availableDates[0]}
            onChange={e => setSelectedDate(e.target.value)}
            style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '12px', cursor: 'pointer' }} />

          <button
            onClick={() => hasNext && setSelectedDate(availableDates[currentIndex - 1])}
            disabled={!hasNext}
            style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: '4px', cursor: hasNext ? 'pointer' : 'not-allowed', color: hasNext ? '#374151' : '#d1d5db', padding: '3px 6px', display: 'flex', alignItems: 'center', backgroundColor: '#fff' }}
          ><ChevronRight size={13} /></button>

          {selectedDate && (
            <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '4px' }}>
              {formatDate(selectedDate)}
            </span>
          )}
        </div>
        <span style={{ fontSize: '11px', color: '#9ca3af' }}>
          {filtered.length} SKUs · read-only
        </span>
      </div>

      {snapshot.length === 0 ? (
        <div className="py-5 text-center text-xs text-gray-400">No data for this date</div>
      ) : filtered.length === 0 ? (
        <div className="py-5 text-center text-xs text-gray-400">No results for &ldquo;{externalSearch}&rdquo;</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-[10px] font-semibold text-gray-400 uppercase w-[120px]">SKU</TableHead>
              <TableHead className="text-[10px] font-semibold text-gray-400 uppercase w-[200px]">PRODUCT NAME</TableHead>
              <TableHead className="text-[10px] font-semibold text-gray-400 uppercase text-right w-[60px]">QTY</TableHead>
              <TableHead className="text-[10px] font-semibold text-gray-400 uppercase w-[100px]">LOCATION</TableHead>
              <TableHead className="text-[10px] font-semibold text-gray-400 uppercase">NOTES</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row, i) => (
              <TableRow key={i}>
                <TableCell className="py-1.5 px-3 text-xs font-medium text-gray-900">{row.product_sku}</TableCell>
                <TableCell className="py-1.5 px-3 text-xs text-gray-700 max-w-[200px]">
                  <span className="truncate block" title={row.product_name || ''}>{row.product_name || '—'}</span>
                </TableCell>
                <TableCell className="py-1.5 px-3 text-xs font-bold text-gray-900 text-right">{row.quantity}</TableCell>
                <TableCell className="py-1.5 px-3 text-xs text-gray-500">{row.location || '—'}</TableCell>
                <TableCell className="py-1.5 px-3 text-xs text-gray-500">{row.notes || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

// ─── Ready to Ship table: paginated bulk-edit mode ───────────────────────────
function ReadyTable() {
  const { user } = useAuth()
  const config = tableConfig.ready
  const dbTable = 'inventory_ready'

  const [rows, setRows] = useState([])
  const [page, setPage] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [editDraft, setEditDraft] = useState({})    // { [id]: { quantity, product_name, location, notes } }
  const originalRef = useRef({})                    // 进入编辑时的原始值，用于判断是否有改动
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [search, setSearch] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [unsavedWarning, setUnsavedWarning] = useState(false)
  const pendingPageRef = useRef(null)

  useEffect(() => { fetchRows() }, [])

  const fetchRows = async () => {
    const { data } = await supabase
      .from(dbTable)
      .select(`id, product_sku, product_name, quantity, location, notes, last_updated_at,
        last_updated_by_user:users!${dbTable}_last_updated_by_fkey(display_name, avatar_url)`)
      .order('product_sku', { ascending: true })
    setRows(data || [])
  }

  const filtered = rows.filter(r => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      r.product_sku?.toLowerCase().includes(q) ||
      r.product_name?.toLowerCase().includes(q) ||
      r.location?.toLowerCase().includes(q) ||
      r.notes?.toLowerCase().includes(q)
    )
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const today = new Date().toDateString()
  const isToday = (dateStr) => dateStr && new Date(dateStr).toDateString() === today

  const enterEditMode = () => {
    const draft = {}
    const original = {}
    pageRows.forEach(r => {
      const vals = { quantity: r.quantity, product_name: r.product_name || '', location: r.location || '', notes: r.notes || '' }
      draft[r.id] = { ...vals }
      original[r.id] = { ...vals }
    })
    originalRef.current = original
    setEditDraft(draft)
    setIsEditing(true)
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setEditDraft({})
    originalRef.current = {}
  }

  const isDirty = (id, vals) => {
    const orig = originalRef.current[id]
    if (!orig) return false
    return (
      String(parseInt(vals.quantity) || 0) !== String(parseInt(orig.quantity) || 0) ||
      (vals.product_name || '') !== (orig.product_name || '') ||
      (vals.location || '') !== (orig.location || '') ||
      (vals.notes || '') !== (orig.notes || '')
    )
  }

  const saveEdit = async () => {
    setSaving(true)
    const now = new Date().toISOString()
    const updates = Object.entries(editDraft)
      .filter(([id, vals]) => isDirty(id, vals))
      .map(([id, vals]) =>
        supabase.from(dbTable).update({
          quantity: parseInt(vals.quantity) || 0,
          product_name: vals.product_name,
          location: vals.location,
          notes: vals.notes,
          last_updated_by: user.id,
          last_updated_at: now
        }).eq('id', id)
      )
    await Promise.all(updates)
    setSaving(false)
    setIsEditing(false)
    setEditDraft({})
    originalRef.current = {}
    fetchRows()
  }

  const tryChangePage = (newPage) => {
    if (isEditing) {
      pendingPageRef.current = newPage
      setUnsavedWarning(true)
      return
    }
    setPage(newPage)
  }

  const confirmDiscardAndChangePage = () => {
    cancelEdit()
    setPage(pendingPageRef.current)
    pendingPageRef.current = null
    setUnsavedWarning(false)
  }

  const setDraftField = (id, field, value) => {
    setEditDraft(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  const exportToExcel = () => {
    const data = filtered.map(r => ({
      SKU: r.product_sku,
      'Product Name': r.product_name || '',
      Quantity: r.quantity,
      Location: r.location || '',
      Notes: r.notes || '',
      'Last Updated': r.last_updated_at
        ? new Date(r.last_updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '',
      'Updated By': r.last_updated_by_user?.display_name || ''
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ready to Ship')
    const date = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `ready-to-ship-${date}.xlsx`)
  }

  return (
    <>
      {/* toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <span style={{
            fontSize: '12px', fontWeight: '600', padding: '2px 9px', whiteSpace: 'nowrap',
            backgroundColor: config.bg, color: config.color,
            border: `1px solid ${config.border}`, borderRadius: '20px'
          }}>{config.label}</span>
          <span style={{ fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
            {showHistory ? 'History' : `${rows.length} SKUs`}
          </span>

          <div style={{ position: 'relative', flex: 1, maxWidth: '280px' }}>
            <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              placeholder="Search SKU, product name, location…"
              value={showHistory ? historySearch : search}
              onChange={e => {
                if (showHistory) { setHistorySearch(e.target.value) }
                else { setSearch(e.target.value); setPage(0) }
              }}
              style={{ width: '100%', boxSizing: 'border-box', padding: '4px 8px 4px 26px', border: '1px solid #e5e7eb', borderRadius: '5px', fontSize: '12px' }}
            />
          </div>
          {!showHistory && search && filtered.length !== rows.length && (
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button onClick={() => { setShowHistory(v => !v); setSearch(''); setHistorySearch('') }} style={{
            fontSize: '12px', padding: '4px 10px', border: '1px solid #e5e7eb',
            borderRadius: '5px', cursor: 'pointer',
            backgroundColor: showHistory ? '#111' : '#fff',
            color: showHistory ? '#fff' : '#374151'
          }}>
            {showHistory ? '← Current' : 'History'}
          </button>
          {!showHistory && (
            <button onClick={exportToExcel} title="Export to Excel" style={{
              fontSize: '12px', padding: '4px 10px', backgroundColor: '#fff', color: '#374151',
              border: '1px solid #e5e7eb', borderRadius: '5px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px'
            }}>
              <Download size={12} />
              Export
            </button>
          )}
          {!showHistory && !isEditing && (
            <button onClick={enterEditMode} style={{
              fontSize: '12px', padding: '4px 14px', backgroundColor: '#111', color: '#fff',
              border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: '600'
            }}>Edit</button>
          )}
          {!showHistory && isEditing && (
            <>
              <button onClick={saveEdit} disabled={saving} style={{
                fontSize: '12px', padding: '4px 14px', backgroundColor: '#16a34a', color: '#fff',
                border: 'none', borderRadius: '5px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontWeight: '600'
              }}>{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={cancelEdit} style={{
                fontSize: '12px', padding: '4px 10px', backgroundColor: '#fff', color: '#374151',
                border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer'
              }}>Cancel</button>
            </>
          )}
        </div>
      </div>

      {/* history panel */}
      {showHistory && (
        <div style={{ marginBottom: '28px' }}>
          <HistoryPanel tableName="ready" externalSearch={historySearch} />
        </div>
      )}

      {/* current inventory table */}
      {!showHistory && (
        <div className={`bg-white rounded-lg overflow-hidden mb-2 border transition-colors ${isEditing ? 'border-lime-300' : 'border-gray-200'}`}>
          {isEditing && (
            <div className="px-3 py-1.5 bg-green-50 border-b border-green-200 text-xs text-green-700 font-medium">
              Editing page {page + 1} — Save or Cancel before switching pages
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-[10px] font-semibold text-gray-400 uppercase w-[120px]">SKU</TableHead>
                <TableHead className="text-[10px] font-semibold text-gray-400 uppercase w-[200px]">PRODUCT NAME</TableHead>
                <TableHead className="text-[10px] font-semibold text-gray-400 uppercase text-right w-[60px]">QTY</TableHead>
                <TableHead className="text-[10px] font-semibold text-gray-400 uppercase w-[100px]">LOCATION</TableHead>
                <TableHead className="text-[10px] font-semibold text-gray-400 uppercase">NOTES</TableHead>
                <TableHead className="text-[10px] font-semibold text-gray-400 uppercase w-[80px]">UPDATED</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-5 text-center text-xs text-gray-400">
                    {search ? `No results for "${search}"` : 'No items'}
                  </TableCell>
                </TableRow>
              )}
              {pageRows.map(row => {
                const draft = editDraft[row.id]
                return (
                  <TableRow key={row.id}>
                    <TableCell className={`${isEditing ? 'py-1 px-3' : 'py-1.5 px-3'} font-medium text-gray-900 text-xs`}>{row.product_sku}</TableCell>
                    <TableCell className={`${isEditing ? 'py-1 px-1.5' : 'py-1.5 px-3'} text-xs max-w-[200px]`}>
                      {isEditing ? (
                        <input value={draft?.product_name ?? (row.product_name || '')}
                          onChange={e => setDraftField(row.id, 'product_name', e.target.value)}
                          style={inputStyle} />
                      ) : (
                        <span className="text-gray-700 truncate block" title={row.product_name || ''}>{row.product_name || '—'}</span>
                      )}
                    </TableCell>
                    <TableCell className={`${isEditing ? 'py-1 px-1.5' : 'py-1.5 px-3'} text-right text-xs`}>
                      {isEditing ? (
                        <input type="number" value={draft?.quantity ?? row.quantity}
                          onChange={e => setDraftField(row.id, 'quantity', e.target.value)}
                          style={{ ...inputStyle, textAlign: 'right', width: '70px' }} />
                      ) : (
                        <span className="font-bold text-gray-900">{row.quantity}</span>
                      )}
                    </TableCell>
                    <TableCell className={`${isEditing ? 'py-1 px-1.5' : 'py-1.5 px-3'} text-xs`}>
                      {isEditing ? (
                        <input value={draft?.location ?? (row.location || '')}
                          onChange={e => setDraftField(row.id, 'location', e.target.value)}
                          style={inputStyle} />
                      ) : (
                        <span className="text-gray-500">{row.location || '—'}</span>
                      )}
                    </TableCell>
                    <TableCell className={`${isEditing ? 'py-1 px-1.5' : 'py-1.5 px-3'} text-xs max-w-[200px]`}>
                      {isEditing ? (
                        <input value={draft?.notes ?? (row.notes || '')}
                          onChange={e => setDraftField(row.id, 'notes', e.target.value)}
                          style={inputStyle} />
                      ) : (
                        <span className="text-gray-500 truncate block">{row.notes || '—'}</span>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5 px-3 text-xs">
                      <div className="flex items-center gap-1">
                        {row.last_updated_by_user && (
                          <img src={row.last_updated_by_user.avatar_url} alt=""
                            className="w-3.5 h-3.5 rounded-full object-cover" />
                        )}
                        <span className="text-[10px] text-gray-400">
                          {row.last_updated_at
                            ? isToday(row.last_updated_at)
                              ? 'Today'
                              : new Date(row.last_updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : '—'}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* pagination */}
      {!showHistory && totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', padding: '0 2px' }}>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i} onClick={() => tryChangePage(i)} style={{
                width: '26px', height: '26px', border: '1px solid #e5e7eb', borderRadius: '5px',
                fontSize: '11px', cursor: 'pointer',
                backgroundColor: i === page ? '#111' : '#fff',
                color: i === page ? '#fff' : '#374151',
                fontWeight: i === page ? '600' : '400'
              }}>{i + 1}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => tryChangePage(Math.max(0, page - 1))} disabled={page === 0}
              style={{ padding: '3px 8px', border: '1px solid #e5e7eb', borderRadius: '5px', fontSize: '12px', cursor: page === 0 ? 'not-allowed' : 'pointer', color: page === 0 ? '#d1d5db' : '#374151', backgroundColor: '#fff', display: 'flex', alignItems: 'center' }}>
              <ChevronLeft size={13} />
            </button>
            <button onClick={() => tryChangePage(Math.min(totalPages - 1, page + 1))} disabled={page === totalPages - 1}
              style={{ padding: '3px 8px', border: '1px solid #e5e7eb', borderRadius: '5px', fontSize: '12px', cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer', color: page === totalPages - 1 ? '#d1d5db' : '#374151', backgroundColor: '#fff', display: 'flex', alignItems: 'center' }}>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
      {!showHistory && totalPages <= 1 && <div style={{ marginBottom: '28px' }} />}

      {/* unsaved changes warning dialog */}
      <Dialog open={unsavedWarning} onOpenChange={(open) => { if (!open) setUnsavedWarning(false) }}>
        <DialogContent className="w-[340px] max-w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Unsaved Changes</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 mt-1">
            You have unsaved edits on this page. Save your changes or discard them before navigating to another page.
          </p>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setUnsavedWarning(false)} className="text-sm">
              Keep Editing
            </Button>
            <Button
              onClick={confirmDiscardAndChangePage}
              className="text-sm bg-red-500 hover:bg-red-600 text-white"
            >
              Discard &amp; Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Pending / Clearance table: original add/delete/edit-per-row behavior ────
function FlexTable({ tableName }) {
  const { user } = useAuth()
  const config = tableConfig[tableName]
  const dbTable = `inventory_${tableName}`

  const [rows, setRows] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editValues, setEditValues] = useState({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [newRow, setNewRow] = useState(emptyRow)
  const [showHistory, setShowHistory] = useState(false)
  const [search, setSearch] = useState('')
  const [historySearch, setHistorySearch] = useState('')

  useEffect(() => { fetchRows() }, [tableName])

  const fetchRows = async () => {
    const { data } = await supabase
      .from(dbTable)
      .select(`id, product_sku, quantity, location, notes, last_updated_at,
        last_updated_by_user:users!${dbTable}_last_updated_by_fkey(display_name, avatar_url)`)
      .order('product_sku', { ascending: true })
    setRows(data || [])
  }

  const startEdit = (row) => {
    setEditingId(row.id)
    setEditValues({ product_sku: row.product_sku, quantity: row.quantity, location: row.location || '', notes: row.notes || '' })
  }

  const saveEdit = async () => {
    await supabase.from(dbTable).update({
      ...editValues,
      quantity: parseInt(editValues.quantity) || 0,
      last_updated_by: user.id,
      last_updated_at: new Date().toISOString()
    }).eq('id', editingId)
    setEditingId(null)
    fetchRows()
  }

  const handleAdd = async () => {
    if (!newRow.product_sku.trim()) return
    await supabase.from(dbTable).insert({
      ...newRow,
      quantity: parseInt(newRow.quantity) || 0,
      last_updated_by: user.id,
      last_updated_at: new Date().toISOString()
    })
    setNewRow(emptyRow)
    setShowAddForm(false)
    fetchRows()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this row?')) return
    await supabase.from(dbTable).delete().eq('id', id)
    fetchRows()
  }

  const filtered = rows.filter(r => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      r.product_sku?.toLowerCase().includes(q) ||
      r.location?.toLowerCase().includes(q) ||
      r.notes?.toLowerCase().includes(q)
    )
  })

  const today = new Date().toDateString()
  const isToday = (dateStr) => dateStr && new Date(dateStr).toDateString() === today

  return (
    <>
      {/* toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <span style={{
            fontSize: '12px', fontWeight: '600', padding: '2px 9px', whiteSpace: 'nowrap',
            backgroundColor: config.bg, color: config.color,
            border: `1px solid ${config.border}`, borderRadius: '20px'
          }}>{config.label}</span>
          <span style={{ fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
            {showHistory ? 'History' : `${rows.length} SKUs`}
          </span>

          <div style={{ position: 'relative', flex: 1, maxWidth: '280px' }}>
            <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              placeholder="Search SKU, location, notes…"
              value={showHistory ? historySearch : search}
              onChange={e => showHistory ? setHistorySearch(e.target.value) : setSearch(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '4px 8px 4px 26px', border: '1px solid #e5e7eb', borderRadius: '5px', fontSize: '12px' }}
            />
          </div>
          {!showHistory && search && filtered.length !== rows.length && (
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button onClick={() => { setShowHistory(v => !v); setSearch(''); setHistorySearch('') }} style={{
            fontSize: '12px', padding: '4px 10px', border: '1px solid #e5e7eb',
            borderRadius: '5px', cursor: 'pointer',
            backgroundColor: showHistory ? '#111' : '#fff',
            color: showHistory ? '#fff' : '#374151'
          }}>
            {showHistory ? '← Current' : 'History'}
          </button>
          {!showHistory && (
            <button onClick={() => setShowAddForm(v => !v)} style={{
              fontSize: '12px', padding: '4px 10px', backgroundColor: '#f3f4f6', color: '#374151',
              border: '1px solid #e5e7eb', borderRadius: '5px', cursor: 'pointer'
            }}>+ Add SKU</button>
          )}
        </div>
      </div>

      {!showHistory && showAddForm && (
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 70px 1fr 2fr auto',
          gap: '5px', padding: '8px 10px', backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb', borderRadius: '6px', marginBottom: '6px', alignItems: 'center'
        }}>
          <input placeholder="SKU *" value={newRow.product_sku}
            onChange={e => setNewRow(p => ({ ...p, product_sku: e.target.value }))}
            style={inputStyle} />
          <input type="number" placeholder="Qty" value={newRow.quantity}
            onChange={e => setNewRow(p => ({ ...p, quantity: e.target.value }))}
            style={inputStyle} />
          <input placeholder="Location" value={newRow.location}
            onChange={e => setNewRow(p => ({ ...p, location: e.target.value }))}
            style={inputStyle} />
          <input placeholder="Notes" value={newRow.notes}
            onChange={e => setNewRow(p => ({ ...p, notes: e.target.value }))}
            style={inputStyle} />
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={handleAdd} style={{
              padding: '3px 10px', backgroundColor: '#111', color: '#fff',
              border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer'
            }}>Add</button>
            <button onClick={() => { setShowAddForm(false); setNewRow(emptyRow) }} style={{
              padding: '3px 10px', backgroundColor: '#fff', color: '#374151',
              border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px', cursor: 'pointer'
            }}>Cancel</button>
          </div>
        </div>
      )}

      {showHistory && (
        <div style={{ marginBottom: '28px' }}>
          <HistoryPanel tableName={tableName} externalSearch={historySearch} />
        </div>
      )}

      {!showHistory && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-7">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-[10px] font-semibold text-gray-400 uppercase">SKU</TableHead>
                <TableHead className="text-[10px] font-semibold text-gray-400 uppercase text-right">QTY</TableHead>
                <TableHead className="text-[10px] font-semibold text-gray-400 uppercase">LOCATION</TableHead>
                <TableHead className="text-[10px] font-semibold text-gray-400 uppercase">NOTES</TableHead>
                <TableHead className="text-[10px] font-semibold text-gray-400 uppercase">UPDATED</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-5 text-center text-xs text-gray-400">
                    {search ? `No results for "${search}"` : 'No items'}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map(row => (
                <TableRow key={row.id}>
                  {editingId === row.id ? (
                    <>
                      <TableCell className="py-1 px-1.5 text-xs">
                        <input value={editValues.product_sku}
                          onChange={e => setEditValues(p => ({ ...p, product_sku: e.target.value }))}
                          style={inputStyle} />
                      </TableCell>
                      <TableCell className="py-1 px-1.5 text-xs">
                        <input type="number" value={editValues.quantity}
                          onChange={e => setEditValues(p => ({ ...p, quantity: e.target.value }))}
                          style={{ ...inputStyle, textAlign: 'right' }} />
                      </TableCell>
                      <TableCell className="py-1 px-1.5 text-xs">
                        <input value={editValues.location}
                          onChange={e => setEditValues(p => ({ ...p, location: e.target.value }))}
                          style={inputStyle} />
                      </TableCell>
                      <TableCell className="py-1 px-1.5 text-xs">
                        <input value={editValues.notes}
                          onChange={e => setEditValues(p => ({ ...p, notes: e.target.value }))}
                          style={inputStyle} />
                      </TableCell>
                      <TableCell />
                      <TableCell className="py-1 px-1.5 text-xs">
                        <div className="flex gap-1">
                          <button onClick={saveEdit}
                            className="flex items-center px-2 py-1 bg-gray-900 text-white rounded cursor-pointer border-none">
                            <Check size={12} />
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="flex items-center px-2 py-1 bg-white text-gray-700 border border-gray-300 rounded cursor-pointer">
                            <X size={12} />
                          </button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="py-1.5 px-3 text-xs font-medium text-gray-900">{row.product_sku}</TableCell>
                      <TableCell className="py-1.5 px-3 text-xs text-right font-bold text-gray-900">{row.quantity}</TableCell>
                      <TableCell className="py-1.5 px-3 text-xs text-gray-500">{row.location || '—'}</TableCell>
                      <TableCell className="py-1.5 px-3 text-xs text-gray-500 max-w-[200px] truncate">{row.notes || '—'}</TableCell>
                      <TableCell className="py-1.5 px-3 text-xs">
                        <div className="flex items-center gap-1">
                          {row.last_updated_by_user && (
                            <img src={row.last_updated_by_user.avatar_url} alt=""
                              className="w-3.5 h-3.5 rounded-full object-cover" />
                          )}
                          <span className="text-[10px] text-gray-400">
                            {row.last_updated_at
                              ? isToday(row.last_updated_at)
                                ? 'Today'
                                : new Date(row.last_updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              : '—'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-1.5 px-2 text-xs">
                        <div className="flex gap-1 justify-end items-center">
                          <button onClick={() => startEdit(row)} title="Edit"
                            className="p-0.5 text-gray-300 hover:text-gray-900 flex items-center bg-transparent border-none cursor-pointer">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => handleDelete(row.id)} title="Delete"
                            className="p-0.5 text-gray-300 hover:text-red-500 flex items-center bg-transparent border-none cursor-pointer">
                            <X size={12} />
                          </button>
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  )
}

export default function Inventory() {
  const [tab, setTab] = useState('ready')

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '18px' }}>Inventory</h1>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full mb-4">
          {Object.entries(tableConfig).map(([key, config]) => (
            <TabsTrigger key={key} value={key} className="flex-1 gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: config.color }}
              />
              {config.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="ready">
          <ReadyTable key="ready" />
        </TabsContent>
        <TabsContent value="pending">
          <FlexTable key="pending" tableName="pending" />
        </TabsContent>
        <TabsContent value="clearance">
          <FlexTable key="clearance" tableName="clearance" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
