// Eren – reminder service worker
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
        badge: '/ErenIcon.png',
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
    badge: '/ErenIcon.png',
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
