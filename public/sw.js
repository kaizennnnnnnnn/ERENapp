// Eren – reminder service worker
// Bump this string whenever you change badge/icon assets so the browser is
// guaranteed to detect a byte difference and replace any old SW running on
// the user's installed PWA. Pairs with no-store headers on /sw.js.
const SW_VERSION = 'v5-simple-cat-badge-2026-05-09'
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

const scheduled = new Map()

self.addEventListener('message', ({ data }) => {
  if (!data || !data.type) return

  if (data.type === 'SCHEDULE') {
    // Cancel existing timer for same id
    if (scheduled.has(data.id)) clearTimeout(scheduled.get(data.id))

    const delay = data.fireAt - Date.now()
    if (delay < 0) return

    const t = setTimeout(() => {
      self.registration.showNotification('🐱 Eren', {
        body: data.text,
        icon: '/ErenIcon.png',
        // Android masks the small status-bar icon to a flat tint — pass the
        // monochrome silhouette so it renders as a cat instead of a black box.
        badge: '/ErenBadge.png?v=3',
        tag: data.id,
        renotify: true,
        vibrate: [200, 100, 200],
      })
      scheduled.delete(data.id)
    }, delay)

    scheduled.set(data.id, t)
  }

  if (data.type === 'CANCEL') {
    clearTimeout(scheduled.get(data.id))
    scheduled.delete(data.id)
  }

  if (data.type === 'CANCEL_ALL') {
    scheduled.forEach(t => clearTimeout(t))
    scheduled.clear()
  }
})

// ── Web Push from server (background notifications) ──
self.addEventListener('push', event => {
  if (!event.data) return
  let data
  try { data = event.data.json() } catch { data = { title: '🐱 Eren', body: event.data.text() } }
  const title = data.title || '🐱 Eren'
  const options = {
    body: data.body || '',
    icon: '/ErenIcon.png',
    // Monochrome silhouette for the Android status-bar small icon.
    badge: '/ErenBadge.png?v=3',
    tag: data.tag || 'eren-push',
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length) { clients[0].navigate(url); return clients[0].focus() }
      return self.clients.openWindow(url)
    })
  )
})
