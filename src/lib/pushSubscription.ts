import { createClient } from '@/lib/supabase/client'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from(rawData, c => c.charCodeAt(0))
}

/**
 * Subscribe to web push notifications and save the subscription to Supabase.
 * Call this after the user grants notification permission.
 */
export async function subscribeToPush(userId: string, householdId: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  if (!VAPID_PUBLIC_KEY) { console.warn('No VAPID public key'); return false }

  try {
    const reg = await navigator.serviceWorker.ready

    // Check for existing subscription
    let sub = await reg.pushManager.getSubscription()

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
      })
    }

    const subJson = sub.toJSON()
    if (!subJson.endpoint || !subJson.keys) return false

    // Save to Supabase
    const supabase = createClient()
    await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      household_id: householdId,
      endpoint: subJson.endpoint,
      p256dh: subJson.keys.p256dh ?? '',
      auth: subJson.keys.auth ?? '',
    }, { onConflict: 'user_id,endpoint' })

    return true
  } catch (err) {
    console.warn('Push subscription failed:', err)
    return false
  }
}
