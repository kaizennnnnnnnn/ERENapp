// Run a callback when the app returns to the foreground. Listens to BOTH
// window focus and document visibilitychange: iOS standalone PWAs (this
// app's primary install target) reliably fire visibilitychange on return
// from background but not always focus, while desktop tab clicks can fire
// focus without a visibility change. The two often fire back-to-back on
// one transition, so calls within a second are coalesced.
export function onForeground(cb: () => void): () => void {
  let last = 0
  const fire = () => {
    const now = Date.now()
    if (now - last < 1000) return
    last = now
    cb()
  }
  const onVis = () => { if (document.visibilityState === 'visible') fire() }
  window.addEventListener('focus', fire)
  document.addEventListener('visibilitychange', onVis)
  return () => {
    window.removeEventListener('focus', fire)
    document.removeEventListener('visibilitychange', onVis)
  }
}
