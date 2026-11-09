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

The branded startup splash is separate from page loading. The original
animated Eren, title and dots were restored at the owner's request after the
skeleton rollout. It plays once per app boot, retains ready/busy claims and
its eight-second safety exit, and has the original 1.2-second opening beat and
400ms fade. Public legal documents still skip it, and navigating within the
app does not replay it. The premium presentation update keeps that behavior:
larger original sprite, rounded Meadow wordmark, charcoal ground, leaf-green
indeterminate loading bar, and no purple glow. It shows no invented percentage
or extra loading delay. Reduced motion keeps the sprite still and disables
the entrance and loading-bar animations. All skeletons share a
two-second left-to-right shimmer through the grey shapes (updated at the
owner's request on 2026-11-09). A clipped, non-interactive pseudo-element moves
without resizing the placeholders. The kiosk uses a softer highlight. Shimmer
is disabled with prefers-reduced-motion. Placeholders are
hidden from accessibility, with one loading status per skeleton and no fake
interactive controls. Existing errors are not replaced by skeletons.

Validation:
- `node scripts/check_loading_skeletons.cjs`: all 42 destinations, 23 layouts,
  exact board cell counts, eleven branded-boot lifecycle/render cases including
  minimum/late readiness, duplicate signals, StrictMode replay and timer cleanup,
  and source checks for cached-data/error guards.
- `node scripts/check_artwork_skeleton.cjs`: image load/error/cache/URL-change
  and unmount behavior against the actual component effects.
- `node scripts/check_boot_sprite.cjs`: unchanged default animation for other
  callers, larger glow-free startup, static reduced-motion pose and cleanup.
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

Startup restoration review: the actual SplashScreen was rendered in the local
preview at 390x844 and 360x740. Both captures show the original animated Eren,
title and dots; after readiness the splash was removed and the page skeleton
remained. Screenshots are `startup-restored-{390,360}.jpg` and
`startup-handoff-{390,360}.jpg` in the same ignored review directory. The local
replay is `/skin-lab/loading?boot=1`. No production debug route was added.

Premium review: `startup-premium-390.jpg` and `startup-premium-360.jpg` show the
larger original sprite, 34px rounded wordmark and green loading bar. Browser
checks confirmed the 150x120 mascot stage, 120px progress track, Meadow font,
and no horizontal overflow at 360px. A normal ready signal removed the splash
and left page skeletons intact (`startup-premium-handoff-360.jpg`). The old
startup restoration is published; this presentation update remains local for
owner review.

Positioning follow-up: home now uses the actual living-room stage boundary
(`NAV_HEIGHT`), the compact header at safe-top + 6px, the shortcut row at
`HEADER_CLEARANCE`, the 200px cat anchor 10% above the stage floor, and the
four 44px place buttons in their 70px dock. Its placeholder no longer borrows
the enlarged care-room needs row or invents unrelated furniture blocks.
The visible cat shape clears the dock and the five-tab bar has its own slot.

Back-button pages now reserve their separate back row and title row; only the
four tab pages reserve bottom-nav padding. Profile uses the two real household
seats and a 2x2 stat grid. The inline closet loader no longer repeats visible
tabs, and collection shelves use the real three-column item layout.
`check_loading_positions.cjs` checks these source/layout contracts. The isolated
home comparison is `/skin-lab/loading?home=1&skin=classic`.

Position review at 390x844 and 360x740 measured the real home and loader in
the same isolated preview: stage, cat bottom, place-dock rectangle and tab-bar
rectangle match. The visible cat placeholder clears the place dock at both
sizes. The HUD starts at the same 64px anchor. Pure loading captures for home,
profile, settings, closet and collection had no sideways overflow; the body
begins at 118px on tab pages and 164px after a back-button/title header.
Pictures are `position-*-{390,360}.jpg` plus
`home-position-{loading,loaded}-{390,360}.jpg` in the ignored review directory.
The comparison toggle is preview-only, and this adjustment does not change
the startup splash, artwork, rewards or saved player data.
