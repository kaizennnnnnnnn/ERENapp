'use client'

import { useEffect, useState } from 'react'
import BlinkingEren from '@/components/BlinkingEren'
import FoodIcon from '@/components/care/FoodIcon'
import SuperJelly from './SuperJelly'
import { SUPER_JELLY_BUFF, type SuperJellySnack } from '@/lib/jellies'
import { FOOD_META } from '@/lib/foodMeta'
import { getDonut } from '@/lib/donuts'
import { playSound } from '@/lib/sounds'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useCat } from '@/hooks/useCat'
import { M, MeadowIcon, PrimaryButton, Tag } from '@/components/meadow'

const EAT_POSES = ['/erenEat1.png', '/erenEat3.png', '/erenEat2.png', '/erenEat4.png']

interface Props {
  fed: number
  goal: number
  supersLeft: number
  snack?: { food_key: SuperJellySnack; quantity: 1 }
  onClose: () => void
}

// The saved receipt owns the rewards. The scene only plays them back.
export default function SuperJellyFeed({ fed, goal, supersLeft, snack, onClose }: Props) {
  const reduced = useReducedMotion()
  const cat = useCat()
  const [act, setAct] = useState<'serve' | 'eat' | 'done'>(reduced ? 'done' : 'serve')
  const [bite, setBite] = useState(0)
  const snackName = snack ? getDonut(snack.food_key)?.name ?? FOOD_META[snack.food_key]?.name : null

  useEffect(() => {
    if (reduced) { setAct('done'); return }
    const timers = [
      setTimeout(() => { setAct('eat'); playSound('jl_bounce') }, 720),
      setTimeout(() => { setBite(1); playSound('jl_slice') }, 980),
      setTimeout(() => { setBite(2); playSound('jl_slice') }, 1360),
      setTimeout(() => { setBite(3); playSound('jl_combo') }, 1720),
      setTimeout(() => { setAct('done'); playSound('level_up') }, 1960),
    ]
    return () => timers.forEach(clearTimeout)
  }, [reduced])

  return (
    <div className="meadow-root fixed inset-0 flex flex-col items-center justify-end" role="dialog" aria-modal="true" aria-label="Super Jelly eaten"
      style={{ zIndex: 90, background: 'rgba(28,35,31,0.78)', padding: '16px 18px calc(var(--safe-bottom) + 18px)', boxSizing: 'border-box', overflowY: 'auto' }}>
      <div aria-hidden className="relative flex items-end justify-center" style={{ width: '100%', flex: '1 0 210px', maxHeight: 330, minHeight: 190 }}>
        <span style={{ position: 'absolute', bottom: 16, width: 160, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.18)' }} />
        <div style={{ position: 'absolute', bottom: 18 }}>
          {act === 'eat' ? <img src={EAT_POSES[bite % EAT_POSES.length]} alt="" width={190} height={190} style={{ objectFit: 'contain' }} />
            : <BlinkingEren size={190} src="/erenGood_notail.png" tailSrc="/erenGood_tail.png" />}
        </div>
        {act !== 'done' && bite < 3 && <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: `translateX(-50%) scale(${1 - bite * 0.3})`, transformOrigin: 'bottom center', transition: reduced ? undefined : 'transform 180ms ease-out', animation: act === 'serve' && !reduced ? 'superJellyServe 720ms ease-out both' : undefined }}>
          <SuperJelly size={100} glow={false} wobble={!reduced} />
        </div>}
      </div>

      <div style={{ width: '100%', maxWidth: 360, background: '#FFFFFF', borderRadius: 24, padding: 20, boxSizing: 'border-box', opacity: act === 'done' ? 1 : 0, pointerEvents: act === 'done' ? 'auto' : 'none', transition: reduced ? undefined : 'opacity 220ms ease-out' }}>
        <div className="flex items-center justify-center" style={{ gap: 8 }}>
          <MeadowIcon name="check" size={20} color={M.leaf} />
          <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: M.text }}>Super Jelly eaten</h2>
        </div>
        <div className="flex flex-wrap justify-center" style={{ gap: 5, margin: '14px 0' }}>
          {[`Hunger +${SUPER_JELLY_BUFF.hunger}`, `Joy +${SUPER_JELLY_BUFF.happiness}`, 'Energy full', `Sleep +${SUPER_JELLY_BUFF.sleep_quality}`, `Clean +${SUPER_JELLY_BUFF.cleanliness}`, 'Cured', `+${SUPER_JELLY_BUFF.coins} coins`].map(label => <Tag key={label} size="sm" tone="soft">{label}</Tag>)}
        </div>

        {snack && <div className="flex items-center" style={{ gap: 12, padding: '14px 0', margin: '4px 0 14px', borderTop: `1px solid ${M.divider}`, borderBottom: `1px solid ${M.divider}` }}>
          <div aria-hidden style={{ flexShrink: 0, animation: act === 'done' && !reduced ? 'superJellyGiftIn 550ms cubic-bezier(0.16,1,0.3,1) both' : undefined }}>
            <FoodIcon id={snack.food_key} size={62} />
          </div>
          <div>
            <p style={{ margin: 0, color: M.love, fontSize: 12, fontWeight: 800 }}>A surprise for later</p>
            <p style={{ margin: '2px 0', color: M.text, fontSize: 17, fontWeight: 800 }}>{snackName}</p>
            <p style={{ margin: 0, color: M.text2, fontSize: 13 }}>One added to your fridge</p>
          </div>
        </div>}
        <div role="img" aria-label={`${Math.min(fed, goal)} of ${goal} fed for the Jelly coat`} className="flex" style={{ gap: 5 }}>
          {Array.from({ length: goal }, (_, i) => <span key={i} style={{ flex: 1, height: 9, borderRadius: 8, background: i < fed ? M.love : M.track }} />)}
        </div>
        <p style={{ margin: '8px 0 16px', color: M.text2, fontSize: 13, lineHeight: 1.4, textAlign: 'center' }}>
          {fed >= goal ? 'The Jelly coat is in your closet.' : `${goal - fed} more for the Jelly coat.`}
          {supersLeft > 0 && ` ${supersLeft} still in your fridge.`}
        </p>
        <PrimaryButton disabled={act !== 'done'} onClick={() => { playSound('ui_select'); onClose() }} icon={<MeadowIcon name="heart" size={20} color="#FFFFFF" mono />}>
          {cat.sex === 'female' ? 'Good girl' : 'Good boy'}
        </PrimaryButton>
      </div>
      <style>{`@keyframes superJellyGiftIn { from { opacity: 0; transform: translateY(10px) scale(0.7) rotate(-8deg); } to { opacity: 1; transform: translateY(0) scale(1) rotate(0); } }`}</style>
    </div>
  )
}
