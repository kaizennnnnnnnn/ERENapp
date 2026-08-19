// ═══════════════════════════════════════════════════════════════════════════
// THE PAYPHONE'S CALLS — who rings the kiosk, and what they leave.
// ──────────────────────────────────────────────────────────────────────────
// PLACEHOLDER TEXT. These stand in until the real recordings arrive; when
// they do, drop each file in /public/sounds/kiosk/ and set `voice` on the
// matching call. Nothing else has to change — the player prefers `voice` when
// it's there and falls back to the typed-out blips when it isn't.
//
// Calls are drawn in order and then reshuffled, so you never get the same
// message twice in a row and you hear all of them before any repeats.
// ═══════════════════════════════════════════════════════════════════════════

export interface KioskCall {
  id: string
  /** Who it says is calling, on the little caller-ID strip. */
  from: string
  /** The message. Also the subtitle once there's a recording. */
  text: string
  /** A file under /public once it's recorded — e.g. '/sounds/kiosk/mum.mp3'. */
  voice?: string
}

export const KIOSK_CALLS: KioskCall[] = [
  { id: 'supplier', from: 'SUPPLIER',
    text: 'the delivery van broke down again. you have got what you have got.' },
  { id: 'wrong-number', from: 'UNKNOWN',
    text: 'is this the laundromat? no? then who keeps calling me back.' },
  { id: 'landlord', from: 'LANDLORD',
    text: 'the rent is fine. the humming from your fridge is not.' },
  { id: 'regular', from: 'A REGULAR',
    text: 'i am outside. i am not coming in. just wanted you to know i am out here.' },
  { id: 'nightline', from: 'NO CALLER ID',
    text: 'you left the light on over the counter. i can see it from my window.' },
  { id: 'health', from: 'CITY OFFICE',
    text: 'routine inspection thursday. bring the cone up to temperature first.' },
  { id: 'eren', from: 'HOME',
    text: 'the cat knocked the phone off the table. that is the whole message.' },
]

/** How long the phone rings before the machine takes it. */
export const RING_MS = 10_000
/** One brrring-brrring per this, for as long as it rings. */
export const RING_EVERY_MS = 1_600
/** The first call of a shift. */
export const FIRST_CALL_MS = 60_000
/** And every call after that. */
export const CALL_EVERY_MS = 300_000
/** Per character of a typed-out message. */
export const TYPE_MS = 42
/** How long the finished message stays up to be read. */
export const HOLD_MS = 2_600
