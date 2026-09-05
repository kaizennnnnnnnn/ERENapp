// ─── Jump zones ─────────────────────────────────────────────────────────────
// The shaft is four rooms stacked on top of each other, not one purple tube.
//
// The single loudest complaint the climb could draw is that 100 M and 900 M
// look identical — you climb for ninety seconds and the evidence that you went
// anywhere is a number in the corner. A zone changes the wall, the light, the
// props hanging off the brackets and the parallax RATE, and you punch through a
// ceiling to get into the next one.
//
// The rate is the part that does the real work. A wall scrolls at 0.4 because
// it is an arm's length away; the night sky scrolls at 0.12 because it is not.
// Swapping colours alone reads as a palette change, swapping the rate reads as
// altitude.
//
// Everything here is CSS gradients — no PNGs, no new fetches, and the whole
// layer stays two divs and a backgroundPositionY however high he gets.

export interface JumpZone {
  /** Shouted on the banner when you break into it. */
  name: string
  base: string
  /** backgroundImage layers, outermost first. */
  wall: string[]
  wallSize: string
  wallRepeat: string
  /** Parallax rate. Falls as you climb: the sky is further away than a wall. */
  rate: number
  /** The hanging bulb's glow in this room. */
  lamp: string
  /** Edge props. Never crosses the play area — see JumpScenery. */
  prop: 'bracket' | 'hook' | 'beam' | 'lantern'
  propTone: string
  propTone2: string
  /** The slab you punch through to LEAVE this room. */
  ceiling: string
  ceilingEdge: string
}

/** Metres of climb per zone. */
export const ZONE_M = 220
/** Metres over which the next room fades up behind the current one. */
export const ZONE_FADE_M = 26

export const ZONES: JumpZone[] = [
  {
    name: 'THE STOREROOM',
    base: '#43204C',
    wall: [
      'radial-gradient(46% 26% at 16% 14%, rgba(255,206,140,0.34) 0%, rgba(255,206,140,0) 72%)',
      'radial-gradient(46% 26% at 84% 62%, rgba(255,160,200,0.26) 0%, rgba(255,160,200,0) 72%)',
      'repeating-linear-gradient(90deg, #43204C 0 26px, #573062 26px 52px)',
    ],
    wallSize: '100% 240px, 100% 240px, 52px 100%',
    wallRepeat: 'repeat-y, repeat-y, repeat',
    rate: 0.40,
    lamp: '#FFD98A',
    prop: 'bracket',
    propTone: '#B47C55',
    propTone2: '#5E3A25',
    ceiling: 'linear-gradient(180deg, #6B4030 0%, #46281E 100%)',
    ceilingEdge: '#8E5A3B',
  },
  {
    name: 'THE COLD ROOM',
    base: '#16303F',
    wall: [
      'radial-gradient(52% 22% at 50% 8%, rgba(180,236,255,0.22) 0%, rgba(180,236,255,0) 70%)',
      // Rime line along the top of each tile — the only horizontal in the room.
      'repeating-linear-gradient(0deg, rgba(214,244,255,0.14) 0 3px, rgba(214,244,255,0) 3px 240px)',
      // Frost seams between the steel panes.
      'repeating-linear-gradient(90deg, rgba(226,248,255,0.10) 0 2px, rgba(226,248,255,0) 2px 44px)',
      'repeating-linear-gradient(90deg, #16303F 0 44px, #1F3E52 44px 88px)',
    ],
    wallSize: '100% 240px, 100% 240px, 88px 100%, 88px 100%',
    wallRepeat: 'repeat-y, repeat-y, repeat, repeat',
    rate: 0.34,
    lamp: '#BFE9FF',
    prop: 'hook',
    propTone: '#93B4C4',
    propTone2: '#4E7183',
    ceiling: 'linear-gradient(180deg, #7FA6B8 0%, #436474 100%)',
    ceilingEdge: '#A8CBDA',
  },
  {
    name: 'THE SUGAR LOFT',
    base: '#4A2E18',
    wall: [
      // One raked light shaft. A loft is defined by the light coming in sideways.
      'linear-gradient(102deg, rgba(255,226,150,0.15) 0 26%, rgba(255,226,150,0) 60%)',
      'radial-gradient(38% 20% at 72% 28%, rgba(255,224,160,0.24) 0%, rgba(255,224,160,0) 72%)',
      // Sugar dust hanging in it.
      'radial-gradient(1.5px 1.5px at 30% 40%, rgba(255,240,200,0.5) 50%, rgba(255,240,200,0) 52%)',
      'repeating-linear-gradient(90deg, #4A2E18 0 34px, #5C3A20 34px 68px)',
    ],
    wallSize: '100% 240px, 100% 240px, 90px 90px, 68px 100%',
    wallRepeat: 'repeat-y, repeat-y, repeat, repeat',
    rate: 0.26,
    lamp: '#FFE1A0',
    prop: 'beam',
    propTone: '#8A6134',
    propTone2: '#523A1C',
    ceiling: 'linear-gradient(180deg, #6E5432 0%, #3F2E19 100%)',
    ceilingEdge: '#9A7440',
  },
  {
    name: 'ABOVE THE PARLOUR',
    base: '#101430',
    wall: [
      'radial-gradient(1.6px 1.6px at 18% 22%, #FFF6DC 50%, rgba(255,246,220,0) 52%)',
      'radial-gradient(1.6px 1.6px at 62% 48%, #FFE9C0 50%, rgba(255,233,192,0) 52%)',
      'radial-gradient(1.2px 1.2px at 84% 12%, #CFE4FF 50%, rgba(207,228,255,0) 52%)',
      'radial-gradient(1.2px 1.2px at 34% 74%, #FFFFFF 50%, rgba(255,255,255,0) 52%)',
      'repeating-linear-gradient(180deg, #1B2149 0 450px, #101430 450px 900px)',
    ],
    wallSize: '190px 190px, 150px 150px, 220px 220px, 170px 170px, 100% 900px',
    wallRepeat: 'repeat, repeat, repeat, repeat, repeat-y',
    // The sky barely moves. This is the whole altitude cue.
    rate: 0.12,
    lamp: '#FFEFC4',
    prop: 'lantern',
    propTone: '#E8A45C',
    propTone2: '#8A4E22',
    // Never punched through — the sky is the top of the game.
    ceiling: 'linear-gradient(180deg, #2A2F5C 0%, #171B3C 100%)',
    ceilingEdge: '#3E4680',
  },
]
