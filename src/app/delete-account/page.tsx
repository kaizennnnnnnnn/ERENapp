'use client'

/**
 * /delete-account — the publicly reachable deletion route.
 *
 * Google Play requires TWO deletion paths for an app with account creation:
 * one inside the app (Profile → Delete account) and one on the open web, for
 * someone who has uninstalled, lost their password, or never wants to sign in
 * again. This is the second. It must stay outside the (app) route group so it
 * renders with no auth gate and no session.
 *
 * It does not delete anything by itself — proving identity from an unauthed
 * form is not something this app can do safely. It files a request the
 * developer works by hand, which is what Play's "web deletion request" means.
 */

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DeleteAccountPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'sending') return
    const trimmed = email.trim()
    if (!trimmed) return
    setState('sending')
    const { error } = await supabase
      .from('deletion_requests')
      .insert({ email: trimmed, note: note.trim() || null })
    setState(error ? 'error' : 'sent')
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.h1}>Delete your Eren account</h1>

        {state === 'sent' ? (
          <>
            <p style={styles.body}>
              Request received. Your account and personal data will be deleted
              within 30 days, and you&apos;ll get an email at{' '}
              <strong style={{ color: '#E8E0D0' }}>{email.trim()}</strong> when it&apos;s done.
            </p>
            <p style={styles.body}>
              If you can still sign in, the fastest route is in the app:
              Profile → Delete account. That happens immediately.
            </p>
          </>
        ) : (
          <>
            <p style={styles.body}>
              If you can still sign in, delete your account directly in the app
              under <strong style={{ color: '#E8E0D0' }}>Profile → Delete account</strong> — it happens
              immediately. Use this form only if you&apos;ve lost access.
            </p>

            <h2 style={styles.h2}>What gets deleted</h2>
            <p style={styles.body}>
              Your login, your conversations with Eren, your items, scores,
              play history and mood entries are erased permanently.
            </p>
            <h2 style={styles.h2}>What stays</h2>
            <p style={styles.body}>
              If you share a home with a partner, the notes and memories you
              added remain in that shared home so your partner keeps their own
              history — but your name is removed from them. If you&apos;re the only
              person in your home, everything goes, including uploaded photos.
            </p>

            <form onSubmit={submit} style={styles.form}>
              <label style={styles.label} htmlFor="email">
                The email address on the account
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={styles.input}
                placeholder="you@example.com"
              />

              <label style={styles.label} htmlFor="note">
                Anything else we should know (optional)
              </label>
              <textarea
                id="note"
                value={note}
                onChange={e => setNote(e.target.value)}
                style={{ ...styles.input, minHeight: 80, resize: 'vertical' }}
              />

              {state === 'error' && (
                <p style={{ ...styles.body, color: '#fca5a5' }}>
                  That didn&apos;t send. Please try again, or email us directly.
                </p>
              )}

              <button type="submit" disabled={state === 'sending'} style={styles.button}>
                {state === 'sending' ? 'Sending…' : 'Request deletion'}
              </button>
            </form>
          </>
        )}

        <p style={styles.footer}>
          Questions: <a href="mailto:PLACEHOLDER@example.com" style={styles.link}>PLACEHOLDER@example.com</a>
          {' · '}
          <a href="/privacy" style={styles.link}>Privacy policy</a>
        </p>
      </div>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'radial-gradient(ellipse at top, #1f0f18 0%, #0a0a0c 60%, #050507 100%)',
    color: '#C9BFC5',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    padding: '32px 20px 64px',
    display: 'flex',
    justifyContent: 'center',
  },
  card: { width: '100%', maxWidth: 560 },
  h1: { fontSize: 24, lineHeight: 1.2, color: '#E8E0D0', margin: '0 0 18px' },
  h2: { fontSize: 14, color: '#E8E0D0', margin: '22px 0 6px' },
  body: { fontSize: 15, lineHeight: 1.6, margin: '0 0 12px' },
  form: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 26 },
  label: { fontSize: 13, color: '#9A8C95', marginTop: 10 },
  input: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.14)',
    color: '#E8E0D0',
    padding: '10px 12px',
    fontSize: 15,
    fontFamily: 'inherit',
    borderRadius: 2,
  },
  button: {
    marginTop: 18,
    padding: '12px 16px',
    background: 'rgba(248,113,113,0.12)',
    border: '1px solid rgba(248,113,113,0.5)',
    color: '#fca5a5',
    fontSize: 14,
    fontFamily: 'inherit',
    cursor: 'pointer',
    borderRadius: 2,
  },
  footer: { fontSize: 13, color: '#7A6C75', marginTop: 32 },
  link: { color: '#9A8C95' },
}
