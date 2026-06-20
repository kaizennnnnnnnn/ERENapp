// ═══════════════════════════════════════════════════════════════════════════
// SOUND HELPER — playback layer for every sound effect in the app.
//
// Two backends, both Web Audio:
//   1. Decoded mp3 samples — shipped UI, progression, care, and gacha sounds.
//      Files live in /public/sounds/<bucket>/<name>.mp3; we fetch + decode each
//      to an AudioBuffer ONCE and play overlapping buffer-source nodes. This
//      replaced HTMLAudioElement.cloneNode() playback, which made Chrome re-hit
//      its media cache on every play and spam `ERR_CACHE_OPERATION_NOT_SUPPORTED`
//      (most visibly on rapid room swipes firing ui_swipe_room). A
//      cloneNode-based path is kept only as a fallback for browsers with no
//      AudioContext at all.
//   2. Web Audio synthesis — the 11 mini-games' gameplay SFX. Each game-key has
//      a chiptune recipe in soundRecipes.ts. We synthesise live instead of
//      shipping mp3s so every game has its own UNIQUE sound by construction
//      (different waveform/freq family per game), and so we never accidentally
//      route a game miss-cue to the Eren-eats fallback when an mp3 is missing.
//
// playSound() checks SYNTH_RECIPES first; if a recipe exists it synthesises.
// Otherwise it plays the decoded mp3 sample (FALLBACK chain on a missing file).
//
// Volume + mute can be controlled per-call or globally via setVolume / setMuted.
// State is in-memory only — wire it to localStorage if you want it to persist.
// ═══════════════════════════════════════════════════════════════════════════

import { playSynth, playBuffer, startLoopBuffer, getAudioContext } from './soundSynth'
import { SYNTH_RECIPES } from './soundRecipes'

export const SOUNDS = {
  // UI / navigation — each entry is a distinct semantic moment, so a
  // button tap doesn't have to share audio with opening a sheet.
  //
  //  - ui_tap        : single tiny chiptune blip for any small button
  //  - ui_back       : descending blip pair for back / dismiss
  //  - ui_toggle     : soft pixel "tick" for on/off switches
  //  - ui_select     : chunkier pickup-style blip for list selections
  //  - ui_modal_open : ascending blip pair for sheets / detail panels
  //  - ui_modal_close: descending blip pair for closing sheets
  //  - ui_swipe_room : page-transition whoosh (user keeps this one)
  ui_tap:               '/sounds/ui/ui_tap.mp3',
  ui_back:              '/sounds/ui/ui_back.mp3',
  ui_toggle:            '/sounds/ui/ui_toggle.mp3',
  ui_select:            '/sounds/ui/ui_select.mp3',
  ui_modal_open:        '/sounds/ui/ui_modal_open.mp3',
  ui_modal_close:       '/sounds/ui/ui_modal_close.mp3',
  ui_swipe_room:        '/sounds/ui/ui_swipe_room.mp3',
  ui_loading:           '/sounds/ui/ui_loading.mp3',
  ui_notification_ping: '/sounds/ui/ui_notification_ping.mp3',

  // Progression — fired by TaskContext / battle modules via window events.
  quest_complete:       '/sounds/progression/quest_complete.mp3',
  level_up:             '/sounds/progression/level_up.mp3',
  coin_pickup:          '/sounds/progression/coin_pickup.mp3',
  gift_open:            '/sounds/progression/gift_open.mp3',

  // Care actions — fired by individual care scenes when Eren acts.
  care_eat:             '/sounds/care/care_eat.mp3',
  // Pet — tap-on-Eren purr sound. Placeholder file path; if missing, the
  // FALLBACK below routes to care_eat so taps still play SOMETHING.
  pet_purr:             '/sounds/care/pet_purr.mp3',
  // Reaction-system care SFX (Phase 0). Files are user-provided; until they
  // land the FALLBACK map routes each to a shipped close-cousin so the
  // reactions are never silent.
  care_splash:          '/sounds/care/care_splash.mp3',
  care_gulp:            '/sounds/care/care_gulp.mp3',
  care_happy:           '/sounds/care/care_happy.mp3',
  care_sleep:           '/sounds/care/care_sleep.mp3',
  care_jingle:          '/sounds/care/care_jingle.mp3',
  // Soap rub + shower hiss — recorded mp3s, played as a LOOP while soaping /
  // rinsing (see playLoop). NOT synthesised: a synth recipe of the same name
  // would shadow these files in playSound.
  care_soap:            '/sounds/care/care_soap.mp3',
  care_rinse:           '/sounds/care/care_rinse.mp3',

  // Gacha — rarity-tiered reveal stingers.
  gacha_reveal_common:    '/sounds/gacha/gacha_reveal_common.mp3',
  gacha_reveal_rare:      '/sounds/gacha/gacha_reveal_rare.mp3',
  gacha_reveal_epic:      '/sounds/gacha/gacha_reveal_epic.mp3',
  gacha_reveal_legendary: '/sounds/gacha/gacha_reveal_legendary.mp3',

  // ─── Mini-game gameplay SFX ─────────────────────────────────────────────
  // Per-game keys for the 11 mini-games. Each routes to a per-game folder
  // under /public/sounds/games/<game-id>/. Until the mp3s are generated,
  // the FALLBACK map below routes each key to a shipped close-cousin so
  // gameplay never plays silence.

  // catch-mouse
  cm_catch:        '/sounds/games/catch-mouse/cm_catch.mp3',
  cm_miss:         '/sounds/games/catch-mouse/cm_miss.mp3',
  cm_combo:        '/sounds/games/catch-mouse/cm_combo.mp3',
  cm_time_warning: '/sounds/games/catch-mouse/cm_time_warning.mp3',
  cm_tick:         '/sounds/games/catch-mouse/cm_tick.mp3',
  cm_gameover:     '/sounds/games/catch-mouse/cm_gameover.mp3',

  // paw-tap
  pt_catch_good:      '/sounds/games/paw-tap/pt_catch_good.mp3',
  pt_catch_bonus:     '/sounds/games/paw-tap/pt_catch_bonus.mp3',
  pt_danger_hit:      '/sounds/games/paw-tap/pt_danger_hit.mp3',
  pt_combo_milestone: '/sounds/games/paw-tap/pt_combo_milestone.mp3',
  pt_fish_escape:     '/sounds/games/paw-tap/pt_fish_escape.mp3',
  pt_game_over:       '/sounds/games/paw-tap/pt_game_over.mp3',

  // memory-match
  mm_card_flip:  '/sounds/games/memory-match/mm_card_flip.mp3',
  mm_match:      '/sounds/games/memory-match/mm_match.mp3',
  mm_combo:      '/sounds/games/memory-match/mm_combo.mp3',
  mm_miss:       '/sounds/games/memory-match/mm_miss.mp3',
  mm_purrfect:   '/sounds/games/memory-match/mm_purrfect.mp3',
  mm_timer_warn: '/sounds/games/memory-match/mm_timer_warn.mp3',

  // treat-tumble
  tt_catch_good:   '/sounds/games/treat-tumble/tt_catch_good.mp3',
  tt_catch_golden: '/sounds/games/treat-tumble/tt_catch_golden.mp3',
  tt_catch_heart:  '/sounds/games/treat-tumble/tt_catch_heart.mp3',
  tt_hit_danger:   '/sounds/games/treat-tumble/tt_hit_danger.mp3',
  tt_combo_up:     '/sounds/games/treat-tumble/tt_combo_up.mp3',
  tt_round_end:    '/sounds/games/treat-tumble/tt_round_end.mp3',

  // flappy-eren
  fe_flap:         '/sounds/games/flappy-eren/fe_flap.mp3',
  fe_pipe_pass:    '/sounds/games/flappy-eren/fe_pipe_pass.mp3',
  fe_crash:        '/sounds/games/flappy-eren/fe_crash.mp3',
  fe_theme_shift:  '/sounds/games/flappy-eren/fe_theme_shift.mp3',
  fe_milestone_10: '/sounds/games/flappy-eren/fe_milestone_10.mp3',
  fe_new_best:     '/sounds/games/flappy-eren/fe_new_best.mp3',

  // tic-tac-toe
  ttt_place_x:   '/sounds/games/tic-tac-toe/ttt_place_x.mp3',
  ttt_place_o:   '/sounds/games/tic-tac-toe/ttt_place_o.mp3',
  ttt_win_line:  '/sounds/games/tic-tac-toe/ttt_win_line.mp3',
  ttt_lose:      '/sounds/games/tic-tac-toe/ttt_lose.mp3',
  ttt_draw:      '/sounds/games/tic-tac-toe/ttt_draw.mp3',
  ttt_can_spill: '/sounds/games/tic-tac-toe/ttt_can_spill.mp3',

  // eren-stack
  es_place:             '/sounds/games/eren-stack/es_place.mp3',
  es_perfect:           '/sounds/games/eren-stack/es_perfect.mp3',
  es_perfect_streak:    '/sounds/games/eren-stack/es_perfect_streak.mp3',
  es_trim:              '/sounds/games/eren-stack/es_trim.mp3',
  es_miss:              '/sounds/games/eren-stack/es_miss.mp3',
  es_sky_change:        '/sounds/games/eren-stack/es_sky_change.mp3',
  es_height_milestone:  '/sounds/games/eren-stack/es_height_milestone.mp3',

  // yarn-pop
  yp_swap:      '/sounds/games/yarn-pop/yp_swap.mp3',
  yp_match_pop: '/sounds/games/yarn-pop/yp_match_pop.mp3',
  yp_big_combo: '/sounds/games/yarn-pop/yp_big_combo.mp3',
  yp_no_match:  '/sounds/games/yarn-pop/yp_no_match.mp3',
  yp_low_moves: '/sounds/games/yarn-pop/yp_low_moves.mp3',
  yp_gameover:  '/sounds/games/yarn-pop/yp_gameover.mp3',

  // eren-says
  ey_pad_press:        '/sounds/games/eren-says/ey_pad_press.mp3',
  ey_sequence_show:    '/sounds/games/eren-says/ey_sequence_show.mp3',
  ey_round_clear:      '/sounds/games/eren-says/ey_round_clear.mp3',
  ey_miss:             '/sounds/games/eren-says/ey_miss.mp3',
  ey_streak_milestone: '/sounds/games/eren-says/ey_streak_milestone.mp3',
  ey_gameover:         '/sounds/games/eren-says/ey_gameover.mp3',

  // lane-runner
  lr_lane_swipe:  '/sounds/games/lane-runner/lr_lane_swipe.mp3',
  lr_coin_pickup: '/sounds/games/lane-runner/lr_coin_pickup.mp3',
  lr_fish_pickup: '/sounds/games/lane-runner/lr_fish_pickup.mp3',
  lr_crash:       '/sounds/games/lane-runner/lr_crash.mp3',
  lr_near_miss:   '/sounds/games/lane-runner/lr_near_miss.mp3',
  lr_speed_up:    '/sounds/games/lane-runner/lr_speed_up.mp3',
  lr_new_best:    '/sounds/games/lane-runner/lr_new_best.mp3',

  // paw-doku
  pd_place:      '/sounds/games/paw-doku/pd_place.mp3',
  pd_invalid:    '/sounds/games/paw-doku/pd_invalid.mp3',
  pd_line_clear: '/sounds/games/paw-doku/pd_line_clear.mp3',
  pd_combo:      '/sounds/games/paw-doku/pd_combo.mp3',
  pd_streak:     '/sounds/games/paw-doku/pd_streak.mp3',
  pd_pickup:     '/sounds/games/paw-doku/pd_pickup.mp3',
  pd_gameover:   '/sounds/games/paw-doku/pd_gameover.mp3',

  // yarn-sort
  ys_pick:     '/sounds/games/yarn-sort/ys_pick.mp3',
  ys_pour:     '/sounds/games/yarn-sort/ys_pour.mp3',
  ys_invalid:  '/sounds/games/yarn-sort/ys_invalid.mp3',
  ys_solve:    '/sounds/games/yarn-sort/ys_solve.mp3',
  ys_undo:     '/sounds/games/yarn-sort/ys_undo.mp3',
  ys_low:      '/sounds/games/yarn-sort/ys_low.mp3',
  ys_gameover: '/sounds/games/yarn-sort/ys_gameover.mp3',

  // gone-fishin
  gf_cast:     '/sounds/games/gone-fishin/gf_cast.mp3',
  gf_bite:     '/sounds/games/gone-fishin/gf_bite.mp3',
  gf_hook:     '/sounds/games/gone-fishin/gf_hook.mp3',
  gf_land:     '/sounds/games/gone-fishin/gf_land.mp3',
  gf_big:      '/sounds/games/gone-fishin/gf_big.mp3',
  gf_escape:   '/sounds/games/gone-fishin/gf_escape.mp3',
  gf_gameover: '/sounds/games/gone-fishin/gf_gameover.mp3',

  // defend-bowl
  db_place:    '/sounds/games/defend-bowl/db_place.mp3',
  db_upgrade:  '/sounds/games/defend-bowl/db_upgrade.mp3',
  db_pop:      '/sounds/games/defend-bowl/db_pop.mp3',
  db_leak:     '/sounds/games/defend-bowl/db_leak.mp3',
  db_wave:     '/sounds/games/defend-bowl/db_wave.mp3',
  db_gameover: '/sounds/games/defend-bowl/db_gameover.mp3',

  // purr-beat
  pr_kick:     '/sounds/games/purr-beat/pr_kick.mp3',
  pr_n1:       '/sounds/games/purr-beat/pr_n1.mp3',
  pr_n2:       '/sounds/games/purr-beat/pr_n2.mp3',
  pr_n3:       '/sounds/games/purr-beat/pr_n3.mp3',
  pr_n4:       '/sounds/games/purr-beat/pr_n4.mp3',
  pr_perfect:  '/sounds/games/purr-beat/pr_perfect.mp3',
  pr_miss:     '/sounds/games/purr-beat/pr_miss.mp3',
  pr_gameover: '/sounds/games/purr-beat/pr_gameover.mp3',
} as const

export type SoundName = keyof typeof SOUNDS

// Per-sound volume scaler in [0, 1]. Quiets the high-frequency UI clicks
// so they don't clip over background music; leaves payoff sounds
// (level_up, gacha reveals) at full volume for impact.
const VOLUME_SCALE: Partial<Record<SoundName, number>> = {
  ui_tap:         0.45,
  ui_back:        0.45,
  ui_toggle:      0.45,
  ui_select:      0.5,
  ui_modal_open:  0.5,
  ui_modal_close: 0.5,
  coin_pickup:    0.7,
  quest_complete: 0.7,
  level_up:       0.8,
  gift_open:      0.85,
  pet_purr:       0.6,
  // Looping water sounds — kept gentle so they sit under the SFX while
  // dragging the soap / shower rather than dominating the scene.
  care_soap:      0.6,
  care_rinse:     0.6,

  // ─── Mini-game gameplay SFX ─────────────────────────────────────────────
  // catch-mouse
  cm_catch:           0.7,
  cm_miss:            0.45,
  cm_combo:           0.75,
  cm_time_warning:    0.6,
  cm_tick:            0.55,
  cm_gameover:        0.8,

  // paw-tap
  pt_catch_good:      0.55,
  pt_catch_bonus:     0.75,
  pt_danger_hit:      0.8,
  pt_combo_milestone: 0.7,
  pt_fish_escape:     0.4,
  pt_game_over:       0.75,

  // memory-match
  mm_card_flip:       0.55,
  mm_match:           0.7,
  mm_combo:           0.8,
  mm_miss:            0.5,
  mm_purrfect:        0.85,
  mm_timer_warn:      0.6,

  // treat-tumble
  tt_catch_good:      0.6,
  tt_catch_golden:    0.75,
  tt_catch_heart:     0.7,
  tt_hit_danger:      0.8,
  tt_combo_up:        0.65,
  tt_round_end:       0.75,

  // flappy-eren
  fe_flap:            0.55,
  fe_pipe_pass:       0.7,
  fe_crash:           0.8,
  fe_theme_shift:     0.6,
  fe_milestone_10:    0.75,
  fe_new_best:        0.85,

  // tic-tac-toe
  ttt_place_x:        0.6,
  ttt_place_o:        0.55,
  ttt_win_line:       0.8,
  ttt_lose:           0.6,
  ttt_draw:           0.5,
  ttt_can_spill:      0.75,

  // eren-stack
  es_place:           0.6,
  es_perfect:         0.75,
  es_perfect_streak:  0.8,
  es_trim:            0.5,
  es_miss:            0.8,
  es_sky_change:      0.45,
  es_height_milestone:0.7,

  // yarn-pop
  yp_swap:            0.55,
  yp_match_pop:       0.7,
  yp_big_combo:       0.8,
  yp_no_match:        0.5,
  yp_low_moves:       0.6,
  yp_gameover:        0.75,

  // eren-says
  ey_pad_press:       0.6,
  ey_sequence_show:   0.55,
  ey_round_clear:     0.75,
  ey_miss:            0.8,
  ey_streak_milestone:0.8,
  ey_gameover:        0.65,

  // lane-runner
  lr_lane_swipe:      0.45,
  lr_coin_pickup:     0.6,
  lr_fish_pickup:     0.7,
  lr_crash:           0.8,
  lr_near_miss:       0.5,
  lr_speed_up:        0.55,
  lr_new_best:        0.75,

  // paw-doku
  pd_place:           0.55,
  pd_invalid:         0.5,
  pd_line_clear:      0.7,
  pd_combo:           0.8,
  pd_streak:          0.75,
  pd_pickup:          0.45,
  pd_gameover:        0.75,

  // yarn-sort
  ys_pick:            0.5,
  ys_pour:            0.6,
  ys_invalid:         0.5,
  ys_solve:           0.8,
  ys_undo:            0.45,
  ys_low:             0.6,
  ys_gameover:        0.75,

  // gone-fishin
  gf_cast:            0.5,
  gf_bite:            0.6,
  gf_hook:            0.7,
  gf_land:            0.8,
  gf_big:             0.85,
  gf_escape:          0.55,
  gf_gameover:        0.75,

  // defend-bowl
  db_place:           0.55,
  db_upgrade:         0.65,
  db_pop:             0.4,
  db_leak:            0.7,
  db_wave:            0.7,
  db_gameover:        0.75,

  // purr-beat
  pr_kick:            0.4,
  pr_n1:              0.55,
  pr_n2:              0.55,
  pr_n3:              0.55,
  pr_n4:              0.55,
  pr_perfect:         0.6,
  pr_miss:            0.5,
  pr_gameover:        0.7,
}

// Fallbacks let new sound names ship safely before the audio files land
// — if /sounds/.../foo.mp3 returns 404, fall back to a close-cousin file
// the user has already generated. Mapping is keyed by SoundName.
const FALLBACK: Partial<Record<SoundName, SoundName>> = {
  ui_tap:                 'ui_modal_open',
  ui_back:                'ui_modal_close',
  ui_toggle:              'ui_modal_open',
  ui_select:              'ui_modal_open',
  quest_complete:         'ui_notification_ping',
  level_up:               'ui_notification_ping',
  coin_pickup:            'ui_notification_ping',
  gift_open:              'level_up',
  pet_purr:               'care_eat',
  care_splash:            'care_eat',
  care_gulp:              'care_eat',
  care_happy:             'coin_pickup',
  care_sleep:             'ui_notification_ping',
  care_jingle:            'ui_select',
  gacha_reveal_common:    'ui_modal_open',
  gacha_reveal_rare:      'ui_notification_ping',
  gacha_reveal_epic:      'ui_notification_ping',
  gacha_reveal_legendary: 'ui_notification_ping',

  // ─── Mini-game gameplay SFX ─────────────────────────────────────────────
  // catch-mouse
  cm_catch:           'care_eat' as SoundName,
  cm_miss:            'pet_purr' as SoundName,
  cm_combo:           'gacha_reveal_rare' as SoundName,
  cm_time_warning:    'ui_notification_ping' as SoundName,
  cm_tick:            'gacha_reveal_common' as SoundName,
  cm_gameover:        'quest_complete' as SoundName,

  // paw-tap
  pt_catch_good:      'care_eat' as SoundName,
  pt_catch_bonus:     'gacha_reveal_rare' as SoundName,
  pt_danger_hit:      'ui_notification_ping' as SoundName,
  pt_combo_milestone: 'level_up' as SoundName,
  pt_fish_escape:     'pet_purr' as SoundName,
  pt_game_over:       'quest_complete' as SoundName,

  // memory-match
  mm_card_flip:       'ui_notification_ping' as SoundName,
  mm_match:           'gacha_reveal_common' as SoundName,
  mm_combo:           'gacha_reveal_rare' as SoundName,
  mm_miss:            'pet_purr' as SoundName,
  mm_purrfect:        'quest_complete' as SoundName,
  mm_timer_warn:      'gift_open' as SoundName,

  // treat-tumble
  tt_catch_good:      'care_eat' as SoundName,
  tt_catch_golden:    'gacha_reveal_epic' as SoundName,
  tt_catch_heart:     'pet_purr' as SoundName,
  tt_hit_danger:      'ui_notification_ping' as SoundName,
  tt_combo_up:        'level_up' as SoundName,
  tt_round_end:       'quest_complete' as SoundName,

  // flappy-eren
  fe_flap:            'care_eat' as SoundName,
  fe_pipe_pass:       'gacha_reveal_common' as SoundName,
  fe_crash:           'gift_open' as SoundName,
  fe_theme_shift:     'level_up' as SoundName,
  fe_milestone_10:    'quest_complete' as SoundName,
  fe_new_best:        'gacha_reveal_legendary' as SoundName,

  // tic-tac-toe
  ttt_place_x:        'care_eat' as SoundName,
  ttt_place_o:        'pet_purr' as SoundName,
  ttt_win_line:       'quest_complete' as SoundName,
  ttt_lose:           'gacha_reveal_common' as SoundName,
  ttt_draw:           'ui_notification_ping' as SoundName,
  ttt_can_spill:      'gift_open' as SoundName,

  // eren-stack
  es_place:             'care_eat' as SoundName,
  es_perfect:           'gacha_reveal_rare' as SoundName,
  es_perfect_streak:    'gacha_reveal_epic' as SoundName,
  es_trim:              'gift_open' as SoundName,
  es_miss:              'gacha_reveal_legendary' as SoundName,
  es_sky_change:        'pet_purr' as SoundName,
  es_height_milestone:  'level_up' as SoundName,

  // yarn-pop
  yp_swap:            'care_eat' as SoundName,
  yp_match_pop:       'gacha_reveal_common' as SoundName,
  yp_big_combo:       'gacha_reveal_epic' as SoundName,
  yp_no_match:        'ui_notification_ping' as SoundName,
  yp_low_moves:       'ui_notification_ping' as SoundName,
  yp_gameover:        'quest_complete' as SoundName,

  // eren-says
  ey_pad_press:        'ui_notification_ping' as SoundName,
  ey_sequence_show:    'gacha_reveal_common' as SoundName,
  ey_round_clear:      'quest_complete' as SoundName,
  ey_miss:             'care_eat' as SoundName,
  ey_streak_milestone: 'level_up' as SoundName,
  ey_gameover:         'gift_open' as SoundName,

  // lane-runner
  lr_lane_swipe:      'pet_purr' as SoundName,
  lr_coin_pickup:     'gacha_reveal_common' as SoundName,
  lr_fish_pickup:     'gacha_reveal_rare' as SoundName,
  lr_crash:           'gift_open' as SoundName,
  lr_near_miss:       'ui_notification_ping' as SoundName,
  lr_speed_up:        'level_up' as SoundName,
  lr_new_best:        'quest_complete' as SoundName,

  // paw-doku
  pd_place:      'care_eat' as SoundName,
  pd_invalid:    'ui_notification_ping' as SoundName,
  pd_line_clear: 'gacha_reveal_rare' as SoundName,
  pd_combo:      'gacha_reveal_epic' as SoundName,
  pd_streak:     'level_up' as SoundName,
  pd_pickup:     'pet_purr' as SoundName,
  pd_gameover:   'quest_complete' as SoundName,
}

const cache = new Map<SoundName, HTMLAudioElement>()
// Tracks names whose file is known to 404 — once we see a fail, route to
// the fallback for the rest of the session so the network tab stops
// spamming retries.
const knownMissing = new Set<SoundName>()
let globalVolume = 0.55
let muted = false

// ─── Web Audio sample cache (primary mp3 backend) ───────────────────────────
// Each mp3 is fetched + decoded to an AudioBuffer exactly once, then played via
// AudioBufferSourceNodes (see playBuffer). Fetching is a normal HTTP request —
// it does NOT trip the media-element cache error that cloneNode() playback did.
const bufferCache = new Map<SoundName, AudioBuffer>()
const bufferLoads = new Map<SoundName, Promise<AudioBuffer | null>>()

function loadBuffer(name: SoundName): Promise<AudioBuffer | null> {
  const ctx = getAudioContext()
  if (!ctx) return Promise.resolve(null)
  const cached = bufferCache.get(name)
  if (cached) return Promise.resolve(cached)
  const inFlight = bufferLoads.get(name)
  if (inFlight) return inFlight

  const load = (async (): Promise<AudioBuffer | null> => {
    try {
      const res = await fetch(SOUNDS[name])
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = await ctx.decodeAudioData(await res.arrayBuffer())
      bufferCache.set(name, buf)
      return buf
    } catch {
      // File missing/undecodable — remember it so we never refetch, and route
      // to a close-cousin sound so the moment still plays SOMETHING.
      knownMissing.add(name)
      const fb = FALLBACK[name]
      if (fb && fb !== name && !knownMissing.has(fb)) return loadBuffer(fb)
      return null
    } finally {
      bufferLoads.delete(name)
    }
  })()
  bufferLoads.set(name, load)
  return load
}

function resolveName(name: SoundName): SoundName {
  if (!knownMissing.has(name)) return name
  const fb = FALLBACK[name]
  return fb && !knownMissing.has(fb) ? fb : name
}

function getBase(name: SoundName): HTMLAudioElement {
  let base = cache.get(name)
  if (!base) {
    base = new Audio(SOUNDS[name])
    base.preload = 'auto'
    // First load failure marks the name missing so future calls go
    // straight to the fallback. We re-create the cached element using
    // the fallback path so subsequent plays don't hit the same 404.
    base.addEventListener('error', () => {
      knownMissing.add(name)
      const fb = FALLBACK[name]
      if (fb) {
        const fbBase = new Audio(SOUNDS[fb])
        fbBase.preload = 'auto'
        cache.set(name, fbBase)
      }
    }, { once: true })
    cache.set(name, base)
  }
  return base
}

export function playSound(name: SoundName, opts: { volume?: number } = {}) {
  if (muted) return
  if (typeof window === 'undefined') return

  const scale = VOLUME_SCALE[name] ?? 1
  const finalVolume = Math.max(0, Math.min(1, (opts.volume ?? globalVolume) * scale))

  // Synthesised game SFX win over the mp3 path — guarantees a unique chiptune
  // tone per game key and prevents the FALLBACK chain (care_eat, pet_purr,
  // etc.) from ever firing for missing game mp3s.
  const recipe = SYNTH_RECIPES[name]
  if (recipe) {
    playSynth(recipe, finalVolume)
    return
  }

  // Primary mp3 backend: play the decoded sample through Web Audio. If it's not
  // decoded yet (first play of this sound), kick off the decode and play once
  // it resolves; every later play of that sound is instant from the buffer.
  const ctx = getAudioContext()
  if (ctx) {
    const buf = bufferCache.get(name)
    if (buf) { playBuffer(buf, finalVolume); return }
    void loadBuffer(name).then(b => { if (b) playBuffer(b, finalVolume) })
    return
  }

  // Legacy fallback (no Web Audio at all): the original HTMLAudioElement clone
  // path. This is the one that can log ERR_CACHE_OPERATION_NOT_SUPPORTED, but
  // it only runs when AudioContext is entirely unavailable.
  try {
    const effective = resolveName(name)
    const base = getBase(effective)
    const a = base.cloneNode(true) as HTMLAudioElement
    a.volume = finalVolume
    a.play().catch(() => { /* autoplay rejected — ignore */ })
  } catch {
    /* ignore */
  }
}

/** Start a sound looping and return a stop() function. For continuous,
 *  drag-driven audio (soaping / rinsing) where a multi-second clip would
 *  otherwise stack overlapping copies if re-triggered per pointermove. The
 *  loop starts as soon as the buffer is decoded (instantly if cached) and
 *  stops with a short fade. Synth-recipe names and missing Web Audio both
 *  return a no-op stop — callers can always call the result safely. */
export function playLoop(name: SoundName, opts: { volume?: number } = {}): () => void {
  if (muted || typeof window === 'undefined') return () => {}
  const ctx = getAudioContext()
  if (!ctx) return () => {}

  const scale = VOLUME_SCALE[name] ?? 1
  const finalVolume = Math.max(0, Math.min(1, (opts.volume ?? globalVolume) * scale))

  let stopFn: (() => void) | null = null
  let cancelled = false
  const begin = (buf: AudioBuffer) => { if (!cancelled) stopFn = startLoopBuffer(buf, finalVolume) }

  const cached = bufferCache.get(name)
  if (cached) begin(cached)
  else void loadBuffer(name).then(b => { if (b) begin(b) })

  return () => {
    cancelled = true
    if (stopFn) stopFn()
  }
}

export function setVolume(v: number) {
  globalVolume = Math.max(0, Math.min(1, v))
}

export function setMuted(m: boolean) { muted = m }
export function isMuted() { return muted }

/** Preload every mp3-backed sound so the first play has zero latency. Game
 *  SFX backed by synth recipes are skipped — they don't have files to fetch.
 *  With Web Audio we fetch + decode each into a buffer; without it we fall back
 *  to warming an HTMLAudioElement. Call once on app boot. */
export function preloadSounds() {
  if (typeof window === 'undefined') return
  const ctx = getAudioContext()
  for (const name of Object.keys(SOUNDS) as SoundName[]) {
    if (SYNTH_RECIPES[name]) continue
    if (ctx) void loadBuffer(name)
    else getBase(name)
  }
}
