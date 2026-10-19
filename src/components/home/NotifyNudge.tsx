'use client'

// ─── NotifyNudge ─────────────────────────────────────────────────────────────
// A slim white pill under the home row that gets this phone signed up for
// push, for the two cases nothing else ever caught:
//
//   iPhone, in a Safari tab   Web push does not exist there at all — not
//                             even with notifications allowed in Settings.
//                             Only a site added to the Home Screen gets it,
//                             so "How" opens a sheet with the two steps.
//   asked nowhere yet          Onboarding asks once, but an iPhone that
//                             onboarded in Safari and then added the icon
//                             starts the Home Screen app with permission
//                             'default', and nothing asked again. "Turn on"
//                             does the same ask + subscribe as onboarding
//                             (useNotifyStep).
//
// A pill, not a card: the band under the home row is shared with the light
// switch, the battle plate and Eren's whisper bubble, and a card ran into all
// three. It shows nothing once the phone is subscribed, when permission was
// already granted (home re-subscribes those itself), on a desktop without
// push, or for three days after the close circle.

import { useEffect, useState } from 'react'
import { useNotifyStep } from '@/components/onboarding/useNotifyStep'
import { useCat } from '@/hooks/useCat'
import { playSound } from '@/lib/sounds'
import { M, MeadowIcon, PrimaryButton, SecondaryButton, Sheet, TINT } from '@/components/meadow'

const SNOOZE_KEY = 'eren_notify_nudge_until'
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000

type Need = 'none' | 'install' | 'ask'

function isIos(): boolean {
  const ua = navigator.userAgent
  // iPadOS reports itself as a Mac; a touch screen gives it away.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

function isStandalone(): boolean {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
    || window.matchMedia('(display-mode: standalone)').matches
}

/** What this phone needs, read once after mount (it is all browser state). */
function readNeed(): Need {
  try {
    const until = Number(localStorage.getItem(SNOOZE_KEY) ?? 0)
    if (until > Date.now()) return 'none'
  } catch { /* private mode: just show it */ }
  const pushable = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
  if (!pushable) return isIos() && !isStandalone() ? 'install' : 'none'
  return Notification.permission === 'default' ? 'ask' : 'none'
}

export default function NotifyNudge({ userId, householdId, partnerName }: {
  userId: string | null
  householdId: string | null
  /** First name; null for a household of one. */
  partnerName: string | null
}) {
  const cat = useCat()
  const [need, setNeed] = useState<Need>('none')
  const [howOpen, setHowOpen] = useState(false)
  useEffect(() => { setNeed(readNeed()) }, [])

  const notify = useNotifyStep({
    userId, householdId, demo: false,
    onDone: () => setNeed('none'),
  })

  function snooze() {
    playSound('ui_modal_close')
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)) } catch { /* ignore */ }
    setNeed('none')
  }

  if (need === 'none') return null

  const blocked = notify.state === 'denied'
  const failed = notify.state === 'failed'
  const label = blocked ? 'Notifications are off' : failed ? "Didn't sign up" : 'Get notifications'
  // Install and blocked both need steps outside the app, so both open the
  // sheet; the rest is one tap.
  const needsSteps = need === 'install' || blocked

  return (
    <>
      <div className="meadow-root flex items-center" role="region" aria-label="Notifications" style={{
        marginTop: 8, height: 48, boxSizing: 'border-box', padding: '0 4px 0 6px', gap: 8,
        borderRadius: 999, background: '#FFFFFF', boxShadow: `0 3px 0 ${M.overArtLip}`,
        animation: 'nudgeIn 0.28s cubic-bezier(0.34,1.4,0.64,1) both',
      }}>
        <span aria-hidden className="flex items-center justify-center flex-shrink-0" style={{
          width: 36, height: 36, borderRadius: 999, background: TINT.amber,
        }}>
          <MeadowIcon name="bell" size={22} />
        </span>
        <span className="flex-1 min-w-0" style={{
          fontSize: 15, fontWeight: 800, color: M.text,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {label}
        </span>
        {needsSteps ? (
          <PrimaryButton size="sm" onClick={() => { playSound('ui_modal_open'); setHowOpen(true) }}
            style={{ height: 36, padding: '0 16px', fontSize: 14 }}>
            How
          </PrimaryButton>
        ) : (
          <PrimaryButton size="sm" busy={notify.state === 'asking'}
            onClick={() => { playSound('ui_tap'); void notify.enable() }}
            style={{ height: 36, padding: '0 14px', fontSize: 14 }}>
            {failed ? 'Try again' : 'Turn on'}
          </PrimaryButton>
        )}
        <button type="button" onClick={snooze} aria-label="Not now" className="m-press m-focus flex items-center justify-center flex-shrink-0"
          style={{ width: 36, height: 36, border: 0, borderRadius: 999, background: 'transparent', cursor: 'pointer' }}>
          <MeadowIcon name="close" size={16} color={M.faint} />
        </button>
      </div>

      <Sheet open={howOpen} onClose={() => { playSound('ui_modal_close'); setHowOpen(false) }}
        title={need === 'install' ? 'Notifications on iPhone' : 'Turn notifications back on'}
        footer={<SecondaryButton onClick={() => { playSound('ui_modal_close'); setHowOpen(false) }}>Got it</SecondaryButton>}>
        <p style={{ margin: '0 0 14px', fontSize: 15, lineHeight: 1.45, fontWeight: 500, color: M.text2 }}>
          {need === 'install'
            ? `iPhones only send notifications to apps on the Home Screen, not to Safari tabs. ${partnerName ? `So you hear when ${cat.name} needs you or ${partnerName} sends something:` : `So you hear when ${cat.name} needs you:`}`
            : 'Your phone is set to block them for Eren. To hear from Eren again:'}
        </p>
        <ol className="flex flex-col" style={{ margin: 0, padding: 0, listStyle: 'none', gap: 8 }}>
          {(need === 'install' ? [
            <>Tap <Glyph><MeadowIcon name="share" size={18} color={M.text} /></Glyph> <b>Share</b> at the bottom of Safari.</>,
            <>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</>,
            <>Open Eren from the new icon on your Home Screen.</>,
            <>Tap <b>Get notifications</b> there and allow them.</>,
          ] : [
            <>Open your phone&apos;s <b>Settings</b>, then <b>Notifications</b>.</>,
            <>Find <b>Eren</b> and switch on <b>Allow Notifications</b>.</>,
            <>Come back to Eren. That&apos;s it.</>,
          ]).map((step, i) => (
            <li key={i} className="flex items-center" style={{ gap: 12, padding: '10px 12px', borderRadius: 16, background: M.soft }}>
              <span aria-hidden className="flex items-center justify-center flex-shrink-0" style={{
                width: 28, height: 28, borderRadius: 999, background: '#FFFFFF',
                fontSize: 14, fontWeight: 800, color: M.leafInk,
              }}>{i + 1}</span>
              <span style={{ fontSize: 15, lineHeight: 1.4, fontWeight: 500, color: M.text }}>{step}</span>
            </li>
          ))}
        </ol>
      </Sheet>

      <style>{`
        @keyframes nudgeIn {
          0%   { transform: translateY(-6px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) { [style*="nudgeIn"] { animation: none !important; } }
      `}</style>
    </>
  )
}

/** An inline icon sitting on the text line, like the button it names. */
function Glyph({ children }: { children: React.ReactNode }) {
  return <span style={{ display: 'inline-flex', verticalAlign: '-3px' }}>{children}</span>
}
