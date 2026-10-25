'use client'

import type { GachaItemDef, GachaRarity } from '@/types'
import { GACHA_SCENES, PRESENTATION_ATLASES, RARITY_PRESENTATION, type GachaMachine } from '@/lib/gachaPresentation'
import FOOD_BOUNDS from '@/lib/gachaFoodBounds.json'
import { getSkin } from '@/lib/skins'
import BlinkingEren from '@/components/BlinkingEren'
import { MeadowIcon } from '@/components/meadow'

interface Props { item: GachaItemDef; machine: GachaMachine; name: string }

function FoodArtwork({ item, name }: { item: GachaItemDef; name: string }) {
  const bounds = (FOOD_BOUNDS as Record<string, { size: number[]; rect: number[] }>)[item.id]
  if (!bounds) return <img src={item.image} alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center bottom' }} />
  // Crop transparent padding at render time; kitchen and collection art are untouched.
  return <svg role="img" aria-label={name} viewBox={bounds.rect.join(' ')} preserveAspectRatio="xMidYMax meet" style={{ width: '100%', height: '100%', display: 'block' }}>
    <image href={item.image} width={bounds.size[0]} height={bounds.size[1]} />
  </svg>
}

function Dressing({ machine, rarity }: { machine: GachaMachine; rarity: GachaRarity }) {
  const scene = GACHA_SCENES[machine]
  const tier = RARITY_PRESENTATION[rarity]
  if (tier.level < 2) return null
  return <div aria-hidden className="gacha-scene-dressing" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
    {machine === 'food' && <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: rarity === 'legendary' ? 28 : 20,
      background: `repeating-linear-gradient(90deg, ${scene.accent} 0 22px, #FFF1D9 22px 44px)`,
      borderBottom: `3px solid ${tier.trim}`, clipPath: 'polygon(0 0,100% 0,100% 82%,97% 100%,94% 82%,91% 100%,88% 82%,85% 100%,82% 82%,79% 100%,76% 82%,73% 100%,70% 82%,67% 100%,64% 82%,61% 100%,58% 82%,55% 100%,52% 82%,49% 100%,46% 82%,43% 100%,40% 82%,37% 100%,34% 82%,31% 100%,28% 82%,25% 100%,22% 82%,19% 100%,16% 82%,13% 100%,10% 82%,7% 100%,4% 82%,0 100%)' }} />}
    {machine === 'animal' && [-1, 1].map(side => <div key={side} style={{ position: 'absolute', top: 0, bottom: '24%', width: rarity === 'legendary' ? 30 : 21,
      [side === -1 ? 'left' : 'right']: 0, background: scene.accent,
      borderRight: side === -1 ? `4px solid ${scene.fabric}` : undefined,
      borderLeft: side === 1 ? `4px solid ${scene.fabric}` : undefined,
      clipPath: side === -1 ? 'polygon(0 0,100% 0,88% 38%,48% 57%,67% 100%,0 100%)' : 'polygon(0 0,100% 0,100% 100%,33% 100%,52% 57%,12% 38%)' }} />)}
    {machine === 'foodsuits' && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 18,
      background: `repeating-linear-gradient(90deg, #F9EAD4 0 12px, ${scene.fabric} 12px 14px, #E5EFE8 14px 26px, ${scene.fabric} 26px 28px)`, borderBottom: `3px solid ${tier.trim}` }} />}
    {machine === 'creatures' && [0,1,2,3,4,5].map(i => <span key={i} style={{ position: 'absolute', left: `${5 + i * 17}%`, top: i % 2 ? 12 : 3, transform: `rotate(${i % 2 ? 30 : -30}deg)` }}>
      <MeadowIcon name="leaf" size={21} color={scene.accent} mono />
    </span>)}
    {rarity === 'legendary' && <>
      <div style={{ position: 'absolute', inset: 6, border: `2px solid ${tier.trim}`, borderRadius: 15, boxShadow: 'inset 0 0 0 2px #FFF2CF' }} />
      {[['left','top'],['right','top'],['left','bottom'],['right','bottom']].map(([x,y]) => <span key={x+y} style={{ position: 'absolute', [x]: 7, [y]: 7, width: 20, height: 20,
        border: `3px double ${tier.trim}`, background: '#F1DBA4', clipPath: 'polygon(0 0,100% 0,100% 35%,35% 35%,35% 100%,0 100%)', transform: `rotate(${x === 'right' ? y === 'bottom' ? 180 : 90 : y === 'bottom' ? 270 : 0}deg)` }} />)}
    </>}
    <div style={{ position: 'absolute', top: 5, left: '50%', transform: 'translateX(-50%)', width: 38, height: 31,
      background: rarity === 'legendary' ? '#F4DFAC' : '#F8EFE3', border: `2px solid ${tier.trim}`, borderRadius: '0 0 12px 12px', display: 'grid', placeItems: 'center' }}>
      <MeadowIcon name={rarity === 'legendary' ? 'crown' : 'paw'} size={20} color={tier.trim} mono />
    </div>
  </div>
}

/** Gacha-specific set dressing; the shared Meadow flower stage stays unchanged. */
export default function GachaRewardStage({ item, machine, name }: Props) {
  const scene = GACHA_SCENES[machine]
  const tier = RARITY_PRESENTATION[item.rarity]
  const skin = item.skinId ? getSkin(item.skinId) : undefined
  const letterbox = skin && skin.aspect > 1 ? 192 * (1 - 1 / skin.aspect) / 2 : 0
  const plinth = PRESENTATION_ATLASES['box-legendary']
  const front = [plinth.body[0], plinth.body[1] + plinth.body[3] * .56, plinth.body[2], plinth.body[3] * .44]
  return <div data-reward-scene={machine} data-rarity={item.rarity} aria-label={`${scene.name}, ${item.rarity} reward`}
    style={{ position: 'relative', width: 320, maxWidth: '100%', aspectRatio: '1', flexShrink: 0, overflow: 'hidden', borderRadius: 22,
      background: scene.grounds[item.rarity], boxShadow: `0 3px 0 ${scene.accent}38` }}>
    <img src={scene.src} alt="" aria-hidden draggable={false} style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' }} />
    <Dressing machine={machine} rarity={item.rarity} />
    {tier.level > 0 && <div aria-hidden style={{ position: 'absolute', width: '68%', left: '16%', top: '81.5%', height: 17,
      borderRadius: '50%', background: scene.fabric,
      border: `${item.rarity === 'legendary' ? 2 : 1}px ${item.rarity === 'epic' ? 'dashed' : 'solid'} ${tier.trim}` }} />}
    {item.rarity === 'legendary' && <svg aria-hidden viewBox={front.join(' ')} preserveAspectRatio="none"
      style={{ position: 'absolute', left: '16%', top: '84%', width: '68%', height: 23, overflow: 'hidden' }}>
      <image href={plinth.src} width={1254} height={1254} />
    </svg>}
    <span aria-hidden style={{ position: 'absolute', left: '34%', top: '82.9%', width: '32%', height: '2.4%', borderRadius: '50%', background: 'rgba(46,37,31,.24)' }} />
    <div className="gacha-grounded-prize" style={{ position: 'absolute', left: '50%', bottom: `calc(16% - ${letterbox}px)`, width: 192, height: 192, marginLeft: -96 }}>
      {skin ? <BlinkingEren size={192} breathe={false} src={skin.src} tailSrc={skin.tailSrc} tailOrigin={skin.tailOrigin}
        lidTone={skin.lidTone} coat={skin.coat} eyes={skin.eyes} alt={name} />
        : <FoodArtwork item={item} name={name} />}
    </div>
    <style>{`
      .gacha-grounded-prize { animation: gachaGroundedArrival 420ms ease-out both; }
      @keyframes gachaGroundedArrival { from { opacity: 0; } to { opacity: 1; } }
      @media (prefers-reduced-motion: reduce) { .gacha-grounded-prize { animation: none; } }
    `}</style>
  </div>
}
