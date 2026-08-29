# -*- coding: utf-8 -*-
"""Build the mask that says which of the window is actually WINDOW.

Weather and condensation belong to the glass. The trouble is that the glass
rectangle is not all glass: the till's display, two sauce bottles, the salt and
pepper and the napkin stack all stand on the serving ledge in FRONT of it, and
their tops poke up over the sill into the rectangle. Anything drawn across the
whole rectangle sits on top of them, and a shaker under a sheet of fog reads as
a shaker with a grey box on it.

Finding them: every object in this art is drawn with a near-black outline, and
each rises from the ledge, so scanning DOWN a column and stopping at the first
solid dark edge finds the top of whatever is standing there. Two things stop
that from working on its own, both learned the hard way:

  * a flood fill of the street leaks into the pepper shaker and the till's
    display through gaps in their outlines, and cannot be used;
  * scanning the whole width finds "edges" in the dark shopfront across the
    road, which is street, and hangs spikes off the napkins.

So each object gets its own window to be found in. The windows are wide and
the floors are generous -- they only have to be tighter than the street's own
dark patches, not tight around the object.

Output: an RGBA image the exact size of the GLASS rect, opaque over the street
and transparent over the counter and its clutter.
"""
from PIL import Image, ImageFilter
import numpy as np
import os

ART = r"c:\Users\Lenovo\OneDrive\Desktop\WEBSITES\ERENapp\public\InsideOfKiosk.webp"
OUT = r"c:\Users\Lenovo\OneDrive\Desktop\WEBSITES\ERENapp\public"
PREVIEW = r"C:\Users\Lenovo\AppData\Local\Temp\claude\maskcheck.png"

# The GLASS rect, in art pixels. Must stay in step with GLASS in kioskShift.ts.
X0, X1 = 129, 644
Y0, Y1 = 391, 905

DARK = 42     # near-black outline
RUN_V = 3     # rows of dark to count as an edge; a pavement crack is thinner
RUN_H = 4     # and how far it has to carry sideways

# Everything that stands on the ledge and breaks the sill line, with the window
# it is looked for in: x range, and how high above the ledge to bother looking.
STANDING = [
    ('bottle, left',  134, 176, 818),
    ('till display',  170, 230, 848),
    ('bottle, right', 232, 274, 842),
    ('salt',          462, 510, 872),
    ('pepper',        512, 558, 872),
    ('napkins',       558, 646, 872),
]
# Objects are wider than the outline the scan can see, and a mask that stops a
# pixel SHORT leaves a hairline of clear glass nobody will ever notice, while a
# mask that overruns puts fog back on the shaker. So bias both ways: outward in
# x, upward in y.
PAD_X = 3
PAD_Y = 2

im = Image.open(ART).convert("RGB")
a = np.asarray(im).astype(int)
lum = a.sum(axis=2) / 3.0
dark = lum < DARK
wide = dark.copy()
for k in range(1, RUN_H):
    wide[:, :-k] &= dark[:, k:]


def top_edge(x, floor):
    """First solid dark edge in this column, or None."""
    for y in range(floor, Y1 - RUN_V):
        if wide[y:y + RUN_V, x].all():
            return y
    return None


# Start with the sill: with nothing in the way, the glass runs to it.
sky = np.full(X1 - X0, Y1 - 1, dtype=float)

for name, x0, x1, floor in STANDING:
    hits = [(x, top_edge(x, floor)) for x in range(x0, min(x1, X1))]
    hits = [(x, y) for x, y in hits if y is not None]
    if not hits:
        print('  !! nothing found for', name)
        continue
    lo, hi = hits[0][0], hits[-1][0]
    xs = np.array([h[0] for h in hits], dtype=float)
    ys = np.array([h[1] for h in hits], dtype=float)
    # Straight across the gaps: the detector only fires where the outline
    # happens to be three rows thick, and the silhouette between two hits a
    # few pixels apart is a straight line to within a pixel.
    for x in range(max(X0, lo - PAD_X), min(X1, hi + PAD_X + 1)):
        y = float(np.interp(x, xs, ys)) - PAD_Y
        sky[x - X0] = min(sky[x - X0], y)
    print('  %-14s x %d..%d   top %d..%d' % (name, lo, hi, ys.min(), ys.max()))

# ── paint it ──────────────────────────────────────────────────────────────
w, h = X1 - X0, Y1 - Y0
alpha = np.zeros((h, w), dtype=np.uint8)
for x in range(w):
    bottom = int(round(min(h - 1, sky[x] - Y0)))
    if bottom >= 0:
        alpha[:bottom + 1, x] = 255
alpha_im = Image.fromarray(alpha, 'L')
# A one-pixel step between columns is a staircase you can see in a gradient.
alpha_im = alpha_im.filter(ImageFilter.GaussianBlur(0.7))

mask = Image.merge('RGBA', (
    Image.new('L', (w, h), 255), Image.new('L', (w, h), 255),
    Image.new('L', (w, h), 255), alpha_im))
mask.save(os.path.join(OUT, 'kiosk_glass_mask.webp'), 'WEBP', lossless=True)
print('mask', mask.size, '->', os.path.join(OUT, 'kiosk_glass_mask.webp'))

prev_im = im.crop((X0, Y0, X1, Y1)).convert('RGBA')
tint = Image.new('RGBA', (w, h), (80, 150, 255, 95))
prev_im = Image.alpha_composite(prev_im, Image.composite(
    tint, Image.new('RGBA', (w, h), (0, 0, 0, 0)), alpha_im))
prev_im.resize((w * 2, h * 2), Image.NEAREST).save(PREVIEW)
print('preview written')
