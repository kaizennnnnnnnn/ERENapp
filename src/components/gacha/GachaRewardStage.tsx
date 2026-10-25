'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import type { GachaItemDef } from '@/types'
import { GACHA_REVEAL_THEMES, RARITY_MOTION, type GachaMachine } from '@/lib/gachaPresentation'
import FOOD_BOUNDS from '@/lib/gachaFoodBounds.json'
import { getSkin } from '@/lib/skins'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import BlinkingEren from '@/components/BlinkingEren'
import { MeadowIcon } from '@/components/meadow'
import { drawRarityEffects } from './gachaRarityArt'

interface Props { item: GachaItemDef; machine: GachaMachine; name: string }

function FoodArtwork({ item, name }: { item: GachaItemDef; name: string }) {
  const bounds = (FOOD_BOUNDS as Record<string, { size: number[]; rect: number[] }>)[item.id]
  if (!bounds) return <img src={item.image} alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center bottom' }} />
  // Crop transparent padding at render time; kitchen and collection art are untouched.
  return <svg role="img" aria-label={name} viewBox={bounds.rect.join(' ')} preserveAspectRatio="xMidYMax meet" style={{ width: '100%', height: '100%', display: 'block' }}>
    <image href={item.image} width={bounds.size[0]} height={bounds.size[1]} />
  </svg>
}

export default function GachaRewardStage({ item, machine, name }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()
  const skin = item.skinId ? getSkin(item.skinId) : undefined
  const letterbox = skin && skin.aspect > 1 ? 192 * (1 - 1 / skin.aspect) / 2 : 0
  const motion = RARITY_MOTION[item.rarity]
  const theme = GACHA_REVEAL_THEMES[machine]

  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const start = performance.now()
    let raf = 0, size = 320, dpr = 1
    const draw = (now: number) => {
      const elapsed = now - start
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, size, size)
      ctx.save(); ctx.translate(size / 2, size * .51); ctx.scale(size / 320, size / 320)
      drawRarityEffects(ctx, machine, item.rarity, elapsed, reduced)
      ctx.restore()
      canvas.dataset.fxMs = String(Math.round(elapsed / 100) * 100)
      if (!reduced && !document.hidden && (item.rarity !== 'common' || elapsed < motion.duration)) raf = requestAnimationFrame(draw)
    }
    const resume = () => { cancelAnimationFrame(raf); draw(performance.now()) }
    const resize = () => {
      size = canvas.getBoundingClientRect().width; dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(size * dpr); canvas.height = Math.round(size * dpr); resume()
    }
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize()
    document.addEventListener('visibilitychange', resume)
    return () => { cancelAnimationFrame(raf); observer.disconnect(); document.removeEventListener('visibilitychange', resume) }
  }, [machine, item.rarity, reduced, motion.duration])

  return <div data-reward-scene={machine} data-rarity={item.rarity} data-sequence={motion.sequence}
    style={{ position: 'relative', width: 320, maxWidth: '100%', aspectRatio: '1', flexShrink: 0 }}>
    <canvas ref={canvasRef} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
    <span aria-hidden className="gacha-contact-shadow" style={{ position: 'absolute', left: '33%', top: '83%', width: '34%', height: '3%',
      borderRadius: '50%', background: `${theme.ink}25` }} />
    {item.rarity === 'legendary' && <span aria-hidden className="gacha-coronation" style={{ position: 'absolute', top: 12, left: '50%', marginLeft: -18 }}>
      <MeadowIcon name="crown" size={36} color="#C39337" mono />
    </span>}
    <div className="gacha-grounded-prize" style={{ position: 'absolute', left: '50%', bottom: `calc(16% - ${letterbox}px)`, width: 192, height: 192,
      marginLeft: -96, '--gacha-settle-delay': `${motion.settle}ms` } as CSSProperties}>
      {skin ? <BlinkingEren size={192} breathe={false} src={skin.src} tailSrc={skin.tailSrc} tailOrigin={skin.tailOrigin}
        lidTone={skin.lidTone} coat={skin.coat} eyes={skin.eyes} alt={name} /> : <FoodArtwork item={item} name={name} />}
    </div>
    <style>{`
      .gacha-grounded-prize { animation: gachaPrizeSettle 450ms var(--gacha-settle-delay) ease-out both; transform-origin: 50% 100%; }
      .gacha-coronation { animation: gachaCoronation 900ms 650ms cubic-bezier(.18,.72,.28,1) both; }
      @keyframes gachaPrizeSettle { from { opacity: 0; transform: scale(.94); } to { opacity: 1; transform: scale(1); } }
      @keyframes gachaCoronation { 0% { opacity: 0; transform: translateY(12px) scale(.5); } 65% { opacity: 1; transform: translateY(-3px) scale(1.1); } 100% { opacity: 1; transform: none; } }
      @media (prefers-reduced-motion: reduce) { .gacha-grounded-prize, .gacha-coronation { animation: none; } }
    `}</style>
  </div>
}
