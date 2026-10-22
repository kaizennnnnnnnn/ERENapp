# Eren: guide for coding agents (Codex and others)

Eren is a cat-care PWA for a two-person household (Next.js 14 App Router + TypeScript strict, Supabase,
deployed to Vercel from `master`). The app is called **Eren**, never "Pocket Eren".

**Read `CLAUDE.md` too.** It was written for Claude Code, but its stack notes, directory map and "Key
gotchas" apply to you as well. Where it disagrees with this file, this file wins:
- its "Visual conventions" pixel/dark rules describe the OLD screens; for anything visual, `docs/MEADOW.md` wins;
- its "Never push unless asked" is older than the owner's current rule (below);
- its `memory/MEMORY.md` system is Claude's private notes, not in the repo; ignore it.

## "New design" means Meadow

When the owner says **"new design"** / **"implement new design"** / **"this too"** with a screenshot, he
means: convert that one screen to the **Meadow** look with the kit in `src/components/meadow`.
**Read `docs/MEADOW.md` before touching any UI.** It has the old-vs-new table, the conversion rules, the
already-converted screens to copy from, and how to take preview screenshots.

In one line: light grounds and white rounded cards, leaf-green buttons with a hard lip, rounded sans
text in sentence case, `MeadowIcon` pixel icons, no dark panels, no `font-pixel` labels, no emoji. Keep
the room paintings, the cat sprites and any animation he likes.

## The owner's rules

- **Visual changes: show pictures before pushing.** Screenshot every changed state at 390 and 360 px wide
  into `review-pictures/` (never committed), commit locally, tell him where the pictures are, and push
  only after he says "push".
- **Bug fixes and non-visual work:** commit and push when done.
- **He doesn't read React/TypeScript.** Explain what changed in plain words: what he will see, what he
  has to do.
- **Database changes are manual.** New table/column -> `supabase/migration_<topic>.sql`, ask him to paste
  it into the Supabase SQL editor (project `bjnnqqxjjihmsbljeayf`), and keep the code working while the
  table is missing. Never run DDL from app code.
- **No emoji** in UI or code. Icons come from `src/components/PixelIcons.tsx` (`MeadowIcon`).
- `npx tsc --noEmit` must be clean before every commit.

## Working next to Claude Code sessions

Claude Code works on this same repo, sometimes at the same time as you.

- Before you start and before you push: `git pull --rebase --autostash origin master` (the tree almost
  always has modified files, and a plain rebase refuses to run). After a rebase, run `npx tsc --noEmit`
  again.
- **Before pushing, run `git log origin/master..master`.** Pushing `master` pushes every local commit on
  it, and a Claude session may have left one there that is waiting for the owner's "push". If you see a
  commit that isn't yours, stop and ask him.
- **Stage only your own files, by path** (`git add path/one path/two`). Never `git add -A`, `git add .` or
  `git commit -a`: the working tree is full of untracked scratch files (images, scripts) that belong to
  nobody's commit, and the index may hold another session's staged work.
- Don't edit, revert or "clean up" files you didn't change for your task.
- Don't run a second `next dev` in this folder while another one is running (they share `.next` and
  break each other). Use a git worktree on port 3100 for previews, as `docs/MEADOW.md` describes.
