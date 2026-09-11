'use client'

import { usePageReady } from '@/hooks/usePageReady'

/**
 * Declarative `usePageReady(true)` for a page that has nothing to wait for.
 *
 * It exists for the failure screens. The splash mounts in the root layout and
 * hides on `eren:app-ready` or, failing that, an 8s timer — so any page that
 * never calls usePageReady sits under it for the full eight seconds. That is
 * merely slow on an ordinary route; on not-found and the error boundary it
 * means the one screen telling the user what went wrong is hidden behind a
 * loading animation, which is the opposite of what both are for.
 *
 * Rendering this from a Server Component keeps the page itself server-rendered
 * — it ships one tiny client island rather than making the whole screen
 * interactive, which matters when the reason we are here may be that the
 * client bundle failed.
 */
export default function PageReady() {
  usePageReady(true)
  return null
}
