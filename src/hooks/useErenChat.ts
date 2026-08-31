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
import { playSound } from '@/lib/sounds'
import { DAILY_ALLOWANCE, allowanceDayStart } from '@/lib/chatAllowance'
import type { ErenChatMessage } from '@/types'

const PAGE = 60

export function useErenChat() {
  const supabase = createClient()
  const [messages, setMessages]   = useState<ErenChatMessage[]>([])
  const [streaming, setStreaming] = useState('')
  const [sending, setSending]     = useState(false)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  // Bumped each time Eren files a fact away. The page watches it to flash the
  // memory button; the fact's text is deliberately never rendered inline,
  // since he's instructed never to announce that he remembered something.
  const [savedTick, setSavedTick] = useState(0)
  // How much of today's backstop allowance is spent. Counted rather than
  // derived from `messages`: the transcript is paged, so a busy day would fall
  // off the end of it and the tally would quietly reset itself.
  const [usedToday, setUsedToday] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // RLS scopes both of these to the caller, which is why neither filters
        // by user_id — same reason the thread query doesn't.
        const [thread, today] = await Promise.all([
          withRetry(() => supabase
            .from('eren_chat_messages')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(PAGE)),
          // Rows rather than a `count: 'exact'` head query: withRetry returns
          // only { data, error }, so an exact count doesn't survive the
          // wrapper. Capped at the allowance because nothing above it changes
          // the answer, and bare ids are cheap.
          withRetry(() => supabase
            .from('eren_chat_messages')
            .select('id')
            .eq('role', 'user')
            .gte('created_at', allowanceDayStart())
            .limit(DAILY_ALLOWANCE)),
        ])
        if (cancelled) return
        if (thread.data) setMessages((thread.data as ErenChatMessage[]).reverse())
        if (today.data) setUsedToday(today.data.length)
      } catch {
        // An outage shouldn't block the composer — you can still send. The
        // server is the authority on the allowance either way; a failed count
        // just means the bar starts empty until the first send corrects it.
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => abortRef.current?.abort(), [])

  /** Daily backstop reached. Distinct from the energy gate, which is the
   *  limit players actually meet and lives on his stats, not in here. */
  const spent = usedToday >= DAILY_ALLOWANCE

  const send = useCallback(async (text: string) => {
    const body = text.trim()
    if (!body || sending || spent) return

    setError(null)
    setSending(true)
    setStreaming('')
    playSound('chat_send')

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
        playSound('chat_quiet')
        // A 429 is one of three things. `tired` is the daily backstop, and it
        // needs no banner — the sleeping panel IS the explanation. `sleepy` is
        // the energy gate, which normally renders as the panel too; it only
        // reaches here when the client's decayed energy estimate was a shade
        // above the server's, so say it plainly rather than leave a dead
        // composer. Anything else is the loop guard.
        let refusal: 'spent' | 'sleepy' | null = null
        try {
          const j = await res.json()
          if (j?.tired) refusal = 'spent'
          else if (j?.sleepy) refusal = 'sleepy'
        } catch { /* not json */ }
        if (refusal === 'spent') setUsedToday(DAILY_ALLOWANCE)
        setError(
          refusal === 'spent' ? null
            : refusal === 'sleepy' ? 'he is too tired'
            : res.status === 429 ? 'give him a minute'
            : 'eren is not answering',
        )
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        return
      }

      // The server reserves the row before it spends anything, so the message
      // is counted against the day the moment the stream opens — whether or
      // not a reply ever lands. Count it here for the same reason.
      setUsedToday((n) => n + 1)

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
          let payload: { t?: string; done?: boolean; error?: string; saved?: string }
          try { payload = JSON.parse(line.slice(5).trim()) } catch { continue }

          if (payload.error) { playSound('chat_quiet'); setError(payload.error) }
          if (payload.saved) { playSound('chat_saved'); setSavedTick((n) => n + 1) }
          if (payload.t) {
            // Chirp once, on the first token — not per chunk, or the reply
            // arrives as a burst of forty overlapping chirps.
            if (!reply) playSound('chat_receive')
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
  }, [sending, spent])

  return {
    messages, streaming, sending, loading, error, savedTick, send,
    spent,
  }
}
