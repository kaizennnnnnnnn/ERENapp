'use client'

// ═══════════════════════════════════════════════════════════════════════════
// ITEM PREVIEW — one drawing per shop item, used everywhere the item appears.
//
// The shop card, the buy sheet and the loadout strip all showed the item
// differently, and the card version was the weakest of the three: a wall
// fixture floating on black with nothing to give it scale, or a hat lying on
// its own with nothing to wear it. Both are fixed by showing the item WHERE
// IT GOES —
//
//   machine    the part, drawn bolted onto a ghost of the machine it completes
//   privilege  its own drawing (PowerArt)
//   prestige   your own name, already wearing it
//
// One component so those never drift apart again.
// ═══════════════════════════════════════════════════════════════════════════

import type {
  AnyShopItem, MachinePartItem, PrivilegeItem, PrestigeItem,
} from '@/lib/trophyShop'
import { MACHINE_PARTS } from '@/lib/weatherMachine'
import { MachineArt, MACHINE_W, MACHINE_H } from '@/components/weather/WeatherMachineProp'
import PowerArt from './PowerArt'
import { TitlePlate, FramePlate } from './prestigeArt'

// ─── Machine part: the piece, on the machine it belongs to ───────────────────
// A gauge on black is a brass circle. The same gauge with the rest of the
// machine ghosted in behind it is an answer to "and where does that go" —
// which is the only question a part card has to settle. So the thumbnail is
// the real prop art with every OTHER part hidden and the body dimmed right
// down: what you are buying is the one thing still in colour.

export function MachinePartThumb({ item, width = 76 }: {
  item: MachinePartItem; width?: number
}) {
  const scale = width / MACHINE_W
  return (
    <div className="relative" style={{
      width, height: Math.round(MACHINE_H * scale),
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', left: 0, top: 0,
        width: MACHINE_W, height: MACHINE_H,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}>
        {/* the husk, right down at the back */}
        <span style={{ position: 'absolute', inset: 0, opacity: 0.3 }}>
          <MachineArt installed={0} total={MACHINE_PARTS.length}
            has={() => false} sky="clear" reduced />
        </span>
        {/* this part, and only this part, lit */}
        <MachineArt
          installed={1}
          total={MACHINE_PARTS.length}
          has={pid => pid === item.part}
          sky="clear"
        />
      </div>
    </div>
  )
}

// ─── The dispatcher ──────────────────────────────────────────────────────────

export default function ItemPreview({ item, size = 76, name = 'YOU' }: {
  item: AnyShopItem
  /** Box width. Each kind fills it in its own aspect. */
  size?: number
  /** Whose name a frame should wrap. */
  name?: string
}) {
  if (item.kind === 'machine') return <MachinePartThumb item={item as MachinePartItem} width={size} />
  if (item.kind === 'privilege') {
    return <PowerArt id={(item as PrivilegeItem).privilege} width={Math.round(size * 0.6)} />
  }
  const p = item as PrestigeItem
  return p.slot === 'title'
    ? <TitlePlate value={p.value} focus={p.focus} scale={6} glory={p.rarity === 'legendary'} />
    : <FramePlate tone={p.value} name={name} scale={6} />
}
