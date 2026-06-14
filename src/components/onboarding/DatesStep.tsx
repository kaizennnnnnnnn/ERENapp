'use client'

// ═══════════════════════════════════════════════════════════════════════════
// DATES STEP — collected right after moving in. Three special dates so Eren
// never forgets a celebration (they power the daily/weekly anniversary push +
// the profile countdown strip):
//   • your birthday      → profiles.birthday      (per-partner)
//   • Eren's birthday     → households.eren_birthday      (shared)
//   • when you two met    → households.couple_anniversary (shared)
//
// All optional — a "skip for now" link advances without writing, and every
// field is editable later on the profile page. The shared dates are prefilled
// from the household so a joining partner sees whatever the creator already set.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import SketchEren from '@/components/SketchEren'
import { createClient } from '@/lib/supabase/client'
import { PixelButton, PixelInput, PixelLink } from './pixelForm'

export default function DatesStep({
  userId,
  householdId,
  demo = false,
  onDone,
}: {
  userId: string
  householdId: string
  demo?: boolean
  onDone: () => void
}) {
  const supabase = createClient()
  const [myBirthday, setMyBirthday]               = useState('')
  const [erenBirthday, setErenBirthday]           = useState('')
  const [coupleAnniversary, setCoupleAnniversary] = useState('')
  const [saving, setSaving]                       = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  // Prefill from whatever's already stored — the partner who set up the
  // household may have entered Eren's birthday + the anniversary already.
  useEffect(() => {
    if (demo) return
    let cancelled = false
    void (async () => {
      const [profRes, hhRes] = await Promise.all([
        supabase.from('profiles').select('birthday').eq('id', userId).maybeSingle(),
        supabase.from('households').select('eren_birthday, couple_anniversary').eq('id', householdId).maybeSingle(),
      ])
      if (cancelled) return
      const b = profRes.data?.birthday as string | null | undefined
      const e = hhRes.data?.eren_birthday as string | null | undefined
      const c = hhRes.data?.couple_anniversary as string | null | undefined
      if (b) setMyBirthday(b)
      if (e) setErenBirthday(e)
      if (c) setCoupleAnniversary(c)
    })()
    return () => { cancelled = true }
  }, [demo, userId, householdId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (saving) return
    if (demo) { onDone(); return }
    setSaving(true)
    await Promise.all([
      supabase.from('profiles').update({ birthday: myBirthday || null }).eq('id', userId),
      supabase.from('households').update({
        eren_birthday:      erenBirthday || null,
        couple_anniversary: coupleAnniversary || null,
      }).eq('id', householdId),
    ])
    setSaving(false)
    onDone()
  }

  const dateStyle = { colorScheme: 'dark' as const }

  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <div className="flex items-center" style={{ gap: 12 }}>
        <SketchEren state="point" size={84} transparent noSpeech />
        <h1 className="font-pixel" style={{ fontSize: 12, letterSpacing: 1.5, color: '#F4EDFF', lineHeight: 1.6 }}>
          SPECIAL
          <br />
          DATES
        </h1>
      </div>

      <p style={{ fontSize: 12, lineHeight: 1.7, color: '#C9B8E8' }}>
        So Eren never forgets a celebration. You can change these anytime in your profile.
      </p>

      <PixelInput label="YOUR BIRTHDAY" type="date" max={today} style={dateStyle}
        value={myBirthday} onChange={e => setMyBirthday(e.target.value)} />
      <PixelInput label="EREN'S BIRTHDAY" type="date" max={today} style={dateStyle}
        value={erenBirthday} onChange={e => setErenBirthday(e.target.value)} />
      <PixelInput label="WHEN YOU TWO MET" type="date" max={today} style={dateStyle}
        value={coupleAnniversary} onChange={e => setCoupleAnniversary(e.target.value)} />

      <PixelButton variant="gold" onClick={save} disabled={saving}>
        {saving ? '...' : 'SAVE & CONTINUE'}
      </PixelButton>

      <div className="flex justify-center">
        <PixelLink onClick={onDone}>Skip for now</PixelLink>
      </div>
    </div>
  )
}
