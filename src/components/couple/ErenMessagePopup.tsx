'use client'

import type { JournalMessage } from '@/types'

interface Props {
  message: JournalMessage
  onDismiss: () => void
}

export default function ErenMessagePopup({ message, onDismiss }: Props) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <button onClick={onDismiss} className="mx-6 w-full max-w-xs flex flex-col items-center gap-3 active:scale-95 transition-transform">
        {/* Eren with letter */}
        <div className="relative" style={{ animation: 'erenDeliver 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}>
          <img src="/erenGood.png" alt="Eren" draggable={false}
            style={{ width: 100, height: 100, objectFit: 'contain', imageRendering: 'pixelated' }} />
          {/* Letter icon */}
          <div className="absolute -top-1 -right-1 flex items-center justify-center"
            style={{ width: 28, height: 28, background: '#FF6B9D', borderRadius: '50%', border: '2px solid #CC3366', boxShadow: '0 2px 6px rgba(255,107,157,0.4)' }}>
            <span style={{ fontSize: 14 }}>💌</span>
          </div>
        </div>

        {/* Speech bubble with message */}
        <div className="relative w-full p-4"
          style={{ background: 'white', borderRadius: 8, border: '2px solid #F0D8FF', boxShadow: '3px 3px 0 #E0CCFF' }}>
          {/* Tail pointing up to Eren */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2"
            style={{ width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderBottom: '8px solid #F0D8FF' }} />
          <div className="absolute -top-1 left-1/2 -translate-x-1/2"
            style={{ width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderBottom: '7px solid white' }} />

          <p className="font-pixel text-pink-400 mb-2 text-center" style={{ fontSize: 6 }}>EREN DELIVERED A MESSAGE!</p>
          <p className="text-sm text-gray-700 text-center leading-relaxed">{message.message}</p>
          <p className="text-[10px] text-gray-400 text-center mt-2">from your partner 💕</p>
        </div>

        <p className="font-pixel text-white/50" style={{ fontSize: 6 }}>TAP TO CLOSE</p>
      </button>

      <style jsx>{`
        @keyframes erenDeliver {
          0% { transform: translateY(30px) scale(0.8); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
