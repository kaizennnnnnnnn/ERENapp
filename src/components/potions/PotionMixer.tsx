'use client'

// ═══════════════════════════════════════════════════════════════════════════
// POTION MIXER — the Lab's toy (lib/potions has the rules).
// ──────────────────────────────────────────────────────────────────────────
// Tap three bottles off the shelf; each pours a drop into the cauldron and the
// liquid turns the colour the paint makes. Then stir it by drawing circles on
// the pot (or "Stir for me"), and it poofs into a potion: there are no wrong
// answers, only potions you haven't found. Give it to him and it shows on him
// for an hour, everywhere; or pour it out and try again. The book keeps what
// you've found, with a nudge for the rest.
//
// In the Meadow look of the Lab's study screen: the lilac ground, a white
// stage card, white tiles, a leaf button for the one thing to do.
//
// PotionMixer gathers the data; PotionMixerView draws it from props.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  Meter, MeadowIcon, PrimaryButton, RoundButton, SecondaryButton, Sheet, Tag, TextButton,
  FONT_ROUNDED, M, TINT, TYPE,
} from '@/components/meadow'
import { Cauldron, CAULDRON_MOUTH, PotionBottle, Vial } from './PotionArt'
import {
  FIRST_FIND_COINS, FULL_BOOK_COINS, INGREDIENTS, INGREDIENT_BY_ID, POTIONS, POURS,
  mixColor, potionFor, sparkles, tint, type IngredientId, type PotionDef,
} from '@/lib/potions'
import { usePotions } from '@/hooks/usePotions'
import { useTasks } from '@/contexts/TaskContext'
import { useCat } from '@/hooks/useCat'
import { playSound } from '@/lib/sounds'

/** One and a half times round the pot. */
const STIR_TOTAL = 1.5 * 2 * Math.PI
const DROP_MS = 520
const POOF_MS = 700
const POT_W = 220
const POT_H = (POT_W * 26) / 30
const STAGE_H = 214
/** Where the liquid's surface is, in px from the stage's top. */
const MOUTH_Y = STAGE_H - POT_H + POT_H * CAULDRON_MOUTH.y

export interface BrewResult { isNew: boolean; complete: boolean }

interface Brewed extends BrewResult {
  def: PotionDef
  color: string
  sparkle: boolean
  pours: IngredientId[]
}

export default function PotionMixer({ onClose }: { onClose: () => void }) {
  const { found, discover, give } = usePotions()
  const { addCoins } = useTasks()
  return (
    <PotionMixerView
      found={found}
      onClose={onClose}
      onBrew={async def => {
        const r = await discover(def.id)
        if (r.isNew) void addCoins(FIRST_FIND_COINS + (r.complete ? FULL_BOOK_COINS : 0))
        return r
      }}
      onGive={give}
    />
  )
}

export function PotionMixerView({ found, onBrew, onGive, onClose }: {
  found: Set<string>
  /** Into the book (and its coins). */
  onBrew: (def: PotionDef) => Promise<BrewResult>
  onGive: (def: PotionDef, color: string, sparkle: boolean) => Promise<void>
  onClose: () => void
}) {
  const cat = useCat()
  const [pours, setPours] = useState<IngredientId[]>([])
  const [dropping, setDropping] = useState<IngredientId | null>(null)
  const [stir, setStir] = useState(0)
  const [stirAngle, setStirAngle] = useState(0)
  const [brewing, setBrewing] = useState(false)
  const [result, setResult] = useState<Brewed | null>(null)
  const [bookOpen, setBookOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [mounted, setMounted] = useState(false)

  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const frame = useRef(0)
  const brewingRef = useRef(false)
  const stirRef = useRef<{ last: number | null; total: number }>({ last: null, total: 0 })
  const potRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    setMounted(true)
    const t = timers.current
    return () => { t.forEach(clearTimeout); cancelAnimationFrame(frame.current) }
  }, [])

  const full = pours.length >= POURS
  const liquid = mixColor(pours)
  const busy = !!dropping || brewing || !!result

  function later(fn: () => void, ms: number) { timers.current.push(setTimeout(fn, ms)) }

  function close() {
    if (closing) return
    playSound('ui_modal_close')
    setClosing(true)
    later(onClose, 200)
  }

  function pour(id: IngredientId) {
    if (full || busy) return
    playSound('ys_pour')
    setDropping(id)
    later(() => {
      setPours(p => [...p, id])
      setDropping(null)
      playSound('care_splash')
    }, DROP_MS)
  }

  function emptyPot() {
    cancelAnimationFrame(frame.current)
    brewingRef.current = false
    stirRef.current = { last: null, total: 0 }
    setPours([]); setStir(0); setStirAngle(0); setBrewing(false); setResult(null)
  }

  // ── Stirring ──────────────────────────────────────────────────────────────
  function advance(total: number) {
    if (stirRef.current.total === 0 && total > 0) playSound('care_soap')
    stirRef.current.total = total
    setStirAngle(total)
    const p = Math.min(1, total / STIR_TOTAL)
    setStir(p)
    if (p >= 1) void finish()
  }

  function angleOf(e: ReactPointerEvent) {
    const r = potRef.current!.getBoundingClientRect()
    return Math.atan2(e.clientY - (r.top + MOUTH_Y + 30), e.clientX - (r.left + r.width / 2))
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!full || busy) return
    e.currentTarget.setPointerCapture(e.pointerId)
    stirRef.current.last = angleOf(e)
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const s = stirRef.current
    if (s.last === null || brewingRef.current) return
    const a = angleOf(e)
    let d = a - s.last
    if (d > Math.PI) d -= 2 * Math.PI
    if (d < -Math.PI) d += 2 * Math.PI
    s.last = a
    advance(s.total + Math.abs(d))
  }
  function onPointerUp() { stirRef.current.last = null }

  /** The same stir, done for you, for anyone who'd rather tap. */
  function stirForMe() {
    if (!full || busy) return
    const from = stirRef.current.total
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 1200)
      advance(from + (STIR_TOTAL - from) * t)
      if (t < 1 && !brewingRef.current) frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
  }

  async function finish() {
    if (brewingRef.current) return
    brewingRef.current = true
    stirRef.current.last = null
    setBrewing(true)
    playSound('chat_poof')
    const made = [...pours]
    const def = potionFor(made)
    const r = await onBrew(def)
    later(() => {
      playSound(r.isNew ? 'gacha_reveal_rare' : 'gacha_reveal_common')
      setResult({ def, color: mixColor(made)!, sparkle: sparkles(made), pours: made, ...r })
      setBrewing(false)
    }, POOF_MS)
  }

  async function giveIt() {
    if (!result) return
    playSound('care_gulp')
    await onGive(result.def, result.color, result.sparkle)
    close()
  }

  const step = brewing ? 'Something is happening...'
    : full ? 'Now stir it: draw circles on the pot'
    : pours.length === 0 ? 'Pour any three things into the pot'
    : `${POURS - pours.length} more to pour`

  if (!mounted) return null

  return createPortal(
    <div className="meadow-root fixed inset-0 z-[80] overflow-y-auto"
      style={{
        background: TINT.lilac, color: M.text, fontFamily: FONT_ROUNDED,
        WebkitUserSelect: 'none', userSelect: 'none',
        animation: closing ? 'potMixerOut 200ms cubic-bezier(0.4, 0, 1, 1) forwards' : 'potMixerIn 260ms cubic-bezier(0.16, 1, 0.3, 1) both',
      }}
      onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
      <div className="mx-auto" style={{ maxWidth: 480, padding: 'calc(10px + env(safe-area-inset-top, 0px)) 16px calc(24px + env(safe-area-inset-bottom, 0px))' }}>

        {/* ── Header: like the Lab's study screen ── */}
        <div className="flex items-center" style={{ gap: 8 }}>
          <h1 className="flex-1 min-w-0" style={{ margin: '0 0 0 4px', fontSize: 24, lineHeight: 1.2, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Potion Mixer</h1>
          <button type="button" onClick={() => { playSound('ui_modal_open'); setBookOpen(true) }}
            aria-label={`Potion book, ${found.size} of ${POTIONS.length} found`}
            className="m-press m-focus inline-flex items-center"
            style={{
              height: 40, padding: '0 14px 0 10px', gap: 6, border: 0, borderRadius: 999, background: '#FFFFFF',
              boxShadow: `0 3px 0 ${M.groundLip}`, fontFamily: 'inherit', fontSize: 15, color: M.text, cursor: 'pointer', ...TYPE.number,
            }}>
            <PotionBottle color="#A06BD6" size={16} />{found.size}/{POTIONS.length}
          </button>
          <RoundButton surface="ground" size={40} ariaLabel="Close the mixer" onClick={close}>
            <MeadowIcon name="close" size={20} color={M.text} />
          </RoundButton>
        </div>

        {/* ── The stage: three pours, the pot, and what to do next ── */}
        <div style={{ marginTop: 16, padding: '14px 14px 16px', borderRadius: 28, background: '#FFFFFF' }}>
          <div className="flex items-center justify-center" style={{ gap: 10 }} aria-label={`${pours.length} of ${POURS} poured`}>
            {Array.from({ length: POURS }, (_, i) => {
              const p = pours[i]
              return (
                <span key={i} aria-hidden style={{
                  width: 28, height: 28, boxSizing: 'border-box', borderRadius: 999,
                  background: p ? INGREDIENT_BY_ID[p].color : 'transparent',
                  border: p ? `3px solid ${M.soft}` : `2px dashed ${M.softLip}`,
                }} />
              )
            })}
          </div>

          <div ref={potRef} className="relative" style={{ height: STAGE_H, marginTop: 4, touchAction: full ? 'none' : undefined, cursor: full && !busy ? 'grab' : undefined }}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            {/* The falling drop, in the colour of what's pouring. */}
            {dropping && (
              <span key={`drop${pours.length}`} className="potDrop" style={{
                position: 'absolute', left: 'calc(50% - 7px)', top: 0, width: 14, height: 18, borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
                background: INGREDIENT_BY_ID[dropping].color, boxShadow: `inset 0 0 0 2px ${M.text}22`,
                ['--pot-drop' as string]: `${MOUTH_Y - 10}px`,
              }} />
            )}

            {/* Steam off a filled pot. */}
            {liquid && !brewing && [0, 1].map(i => (
              <span key={i} className="potSteam" style={{
                position: 'absolute', left: `calc(50% ${i ? '+ 26px' : '- 40px'})`, top: MOUTH_Y - 34,
                width: 16, height: 16, borderRadius: 999, background: '#FFFFFF', boxShadow: `0 0 0 2px ${M.soft}`,
                animationDelay: `${i * 1.1}s`,
              }} />
            ))}

            <div className="absolute" style={{ left: `calc(50% - ${POT_W / 2}px)`, bottom: 0 }}>
              <Cauldron liquid={liquid} size={POT_W} />
            </div>

            {/* Bubbles breaking on the surface. */}
            {liquid && [-48, -8, 34].map((dx, i) => (
              <span key={i} className="potBubble" style={{
                position: 'absolute', left: `calc(50% + ${dx}px)`, top: MOUTH_Y - 2,
                width: 9, height: 9, borderRadius: 999, background: tint(liquid, 0.45), boxShadow: `inset 0 0 0 2px ${tint(liquid, 0.2)}`,
                animationDelay: `${i * 0.45}s`,
              }} />
            ))}

            {/* The splash where the last drop landed. */}
            {pours.length > 0 && (
              <span key={`splash${pours.length}`} className="potSplash" style={{
                position: 'absolute', left: 'calc(50% - 30px)', top: MOUTH_Y - 6, width: 60, height: 16, borderRadius: '50%',
                border: `3px solid ${tint(INGREDIENT_BY_ID[pours[pours.length - 1]].color, 0.3)}`,
              }} />
            )}

            {/* The spoon, going round with your finger. */}
            {full && !brewing && (
              <span aria-hidden style={{
                position: 'absolute', top: MOUTH_Y - 52,
                left: `calc(50% + ${Math.round(Math.cos(stirAngle) * POT_W * 0.22)}px - 4px)`,
                transform: `translateY(${Math.round(Math.sin(stirAngle) * 7)}px) rotate(${Math.round(Math.cos(stirAngle) * 12)}deg)`,
                width: 8, height: 62, borderRadius: 4, background: '#B07A45', boxShadow: `inset -2px 0 0 #8A5A2E`,
                transformOrigin: 'bottom center',
              }} />
            )}

            {/* Poof. */}
            {brewing && (
              <span className="potPoof" style={{ position: 'absolute', left: 'calc(50% - 60px)', top: MOUTH_Y - 70, width: 120, height: 90 }}>
                {[{ l: 0, t: 30, s: 56 }, { l: 34, t: 0, s: 62 }, { l: 64, t: 28, s: 56 }].map((b, i) => (
                  <span key={i} style={{ position: 'absolute', left: b.l, top: b.t, width: b.s, height: b.s, borderRadius: 999, background: '#FFFFFF', boxShadow: `0 0 0 3px ${liquid ?? M.soft}` }} />
                ))}
              </span>
            )}
          </div>

          <p role="status" style={{ margin: '12px 0 0', textAlign: 'center', fontSize: 15, fontWeight: 800 }}>{step}</p>
          {full && !brewing && !result && (
            <div className="flex items-center" style={{ gap: 10, marginTop: 10 }}>
              <Meter value={stir} label="Stirred" height={10} color={liquid ?? M.leaf} style={{ flex: '1 1 auto' }} />
              <SecondaryButton size="sm" onClick={() => { playSound('ui_tap'); stirForMe() }}>Stir for me</SecondaryButton>
            </div>
          )}
        </div>

        {/* ── The shelf ── */}
        <div className="grid grid-cols-3" style={{ gap: 10, marginTop: 14 }}>
          {INGREDIENTS.map(ing => {
            const n = pours.filter(p => p === ing.id).length
            const off = full || busy
            return (
              <button key={ing.id} type="button" onClick={() => pour(ing.id)} disabled={off}
                aria-label={`Pour ${ing.name}`}
                className="m-press m-focus relative flex flex-col items-center"
                style={{
                  padding: '10px 6px 10px', gap: 6, border: 0, borderRadius: 20, background: '#FFFFFF',
                  fontFamily: 'inherit', fontSize: 13, fontWeight: 800, color: M.text, cursor: off ? 'default' : 'pointer',
                  opacity: off && !n ? 0.5 : 1,
                }}>
                <Vial color={ing.color} size={36} />
                {ing.name}
                {n > 0 && (
                  <span aria-hidden style={{
                    position: 'absolute', top: 6, right: 6, minWidth: 20, height: 20, boxSizing: 'border-box', padding: '0 5px',
                    borderRadius: 999, background: M.leaf, color: '#FFFFFF', fontSize: 11, lineHeight: '20px', ...TYPE.number,
                  }}>{n}</span>
                )}
              </button>
            )
          })}
        </div>

        {pours.length > 0 && !result && !brewing && (
          <div className="flex justify-center" style={{ marginTop: 6 }}>
            <TextButton tone="muted" onClick={() => { playSound('ui_back'); emptyPot() }}>Empty the pot</TextButton>
          </div>
        )}
      </div>

      {/* ── What came out ── */}
      <Sheet open={!!result} title={result?.def.name ?? ''} onClose={() => { playSound('ui_modal_close'); emptyPot() }}
        footer={result && (
          <div className="flex flex-col" style={{ gap: 4 }}>
            <PrimaryButton full onClick={() => { void giveIt() }}>{cat.t('Give it to {name}')}</PrimaryButton>
            <TextButton tone="muted" onClick={() => { playSound('ui_back'); emptyPot() }}>Pour it out</TextButton>
          </div>
        )}>
        {result && (
          <>
            <div className="relative flex items-center justify-center" style={{ height: 170, borderRadius: 22, background: tint(result.color, 0.8) }}>
              <PotionBottle color={result.color} size={96} />
              <span className="flex" style={{ position: 'absolute', top: 12, left: 12, gap: 6 }}>
                {result.isNew && <Tag tone="love" size="sm">New</Tag>}
                {result.def.rare && <Tag tone="epic" caps size="sm" style={{ background: '#FFFFFF' }}>Rare</Tag>}
              </span>
            </div>
            <p style={{ margin: '16px 4px 0', fontSize: 17, lineHeight: 1.4, fontWeight: 700 }}>{cat.t(result.def.blurb)}</p>
            <p style={{ margin: '4px 4px 0', fontSize: 14, fontWeight: 600, color: M.text2 }}>For an hour, in every room.</p>
            <div className="flex flex-wrap" style={{ gap: 6, margin: '14px 4px 0' }}>
              {result.pours.map((p, i) => (
                <Tag key={i} tone="soft" icon={<span style={{ width: 12, height: 12, borderRadius: 999, background: INGREDIENT_BY_ID[p].color, boxShadow: `inset 0 0 0 2px ${M.text}1F` }} />}>
                  {INGREDIENT_BY_ID[p].name}
                </Tag>
              ))}
            </div>
            {result.isNew && (
              <div className="flex items-center" style={{ gap: 8, margin: '14px 4px 0', fontSize: 15, fontWeight: 800 }}>
                <MeadowIcon name="coin" size={20} />
                +{FIRST_FIND_COINS + (result.complete ? FULL_BOOK_COINS : 0)} coins
                <span style={{ fontWeight: 600, color: M.text2 }}>
                  {result.complete ? 'for finding every potion' : 'for a new potion'}
                </span>
              </div>
            )}
          </>
        )}
      </Sheet>

      <PotionBook open={bookOpen} found={found} onClose={() => setBookOpen(false)} />

      <style>{`
        @keyframes potMixerIn  { 0% { opacity: 0; transform: scale(0.94); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes potMixerOut { 0% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(0.96); } }
      `}</style>
    </div>,
    document.body,
  )
}

// ─── The book ────────────────────────────────────────────────────────────────

function PotionBook({ open, found, onClose }: { open: boolean; found: Set<string>; onClose: () => void }) {
  const cat = useCat()
  const n = POTIONS.filter(p => found.has(p.id)).length
  return (
    <Sheet open={open} title="Potion book" onClose={() => { playSound('ui_modal_close'); onClose() }} height="calc(100% - 56px)">
      <div className="flex items-center justify-between" style={{ margin: '0 4px 8px', gap: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: M.text2 }}>
          <span style={{ color: M.text, ...TYPE.number }}>{n}</span> of {POTIONS.length} found
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: M.label }}>+{FIRST_FIND_COINS} coins each new one</span>
      </div>
      <Meter value={n / POTIONS.length} label="Potions found" />
      <div className="grid grid-cols-3" style={{ gap: 8, marginTop: 14 }}>
        {POTIONS.map(p => {
          const got = found.has(p.id)
          return (
            <div key={p.id} className="relative flex flex-col items-center"
              style={{ padding: '10px 6px 12px', gap: 4, borderRadius: 18, border: `2px solid ${M.hairline}`, textAlign: 'center' }}>
              <span className="flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: 16, background: got ? tint(p.color, 0.78) : M.soft }}>
                <PotionBottle color={got ? p.color : null} size={34} />
              </span>
              <span style={{ fontSize: 13, lineHeight: 1.2, fontWeight: 800, color: got ? M.text : M.faint }}>{got ? p.name : '???'}</span>
              <span style={{ fontSize: 11, lineHeight: 1.3, fontWeight: 600, color: M.text2 }}>{got ? cat.t(p.blurb) : p.hint}</span>
              {p.rare && <Tag tone="epic" caps size="sm" style={{ marginTop: 2, height: 18, fontSize: 10 }}>Rare</Tag>}
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}
