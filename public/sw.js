// Pocket Eren – reminder service worker
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
      self.registration.showNotification('🐱 Pocket Eren', {
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

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length) return clients[0].focus()
      return self.clients.openWindow('/')
    })
  )
})
