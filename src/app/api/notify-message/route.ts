/**
 * POST /api/notify-message
 * Fires a web-push notification to the partner when one person sends a
 * journal message. The sender's client calls this fire-and-forget right after
 * the couple_journal insert succeeds — this is the only path that works when
 * the recipient's PWA is fully closed (the in-app realtime channel only
 * delivers while the recipient has the app running).
 *
 * Body: { message_id, hide_text?, to_notes? }
 *
 * It used to be { household_id, sender_id, sender_name, message }: the sender's
 * identity, their display name and the notification text all came from the
 * request body and none of them were checked against the session. Membership
 * of the household was proven, and nothing else was. That meant one member
 * could push unlimited arbitrary text to the other's lock screen under any
 * name they chose — and because no couple_journal row was needed, none of it
 * was recorded, so there was nothing for the recipient to report and nothing
 * for a block to filter. Every push was an unattributable message.
 *
 * Now the body carries only the id of a message that already exists. The
 * route reads that row and takes the text, the sender and the household from
 * it, so a notification can never say anything the journal does not already
 * record, and can never claim an author it does not have. Anything a push can
 * deliver is now a row the recipient can report.
 *
 * The two remaining body fields are presentation only, and the worst a lie
 * costs is a less informative banner: `hide_text` withholds the snippet so the
 * partner has to open the app (how Eren-delivered messages stay a surprise),
 * and `to_notes` deep-links to the board rather than the chat.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/serverPush'
import { authorizeRequest } from '@/lib/apiAuth'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Body {
  message_id?: string
  /** Withhold the message text from the banner. */
  hide_text?: boolean
  /** Open the note board instead of the chat. */
  to_notes?: boolean
}

export async function POST(request: Request) {
  let body: Body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }

  const { message_id, hide_text, to_notes } = body
  if (!message_id) {
    return NextResponse.json({ error: 'missing message_id' }, { status: 400 })
  }

  // Session only. Unlike the sweep routes there is no cron caller here — this
  // fires from the sender's own client — so a cron secret must not stand in
  // for a person. Without a real userId there is no identity to check the
  // message against.
  const auth = await authorizeRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status })
  if (!auth.userId) return NextResponse.json({ error: 'session required' }, { status: 401 })

  const supabase = createAdminClient()

  const { data: msg } = await supabase
    .from('couple_journal')
    .select('id, household_id, sender_id, message, gift_item')
    .eq('id', message_id)
    .maybeSingle()

  if (!msg) return NextResponse.json({ error: 'no such message' }, { status: 404 })

  // You may only announce your own message. This is the check that makes the
  // row's contents trustworthy as the push payload: without it, any member
  // could point at a partner's row and re-push it at will.
  if (msg.sender_id !== auth.userId) {
    return NextResponse.json({ error: 'not your message' }, { status: 403 })
  }

  const { data: sender } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', auth.userId)
    .maybeSingle()

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('household_id', msg.household_id)
    .neq('user_id', auth.userId)

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no partner subs' })
  }

  const name = (sender?.name?.trim() || 'Your partner').slice(0, 32)
  const title = hide_text ? '💌 Eren' : `💌 ${name}`

  // A gift-only message has empty text, so the body describes the gift. Read
  // from the row rather than letting the client word it.
  const gift = msg.gift_item as { key?: string } | null
  const fallback = gift?.key ? `sent a ${String(gift.key).slice(0, 40)}!` : 'sent you a message through Eren'
  const snippet = hide_text
    ? 'Eren has a message for you — open to see it!'
    : (msg.message?.trim() || fallback).slice(0, 140)

  const expired: string[] = []
  let sent = 0

  for (const sub of subs) {
    const ok = await sendPush(
      { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
      title,
      snippet,
      to_notes ? 'eren-note' : 'partner-msg',
      to_notes ? '/notes' : '/couple',
    )
    if (ok) sent++
    else expired.push(sub.id)
  }

  if (expired.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expired)
  }

  return NextResponse.json({ ok: true, sent })
}
