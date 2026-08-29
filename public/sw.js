// Eren – reminder service worker
// Bump this string whenever you change badge/icon assets so the browser is
// guaranteed to detect a byte difference and replace any old SW running on
// the user's installed PWA. Pairs with no-store headers on /sw.js.
const SW_VERSION = 'v28-cola-icons-2026-08-29'

// Room backgrounds + Eren sprite. We precache these on install so the user
// can scroll between rooms with no internet without seeing the room render
// against a black void (the original bug: img.onerror fires offline, the
// scene host treats it as a successful load, then the CSS background-image
// 404s and you see Eren floating in space).
const IMAGE_CACHE = `eren-images-${SW_VERSION}`
const PRECACHE_IMAGES = [
  '/erenGood.png',   '/erenSleep.png',  '/ErenCook.png',  '/ErenBathroomHat.png',  '/ErenCakeShop.png',  '/ErenBell.png',  '/ErenVet.png',  '/ErenVet_notail.png',  '/ErenVet_tail.png',
  '/HomeDay.png',    '/HomeNight.png',
  '/kitchen.png',    '/KitchenDark.png',
  '/playroom.png',   '/play.png',
  '/bedroom.png',
  '/bathroom.png',   '/BathroomDark.png',
  '/ChemistryDay.png', '/ChemistryNight.png',
  '/CakeShop.png',   '/CakeShopNight.png',
  '/vetBACK.png',    '/wetDark.png',
  '/AtticDay.png',  '/AtticNight.png',  '/donut.png',
  '/schoolBACK.png',
  // The four kiosk walls you turn between once you're inside the shawarma
  // stand. Cheap to precache (~85 KB each as webp) and the interior has no
  // offline panel of its own — without these a dropped connection in there
  // is a black room.
  '/InsideOfKiosk.webp', '/KioskLeftSide.webp', '/KioskBackReal.webp', '/KioskRightSide.webp',
  // The payphone's handset and cord — the only part of that wall that moves.
  '/kiosk_handset.webp',
  // Everything the shift itself is made of: the pan fills, the fridge stock,
  // and the five stages of the cone. Without these a dropped connection puts
  // you behind a counter with empty pans and no meat.
  '/fill_tomato.webp', '/fill_onion.webp', '/fill_cheese.webp', '/fill_lettuce.webp',
  '/fr_tomato.webp', '/fr_onion.webp', '/fr_cheese.webp', '/fr_lettuce.webp', '/fr_cola.webp',
  '/meat1.webp', '/meat2.webp', '/meat3.webp', '/meat4.webp', '/meat5.webp',
  '/FridgeOpen.webp',
  // The prep board: the bread you build on, the carved meat that goes on it,
  // and what it becomes once you roll it shut.
  '/tortilla.webp', '/wrap_rolled.webp', '/meat_shaved.webp',
  '/knife.webp',
  // The sauce bottles standing on the prep counter, the squeeze of each
  // one that ends up on the bread, and the chip warmer at the far end.
  '/sauce_garlic.webp', '/sauce_chilli.webp', '/sauce_herb.webp',
  '/drizzle_garlic.webp', '/drizzle_chilli.webp', '/drizzle_herb.webp',
  '/fr_chips.webp',
  // The tip jar on the ledge (glass and its coins are two sprites on one
  // canvas) and the radio on the prep counter.
  '/tipjar.webp', '/tipjar_coins.webp', '/kiosk_radio.webp',
  '/apron_brown.webp', '/apron_pink.webp', '/kiosk_glass_mask.webp',
  '/ErenAppIcon.png',   '/ErenBadge.png',
]

self.addEventListener('install', e => {
  // Skip waiting first so the new SW activates even if the precache request
  // is slow or fails — better to ship the SW updates than block on assets.
  self.skipWaiting()
  e.waitUntil(
    caches.open(IMAGE_CACHE).then(cache =>
      // addAll is atomic — if any image 404s the whole call rejects. We catch
      // and fall back to individual adds so a renamed/missing asset doesn't
      // wipe the cache for the rest.
      cache.addAll(PRECACHE_IMAGES).catch(() => Promise.all(
        PRECACHE_IMAGES.map(url => cache.add(url).catch(() => null))
      ))
    )
  )
})

self.addEventListener('activate', e => e.waitUntil(Promise.all([
  // Drop old image caches so a SW_VERSION bump doesn't pile up storage.
  caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith('eren-images-') && k !== IMAGE_CACHE).map(k => caches.delete(k))
  )),
  self.clients.claim(),
])))

// Cache-first for image requests under our origin. Network failures (offline,
// flaky wifi, captive portal) are silent — we just serve whatever's cached.
// When the request succeeds, we update the cache so newly-shipped art shows
// up on the next visit even without a SW version bump.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  if (!/\.(png|jpg|jpeg|webp|gif|svg)$/i.test(url.pathname)) return
  event.respondWith(
    caches.open(IMAGE_CACHE).then(async cache => {
      const cached = await cache.match(event.request)
      if (cached) {
        // Refresh in the background so a new art file replaces the cached one
        // next time without forcing the user to wait.
        event.waitUntil(
          fetch(event.request).then(res => {
            if (res && res.ok) cache.put(event.request, res.clone())
          }).catch(() => { /* offline — keep cached copy */ })
        )
        return cached
      }
      try {
        const res = await fetch(event.request)
        if (res && res.ok) cache.put(event.request, res.clone())
        return res
      } catch {
        // Final fallback — return whatever we have (cached.match already
        // returned null, so this just propagates a network error to the
        // caller, which the SceneHost handles via the offline panel).
        const fallback = await cache.match(event.request)
        return fallback || Response.error()
      }
    })
  )
})

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
        icon: '/ErenAppIcon.png',
        // Android masks the small status-bar icon to a flat tint — pass the
        // monochrome silhouette so it renders as a cat instead of a black box.
        badge: '/ErenBadge.png?v=6',
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
    icon: '/ErenAppIcon.png',
    // Monochrome silhouette for the Android status-bar small icon.
    badge: '/ErenBadge.png?v=6',
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
