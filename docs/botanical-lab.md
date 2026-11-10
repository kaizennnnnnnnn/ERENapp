# Botanical Lab

The owner selected concept 1 on 2026-11-10. The original selected day pixels are
preserved in `public/lab-botanical-day.png`. Its matching night painting is
`public/lab-botanical-night.png`, made with the built-in image generation tool.
Both are 941x1672. No characters, controls or interactive props are baked in.

Night edit prompt: keep the exact camera, architecture, arched window, mullions,
plants, cabinets, scientific equipment and empty foreground; change only the
lighting and outdoor view. Use a dark blue sky and a few tiny stars, the existing
pendant's warm amber light, cool edge shadows, recognizable sage cabinetry and
coral rug. Keep crisp pixel clusters and readable details; add no characters,
objects, UI, text, fog or decorative glow blobs.

## Integration

- `roomArt` supplies the new pair to the lab, room loader and outfit previews.
- The existing cat, weather machine, potion mixer and study controls stay put.
- The existing light-switch glow now begins at the painted pendant (17%).
- Window aperture: source pixels `(319,359)` through `(616,668)`, expressed as
  exact artwork fractions to avoid a subpixel gap at the cut edge. Existing
  frame compilation retains the arched wood, crossbars, flowers and leaves.
  Four pixels of unchanged source-art padding hide transparent-edge resampling
  so the weather wash cannot leave a thin rectangle on the wall.
- Only chemistry gets new frame filenames/version. Original ChemistryDay/Night
  images and original weather frames remain available to older open clients.
- The service worker retains image cache epoch `a1`, swaps the two lab paintings
  and additionally precaches their two matching frames. Existing cached rooms
  are not discarded. No database/schema/player-data changes.

`scripts/window_seeds.json` is the compiler input; `roomWindows.ts` is generated.
Optional `frameName` and `assetVersion` scope repaints without invalidating the
other rooms. Use `build_window_frames.py` with `--out` and `--shots` aimed at a
review directory when compiling all rooms, then copy only the intended frame
outputs into `public/weather`.

## Verification

- `py -3.12 scripts/check_botanical_lab.py`: selected day-pixel hash, matching
  canvas sizes, transparent glass in all four panes, exact preserved frame,
  flowers/foliage samples, scoped alpha bounds and cache versions.
- `node scripts/check_image_cache.cjs`: existing cache behavior plus all four
  new lab assets available offline; precache concurrency stays capped at four.
- Chemistry-session, room-swipe and loading regression checks; TypeScript.
- Isolated Playwright review at 390x844 and 360x740: day/night, collapsed and
  expanded quests, rain/aurora, working study overlay and night light switch.
  No hosted backend requests or player changes. Screenshots are in the ignored
  `review-pictures/lab-botanical-2026-11-10` directory.
