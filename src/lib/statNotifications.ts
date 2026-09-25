import type { ErenStats } from '@/types'
import { catText, catWordsFromRow, type CatWords } from '@/lib/catWords'

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
  { key: 'hunger',        icon: '🍗', warningMsg: '{name} is getting hungry!',            criticalMsg: '{name} is starving! Feed {him} now!' },
  { key: 'happiness',     icon: '💕', warningMsg: '{name} is feeling a bit down...',      criticalMsg: '{name} is very sad! Play with {him}!' },
  { key: 'energy',        icon: '⚡', warningMsg: '{name} is getting tired.',              criticalMsg: '{name} has no energy! Let {him} rest!' },
  { key: 'sleep_quality', icon: '💤', warningMsg: '{name} needs some rest soon.',         criticalMsg: '{name} is exhausted! Put {him} to bed!' },
  { key: 'cleanliness',   icon: '🛁', warningMsg: '{name} is getting a bit dirty.',       criticalMsg: '{name} is filthy! Give {him} a bath!' },
]

const STORAGE_KEY = 'eren_stat_notifs_v2'
const COOLDOWN_MS = 2 * 60 * 60 * 1000 // 2 hours — don't re-notify for same level within this window

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
  // Skip when the app is in the foreground — the user can see the stats
  // drop on-screen, and a system toast on top of the open app is noisy.
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return
  try {
    const reg = await navigator.serviceWorker?.ready
    if (reg) {
      reg.showNotification(title, { body, icon: '/ErenAppIcon.png', badge: '/ErenAppIcon.png', tag } as NotificationOptions)
      return
    }
  } catch { /* fallback */ }
  new Notification(title, { body, icon: '/ErenAppIcon.png', tag })
}

export function checkStatNotifications(stats: ErenStats) {
  if (!stats) return

  // The row carries the household's cat, so the copy names it with no extra read.
  const cat = catWordsFromRow(stats)
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

    // Fire critical any time we're in critical and cooldown has passed
    if (newLevel === 'critical' && cooledDown) {
      sendNotification(`${alert.icon} ${cat.name}`, catText(alert.criticalMsg, cat), `stat-${alert.key}`)
      state[alert.key] = { level: 'critical', notifiedAt: now }
      changed = true
    }
    // Fire warning when in warning and cooldown passed — don't refire if we
    // just fired critical (prev.level === 'critical' covers the bounce case)
    else if (newLevel === 'warning' && prev.level !== 'critical' && cooledDown) {
      sendNotification(`${alert.icon} ${cat.name}`, catText(alert.warningMsg, cat), `stat-${alert.key}`)
      state[alert.key] = { level: 'warning', notifiedAt: now }
      changed = true
    }
    // Cleared back to ok — update state silently so the next drop re-notifies
    else if (newLevel === 'ok' && prev.level !== 'ok') {
      state[alert.key] = { level: 'ok', notifiedAt: 0 }
      changed = true
    }
  }

  // Sickness — separate check with its own cooldown
  const sickPrev = state['is_sick'] ?? { level: 'ok', notifiedAt: 0 }
  const sickCooled = now - sickPrev.notifiedAt > COOLDOWN_MS

  if (stats.is_sick && sickPrev.level !== 'critical' && sickCooled) {
    sendNotification(`💊 ${cat.name}`, catText('{name} is sick! Take {him} to the vet!', cat), 'stat-sick')
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
  feed:     { icon: '🍗', verb: 'fed {name}' },
  play:     { icon: '🧶', verb: 'played with {name}' },
  sleep:    { icon: '💤', verb: 'put {name} to sleep' },
  wash:     { icon: '🛁', verb: 'gave {name} a bath' },
  medicine: { icon: '💊', verb: 'gave {name} medicine' },
}

export function notifyPartnerAction(partnerName: string, actionType: string, cat: CatWords) {
  const action = ACTION_LABELS[actionType]
  if (!action) return
  sendNotification(`${action.icon} ${cat.name}`, `${partnerName} ${catText(action.verb, cat)}!`, `partner-${actionType}`)
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}
