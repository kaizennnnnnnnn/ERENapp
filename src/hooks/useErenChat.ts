'use client'

// ═════════════════════════════════════════════════════════════════════════════
// useErenChat — the client half of /talk.
//
// Loads the thread, sends a message, and streams Eren's reply in token by
// token. The thread is private per user and RLS enforces that, so this hook
// never filters by id — it just reads what it's allowed to read.
//
// Only the *committed* transcript lives in `messages`. The in-flight reply is
// kept separately in `streaming` so a mid-stream re-render can't duplicate a
// half-written bubble into history.
// ═════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import type { ErenChatMessage } from '@/types'

const PAGE = 60

export function useErenChat() {
  const supabase = createClient()
  const [messages, setMessages]   = useState<ErenChatMessage[]>([])
  const [streaming, setStreaming] = useState('')
  const [sending, setSending]     = useState(false)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await withRetry(() => supabase
          .from('eren_chat_messages')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(PAGE))
        if (!cancelled && data) setMessages((data as ErenChatMessage[]).reverse())
      } catch {
        // An outage shouldn't block the composer — you can still send.
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => abortRef.current?.abort(), [])

  const send = useCallback(async (text: string) => {
    const body = text.trim()
    if (!body || sending) return

    setError(null)
    setSending(true)
    setStreaming('')

    // Optimistic user bubble. The server writes the real row once Eren has
    // finished replying, so this local one carries a temp id and is replaced
    // wholesale when the turn commits.
    const optimistic: ErenChatMessage = {
      id: `local-${Date.now()}`,
      user_id: '',
      role: 'user',
      content: body,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])

    const controller = new AbortController()
    abortRef.current = controller

    let reply = ''
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: body }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        setError(res.status === 429 ? 'give him a minute' : 'eren is not answering')
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      // SSE frames are `data: {...}\n\n`, and a chunk can split one in half —
      // hold the remainder in `buffer` rather than parsing per chunk.
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''

        for (const frame of frames) {
          const line = frame.trim()
          if (!line.startsWith('data:')) continue
          let payload: { t?: string; done?: boolean; error?: string }
          try { payload = JSON.parse(line.slice(5).trim()) } catch { continue }

          if (payload.error) setError(payload.error)
          if (payload.t) {
            reply += payload.t
            setStreaming(reply)
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError('eren is not answering')
    } finally {
      abortRef.current = null
      setSending(false)
      setStreaming('')

      if (reply.trim()) {
        setMessages((prev) => [...prev, {
          id: `local-reply-${Date.now()}`,
          user_id: '',
          role: 'assistant',
          content: reply.trim(),
          created_at: new Date().toISOString(),
        }])
      } else {
        // Nothing came back — drop the optimistic bubble so the composer
        // doesn't look like it swallowed the message.
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      }
    }
  }, [sending])

  return { messages, streaming, sending, loading, error, send }
}
