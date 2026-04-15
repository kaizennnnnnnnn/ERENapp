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
 * Compare old vs new stats and return notifications to send.
 * Only triggers on transitions: ok→warning, ok/warning→critical
 */
export function getStatNotifications(oldStats: OldStatValues, newStats: StatValues): { title: string; body: string; tag: string }[] {
  const notifs: { title: string; body: string; tag: string }[] = []

  for (const alert of STAT_ALERTS) {
    const oldVal = oldStats[alert.key]
    const newVal = newStats[alert.key]

    const oldLevel = oldVal <= 10 ? 'critical' : oldVal <= 50 ? 'warning' : 'ok'
    const newLevel = newVal <= 10 ? 'critical' : newVal <= 50 ? 'warning' : 'ok'

    // Warning transition
    if (newLevel === 'warning' && oldLevel === 'ok') {
      notifs.push({ title: `${alert.icon} Pocket Eren`, body: alert.warningMsg, tag: `stat-${alert.key}-warn` })
    }
    // Critical transition
    if (newLevel === 'critical' && oldLevel !== 'critical') {
      notifs.push({ title: `${alert.icon} Pocket Eren`, body: alert.criticalMsg, tag: `stat-${alert.key}-crit` })
    }
  }

  // Sickness
  if (newStats.is_sick && !oldStats.is_sick) {
    notifs.push({ title: '💊 Pocket Eren', body: 'Eren is sick! Take him to the vet!', tag: 'stat-sick' })
  }

  return notifs
}
