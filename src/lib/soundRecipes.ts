// ═════════════════════════════════════════════════════════════════════════════
// SYNTH RECIPES — chiptune SFX for every mini-game.
//
// Each entry is a small data-only description of an 8-bit-style sound; the
// synth engine in soundSynth.ts turns it into actual audio at play-time. The
// goal is that every game has a recognisable AUDIO PERSONALITY of its own —
// no two games share a waveform/freq family, so the player can tell them
// apart with their eyes closed.
//
// Per-game palette:
//
//   catch-mouse   → high triangle squeaks                       (mouse-y)
//   paw-tap       → low sine plinks + bubbles                    (water-y)
//   memory-match  → triangle chimes + paper-noise flips          (cardstock-y)
//   treat-tumble  → mid square pops, golden chord, danger noise  (candy-y)
//   flappy-eren   → square sweeps + crash noise                  (bird-y)
//   tic-tac-toe   → X = high square, O = mid triangle            (player-distinct)
//   eren-stack    → sawtooth thuds + bright perfect chime        (block-y)
//   yarn-pop      → square pops + sine swipes                    (yarn-y)
//   eren-says     → 4 pure sine tones (Simon-style)              (memory-y)
//   lane-runner   → highpassed noise whooshes + coin pings       (speed-y)
//   paw-doku      → clean sine clicks + clear chimes             (zen-y)
//
// Frequency ranges roughly:
//   cm  900-1600  triangle (cute, very high)
//   pt  280-720   sine (deep, water)
//   mm  500-1100  triangle (warm, mid)
//   tt  400-900   square (poppy)
//   fe  220-700   square + noise (gritty)
//   ttt X 1000-1400 / O 500-700 (distinct halves)
//   es  120-260 thud, 800-1600 chime (two-layer)
//   yp  600-1200  square (pops)
//   ey  400-800   sine pads
//   lr  noise + 1200-2000 ping (sharp)
//   pd  900-1400  sine (clean)
// ═════════════════════════════════════════════════════════════════════════════

import type { SoundName } from './sounds'
import type { SynthRecipe } from './soundSynth'

export const SYNTH_RECIPES: Partial<Record<SoundName, SynthRecipe>> = {

  // ─── catch-mouse — high triangle squeaks ────────────────────────────────
  cm_catch:        { type: 'sweep', freq: [900, 1500], duration: 90,  shape: 'triangle', gain: 0.9, curve: 'exponential' },
  cm_miss:         { type: 'sweep', freq: [420, 210], duration: 180, shape: 'sawtooth', gain: 0.55 },
  cm_combo:        { type: 'arp',   notes: [880, 1108, 1318, 1568], step: 55, noteDur: 70, shape: 'triangle', gain: 0.9 },
  cm_time_warning: { type: 'pulse', freq: 1320, pulses: 2, step: 110, pulseDur: 70, shape: 'square', gain: 0.7 },
  cm_tick:         { type: 'blip',  freq: 660, duration: 35, shape: 'triangle', gain: 0.45 },
  cm_gameover:     { type: 'arp',   notes: [988, 740, 587, 440], step: 110, noteDur: 140, shape: 'triangle', gain: 0.8 },

  // ─── paw-tap — deep sine plinks (water) ─────────────────────────────────
  pt_catch_good:      { type: 'sweep', freq: [560, 720], duration: 100, shape: 'sine', gain: 0.85 },
  pt_catch_bonus:     { type: 'arp',   notes: [660, 880, 1175], step: 60, noteDur: 95, shape: 'sine', gain: 0.85 },
  pt_danger_hit:      { type: 'crash', noise: { duration: 180, gain: 0.55, lowpass: 900 }, tone: { freq: 130, duration: 200, shape: 'sawtooth', gain: 0.7 } },
  pt_combo_milestone: { type: 'arp',   notes: [523, 659, 784, 1047], step: 70, noteDur: 110, shape: 'sine', gain: 0.85 },
  pt_fish_escape:     { type: 'sweep', freq: [520, 220], duration: 220, shape: 'sine', gain: 0.5, curve: 'exponential' },
  pt_game_over:       { type: 'arp',   notes: [659, 494, 392, 294], step: 130, noteDur: 160, shape: 'sine', gain: 0.7 },

  // ─── memory-match — triangle chimes + paper flips ──────────────────────
  mm_card_flip:  { type: 'noise', duration: 55, gain: 0.4, highpass: 2000 },
  mm_match:      { type: 'arp',   notes: [784, 1047], step: 70, noteDur: 110, shape: 'triangle', gain: 0.85 },
  mm_combo:      { type: 'arp',   notes: [784, 988, 1175, 1397], step: 50, noteDur: 90, shape: 'triangle', gain: 0.9 },
  mm_miss:       { type: 'sweep', freq: [523, 330], duration: 220, shape: 'triangle', gain: 0.55 },
  mm_purrfect:   { type: 'seq',   parts: [
                     { at: 0,   recipe: { type: 'arp', notes: [659, 784, 988, 1175, 1568], step: 65, noteDur: 130, shape: 'triangle', gain: 0.85 } },
                     { at: 200, recipe: { type: 'chord', freqs: [988, 1318, 1568], duration: 300, shape: 'triangle', gain: 0.55 } },
                   ] },
  mm_timer_warn: { type: 'pulse', freq: 880, pulses: 3, step: 90, pulseDur: 50, shape: 'triangle', gain: 0.6 },

  // ─── treat-tumble — popcorn square pops ─────────────────────────────────
  tt_catch_good:   { type: 'blip',  freq: 660, duration: 70, shape: 'square', gain: 0.75 },
  tt_catch_golden: { type: 'seq',   parts: [
                       { at: 0,  recipe: { type: 'arp', notes: [880, 1175, 1568], step: 55, noteDur: 110, shape: 'square', gain: 0.85 } },
                       { at: 80, recipe: { type: 'chord', freqs: [880, 1175, 1568], duration: 320, shape: 'sine', gain: 0.4 } },
                     ] },
  tt_catch_heart:  { type: 'arp',   notes: [659, 880], step: 70, noteDur: 130, shape: 'sine', gain: 0.75 },
  tt_hit_danger:   { type: 'crash', noise: { duration: 140, gain: 0.55, lowpass: 1100 }, tone: { freq: 165, duration: 180, shape: 'square', gain: 0.7 } },
  tt_combo_up:     { type: 'arp',   notes: [784, 1047, 1397], step: 55, noteDur: 90, shape: 'square', gain: 0.8 },
  tt_round_end:    { type: 'arp',   notes: [880, 1047, 1319, 1568, 2093], step: 80, noteDur: 150, shape: 'square', gain: 0.85 },

  // ─── flappy-eren — gritty square sweeps ─────────────────────────────────
  fe_flap:         { type: 'sweep', freq: [440, 280], duration: 80, shape: 'square', gain: 0.55 },
  fe_pipe_pass:    { type: 'blip',  freq: 880, duration: 60, shape: 'square', gain: 0.7 },
  fe_crash:        { type: 'crash', noise: { duration: 320, gain: 0.7, lowpass: 800 }, tone: { freq: 110, duration: 250, shape: 'sawtooth', gain: 0.7 } },
  fe_theme_shift:  { type: 'sweep', freq: [220, 440], duration: 600, shape: 'sine', gain: 0.35 },
  fe_milestone_10: { type: 'arp',   notes: [523, 659, 784, 1047], step: 65, noteDur: 110, shape: 'square', gain: 0.8 },
  fe_new_best:     { type: 'arp',   notes: [523, 659, 784, 1047, 1318, 1568], step: 70, noteDur: 130, shape: 'square', gain: 0.85 },

  // ─── tic-tac-toe — X high square, O mid triangle ────────────────────────
  ttt_place_x:   { type: 'blip',  freq: 1175, duration: 70, shape: 'square', gain: 0.6 },
  ttt_place_o:   { type: 'blip',  freq: 587,  duration: 110, shape: 'triangle', gain: 0.7 },
  ttt_win_line:  { type: 'arp',   notes: [523, 659, 784, 1047, 1319], step: 70, noteDur: 130, shape: 'square', gain: 0.85 },
  ttt_lose:      { type: 'arp',   notes: [440, 330, 247], step: 130, noteDur: 180, shape: 'triangle', gain: 0.6 },
  ttt_draw:      { type: 'blip',  freq: 392, duration: 240, shape: 'sine', gain: 0.5 },
  ttt_can_spill: { type: 'crash', noise: { duration: 280, gain: 0.5, lowpass: 700 }, tone: { freq: 175, duration: 300, shape: 'sawtooth', gain: 0.6 } },

  // ─── eren-stack — sawtooth thud + perfect chime ─────────────────────────
  es_place:            { type: 'sweep', freq: [180, 110], duration: 90,  shape: 'sawtooth', gain: 0.7 },
  es_perfect:          { type: 'seq',   parts: [
                          { at: 0,  recipe: { type: 'blip', freq: 1568, duration: 80, shape: 'triangle', gain: 0.85 } },
                          { at: 40, recipe: { type: 'blip', freq: 2093, duration: 120, shape: 'sine', gain: 0.55 } },
                        ] },
  es_perfect_streak:   { type: 'arp',   notes: [1318, 1568, 1976, 2349], step: 55, noteDur: 85, shape: 'triangle', gain: 0.85 },
  es_trim:             { type: 'blip',  freq: 330, duration: 55, shape: 'square', gain: 0.45 },
  es_miss:             { type: 'sweep', freq: [300, 80], duration: 380, shape: 'sawtooth', gain: 0.75 },
  es_sky_change:       { type: 'sweep', freq: [330, 880], duration: 700, shape: 'sine', gain: 0.3 },
  es_height_milestone: { type: 'arp',   notes: [659, 880, 1175, 1568], step: 80, noteDur: 140, shape: 'triangle', gain: 0.8 },

  // ─── yarn-pop — square pops + sine swipes ───────────────────────────────
  yp_swap:      { type: 'sweep', freq: [660, 880], duration: 70, shape: 'sine', gain: 0.5 },
  yp_match_pop: { type: 'blip',  freq: 1047, duration: 60, shape: 'square', gain: 0.75 },
  yp_big_combo: { type: 'arp',   notes: [880, 1175, 1568, 2093], step: 55, noteDur: 95, shape: 'square', gain: 0.85 },
  yp_no_match:  { type: 'sweep', freq: [440, 220], duration: 200, shape: 'square', gain: 0.5 },
  yp_low_moves: { type: 'pulse', freq: 988, pulses: 3, step: 100, pulseDur: 60, shape: 'square', gain: 0.6 },
  yp_gameover:  { type: 'arp',   notes: [880, 698, 523, 392], step: 130, noteDur: 170, shape: 'square', gain: 0.75 },

  // ─── eren-says — Simon-style pure sine pads ─────────────────────────────
  // Single pad-press shares one recipe; pad-distinct pitches are layered on by
  // varying `volume` opt at the call site if wanted later.
  ey_pad_press:        { type: 'blip',  freq: 523, duration: 220, shape: 'sine', gain: 0.7 },
  ey_sequence_show:    { type: 'blip',  freq: 698, duration: 160, shape: 'sine', gain: 0.6 },
  ey_round_clear:      { type: 'arp',   notes: [523, 659, 784, 1047], step: 70, noteDur: 120, shape: 'sine', gain: 0.8 },
  ey_miss:             { type: 'crash', noise: { duration: 180, gain: 0.45, lowpass: 1200 }, tone: { freq: 196, duration: 220, shape: 'sawtooth', gain: 0.65 } },
  ey_streak_milestone: { type: 'arp',   notes: [659, 784, 988, 1175, 1568], step: 70, noteDur: 130, shape: 'sine', gain: 0.85 },
  ey_gameover:         { type: 'arp',   notes: [784, 659, 523, 392, 294], step: 130, noteDur: 170, shape: 'sine', gain: 0.7 },

  // ─── lane-runner — highpass-noise whooshes + coin pings ────────────────
  lr_lane_swipe:  { type: 'noise', duration: 120, gain: 0.35, highpass: 1600 },
  lr_coin_pickup: { type: 'arp',   notes: [1568, 2349], step: 50, noteDur: 80, shape: 'square', gain: 0.7 },
  lr_fish_pickup: { type: 'arp',   notes: [988, 1318, 1760], step: 55, noteDur: 95, shape: 'triangle', gain: 0.8 },
  lr_crash:       { type: 'crash', noise: { duration: 400, gain: 0.75, lowpass: 600 }, tone: { freq: 95, duration: 300, shape: 'sawtooth', gain: 0.7 } },
  lr_near_miss:   { type: 'noise', duration: 90, gain: 0.4, highpass: 2400 },
  lr_speed_up:    { type: 'sweep', freq: [330, 880], duration: 280, shape: 'sawtooth', gain: 0.55 },
  lr_new_best:    { type: 'arp',   notes: [659, 784, 988, 1175, 1568, 1976], step: 70, noteDur: 130, shape: 'square', gain: 0.85 },

  // ─── paw-doku — clean sine clicks (zen) ────────────────────────────────
  pd_place:      { type: 'blip', freq: 988,  duration: 60, shape: 'sine', gain: 0.6 },
  pd_invalid:    { type: 'blip', freq: 247,  duration: 140, shape: 'square', gain: 0.55 },
  pd_line_clear: { type: 'arp',  notes: [880, 1108, 1318, 1568], step: 55, noteDur: 110, shape: 'sine', gain: 0.85 },
  pd_combo:      { type: 'arp',  notes: [988, 1175, 1397, 1760, 2093], step: 55, noteDur: 95, shape: 'sine', gain: 0.85 },
  pd_streak:     { type: 'arp',  notes: [659, 880, 1175, 1568], step: 70, noteDur: 130, shape: 'triangle', gain: 0.8 },
  pd_pickup:     { type: 'blip', freq: 1175, duration: 40, shape: 'sine', gain: 0.45 },
  pd_gameover:   { type: 'arp',  notes: [784, 988, 1175, 1568, 2093], step: 90, noteDur: 150, shape: 'sine', gain: 0.8 },

  // ─── Care reactions — water / soap / medicine ──────────────────────────────
  // Synthesised so they DON'T fall back to care_eat (the chewing mp3), which is
  // why finishing a bath used to sound like Eren eating. Built from filtered
  // white noise: band-limited = soft soap rub, bright highpass = shower hiss,
  // a noise burst + downward sine = a water splash.
  //
  // care_soap   — short soft "shff" rub, replayed while soaping him up.
  care_soap:   { type: 'noise', duration: 130, gain: 0.26, lowpass: 1300, highpass: 450 },
  // care_rinse  — bright water hiss, replayed while the shower is over him.
  care_rinse:  { type: 'noise', duration: 190, gain: 0.24, highpass: 2600, lowpass: 7000 },
  // care_splash — the shake-dry: a spray of noise + a low water "ploop".
  care_splash: { type: 'seq', parts: [
                   { at: 0,  recipe: { type: 'noise', duration: 240, gain: 0.42, lowpass: 2200, highpass: 320 } },
                   { at: 30, recipe: { type: 'sweep', freq: [620, 200], duration: 200, shape: 'sine', gain: 0.3, curve: 'exponential' } },
                 ] },
  // care_gulp   — medicine swallow (vet), so it isn't the chewing mp3 either.
  care_gulp:   { type: 'seq', parts: [
                   { at: 0,  recipe: { type: 'blip',  freq: 320, duration: 80, shape: 'sine', gain: 0.5 } },
                   { at: 70, recipe: { type: 'sweep', freq: [260, 150], duration: 130, shape: 'sine', gain: 0.42, curve: 'exponential' } },
                 ] },
}
