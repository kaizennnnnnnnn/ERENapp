'use client'

// ═══════════════════════════════════════════════════════════════════════════
// LOADOUT — what you are wearing, where, right now.
//
// The shop could already equip everything: each card carries its own
// WEAR / HANG / EQUIP toggle. Nobody found them, because a shop is a list of
// things you do not own yet, and the four bought things were scattered eight
// screens down it. This panel is the answer to "where do I put it on" — every
// slot in the game on one strip, filled or empty, and tapping one jumps to the
// shelf that stocks it.
//
// It also says which slots are NOT here: skins are the closet's, and powers
// are spent rather than worn.
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'
import Link from 'next/link'
import { accessoryDef, decorDef, prestigeDef, type ShopKind, type DecorRoom } from '@/lib/trophyShop'
import type { TrophyCosmetics } from '@/hooks/useTrophyCosmetics'
import { IconDress, IconShelf, IconCrown, IconChevronRight } from '@/components/PixelIcons'
import { WornThumb, DecorTile } from './ItemPreview'
import { TitlePlate, FramePlate } from './prestigeArt'
import { playSound } from '@/lib/sounds'

const ROOMS: { room: DecorRoom; label: string }[] = [
  { room: 'feed',  label: 'KITCHEN' },
  { room: 'play',  label: 'PLAYROOM' },
  { room: 'sleep', label: 'BEDROOM' },
  { room: 'wash',  label: 'BATHROOM' },
]

const SLOT: React.CSSProperties = {
  background: 'linear-gradient(180deg, #16101F 0%, #08050D 100%)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 3,
}
const FILLED: React.CSSProperties = {
  border: '1.5px solid rgba(99,240,148,0.45)',
  boxShadow: '0 0 9px rgba(99,240,148,0.18)',
}

export default memo(function EquippedBar({
  cos, name, onJump,
}: {
  cos: TrophyCosmetics
  /** The player's own name, for the nameplate preview. */
  name: string
  onJump(kind: ShopKind): void
}) {
  const worn = accessoryDef(cos.accessory)
  const title = prestigeDef(cos.myTitle)
  const frame = prestigeDef(cos.myFrame)
  const roomsUsed = ROOMS.filter(r => decorDef(cos.decor[r.room])).length

  function jump(kind: ShopKind) {
    playSound('ui_tap')
    onJump(kind)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-pixel" style={{ fontSize: 7, letterSpacing: 2, color: '#9A8AA8' }}>
          YOUR LOADOUT
        </span>
        <span className="font-pixel" style={{ fontSize: 5, letterSpacing: 1, color: '#6E6080' }}>
          TAP A SLOT TO CHANGE IT
        </span>
      </div>

      {/* ── Eren + your name ── */}
      <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <button onClick={() => jump('accessory')}
          className="flex flex-col items-center gap-1 px-2 py-2 active:translate-y-[1px] transition-transform"
          style={{ ...SLOT, ...(worn ? FILLED : null) }}>
          <span className="font-pixel" style={{ fontSize: 5, letterSpacing: 1, color: '#8B7F9B' }}>
            ON EREN
          </span>
          <span style={{ height: 44, display: 'flex', alignItems: 'center' }}>
            {worn
              ? <WornThumb item={worn} size={44} />
              : <span style={{ opacity: 0.22 }}><IconDress size={26} /></span>}
          </span>
          <span className="font-pixel truncate" style={{
            fontSize: 6, letterSpacing: 0.5, color: worn ? '#63F094' : '#5E5470', maxWidth: '100%',
          }}>{worn ? worn.name.toUpperCase() : 'BARE'}</span>
        </button>

        <button onClick={() => jump('prestige')}
          className="flex flex-col items-center gap-1 px-2 py-2 active:translate-y-[1px] transition-transform"
          style={{ ...SLOT, ...(title || frame ? FILLED : null) }}>
          <span className="font-pixel" style={{ fontSize: 5, letterSpacing: 1, color: '#8B7F9B' }}>
            BESIDE YOUR NAME
          </span>
          <span className="flex flex-col items-center justify-center gap-1" style={{ height: 44 }}>
            {frame?.slot === 'frame'
              ? <FramePlate tone={frame.value} name={name} scale={5} />
              : <span className="font-pixel" style={{
                  fontSize: 6, letterSpacing: 1.5, color: '#8B7F9B',
                }}>{name.toUpperCase()}</span>}
            {title?.slot === 'title' && (
              <TitlePlate value={title.value} focus={title.focus} scale={4}
                glory={title.rarity === 'legendary'} />
            )}
          </span>
          <span className="font-pixel" style={{
            fontSize: 6, letterSpacing: 0.5, color: title || frame ? '#63F094' : '#5E5470',
          }}>{title || frame ? 'EQUIPPED' : 'PLAIN'}</span>
        </button>
      </div>

      {/* ── The four walls ── */}
      <button onClick={() => jump('decor')}
        className="w-full flex flex-col gap-1.5 px-2 py-2 active:translate-y-[1px] transition-transform"
        style={{ ...SLOT, ...(roomsUsed ? FILLED : null) }}>
        <span className="flex items-center justify-between w-full">
          <span className="font-pixel" style={{ fontSize: 5, letterSpacing: 1, color: '#8B7F9B' }}>
            HANGING IN THE ROOMS
          </span>
          <span className="font-pixel" style={{
            fontSize: 5, letterSpacing: 1, color: roomsUsed ? '#63F094' : '#5E5470',
          }}>{roomsUsed}/4</span>
        </span>
        <span className="grid w-full" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
          {ROOMS.map(({ room, label }) => {
            const d = decorDef(cos.decor[room])
            return (
              <span key={room} className="flex flex-col items-center gap-1">
                <span className="flex items-center justify-center w-full" style={{
                  height: 38,
                  background: d ? undefined : 'repeating-linear-gradient(45deg, rgba(255,255,255,0.035) 0 3px, transparent 3px 6px)',
                  border: d ? undefined : '1px dashed rgba(255,255,255,0.13)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}>
                  {d
                    ? <DecorTile item={d} width={46} />
                    : <span style={{ opacity: 0.25 }}><IconShelf size={16} /></span>}
                </span>
                <span className="font-pixel" style={{
                  fontSize: 4.5, letterSpacing: 0.5, color: d ? '#A7F3C0' : '#5E5470',
                }}>{label}</span>
              </span>
            )
          })}
        </span>
      </button>

      {/* ── The slots that live somewhere else ── */}
      <div className="flex gap-2">
        <Link href="/closet" onClick={() => playSound('ui_tap')}
          className="flex-1 flex items-center gap-2 px-2.5 py-2 active:translate-y-[1px] transition-transform"
          style={SLOT}>
          <IconDress size={14} />
          <span className="flex-1 text-left">
            <span className="font-pixel block" style={{ fontSize: 6, letterSpacing: 1, color: '#C4B8D0' }}>
              SKINS
            </span>
            <span className="text-[9px]" style={{ color: '#6E6080' }}>In the Closet, per room</span>
          </span>
          <IconChevronRight size={10} />
        </Link>
        <button onClick={() => jump('privilege')}
          className="flex-1 flex items-center gap-2 px-2.5 py-2 active:translate-y-[1px] transition-transform"
          style={SLOT}>
          <IconCrown size={14} />
          <span className="flex-1 text-left">
            <span className="font-pixel block" style={{ fontSize: 6, letterSpacing: 1, color: '#C4B8D0' }}>
              POWERS
            </span>
            <span className="text-[9px]" style={{ color: '#6E6080' }}>Spent, not worn</span>
          </span>
          <IconChevronRight size={10} />
        </button>
      </div>
    </div>
  )
})
