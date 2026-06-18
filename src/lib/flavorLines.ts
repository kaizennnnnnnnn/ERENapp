// ═════════════════════════════════════════════════════════════════════════════
// FLAVOR LINES — Phase 3 PR 5
//
// Ambient one-liners Eren "thinks" in a speech bubble above-left of him on
// home. Sibling to src/lib/wishes.ts but distinct: a flavor line has NO grant
// trigger, no coin reward, nothing to claim. It's pure inner monologue —
// background life that makes the room feel inhabited.
//
// Lines carry a trigger that controls when the line is eligible:
//
//   idle             ambient cycle, picked every 60–90s when nothing else is up
//   after_positive   fires 4–8s after a pet / care action lands ("best human.")
//   gap_24h          fires once on first session after 24h+ since last seen
//   needs_leader     occasional, addresses the W-L-T leader by name
//   duplicate_feed   fires 4–8s after feeding the same food key twice in a row
//   rare_intro       very rare, includes BOTH partner names ("my people.")
//
// Templates support two substitutions:
//   {leader}   — the W-L-T leader's display name (skipped if null)
//   {other}    — the non-leader partner's display name
// Lines whose substitution can't resolve are dropped silently.
// ═════════════════════════════════════════════════════════════════════════════

export type FlavorTrigger =
  | 'idle'
  | 'after_positive'
  | 'gap_24h'
  | 'needs_leader'
  | 'duplicate_feed'
  | 'rare_intro'

export interface FlavorLine {
  id: string
  text: string
  trigger: FlavorTrigger
}

export const FLAVOR_LINES: FlavorLine[] = [
  // ── idle: the ambient cycle ───────────────────────────────────────────────
  { id: 'idle-purr',     text: 'purrr… purrr…',                            trigger: 'idle' },
  { id: 'idle-watching', text: "i'm watching you. always.",                trigger: 'idle' },
  { id: 'idle-soft',     text: 'soft today. very soft.',                   trigger: 'idle' },
  { id: 'idle-blink',    text: 'i blinked slow at you. that means love.',  trigger: 'idle' },
  { id: 'idle-tail',     text: 'tail twitch. tail twitch.',                trigger: 'idle' },
  { id: 'idle-treat',    text: 'thinking about treats. as usual.',         trigger: 'idle' },

  // ── after_positive: 4–8s after a pet / care / play lands ──────────────────
  { id: 'pos-best',      text: 'best human.',                              trigger: 'after_positive' },
  { id: 'pos-more',      text: 'yes. more of that.',                       trigger: 'after_positive' },

  // ── gap_24h: first session after a 24h+ absence ───────────────────────────
  { id: 'gap-back',      text: 'you came back!',                           trigger: 'gap_24h' },
  { id: 'gap-missed',    text: "i missed you. don't tell anyone.",         trigger: 'gap_24h' },

  // ── needs_leader: occasional, leader ≠ viewer ─────────────────────────────
  { id: 'lead-fave',     text: "{leader} is my favourite. don't tell.",    trigger: 'needs_leader' },
  { id: 'lead-kisses',   text: '{leader} forgot the kisses again.',        trigger: 'needs_leader' },

  // ── duplicate_feed: fed the same food key twice in a row ──────────────────
  { id: 'dupe-again',    text: 'again? okay. okay.',                       trigger: 'duplicate_feed' },

  // ── rare_intro: very rare, both names ─────────────────────────────────────
  { id: 'intro-people',  text: '{leader} and {other}. my people.',         trigger: 'rare_intro' },

  // ── More ambient idle lines (added later) ─────────────────────────────────
  { id: 'idle-missyou',   text: 'i missed you.',                                              trigger: 'idle' },
  { id: 'idle-sardine',   text: 'you can have some of my sardines.',                          trigger: 'idle' },
  { id: 'idle-sugarfree', text: "Jovan said all my food here is sugar-free. cause i can't eat it.", trigger: 'idle' },
  { id: 'idle-loveyou',   text: 'i love you.',                                                trigger: 'idle' },
  { id: 'idle-talk',      text: 'do you think they know i can talk… i mean, meow meow.',      trigger: 'idle' },
  { id: 'idle-toilet',    text: 'i might jump into the toilet today.',                        trigger: 'idle' },
  { id: 'idle-serbian',   text: 'Jovan said my Serbian is great.',                            trigger: 'idle' },
  { id: 'idle-happi',     text: 'you seem happi.',                                            trigger: 'idle' },

  // ── More leader-addressed lines (added later) ─────────────────────────────
  { id: 'lead-loves',     text: 'i think {leader} really loves you.',                         trigger: 'needs_leader' },
  { id: 'lead-secretfed', text: '{leader} already fed me. but no one needs to know that.',    trigger: 'needs_leader' },

  // ── More rare lines (added later) ─────────────────────────────────────────
  { id: 'intro-names',    text: 'my name is Eren, but people also call me Oi, Meow, and Tony.', trigger: 'rare_intro' },
]
