'use client'

// ═══════════════════════════════════════════════════════════════════════════
// THE CAULDRON — standing on the Lab floor, right of the rug. Tap it to open
// the Potion Mixer.
//
// A thing you walk up to rather than a button, like the weather machine on the
// other side of the rug: the pot is where potions come from, so the pot is what
// you tap. It bubbles in the colour of the potion he's on (violet when he's on
// none), so a glance at the room says what he last drank. A small white pill
// under it names it, the Meadow way, since a pot on its own could be decor.
//
// Placed in VIEWPORT percent, like the machine, so it stands on the same
// floorboards whatever the phone's crop of the art.
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'
import { M } from '@/components/meadow'
import { Cauldron, CAULDRON_MOUTH } from './PotionArt'
import { useActivePotion } from '@/hooks/usePotions'
import { playSound } from '@/lib/sounds'
import { tint } from '@/lib/potions'

const W = 92
const H = (W * 26) / 30
const STANDS = { right: '5%', bottom: '33%' }
const IDLE = '#A06BD6'

export default memo(function CauldronProp({ onOpen }: { onOpen(): void }) {
  const potion = useActivePotion()
  const liquid = potion?.color ?? IDLE
  return (
    <button type="button" onClick={() => { playSound('ui_modal_open'); onOpen() }}
      aria-label="Open the Potion Mixer"
      className="absolute m-press m-focus"
      style={{ ...STANDS, zIndex: 11, width: W, height: H + 34, padding: 0, border: 0, background: 'transparent', cursor: 'pointer' }}>
      <span className="absolute" style={{ left: 0, top: 0, width: W, height: H }}>
        {/* Bubbles off the surface, in the potion's colour. */}
        {[-20, 4, 18].map((dx, i) => (
          <span key={i} className="potBubble" style={{
            position: 'absolute', left: W / 2 + dx, top: H * CAULDRON_MOUTH.y - 6,
            width: 7, height: 7, borderRadius: 999, background: tint(liquid, 0.45),
            animationDelay: `${i * 0.5}s`,
          }} />
        ))}
        <span className="potSteam" style={{
          position: 'absolute', left: W / 2 - 6, top: H * CAULDRON_MOUTH.y - 26, width: 12, height: 12,
          borderRadius: 999, background: '#FFFFFF', opacity: 0.8,
        }} />
        <Cauldron liquid={liquid} size={W} />
      </span>
      <span style={{
        position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)',
        height: 26, padding: '0 10px', borderRadius: 999, background: '#FFFFFF', boxShadow: `0 3px 0 ${M.overArtLip}`,
        display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 800, color: M.text, whiteSpace: 'nowrap',
      }}>Potions</span>
    </button>
  )
})
