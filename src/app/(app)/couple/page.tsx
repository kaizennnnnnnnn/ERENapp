'use client'

// ─── Us ──────────────────────────────────────────────────────────────────────
// The Meadow "Us" tab (board A3). This file is the data half: it reads the
// couple (useCouple), my streak (useTasks) and the cat (useErenStats), turns
// them into the plain shapes in couple/us/usModel and hands them to UsView.
//
// Everything the old obsidian page did is still here, moved rather than
// dropped: the day count and next milestone (hero), the cozy countdown, the
// partner's mood and week, the nudges (now four one-tap tiles instead of a
// picker sheet), the note board, the care battle with the season strip folded
// into it, the journal (preview on the page, the whole chat in a sheet, hold a
// message to report or delete it), the weekly champion popup, and marking the
// journal read. The back button went: the tab bar is the way out now.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useErenStats } from '@/hooks/useErenStats'
import { usePageReady } from '@/hooks/usePageReady'
import { useCare } from '@/contexts/CareContext'
import { useTasks } from '@/contexts/TaskContext'
import { timeUntilWeekReset } from '@/lib/couple'
import { NUDGE_DEFS } from '@/lib/nudges'
import { FOOD_META } from '@/lib/foodMeta'
import { EREN_OPPONENT_ID } from '@/lib/erenOpponent'
import { catIdentityFromStats } from '@/lib/catIdentity'
import { playSound } from '@/lib/sounds'
import { MeadowPage, PERSON, personColor } from '@/components/meadow'
import CozyCountdown from '@/components/couple/CozyCountdown'
import WeeklyChampionPopup from '@/components/couple/WeeklyChampionPopup'
import MessageActions from '@/components/safety/MessageActions'
import UsView from '@/components/couple/us/UsView'
import JournalSheet from '@/components/couple/us/JournalSheet'
import {
  togetherInfo,
  type BattleInfo, type BattleSide, type JournalEntry, type LoveTrayState, type NotesInfo,
  type NudgeId, type SeasonInfo, type UsPerson,
} from '@/components/couple/us/usModel'
import type { JournalMessage } from '@/types'

const firstName = (name: string | null | undefined): string => (name ?? '').trim().split(/\s+/)[0] ?? ''

// A nudge from the tray and a journal message fail the same way, so they say
// the same thing.
const SEND_FAILED = "That didn't send. Check your connection and try again."

export default function CouplePage() {
  const supabase = useMemo(() => createClient(), [])
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  const {
    partner, partnerStreak, isSolo, loveMeter, anniversary, journal,
    partnerMood, partnerMoodWeek, lifetimeWLT, weeklyChampion, claimWeeklyChampion,
    notes, unreadNotes, sendMessage, sendNudge, deleteMessage, markAllRead, loading, refetch,
  } = useCouple()
  const { streak: myStreak } = useTasks()
  const { stats } = useErenStats(profile?.household_id ?? null)
  const householdId = profile?.household_id ?? null

  // The Meadow page carries its own title row; the old HUD steps aside here.
  useEffect(() => {
    setHideStats(true)
    return () => setHideStats(false)
  }, [setHideStats])

  // Being on this page is reading the journal: its newest line sits on the
  // card. Marked on arrival (the old page's rule) and again when a new line
  // lands while the page is in front, so the Us tab doesn't dot itself while
  // you are on it. A line that arrives while the app is in the background
  // stays unread until you actually come back to it.
  const newestId = journal[0]?.id
  useEffect(() => {
    if (document.visibilityState === 'visible') markAllRead()
  }, [newestId]) // eslint-disable-line react-hooks/exhaustive-deps
  // ...and coming back is the other half. That line changed newestId while
  // the page was hidden, so the effect above has already run and skipped it,
  // and useCouple's own foreground refetch then recounts it as unread: the Us
  // tab would dot itself over the very card showing the message. The stamp
  // lands before that refetch resolves, so its recount agrees.
  useEffect(() => onForeground(markAllRead), [markAllRead])

  // Time to Monday 00:00, resolved after mount and refreshed each minute. A
  // clock read during render would be baked into the prerendered HTML and
  // disagree with every visitor's browser (a hydration mismatch).
  const [reset, setReset] = useState<ReturnType<typeof timeUntilWeekReset> | null>(null)
  useEffect(() => {
    const tick = () => setReset(timeUntilWeekReset())
    tick()
    const t = setInterval(tick, 60 * 1000)
    return () => clearInterval(t)
  }, [])

  // The day the household began, for the postmark on the hero. useCouple only
  // keeps the day COUNT, and working the date back from it lands a day late
  // whenever the household was made in the evening.
  const [since, setSince] = useState<Date | null>(null)
  useEffect(() => {
    if (!householdId) return
    let live = true
    void withRetry(() => supabase
      .from('households')
      .select('created_at')
      .eq('id', householdId)
      .maybeSingle())
      .then(({ data, error }) => {
        if (!live) return
        // A failed read only costs the postmark (the count comes from
        // useCouple); the next visit tries again.
        if (error) { console.error('[Us] household read failed', error); return }
        if (data?.created_at) setSince(new Date(data.created_at as string))
      })
    return () => { live = false }
  }, [supabase, householdId])

  // ── The love tray ──
  // The four NUDGE_DEFS send straight from a tap. One at a time: a second tap
  // while one is in flight is dropped rather than queued.
  const [tray, setTray] = useState<LoveTrayState>({ sent: {}, busy: null, error: null })
  const trayBusy = useRef(false)
  const sendLove = useCallback(async (id: NudgeId, from: 'cta' | 'tray') => {
    const def = NUDGE_DEFS.find(n => n.id === id)
    if (!def || trayBusy.current) return
    trayBusy.current = true
    playSound('ui_tap')
    setTray(t => ({ ...t, busy: id, error: null }))
    let ok = false
    try {
      ok = await sendNudge(def)
    } catch (err) {
      console.error('[Us] nudge failed', err)
    }
    trayBusy.current = false
    setTray(t => ok
      ? { sent: { ...t.sent, [id]: true }, busy: null, error: null }
      : { ...t, busy: null, error: { from, message: SEND_FAILED } })
  }, [sendNudge])
  const sendLoveFromCta = useCallback(() => { void sendLove('loveyou', 'cta') }, [sendLove])
  const sendLoveFromTray = useCallback((id: NudgeId) => { void sendLove(id, 'tray') }, [sendLove])

  // ── The journal sheet ──
  const [journalOpen, setJournalOpen] = useState(false)
  // The held message whose report/delete sheet is open, if any.
  const [actionOn, setActionOn] = useState<JournalMessage | null>(null)
  const [journalError, setJournalError] = useState<string | null>(null)
  const openJournal = useCallback(() => {
    playSound('ui_modal_open')
    setJournalError(null)
    setJournalOpen(true)
    markAllRead()
  }, [markAllRead])
  // Escape and the backdrop close the actions sheet first, then the journal.
  const closeJournal = useCallback(() => {
    if (actionOn) { setActionOn(null); return }
    playSound('ui_modal_close')
    setJournalOpen(false)
    setJournalError(null)
  }, [actionOn])
  const holdMessage = useCallback((id: string) => {
    const m = journal.find(j => j.id === id)
    if (m) setActionOn(m)
  }, [journal])
  // Resolves false when the message did not go out, so the sheet keeps what
  // was typed; the error slot under the compose row says why.
  const sendToJournal = useCallback(async (text: string): Promise<boolean> => {
    playSound('ui_tap')
    setJournalError(null)
    let ok = false
    try {
      ok = await sendMessage(text)
    } catch (err) {
      console.error('[Us] journal send failed', err)
    }
    if (!ok) setJournalError(SEND_FAILED)
    return ok
  }, [sendMessage])

  // Local "closed the weekly popup this session" flag: hides it at once on a
  // backdrop tap, before the server ack lands.
  const [weeklyDismissed, setWeeklyDismissed] = useState(false)

  usePageReady(!loading)

  // Every hook is above this line: `loading` is true on the first render of a
  // cold visit, and a hook below an early return would crash the page.
  if (loading || !user || !profile) {
    return <MeadowPage ground="us" title="Us"><span /></MeadowPage>
  }

  const cat = catIdentityFromStats(stats)
  // The household has two colours, so "not mine" is the other one: used for a
  // partner row with no colour stamped, and a sender we can no longer name.
  const otherColor = profile.heart === 'brown_heart' ? PERSON.pink : PERSON.brown
  const me: UsPerson = { name: firstName(profile.name) || 'You', color: personColor(profile.heart) }
  const them: UsPerson | null = partner
    ? { name: firstName(partner.name) || 'Your partner', color: partner.heart ? personColor(partner.heart) : otherColor }
    : null
  // Solo, the cat holds the other seat (title row, battle), in Eren's gold.
  const catSeat: UsPerson = { name: cat.name, color: PERSON.eren }

  // The partner read failed (not the same answer as "no partner"): say so and
  // offer a retry, instead of quietly showing half a page.
  const partnerUnknown = !isSolo && !partner

  const toEntry = (m: JournalMessage): JournalEntry => {
    const mine = m.sender_id === user.id
    const who: UsPerson = mine ? me
      : them && m.sender_id === partner?.id ? them
        : { name: firstName(m.profile?.name) || 'Partner', color: m.profile?.heart ? personColor(m.profile.heart) : otherColor }
    return { id: m.id, text: m.message, mine, name: who.name, color: who.color, at: m.created_at }
  }
  const lastMessage = journal[0] ? toEntry(journal[0]) : null
  // useCouple keeps the newest first; a chat reads oldest first. Built even
  // while the sheet is shut (at most 50 rows): it stays on screen through its
  // closing slide, and an empty list there would flash "No messages yet".
  const messages = [...journal].reverse().map(toEntry)

  // The note board, newest first. Unread notes are my partner's newest ones
  // (useCouple counts those newer than my last visit), so the first
  // `unreadNotes` of theirs in this order are exactly the unread ones.
  let partnerNotesSeen = 0
  const notesInfo: NotesInfo = {
    count: notes.length,
    unread: unreadNotes,
    preview: notes.slice(0, 3).map(n => {
      const fromPartner = n.sender_id !== user.id
      const unread = fromPartner && partnerNotesSeen++ < unreadNotes
      const key = n.gift_item?.key
      return { id: n.id, gift: key && FOOD_META[key] ? key : null, unread }
    }),
  }

  const battle: BattleInfo | null = loveMeter ? (() => {
    const mineRaw = loveMeter.user1.id === user.id ? loveMeter.user1 : loveMeter.user2
    const theirsRaw = mineRaw === loveMeter.user1 ? loveMeter.user2 : loveMeter.user1
    const other: UsPerson = theirsRaw.id === EREN_OPPONENT_ID ? catSeat
      : them && theirsRaw.id === partner?.id ? them
        : { name: firstName(theirsRaw.name) || 'Partner', color: otherColor }
    const side = (p: UsPerson, raw: typeof mineRaw): BattleSide => ({ ...p, score: raw.score, pct: raw.pct })

    const rec = lifetimeWLT && lifetimeWLT.days > 0 ? lifetimeWLT : null
    const mine = myStreak.current ?? 0
    const theirs = partnerStreak?.current ?? 0
    // The cat keeps no care streak of its own (a pace-setter, not a second
    // carer), so solo the streak rows are one-sided rather than a comparison
    // against a permanent zero.
    const hasStreak = partner ? mine > 0 || theirs > 0 : mine > 0
    const season: SeasonInfo = {
      record: rec ? { mine: rec.myWins, ties: rec.ties, theirs: rec.partnerWins } : null,
      streak: hasStreak ? {
        mine,
        myBest: myStreak.best ?? 0,
        theirs: partner ? theirs : null,
        theirBest: partner ? partnerStreak?.best ?? 0 : null,
      } : null,
    }
    return {
      me: side(me, mineRaw),
      them: side(other, theirsRaw),
      total: loveMeter.total,
      season: season.record || season.streak ? season : null,
    }
  })() : null

  return (
    <>
      <UsView
        me={me}
        partner={them}
        isSolo={isSolo}
        cat={{ name: cat.name, look: cat.look }}
        companion={them ?? (isSolo ? catSeat : null)}
        together={anniversary ? togetherInfo(anniversary, since) : null}
        countdown={partner && householdId ? (
          // Advent doors in the 12 days before the anniversary; renders
          // nothing outside that window or without an anniversary set.
          <CozyCountdown householdId={householdId} userId={user.id} partnerFirstName={them?.name ?? null} />
        ) : null}
        partnerMood={partnerMood}
        partnerWeek={partnerMoodWeek}
        tray={tray}
        onSendLove={sendLoveFromCta}
        onSendNudge={sendLoveFromTray}
        notes={notesInfo}
        onOpenNotes={() => playSound('ui_tap')}
        battle={battle}
        reset={reset}
        lastMessage={lastMessage}
        onOpenJournal={openJournal}
        loadError={partnerUnknown ? { onRetry: () => { playSound('ui_tap'); void refetch() } } : null}
      />

      <JournalSheet
        open={journalOpen}
        onClose={closeJournal}
        catName={cat.name}
        messages={messages}
        isSolo={isSolo}
        partnerName={them?.name ?? null}
        onSend={sendToJournal}
        onHold={holdMessage}
        error={journalError}
        overlay={actionOn && (
          <MessageActions
            target="message"
            targetId={actionOn.id}
            what="this message"
            preview={actionOn.message}
            onDelete={actionOn.sender_id === user.id
              ? async () => {
                const ok = await deleteMessage(actionOn.id)
                if (!ok) setJournalError("That message couldn't be deleted. Try again.")
              }
              : undefined}
            onClose={() => setActionOn(null)}
          />
        )}
      />

      {/* Last week's care battle, once per ISO week per user. Not gated on a
          partner: a household of one settles the week against the cat. The
          local flag hides it at once; the ack is fire-and-forget. */}
      {weeklyChampion && !weeklyChampion.acknowledged && !weeklyDismissed && (
        <WeeklyChampionPopup
          row={weeklyChampion}
          partnerFirstName={them?.name ?? cat.name}
          onClaim={claimWeeklyChampion}
          onClose={() => {
            setWeeklyDismissed(true)
            void claimWeeklyChampion()
          }}
        />
      )}
    </>
  )
}
