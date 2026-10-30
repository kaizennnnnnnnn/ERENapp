# "New design" = Meadow

When the owner says **"new design"**, **"implement new design"**, **"update this to the new design"** or
sends a screenshot of a screen with "this too", he means: **convert that screen to the Meadow look**,
using the kit in `src/components/meadow`. Nothing else. Not a fresh visual direction, not a redesign of
the feature, not the old pixel/arcade style.

The code is the source of truth: `src/components/meadow/*` (the kit) and the screens already converted
(listed under "Reference screens" below). Copy their patterns; don't invent new ones.

## Old look vs Meadow

| Old (what he wants gone) | Meadow (what he wants) |
|---|---|
| Dark purple / obsidian / black panels, CRT scanlines, glows | Light section grounds (`GROUND`, `TINT`), white cards |
| `font-pixel` / `"Press Start 2P"` labels, ALL CAPS everywhere | Rounded sans (`FONT_ROUNDED`, set by `.meadow-root`), sentence case; uppercase only for 12px section labels (`TYPE.label`) |
| 2-3px borders + offset hard shadows (`3px 3px 0`), gold rivet pixels, neo-brutal plum borders | No borders on cards over a coloured ground. White pieces lift with a straight-down lip (`0 3px 0 M.overArtLip`). A white card on a WHITE ground (inside a Sheet, onboarding) uses `<Card outlined>` (2px `M.hairline`) or it vanishes |
| Candy gradients, neon accents | One accent: leaf green `M.leaf`. Coin gold, love pink, energy amber only where they mean something |
| Outlined `Icon*` pixel icons, `lucide-react` icons | Flat `<MeadowIcon name=... />` (also pixel art, but flat and bright) |
| Text-heavy buttons with pixel font | `PrimaryButton` (leaf, white text, 4px lip), `SecondaryButton`, `DangerButton`, `RoundButton` circles |

**Keep:** the room paintings, Eren's sprites and animations, game boards and scenery, prestige plates
(`trophies/Nameplate.tsx`, `trophies/prestigeArt.tsx` are bought art and stay pixel on purpose), and any
art the owner says he likes ("keep these little cat animations"). Only the chrome around them changes:
panels, buttons, labels, bars, popups, sheets.

## How a conversion is done (the rules that came out of ~30 converted screens)

1. **Read a converted screen that looks like yours first** (table below) and reuse its parts.
2. **Use kit components**, never re-draw a button/card/sheet inline. The barrel
   (`src/components/meadow/index.ts`) exports, among others:
   `MeadowPage, Card, SectionLabel, Divider, PrimaryButton, SecondaryButton, DangerButton, TextButton,
   RoundButton, BackButton, Chip, Tag, CheckDisc, Swatch, Segmented, Toggle, TextField, OptionRow,
   ListGroup, ListRow, IconTile, Meter, LevelRing, CoinChip, StatTile, Avatar, Stage, SpeechBubble, Sheet,
   useSheetExit, MeadowIcon` and the tokens `M, GROUND, TINT, RADIUS, LIP, TYPE, FONT_ROUNDED, RARITY_TAG,
   PERSON, personColor, MOOD_STYLE, NAV_PAGE_PADDING, HEADER_CLEARANCE, ROOM_HEADER_CLEARANCE`.
   Read the prop types in the kit files; they are commented.
3. **The font root.** `MeadowPage` and `Sheet` set the Meadow font for you. ANY other Meadow surface
   (a popup, an overlay, a HUD over room art, anything portalled) needs `className="meadow-root"` on its
   root, or it inherits the old pixel font. Only weights **500, 700 and 800** of the rounded font are loaded;
   don't use 400/600/900.
4. **A full page** = `<MeadowPage ground=... title=... back={{ onClick, label }} withNav={false}>`, first
   `Card` at `marginTop: 18`, groups under `<SectionLabel>`. The page plumbing converted pages keep:
   - `usePageReady(ready)` (`@/hooks/usePageReady`) drops the splash screen once the page can render;
   - `setHideStats(true)` from `useCare()` on mount (false on unmount) hides the floating stats bar;
   - pages a push notification can open exit with `router.replace('/home')` (or the parent route), never
     `router.back()` (no history -> the back button looks dead).
5. **Something that slides up** = `<Sheet open onClose title footer={<PrimaryButton/>}>`. The primary
   action goes in `footer` so it stays pinned while the body scrolls.
6. **A popup / celebration card** = `className="meadow-root"`, scrim `rgba(47,43,40,.36)` over the screen,
   a white card `borderRadius: 28`, `maxWidth: 340`, `padding ~20`, a tinted art panel (`TINT.*`,
   radius 22) at the top, a 12px `TYPE.label` eyebrow, a 22/800 title, 15/500 body in `M.text2`, then
   `PrimaryButton` and a `TextButton`. See `src/components/bucket/TickCelebration.tsx`,
   `src/components/couple/GiftArrival.tsx`.
7. **White pieces on top of room art** (home row, room controls): `background: '#FFFFFF'`, no border,
   `boxShadow: 0 3px 0 ${M.overArtLip}`, pills `borderRadius: 999`; or `RoundButton surface="art"`.
   Offsets under the stats bar are measured from the safe area:
   `top: calc(var(--safe-top) + ${HEADER_CLEARANCE}px)` on home, `ROOM_HEADER_CLEARANCE` in care rooms.
8. **Colour means something:** leaf = go / done / selected, `M.energy` = the one low need, `M.coin` = money
   and achievements, `M.love` = hearts and unread. Who did something = `personColor(profile.heart)`
   (brown = the owner, pink = his partner, gold = Eren for a household of one).
   Rarity = `<Tag tone="rare">` / `RARITY_TAG`.
9. **Numbers** `...TYPE.number` (800, tabular). Fixed px font sizes only, never Tailwind `text-*`.
10. **Icons:** `MeadowIcon` only, **never emoji** and no new `lucide-react` icons. A missing icon gets
    added to `MEADOW_ICONS` in `src/components/PixelIcons.tsx`: grid strings (most are 12x12), 1-3 flat
    colours, no outline, `X` = the main ink that the `color` prop recolours, lower-case letters = fixed
    accents. Read the comment above `MEADOW_ICONS` first.
11. **Animations:** `@keyframes` in a scoped `<style jsx>` are renamed by styled-jsx and silently never run
    from an inline `animation:` style. Put keyframes in a plain `<style>{`...`}</style>` (see
    `GameChrome.tsx`, `NotifyNudge.tsx`) or `globals.css`. Always add a `prefers-reduced-motion` opt-out.
12. **Sounds:** converted screens keep the app's taps: `playSound('ui_tap' | 'ui_back' | 'ui_modal_open'
    | 'ui_modal_close')` from `@/lib/sounds` on buttons, sheets opening and closing.
13. **Widths:** every screen must work at **390 and 360 px** wide with no sideways scroll. Things that fit
    at 390 often overflow at 360 (long titles: `nowrap` + ellipsis or let them wrap; rows of pills: tiles).
14. **Copy:** plain words from the player's side ("Add a plan", "Tick it off", "Not now"). The cat's name
    and pronouns are templates (`useCat().t('{name} hung it on the wall')`); never hard-code "Eren" in
    player-facing copy, because a household may have renamed its cat.

## Reference screens (already Meadow, copy from these)

| Kind of screen | Look at |
|---|---|
| Full page with progress card + grouped lists | `src/components/bucket/BucketListView.tsx`, `src/app/(app)/hallway/page.tsx` |
| Shop with shelves, price buttons, buy confirm | `src/app/(app)/trophies/page.tsx`, `src/components/trophies/TrophyShopView.tsx`, `TrophyBuySheet.tsx` |
| Add / edit form in a sheet | `src/components/bucket/PlanSheet.tsx` |
| Detail sheet with actions + confirm-delete | `src/components/bucket/PlanDetailSheet.tsx`, `src/components/memory/MemoryDetailSheet.tsx` |
| Celebration / reward popup | `src/components/bucket/TickCelebration.tsx`, `src/components/couple/GiftArrival.tsx` |
| Minigame start screen, HUD stats, result screen | `src/components/games/GameChrome.tsx` (used by all 13 games) |
| White controls over room art | `src/components/home/HomeHud.tsx`, `src/components/kitchen/KitchenSheet.tsx` |
| Slim banner over home | `src/components/home/NotifyNudge.tsx` |
| Chat screen | `src/components/talk/TalkView.tsx` |
| Lab lesson and review sessions | `src/components/chemistry/SessionRunner.tsx` |
| Periodic table and element sheet | `src/components/chemistry/PeriodicTable.tsx`, `ElementDetail.tsx` |
| Machine / workbench panel | `src/components/weather/WeatherMachine.tsx` |

**Still old (fair game when he asks):** the Lab's five remaining study modes (Cards/Quiz/Match/
Speed/Locate: a neo-brutal theme from `lib/chemistry/theme` with `lucide-react` icons), the playroom banner and energy bar
(`care/PlayScene.tsx`). To find old chrome:
`grep -rlE "font-pixel|Press Start 2P|lucide-react|neoShadow" src`, then judge each hit: chrome gets
converted, art (game boards, prestige plates, room props) stays.

## How we work (the owner's rule since 2026-10-13)

1. He sends a screenshot of ONE old screen + "new design". Convert **that screen only**. Keep its features,
   data and the art/animations he likes. No drive-by changes elsewhere.
2. `npx tsc --noEmit` clean.
3. **Commit locally, do NOT push yet.**
4. **Take screenshots** at 390x844 and 360x740 of every state you changed (empty, filled, open sheet,
   error) into `review-pictures/` (git-ignored). Tell him the file paths.
5. Wait for him to say **"push"**. (Bug fixes and non-visual work: push right away.)
6. If the feature needs a new table/column: write `supabase/migration_<topic>.sql` and ask him to paste
   it into the Supabase SQL editor (project `bjnnqqxjjihmsbljeayf`) before pushing; make the code work
   while the table is missing.

### Screenshots without logging in

The `(app)` routes need a session, so previews render the screen from a throwaway route **outside**
`(app)` and fake the backend inside the browser. Run the preview from a separate git worktree: a second
`next dev` in this folder shares `.next` with the one already running and breaks it.

1. **Commit first** (step 3 above), so the worktree has your change. Then, from the repo root
   (PowerShell):
   ```powershell
   git worktree add --detach $env:TEMP\eren-preview HEAD
   Copy-Item .env.local $env:TEMP\eren-preview\.env.local
   New-Item -ItemType Junction -Path $env:TEMP\eren-preview\node_modules -Target (Resolve-Path node_modules)
   ```
   and start `npx next dev -p 3100` inside `$env:TEMP\eren-preview` (in the background).
2. In the worktree only, add `src/app/<name>preview/page.tsx`: a `'use client'` page that wraps your
   screen in the same providers, in the same order, as `src/app/(app)/layout.tsx` (Theme, Care, Task,
   ErenStats, Couple, Trophies, TrophyEffects, DailyBattle, Wish, NavVisibility) and renders only after
   mount. Never commit it.
3. `scripts/preview/shoot.cjs` takes the pictures. It needs `puppeteer-core`, which is not a project
   dependency: `npm i --no-save puppeteer-core` if `node -e "require('puppeteer-core')"` fails (any
   `npm install` removes it again). It uses Chrome at the default Windows path; set `CHROME_PATH`
   otherwise. Edit `PREVIEW_PATH`, `MOCK_ROWS` and `RUNS` for your screen, then run it **from the main
   checkout** (`node scripts/preview/shoot.cjs`) so the PNGs land in this repo's `review-pictures/`.
   It plants a fake session, answers every `*.supabase.co` request from `MOCK_ROWS`, blocks realtime,
   answers `/api/*` locally (nothing reaches the real project or sends a push) and drops the splash.
   Known quirks: the dev overlay shows a GoTrue "Lock broken" error (the fake session; ignore it), and
   RPC calls get an empty reply, so a screen that needs an RPC result needs it mocked.
4. **Cleanup, in this order** (the junction must go before the worktree, or removing the worktree
   deletes the real `node_modules` through it):
   ```powershell
   # stop the dev server on port 3100 first
   cmd /c rmdir $env:TEMP\eren-preview\node_modules
   git worktree remove --force $env:TEMP\eren-preview
   ```
