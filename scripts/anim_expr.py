"""Bake Eren's onboarding expressions -- nod, tilt, happy -- from the art we
already own. Nothing here is drawn; every frame is erenGood.png's own pixels
pushed around by a displacement field.

    py scripts/anim_expr.py           (run from the repo root; `py`, not `python`)

WHY THESE THREE
---------------
Each one is motion CSS cannot fake on a flat PNG, which is the only reason to
spend bytes baking frames at all:

  nod    the HEAD dips and returns while the body holds still. A CSS transform
         rotates or translates the whole image; it has no way to move one part
         of a single <img> and leave the rest.
  tilt   the head leans, bending at the neck. Same reason, plus the bend is
         weighted per row so the neck arcs instead of the head shearing off.
  happy  the body squashes and stretches while the paws stay planted. CSS
         scaleY() about `bottom center` comes close, but it scales the paws and
         the head by the same factor -- the paws smear and the face stretches.
         Here the contact rows are pinned and the head gets a lagged
         follow-through, which is what makes it read as weight rather than
         a picture being resized.

A breathing loop or a whole-body hop is NOT here on purpose: CSS already does
those for free, and a baked frame strip that a transform could have produced is
just payload.

FULL-CANVAS STRIPS, NOT PART STRIPS
-----------------------------------
The kitchen's tail/blink/chew are part strips composited over the body PNG,
because a 12fps full-body idle loop at source resolution would have been a
2954x4056 sheet. These are different: a head that moves has to COVER the head
already painted in the body PNG, so an overlay cannot work -- there would be
two heads. So each expression is the whole sprite, baked at roughly 2x its
on-screen size (the onboarding hero is 172px, the slides 130px), which is a
few tens of KB, not megabytes. anim_lib's own header already allows for this:
"A full-canvas animation uses 0/0/100/100."

GEOMETRY (measured off erenGood_notail.png, 848x1264)
-----------------------------------------------------
Read off a row-ruler render of the sprite, then checked against the alpha
width profile -- the width dips from ~567px across the whisker span to ~400px
at y=654, which is the neck, and widens again into the chest below it.

    ears          168 .. 355
    eyes          ~453
    nose          ~514
    jaw / chin    ~590
    COLLAR        632 .. 643      the dark band under the chin
    neck pivot    ~658            where the head hinges
    body          650 .. 1135
    paw contact   ~1120           must not move in `happy`
"""

import numpy as np

import anim_lib as L

SRC = 'erenGood.png'
CANVAS = (848, 1264)

CX = 416.0          # sprite centre column
HEAD_BOTTOM = 618.0  # last row that is pure head
NECK_FEATHER = 78.0  # rows over which head motion bleeds out into the neck
PIVOT_Y = 658.0      # the hinge
GROUND_Y = 1124.0    # paw contact line
PLANT = 150.0        # rows above the contact line that ease back into moving

# The onboarding renders Eren at 130px (slides) to 172px (hero) wide. 0.35 puts
# the frame at 297px -- 2.3x the slides, 1.7x the hero. Enough real pixels for a
# retina downscale without paying for resolution nobody sees; every extra 0.05
# costs roughly 40KB per expression.
SHIP_W = 172.0
BAKE_SCALE = 0.35


# ---------------------------------------------------------------------------
# signal shaping
# ---------------------------------------------------------------------------

def keys(t, pts):
    """Smoothstep-interpolate a scalar through (time, value) keyframes.

    Deliberately NOT linear: a linear ramp between poses reads as a slide, and
    everything else in this app eases. `pts` must be sorted on time and cover
    0.0 and 1.0.
    """
    t = float(t) % 1.0
    for (t0, v0), (t1, v1) in zip(pts, pts[1:]):
        if t0 <= t <= t1:
            if t1 - t0 < 1e-9:
                return v1
            return v0 + (v1 - v0) * L.smoothstep((t - t0) / (t1 - t0))
    return pts[-1][1]


def head_weight(h):
    """1 over the head, easing to 0 through the neck. Everything below the
    collar is untouched, so the body never comes along for the ride."""
    return L.band_weight(h, 0.0, HEAD_BOTTOM, NECK_FEATHER)


def plant_weight(h):
    """0 at the paw contact line, 1 well above it. Multiplied into any body
    deform so the paws stay welded to the floor."""
    y = np.arange(h, dtype=np.float64)
    return L.smoothstep((GROUND_Y - y) / PLANT)


# ---------------------------------------------------------------------------
# deformation fields
# ---------------------------------------------------------------------------

def bend(img, deg, pivot_y=PIVOT_Y, weight=None):
    """Rotate content about (CX, pivot_y) by `deg`, scaled per row by `weight`.

    Because the angle is weighted rather than constant, this is a BEND, not a
    rotation: the head turns through the full angle, the neck through part of
    it, the chest through none. A rigid rotation of the head band would tear it
    off the shoulders at the band edge.
    """
    h, w, _ = img.shape
    if weight is None:
        weight = head_weight(h)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    th = np.radians(deg) * weight[:, None]
    ct, st = np.cos(th), np.sin(th)
    px, py = xx - CX, yy - pivot_y
    dx = (ct - 1.0) * px - st * py
    dy = st * px + (ct - 1.0) * py
    return dx, dy


def scale_about(h, w, y_anchor, fy, fx=1.0, weight=None):
    """Displacement that scales content about the row `y_anchor` (and about CX
    horizontally). fy<1 squashes toward the anchor, fy>1 stretches away."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    wt = 1.0 if weight is None else weight[:, None]
    dy = (yy - y_anchor) * (fy - 1.0) * wt
    dx = (xx - CX) * (fx - 1.0) * wt
    return dx, dy


# ---------------------------------------------------------------------------
# the expressions
# ---------------------------------------------------------------------------

def frames_nod(img, n=14):
    """Two dips, the second smaller. One dip reads as a glitch; two reads as
    'yes'. The head also shortens very slightly at the bottom of each dip --
    a front-facing head that tips forward foreshortens, and without it the dip
    looks like the head is sliding down a pole."""
    h, w, _ = img.shape
    hw = head_weight(h)
    A = 38.0          # source px of travel -- about 8 CSS px at the 172px hero
    SQUASH = 0.985
    out = []
    for i in range(n):
        t = i / float(n)
        s = keys(t, [(0.0, 0.0), (0.16, 1.0), (0.34, 0.0),
                     (0.50, 0.62), (0.66, 0.0), (1.0, 0.0)])
        dy = (A * s * hw)[:, None]
        sx, sy = scale_about(h, w, PIVOT_Y, 1.0 - (1.0 - SQUASH) * s, weight=hw)
        out.append(L.warp(img, sx, dy + sy))
    return out


def frames_tilt(img, n=16):
    """Lean, hold, return. The hold is most of the cycle on purpose -- the
    charm of a head tilt is the pause at the end of it, not the travel."""
    h, _, _ = img.shape
    DEG = 7.5
    out = []
    for i in range(n):
        t = i / float(n)
        s = keys(t, [(0.0, 0.0), (0.22, 1.0), (0.70, 1.0), (0.94, 0.0), (1.0, 0.0)])
        dx, dy = bend(img, DEG * s)
        out.append(L.warp(img, dx, dy))
    return out


def frames_happy(img, n=16):
    """Anticipate down, spring up, land, settle. The head follows one beat
    late -- that lag is the whole difference between a body that has weight
    and a picture being scaled."""
    h, w, _ = img.shape
    pw = plant_weight(h)
    hw = head_weight(h)
    RISE = 21.0       # how far the body lifts off its own base, source px
    out = []
    for i in range(n):
        t = i / float(n)
        # >0 stretch, <0 squash
        s = keys(t, [(0.0, 0.0), (0.12, -1.0), (0.32, 1.0), (0.50, 0.55),
                     (0.68, -0.55), (0.84, 0.18), (1.0, 0.0)])
        lift = keys(t, [(0.0, 0.0), (0.12, -0.15), (0.38, 1.0), (0.56, 0.72),
                        (0.72, 0.0), (0.86, 0.12), (1.0, 0.0)])
        # Volume: stretching tall narrows, squashing widens. Without this the
        # cat visibly gains and loses mass on every bounce.
        fy = 1.0 + 0.045 * s
        fx = 1.0 - 0.033 * s
        dx, dy = scale_about(h, w, GROUND_Y, fy, fx, weight=pw)
        dy = dy - (RISE * lift * pw)[:, None]
        # Head follow-through, one beat behind the body. The lag is baked into
        # the KEYFRAME TIMES rather than sampled at (t - 0.07): wrapping the
        # sample point puts the head mid-settle at t=0, and frame 0 has to be
        # the untouched rest pose or the loop pops every time it comes round.
        lag = keys(t, [(0.0, 0.0), (0.19, -1.0), (0.39, 1.0),
                       (0.57, 0.55), (0.75, -0.55), (0.91, 0.18), (1.0, 0.0)])
        dy = dy - (6.0 * lag * hw)[:, None]
        out.append(L.warp(img, dx, dy))
    return out


EXPRESSIONS = [
    # name        builder        frames  ms    what it is for
    ('goodNod',   frames_nod,    12,     1300, 'yes / got it / step complete'),
    ('goodTilt',  frames_tilt,   12,     2000, 'curious / listening / a question'),
    ('goodHappy', frames_happy,  12,     1000, 'celebrate / you are crushing it'),
]


# ---------------------------------------------------------------------------

def union_bbox(frames, pad=6):
    """Tightest rect holding every frame's content, so the strip is not mostly
    empty canvas. One rect for all frames -- they must stay the same size."""
    x0 = y0 = 10 ** 9
    x1 = y1 = -1
    for f in frames:
        a, b, c, d = L.alpha_bbox(f)
        x0, y0, x1, y1 = min(x0, a), min(y0, b), max(x1, c), max(y1, d)
    return L.pad_rect((x0, y0, x1, y1), pad, CANVAS)


def verify(name, frames, rect):
    """Two things that would ship a broken expression.

    1. Frame 0 must be the untouched sprite. Every expression returns to rest,
       and if frame 0 is already displaced the loop has a visible jump.
    2. Nothing may touch the rect border, or the motion is being clipped -- the
       silent failure mode, because a clipped frame still looks fine alone.
    """
    a = frames[0][..., 3]
    ref = L.load(SRC)[..., 3]
    assert np.abs(a - ref).max() < 1.0, '%s: frame 0 is not the rest pose' % name

    x0, y0, x1, y1 = rect
    for i, f in enumerate(frames):
        al = f[..., 3]
        edges = max(al[y0:y1, x0].max(), al[y0:y1, x1 - 1].max(),
                    al[y0, x0:x1].max(), al[y1 - 1, x0:x1].max())
        assert edges < 8, '%s frame %d: content touches the crop border' % (name, i)


def main():
    img = L.load(SRC)
    assert img.shape[1::-1] == CANVAS, 'expected %s, got %s' % (CANVAS, img.shape[1::-1])
    print('%s  %dx%d   baking at %.3fx  (ship width %.0f CSS px)'
          % (SRC, CANVAS[0], CANVAS[1], BAKE_SCALE, SHIP_W))

    for name, build, n, ms, why in EXPRESSIONS:
        print('\n%s  -- %s' % (name, why))
        full = build(img, n)
        rect = union_bbox(full)
        verify(name, full, rect)
        cropped = [L.crop(f, rect) for f in full]

        L.write_strip(name, cropped, name.replace('good', 'eren_').lower() + '.webp',
                      ms, CANVAS, rect, kind='loop', body_src=None,
                      scale=BAKE_SCALE, lossless=False, quality=80, note=why)

        # Previews: the real on-screen size is the only honest test, but 130px
        # of GIF is too small to judge a 6px motion, so write both.
        L.write_filmstrip(cropped, name + '_strip.png', scale=BAKE_SCALE * 0.9,
                          bg=(38, 24, 62))
        for tag, px in (('ship', 172.0), ('zoom', 430.0)):
            L.write_gif(cropped, '%s_%s.gif' % (name, tag), ms,
                        scale=px / float(rect[2] - rect[0]), bg=(38, 24, 62))


if __name__ == '__main__':
    main()
