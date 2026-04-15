import type { ErenStats } from '@/types'

// ═══════════════════════════════════════════════════════════════════════════════
// STAT NOTIFICATIONS — alerts when Eren's stats drop to warning/critical levels
// ═══════════════════════════════════════════════════════════════════════════════

interface StatAlert {
  key: string
  label: string
  icon: string
  warningMsg: string   // at 50%
  criticalMsg: string  // at 10% or below
}

const STAT_ALERTS: StatAlert[] = [
  { key: 'hunger',        label: 'Hunger',      icon: '🍗', warningMsg: 'Eren is getting hungry!',            criticalMsg: 'Eren is starving! Feed him now!' },
  { key: 'happiness',     label: 'Happiness',   icon: '💕', warningMsg: 'Eren is feeling a bit down...',      criticalMsg: 'Eren is very sad! Play with him!' },
  { key: 'energy',        label: 'Energy',      icon: '⚡', warningMsg: 'Eren is getting tired.',              criticalMsg: 'Eren has no energy! Let him rest!' },
  { key: 'sleep_quality', label: 'Sleep',       icon: '💤', warningMsg: 'Eren needs some rest soon.',         criticalMsg: 'Eren is exhausted! Put him to bed!' },
  { key: 'cleanliness',   label: 'Cleanliness', icon: '🛁', warningMsg: 'Eren is getting a bit dirty.',       criticalMsg: 'Eren is filthy! Give him a bath!' },
]

const STORAGE_KEY = 'eren_stat_notifs'

// Get the last notification level we sent for each stat (to avoid spam)
function getNotifState(): Record<string, 'ok' | 'warning' | 'critical'> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveNotifState(state: Record<string, 'ok' | 'warning' | 'critical'>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

async function sendNotification(title: string, body: string) {
  // Try native notification API first
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker?.ready
      if (reg) {
        reg.showNotification(title, {
          body,
          icon: '/ErenIcon.png',
          badge: '/ErenIcon.png',
          tag: `stat-${Date.now()}`,
        } as NotificationOptions)
        return
      }
    } catch { /* fallback below */ }
    new Notification(title, { body, icon: '/ErenIcon.png' })
  }
}

export function checkStatNotifications(stats: ErenStats) {
  if (!stats) return

  const state = getNotifState()
  let changed = false

  for (const alert of STAT_ALERTS) {
    const val = (stats as unknown as Record<string, number>)[alert.key] ?? 100
    const prevLevel = state[alert.key] ?? 'ok'

    let newLevel: 'ok' | 'warning' | 'critical' = 'ok'
    if (val <= 10) newLevel = 'critical'
    else if (val <= 50) newLevel = 'warning'

    // Only notify on transitions (getting worse), not on every check
    if (newLevel === 'warning' && prevLevel === 'ok') {
      sendNotification(`${alert.icon} Pocket Eren`, alert.warningMsg)
      changed = true
    } else if (newLevel === 'critical' && prevLevel !== 'critical') {
      sendNotification(`${alert.icon} Pocket Eren`, alert.criticalMsg)
      changed = true
    }

    // Also notify if sick
    if (alert.key === 'cleanliness' && stats.is_sick && prevLevel !== 'critical') {
      sendNotification('💊 Pocket Eren', 'Eren is sick! Take him to the vet!')
      state['is_sick'] = 'critical'
      changed = true
    }

    state[alert.key] = newLevel
  }

  // Sickness check
  if (stats.is_sick && state['is_sick'] !== 'critical') {
    sendNotification('💊 Pocket Eren', 'Eren is sick! Take him to the vet!')
    state['is_sick'] = 'critical'
    changed = true
  } else if (!stats.is_sick) {
    state['is_sick'] = 'ok'
    changed = true
  }

  if (changed) saveNotifState(state)
}

// ── Partner action notifications ─────────────────────────────────────────────

const ACTION_LABELS: Record<string, { icon: string; verb: string }> = {
  feed:     { icon: '🍗', verb: 'fed Eren' },
  play:     { icon: '🧶', verb: 'played with Eren' },
  sleep:    { icon: '💤', verb: 'put Eren to sleep' },
  wash:     { icon: '🛁', verb: 'gave Eren a bath' },
  medicine: { icon: '💊', verb: 'gave Eren medicine' },
}

export function notifyPartnerAction(partnerName: string, actionType: string) {
  const action = ACTION_LABELS[actionType]
  if (!action) return
  sendNotification(
    `${action.icon} Pocket Eren`,
    `${partnerName} ${action.verb}!`,
  )
}

export function notifyPartnerMessage(partnerName: string) {
  sendNotification(
    '💌 Pocket Eren',
    `${partnerName} sent you a message through Eren!`,
  )
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}
