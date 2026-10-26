# Bee Wing Correction

Updated with built-in image generation on 2026-10-25, then converted losslessly
to `bee.webp`. The corrected wing remains on the foreground body, and the
animated tail stays behind it. The extraction search starts above the complete
tail tip (`tailYStart: 0.62`); its neutral-colour mask excludes the blue wing.
The former 0.67 cutoff split the tip horizontally, leaving a static gray stub.
Neutral outline recovery keeps blue wing edges off the tail layer, and the
body connector begins at the hip (78% height), never at the free tail tip.

Ladybug uses the same scoped extraction guards, starting the search at 66%
height and allowing a body connector only below 82%. Its original 71% cutoff
also left part of the tip on the body. The full source sprites, thumbnails,
eyes and other skins are unchanged. Rebuild only `bee,ladybug`, then run
`python scripts/check_tail_tips.py` (Pillow required).

## Edit Prompt

Use case: precise-object-edit. Edit target: the supplied pixel-art Bee Eren game
sprite. Fix ONLY the layering where the gray tail overlaps the pale blue
right-hand wing (viewer right). Reconstruct that right wing as a complete, clean
pale-blue butterfly/bee wing matching the left wing's size, shape and pixel
shading, in FRONT of the tail. Lower the visible top of the gray tail so it
starts below the bottom of the right wing and curves alongside the lower body,
clearly behind the costume, without crossing or cutting into either wing. Keep
the exact same front-facing seated ragdoll cat identity, blue eyes, face, smile,
honeycomb pendant, yellow-black bee suit, antennae, legs, paws, colors, large
square pixel-art cells, thick pixel outline, pose and framing. This is a surgical
game-asset correction, not a new design. Full entire sprite on a genuinely
transparent background, no floor, no scenery, no shadows outside the sprite,
no text, no white sticker halo. Keep all details other than the right wing/tail
junction unchanged.
