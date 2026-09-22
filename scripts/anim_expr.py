"""Bake Eren's onboarding expressions from the art we already own.

    py scripts/anim_expr.py           (run from the repo root; `py`, not `python`)

Nothing here is hand-drawn. Every frame is erenGood's own pixels, either pushed
around by a displacement field or re-laid on the art's own block grid in the
art's own colours.

WHY EACH ONE IS BAKED
---------------------
Only motion a CSS transform cannot fake on a flat PNG earns a frame strip:

  nod    the HEAD dips while the body holds. No transform moves one part of a
         single <img>.
  tilt   the head leans and the NECK bends -- the angle is weighted per row, so
         the head turns fully, the neck partly, the chest not at all.
  happy  squash and stretch with the paws PINNED and the head lagging a beat.
         scaleY about bottom-center scales the paws and the face equally.
  meow   the mouth opens. There is no transform for "grow a hole".
  cheer  happy, with the mouth open across the peak.

Breathing and a whole-body hop are deliberately absent: CSS does those free,
and a strip a transform could have produced is pure payload.

TWO LAYERS, BECAUSE THE TAIL IS NOT PART OF THE HEAD
----------------------------------------------------
The first cut warped the flat erenGood.png, and the tail came along whenever
the head moved -- the tail's top 102 rows (584..686) sit inside the head's row
band, so a row-weighted field grabbed them at full strength. Same trap the
kitchen chew hit with the paw lock: **a body-part weight has to know about the
part, not just the row.**

The fix is not a column mask, it is the split art we already ship:
erenGood_tail.png and erenGood_notail.png, where `notail OVER tail` recomposes
erenGood.png byte for byte (checked: max channel diff 0.0). So every
expression warps the two layers with SEPARATE fields. A head move hands the
tail a zero field and it simply stays put; a whole-body move hands it the same
field as the body, because a tail is attached to the hip and should travel.

THE MOUTH IS PAINTED, NOT WARPED
--------------------------------
Warping cannot open a mouth -- there are no "inside of the mouth" pixels to
pull from. But the mouth can be re-laid the way the blink re-lays the eyelid
(anim_blink.py fills the eye socket with the fur already around it): the art
sits on a 14px block grid at phase (10, 10), the existing mouth line is already
on it, and the opening below it is drawn in exactly two colours taken from the
sprite -- the mouth line's own black, and the nose's own pink for the tongue.
No colour enters that was not already in the file.

Measured mouth, from the pixels:
    upper row  y 556..570   x 332..346 | 402..430 | 486..500
    lower row  y 570..584   x 346..402 | 430..486
So the "w" spans block cols 23..34 on rows 39..40, and an opening hangs off
rows 41 and below.

GEOMETRY (erenGood_notail.png, 848x1264), off a row-ruler render
----------------------------------------------------------------
    ears 168..355   eyes ~453   nose ~514   jaw ~590
    collar 632..643   NECK PIVOT ~658   body 650..1135   PAW CONTACT ~1124
    centre column cx = 416          tail rows 584..1017, cols 608..827
"""

import numpy as np

import anim_lib as L

SRC_BODY = 'erenGood_notail.png'
SRC_TAIL = 'erenGood_tail.png'
CANVAS = (848, 1264)

CX = 416.0
HEAD_BOTTOM = 618.0
NECK_FEATHER = 78.0
PIVOT_Y = 658.0
GROUND_Y = 1124.0
PLANT = 150.0

# The art's own block grid. Every painted shape lands on it, or the addition
# reads as a different resolution stuck onto the sprite.
GRID = 14
PHASE_X, PHASE_Y = 10, 10

# The onboarding renders Eren at 130px (slides) to 172px (hero) wide. 0.35 puts
# the frame at 297px -- 2.3x the slides, 1.7x the hero. Every extra 0.05 here
# costs roughly 40KB per expression.
SHIP_W = 172.0
BAKE_SCALE = 0.35


# ---------------------------------------------------------------------------
# signal shaping
# ---------------------------------------------------------------------------

def keys(t, pts):
    """Smoothstep-interpolate a scalar through (time, value) keyframes.

    Deliberately not linear: a linear ramp between poses reads as a slide, and
    everything else in this app eases.
    """
    t = float(t) % 1.0
    for (t0, v0), (t1, v1) in zip(pts, pts[1:]):
        if t0 <= t <= t1:
            if t1 - t0 < 1e-9:
                return v1
            return v0 + (v1 - v0) * L.smoothstep((t - t0) / (t1 - t0))
    return pts[-1][1]


def head_weight(h):
    """1 over the head, easing to 0 through the neck."""
    return L.band_weight(h, 0.0, HEAD_BOTTOM, NECK_FEATHER)


def plant_weight(h):
    """0 at the paw contact line, 1 well above it, so the paws stay welded to
    the floor through a squash."""
    y = np.arange(h, dtype=np.float64)
    return L.smoothstep((GROUND_Y - y) / PLANT)


# ---------------------------------------------------------------------------
# deformation fields -- each returns (dx, dy) as full (H, W) arrays
# ---------------------------------------------------------------------------

ZERO = None   # a field of None means "leave this layer alone"


def bend(shape, deg, pivot_y=PIVOT_Y, weight=None):
    """Rotate about (CX, pivot_y) by `deg`, scaled per row by `weight`.

    The weighted angle makes this a BEND, not a rotation: a constant angle over
    a head band would tear the head off the shoulders at the band edge.
    """
    h, w = shape
    if weight is None:
        weight = head_weight(h)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    th = np.radians(deg) * weight[:, None]
    ct, st = np.cos(th), np.sin(th)
    px, py = xx - CX, yy - pivot_y
    return (ct - 1.0) * px - st * py, st * px + (ct - 1.0) * py


def scale_about(shape, y_anchor, fy, fx=1.0, weight=None):
    """Scale content about row `y_anchor` and column CX."""
    h, w = shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    wt = 1.0 if weight is None else weight[:, None]
    return (xx - CX) * (fx - 1.0) * wt, (yy - y_anchor) * (fy - 1.0) * wt


# ---------------------------------------------------------------------------
# the mouth
# ---------------------------------------------------------------------------

def _blk(c0, c1, r):
    """Pixel rect for block columns [c0, c1) on block row r."""
    return (PHASE_X + c0 * GRID, PHASE_Y + r * GRID,
            PHASE_X + c1 * GRID, PHASE_Y + (r + 1) * GRID)


# How far the jaw is open, as block rows hanging under the existing mouth line
# (which ends at block row 40). Each level is a whole block: a pixel mouth opens
# in steps, it does not fade open.
# Three is the floor of the chin, not a stylistic choice: block row 44 lands on
# y 626..640, which is where the ruff outline starts, so a four-row open merges
# the mouth into the chest line and Eren reads as having no jaw. Baked, looked
# at, deleted.
MOUTH_LEVELS = {
    1: [(26, 32, 41)],
    2: [(25, 33, 41), (26, 32, 42)],
    3: [(25, 33, 41), (25, 33, 42), (26, 32, 43)],
}
# The tongue sits in the bottom block row of the widest open, centred.
MOUTH_TONGUE = {3: (28, 30, 43)}

INK = np.array([0.0, 0.0, 0.0])           # the mouth line's own black
TONGUE = np.array([213.0, 138.0, 181.0])  # the nose's own pink


def open_mouth(img, level):
    """Paint the jaw open `level` block-rows. Returns a new image.

    Clipped to pixels that are already opaque, so the opening can never spill
    past the head's silhouette or paint over the ruff outline below the chin.
    """
    level = int(round(level))
    if level <= 0:
        return img
    out = img.copy()
    op = out[..., 3] > 200
    for c0, c1, r in MOUTH_LEVELS[min(level, 3)]:
        x0, y0, x1, y1 = _blk(c0, c1, r)
        sel = np.zeros(out.shape[:2], dtype=bool)
        sel[y0:y1, x0:x1] = True
        sel &= op
        out[sel, 0:3] = INK
    tongue = MOUTH_TONGUE.get(min(level, 3))
    if tongue:
        x0, y0, x1, y1 = _blk(*tongue)
        sel = np.zeros(out.shape[:2], dtype=bool)
        sel[y0:y1, x0:x1] = True
        sel &= op
        out[sel, 0:3] = TONGUE
    return out


# ---------------------------------------------------------------------------
# the expressions
#
# Each planner returns, per frame, (body_field, tail_field, mouth_level).
# A field of ZERO leaves that layer untouched -- which is how the tail stays
# out of every head move.
# ---------------------------------------------------------------------------

def plan_nod(shape, n):
    """Two dips, the second smaller. One dip reads as a glitch; two reads as
    'yes'. The head shortens a hair at the bottom of each dip, because a head
    that tips forward foreshortens -- without it, it slides down a pole."""
    h, _ = shape
    hw = head_weight(h)
    A, SQUASH = 38.0, 0.985
    out = []
    for i in range(n):
        t = i / float(n)
        s = keys(t, [(0.0, 0.0), (0.16, 1.0), (0.34, 0.0),
                     (0.50, 0.62), (0.66, 0.0), (1.0, 0.0)])
        dx, dy = scale_about(shape, PIVOT_Y, 1.0 - (1.0 - SQUASH) * s, weight=hw)
        out.append(((dx, dy + (A * s * hw)[:, None]), ZERO, 0))
    return out


def plan_tilt(shape, n):
    """Lean, hold, return. The hold is most of the cycle on purpose -- the
    charm of a head tilt is the pause at the end of it, not the travel."""
    out = []
    for i in range(n):
        t = i / float(n)
        s = keys(t, [(0.0, 0.0), (0.22, 1.0), (0.70, 1.0), (0.94, 0.0), (1.0, 0.0)])
        out.append((bend(shape, 7.5 * s), ZERO, 0))
    return out


def _bounce(shape, t):
    """The shared squash/stretch + lift field. `happy` and `cheer` are the same
    body motion; only the mouth differs."""
    h, _ = shape
    pw, hw = plant_weight(h), head_weight(h)
    RISE = 21.0
    s = keys(t, [(0.0, 0.0), (0.12, -1.0), (0.32, 1.0), (0.50, 0.55),
                 (0.68, -0.55), (0.84, 0.18), (1.0, 0.0)])
    lift = keys(t, [(0.0, 0.0), (0.12, -0.15), (0.38, 1.0), (0.56, 0.72),
                    (0.72, 0.0), (0.86, 0.12), (1.0, 0.0)])
    # Volume: stretching tall narrows, squashing widens. Without this the cat
    # visibly gains and loses mass on every bounce.
    dx, dy = scale_about(shape, GROUND_Y, 1.0 + 0.045 * s, 1.0 - 0.033 * s, weight=pw)
    dy = dy - (RISE * lift * pw)[:, None]
    # Head follow-through. The lag lives in the KEYFRAME TIMES, not in a shifted
    # sample point: sampling at (t - 0.07) % 1 leaves the head mid-settle at
    # t=0, and frame 0 has to be the untouched rest pose or the loop pops every
    # time it comes round.
    lag = keys(t, [(0.0, 0.0), (0.19, -1.0), (0.39, 1.0),
                   (0.57, 0.55), (0.75, -0.55), (0.91, 0.18), (1.0, 0.0)])
    return dx, dy - (6.0 * lag * hw)[:, None]


def plan_happy(shape, n):
    """Anticipate down, spring up, land, settle. The tail travels with the body
    here -- it is attached to the hip, and pinning it would read as a sticker
    glued to the floor."""
    out = []
    for i in range(n):
        f = _bounce(shape, i / float(n))
        out.append((f, f, 0))
    return out


def plan_cheer(shape, n):
    """Happy, with the mouth open across the top of the bounce. It opens on the
    way up and shuts on the way down, so the jaw is driven by the body rather
    than running on a clock of its own."""
    out = []
    for i in range(n):
        t = i / float(n)
        f = _bounce(shape, t)
        m = keys(t, [(0.0, 0.0), (0.14, 0.0), (0.30, 3.0), (0.56, 3.0),
                     (0.72, 1.0), (0.84, 0.0), (1.0, 0.0)])
        out.append((f, f, round(m)))
    return out


def plan_meow(shape, n):
    """Two mouth openings with a small chin lift under them -- a cat opening its
    mouth raises its chin. Nothing else moves, so the mouth carries the read."""
    h, _ = shape
    hw = head_weight(h)
    out = []
    for i in range(n):
        t = i / float(n)
        m = keys(t, [(0.0, 0.0), (0.10, 3.0), (0.26, 3.0), (0.38, 0.0),
                     (0.52, 2.0), (0.66, 2.0), (0.78, 0.0), (1.0, 0.0)])
        lift = keys(t, [(0.0, 0.0), (0.12, 1.0), (0.30, 1.0), (0.42, 0.0),
                        (0.54, 0.7), (0.68, 0.7), (0.80, 0.0), (1.0, 0.0)])
        dx = np.zeros(shape)
        dy = np.broadcast_to((-11.0 * lift * hw)[:, None], shape).copy()
        out.append(((dx, dy), ZERO, round(m)))
    return out


EXPRESSIONS = [
    # name        planner      frames  ms    what it is for
    ('goodNod',   plan_nod,    12,     1300, 'yes / got it / step complete'),
    ('goodTilt',  plan_tilt,   12,     2000, 'curious / listening / a question'),
    ('goodHappy', plan_happy,  12,     1000, 'celebrate / you are crushing it'),
    ('goodCheer', plan_cheer,  12,     1100, 'celebrate, out loud'),
    ('goodMeow',  plan_meow,   12,     1600, 'Eren is saying something'),
]

# Expressions where the tail must not move at all. Asserted, not hoped for.
HEAD_ONLY = {'goodNod', 'goodTilt', 'goodMeow'}


# ---------------------------------------------------------------------------

def compose(top, bot):
    """`notail` OVER `tail`. Verified against erenGood.png: max channel diff 0."""
    ta, ba = top[..., 3:4] / 255.0, bot[..., 3:4] / 255.0
    oa = ta + ba * (1.0 - ta)
    safe = np.where(oa > 1e-6, oa, 1.0)
    rgb = (top[..., :3] * ta + bot[..., :3] * ba * (1.0 - ta)) / safe
    return np.dstack([rgb, oa * 255.0])


def render(body, tail, plan):
    """Returns the composed frames AND the warped body layer, because the tail
    check below has to know which pixels the body covered."""
    frames, bodies = [], []
    for body_f, tail_f, mouth in plan:
        b = body if body_f is ZERO else L.warp(body, body_f[0], body_f[1])
        t = tail if tail_f is ZERO else L.warp(tail, tail_f[0], tail_f[1])
        if mouth:
            b = open_mouth(b, mouth)
        frames.append(compose(b, t))
        bodies.append(b)
    return frames, bodies


def union_bbox(frames, pad=6):
    """One rect holding every frame's content -- frames must all be the same
    size, and a per-frame crop would make the sprite jitter."""
    x0 = y0 = 10 ** 9
    x1 = y1 = -1
    for f in frames:
        a, b, c, d = L.alpha_bbox(f)
        x0, y0, x1, y1 = min(x0, a), min(y0, b), max(x1, c), max(y1, d)
    return L.pad_rect((x0, y0, x1, y1), pad, CANVAS)


def verify(name, frames, rect, ref):
    """Two things that would ship a broken expression.

    1. Frame 0 is the untouched sprite. Every expression returns to rest, so a
       displaced frame 0 makes the loop jump every cycle.
    2. Nothing touches the crop border -- the silent failure, because a clipped
       frame still looks fine on its own.
    """
    assert np.abs(frames[0][..., 3] - ref[..., 3]).max() < 1.0, \
        '%s: frame 0 is not the rest pose' % name

    x0, y0, x1, y1 = rect
    for i, f in enumerate(frames):
        al = f[..., 3]
        edge = max(al[y0:y1, x0].max(), al[y0:y1, x1 - 1].max(),
                   al[y0, x0:x1].max(), al[y1 - 1, x0:x1].max())
        assert edge < 8, '%s frame %d: content touches the crop border' % (name, i)


def verify_tail_still(name, frames, bodies, plan, body, tail, ref):
    """The tail must be untouched in every frame of a head-only expression.
    This is the bug the user caught by eye, so it gets an assertion.

    A column window will NOT do. A 7.5-degree tilt swings an ear tip at x=690
    out to x=751, which is past the body art entirely and deep into the tail is
    columns -- so "nothing changed right of the body" fails on a tilt that is
    behaving perfectly. What has to hold is narrower: wherever a TAIL pixel is
    visible and the body covers it neither at rest nor in this frame, the
    output must still equal the source.
    """
    assert all(tf is ZERO for _, tf, _ in plan),         '%s is head-only but handed the tail layer a field' % name

    # Stay 3px clear of the body silhouette in both the rest pose and this
    # frame. warp() interpolates, so the body edge carries a pixel or two of
    # partial alpha, and compositing over it shifts the tail underneath by a
    # level or two. That is the SEAM moving, not the tail -- measuring it would
    # mean loosening the tolerance until the check stopped meaning anything.
    grow = lambda a: L.ndimage.binary_dilation(a > 0, iterations=3)
    tvis = (tail[..., 3] > 16) & ~grow(body[..., 3])
    for i, (f, b) in enumerate(zip(frames, bodies)):
        m = tvis & ~grow(b[..., 3])
        if not m.any():
            continue
        d = np.abs(f[m] - ref[m]).max()
        assert d < 1.0, '%s frame %d: tail pixels changed (max %.1f)' % (name, i, d)


def main():
    body, tail = L.load(SRC_BODY), L.load(SRC_TAIL)
    assert body.shape[1::-1] == CANVAS, 'expected %s, got %s' % (CANVAS, body.shape[1::-1])
    ref = compose(body, tail)
    print('%s + %s  %dx%d   baking at %.3fx  (ship width %.0f CSS px)'
          % (SRC_BODY, SRC_TAIL, CANVAS[0], CANVAS[1], BAKE_SCALE, SHIP_W))

    for name, plan_fn, n, ms, why in EXPRESSIONS:
        print('\n%s  -- %s' % (name, why))
        plan = plan_fn(body.shape[:2], n)
        full, bodies = render(body, tail, plan)
        rect = union_bbox(full)
        verify(name, full, rect, ref)
        if name in HEAD_ONLY:
            verify_tail_still(name, full, bodies, plan, body, tail, ref)
            print('  tail: verified still')
        cropped = [L.crop(f, rect) for f in full]

        L.write_strip(name, cropped, name.replace('good', 'eren_').lower() + '.webp',
                      ms, CANVAS, rect, kind='loop', body_src=None,
                      scale=BAKE_SCALE, lossless=False, quality=80, note=why)
        L.write_filmstrip(cropped, name + '_strip.png', scale=BAKE_SCALE * 0.9,
                          bg=(38, 24, 62))


if __name__ == '__main__':
    main()
