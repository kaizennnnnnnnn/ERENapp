'use client'

// ─── Invite your person: share the link, copy the key ────────────────────────
// The link opens onboarding on the code screen with the key already filled in
// (?code=), so "one tap and they move in" is nearly true: they still make an
// account, but never type the key. Where the phone has no share sheet the
// link goes to the clipboard instead, and the screen says so.

import { useState } from 'react'
import { playSound } from '@/lib/sounds'
import { formatInviteCode } from '@/lib/onboarding'

export function useInviteShare({ code, catName }: { code: string; catName: string }) {
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function copy() {
    setError(null)
    try {
      await navigator.clipboard.writeText(code)
      playSound('coin_pickup')
      setCopied(true)
    } catch {
      setError("Couldn't copy it. Press and hold the key to copy it yourself.")
    }
  }

  /** true = the share sheet sent it; false = cancelled, or copied instead (see linkCopied). */
  async function share(): Promise<boolean> {
    setError(null)
    const url = `${window.location.origin}/onboarding?code=${encodeURIComponent(code)}`
    const text = `Come look after ${catName} with me. Our house key is ${formatInviteCode(code)}.`
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Eren', text, url })
        return true
      } catch (e) {
        // Closing the share sheet is a choice, not a failure.
        if (e instanceof DOMException && e.name === 'AbortError') return false
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`)
      playSound('coin_pickup')
      setLinkCopied(true)
    } catch {
      setError("Couldn't share the link. Copy the house key instead.")
    }
    return false
  }

  return { copied, linkCopied, error, copy, share }
}
