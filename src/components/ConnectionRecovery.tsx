'use client'

import { useEffect, useRef, useState } from 'react'
import { M, PrimaryButton } from '@/components/meadow'

export default function ConnectionRecovery({ onRetry, busy = false }: { onRetry: () => Promise<unknown> | void; busy?: boolean }) {
  const [retrying, setRetrying] = useState(false)
  const locked = useRef(false), mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function retry() {
    if (locked.current || busy) return
    locked.current = true; setRetrying(true)
    try { await onRetry() } catch { /* The failed state remains retryable. */ }
    finally { locked.current = false; if (mounted.current) setRetrying(false) }
  }
  return (
    <div className="meadow-root fixed inset-0 flex flex-col items-center justify-center" role="alert" style={{
      padding: '24px', background: M.soft, zIndex: 80,
    }}>
      <img src="/erenGood.png" alt="" draggable={false} style={{ width: 100, height: 100, objectFit: 'contain' }} />
      <h1 style={{ margin: '18px 0 0', fontSize: 22, lineHeight: 1.2, fontWeight: 800, color: M.text, textAlign: 'center' }}>
        Having trouble connecting
      </h1>
      <p style={{ margin: '8px 0 0', maxWidth: 300, fontSize: 15, lineHeight: 1.45, fontWeight: 500, color: M.text2, textAlign: 'center' }}>
        The app could not reach your home. This can happen when the server is slow, even if your internet is working.
      </p>
      <div style={{ width: '100%', maxWidth: 300, marginTop: 24 }}>
        <PrimaryButton onClick={() => { void retry() }} busy={busy || retrying}>
          {busy || retrying ? 'Reconnecting...' : 'Try again'}
        </PrimaryButton>
      </div>
    </div>
  )
}
