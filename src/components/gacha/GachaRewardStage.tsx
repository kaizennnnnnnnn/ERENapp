'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import type { GachaItemDef } from '@/types'
import { GACHA_REVEAL_THEMES, RARITY_MOTION, getSkinRewardRoom, type GachaMachine } from '@/lib/gachaPresentation'
import FOOD_BOUNDS from '@/lib/gachaFoodBounds.json'
import { getSkin } from '@/lib/skins'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import BlinkingEren from '@/components/BlinkingEren'
import { MeadowIcon } from '@/components/meadow'
import { drawRarityEffects } from './gachaRarityArt'
import { drawPixelRoom, PIXEL_ROOM_SIZE } from './pixelRoomArt'

interface Props { item: GachaItemDef; machine: GachaMachine; name: string; compact?: boolean }

function FoodArtwork({ item, name }: { item: GachaItemDef; name: string }) {
  const bounds = (FOOD_BOUNDS as Record<string, { size: number[]; rect: number[] }>)[item.id]
  if (!bounds) return <img src={item.image} alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center bottom' }} />
  return <svg role="img" aria-label={name} viewBox={bounds.rect.join(' ')} preserveAspectRatio="xMidYMax meet" style={{ width: '100%', height: '100%', display: 'block' }}>
    <image href={item.image} width={bounds.size[0]} height={bounds.size[1]} />
  </svg>
}

export default function GachaRewardStage({ item, machine, name, compact = false }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const roomCanvasRef = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()
  const skin = item.skinId ? getSkin(item.skinId) : undefined
  const room = skin ? getSkinRewardRoom(item.rarity) : null
  const hasRoom = room !== null
  const prizeSize = hasRoom ? 224 : 192
  const letterbox = skin && skin.aspect > 1 ? prizeSize * (1 - 1 / skin.aspect) / 2 : 0
  const motion = RARITY_MOTION[item.rarity]
  const theme = GACHA_REVEAL_THEMES[machine]

  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const backdrop = roomCanvasRef.current, backdropCtx = backdrop?.getContext('2d')
    const world = hasRoom ? document.createElement('canvas') : null
    if (world) { world.width = PIXEL_ROOM_SIZE; world.height = PIXEL_ROOM_SIZE }
    const worldCtx = world?.getContext('2d')
    const start = performance.now()
    let raf = 0, width = 320, height = 320, dpr = 1, floor = 51.2, roomPaintedAt = -Infinity
    const draw = (now: number) => {
      const elapsed = now - start
      if (backdrop && backdropCtx && world && worldCtx && elapsed - roomPaintedAt >= 80) {
        drawPixelRoom(worldCtx, item.rarity, elapsed, reduced)
        const size = Math.max(width, height)
        backdropCtx.setTransform(dpr,0,0,dpr,0,0); backdropCtx.clearRect(0,0,width,height)
        backdropCtx.imageSmoothingEnabled = false
        backdropCtx.drawImage(world,(width-size)/2,height-size,size,size)
        backdrop.dataset.roomMs = String(reduced ? 0 : Math.floor(elapsed / 80) * 80)
        roomPaintedAt = elapsed
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height)
      ctx.save()
      ctx.translate(width / 2, hasRoom ? height - floor - prizeSize / 2 : height * .51)
      const scale = hasRoom ? Math.min(width / 320, prizeSize / 192) : width / 320
      ctx.scale(scale, scale); ctx.globalAlpha = hasRoom ? .7 : 1
      drawRarityEffects(ctx, machine, item.rarity, elapsed, reduced); ctx.restore()
      canvas.dataset.fxMs = String(Math.round(elapsed / 100) * 100)
      if (!reduced && !document.hidden && (hasRoom || item.rarity !== 'common' || elapsed < motion.duration)) raf = requestAnimationFrame(draw)
    }
    const resume = () => { cancelAnimationFrame(raf); draw(performance.now()) }
    const resize = () => {
      const box = canvas.getBoundingClientRect(); width = box.width; height = box.height
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr)
      if (backdrop) { backdrop.width = canvas.width; backdrop.height = canvas.height }
      roomPaintedAt = -Infinity
      // The square code-drawn room is bottom-cropped, with paws at source y=.84.
      floor = Math.max(width, height) * .16
      rootRef.current?.style.setProperty('--gacha-floor', `${floor}px`)
      resume()
    }
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize()
    document.addEventListener('visibilitychange', resume)
    return () => { cancelAnimationFrame(raf); observer.disconnect(); document.removeEventListener('visibilitychange', resume) }
  }, [machine, item.rarity, reduced, motion.duration, hasRoom, prizeSize])

  return <div ref={rootRef} data-reward-scene={machine} data-rarity={item.rarity} data-sequence={motion.sequence}
    data-skin-room={room ? item.rarity : undefined} aria-label={room ? `${room.name}, ${item.rarity} costume` : undefined}
    style={{ position: 'relative', width: hasRoom ? '100%' : 320, maxWidth: '100%', flexShrink: 0,
      height: hasRoom ? compact ? 'clamp(300px, 44svh, 380px)' : 'clamp(330px, 52svh, 450px)' : undefined,
      aspectRatio: hasRoom ? undefined : '1', overflow: 'hidden', '--gacha-floor': '16%' } as CSSProperties}>
    {room && <canvas ref={roomCanvasRef} data-room-art data-room-renderer="code" aria-hidden
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated' }} />}
    <canvas ref={canvasRef} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
    <span aria-hidden className="gacha-contact-shadow" style={hasRoom
      ? { position: 'absolute', left: '50%', marginLeft: -54, bottom: 'calc(var(--gacha-floor) - 5px)', width: 108, height: 9, borderRadius: '50%', background: '#39352833' }
      : { position: 'absolute', left: '33%', top: '83%', width: '34%', height: '3%', borderRadius: '50%', background: `${theme.ink}25` }} />
    {!hasRoom && item.rarity === 'legendary' && <span aria-hidden className="gacha-coronation" style={{ position: 'absolute', top: 12, left: '50%', marginLeft: -18 }}>
      <MeadowIcon name="crown" size={36} color="#C39337" mono />
    </span>}
    <div className="gacha-grounded-prize" style={{ position: 'absolute', left: '50%', bottom: `calc(var(--gacha-floor) - ${letterbox}px)`, width: prizeSize, height: prizeSize,
      marginLeft: -prizeSize / 2, '--gacha-settle-delay': `${motion.settle}ms` } as CSSProperties}>
      {skin ? <BlinkingEren size={prizeSize} breathe={false} src={skin.src} tailSrc={skin.tailSrc} tailOrigin={skin.tailOrigin}
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
