'use client'

import type { JournalMessage, FoodKey } from '@/types'
import { playSound } from '@/lib/sounds'
import SketchEren, { type SketchErenState } from '@/components/SketchEren'
import { IconHeart } from '@/components/PixelIcons'

interface Props {
  message: JournalMessage
  onDismiss: () => void
}

const FOOD_META: Record<FoodKey, { name: string; color: string }> = {
  kibble:  { name: 'Kibble',    color: '#D4A44A' },
  fish:    { name: 'Fish',      color: '#5BA3D9' },
  treat:   { name: 'Cat Treat', color: '#FF6B9D' },
  tuna:    { name: 'Tuna Can',  color: '#E8A020' },
  steak:   { name: 'Steak',     color: '#CC3333' },
  cream:   { name: 'Cream',     color: '#A78BFA' },
  biscuit: { name: 'Biscuit',   color: '#C8956A' },
  shrimp:  { name: 'Shrimp',    color: '#F0836A' },
  salmon:  { name: 'Salmon',    color: '#E8735A' },
  chicken: { name: 'Chicken',   color: '#E8B44A' },
  sausage: { name: 'Sausage',   color: '#A0522D' },
  milk:    { name: 'Milk',      color: '#E8E4E0' },
  cheese:  { name: 'Cheese',    color: '#F5C842' },
  yogurt:  { name: 'Yogurt',    color: '#FFB6C1' },
  cake:    { name: 'Cake',      color: '#FF85A2' },
  sushi:   { name: 'Sushi',     color: '#2D9B6A' },
  sardine: { name: 'Sardine',   color: '#7BAFC8' },
  egg:     { name: 'Egg',       color: '#F5E6C8' },
}

export default function ErenMessagePopup({ message, onDismiss }: Props) {
  // A "Send Eren" nudge carries a SketchEren pose — render Eren striking it
  // with floating hearts. Plain ThoughtCloud messages keep the static sprite.
  const isNudge = !!message.eren_state

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <button onClick={() => { playSound('ui_modal_close'); onDismiss() }} className="mx-6 w-full max-w-xs flex flex-col items-center gap-3 active:scale-95 transition-transform">
        {/* Eren with letter / nudge pose */}
        <div className="relative" style={{ animation: 'erenDeliver 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}>
          {isNudge ? (
            <>
              {/* Floating hearts around Eren */}
              <div className="absolute pointer-events-none" style={{ top: 4, left: -6, animation: 'nudgeHeart 2.4s ease-in-out infinite' }}>
                <IconHeart size={14} />
              </div>
              <div className="absolute pointer-events-none" style={{ top: 18, right: -8, animation: 'nudgeHeart 2.4s ease-in-out infinite 0.8s' }}>
                <IconHeart size={11} />
              </div>
              <div className="absolute pointer-events-none" style={{ top: -6, left: '52%', animation: 'nudgeHeart 2.4s ease-in-out infinite 1.5s' }}>
                <IconHeart size={9} />
              </div>
              <SketchEren state={message.eren_state as SketchErenState} size={130} transparent noSpeech />
            </>
          ) : (
            <img src="/erenGood.png" alt="Eren" draggable={false}
              style={{ width: 100, height: 100, objectFit: 'contain', imageRendering: 'pixelated' }} />
          )}
          {/* Letter / heart badge */}
          <div className="absolute -top-1 -right-1 flex items-center justify-center"
            style={{ width: 28, height: 28, background: '#FF6B9D', borderRadius: '50%', border: '2px solid #CC3366', boxShadow: '0 2px 6px rgba(255,107,157,0.4)' }}>
            {isNudge
              ? <IconHeart size={14} />
              : <span style={{ fontSize: 14 }}>💌</span>}
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

          <p className="font-pixel text-pink-400 mb-2 text-center" style={{ fontSize: 6 }}>
            {message.gift_item ? 'EREN BROUGHT A GIFT!' : isNudge ? 'EREN BROUGHT YOU A MESSAGE!' : 'EREN DELIVERED A MESSAGE!'}
          </p>
          {message.message && (
            <p className="text-sm text-gray-700 text-center leading-relaxed">{message.message}</p>
          )}
          {message.gift_item && FOOD_META[message.gift_item.key] && (
            <div className="mt-2 flex items-center justify-center gap-2 px-3 py-2"
              style={{
                background: `${FOOD_META[message.gift_item.key].color}22`,
                border: `2px dashed ${FOOD_META[message.gift_item.key].color}88`,
                borderRadius: 6,
              }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                background: FOOD_META[message.gift_item.key].color,
                border: '1.5px solid rgba(0,0,0,0.2)',
              }} />
              <span className="text-xs font-bold" style={{ color: FOOD_META[message.gift_item.key].color }}>
                +{message.gift_item.qty} {FOOD_META[message.gift_item.key].name}
              </span>
              <span className="text-[10px] text-gray-500">→ your fridge</span>
            </div>
          )}
          <p className="text-[10px] text-gray-400 text-center mt-2">from your partner 💕</p>
        </div>

        <p className="font-pixel text-white/50" style={{ fontSize: 6 }}>TAP TO CLOSE</p>
      </button>

      <style jsx>{`
        @keyframes erenDeliver {
          0% { transform: translateY(30px) scale(0.8); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes nudgeHeart {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.5; }
          50%      { transform: translateY(-8px) scale(1.15); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
