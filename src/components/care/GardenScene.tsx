'use client'

// ─── THE GARDEN ──────────────────────────────────────────────────────────────
// The one room you look after together rather than take turns in.
//
// Six raised beds. Each of you gets a seed a day; a flower opens after enough
// waterings (daisy 2, tulip 3, sunflower 5) and each of you can water once a
// day, so two people grow it twice as fast — and every day you BOTH watered a
// plant raises its chance of opening in a rare colour. Two flowers of a kind
// blooming side by side can open the next one in a mixed colour. Rain from the
// weather machine, in any window of the house, waters the whole garden.
//
// Pick a bloom into your basket, then put it in your own vase or give it to
// the other one (it arrives in their vase, with a note). The flower book keeps
// every colour this household has ever grown. The rules themselves are
// server-side: supabase/migration_garden.sql.
//
// The art is outdoors, so there is no light switch: night is just night. The
// beds, flowers and butterflies are drawn here over the open lawn, so the
// picture behind them can be repainted without touching any of this.

import { useEffect, useMemo, useRef, useState } from 'react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import BlinkingEren from '@/components/BlinkingEren'
import ErenIdleLayer from '@/components/ErenIdleLayer'
import PetTarget, { PurrFx, PURR } from '@/components/care/PetTarget'
import { useRoomEren, type ErenSpriteProps } from '@/hooks/useRoomEren'
import { useErenReaction } from '@/hooks/useErenReaction'
import { useIsDark } from '@/hooks/useIsDark'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useCat } from '@/hooks/useCat'
import { useErenStats } from '@/hooks/useErenStats'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useGarden, type GardenState } from '@/hooks/useGarden'
import { playSound } from '@/lib/sounds'
import { weatherDef, type WeatherId } from '@/lib/weather'
import WeatherFx from '@/components/weather/WeatherFx'
import {
  BEDS, COLUMNS, NEED, SPECIES, SPECIES_ORDER, colourOf, flowerPhrase, rainedToday, stageOf, wateredToday,
  type GardenPlant, type Species,
} from '@/lib/garden'
import { Bed, Butterfly, Flower, GhostFlower, Plant } from '@/components/garden/GardenArt'
import {
  Card, MeadowIcon, Meter, PrimaryButton, RoundButton, SecondaryButton, Sheet, Tag,
  M, PERSON, ROOM_HEADER_CLEARANCE, TINT, TYPE, personColor,
} from '@/components/meadow'

interface Props { onClose: () => void }

const EREN_FALLBACK = { src: '/erenGood_notail.png', tailSrc: '/erenGood_tail.png' }
const EREN_SIZE = 150
const BAR_BOTTOM = 'calc(18px + env(safe-area-inset-bottom, 0px))'
const EREN_BOTTOM = 'calc(92px + env(safe-area-inset-bottom, 0px))'

/** Skies that happen IN the sky (drawn behind the house and the tree). The
 *  rest fall on everything. */
const SKY_ONLY = new Set<WeatherId>(['sunrise', 'sunset', 'meteors_gold', 'meteors_rose', 'aurora'])

type Open =
  | { kind: 'bed'; slot: number }
  | { kind: 'basket' }
  | { kind: 'book' }
  | null

export default function GardenScene(_props: Props) {
  void _props
  const { user, profile } = useAuth()
  const { partner, isSolo, sendMessage } = useCouple()
  const cat = useCat()
  const isDark = useIsDark()
  const { stats } = useErenStats(profile?.household_id ?? null)
  const garden = useGarden(profile?.household_id ?? null, user?.id ?? null)
  const eren = useRoomEren('garden', EREN_FALLBACK)

  const myColor = personColor(profile?.heart)
  const partnerColor = partner?.heart ? personColor(partner.heart) : myColor === PERSON.brown ? PERSON.pink : PERSON.brown

  // The garden's weather: rain or a storm in any window falls here too (and
  // waters the beds, server-side); otherwise it has the living room's sky.
  const weather = useMemo<WeatherId | null>(() => {
    const map = (stats?.room_weather ?? {}) as Record<string, string>
    const all = Object.values(map)
    if (all.includes('storm')) return 'storm'
    if (all.includes('rain')) return 'rain'
    const home = weatherDef(map.home)
    return home && home.id !== 'clear' ? home.id : null
  }, [stats?.room_weather])

  return (
    <GardenRoom
      g={garden} me={user?.id ?? null} isSolo={isSolo} isDark={isDark} weather={weather} eren={eren}
      partner={partner ? { id: partner.id, name: (partner.name ?? '').trim().split(/\s+/)[0] || 'your partner', color: partnerColor } : null}
      myColor={myColor} catName={cat.name} catText={cat.t}
      onGive={text => { void sendMessage(text) }}
    />
  )
}

export interface GardenRoomProps {
  g: GardenState
  me: string | null
  partner: { id: string; name: string; color: string } | null
  isSolo: boolean
  isDark: boolean
  weather: WeatherId | null
  eren: ErenSpriteProps
  myColor: string
  catName: string
  catText: (template: string) => string
  /** Sends the note that goes with a gift of flowers. */
  onGive: (text: string) => void
}

/** The room itself, from plain props (GardenScene gathers them). */
export function GardenRoom({ g, me, partner, isSolo, isDark, weather, eren, myColor, catName, catText, onGive }: GardenRoomProps) {
  const reduced = useReducedMotion()
  const reaction = useErenReaction()

  const [open, setOpen] = useState<Open>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(toastTimer.current), [])
  const say = (msg: string) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }

  const partnerName = partner?.name ?? 'your partner'
  const partnerColor = partner?.color ?? (myColor === PERSON.brown ? PERSON.pink : PERSON.brown)
  const wet = weather === 'rain' || weather === 'storm'

  const emptyBed = g.beds.findIndex(b => b === null)
  const status = g.raining || wet
    ? 'It’s raining. Every bed is watered today.'
    : !g.plantedToday && emptyBed >= 0
      ? 'Your seed for today is ready. Tap an empty bed.'
      : !g.plantedToday
        ? 'Every bed is full. Pick a bloom to make room.'
        : 'Seed planted. A new one comes tomorrow.'

  async function water() {
    if (busy) return
    setBusy(true)
    playSound('ui_select')
    const r = await g.water()
    setBusy(false)
    if (!r.ok) { say('Couldn’t reach the garden. Try again.'); return }
    if (r.bloomed) {
      playSound('quest_complete')
      say(r.bloomed === 1 ? 'A flower opened!' : `${r.bloomed} flowers opened!`)
    } else if (isSolo) {
      say(catText(`Watered. {name} helped, so it counts twice.`))
    } else {
      say(`Watered. If ${partnerName} waters today too, it grows twice as fast.`)
    }
  }

  const waterLabel = g.growing === 0 ? 'Nothing to water' : g.wateredToday ? 'Watered today' : 'Water the garden'

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden">

      {/* ══ THE GARDEN ══ */}
      <div className="absolute inset-0" style={{
        backgroundImage: `url(${isDark ? '/garden/night.png' : '/garden/day.png'})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        imageRendering: 'pixelated',
        WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', pointerEvents: 'none',
      }} />

      {weather && <GardenWeather id={weather} dark={isDark} still={reduced} />}

      {/* ══ STATUS ══ */}
      <div className="absolute inset-x-0 z-20 flex justify-center px-4 pointer-events-none"
        style={{ top: `calc(var(--safe-top) + ${ROOM_HEADER_CLEARANCE + 10}px)` }}>
        <span role="status" className="meadow-root" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, maxWidth: 340,
          padding: '8px 14px 8px 10px', borderRadius: 999, background: '#FFFFFF',
          boxShadow: `0 3px 0 ${M.overArtLip}`, fontSize: 13, fontWeight: 700, color: M.text,
        }}>
          <MeadowIcon name={wet ? 'cloudRain' : 'daisy'} size={18} />
          {toast ?? status}
        </span>
      </div>

      {/* ══ THE BEDS ══ */}
      <div className="absolute z-10" style={{
        top: '44%', left: '50%', transform: 'translateX(-50%)',
        width: 'min(94vw, 380px)',
        display: 'grid', gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`, rowGap: 6,
      }}>
        {g.beds.map((p, slot) => (
          <BedCell key={slot} slot={slot} plant={p} today={g.today} me={me}
            canPlant={!g.plantedToday} myColor={myColor} partnerColor={partnerColor}
            onTap={() => { playSound('ui_tap'); setOpen({ kind: 'bed', slot }) }} />
        ))}
      </div>

      {/* ══ BUTTERFLIES ══ not in the rain, not at night */}
      {!wet && !isDark && !reduced && (
        <div aria-hidden className="absolute inset-0 z-[11] pointer-events-none">
          <span className="gdFly gdFlyA"><Butterfly size={18} tone="#F6BCCD" /></span>
          <span className="gdFly gdFlyB"><Butterfly size={15} tone="#FFE3A0" /></span>
        </div>
      )}

      {/* ══ EREN ══ sits on the lawn in front of the beds */}
      <div className="absolute z-[12]" style={{ bottom: EREN_BOTTOM, left: '50%', transform: 'translateX(-50%)' }}>
        <PetTarget reaction={reaction}>
          <ErenIdleLayer disabled={reaction.active}>
            <BlinkingEren size={EREN_SIZE} {...eren} />
          </ErenIdleLayer>
        </PetTarget>
        {reaction.phase === PURR && <PurrFx bottom="60%" />}
      </div>

      {/* ══ BOTTOM BAR ══ */}
      <div className="meadow-root absolute inset-x-0 z-20 flex items-center justify-center px-4"
        style={{ bottom: BAR_BOTTOM, gap: 12 }}>
        <div className="relative">
          <RoundButton ariaLabel={`Your basket and vase${g.basket.length ? `, ${g.basket.length} picked` : ''}`}
            surface="art" size={54}
            onClick={() => { playSound('ui_modal_open'); setOpen({ kind: 'basket' }) }}>
            <MeadowIcon name="basket" size={28} />
          </RoundButton>
          {g.basket.length > 0 && <Badge n={g.basket.length} />}
        </div>
        <PrimaryButton size="lg" busy={busy} disabled={g.growing === 0 || g.wateredToday || g.loading}
          icon={<MeadowIcon name={g.wateredToday && g.growing > 0 ? 'check' : 'drop'} size={20} mono color="#FFFFFF" />}
          onClick={water} style={{ flex: '0 1 220px' }}>
          {waterLabel}
        </PrimaryButton>
        <RoundButton ariaLabel="The flower book" surface="art" size={54}
          onClick={() => { playSound('ui_modal_open'); setOpen({ kind: 'book' }) }}>
          <MeadowIcon name="daisy" size={28} />
        </RoundButton>
      </div>

      {g.failed && !g.loading && g.beds.every(b => b === null) && (
        <div className="meadow-root absolute inset-x-0 z-30 flex justify-center px-6" style={{ top: '46%' }}>
          <Card padding="16px 18px" style={{ maxWidth: 320, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>The garden couldn&apos;t load.</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 500, color: M.text2 }}>Check your connection and come back.</p>
          </Card>
        </div>
      )}

      {/* ══ SHEETS ══ */}
      <BedSheet
        open={open?.kind === 'bed'} slot={open?.kind === 'bed' ? open.slot : -1}
        plant={open?.kind === 'bed' ? g.beds[open.slot] : null}
        today={g.today} me={me} partnerId={partner?.id ?? null} partnerName={partnerName}
        isSolo={isSolo} catName={catName} plantedToday={g.plantedToday}
        onClose={() => { playSound('ui_modal_close'); setOpen(null) }}
        onPlant={async (slot, species) => {
          const r = await g.plant(slot, species)
          setOpen(null)
          if (r.ok) { playSound('coin_pickup'); say(`Planted a ${SPECIES[species].name.toLowerCase()}. Water it to help it grow.`) }
          else say(r.reason === 'already_planted' ? 'You’ve planted today’s seed already.' : r.reason === 'bed_taken' ? 'Someone just planted there.' : 'Couldn’t reach the garden. Try again.')
        }}
        onPick={async id => {
          const r = await g.pick(id)
          setOpen(null)
          if (r.ok) { playSound('coin_pickup'); say('Picked. It’s in your basket.') }
          else say('Couldn’t pick it. Try again.')
        }}
      />

      <BasketSheet
        open={open?.kind === 'basket'} basket={g.basket} vase={g.vase}
        me={me} partnerId={partner?.id ?? null} partnerName={partnerName} isSolo={isSolo}
        onClose={() => { playSound('ui_modal_close'); setOpen(null) }}
        onPlace={async to => {
          const ids = g.basket.map(p => p.id)
          const giving = to !== me
          const what = phraseList(g.basket)
          const r = await g.place(ids, to)
          if (!r.ok) { say('Couldn’t reach the garden. Try again.'); return }
          setOpen(null)
          if (giving) {
            playSound('gift_open')
            // A note from you, so it reaches them like any other (with a push).
            onGive(`Flowers from the garden, for you: ${what}.`)
            say(`In ${partnerName}’s vase now.`)
          } else {
            playSound('coin_pickup')
            say('In your vase.')
          }
        }}
      />

      <BookSheet open={open?.kind === 'book'} book={g.book}
        onClose={() => { playSound('ui_modal_close'); setOpen(null) }} />

      <style>{`
        .gdFly { position: absolute; display: block; }
        .gdFlyA { left: 14%; top: 46%; animation: gdFlyA 11s ease-in-out infinite; }
        .gdFlyB { left: 70%; top: 52%; animation: gdFlyB 13s ease-in-out infinite; }
        .gdFly > svg { animation: gdFlap 0.32s steps(2) infinite; transform-origin: 50% 50%; }
        @keyframes gdFlap { 0% { transform: scaleX(1); } 100% { transform: scaleX(0.35); } }
        @keyframes gdFlyA {
          0%   { transform: translate(0, 0); }
          25%  { transform: translate(90px, -40px); }
          50%  { transform: translate(170px, 10px); }
          75%  { transform: translate(60px, 60px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes gdFlyB {
          0%   { transform: translate(0, 0); }
          30%  { transform: translate(-120px, -30px); }
          60%  { transform: translate(-60px, 70px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes gdNudge { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
      `}</style>
    </div>
  )
}

// ── The weather, outdoors ────────────────────────────────────────────────────

function GardenWeather({ id, dark, still }: { id: WeatherId; dark: boolean; still: boolean }) {
  const skyOnly = SKY_ONLY.has(id)
  const wet = id === 'rain' || id === 'storm'
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
      {wet && <div className="absolute inset-0" style={{ background: 'rgba(40, 56, 90, 0.16)' }} />}
      {/* The art's own rectangle, reproduced from `cover` (see RoomWeather). */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        minWidth: '100%', minHeight: '100%', aspectRatio: '768 / 1376',
      }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, width: '100%', height: skyOnly ? '31%' : '100%',
          overflow: 'hidden', containerType: 'size',
        }}>
          <WeatherFx id={id} still={still} lit={!dark} />
        </div>
        {/* A sky-only weather happens behind the house and the tree: draw the
            garden back over it with the sky cut out. */}
        {skyOnly && (
          <img src={dark ? '/garden/night_cut.png' : '/garden/day_cut.png'} alt="" draggable={false}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated' }} />
        )}
      </div>
    </div>
  )
}

// ── One bed ──────────────────────────────────────────────────────────────────

function BedCell({ slot, plant, today, me, canPlant, myColor, partnerColor, onTap }: {
  slot: number
  plant: GardenPlant | null
  today: string
  me: string | null
  canPlant: boolean
  myColor: string
  partnerColor: string
  onTap: () => void
}) {
  const stage = plant ? stageOf(plant) : null
  const watered = plant ? wateredToday(plant, today) : []
  const rained = plant ? rainedToday(plant, today) : false
  const label = !plant
    ? `Bed ${slot + 1}, empty${canPlant ? '. Plant your seed here' : ''}`
    : stage === 'bloom'
      ? `Bed ${slot + 1}: ${flowerPhrase(plant)}, in bloom`
      : `Bed ${slot + 1}: a ${SPECIES[plant.species].name.toLowerCase()}, growing`
  const size = plant?.species === 'sunflower' ? 64 : plant?.species === 'tulip' ? 56 : 52

  return (
    <button type="button" onClick={onTap} aria-label={label} className="m-press flex flex-col items-center"
      style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
      {/* What grows, standing in the soil */}
      <div className="flex items-end justify-center" style={{ height: 66, marginBottom: -16, position: 'relative', zIndex: 1 }}>
        {plant && stage && stage !== 'seed' && (
          <span className={stage === 'bloom' ? 'gdBloom' : undefined}>
            <Plant species={plant.species} stage={stage} colour={plant.color} size={size} />
          </span>
        )}
        {plant && stage === 'seed' && (
          // A fresh seed: a little mound in the soil.
          <span style={{ width: 10, height: 5, borderRadius: '5px 5px 1px 1px', background: '#4E3424', marginBottom: 6 }} />
        )}
        {!plant && canPlant && (
          <span style={{ marginBottom: 18, animation: 'gdNudge 1.6s ease-in-out infinite' }}>
            <span className="flex items-center justify-center" style={{
              width: 26, height: 26, borderRadius: 999, background: 'rgba(255,255,255,0.85)',
              boxShadow: `0 2px 0 ${M.overArtLip}`,
            }}>
              <MeadowIcon name="plus" size={16} />
            </span>
          </span>
        )}
      </div>
      <Bed width={104} wet={watered.length > 0 || rained} />
      {/* Who watered it today: a dot each, a drop for the rain */}
      <div className="flex items-center justify-center" style={{ height: 12, gap: 3, marginTop: 2 }}>
        {plant && !plant.bloomed_at && watered.map(id => (
          <span key={id} style={{
            width: 7, height: 7, borderRadius: 999, background: id === me ? myColor : partnerColor,
            boxShadow: '0 0 0 1.5px #FFFFFF',
          }} />
        ))}
        {plant && !plant.bloomed_at && rained && <MeadowIcon name="drop" size={11} />}
      </div>
      <style>{`
        .gdBloom { display: block; animation: gdSway 3.2s ease-in-out infinite; transform-origin: 50% 100%; }
        @keyframes gdSway { 0%, 100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }
        @media (prefers-reduced-motion: reduce) { .gdBloom { animation: none; } }
      `}</style>
    </button>
  )
}

function Badge({ n }: { n: number }) {
  return (
    <span aria-hidden style={{
      position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, padding: '0 5px', boxSizing: 'border-box',
      borderRadius: 999, background: M.love, color: '#FFFFFF', fontSize: 12, fontWeight: 800,
      display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #FFFFFF',
    }}>{n}</span>
  )
}

// ── Tapping a bed ────────────────────────────────────────────────────────────

function BedSheet({
  open, slot, plant, today, me, partnerId, partnerName, isSolo, catName, plantedToday, onClose, onPlant, onPick,
}: {
  open: boolean
  slot: number
  plant: GardenPlant | null
  today: string
  me: string | null
  partnerId: string | null
  partnerName: string
  isSolo: boolean
  catName: string
  plantedToday: boolean
  onClose: () => void
  onPlant: (slot: number, species: Species) => Promise<void>
  onPick: (id: string) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  // A sheet keeps its last content while it drops away, instead of going blank.
  const [shown, setShown] = useState<{ slot: number; plant: GardenPlant | null }>({ slot, plant })
  useEffect(() => { if (open) setShown({ slot, plant }) }, [open, slot, plant])
  const p = shown.plant

  // Mid-sentence: "Planted by you", "Planted by Jovan".
  const who = (id: string | null) =>
    id === me ? 'you' : id && id === partnerId ? partnerName : isSolo ? catName : 'someone'

  let title = 'Plant a seed'
  let body: JSX.Element

  if (!p) {
    body = plantedToday ? (
      <p style={{ margin: '4px 4px 8px', fontSize: 15, fontWeight: 500, color: M.text2 }}>
        You&apos;ve planted today&apos;s seed. Your next one comes tomorrow.
      </p>
    ) : (
      <div className="flex flex-col" style={{ gap: 10 }}>
        <p style={{ margin: '0 4px 2px', fontSize: 14, fontWeight: 500, color: M.text2 }}>
          One seed a day each. Pick what to grow in this bed.
        </p>
        {SPECIES_ORDER.map(s => (
          <Card key={s} outlined padding="10px 14px" onClick={async () => {
            if (busy) return
            setBusy(true)
            await onPlant(shown.slot, s)
            setBusy(false)
          }} ariaLabel={`Plant a ${SPECIES[s].name.toLowerCase()}`}>
            <div className="flex items-center" style={{ gap: 14 }}>
              <span className="flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: 16, background: TINT.leaf, flexShrink: 0 }}>
                <Flower species={s} colour={null} size={42} />
              </span>
              <span className="flex flex-col" style={{ gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 17, fontWeight: 800 }}>{SPECIES[s].name}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: M.text2 }}>{SPECIES[s].blurb}</span>
              </span>
            </div>
          </Card>
        ))}
      </div>
    )
  } else if (p.bloomed_at) {
    const c = colourOf(p.species, p.color)
    title = `${c.name} ${SPECIES[p.species].name.toLowerCase()}`
    body = (
      <div className="flex flex-col items-center" style={{ gap: 10 }}>
        <span className="flex items-center justify-center" style={{ width: 132, height: 132, borderRadius: 28, background: TINT.leaf }}>
          <Flower species={p.species} colour={p.color} size={96} />
        </span>
        <RarityTag rarity={c.rarity} />
        <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: M.text2, textAlign: 'center' }}>
          Planted by {who(p.planted_by)}. Pick it to keep it, or to give it away.
        </p>
        <PrimaryButton full busy={busy} icon={<MeadowIcon name="basket" size={20} />} onClick={async () => {
          if (busy) return
          setBusy(true)
          await onPick(p.id)
          setBusy(false)
        }}>
          Pick it
        </PrimaryButton>
      </div>
    )
  } else {
    const need = NEED[p.species]
    const watered = wateredToday(p, today)
    const rained = rainedToday(p, today)
    const age = Math.max(0, differenceInCalendarDays(parseISO(today), parseISO(p.planted_day)))
    title = `A ${SPECIES[p.species].name.toLowerCase()}, growing`
    body = (
      <div className="flex flex-col" style={{ gap: 12 }}>
        <div className="flex items-center" style={{ gap: 14 }}>
          <span className="flex items-end justify-center" style={{ width: 72, height: 72, borderRadius: 18, background: TINT.leaf, paddingBottom: 6, boxSizing: 'border-box', flexShrink: 0 }}>
            <Plant species={p.species} stage={stageOf(p) === 'seed' ? 'sprout' : stageOf(p)} colour={null} size={52} />
          </span>
          <div className="flex flex-col" style={{ gap: 6, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: M.text2 }}>
              {Math.min(p.growth, need)} of {need} waterings
            </span>
            <Meter value={p.growth / need} label="Growth" />
            <span style={{ fontSize: 13, fontWeight: 600, color: M.text2 }}>
              Planted by {who(p.planted_by)}, {age === 0 ? 'today' : age === 1 ? 'yesterday' : `${age} days ago`}.
            </span>
          </div>
        </div>
        <Card outlined padding="12px 14px">
          <div style={{ ...TYPE.label, color: M.label, marginBottom: 8 }}>Watered today</div>
          <div className="flex flex-wrap" style={{ gap: 6 }}>
            {me && <Tag tone={watered.includes(me) ? 'leaf' : 'soft'}>{watered.includes(me) ? 'You' : 'Not you yet'}</Tag>}
            {!isSolo && partnerId && <Tag tone={watered.includes(partnerId) ? 'leaf' : 'soft'}>{watered.includes(partnerId) ? partnerName : `Not ${partnerName} yet`}</Tag>}
            {isSolo && watered.length > 0 && <Tag tone="leaf">{catName} helped</Tag>}
            {rained && <Tag tone="leaf" icon={<MeadowIcon name="cloudRain" size={16} />}>Rain</Tag>}
          </div>
        </Card>
        <p style={{ margin: '0 4px', fontSize: 13, fontWeight: 600, color: M.text2 }}>
          {p.together_days > 0
            ? `Watered together on ${p.together_days} day${p.together_days === 1 ? '' : 's'}. Every one raises the chance of a rare colour.`
            : isSolo
              ? `Every watering counts twice: you and ${catName}. Rare colours come from that.`
              : `Water it on the same day as ${partnerName}: every day you both do raises the chance of a rare colour.`}
        </p>
      </div>
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {body}
    </Sheet>
  )
}

function RarityTag({ rarity }: { rarity: 'common' | 'rare' | 'mixed' }) {
  if (rarity === 'rare') return <Tag tone="rare" caps icon={<MeadowIcon name="star" size={14} />}>Rare colour</Tag>
  if (rarity === 'mixed') return <Tag tone="epic" caps icon={<MeadowIcon name="sparkle" size={14} />}>Mixed colour</Tag>
  return <Tag tone="soft">A common colour</Tag>
}

// ── The basket and the vase ──────────────────────────────────────────────────

function BasketSheet({ open, basket, vase, me, partnerId, partnerName, isSolo, onClose, onPlace }: {
  open: boolean
  basket: GardenPlant[]
  vase: GardenPlant[]
  me: string | null
  partnerId: string | null
  partnerName: string
  isSolo: boolean
  onClose: () => void
  onPlace: (to: string) => Promise<void>
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const go = async (to: string) => {
    if (busy) return
    setBusy(to)
    await onPlace(to)
    setBusy(null)
  }
  return (
    <Sheet open={open} onClose={onClose} title="Your basket">
      <div className="flex flex-col" style={{ gap: 12 }}>
        {basket.length === 0 ? (
          <p style={{ margin: '0 4px', fontSize: 15, fontWeight: 500, color: M.text2 }}>
            Empty. Pick a flower in bloom and it lands here.
          </p>
        ) : (
          <>
            <FlowerGrid plants={basket} />
            {!isSolo && partnerId && (
              <PrimaryButton full busy={busy === partnerId} icon={<MeadowIcon name="gift" size={20} mono color="#FFFFFF" />}
                onClick={() => go(partnerId)}>
                Give to {partnerName}
              </PrimaryButton>
            )}
            {me && (
              <SecondaryButton full busy={busy === me} onClick={() => go(me)}>
                Put in my vase
              </SecondaryButton>
            )}
          </>
        )}

        <div style={{ ...TYPE.label, color: M.label, margin: '12px 4px 0' }}>Your vase this week</div>
        {vase.length === 0 ? (
          <p style={{ margin: '0 4px', fontSize: 14, fontWeight: 500, color: M.text2 }}>
            {isSolo ? 'Nothing in it yet.' : `Nothing in it yet. Flowers ${partnerName} gives you land here.`}
          </p>
        ) : (
          <FlowerGrid plants={vase} caption={p => (p.picked_by === me ? 'from you' : `from ${partnerName}`)} />
        )}
      </div>
    </Sheet>
  )
}

function FlowerGrid({ plants, caption }: { plants: GardenPlant[]; caption?: (p: GardenPlant) => string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
      {plants.map(p => {
        const c = colourOf(p.species, p.color)
        return (
          <div key={p.id} className="flex flex-col items-center" style={{ gap: 3, padding: '8px 2px 6px', borderRadius: 16, background: M.soft }}>
            <Flower species={p.species} colour={p.color} size={40} />
            <span style={{ fontSize: 11, fontWeight: 700, color: M.text2, textAlign: 'center', lineHeight: 1.2 }}>
              {c.name}{c.rarity === 'rare' ? ' ★' : ''}
            </span>
            {caption && <span style={{ fontSize: 11, fontWeight: 600, color: M.faint }}>{caption(p)}</span>}
          </div>
        )
      })}
    </div>
  )
}

// ── The flower book ──────────────────────────────────────────────────────────

function BookSheet({ open, book, onClose }: { open: boolean; book: Map<string, number>; onClose: () => void }) {
  const total = SPECIES_ORDER.reduce((n, s) => n + SPECIES[s].colours.length, 0)
  const found = SPECIES_ORDER.reduce((n, s) => n + SPECIES[s].colours.filter(c => book.has(`${s}:${c.key}`)).length, 0)
  return (
    <Sheet open={open} onClose={onClose} title="The flower book">
      <div className="flex flex-col" style={{ gap: 12 }}>
        <div className="flex items-center" style={{ gap: 10, margin: '0 4px' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: M.text2, whiteSpace: 'nowrap' }}>
            <span style={{ color: M.text, ...TYPE.number }}>{found}</span> of {total} grown
          </span>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}><Meter value={found / total} /></div>
        </div>
        {SPECIES_ORDER.map(s => (
          <Card key={s} outlined padding="12px 12px 10px">
            <div style={{ ...TYPE.label, color: M.label, margin: '0 2px 8px' }}>{SPECIES[s].plural}</div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${SPECIES[s].colours.length}, 1fr)`, gap: 6 }}>
              {SPECIES[s].colours.map(c => {
                const n = book.get(`${s}:${c.key}`) ?? 0
                return (
                  <div key={c.key} className="flex flex-col items-center" style={{
                    gap: 3, padding: '8px 1px 6px', borderRadius: 14,
                    background: n ? (c.rarity === 'rare' ? TINT.amber : c.rarity === 'mixed' ? TINT.lilac : M.soft) : M.soft,
                  }}>
                    {n ? <Flower species={s} colour={c.key} size={34} /> : <GhostFlower species={s} size={34} />}
                    <span style={{ fontSize: 11, fontWeight: 700, color: n ? M.text2 : M.faint, textAlign: 'center', lineHeight: 1.15 }}>
                      {n ? c.name : '?'}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: M.faint }}>
                      {c.rarity === 'rare' ? 'rare' : c.rarity === 'mixed' ? 'mixed' : n ? `×${n}` : ' '}
                    </span>
                  </div>
                )
              })}
            </div>
          </Card>
        ))}
        <p style={{ margin: '0 4px', fontSize: 13, fontWeight: 600, color: M.text2 }}>
          Rare colours come from watering together. Mixed colours come from two flowers of a kind blooming side by side.
        </p>
      </div>
    </Sheet>
  )
}

// "a violet tulip, 2 pink-tip daisies and a sunflower"
function phraseList(plants: GardenPlant[]): string {
  const groups = new Map<string, { p: GardenPlant; n: number }>()
  for (const p of plants) {
    const k = `${p.species}:${p.color}`
    const g = groups.get(k)
    if (g) g.n++
    else groups.set(k, { p, n: 1 })
  }
  const parts = Array.from(groups.values()).map(({ p, n }) =>
    n === 1 ? flowerPhrase(p) : `${n} ${colourOf(p.species, p.color).name.toLowerCase()} ${SPECIES[p.species].plural.toLowerCase()}`)
  return parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}
