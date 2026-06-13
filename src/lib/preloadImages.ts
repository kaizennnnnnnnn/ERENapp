// ─── preloadImages ─────────────────────────────────────────────────────────
// Decode a set of image URLs before they're needed, so a later swap renders
// against an already-decoded bitmap instead of flashing blank for a frame.
// This is the same decode()-with-onload-fallback trick BlinkingEren uses to
// reveal its body+tail together; pulled out here so the care scenes can warm
// their pose-swap stickers (the head-down eating pose, the curled sleeping
// pose) at mount, well before a PixelPoof reveals them.

export function preloadImages(srcs: Array<string | undefined | null>): void {
  if (typeof window === 'undefined') return
  for (const src of srcs) {
    if (!src) continue
    const im = new window.Image()
    im.src = src
    // decode() resolves once the bitmap is ready; the catch keeps a missing
    // file from throwing an unhandled rejection — the <img> will still try.
    im.decode().catch(() => { /* missing/undecodable — the render handles it */ })
  }
}
