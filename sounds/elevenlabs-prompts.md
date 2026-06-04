# Eren — Sound Sources (v4 — Kenney CC0 shipped)

The sound bank now ships with **Kenney.nl CC0 chiptune sounds** instead of
the originally-planned ElevenLabs generations. ElevenLabs prompts below
are kept as reference + fallback for any slot you want to re-roll later
in a different style.

## Shipped sounds (Kenney CC0 — drop-in already in `public/sounds/`)

All files were converted OGG → MP3 with EBU R128 loudness normalization
(`-af loudnorm=I=-14:TP=-1.5:LRA=11 -ar 44100 -ac 1 -b:a 96k`) so every
clip sits at the same playback level.

### `public/sounds/ui/`

| File | Source (Kenney *Interface Sounds*) | Triggered when |
|---|---|---|
| `ui_tap.mp3` | `click_001.ogg` | Any small button tap across the app |
| `ui_back.mp3` | `back_001.ogg` | Back arrows + close buttons |
| `ui_toggle.mp3` | `switch_001.ogg` | LightSwitch, theme picker, mood-alert switch |
| `ui_select.mp3` | `select_001.ogg` | Mood pickers, gacha banner select |
| `ui_modal_open.mp3` | `confirmation_002.ogg` | Bottom-sheets, detail panels, quest button |
| `ui_modal_close.mp3` | `pluck_002.ogg` | Closing modals + dismissing popups |
| `ui_notification_ping.mp3` | `confirmation_001.ogg` | Achievement + streak milestone toasts |
| `ui_swipe_room.mp3` | *unchanged* (user keep) | Page swipe between care rooms |
| `ui_loading.mp3` | *unchanged* | Loading screens |

### `public/sounds/progression/`

| File | Source (Kenney *Music Jingles* — 8-Bit NES set) | Triggered when |
|---|---|---|
| `quest_complete.mp3` | `Steel/jingles_STEEL09.ogg` (0.59 s) | Any daily/weekly task ticked off |
| `level_up.mp3` | `jingles_NES13.ogg` (1.05 s) | Level-up moment |
| `gift_open.mp3` | user-supplied (warm chime) | Daily fortune reveal, reward road claim, weekly champion payout, comeback bonus |
| `coin_pickup.mp3` | `jingles_NES14.ogg` (0.37 s) | **Unused** — replaced by `gift_open` for reward-road / payout moments because the NES14 jingle read as a thin "ka-ching" rather than a satisfying payoff. File kept in the bank if you want it back for a different slot. |

### `public/sounds/care/`

| File | Source | Triggered when |
|---|---|---|
| `care_eat.mp3` | user-supplied (ElevenLabs cat-eating SFX) | Eren starts eating in FeedScene (per food item) |

### `public/sounds/gacha/`

| File | Source (Kenney *Music Jingles* — 8-Bit NES set) | Triggered when |
|---|---|---|
| `gacha_reveal_common.mp3` | `jingles_NES02.ogg` (0.39 s) | Common item reveal in a pull |
| `gacha_reveal_rare.mp3` | `jingles_NES03.ogg` (0.60 s) | Rare reveal |
| `gacha_reveal_epic.mp3` | `jingles_NES12.ogg` (0.85 s) | Epic reveal |
| `gacha_reveal_legendary.mp3` | `jingles_NES00.ogg` (1.76 s) | Legendary reveal |

## How to swap a sound you don't like

1. Download the relevant Kenney pack:
   - **Interface Sounds**: https://kenney.nl/assets/interface-sounds (UI clicks, switches, ticks)
   - **Music Jingles**: https://kenney.nl/assets/music-jingles (NES + Hit + Pizzicato + Sax + Steel — 85 jingles total)
   - **Digital Audio**: https://kenney.nl/assets/digital-audio (laser, phaser, pep, threeTone — good for accent SFX)
2. Pick a different `.ogg` you like better.
3. Convert + normalize:
   ```
   ffmpeg -y -i source.ogg -af "loudnorm=I=-14:TP=-1.5:LRA=11" \
     -ar 44100 -ac 1 -b:a 96k public/sounds/<bucket>/<name>.mp3
   ```
4. The app reloads with no further code changes.

For non-Kenney sources (your own recordings, ElevenLabs generations,
freesound.org clips with CC0 license), the same ffmpeg one-liner applies.

---
# Original ElevenLabs prompts (reference / fallback)

ElevenLabs Sound Effects: one prompt → one sound. Generate each entry
separately. Keep the duration **slider** at the listed length below —
the prompt text is already tight enough that the model won't pad.

## Master style cue

> Append to every prompt: `8-bit / 16-bit chiptune, retro Game Boy era, mono, dry (no reverb), clean attack, normalized loudness.`

(I've baked the cue into each prompt below; you can copy them as-is.)

## ElevenLabs settings (use these every time)

- **Prompt Influence**: 75 – 85 % (forces the model to follow the words and not drift into music)
- **Generate 4 takes** per prompt, pick the cleanest one
- **Don't try to mix sounds in a single prompt.** A "purr + chime + bounce" prompt always gives mush. Generate the parts separately and play them simultaneously in code.
- **Normalize after**: `ffmpeg -i in.mp3 -af loudnorm=I=-12:TP=-1.5 out.mp3`
- **Loops**: write `seamless loop` in the prompt and pick a duration that's a multiple of 4 s

---

## 1. UI / Navigation (very short, punchy)

| Filename | Duration | Prompt |
|---|---|---|
| `ui_tap.mp3` | **0.07 s** | A single tiny mid-pitch chiptune blip, soft and round (not piercing), instant decay, retro Game Boy, mono, dry. |
| `ui_back.mp3` | **0.16 s** | Two short chiptune blips descending mid → low, soft and round, retro Game Boy, mono, dry. |
| `ui_toggle.mp3` | **0.09 s** | A soft pixel "tick": one mid-low chiptune click with a slight resonant tail, like flipping a small switch, retro 8-bit, mono, dry. |
| `ui_select.mp3` | **0.12 s** | A round chiptune pickup blip, mid-pitch with a tiny rising hint at the end, like selecting a menu item in a Game Boy RPG, mono, dry. |
| `ui_tab_switch.mp3` | **0.07 s** | A single tiny mid-pitch chiptune click, dull, retro 8-bit, mono, dry. |
| `ui_modal_open.mp3` | **0.20 s** | Two short chiptune blips ascending in pitch, mid → high, soft and inviting, retro 16-bit, mono, dry. |
| `ui_modal_close.mp3` | **0.18 s** | Two short chiptune blips descending in pitch, high → mid, soft, retro 16-bit, mono, dry. |
| `ui_swipe_room.mp3` | **0.25 s** | A quick chiptune downward pitch sweep with a soft tail, like a UI page slide, retro 16-bit, mono, dry. |
| `ui_loading.mp3` | **1.20 s** (loop) | A quiet repeating two-tone chiptune cycle on loop, low-volume, retro 8-bit, mono, seamless loop. |
| `ui_notification_ping.mp3` | **0.40 s** | A bright two-note ascending chiptune ping, friendly, attention-getting, retro 16-bit, mono, dry. |

## 2. Care actions

| Filename | Duration | Prompt |
|---|---|---|
| `care_eat.mp3` | **1.10 s** | A small cute pixel cat eating: 4 quick soft munching crunches with a tiny chiptune "om-nom" overlay, kawaii, mono, dry. |
| `care_buy_food.mp3` | **0.55 s** | A retro 8-bit cash-register "ka-ching": single bell ding plus two coin clinks, satisfying, mono, dry. |
| `care_play_chirp.mp3` | **0.65 s** | A single happy kitten "mrrp" chirp followed by a 3-note chiptune sparkle, kawaii, mono, dry. |
| `care_ball_throw.mp3` | **0.65 s** | A soft fabric whoosh into a low rubbery thud and one small bounce, organic in a cozy retro game palette, mono, dry. |
| `care_sleep_loop.mp3` | **4.00 s** (loop) | A slow gentle cat purr with a faint nasal snore-breath cycle, very calm, kawaii, seamless loop, mono. |
| `care_soap_loop.mp3` | **1.60 s** (loop) | Soft bubbly squelching with a quiet sparkly chiptune wash on top, cozy and kawaii, seamless loop, mono. |
| `care_rinse_loop.mp3` | **2.00 s** (loop) | A steady light water spray with a faint sparkling chime overtone, peaceful, seamless loop, mono. |
| `care_wash_done.mp3` | **0.55 s** | A 3-note ascending chiptune sparkle (low-mid-high), bright and clean, retro 16-bit, mono, dry. |
| `care_medicine.mp3` | **0.40 s** | A tiny gulp followed by a soft chiptune "plink", kawaii, mono, dry. |
| `care_sad_meow.mp3` | **0.70 s** | A short low-pitched plaintive kitten meow, slightly sleepy, single note, mono, dry. |
| `care_drip.mp3` | **0.25 s** | A single small water-drop plink with a tiny tail echo, clean and minimal, mono, dry. |

## 3. Stat thresholds & alerts

| Filename | Duration | Prompt |
|---|---|---|
| `alert_warn.mp3` | **0.45 s** | A soft 2-note descending chiptune chime, gentle alert (not alarming), retro 16-bit, mono, dry. |
| `alert_critical.mp3` | **0.65 s** | A 3-note descending chiptune alert, slightly tense but cute, retro 16-bit, mono, dry. |
| `alert_sick.mp3` | **0.75 s** | A worried 2-note falling chiptune motif with a tiny meow tail, retro 16-bit, mono, dry. |

## 4. XP / coins / level up

| Filename | Duration | Prompt |
|---|---|---|
| `xp_pickup.mp3` | **0.25 s** | A small chiptune sparkle: 4 quick rising blip notes, retro 8-bit, mono, dry. |
| `xp_fly_to_bar.mp3` | **0.35 s** | A whooshy ascending chiptune sparkle for a particle flying through the air, light and shimmery, retro 16-bit, mono, dry. |
| `level_up.mp3` | **1.10 s** | An exciting 8-bit Tamagotchi-style level-up: short rising 4-note arpeggio finishing with a sprinkle of tiny chime sparkles, triumphant but cute, mono, dry. |
| `coin_pickup.mp3` | **0.20 s** | A clean retro pickup-coin sound (Mario-style), single bright chiptune ding, mono, dry. |
| `quest_complete.mp3` | **0.90 s** | An upward 5-note chiptune flourish ending on a bright high tone, triumphant and cute, retro 16-bit, mono, dry. |

## 5. Reward road

| Filename | Duration | Prompt |
|---|---|---|
| `reward_hop.mp3` | **0.30 s** | A soft "boing" bounce plus a small chiptune blip on landing — a pixel cat hop, kawaii, mono, dry. |
| `reward_claim.mp3` | **0.55 s** | A bright pickup chiptune chime plus a tiny coin clink, satisfying, retro 16-bit, mono, dry. |
| `reward_milestone.mp3` | **1.40 s** | A 4-note rising chiptune fanfare with a confetti-shimmer layer and a sustained chime tail, exciting, retro 16-bit, mono, dry. |
| `reward_mega.mp3` | **1.90 s** | A big triumphant chiptune fanfare for a mega milestone: 5-note ascending arpeggio with layered chime sparkles and a gold-shimmer crescendo, mono, dry. |

## 6. Mini-games

### Catch the Mouse
| Filename | Duration | Prompt |
|---|---|---|
| `cm_catch.mp3` | **0.35 s** | A tiny squeaky cartoon mouse "eek" plus a quick chiptune sparkle pop, kawaii, mono, dry. |
| `cm_miss.mp3` | **0.20 s** | A subtle low chiptune thud, retro 8-bit, mono, dry. |

### Yarn Chase
| Filename | Duration | Prompt |
|---|---|---|
| `yc_grab.mp3` | **0.55 s** | A soft rolling-yarn rustle plus a happy chiptune chirp, kawaii, mono, dry. |

### Paw Tap
| Filename | Duration | Prompt |
|---|---|---|
| `pt_fish.mp3` | **0.25 s** | A tiny water-bubble plink with a chiptune "plip" rising in pitch, kawaii, mono, dry. |
| `pt_bonus.mp3` | **0.45 s** | A bright sparkle chime: 3 ascending notes plus a final shimmer, retro 16-bit, mono, dry. |
| `pt_danger.mp3` | **0.35 s** | A short retro buzz error tone, slightly comic (not punishing), retro 8-bit, mono, dry. |

### Memory Match
| Filename | Duration | Prompt |
|---|---|---|
| `mm_flip.mp3` | **0.18 s** | A quick paper-card flip whisper with a tiny chiptune blip, dry, mono. |
| `mm_match.mp3` | **0.45 s** | A happy 2-note ascending chime plus a tiny sparkle, retro 16-bit kawaii, mono, dry. |
| `mm_miss.mp3` | **0.32 s** | A soft "plonk" downward tone, gentle disappointment, retro 16-bit, mono, dry. |
| `mm_combo.mp3` | **0.45 s** | A higher-pitched sparkle ping that gets shinier each combo step, retro 16-bit, mono, dry. |
| `mm_clear.mp3` | **1.40 s** | A full chiptune fanfare with a 4-note rising flourish and a sustained shimmer tail, retro 16-bit, mono, dry. |

### Treat Tumble
| Filename | Duration | Prompt |
|---|---|---|
| `tt_catch.mp3` | **0.18 s** | A soft chiptune pickup blip — single bright tone for catching a treat, retro 8-bit, mono, dry. |
| `tt_golden.mp3` | **0.65 s** | A long sparkle chime with rising shimmer for catching a golden star treat, retro 16-bit, mono, dry. |
| `tt_hit.mp3` | **0.40 s** | A short comic "doink" impact plus a small downward chiptune slide for hitting a hazard, kawaii, mono, dry. |
| `tt_life_lost.mp3` | **0.55 s** | A low descending 2-tone chiptune sting, sad but cute, retro 16-bit, mono, dry. |
| `tt_heart_pickup.mp3` | **0.45 s** | A warm rising chiptune heart-pickup chime, kawaii, mono, dry. |

### Shared
| Filename | Duration | Prompt |
|---|---|---|
| `game_start.mp3` | **1.40 s** | A retro arcade "3-2-1-go": three short staccato bleeps then a brighter rising fanfare blip, 8-bit, mono, dry. |
| `game_over.mp3` | **1.10 s** | A gentle 4-note descending chiptune cadence, accepting and soft, retro 16-bit, mono, dry. |
| `new_high_score.mp3` | **0.95 s** | An exciting "NEW RECORD" stinger: quick rising chiptune arpeggio plus a sparkle tail, retro 16-bit, mono, dry. |

## 7. Gacha (capsule machine)

| Filename | Duration | Prompt |
|---|---|---|
| `gacha_lever.mp3` | **0.45 s** | A short mechanical lever crank in a hollow plastic casing, retro arcade, mono, dry. |
| `gacha_capsule_roll.mp3` | **1.40 s** | A hollow plastic capsule rolling and rattling down a chute, retro arcade, mono, dry. |
| `gacha_reveal_common.mp3` | **0.22 s** | A single small chiptune pop, flat tone, retro 8-bit, mono, dry. |
| `gacha_reveal_rare.mp3` | **0.55 s** | A 2-note rising chiptune chime in a cool sky-blue palette with a sparkly tail, retro 16-bit, mono, dry. |
| `gacha_reveal_epic.mp3` | **1.00 s** | A 3-note rising chiptune fanfare with a purple-shimmer ringing tail, exciting, retro 16-bit, mono, dry. |
| `gacha_reveal_legendary.mp3` | **2.00 s** | A big triumphant chiptune fanfare: 5-note ascending arpeggio, layered chime sparkles, gold-shimmer crescendo, retro 16-bit, mono, dry. |
| `gacha_pity.mp3` | **0.35 s** | A quick "click + ding" chiptune unlock motif, retro 16-bit, mono, dry. |

## 8. Couple / messages

| Filename | Duration | Prompt |
|---|---|---|
| `msg_send.mp3` | **0.40 s** | A soft heart-themed chiptune chirp: 2 tiny rising tones with a small kissy "mwah" overtone, kawaii, mono, dry. |
| `msg_receive.mp3` | **0.65 s** | A warm 2-note arrival ding plus a faint purr underneath, kawaii, retro 16-bit, mono, dry. |
| `anniversary.mp3` | **1.10 s** | A celebratory chiptune flourish with a confetti-pop sparkle layer, kawaii, retro 16-bit, mono, dry. |

## 9. Faucet drip (bathroom looping ambience)

| Filename | Duration | Prompt |
|---|---|---|
| `bath_drip_loop.mp3` | **8.00 s** (loop) | A single small water drop plink every ~2.6 s in a quiet bathroom with a faint tail echo, seamless loop, mono. |

## 10. Ambient room loops (low-volume background)

| Filename | Duration | Prompt |
|---|---|---|
| `amb_kitchen.mp3` | **24 s** (loop) | Cozy kitchen ambience: faint kettle hum and a very occasional small pan clink, warm, seamless loop, mono. |
| `amb_bedroom.mp3` | **24 s** (loop) | Very quiet bedroom: soft purr-breathing and a faint distant clock tick, calming, seamless loop, mono. |
| `amb_bathroom.mp3` | **24 s** (loop) | Peaceful bathroom: occasional water drip plink and a soft pipe whoosh, seamless loop, mono. |
| `amb_playroom.mp3` | **24 s** (loop) | Light cheerful playroom with a faint distant chiptune music-box twinkle, kawaii, seamless loop, mono. |
| `amb_vet.mp3` | **24 s** (loop) | Very faint clinical hum with an occasional gentle chime, calm, seamless loop, mono. |
| `amb_school.mp3` | **24 s** (loop) | Quiet classroom: soft paper rustle and a faint pencil scratch, gentle, seamless loop, mono. |
| `amb_home.mp3` | **24 s** (loop) | Warm cozy living-room tone with an occasional cute pet shuffle, kawaii, seamless loop, mono. |

## 11. Push notifications (system-level)

These come through the OS, so push them slightly louder than in-app sounds.

| Filename | Duration | Prompt |
|---|---|---|
| `push_default.mp3` | **0.55 s** | A 2-note ascending chiptune notification chime, friendly but noticeable, retro 16-bit, mono, dry. |
| `push_critical.mp3` | **0.75 s** | A 3-note urgent chiptune chirp pitched slightly higher, "Eren needs help" feel, retro 16-bit, mono, dry. |

---

## 12. Mini-game gameplay SFX (new wiring)

These keys were added to `src/lib/sounds.ts` to wire gameplay-moment audio for
the 11 mini-games (catch-mouse, paw-tap, memory-match, treat-tumble,
flappy-eren, tic-tac-toe, eren-stack, yarn-pop, eren-says, lane-runner,
paw-doku). Each row lists the per-game folder + filename, the duration to
set on the ElevenLabs slider, the prompt (master cue already appended), and
the FALLBACK sound that plays in the interim while the real mp3 is being
generated.

Master cue (already baked into every prompt below):
> `8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness.`

### Catch the Mouse — `public/sounds/games/catch-mouse/`

| Filename | Duration | Prompt | Fallback (until file ships) |
|---|---|---|---|
| `cm_catch.mp3` | **0.22 s** | A bright 8-bit squeak with a coin-pickup chime, two-note upward arpeggio, kawaii success blip. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `care_eat` |
| `cm_miss.mp3` | **0.12 s** | A soft muted thud / low wood-knock with no melody, dry and short, a "you missed" tap. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `pet_purr` |
| `cm_combo.mp3` | **0.48 s** | An ascending 4-note sparkle chime with NES powerup feel, shimmery tail, bright streak reward. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `gacha_reveal_rare` |
| `cm_time_warning.mp3` | **0.36 s** | A tense low beep-beep, two-tone alarm pulse, urgent but not painful, one-shot. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `ui_notification_ping` |
| `cm_tick.mp3` | **0.09 s** | A single short clock-tick / wood-block click, dry, single transient. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `gacha_reveal_common` |
| `cm_gameover.mp3` | **0.90 s** | A triumphant 5-note pixel fanfare, brassy and major-key, victorious round-end stinger. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `quest_complete` |

### Paw Tap — `public/sounds/games/paw-tap/`

| Filename | Duration | Prompt | Fallback |
|---|---|---|---|
| `pt_catch_good.mp3` | **0.18 s** | A short wet bubbly pop with a high-pitched plink tail, a regular fish-catch blip. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `care_eat` |
| `pt_catch_bonus.mp3` | **0.40 s** | A shimmery rising arpeggio with a sparkle layer, three notes climbing then a shine tail, bonus fish reward. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `gacha_reveal_rare` |
| `pt_danger_hit.mp3` | **0.26 s** | A low buzzy thud with a detuned descending blip, dissonant penalty hit. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `ui_notification_ping` |
| `pt_combo_milestone.mp3` | **0.35 s** | An ascending three-note chiptune fanfare, bright and triumphant, streak-bonus moment. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `level_up` |
| `pt_fish_escape.mp3` | **0.16 s** | A tiny descending bubble plop, soft and short, an uncaught fish vanishing. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `pet_purr` |
| `pt_game_over.mp3` | **0.85 s** | A watery wind-down chord with a final coin-jingle tail, end-of-round flourish. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `quest_complete` |

### Memory Match — `public/sounds/games/memory-match/`

| Filename | Duration | Prompt | Fallback |
|---|---|---|---|
| `mm_card_flip.mp3` | **0.14 s** | A short woody pixel flip — soft mid-pitch click with a quick upward chirp tail, card reveal. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `ui_notification_ping` |
| `mm_match.mp3` | **0.36 s** | A bright two-note ascending chime in a warm major third, kawaii match success. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `gacha_reveal_common` |
| `mm_combo.mp3` | **0.52 s** | A rising arpeggio sparkle — three quick ascending blips with a shimmer tail, escalating combo reward. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `gacha_reveal_rare` |
| `mm_miss.mp3` | **0.28 s** | A muted descending two-note buzz, slightly dissonant, gentle mismatch tone. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `pet_purr` |
| `mm_purrfect.mp3` | **1.20 s** | A triumphant 4-note fanfare with a sparkle tail, full-board clear celebration. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `quest_complete` |
| `mm_timer_warn.mp3` | **0.42 s** | A low urgent two-pulse heartbeat thump, tense countdown engaging. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `gift_open` |

### Treat Tumble — `public/sounds/games/treat-tumble/`

| Filename | Duration | Prompt | Fallback |
|---|---|---|---|
| `tt_catch_good.mp3` | **0.14 s** | A short bright pickup chime, 8-bit blip with a quick upward pitch sweep, generic treat catch. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `care_eat` |
| `tt_catch_golden.mp3` | **0.32 s** | A sparkly ascending 4-note arpeggio, glittery chiptune, golden-star catch reward. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `gacha_reveal_epic` |
| `tt_catch_heart.mp3` | **0.26 s** | A warm two-note major-third chime with a soft purr undertone, heart-pickup reward. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `pet_purr` |
| `tt_hit_danger.mp3` | **0.22 s** | A harsh descending buzz / glitch zap, short and dissonant, hazard penalty. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `ui_notification_ping` |
| `tt_combo_up.mp3` | **0.28 s** | A rising 3-note triumphant blip, each note a semitone higher than the last, combo tick. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `level_up` |
| `tt_round_end.mp3` | **0.60 s** | A cheerful 5-note victory jingle, descending then resolving up, round-end flourish. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `quest_complete` |

### Flappy Eren — `public/sounds/games/flappy-eren/`

| Filename | Duration | Prompt | Fallback |
|---|---|---|---|
| `fe_flap.mp3` | **0.18 s** | A short hissy "pshhht" fizz burst with a low whoosh tail, an energy-can flap impulse. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `care_eat` |
| `fe_pipe_pass.mp3` | **0.24 s** | A bright ascending two-note chiptune ding with a sparkle tail, pipe-clear point gain. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `gacha_reveal_common` |
| `fe_crash.mp3` | **0.45 s** | A crunchy 8-bit thud + descending pitch slide, like a can being crushed, collision death. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `gift_open` |
| `fe_theme_shift.mp3` | **0.70 s** | An ethereal upward chiptune sweep with two glassy bells, scene-theme transition. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `level_up` |
| `fe_milestone_10.mp3` | **0.60 s** | A triumphant three-note arpeggio with a chip-cheer tail, score milestone (10/25/50). 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `quest_complete` |
| `fe_new_best.mp3` | **0.90 s** | A long sparkling fanfare, golden chiptune flourish, new personal-best celebration. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `gacha_reveal_legendary` |

### Tic-Tac-Toe — `public/sounds/games/tic-tac-toe/`

| Filename | Duration | Prompt | Fallback |
|---|---|---|---|
| `ttt_place_x.mp3` | **0.14 s** | A bright pink chiptune blip, two-note rising 5th with a crisp square-wave attack, player X placement. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `care_eat` |
| `ttt_place_o.mp3` | **0.18 s** | A softer purple synth pluck, descending minor third with a slight pitch wobble like a cat-paw tap, Eren's O placement. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `pet_purr` |
| `ttt_win_line.mp3` | **0.70 s** | An ascending 4-note arpeggio in C major with a sparkle tail and gold-coin shimmer, win-line ignition. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `quest_complete` |
| `ttt_lose.mp3` | **0.60 s** | A low descending wah-wah trombone-ish chiptune, two notes down a minor 6th, comedic-not-punishing loss. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `gacha_reveal_common` |
| `ttt_draw.mp3` | **0.38 s** | A neutral flat two-note plink, same pitch repeated with a faint paper-shuffle texture, board-full tie. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `ui_notification_ping` |
| `ttt_can_spill.mp3` | **0.55 s** | A metallic clink + liquid glug + tiny gasp meow, layered playful Foley, energy-can tip-over easter egg. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `gift_open` |

### Eren Stack — `public/sounds/games/eren-stack/`

| Filename | Duration | Prompt | Fallback |
|---|---|---|---|
| `es_place.mp3` | **0.14 s** | A short woody clack with a low thump tail, like a wooden block landing, normal stack drop. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `care_eat` |
| `es_perfect.mp3` | **0.32 s** | A bright crystalline ding with a short upward chiptune arpeggio, perfect-tolerance drop reward. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `gacha_reveal_rare` |
| `es_perfect_streak.mp3` | **0.42 s** | An ascending 3-note chime, sparkly with escalating pitch, perfect-streak milestone (3/5/7…). 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `gacha_reveal_epic` |
| `es_trim.mp3` | **0.22 s** | A soft whoosh + small wood snap as the chunk separates, imperfect-drop trim-off cue. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `gift_open` |
| `es_miss.mp3` | **0.52 s** | A descending dissonant thud with a low-pass sweep down, total-miss game-over. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `gacha_reveal_legendary` |
| `es_sky_change.mp3` | **0.70 s** | A soft pad swell, airy ambient transition, sky-tier escalation every 12 pieces. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `pet_purr` |
| `es_height_milestone.mp3` | **0.48 s** | A triumphant 2-note chiptune fanfare, height threshold (10/25/50) celebration. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `level_up` |

### Yarn Pop — `public/sounds/games/yarn-pop/`

| Filename | Duration | Prompt | Fallback |
|---|---|---|---|
| `yp_swap.mp3` | **0.14 s** | A short woody tile-shuffle click, two quick stacked clacks 60ms apart, adjacent-swap commit. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `care_eat` |
| `yp_match_pop.mp3` | **0.26 s** | A bubbly chiptune pop with a tiny sparkle tail, ascending one semitone per combo level, cascade clear. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `gacha_reveal_common` |
| `yp_big_combo.mp3` | **0.70 s** | A warm rising 4-note chiptune arpeggio with a bright shimmer tail, x4+ cascade reward. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `gacha_reveal_epic` |
| `yp_no_match.mp3` | **0.22 s** | A soft descending two-note "nope" buzzer, dry and non-harsh, invalid-swap revert. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `ui_notification_ping` |
| `yp_low_moves.mp3` | **0.28 s** | A single thin urgent beep with a slight tremolo, mid-high pitch, low-moves alarm (5 then 1). 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `ui_notification_ping` |
| `yp_gameover.mp3` | **0.90 s** | A slow descending 5-note chiptune flourish with a cymbal-ish tail, end-of-game cadence. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `quest_complete` |

### Eren Says — `public/sounds/games/eren-says/`

| Filename | Duration | Prompt | Fallback |
|---|---|---|---|
| `ey_pad_press.mp3` | **0.18 s** | A short bright triangle-wave blip subtly pitched to the pad's musical note (G4 / C5 / E5 / G5), crisp attack, player echo. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `ui_notification_ping` |
| `ey_sequence_show.mp3` | **0.32 s** | A warm chiptune triangle tone with a tiny reverb tail, slightly louder/longer than the player echo, sequence-show illumination. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `gacha_reveal_common` |
| `ey_round_clear.mp3` | **0.50 s** | A rising 3-note arpeggio C-E-G with a sparkle shimmer on the top note, full-sequence success. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `quest_complete` |
| `ey_miss.mp3` | **0.60 s** | A descending wah-wah trombone fail-trumpet with a final dull thud, wrong-pad penalty. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `care_eat` |
| `ey_streak_milestone.mp3` | **0.70 s** | A celebratory 4-note fanfare with a chip-arp sparkle, slightly chorused, multiple-of-5 round milestone. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `level_up` |
| `ey_gameover.mp3` | **0.85 s** | A slow descending minor cadence, two soft piano-ish triangle notes resolving down, run-ended sting. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `gift_open` |

### Lane Runner — `public/sounds/games/lane-runner/`

| Filename | Duration | Prompt | Fallback |
|---|---|---|---|
| `lr_lane_swipe.mp3` | **0.12 s** | A short whoosh + tiny pitched blip, sub-tone descending, lane-change confirm. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `pet_purr` |
| `lr_coin_pickup.mp3` | **0.22 s** | A classic bright 8-bit coin ding, two-note up arpeggio, coin collected. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `gacha_reveal_common` |
| `lr_fish_pickup.mp3` | **0.38 s** | A fuller chiptune chime with a sparkle tail, higher pitch than coin, rare fish (+3) catch. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `gacha_reveal_rare` |
| `lr_crash.mp3` | **0.50 s** | A low thud + descending detuned splat with a slight bitcrush, obstacle-impact game-over. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `gift_open` |
| `lr_near_miss.mp3` | **0.18 s** | A quick high-pitched whoosh / breath sound, obstacle passes in an adjacent lane. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `ui_notification_ping` |
| `lr_speed_up.mp3` | **0.45 s** | A rising synth riser, short two-step climb, speed-tier threshold crossed. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `level_up` |
| `lr_new_best.mp3` | **0.70 s** | A celebratory 4-note chiptune fanfare, personal-best beat. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `quest_complete` |

### Paw-Doku — `public/sounds/games/paw-doku/`

| Filename | Duration | Prompt | Fallback |
|---|---|---|---|
| `pd_place.mp3` | **0.16 s** | A soft wooden "tok" with a faint chiptune blip tail, slightly pitched up by piece cell-count, generic placement. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `care_eat` |
| `pd_invalid.mp3` | **0.18 s** | A low 8-bit error buzz, two-note descending blip, invalid-drop bounce-back. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `ui_notification_ping` |
| `pd_line_clear.mp3` | **0.38 s** | A bright ascending arpeggio sparkle, 4-note major run, single row/col/3x3 clear. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `gacha_reveal_rare` |
| `pd_combo.mp3` | **0.52 s** | A chunky synth chord stab layered with a quick rising sweep, more triumphant than single clear, multi-line simultaneous clear. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `gacha_reveal_epic` |
| `pd_streak.mp3` | **0.60 s** | An ascending chiptune jingle, three notes climbing a fifth with a sparkle tail, streak multiplier x2+. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `level_up` |
| `pd_pickup.mp3` | **0.09 s** | A short crisp "clink" pickup blip, single high note, tray-block drag start. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `pet_purr` |
| `pd_gameover.mp3` | **0.85 s** | A descending 4-note minor cadence with a low synth thud finisher, no-moves-left run-end. 8-bit / 16-bit chiptune, retro Game Boy era, mono, dry, clean attack, normalized loudness. | `quest_complete` |

> **Note on collisions:** Three keys (`cm_catch`, `cm_miss`, `mm_match`, `mm_miss`, `mm_combo`) appear in the older Section 6 "Mini-games" prompt list under slightly different aesthetic notes. Section 12 is the canonical wiring for the new gameplay layer — generate against the prompts here. Section 6 remains as historical reference only.

---

## Quick reference — clip lengths by class

| Class | Length | Examples |
|---|---|---|
| Tiny click | 0.07 – 0.10 s | tap, tab switch |
| Click pair | 0.15 – 0.25 s | back, modal, swipe |
| Notification | 0.35 – 0.50 s | ping, warn |
| Pickup / pop | 0.20 – 0.45 s | coin, xp, gacha common, mm_flip, tt_catch |
| Action stinger | 0.50 – 0.80 s | catch fish, match, hop, bonus |
| Cute fanfare | 1.00 – 1.50 s | level_up, mm_clear, quest_complete, milestone |
| Big fanfare | 1.80 – 2.20 s | legendary reveal, mega milestone |
| Loops | 1.5 – 30 s | care loops + ambients |

If a generated take comes out longer than the listed duration, regenerate — don't trim, the cleanest takes are usually the shortest ones.
