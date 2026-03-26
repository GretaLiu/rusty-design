import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const READY_PASSWORD = 'rustydesign2024'

const tableConfig = {
  ready: { label: 'Ready to Ship', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  pending: { label: 'Pending Return', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  clearance: { label: 'Clearance', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' }
}

const emptyRow = { product_sku: '', quantity: 0, location: '', notes: '' }

function HistoryModal({ sku, tableName, onClose }) {
  const [history, setHistory] = useState([])

  useEffect(() => {
    supabase
      .from('inventory_history')
      .select('snapshot_date, quantity, location, notes')
      .eq('product_sku', sku)
      .eq('table_name', tableName)
      .order('snapshot_date', { ascending: false })
      .limit(30)
      .then(({ data }) => setHistory(data || []))
  }, [sku, tableName])

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
    }} onClick={onClose}>
      <div style={{
        backgroundColor: '#fff', borderRadius: '10px', width: '500px', maxWidth: '95vw',
        maxHeight: '80vh', overflow: 'auto', padding: '24px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>{sku}</h2>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9ca3af' }}>
              {tableConfig[tableName].label} · Last 30 days
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af' }}>✕</button>
        </div>

        {history.length === 0
          ? <p style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>No history yet</p>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280', fontWeight: '600', fontSize: '11px' }}>DATE</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', color: '#6b7280', fontWeight: '600', fontSize: '11px' }}>QTY</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280', fontWeight: '600', fontSize: '11px' }}>LOCATION</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280', fontWeight: '600', fontSize: '11px' }}>NOTES</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px', color: '#374151' }}>
                      {new Date(h.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: '600', color: '#111' }}>{h.quantity}</td>
                    <td style={{ padding: '8px', color: '#6b7280' }}>{h.location || '—'}</td>
                    <td style={{ padding: '8px', color: '#6b7280' }}>{h.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  )
}

function InventoryTable({ tableName, readOnly }) {
  const { user } = useAuth()
  const config = tableConfig[tableName]
  const dbTable = `inventory_${tableName}`

  const [rows, setRows] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editValues, setEditValues] = useState({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [newRow, setNewRow] = useState(emptyRow)
  const [historyTarget, setHistoryTarget] = useState(null)
  const [passwordPrompt, setPasswordPrompt] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [pendingAction, setPendingAction] = useState(null)

  useEffect(() => { fetchRows() }, [tableName])

  const fetchRows = async () => {
    const { data } = await supabase
      .from(dbTable)
      .select(`id, product_sku, quantity, location, notes, last_updated_at,
        last_updated_by_user:users!${dbTable}_last_updated_by_fkey(display_name, avatar_url)`)
      .order('product_sku', { ascending: true })
    setRows(data || [])
  }

  const requirePassword = (action) => {
    if (!readOnly) { action(); return }
    setPendingAction(() => action)
    setPasswordPrompt(true)
    setPasswordInput('')
    setPasswordError('')
  }

  const confirmPassword = () => {
    if (passwordInput !== READY_PASSWORD) {
      setPasswordError('Incorrect password')
      return
    }
    setPasswordPrompt(false)
    if (pendingAction) pendingAction()
    setPendingAction(null)
  }

  const startEdit = (row) => {
    requirePassword(() => {
      setEditingId(row.id)
      setEditValues({ product_sku: row.product_sku, quantity: row.quantity, location: row.location || '', notes: row.notes || '' })
    })
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

  const cancelEdit = () => { setEditingId(null); setEditValues({}) }

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

  const inputStyle = {
    padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: '4px',
    fontSize: '13px', width: '100%', boxSizing: 'border-box'
  }

  return (
    <>
      <div style={{ marginBottom: '32px' }}>
        {/* Table header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '13px', fontWeight: '600', padding: '3px 10px',
              backgroundColor: config.bg, color: config.color,
              border: `1px solid ${config.border}`, borderRadius: '20px'
            }}>{config.label}</span>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>{rows.length} SKUs</span>
          </div>
          <button
            onClick={() => requirePassword(() => setShowAddForm(v => !v))}
            style={{
              fontSize: '12px', padding: '4px 10px', backgroundColor: '#111', color: '#fff',
              border: 'none', borderRadius: '5px', cursor: 'pointer'
            }}>+ Add SKU</button>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 80px 1fr 2fr auto',
            gap: '6px', padding: '10px', backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb', borderRadius: '6px', marginBottom: '8px',
            alignItems: 'center'
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
                padding: '4px 10px', backgroundColor: '#111', color: '#fff',
                border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer'
              }}>Add</button>
              <button onClick={() => { setShowAddForm(false); setNewRow(emptyRow) }} style={{
                padding: '4px 10px', backgroundColor: '#fff', color: '#374151',
                border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px', cursor: 'pointer'
              }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Table */}
        <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: '600', fontSize: '11px' }}>SKU</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: '#6b7280', fontWeight: '600', fontSize: '11px' }}>QTY</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: '600', fontSize: '11px' }}>LOCATION</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: '600', fontSize: '11px' }}>NOTES</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: '600', fontSize: '11px' }}>LAST UPDATED</th>
                <th style={{ padding: '8px 12px' }} />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                    No items
                  </td>
                </tr>
              )}
              {rows.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  {editingId === row.id ? (
                    <>
                      <td style={{ padding: '6px 8px' }}>
                        <input value={editValues.product_sku}
                          onChange={e => setEditValues(p => ({ ...p, product_sku: e.target.value }))}
                          style={inputStyle} />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input type="number" value={editValues.quantity}
                          onChange={e => setEditValues(p => ({ ...p, quantity: e.target.value }))}
                          style={{ ...inputStyle, textAlign: 'right' }} />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input value={editValues.location}
                          onChange={e => setEditValues(p => ({ ...p, location: e.target.value }))}
                          style={inputStyle} />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input value={editValues.notes}
                          onChange={e => setEditValues(p => ({ ...p, notes: e.target.value }))}
                          style={inputStyle} />
                      </td>
                      <td />
                      <td style={{ padding: '6px 8px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={saveEdit} style={{
                            padding: '3px 8px', backgroundColor: '#111', color: '#fff',
                            border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer'
                          }}>Save</button>
                          <button onClick={cancelEdit} style={{
                            padding: '3px 8px', backgroundColor: '#fff', color: '#374151',
                            border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '11px', cursor: 'pointer'
                          }}>Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '10px 12px', fontWeight: '500', color: '#111' }}>{row.product_sku}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#111' }}>{row.quantity}</td>
                      <td style={{ padding: '10px 12px', color: '#6b7280' }}>{row.location || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#6b7280', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.notes || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          {row.last_updated_by_user && (
                            <img src={row.last_updated_by_user.avatar_url} alt=""
                              style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }} />
                          )}
                          <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                            {row.last_updated_at
                              ? new Date(row.last_updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              : '—'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                          <button onClick={() => setHistoryTarget({ sku: row.product_sku, tableName })} style={{
                            padding: '2px 8px', border: '1px solid #e5e7eb',
                            borderRadius: '4px', fontSize: '11px', cursor: 'pointer',
                            backgroundColor: '#fff', color: '#6b7280'
                          }}>History</button>
                          <button onClick={() => startEdit(row)} style={{
                            padding: '2px 8px', border: '1px solid #e5e7eb',
                            borderRadius: '4px', fontSize: '11px', cursor: 'pointer',
                            backgroundColor: '#fff', color: '#6b7280'
                          }}>Edit</button>
                          <button onClick={() => requirePassword(() => handleDelete(row.id))} style={{
                            padding: '2px 8px', border: '1px solid #fee2e2',
                            borderRadius: '4px', fontSize: '11px', cursor: 'pointer',
                            backgroundColor: '#fff', color: '#ef4444'
                          }}>Delete</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Password prompt modal */}
      {passwordPrompt && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200
        }} onClick={() => setPasswordPrompt(false)}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '10px', padding: '24px', width: '320px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: '700' }}>Password Required</h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#6b7280' }}>
              Ready to Ship is protected. Enter the password to make changes.
            </p>
            <input
              type="password" placeholder="Password" value={passwordInput} autoFocus
              onChange={e => { setPasswordInput(e.target.value); setPasswordError('') }}
              onKeyDown={e => e.key === 'Enter' && confirmPassword()}
              style={{
                width: '100%', padding: '8px 10px', border: `1px solid ${passwordError ? '#ef4444' : '#d1d5db'}`,
                borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '8px'
              }} />
            {passwordError && <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#ef4444' }}>{passwordError}</p>}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setPasswordPrompt(false)} style={{
                padding: '7px 14px', border: '1px solid #d1d5db', borderRadius: '6px',
                fontSize: '13px', cursor: 'pointer', backgroundColor: '#fff', color: '#374151'
              }}>Cancel</button>
              <button onClick={confirmPassword} style={{
                padding: '7px 14px', backgroundColor: '#111', color: '#fff',
                border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer'
              }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* History modal */}
      {historyTarget && (
        <HistoryModal
          sku={historyTarget.sku}
          tableName={historyTarget.tableName}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </>
  )
}

export default function Inventory() {
  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '24px' }}>Inventory</h1>
      <InventoryTable tableName="ready" readOnly={true} />
      <InventoryTable tableName="pending" readOnly={false} />
      <InventoryTable tableName="clearance" readOnly={false} />
    </div>
  )
}