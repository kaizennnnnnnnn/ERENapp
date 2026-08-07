'use client'

// ═════════════════════════════════════════════════════════════════════════════
// ErenChatContext — one conversation, two windows onto it.
//
// You can talk to Eren from the attic floor (a line at a time, his answer in a
// bubble over his head) or with the full transcript open. Those have to be the
// SAME conversation, not two that happen to write to the same table: with a
// hook instance each, a line typed on the floor wouldn't appear in the
// transcript until it was remounted and refetched, and both copies would
// stream at once.
//
// So the room owns one instance and hands it to whoever needs it.
//
// Consume this only in leaves that actually need it. The value changes on every
// streamed token, so a component that reads it re-renders per token — the room,
// the cat and the donut deliberately don't.
// ═════════════════════════════════════════════════════════════════════════════

import { createContext, useContext, type ReactNode } from 'react'
import { useErenChat } from '@/hooks/useErenChat'

type ErenChat = ReturnType<typeof useErenChat>

const Ctx = createContext<ErenChat | null>(null)

export function ErenChatProvider({ children }: { children: ReactNode }) {
  const chat = useErenChat()
  // `children` arrives as a prop, so the subtree is NOT re-rendered when this
  // provider re-renders on a streamed token — only the consumers below are.
  return <Ctx.Provider value={chat}>{children}</Ctx.Provider>
}

export function useErenChatContext(): ErenChat {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useErenChatContext must be used within ErenChatProvider')
  return ctx
}
