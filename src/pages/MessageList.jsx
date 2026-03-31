import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

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
        replies:message_replies(id, body, created_at),
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

  const firstReplyPreview = (msg) => {
    if (!msg.replies || msg.replies.length === 0) return null
    const sorted = [...msg.replies].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    const body = sorted[0]?.body || ''
    const firstPara = body.split(/\n\n+/)[0].trim()
    return firstPara.length > 120 ? firstPara.slice(0, 120) + '…' : firstPara
  }

  const MessageRow = ({ msg }) => (
    <div
      onClick={() => navigate(`/home/messages/${msg.id}`)}
      className={`flex items-start gap-3 px-4 py-3.5 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors last:border-b-0 ${msg.archived ? 'opacity-50' : ''}`}
    >
      <img
        src={msg.created_by_user?.avatar_url} alt=""
        className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {hasUnread(msg) && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          )}
          <span className="text-sm font-medium text-gray-900 truncate">{msg.title}</span>
          {msg.archived && (
            <span className="text-[11px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 shrink-0">
              archived
            </span>
          )}
          <span className="text-xs text-gray-300 ml-0.5">
            {msg.replies?.length || 0} {msg.replies?.length === 1 ? 'reply' : 'replies'}
            {openTodos(msg) > 0 && (
              <span className="text-amber-400"> · {openTodos(msg)} todo{openTodos(msg) > 1 ? 's' : ''}</span>
            )}
            {' · '}{new Date(msg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
        {firstReplyPreview(msg) && (
          <p className="mt-0.5 text-xs text-gray-500 leading-relaxed line-clamp-2 text-left">
            {firstReplyPreview(msg)}
          </p>
        )}
      </div>
    </div>
  )

  return (
    <div className="px-6 py-6 max-w-[720px] mx-auto">
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => navigate('/home')}
          className="text-sm text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer p-0 transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-lg font-bold text-gray-900 m-0">Tickets</h1>
        <div className="w-10" />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="active" className="flex-1">Active</TabsTrigger>
          <TabsTrigger value="archived" className="flex-1">Archived</TabsTrigger>
          <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
        </TabsList>

        {['active', 'archived', 'all'].map(t => (
          <TabsContent key={t} value={t}>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {messages.length === 0
                ? <p className="py-8 text-center text-sm text-gray-400">No messages</p>
                : messages.map(msg => <MessageRow key={msg.id} msg={msg} />)
              }
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
