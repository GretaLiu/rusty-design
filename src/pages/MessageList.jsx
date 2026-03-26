import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function MessageList() {
  const [messages, setMessages] = useState([])
  const [tab, setTab] = useState('active')
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { fetchMessages() }, [tab])

  const fetchMessages = async () => {
    let query = supabase
      .from('messages')
      .select(`
        id, title, archived, created_at,
        created_by_user:users!messages_created_by_fkey(display_name, avatar_url),
        replies:message_replies(id),
        todos(id, completed),
        mentions:message_replies(reply_mentions(read, user_id))
      `)
      .order('created_at', { ascending: false })

    if (tab === 'active') query = query.eq('archived', false)
    if (tab === 'archived') query = query.eq('archived', true)

    const { data } = await query
    setMessages(data || [])
  }

  const hasUnread = (msg) =>
    msg.mentions?.some(r =>
      r.reply_mentions?.some(m => !m.read && m.user_id === user?.id)
    )

  const openTodos = (msg) =>
    msg.todos?.filter(t => !t.completed).length || 0

  const tabs = ['active', 'archived', 'all']

  return (
    <div style={{ padding: '24px', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button onClick={() => navigate('/home')} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '13px', color: '#6b7280', padding: 0
        }}>← Back</button>
        <h1 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Message Board</h1>
        <div style={{ width: '40px' }} />
      </div>

      <div style={{
        display: 'flex', gap: '4px', marginBottom: '16px',
        backgroundColor: '#f3f4f6', borderRadius: '8px', padding: '4px'
      }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '6px', border: 'none', borderRadius: '6px', cursor: 'pointer',
            fontSize: '13px', fontWeight: tab === t ? '600' : '400',
            backgroundColor: tab === t ? '#fff' : 'transparent',
            color: tab === t ? '#111' : '#6b7280',
            boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            textTransform: 'capitalize'
          }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
        {messages.length === 0 && (
          <p style={{ padding: '24px', fontSize: '13px', color: '#9ca3af', textAlign: 'center' }}>
            No messages
          </p>
        )}
        {messages.map(msg => (
          <div key={msg.id}
            onClick={() => navigate(`/home/messages/${msg.id}`)}
            style={{
              padding: '14px 16px', borderBottom: '1px solid #f3f4f6',
              cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '10px',
              opacity: msg.archived ? 0.5 : 1
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9fafb'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
          >
            <img src={msg.created_by_user?.avatar_url} alt=""
              style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {hasUnread(msg) && (
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0 }} />
                )}
                <span style={{
                  fontSize: '14px', fontWeight: '500', color: '#111',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>{msg.title}</span>
                {msg.archived && (
                  <span style={{
                    fontSize: '11px', color: '#9ca3af', border: '1px solid #e5e7eb',
                    borderRadius: '4px', padding: '1px 6px', flexShrink: 0
                  }}>archived</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                  {msg.replies?.length || 0} {msg.replies?.length === 1 ? 'reply' : 'replies'}
                </span>
                {openTodos(msg) > 0 && (
                  <span style={{ fontSize: '12px', color: '#f59e0b' }}>
                    {openTodos(msg)} open todo{openTodos(msg) > 1 ? 's' : ''}
                  </span>
                )}
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                  {new Date(msg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}