import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Pencil, X, Check, ChevronLeft, ChevronRight, Search } from 'lucide-react'

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
      .select('product_sku, quantity, location, notes')
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
        <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>No data for this date</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>No results for "{externalSearch}"</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '6px 12px', color: '#9ca3af', fontWeight: '600', fontSize: '10px' }}>SKU</th>
              <th style={{ textAlign: 'right', padding: '6px 12px', color: '#9ca3af', fontWeight: '600', fontSize: '10px' }}>QTY</th>
              <th style={{ textAlign: 'left', padding: '6px 12px', color: '#9ca3af', fontWeight: '600', fontSize: '10px' }}>LOCATION</th>
              <th style={{ textAlign: 'left', padding: '6px 12px', color: '#9ca3af', fontWeight: '600', fontSize: '10px' }}>NOTES</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '6px 12px', fontWeight: '500', color: '#111' }}>{row.product_sku}</td>
                <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: '700', color: '#111' }}>{row.quantity}</td>
                <td style={{ padding: '6px 12px', color: '#6b7280' }}>{row.location || '—'}</td>
                <td style={{ padding: '6px 12px', color: '#6b7280' }}>{row.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
  const [editDraft, setEditDraft] = useState({})   // { [id]: { quantity, location, notes } }
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
      .select(`id, product_sku, quantity, location, notes, last_updated_at,
        last_updated_by_user:users!${dbTable}_last_updated_by_fkey(display_name, avatar_url)`)
      .order('product_sku', { ascending: true })
    setRows(data || [])
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

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const today = new Date().toDateString()
  const isToday = (dateStr) => dateStr && new Date(dateStr).toDateString() === today

  const enterEditMode = () => {
    const draft = {}
    pageRows.forEach(r => {
      draft[r.id] = { quantity: r.quantity, location: r.location || '', notes: r.notes || '' }
    })
    setEditDraft(draft)
    setIsEditing(true)
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setEditDraft({})
  }

  const saveEdit = async () => {
    setSaving(true)
    const now = new Date().toISOString()
    const updates = Object.entries(editDraft).map(([id, vals]) =>
      supabase.from(dbTable).update({
        quantity: parseInt(vals.quantity) || 0,
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
          {!showHistory && !isEditing && (
            <button onClick={enterEditMode} style={{
              fontSize: '12px', padding: '4px 10px', backgroundColor: '#f3f4f6', color: '#374151',
              border: '1px solid #e5e7eb', borderRadius: '5px', cursor: 'pointer'
            }}>Edit</button>
          )}
          {!showHistory && isEditing && (
            <>
              <button onClick={saveEdit} disabled={saving} style={{
                fontSize: '12px', padding: '4px 10px', backgroundColor: '#111', color: '#fff',
                border: 'none', borderRadius: '5px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1
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
        <div style={{ backgroundColor: '#fff', border: `1px solid ${isEditing ? '#a3e635' : '#e5e7eb'}`, borderRadius: '8px', overflow: 'hidden', marginBottom: '8px', transition: 'border-color 0.15s' }}>
          {isEditing && (
            <div style={{ padding: '6px 12px', backgroundColor: '#f0fdf4', borderBottom: '1px solid #bbf7d0', fontSize: '11px', color: '#16a34a', fontWeight: '500' }}>
              Editing page {page + 1} — Save or Cancel before switching pages
            </div>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '6px 12px', color: '#9ca3af', fontWeight: '600', fontSize: '10px' }}>SKU</th>
                <th style={{ textAlign: 'right', padding: '6px 12px', color: '#9ca3af', fontWeight: '600', fontSize: '10px' }}>QTY</th>
                <th style={{ textAlign: 'left', padding: '6px 12px', color: '#9ca3af', fontWeight: '600', fontSize: '10px' }}>LOCATION</th>
                <th style={{ textAlign: 'left', padding: '6px 12px', color: '#9ca3af', fontWeight: '600', fontSize: '10px' }}>NOTES</th>
                <th style={{ textAlign: 'left', padding: '6px 12px', color: '#9ca3af', fontWeight: '600', fontSize: '10px' }}>UPDATED</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>
                    {search ? `No results for "${search}"` : 'No items'}
                  </td>
                </tr>
              )}
              {pageRows.map(row => {
                const draft = editDraft[row.id]
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: isEditing ? '4px 12px' : '7px 12px', fontWeight: '500', color: '#111' }}>{row.product_sku}</td>
                    <td style={{ padding: isEditing ? '4px 6px' : '7px 12px', textAlign: 'right' }}>
                      {isEditing ? (
                        <input type="number" value={draft?.quantity ?? row.quantity}
                          onChange={e => setDraftField(row.id, 'quantity', e.target.value)}
                          style={{ ...inputStyle, textAlign: 'right', width: '70px' }} />
                      ) : (
                        <span style={{ fontWeight: '700', color: '#111' }}>{row.quantity}</span>
                      )}
                    </td>
                    <td style={{ padding: isEditing ? '4px 6px' : '7px 12px' }}>
                      {isEditing ? (
                        <input value={draft?.location ?? (row.location || '')}
                          onChange={e => setDraftField(row.id, 'location', e.target.value)}
                          style={inputStyle} />
                      ) : (
                        <span style={{ color: '#6b7280' }}>{row.location || '—'}</span>
                      )}
                    </td>
                    <td style={{ padding: isEditing ? '4px 6px' : '7px 12px', maxWidth: '200px' }}>
                      {isEditing ? (
                        <input value={draft?.notes ?? (row.notes || '')}
                          onChange={e => setDraftField(row.id, 'notes', e.target.value)}
                          style={inputStyle} />
                      ) : (
                        <span style={{ color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{row.notes || '—'}</span>
                      )}
                    </td>
                    <td style={{ padding: '7px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {row.last_updated_by_user && (
                          <img src={row.last_updated_by_user.avatar_url} alt=""
                            style={{ width: '14px', height: '14px', borderRadius: '50%', objectFit: 'cover' }} />
                        )}
                        <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                          {row.last_updated_at
                            ? isToday(row.last_updated_at)
                              ? 'Today'
                              : new Date(row.last_updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : '—'}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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

      {/* unsaved changes warning modal */}
      {unsavedWarning && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200
        }} onClick={() => setUnsavedWarning(false)}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '10px', padding: '24px', width: '340px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: '700' }}>Unsaved Changes</h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#6b7280' }}>
              You have unsaved edits on this page. Save your changes or discard them before navigating to another page.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setUnsavedWarning(false)} style={{
                padding: '7px 14px', border: '1px solid #d1d5db', borderRadius: '6px',
                fontSize: '13px', cursor: 'pointer', backgroundColor: '#fff', color: '#374151'
              }}>Keep Editing</button>
              <button onClick={confirmDiscardAndChangePage} style={{
                padding: '7px 14px', backgroundColor: '#ef4444', color: '#fff',
                border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer'
              }}>Discard &amp; Continue</button>
            </div>
          </div>
        </div>
      )}
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

      {!showHistory && <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', marginBottom: '28px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '6px 12px', color: '#9ca3af', fontWeight: '600', fontSize: '10px' }}>SKU</th>
              <th style={{ textAlign: 'right', padding: '6px 12px', color: '#9ca3af', fontWeight: '600', fontSize: '10px' }}>QTY</th>
              <th style={{ textAlign: 'left', padding: '6px 12px', color: '#9ca3af', fontWeight: '600', fontSize: '10px' }}>LOCATION</th>
              <th style={{ textAlign: 'left', padding: '6px 12px', color: '#9ca3af', fontWeight: '600', fontSize: '10px' }}>NOTES</th>
              <th style={{ textAlign: 'left', padding: '6px 12px', color: '#9ca3af', fontWeight: '600', fontSize: '10px' }}>UPDATED</th>
              <th style={{ padding: '6px 8px' }} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>
                  {search ? `No results for "${search}"` : 'No items'}
                </td>
              </tr>
            )}
            {filtered.map(row => (
              <tr key={row.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                {editingId === row.id ? (
                  <>
                    <td style={{ padding: '4px 6px' }}>
                      <input value={editValues.product_sku}
                        onChange={e => setEditValues(p => ({ ...p, product_sku: e.target.value }))}
                        style={inputStyle} />
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      <input type="number" value={editValues.quantity}
                        onChange={e => setEditValues(p => ({ ...p, quantity: e.target.value }))}
                        style={{ ...inputStyle, textAlign: 'right' }} />
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      <input value={editValues.location}
                        onChange={e => setEditValues(p => ({ ...p, location: e.target.value }))}
                        style={inputStyle} />
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      <input value={editValues.notes}
                        onChange={e => setEditValues(p => ({ ...p, notes: e.target.value }))}
                        style={inputStyle} />
                    </td>
                    <td />
                    <td style={{ padding: '4px 6px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={saveEdit} style={{
                          display: 'flex', alignItems: 'center', padding: '3px 8px',
                          backgroundColor: '#111', color: '#fff', border: 'none',
                          borderRadius: '4px', cursor: 'pointer'
                        }}><Check size={12} /></button>
                        <button onClick={() => setEditingId(null)} style={{
                          display: 'flex', alignItems: 'center', padding: '3px 8px',
                          backgroundColor: '#fff', color: '#374151', border: '1px solid #d1d5db',
                          borderRadius: '4px', cursor: 'pointer'
                        }}><X size={12} /></button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: '7px 12px', fontWeight: '500', color: '#111' }}>{row.product_sku}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: '700', color: '#111' }}>{row.quantity}</td>
                    <td style={{ padding: '7px 12px', color: '#6b7280' }}>{row.location || '—'}</td>
                    <td style={{ padding: '7px 12px', color: '#6b7280', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.notes || '—'}</td>
                    <td style={{ padding: '7px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {row.last_updated_by_user && (
                          <img src={row.last_updated_by_user.avatar_url} alt=""
                            style={{ width: '14px', height: '14px', borderRadius: '50%', objectFit: 'cover' }} />
                        )}
                        <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                          {row.last_updated_at
                            ? isToday(row.last_updated_at)
                              ? 'Today'
                              : new Date(row.last_updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : '—'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '7px 8px' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button onClick={() => startEdit(row)} title="Edit"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: '2px', display: 'flex', alignItems: 'center' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#111'}
                          onMouseLeave={e => e.currentTarget.style.color = '#d1d5db'}>
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => handleDelete(row.id)} title="Delete"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: '2px', display: 'flex', alignItems: 'center' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={e => e.currentTarget.style.color = '#d1d5db'}>
                          <X size={12} />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
    </>
  )
}

const tabStyle = (active) => ({
  flex: 1, padding: '7px', border: 'none', borderRadius: '6px', cursor: 'pointer',
  fontSize: '12px', fontWeight: active ? '600' : '400',
  backgroundColor: active ? '#fff' : 'transparent',
  color: active ? '#111' : '#6b7280',
  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
})

export default function Inventory() {
  const [tab, setTab] = useState('ready')

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '18px' }}>Inventory</h1>

      <div style={{
        display: 'flex', gap: '4px', marginBottom: '16px',
        backgroundColor: '#f3f4f6', borderRadius: '8px', padding: '4px'
      }}>
        {Object.entries(tableConfig).map(([key, config]) => (
          <button key={key} onClick={() => setTab(key)} style={tabStyle(tab === key)}>
            <span style={{
              display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%',
              backgroundColor: config.color, marginRight: '5px'
            }} />
            {config.label}
          </button>
        ))}
      </div>

      {tab === 'ready'
        ? <ReadyTable key="ready" />
        : <FlexTable key={tab} tableName={tab} />
      }
    </div>
  )
}
