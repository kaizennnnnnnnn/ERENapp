'use client'

// ═══════════════════════════════════════════════════════════════════════════
// THE CAULDRON — standing on the Lab rug beside Eren. Tap it to open the
// Potion Mixer.
//
// A thing you walk up to rather than a button, like the weather machine on the
// other side of the rug: the pot is where potions come from, so the pot is what
// you tap. It bubbles in the colour of the potion he's on (violet when he's on
// none), so a glance at the room says what he last drank. A small white pill
// under it names it, the Meadow way, since a pot on its own could be decor.
//
// WHERE IT STANDS. Its first spot mirrored the machine, in the strip of bare
// floorboard between the desk's feet and the rug. On the right that strip is
// taken: the side table stands in it, its legs down to art y ~1220, and the pot
// ended up hung over the table's legs and the desk's doors. So it stands out on
// the rug, on Eren's ground line: `bottom: 24%` is where his paws land (his
// box at 21%, the sprite ending ~30px above it), which also puts its feet below
// the side table's, so it reads as in front of it. `right: 3%` keeps its left
// edge ~25px clear of the cat at 390px and ~11px at 360px. The box is the pot
// alone, placed by its feet; the name hangs below it, so the label never lifts
// the pot off the floor. VIEWPORT percent, like the machine, so it lands on the
// same patch of rug whatever the phone's crop of the art.
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'
import { M } from '@/components/meadow'
import { Cauldron, CAULDRON_MOUTH } from './PotionArt'
import { useActivePotion } from '@/hooks/usePotions'
import { playSound } from '@/lib/sounds'
import { tint } from '@/lib/potions'

const W = 96
const H = (W * 26) / 30
const STANDS = { right: '3%', bottom: '24%' }
const IDLE = '#A06BD6'

export default memo(function CauldronProp({ onOpen }: { onOpen(): void }) {
  const potion = useActivePotion()
  const liquid = potion?.color ?? IDLE
  return (
    <button type="button" onClick={() => { playSound('ui_modal_open'); onOpen() }}
      aria-label="Open the Potion Mixer"
      className="absolute m-press m-focus"
      style={{ ...STANDS, zIndex: 11, width: W, height: H, padding: 0, border: 0, background: 'transparent', cursor: 'pointer' }}>
      {/* Its shadow on the rug: the one thing that says it is standing there
          rather than pasted on. Hard-edged like every shadow in here, in warm
          ink because it lands on a warm rug. */}
      <span className="absolute" style={{
        left: '8%', right: '8%', bottom: -4, height: 10, borderRadius: '50%', background: 'rgba(46,22,10,0.32)',
      }} />
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
        position: 'absolute', left: '50%', top: 'calc(100% + 8px)', transform: 'translateX(-50%)',
        height: 26, padding: '0 10px', borderRadius: 999, background: '#FFFFFF', boxShadow: `0 3px 0 ${M.overArtLip}`,
        display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 800, color: M.text, whiteSpace: 'nowrap',
      }}>Potions</span>
    </button>
  )
})
