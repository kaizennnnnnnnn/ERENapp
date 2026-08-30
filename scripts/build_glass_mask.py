# -*- coding: utf-8 -*-
"""Build the mask that says which of the window is actually WINDOW.

Weather and condensation belong to the glass. The trouble is that the glass
rectangle is not all glass: two sauce bottles, the till's display, the salt and
pepper and the napkin stack all stand on the serving ledge in FRONT of it, and
their tops break the sill line into the rectangle. Anything drawn across the
whole rectangle sits on top of them, and a shaker under a sheet of fog reads as
a shaker with a grey box on it.

The silhouettes below are TRACED off the art by hand, read at 8x against a
labelled pixel grid. That is deliberate. Three detectors were tried first and
each one shipped a mask that was visibly wrong somewhere:

  * flood-filling the street leaks into the pepper shaker and the till display
    through gaps in their outlines, and swallows both;
  * "first near-black run down the column" walks straight through the shakers'
    light grey caps and stops at the cap/body seam, ~5px low -- which is the
    version that shipped and put rain on the caps;
  * comparing each column against the street's own colour finds the road's
    cracks and seams, because a crack is a bigger step than a soft edge.

The art is static and there are six things on the ledge. Tracing them takes
minutes and cannot be wrong in a way nobody notices.

Each entry is the TOP profile: (x, y) control points along the object's upper
outline, straight-line interpolated between them. Everything below the profile
is already off the glass, so only the top edge has to be right.

Output: an RGBA image the exact size of the GLASS rect, opaque over the street
and transparent over the counter and its clutter.
"""
from PIL import Image, ImageFilter
import numpy as np
import os

ART = os.path.join(os.path.dirname(__file__), '..', 'public', 'InsideOfKiosk.webp')
OUT = os.path.join(os.path.dirname(__file__), '..', 'public')

# The GLASS rect, in art pixels. Must stay in step with GLASS in kioskShift.ts.
X0, X1 = 129, 644
Y0, Y1 = 391, 905

STANDING = [
    # the tall sauce bottle, with its narrow cap
    ('bottle, left', [(136, 862), (139, 859), (143, 853), (147, 848), (151, 843),
                      (153, 836), (154, 830), (163, 830), (165, 837), (168, 845),
                      (171, 851), (174, 857), (176, 862)]),
    # the till, and the little stalk that pokes up behind its screen
    ('till display', [(167, 868), (233, 868)]),
    ('till stalk',   [(196, 855), (208, 855)]),
    # the squat bottle, pointed
    ('bottle, right', [(234, 890), (236, 880), (239, 872), (243, 865), (247, 859),
                       (249, 856), (254, 856), (257, 860), (261, 865), (265, 872),
                       (268, 880), (271, 890)]),
    # the shakers: a flat cap between two sloped shoulders
    ('salt',   [(458, 900), (461, 894), (464, 891), (467, 888), (470, 886),
                (472, 884), (497, 884), (500, 886), (503, 888), (506, 891),
                (509, 894), (512, 900)]),
    ('pepper', [(507, 900), (510, 894), (513, 891), (516, 888), (519, 886),
                (521, 884), (547, 884), (549, 886), (552, 888), (555, 891),
                (558, 894), (561, 900)]),
    # the napkin stack runs on into the window frame
    ('napkins', [(559, 889), (X1, 889)]),
]

# A mask that stops a pixel SHORT leaves a hairline of clear glass nobody will
# ever notice; a mask that overruns puts fog back on the shaker. Bias both ways.
PAD_X = 2
PAD_Y = 3

# With nothing in the way, the glass runs to the sill.
sky = np.full(X1 - X0, float(Y1))

for name, pts in STANDING:
    xs = np.array([p[0] for p in pts], dtype=float)
    ys = np.array([p[1] for p in pts], dtype=float)
    lo, hi = int(xs[0]) - PAD_X, int(xs[-1]) + PAD_X
    for x in range(max(X0, lo), min(X1, hi + 1)):
        y = float(np.interp(np.clip(x, xs[0], xs[-1]), xs, ys)) - PAD_Y
        sky[x - X0] = min(sky[x - X0], y)
    print('  %-14s x %d..%d   top %d' % (name, xs[0], xs[-1], ys.min()))

# -- paint it ------------------------------------------------------------
w, h = X1 - X0, Y1 - Y0
alpha = np.zeros((h, w), dtype=np.uint8)
for x in range(w):
    bottom = int(round(min(h - 1, sky[x] - Y0)))
    if bottom >= 0:
        alpha[:bottom + 1, x] = 255
alpha_im = Image.fromarray(alpha, 'L')
# A one-pixel step between columns is a staircase you can see in a gradient.
# Keep it well under PAD_Y so the soft edge lands on the street, not the object.
alpha_im = alpha_im.filter(ImageFilter.GaussianBlur(0.6))

mask = Image.merge('RGBA', (
    Image.new('L', (w, h), 255), Image.new('L', (w, h), 255),
    Image.new('L', (w, h), 255), alpha_im))
path = os.path.join(OUT, 'kiosk_glass_mask.webp')
mask.save(path, 'WEBP', lossless=True)
print('mask', mask.size, '->', path)
