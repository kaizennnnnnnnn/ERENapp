'use client'

import { useEffect } from 'react'

// ─── LongPressGuard ────────────────────────────────────────────────────────
// Kills the browser's own long-press menu — the "Download image / Search image
// with Google" sheet you get by holding a plate of food in the kitchen.
//
// The CSS half of this (globals.css) sets `-webkit-touch-callout: none`, and
// that IS the right lever — on iOS. Chrome on Android doesn't implement the
// property at all; it long-presses into a real `contextmenu` event and opens
// its image menu off that. So the callout rule silently did nothing on the
// platform the complaint came from, and the only way to stop it is to cancel
// the event. Belt and braces: iOS fires contextmenu on long-press too now, so
// this covers both and the CSS stays as the cheaper first line of defence.
//
// Two things stay clickable-through on purpose:
//   • editable fields — long-press/right-click there is how you reach Paste,
//     and the app has real text entry (chat, notes, wishes).
//   • .selectable — the opt-in from globals.css. Text you're allowed to select
//     is text you're allowed to copy; the two exceptions must agree or the
//     class only half-works.
//
// dragstart on images goes with it: same defect class (a browser affordance for
// saving the art), and it makes `draggable={false}` no longer something every
// new <img> has to remember. The kitchen's drag-a-plate-to-Eren gesture is
// pointer-event driven, not HTML5 drag, so nothing in the app relies on it.

/** Long-press/right-click still belongs to the element (Paste, Copy). */
function isInteractiveText(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return !!target.closest('input, textarea, [contenteditable="true"], .selectable')
}

export default function LongPressGuard() {
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      if (isInteractiveText(e.target)) return
      e.preventDefault()
    }
    const onDragStart = (e: DragEvent) => {
      if (e.target instanceof HTMLImageElement) e.preventDefault()
    }
    // Capture phase so a scene that stops propagation can't leave the menu
    // enabled in one room and disabled in the rest.
    document.addEventListener('contextmenu', onContextMenu, { capture: true })
    document.addEventListener('dragstart', onDragStart, { capture: true })
    return () => {
      document.removeEventListener('contextmenu', onContextMenu, { capture: true })
      document.removeEventListener('dragstart', onDragStart, { capture: true })
    }
  }, [])
  return null
}
