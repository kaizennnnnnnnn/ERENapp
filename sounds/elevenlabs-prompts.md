# Eren — ElevenLabs Sound Prompts (v2 — tightened)

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
| `ui_tap.mp3` | **0.08 s** | A single tiny high-pitched chiptune blip, very short, sharp attack, instant decay, retro 8-bit, mono, dry. |
| `ui_back.mp3` | **0.15 s** | Two short chiptune blips descending in pitch, mid → low, retro 8-bit, crisp, mono, dry. |
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
