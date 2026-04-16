import type { ErenStats } from '@/types'

// ═══════════════════════════════════════════════════════════════════════════════
// STAT NOTIFICATIONS — client-side alerts when stats drop
// Uses localStorage to track what was already notified + cooldowns
// ═══════════════════════════════════════════════════════════════════════════════

interface StatAlert {
  key: string
  icon: string
  warningMsg: string
  criticalMsg: string
}

const STAT_ALERTS: StatAlert[] = [
  { key: 'hunger',        icon: '🍗', warningMsg: 'Eren is getting hungry!',            criticalMsg: 'Eren is starving! Feed him now!' },
  { key: 'happiness',     icon: '💕', warningMsg: 'Eren is feeling a bit down...',      criticalMsg: 'Eren is very sad! Play with him!' },
  { key: 'energy',        icon: '⚡', warningMsg: 'Eren is getting tired.',              criticalMsg: 'Eren has no energy! Let him rest!' },
  { key: 'sleep_quality', icon: '💤', warningMsg: 'Eren needs some rest soon.',         criticalMsg: 'Eren is exhausted! Put him to bed!' },
  { key: 'cleanliness',   icon: '🛁', warningMsg: 'Eren is getting a bit dirty.',       criticalMsg: 'Eren is filthy! Give him a bath!' },
]

const STORAGE_KEY = 'eren_stat_notifs_v2'
const COOLDOWN_MS = 4 * 60 * 60 * 1000 // 4 hours — don't re-notify for same level within this window

interface NotifRecord {
  level: 'ok' | 'warning' | 'critical'
  notifiedAt: number // timestamp ms
}

function getNotifState(): Record<string, NotifRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveNotifState(state: Record<string, NotifRecord>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

async function sendNotification(title: string, body: string, tag: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker?.ready
    if (reg) {
      reg.showNotification(title, { body, icon: '/ErenIcon.png', badge: '/ErenIcon.png', tag } as NotificationOptions)
      return
    }
  } catch { /* fallback */ }
  new Notification(title, { body, icon: '/ErenIcon.png', tag })
}

export function checkStatNotifications(stats: ErenStats) {
  if (!stats) return

  const state = getNotifState()
  const now = Date.now()
  let changed = false

  for (const alert of STAT_ALERTS) {
    const val = (stats as unknown as Record<string, number>)[alert.key] ?? 100
    const prev = state[alert.key] ?? { level: 'ok', notifiedAt: 0 }

    let newLevel: 'ok' | 'warning' | 'critical' = 'ok'
    if (val <= 10) newLevel = 'critical'
    else if (val <= 50) newLevel = 'warning'

    const cooledDown = now - prev.notifiedAt > COOLDOWN_MS

    // Only notify on transitions (getting worse) AND if cooldown has passed
    if (newLevel === 'warning' && prev.level === 'ok' && cooledDown) {
      sendNotification(`${alert.icon} Pocket Eren`, alert.warningMsg, `stat-${alert.key}`)
      state[alert.key] = { level: 'warning', notifiedAt: now }
      changed = true
    } else if (newLevel === 'critical' && prev.level !== 'critical' && cooledDown) {
      sendNotification(`${alert.icon} Pocket Eren`, alert.criticalMsg, `stat-${alert.key}`)
      state[alert.key] = { level: 'critical', notifiedAt: now }
      changed = true
    } else if (newLevel !== prev.level) {
      // Level changed (e.g. got better) — update without notifying
      state[alert.key] = { level: newLevel, notifiedAt: prev.notifiedAt }
      changed = true
    }
  }

  // Sickness — separate check with its own cooldown
  const sickPrev = state['is_sick'] ?? { level: 'ok', notifiedAt: 0 }
  const sickCooled = now - sickPrev.notifiedAt > COOLDOWN_MS

  if (stats.is_sick && sickPrev.level !== 'critical' && sickCooled) {
    sendNotification('💊 Pocket Eren', 'Eren is sick! Take him to the vet!', 'stat-sick')
    state['is_sick'] = { level: 'critical', notifiedAt: now }
    changed = true
  } else if (!stats.is_sick && sickPrev.level !== 'ok') {
    state['is_sick'] = { level: 'ok', notifiedAt: 0 }
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
  sendNotification(`${action.icon} Pocket Eren`, `${partnerName} ${action.verb}!`, `partner-${actionType}`)
}

export function notifyPartnerMessage(partnerName: string) {
  sendNotification('💌 Pocket Eren', `${partnerName} sent you a message through Eren!`, 'partner-msg')
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}
