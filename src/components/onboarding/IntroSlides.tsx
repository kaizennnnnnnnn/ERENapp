'use client'

// ═══════════════════════════════════════════════════════════════════════════
// INTRO SLIDES — four "meet Eren" cards: care+stats, economy, couple layer,
// and the notification opt-in (which this flow owns — home no longer
// ambushes new users with the native prompt). Button-first navigation with
// a light swipe assist; you can't pass slide 4 until the notification
// choice settles, then the CTA flies the user into /home on rainbow clouds.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import SketchEren, { type SketchErenState } from '@/components/SketchEren'
import {
  IconMeat, IconBath, IconMoonZ, IconLightning,
  IconCoin, IconController, IconCake, IconCapsule,
  IconHeartDuo, IconEnvelope, IconSwords, IconPhoto,
  IconBell,
} from '@/components/PixelIcons'
import { ObsidianChip } from '@/components/obsidian'
import { playSound } from '@/lib/sounds'
import { registerSW } from '@/lib/reminders'
import { requestNotificationPermission } from '@/lib/statNotifications'
import { subscribeToPush } from '@/lib/pushSubscription'
import { PixelButton, PixelLink } from './pixelForm'

type NotifState = 'idle' | 'asking' | 'granted' | 'denied' | 'unsupported'

interface SlideDef {
  heading: string
  body: string
  eren: SketchErenState
  chips: Array<{ Icon: React.ComponentType<{ size?: number }>; label: string }>
}

const SLIDES: SlideDef[] = [
  {
    heading: 'KEEP EREN ALIVE-ISH',
    body: 'Feed him, bathe him, play, tuck him in. His stats tick down in real time — even while you sleep.',
    eren: 'nom',
    chips: [
      { Icon: IconMeat, label: 'FEED' },
      { Icon: IconBath, label: 'WASH' },
      { Icon: IconMoonZ, label: 'SLEEP' },
      { Icon: IconLightning, label: 'PLAY' },
    ],
  },
  {
    heading: 'EARN. SPEND. REPEAT.',
    body: 'Minigames pay coins. Coins buy cake at the bakery — or a spin of the gacha.',
    eren: 'trophy',
    chips: [
      { Icon: IconController, label: 'GAMES' },
      { Icon: IconCoin, label: 'COINS' },
      { Icon: IconCake, label: 'BAKERY' },
      { Icon: IconCapsule, label: 'GACHA' },
    ],
  },
  {
    heading: 'BETTER TOGETHER',
    body: 'Share your mood, journal through Eren, battle daily, and fill the memory wall.',
    eren: 'love',
    chips: [
      { Icon: IconHeartDuo, label: 'MOODS' },
      { Icon: IconEnvelope, label: 'NOTES' },
      { Icon: IconSwords, label: 'BATTLE' },
      { Icon: IconPhoto, label: 'WALL' },
    ],
  },
  {
    heading: 'EREN WILL CALL YOU',
    body: "Get a nudge when he's hungry — or when your partner sends love.",
    eren: 'listen',
    chips: [],
  },
]

export default function IntroSlides({
  userId,
  householdId,
  inviteCode,
  onLaunch,
}: {
  userId: string
  householdId: string
  /** present only for the creator — kept visible so the code isn't lost */
  inviteCode: string | null
  onLaunch: () => void
}) {
  const [idx, setIdx] = useState(0)
  const [notif, setNotif] = useState<NotifState>('idle')
  const [skipped, setSkipped] = useState(false)
  const touchX = useRef(0)

  const isLast = idx === SLIDES.length - 1
  const settled = skipped || notif === 'granted' || notif === 'denied' || notif === 'unsupported'

  // Settle the choice automatically where there's nothing to ask: platforms
  // without the Notification API (iOS Safari before "Add to Home Screen"),
  // and resumed flows where permission was already granted. Effect-based so
  // SSR/hydration never sees window-dependent markup.
  useEffect(() => {
    if (!isLast || notif !== 'idle') return
    if (!('Notification' in window)) setNotif('unsupported')
    else if (Notification.permission === 'granted') setNotif('granted')
  }, [isLast, notif])

  function go(next: number) {
    if (next < 0 || next >= SLIDES.length) return
    playSound('ui_select')
    setIdx(next)
  }

  async function enable() {
    if (notif === 'asking') return
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotif('unsupported')
      return
    }
    if (Notification.permission === 'granted') {
      setNotif('granted')
      return
    }
    if (Notification.permission === 'denied') {
      setNotif('denied')
      return
    }
    setNotif('asking')
    // SW first — subscribeToPush awaits serviceWorker.ready and would hang
    // forever on an unregistered worker.
    registerSW()
    const granted = await requestNotificationPermission()
    if (granted) {
      playSound('quest_complete')
      setNotif('granted')
      subscribeToPush(userId, householdId).catch(() => {})
    } else {
      setNotif('denied')
    }
  }

  const slide = SLIDES[idx]
  const eren: SketchErenState = isLast
    ? notif === 'granted' ? 'party'
      : (notif === 'denied' || notif === 'unsupported' || skipped) ? 'chill'
      : 'listen'
    : slide.eren

  const unsupported = notif === 'unsupported'

  return (
    <div
      className="flex flex-col items-center text-center"
      style={{ gap: 14, minHeight: 380, justifyContent: 'flex-start' }}
      onTouchStart={e => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        const dx = e.changedTouches[0].clientX - touchX.current
        if (dx < -48 && !(isLast)) go(idx + 1)
        if (dx < -48 && isLast && settled) onLaunch()
        if (dx > 48) go(idx - 1)
      }}
    >
      {/* Header row: back chevron + creator's code chip */}
      <div className="flex items-center justify-between w-full" style={{ minHeight: 24 }}>
        {idx > 0 ? (
          <button type="button" onClick={() => go(idx - 1)} aria-label="Previous slide"
            className="font-pixel" style={{ fontSize: 10, color: '#A78BFA', background: 'none', padding: 4 }}>
            {'<'}
          </button>
        ) : <span />}
        {inviteCode && (
          <span className="font-pixel" style={{ fontSize: 6, letterSpacing: 1, color: '#7A6F96' }}>
            CODE: {inviteCode}
          </span>
        )}
      </div>

      <div key={idx} style={{ animation: 'onbPop 220ms cubic-bezier(0.34, 1.56, 0.64, 1) both' }}
        className="flex flex-col items-center" >
        <SketchEren state={eren} size={130} transparent noSpeech />

        <h1 className="font-pixel" style={{ fontSize: 11, letterSpacing: 1.5, color: '#F4EDFF', lineHeight: 1.8, marginTop: 10 }}>
          {isLast && settled && !unsupported ? 'ALL SET!' : slide.heading}
        </h1>

        <p style={{ fontSize: 13, lineHeight: 1.7, color: '#C9B8E8', maxWidth: 250, marginTop: 8 }}>
          {isLast
            ? unsupported
              ? "Notifications need Eren on your home screen. Install him later from Safari's share menu — flip this on in Profile."
              : notif === 'granted' ? 'Eren knows how to reach you. Time to head home.'
              : (notif === 'denied' || skipped) ? 'No worries — flip it on later in Profile. Time to head home.'
              : slide.body
            : slide.body}
        </p>

        {slide.chips.length > 0 && (
          <div className="flex flex-wrap justify-center" style={{ gap: 8, marginTop: 14 }}>
            {slide.chips.map(({ Icon, label }) => (
              <ObsidianChip key={label}>
                <Icon size={14} />
                <span className="font-pixel" style={{ fontSize: 6, letterSpacing: 1, color: '#C9B8E8' }}>
                  {label}
                </span>
              </ObsidianChip>
            ))}
          </div>
        )}

        {isLast && notif === 'granted' && (
          <div style={{ marginTop: 14 }}>
            <ObsidianChip>
              <IconBell size={14} />
              <span className="font-pixel" style={{ fontSize: 6, letterSpacing: 1, color: 'var(--accent-hi)' }}>
                ENABLED
              </span>
            </ObsidianChip>
          </div>
        )}
      </div>

      {/* Dots */}
      <div className="flex justify-center" style={{ gap: 8, marginTop: 'auto' }}>
        {SLIDES.map((_, i) => (
          <div key={i} style={{
            width: 8, height: 8,
            border: '2px solid #050507',
            boxShadow: '1px 1px 0 #050507',
            background: i === idx
              ? 'linear-gradient(180deg, var(--accent-hi), var(--accent-lo))'
              : '#181420',
          }} />
        ))}
      </div>

      {/* CTA area */}
      <div className="w-full flex flex-col items-center" style={{ gap: 10 }}>
        {!isLast && (
          <PixelButton variant="gold" onClick={() => go(idx + 1)}>NEXT</PixelButton>
        )}
        {isLast && !settled && (
          <>
            <PixelButton variant="gold" onClick={enable} disabled={notif === 'asking'}>
              <span className="inline-flex items-center" style={{ gap: 8 }}>
                <IconBell size={14} />
                {notif === 'asking' ? '...' : 'ENABLE NOTIFICATIONS'}
              </span>
            </PixelButton>
            <PixelLink onClick={() => setSkipped(true)}>SKIP FOR NOW</PixelLink>
          </>
        )}
        {isLast && settled && (
          <PixelButton variant="pink" onClick={onLaunch}>ENTER THE HOUSE</PixelButton>
        )}
      </div>
    </div>
  )
}
