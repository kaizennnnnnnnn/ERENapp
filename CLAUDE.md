# Eren — project guide

Pixel-art cat-care PWA for a two-person household. Built to look and feel like a retro handheld game.

## Stack

- **Next.js 14 App Router** + TypeScript strict
- **Supabase** — auth, Postgres, realtime, pg_cron. Migrations are run manually in the SQL editor.
- **Tailwind CSS** via `tailwind.config.ts` (NOT the CDN), custom `font-pixel` = Press Start 2P
- **Web Push** via `web-push` for notifications when the app is closed
- **Vercel Hobby** — hourly cron is NOT available; Supabase pg_cron hits `/api/decay` instead.

## Directory map

```
src/
  app/(app)/            Authenticated routes (home, games, couple, profile, gacha, rewards)
  app/api/decay/        Stat decay + push-notification cron target
  app/api/notify-stats/ On-demand threshold push
  components/
    PixelIcons.tsx      Single source of truth for pixel icons (12×12 grid)
    AnimatedEren.tsx    Canvas sprite used on every loading screen
    StatsHeader.tsx     Top bar: level badge, XP bar, coins, mini-stats
    care/
      CareSceneHost.tsx Swipe-between-rooms orchestrator + loader
      FeedScene.tsx ... Full-screen room overlays
  hooks/useErenStats.ts Client-side stat decay + realtime sync
  contexts/TaskContext  XP / level / coins / quest state
  lib/levelRewards.ts   100-level reward road data
  lib/statNotifications Client-side threshold check (SW notifications)
  lib/serverPush.ts     web-push wrapper + getStatNotifications
supabase/migration_*.sql  Run once in the dashboard. Don't re-apply.
```

## Visual conventions — enforce them

- **No emojis in the UI.** Ever. Always use `<Icon*/>` from [PixelIcons.tsx](src/components/PixelIcons.tsx). If the icon you need doesn't exist there, add one to that file — don't drop in an emoji as a shortcut.
- **Pixel icons are 12×12** cells drawn via `drawPixels(grid, palette, size)`. Keep palettes ≤ 6 colors. Silhouette matters more than detail at 14–20px display size.
- **Font**: `font-pixel` for UI labels (sizes 5–10px), system sans for body copy (10–14px). Use fixed pixel sizes, not Tailwind's `text-*` scale.
- **Surfaces**: 2–3px borders, hard drop shadows (`box-shadow: 3px 3px 0 <color>`, **no blur**), optional gold rivet pixels at inner corners for "premium" cards. See existing HUDs in `StatsHeader`, reward road nodes, game headers.
- **Dark "game panel" style** (leaderboards, rewards, memory game): dark purple gradient, CRT scanlines via `repeating-linear-gradient`, gold corner pixels, soft color glow via `box-shadow` with spread.
- **Animation**: snap/step keyframes, not smooth fades. A water drop landing should disappear in a 1% keyframe window, not cross-fade. Use `cubic-bezier` for gravity.

## Key gotchas — don't relearn these

- **Stat decay is client-side** ([useErenStats.ts](src/hooks/useErenStats.ts)). Every action rewrites `last_decay_at = NOW` on purpose — active care doesn't get punished. The 2-min interval + visibilitychange + /api/decay ping is the complete story. Don't reintroduce decay in render loops.
- **Push notification cooldown is DB-backed** — `eren_stats.last_notified_at` jsonb, 2h per-tag window. Without it, `getStatNotifications`'s transition logic re-fires every time a boundary stat wobbles across 50/10.
- **Unread message counts** compare `new Date(x).getTime()` numbers, not strings. ISO/Supabase format drift breaks lexicographic compare. `markAllRead` stamps +1s into the future and dispatches a `eren:journal-read` window event so sibling hook instances recount.
- **Vercel crons are blocked on Hobby** — don't re-add `crons` to `vercel.json`. Decay runs via Supabase pg_cron, and the client ping on tab focus is the safety net.
- **Realtime channels** need a unique suffix per mount (`channelSuffix`). Duplicate channel names silently fail to subscribe.
- **Migrations are manual**: when you add a column, drop a `supabase/migration_<topic>.sql` and tell the user to paste it into the Supabase dashboard. Don't run DDL from app code.

## Workflow

1. **Typecheck after every code change**: `npx tsc --noEmit` must be clean before committing.
2. **Verify before done**: trace the end-to-end flow, not just the diff. For UI, check the layout against the user's reference image. Ask yourself "would a staff engineer approve this?"
3. **Autonomous bug fixing**: when the user reports a bug, diagnose → fix → commit. Don't ask for hand-holding unless you're genuinely stuck.
4. **Demand elegance on non-trivial changes**: pause and ask "is there a cleaner way?" Don't over-engineer simple fixes — three similar lines beats a premature abstraction.
5. **Minimal impact**: touch only what's necessary. No drive-by refactors, no "while I'm in here" bonus work.
6. **Use the memory system** (`memory/MEMORY.md` + per-topic files) for things that will matter next session. Use `TodoWrite` inside a session — not `tasks/todo.md`.

## Git

- One logical change per commit. Commit message summarizes **why**, not just what.
- Never push unless asked. The user drives pushes.
- `LF → CRLF` warnings on Windows are expected — ignore.

## Core principles

- **Simplicity first** — find the smallest change that solves the problem.
- **No laziness** — root causes, not band-aids. If a fix feels hacky, pause and rework it.
- **No emojis** in code or UI unless the user explicitly asks for them.
- **Trust framework guarantees** — don't add defensive checks for cases that can't happen. Only validate at boundaries (user input, external APIs).
- **Test against the actual repro**, not just adjacent code.
