# Creature Costumes Sources

The eight approved concept images, stored as lossless WebP without resizing or
recoloring. Originals and their generation prompts remain in the workspace's
`outputs/animal-gacha-machines/` design collection.

Run `node scripts/build_skins.cjs creatures` to rebuild only this set. The
pipeline needs `puppeteer-core` and Chrome (`CHROME_PATH` can override its path).
It preserves the existing manifest entries for every other skin. New native-alpha
sources are normalized before the legacy white-fringe cleanup so the white paws
and muzzle stay opaque.

Rare: Bee, Snail, Turtle.
Epic: Lobster, Butterfly, Octopus.
Legendary: Crystal Dragon, Peacock.
