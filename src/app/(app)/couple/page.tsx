'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Send } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useCare } from '@/contexts/CareContext'
import { format } from 'date-fns'

export default function CouplePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { setHideStats } = useCare()
  const { partner, loveMeter, anniversary, journal, sendMessage, markAllRead, loading } = useCouple()
  useEffect(() => { setHideStats(false) }, [setHideStats])
  useEffect(() => { markAllRead() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!msg.trim() || sending) return
    setSending(true)
    await sendMessage(msg)
    setMsg('')
    setSending(false)
  }

  if (loading) {
    return (
      <div className="page-scroll flex items-center justify-center min-h-[60vh]">
        <span className="font-pixel text-pink-300 animate-pulse-soft" style={{ fontSize: 8 }}>LOADING<span className="animate-cursor">_</span></span>
      </div>
    )
  }

  return (
    <div className="page-scroll">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <button onClick={() => router.back()} className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #FFF8FF, #F0E8FF)', borderRadius: 8, border: '2px solid #D8C0F0', boxShadow: '0 2px 0 #C0A0E0' }}>
          <ChevronLeft size={16} className="text-purple-500" />
        </button>
        <span className="pixel-chip" style={{ background: 'linear-gradient(135deg, #FF6B9D, #C084FC)' }}>💕 US</span>
      </div>
      <p className="text-sm text-gray-500 mb-5">You &amp; your partner</p>

      {/* ── Anniversary ── */}
      {anniversary && (
        <div className="mb-4 p-4 text-center"
          style={{ background: 'linear-gradient(135deg, #FFF0F7, #F8F0FF)', borderRadius: 4, border: '2px solid #F0D0FF', boxShadow: '3px 3px 0 #E0B8FF' }}>
          <p className="font-pixel text-pink-400 mb-1" style={{ fontSize: 6 }}>TOGETHER FOR</p>
          <p className="font-pixel text-purple-700" style={{ fontSize: 20 }}>{anniversary.days}</p>
          <p className="font-pixel text-purple-500 mb-2" style={{ fontSize: 8 }}>DAYS</p>
          {anniversary.milestone && (
            <div className="inline-block px-3 py-1 mb-2"
              style={{ background: 'linear-gradient(135deg, #FBBF24, #F59E0B)', borderRadius: 3, border: '2px solid #D97706' }}>
              <span className="font-pixel text-white" style={{ fontSize: 7 }}>🎉 {anniversary.milestone}</span>
            </div>
          )}
          {anniversary.nextMilestone && (
            <p className="text-xs text-gray-400">Next milestone: {anniversary.nextMilestone.name} in {anniversary.nextMilestone.daysLeft} days</p>
          )}
        </div>
      )}

      {/* ── Love Meter (Competition!) ── */}
      {loveMeter && partner && (
        <div className="mb-4 p-4"
          style={{ background: 'linear-gradient(135deg, #FFF8F0, #FFF0E8)', borderRadius: 4, border: '2px solid #FFD0A0', boxShadow: '3px 3px 0 #F0C090' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="pixel-chip" style={{ background: 'linear-gradient(135deg, #FF6B9D, #F5C842)' }}>⚔️ CARE BATTLE</span>
            <span className="text-xs text-gray-400">Last 30 days</span>
          </div>

          {/* VS display */}
          <div className="flex items-center gap-3 mb-3">
            {/* User 1 */}
            <div className="flex-1 text-center">
              <p className="font-pixel text-gray-700 mb-1" style={{ fontSize: 7 }}>
                {loveMeter.user1.id === user?.id ? 'YOU' : loveMeter.user1.name.split(' ')[0].toUpperCase()}
              </p>
              <p className="font-pixel" style={{ fontSize: 16, color: loveMeter.leader === loveMeter.user1.id ? '#F59E0B' : '#9CA3AF' }}>
                {loveMeter.user1.score}
              </p>
              {loveMeter.leader === loveMeter.user1.id && <span style={{ fontSize: 14 }}>👑</span>}
            </div>

            {/* VS */}
            <div className="font-pixel text-gray-400" style={{ fontSize: 10 }}>VS</div>

            {/* User 2 */}
            <div className="flex-1 text-center">
              <p className="font-pixel text-gray-700 mb-1" style={{ fontSize: 7 }}>
                {loveMeter.user2.id === user?.id ? 'YOU' : loveMeter.user2.name.split(' ')[0].toUpperCase()}
              </p>
              <p className="font-pixel" style={{ fontSize: 16, color: loveMeter.leader === loveMeter.user2.id ? '#F59E0B' : '#9CA3AF' }}>
                {loveMeter.user2.score}
              </p>
              {loveMeter.leader === loveMeter.user2.id && <span style={{ fontSize: 14 }}>👑</span>}
            </div>
          </div>

          {/* Competition bar */}
          <div className="flex h-4 rounded-full overflow-hidden" style={{ border: '2px solid #FFD0A0' }}>
            <div style={{ width: `${loveMeter.user1.pct}%`, background: 'linear-gradient(90deg, #FF6B9D, #F472B6)', transition: 'width 0.5s' }} />
            <div style={{ width: `${loveMeter.user2.pct}%`, background: 'linear-gradient(90deg, #A78BFA, #7C3AED)', transition: 'width 0.5s' }} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="font-pixel text-pink-400" style={{ fontSize: 6 }}>{loveMeter.user1.pct}%</span>
            <span className="font-pixel text-purple-400" style={{ fontSize: 6 }}>{loveMeter.user2.pct}%</span>
          </div>

          {!loveMeter.leader && <p className="text-center text-xs text-gray-400 mt-2">It&apos;s a tie! 🤝</p>}
        </div>
      )}

      {/* ── Shared Journal ── */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="pixel-chip" style={{ background: 'linear-gradient(135deg, #C084FC, #A060E0)' }}>💌 EREN&apos;S JOURNAL</span>
        </div>

        {/* Compose */}
        <div className="flex gap-2 mb-3">
          <input
            className="flex-1 px-3 py-2 text-sm"
            style={{ background: 'white', borderRadius: 4, border: '2px solid #E0D0F0', outline: 'none' }}
            placeholder="Write a message for your partner..."
            value={msg}
            onChange={e => setMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            maxLength={500}
          />
          <button onClick={handleSend} disabled={!msg.trim() || sending}
            className="flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40"
            style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #C084FC, #A060E0)', borderRadius: 4, border: '2px solid #7C3AED', boxShadow: '0 2px 0 #5B21B6' }}>
            <Send size={16} className="text-white" />
          </button>
        </div>

        <p className="text-xs text-gray-400 mb-3">Eren will deliver your message to your partner 🐾</p>

        {/* Messages */}
        <div className="flex flex-col gap-2">
          {journal.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-4">No messages yet. Send the first one!</p>
          )}
          {journal.map(m => {
            const isMe = m.sender_id === user?.id
            return (
              <div key={m.id} className="flex gap-2"
                style={{ flexDirection: isMe ? 'row-reverse' : 'row' }}>
                {/* Eren avatar for partner messages */}
                {!isMe && (
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center"
                    style={{ background: '#F0E8FF', borderRadius: '50%', border: '2px solid #D8C0F0' }}>
                    <img src="/erenGood.png" alt="" style={{ width: 20, height: 20, objectFit: 'contain', imageRendering: 'pixelated' }} />
                  </div>
                )}
                <div className="max-w-[75%] px-3 py-2"
                  style={{
                    background: isMe ? 'linear-gradient(135deg, #E9D5FF, #F3E8FF)' : 'white',
                    borderRadius: isMe ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                    border: `1px solid ${isMe ? '#D8B4FE' : '#E5E7EB'}`,
                  }}>
                  <p className="text-sm text-gray-700">{m.message}</p>
                  <p className="text-[9px] text-gray-400 mt-1">
                    {format(new Date(m.created_at), 'MMM d, h:mm a')}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
