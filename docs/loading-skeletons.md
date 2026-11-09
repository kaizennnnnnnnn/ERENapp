# Layout-aware loading

Implemented 2026-11-09. No database change or artificial loading delay.

`src/components/loading/LoadingSkeleton.tsx` is pure server-renderable markup.
Each of the 42 page directories has a `loading.tsx` with an explicit destination
path; it does not guess the destination from the previous page's pathname.
Layouts cover rooms, boards, arcade, shops, lists, profile, couple, settings,
collections, photos, chat and forms. The kiosk keeps its dark Meadow surfaces.

Client data fallbacks also use this kit: home/notes through PageLoader, account
pages, closet, collection, memories, reminders, hallway, bucket list, trophies,
rewards, Jelly tray, chat and scores. CareSceneHost uses the room layout while
its existing chunk/image decode gate is pending. Its offline/retry panel stays.

ArtworkSkeleton watches the existing gacha, bakery and kiosk image URLs, so
CSS backgrounds do not leave a blank stage after the route chunk has mounted.
The overlay cannot intercept shop controls. It settles on image error as well
as load, cancels stale callbacks and adds no minimum delay to cached images.
It does not change artwork or add image downloads with new cache keys.

The boot splash uses the destination skeleton, retains ready/busy claims and
its eight-second safety exit, and no longer forces a 1.2-second minimum.
The fade is 180ms and has a reduced-motion opt-out. All skeleton motion is an
opacity-only pulse, disabled with prefers-reduced-motion. Placeholders are
hidden from accessibility, with one loading status per skeleton and no fake
interactive controls. Existing errors are not replaced by skeletons.

Validation:
- `node scripts/check_loading_skeletons.cjs`: all 42 destinations, 21 layouts,
  exact board cell counts, boot ready/busy/unclaimed/safety/fade/unmount paths,
  and source checks for cached-data/error guards.
- `node scripts/check_artwork_skeleton.cjs`: image load/error/cache/URL-change
  and unmount behavior against the actual component effects.
- `npx tsc --noEmit` and production build (dummy public Supabase build settings;
  no local `.env.local` was present, and no live login was tested).

Browser review used the real shared components in the isolated local preview
at 390x844 and 360x740. All 24 gallery destinations plus kitchen, bedroom and
bathroom room layouts passed horizontal-overflow checks, with one loading
status each. Screenshots are in the ignored directory
`review-pictures/loading-2026-11-09/` (54 skeleton captures, a loaded gacha and
the gallery). A loaded gacha had no remaining skeletons, all four original
backgrounds, enabled pull controls and no browser console errors. No pull or
other hosted write was triggered. The viewport override was reset afterward.

The gallery is `/skin-lab/loading` on the local preview server, not a production
debug route. This is component/preview evidence, not a live signed-in navigation
or network-throttling test. Owner approval is still needed for a visual push.
Skeletons improve feedback, not the underlying database or network latency.
