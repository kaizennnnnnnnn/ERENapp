# Creature Costumes Sources

The thirteen costume sources, stored as lossless WebP without resizing or
recoloring. The first eight concepts remain in the workspace's
`outputs/animal-gacha-machines/` design collection. The next five are documented
in `batch-2026-10-25.md`.

Run `node scripts/build_skins.cjs creatures` to rebuild only this set. The
pipeline needs `puppeteer-core` and Chrome (`CHROME_PATH` can override its path).
It preserves the existing manifest entries for every other skin. New native-alpha
sources are normalized before the legacy white-fringe cleanup so the white paws
and muzzle stay opaque.

Rare: Bee, Snail, Turtle, Ladybug, Capybara.
Epic: Lobster, Butterfly, Octopus, Red Panda, Jellyfish.
Legendary: Crystal Dragon, Peacock, Unicorn.
