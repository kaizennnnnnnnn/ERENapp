/**
 * POST /api/chat
 *
 * Eren's side of the conversation on /talk. Streams his reply back as SSE.
 *
 * Everything here runs on the user's own Supabase session (cookie client, not
 * the service-role admin client) so RLS is doing the access control: a user
 * physically cannot read or write another person's thread even if this route
 * had a bug in it. The chat is private per person and that's enforced by the
 * database, not by a filter in this file.
 *
 * The prompt is assembled in two halves, and the split is load-bearing:
 *   cached prefix   tools → EREN_PERSONA → memories        (cache_control)
 *   volatile tail   history → new message → live stats     (full price)
 * See erenPersona.ts. Folding stats into the persona would cost a cache miss
 * on every single message.
 */
import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDaypart } from '@/lib/timeOfDay'
import {
  EREN_PERSONA,
  REMEMBER_TOOL,
  MEMORY_CAP,
  HISTORY_LIMIT,
  buildLiveContext,
} from '@/lib/erenPersona'
import type { ErenMood } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

const MODEL = 'claude-opus-5'
const MAX_TOKENS = 1024
/** Ceiling on tool round-trips. Eren saves at most one fact per message, so
 *  two passes is the real shape; three is slack for a double call. */
const MAX_TURNS = 3
/** Per-user hourly cap. Generous for a person, hard stop for a runaway loop. */
const RATE_LIMIT_PER_HOUR = 150
const MAX_INPUT_CHARS = 2000

interface Body {
  message?: string
}

export async function POST(request: Request) {
  let body: Body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  const text = body.message?.trim()
  if (!text) return NextResponse.json({ error: 'empty message' }, { status: 400 })
  if (text.length > MAX_INPUT_CHARS) {
    return NextResponse.json({ error: 'message too long' }, { status: 400 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'chat not configured' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // ── Rate limit ────────────────────────────────────────────────────────────
  const hourAgo = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await supabase
    .from('eren_chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('role', 'user')
    .gte('created_at', hourAgo)

  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return NextResponse.json({ error: 'slow down' }, { status: 429 })
  }

  // ── Gather context ────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, household_id, level')
    .eq('id', user.id)
    .maybeSingle()

  const householdId = profile?.household_id ?? null

  const [statsRes, partnerRes, historyRes, memoryRes, lastCareRes] = await Promise.all([
    householdId
      ? supabase.from('eren_stats').select('*').eq('household_id', householdId).maybeSingle()
      : Promise.resolve({ data: null }),
    householdId
      ? supabase.from('profiles').select('name').eq('household_id', householdId).neq('id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('eren_chat_messages')
      .select('role, content')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase
      .from('eren_chat_memories')
      .select('fact')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(MEMORY_CAP),
    householdId
      ? supabase
          .from('interactions')
          .select('created_at')
          .eq('household_id', householdId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const stats = statsRes.data as Record<string, unknown> | null
  const memories = ((memoryRes.data ?? []) as { fact: string }[]).map((m) => m.fact)
  const history = ((historyRes.data ?? []) as { role: string; content: string }[]).reverse()

  const lastCareAt = (lastCareRes.data as { created_at: string } | null)?.created_at
  const hoursSinceLastCare = lastCareAt
    ? (Date.now() - new Date(lastCareAt).getTime()) / 3600_000
    : null

  const now = new Date()
  const liveContext = buildLiveContext({
    speakerName: profile?.name?.split(' ')[0] ?? 'someone',
    partnerName: (partnerRes.data as { name: string } | null)?.name?.split(' ')[0] ?? null,
    hunger:      typeof stats?.hunger === 'number' ? stats.hunger : 80,
    energy:      typeof stats?.energy === 'number' ? stats.energy : 80,
    happiness:   typeof stats?.happiness === 'number' ? stats.happiness : 80,
    // Added by migration_cleanliness — tolerate its absence.
    cleanliness: typeof stats?.cleanliness === 'number' ? stats.cleanliness : null,
    mood:        (stats?.mood as ErenMood) ?? 'idle',
    level:       profile?.level ?? 1,
    daypart:     getDaypart(now),
    localTime:   now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    hoursSinceLastCare,
    memories,
  })

  // ── Build the request ─────────────────────────────────────────────────────
  // Two cache breakpoints. The first covers tools + persona + memories, which
  // only changes when Eren saves a new fact. The second extends it over the
  // replayed history, so a long conversation doesn't re-bill itself each turn.
  const system: Anthropic.TextBlockParam[] = [{ type: 'text', text: EREN_PERSONA }]
  if (memories.length > 0) {
    system.push({
      type: 'text',
      text: `Things you already remember about them (do not save these again):\n${memories.map((m) => `- ${m}`).join('\n')}`,
      cache_control: { type: 'ephemeral' },
    })
  } else {
    system[0].cache_control = { type: 'ephemeral' }
  }

  const messages: Anthropic.MessageParam[] = history.map((m, i) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content:
      i === history.length - 1
        ? [{ type: 'text' as const, text: m.content, cache_control: { type: 'ephemeral' as const } }]
        : m.content,
  }))

  messages.push({ role: 'user', content: text })
  // Live state rides as a mid-conversation system message so the cached prefix
  // above it survives. It must follow a user turn and be last (or be followed
  // by an assistant turn — which is what happens after a tool call).
  messages.push({ role: 'system', content: liveContext } as Anthropic.MessageParam)

  // ── Stream ────────────────────────────────────────────────────────────────
  const anthropic = new Anthropic()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

      let full = ''
      try {
        for (let turn = 0; turn < MAX_TURNS; turn++) {
          const run = anthropic.messages.stream({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            // Thinking stays ON. With it disabled, Opus 5 sometimes writes a
            // tool call into visible text instead of emitting a tool_use block
            // — the save silently never happens and nothing errors.
            thinking: { type: 'adaptive' },
            output_config: { effort: 'low' },
            system,
            tools: [REMEMBER_TOOL],
            messages,
          })

          run.on('text', (delta) => {
            full += delta
            send({ t: delta })
          })

          const msg = await run.finalMessage()

          const toolUses = msg.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
          )
          if (toolUses.length === 0) break

          messages.push({ role: 'assistant', content: msg.content })

          const results: Anthropic.ToolResultBlockParam[] = []
          for (const tu of toolUses) {
            const fact = String((tu.input as { fact?: unknown })?.fact ?? '').trim()
            if (tu.name === 'remember' && fact) {
              await saveMemory(supabase, user.id, fact)
              // Tell the client so it can play the shimmer. The fact itself
              // goes too — not to print in the transcript (he's told never to
              // announce it), but so the memory sheet can highlight what's new
              // without refetching mid-stream.
              send({ saved: fact })
            }
            results.push({ type: 'tool_result', tool_use_id: tu.id, content: 'ok' })
          }
          messages.push({ role: 'user', content: results })
        }

        full = full.trim()
        if (full) {
          await supabase.from('eren_chat_messages').insert([
            { user_id: user.id, role: 'user', content: text },
            { user_id: user.id, role: 'assistant', content: full },
          ])
        }
        send({ done: true })
      } catch (err) {
        console.error('[chat] stream failed', err)
        send({ error: 'eren went quiet' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}

/**
 * Append a fact and enforce MEMORY_CAP. Every stored fact is re-sent on every
 * message, so an uncapped table is a slow, invisible cost leak — oldest go
 * first, which is also roughly least-relevant.
 */
async function saveMemory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  fact: string,
) {
  await supabase.from('eren_chat_memories').insert({ user_id: userId, fact: fact.slice(0, 300) })

  const { data: all } = await supabase
    .from('eren_chat_memories')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  const rows = (all ?? []) as { id: string }[]
  if (rows.length > MEMORY_CAP) {
    await supabase
      .from('eren_chat_memories')
      .delete()
      .in('id', rows.slice(MEMORY_CAP).map((r) => r.id))
  }
}
