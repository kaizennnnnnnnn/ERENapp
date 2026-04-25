import webpush from 'web-push'

// ═══════════════════════════════════════════════════════════════════════════════
// SERVER-SIDE WEB PUSH — sends notifications even when app is closed
// ═══════════════════════════════════════════════════════════════════════════════

const VAPID_PUBLIC  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? ''
const APP_URL       = process.env.NEXT_PUBLIC_APP_URL ?? 'https://eren-care-app.vercel.app'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(`mailto:noreply@${new URL(APP_URL).hostname}`, VAPID_PUBLIC, VAPID_PRIVATE)
}

interface PushSub {
  endpoint: string
  p256dh: string
  auth: string
}

export async function sendPush(sub: PushSub, title: string, body: string, tag?: string): Promise<boolean> {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify({ title, body, tag: tag ?? 'eren-stat', url: '/home' }),
    )
    return true
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode
    // 410 = subscription expired, 404 = invalid
    if (status === 410 || status === 404) return false // caller should delete this sub
    console.warn('Push failed:', err)
    return true // keep sub, transient error
  }
}

// ── Stat threshold checks ────────────────────────────────────────────────────

interface StatValues {
  happiness: number
  hunger: number
  energy: number
  sleep_quality: number
  cleanliness: number
  is_sick: boolean
}

interface OldStatValues {
  happiness: number
  hunger: number
  energy: number
  sleep_quality: number
  cleanliness: number
  is_sick: boolean
}

interface StatAlert {
  key: keyof Omit<StatValues, 'is_sick'>
  icon: string
  warningMsg: string
  criticalMsg: string
}

const STAT_ALERTS: StatAlert[] = [
  { key: 'hunger',        icon: '🍗', warningMsg: 'Eren is getting hungry!',       criticalMsg: 'Eren is starving! Feed him now!' },
  { key: 'happiness',     icon: '💕', warningMsg: 'Eren is feeling a bit down...', criticalMsg: 'Eren is very sad! Play with him!' },
  { key: 'energy',        icon: '⚡', warningMsg: 'Eren is getting tired.',         criticalMsg: 'Eren has no energy! Let him rest!' },
  { key: 'sleep_quality', icon: '💤', warningMsg: 'Eren needs some rest soon.',    criticalMsg: 'Eren is exhausted! Put him to bed!' },
  { key: 'cleanliness',   icon: '🛁', warningMsg: 'Eren is getting a bit dirty.',  criticalMsg: 'Eren is filthy! Give him a bath!' },
]

/**
 * Return every applicable notification based on the CURRENT stat values.
 * State-based (not transition-based): if a stat is at/below the threshold
 * right now, the corresponding notification is a candidate. The caller is
 * expected to apply the per-tag cooldown (eren_stats.last_notified_at) to
 * decide which ones actually go out — that combo means we never miss a
 * threshold the client crossed before the server saw it, and we never
 * spam the user because cooldown blocks the same tag for 2h.
 */
export function getStatNotifications(stats: StatValues, _legacy?: OldStatValues): { title: string; body: string; tag: string }[] {
  // _legacy kept so older callers still type-check; ignored at runtime.
  void _legacy

  const notifs: { title: string; body: string; tag: string }[] = []

  for (const alert of STAT_ALERTS) {
    const val = stats[alert.key]
    if (val <= 10) {
      notifs.push({ title: `${alert.icon} Eren`, body: alert.criticalMsg, tag: `stat-${alert.key}-crit` })
    } else if (val <= 50) {
      notifs.push({ title: `${alert.icon} Eren`, body: alert.warningMsg, tag: `stat-${alert.key}-warn` })
    }
  }

  if (stats.is_sick) {
    notifs.push({ title: '💊 Eren', body: 'Eren is sick! Take him to the vet!', tag: 'stat-sick' })
  }

  return notifs
}
