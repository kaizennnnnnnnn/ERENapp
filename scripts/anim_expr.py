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
    upper row  y 556..569   x 332..345 | 403..430 | 488..500
    lower row  y 570..583   x 347..402 | 431..486
So the "w" spans block cols 23..34 on rows 39..40. The cavity starts ON ROW 40,
filling the white fur at x 403..430 that the two lower curves leave between them
-- see MOUTH_LEVELS. And it is painted BEFORE the warp, so it travels with the
head; see render().

GEOMETRY (erenGood_notail.png, 848x1264), off a row-ruler render
----------------------------------------------------------------
    ears 168..355   eyes ~453   nose ~514   jaw ~590
    collar 632..643   NECK PIVOT ~658   body 650..1135   PAW CONTACT ~1124
    centre column cx = 416          tail rows 584..1017, cols 608..827
"""

import numpy as np

import anim_lib as L
import eren_parts as P

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


# How far the jaw is open, as a cavity hanging under the mouth line. Each level
# is a whole block: a pixel mouth opens in steps, it does not fade open.
#
# It has to START ON BLOCK ROW 40, not 41. The mouth line is a "w": the outer
# tips and the centre peak sit on row 39, and the two curve BOTTOMS on row 40, at
# x 347..402 and 431..486 -- which leaves white fur at x 403..430 between them.
# Hanging the opening off row 41 left that white block floating INSIDE the black
# as an island, so the whole thing read as a bar stuck under the chin rather than
# a mouth. Filling row 40's centre welds the cavity to the "w" the art already
# has, and the centre peak becomes the roof of the mouth.
#
# Every rect is symmetric about x=416, the mouth's measured centre: a block rect
# [c0, c1) is centred there exactly when c0 + c1 == 58.
#
# Three block rows below the lip is the floor of the chin, not a stylistic
# choice: block row 44 lands on y 626..639, which is where the ruff outline
# starts, so a deeper open merges the mouth into the chest line and Eren reads as
# having no jaw. Baked, looked at, deleted.
MOUTH_LEVELS = {
    1: [(27, 31, 40), (28, 30, 41)],
    2: [(26, 32, 40), (26, 32, 41), (27, 31, 42)],
    3: [(25, 33, 40), (25, 33, 41), (26, 32, 42), (27, 31, 43)],
}
# The tongue sits in the bottom row of the opening, centred, a block clear of the
# ink on each side so it reads as inside the mouth rather than as the lower lip.
MOUTH_TONGUE = {2: (28, 30, 42), 3: (28, 30, 43)}

# The teeth. Two things, and they are DIFFERENT heights on purpose:
#
#   MOUTH_TEETH     the canines -- full blocks, the brightest thing in the mouth
#   MOUTH_INCISORS  the row between them -- the top HALF of the block only
#
# The first cut was canines alone, and the user's verdict was "made him look
# like a vampire": two white blocks floating at the corners of a black hole is
# the Dracula icon, and no cat shows canines with no incisor row joining them.
# A four-lens panel then ranked six designs from a sheet that showed each at
# the true 172px ship size, and the winner by a wide margin was a half-height
# row with the canines hanging below it -- the row survives the downscale as a
# light ridge under the lip, the full-block canines stay white, and that
# hierarchy is what a real cat yawn looks like. A comb of separate small teeth
# came last: at ship size it is a speckle, not teeth.
#
# EVERYTHING IS PINNED TO THE SAME COLUMNS AT BOTH OPEN LEVELS. The teeth are
# bolted to the upper jaw; opening wider moves the chin away from them. The
# refutation pass caught the winning design widening its row by a block per
# side between levels 2 and 3 -- which the cheer steps through at frame 3->4
# every cycle -- so the row would have slid along the gums the way the fangs
# once did. Level 1 gets none: its cavity is one row of clearance, and a tooth
# in it would be the whole cavity.
MOUTH_TEETH = {
    2: [(27, 28, 41), (30, 31, 41)],
    3: [(27, 28, 41), (30, 31, 41)],
}
MOUTH_INCISORS = {2: (28, 30, 41), 3: (28, 30, 41)}
INCISOR_FRAC = 0.5      # the top half of the block row
# Near the coat's light end rather than pure white. It is deliberately inside the
# coat's own classification band (V > 0.86, sat < 0.10) so that eren_colors.py
# sees teeth as coat: they then follow the WHITE when the cat is recoloured,
# which is what teeth do, instead of following the fur.
ENAMEL = np.array([246.0, 248.0, 248.0])

# Lower canines: only at the widest open, only the BOTTOM THIRD of the block,
# and a step dimmer than the enamel so they sit behind the tongue rather than
# beside it. The brief was "add bottom teeth but don't make them super
# visible": four placements were rendered at ship size, and the corner pair on
# row 42 was the one that reads as a hint at the mouth's corners -- the pair
# beside the tongue on row 43 read as a lower lip, and full enamel read as a
# second set of fangs.
MOUTH_LOWER = {3: [(26, 27, 42), (31, 32, 42)]}
LOWER_FRAC = 0.34
DENTINE = np.array([214.0, 218.0, 218.0])

INK = np.array([0.0, 0.0, 0.0])           # the mouth line's own black
TONGUE = np.array([213.0, 138.0, 181.0])  # the nose's own pink


def _fill(out, op, rect, rgb, top_frac=1.0, bottom_frac=None):
    """Paint one block rect, clipped to pixels that are already opaque so nothing
    can spill past the head's silhouette or over the ruff outline below the chin.
    `top_frac` < 1 paints only the top of the row -- the incisors are half a
    block, the same sub-block scale the art already uses for the eye highlights.
    `bottom_frac` paints only the bottom of it instead (the lower canines)."""
    x0, y0, x1, y1 = _blk(*rect)
    if bottom_frac is not None:
        y0 = y1 - int(round((y1 - y0) * bottom_frac))
    else:
        y1 = y0 + int(round((y1 - y0) * top_frac))
    sel = np.zeros(out.shape[:2], dtype=bool)
    sel[y0:y1, x0:x1] = True
    sel &= op
    out[sel, 0:3] = rgb


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
    for rect in MOUTH_LEVELS[min(level, 3)]:
        _fill(out, op, rect, INK)
    tongue = MOUTH_TONGUE.get(min(level, 3))
    if tongue:
        _fill(out, op, tongue, TONGUE)
    # Teeth last: they sit ON the cavity, so they have to be painted over it.
    lv = min(level, 3)
    if lv in MOUTH_INCISORS:
        _fill(out, op, MOUTH_INCISORS[lv], ENAMEL, top_frac=INCISOR_FRAC)
    for t in MOUTH_TEETH.get(lv, ()):
        _fill(out, op, t, ENAMEL)
    for t in MOUTH_LOWER.get(lv, ()):
        _fill(out, op, t, DENTINE, bottom_frac=LOWER_FRAC)
    return out


# ---------------------------------------------------------------------------
# the eyes -- measured off the art, never hard-coded
#
# Each eye is an ink hexagon (7 block columns, 6-7 rows) filled with blue, with
# a black C-shaped pupil wrapping a white catchlight. The two are mirror images
# about CX, so everything below is computed per hull rather than written down.
# ---------------------------------------------------------------------------

def eye_hulls(body):
    """The two eye sockets as filled masks, left first."""
    import eren_colors as C
    m, _ = C.classify(body)
    band = np.zeros(body.shape[:2], dtype=bool)
    band[400:500, 260:580] = True
    blob = (m['ink'] | m['eye']) & band
    lab, n = L.ndimage.label(blob)
    sizes = L.ndimage.sum(blob, lab, range(1, n + 1))
    big = [i + 1 for i in np.argsort(sizes)[::-1][:2]]
    hulls = [L.ndimage.binary_fill_holes(lab == k) for k in big]
    return sorted(hulls, key=lambda h: np.nonzero(h)[1].mean())


def close_lids(img, hulls, frac):
    """Draw the eyelid `frac` of the way down each socket. The lid is the fur
    already above the socket, column by column, so a recolour sees it as fur
    and paints it with the coat; the seam of a shut eye is the socket's own
    bottom two block rows in ink -- the "bot2" shape anim_blink.py settled on
    after seven candidates: the lower edge the artist already drew, a shallow
    bowl that lifts at both corners, and it invents no shape.
    """
    frac = float(np.clip(frac, 0.0, 1.0))
    if frac <= 0.0:
        return img
    out = img.copy()
    for hull in hulls:
        cols = np.nonzero(hull.any(axis=0))[0]
        for x in cols:
            rows = np.nonzero(hull[:, x])[0]
            r0, r1 = rows.min(), rows.max()
            depth = int(round((r1 - r0 + 1) * frac))
            if depth <= 0:
                continue
            fur = out[r0 - 3, x, :3]
            out[r0:r0 + depth, x, :3] = fur
        if frac >= 1.0:
            xs = np.nonzero(hull.any(axis=0))[0]
            for c in range((xs.min() - PHASE_X) // GRID, (xs.max() - PHASE_X) // GRID + 1):
                x0, x1 = PHASE_X + c * GRID, PHASE_X + (c + 1) * GRID
                colm = hull[:, x0:x1].any(axis=1)
                rows = np.nonzero(colm)[0]
                if rows.size == 0:
                    continue
                rb = (rows.max() - PHASE_Y) // GRID          # bottom block row
                y0 = PHASE_Y + (rb - 1) * GRID
                y1 = PHASE_Y + (rb + 1) * GRID
                sel = np.zeros(hull.shape, dtype=bool)
                sel[y0:y1, x0:x1] = True
                sel &= hull
                out[sel, :3] = INK
    return out


def glance(img, hulls, blocks):
    """Slide the pupil and catchlight `blocks` block columns sideways inside
    each socket (positive = to the viewer's right), refilling what they left
    with the eye's own blue. Anything that would land on the ink ring is
    dropped -- it went behind the lid, which is what a real glance does.
    """
    if not blocks:
        return img
    out = img.copy()
    shift = int(blocks) * GRID
    for hull in hulls:
        inner = L.ndimage.binary_erosion(hull, iterations=16)     # clear of the ring
        room = L.ndimage.binary_erosion(hull, iterations=GRID)   # just inside it
        rgb = img[..., :3]
        dark = rgb.max(axis=2) < 60
        bright = rgb.min(axis=2) > 235
        src = (dark | bright) & inner
        blue = np.median(img[hull & ~dark & ~bright][:, :3], axis=0)
        ys, xs = np.nonzero(src)
        dst_x = xs + shift
        ok = (dst_x >= 0) & (dst_x < hull.shape[1])
        ys, xs, dst_x = ys[ok], xs[ok], dst_x[ok]
        keep = room[ys, dst_x]
        out[src, :3] = blue
        out[ys[keep], dst_x[keep], :3] = img[ys[keep], xs[keep], :3]
    return out


# The tongue tip, resting between the two lip curves and one row below them --
# the "blep". Row 40's centre is the white notch between the curves (see the
# mouth notes above), so the tongue reads as coming out of the mouth, not as a
# sticker under it.
BLEP = [(28, 30, 40), (28, 30, 41)]


def blep(img, on):
    if not on:
        return img
    out = img.copy()
    op = out[..., 3] > 200
    for r in BLEP:
        _fill(out, op, r, TONGUE)
    return out


def ear_weight(body, side):
    """A 2D field, 1 at the ear's tip easing to 0 at its base and blurred a
    little past it, so a rotation moves the ear and stirs the fur at its root
    rather than shearing it off. The ear region is eren_parts's own slanted cut,
    so this and the colour picker agree on what an ear is."""
    import eren_colors as C
    m, _ = C.classify(body)
    shape = body.shape[:2]
    above = ~P.below_line(shape, P.EAR_INNER, P.EAR_OUTER, mirror=(side == 'right'))
    xs = np.arange(shape[1])[None, :]
    half = (xs < CX) if side == 'left' else (xs >= CX)
    ear = m['fur'] & above & half
    ys, xs2 = np.nonzero(ear)
    y_tip, y_base = ys.min(), ys.max()
    pivot = (xs2[ys >= y_base - GRID].mean(), float(y_base))
    ramp = np.clip((y_base - np.arange(shape[0], dtype=np.float64)) / max(y_base - y_tip, 1.0), 0, 1) ** 1.3
    w = np.where(ear, ramp[:, None], 0.0)
    w = L.ndimage.gaussian_filter(w, 6.0)
    return w, pivot


def rot2d(shape, deg, pivot, weight):
    """Rotate about `pivot` by `deg`, scaled per PIXEL by `weight` -- bend() with
    a 2D weight instead of a per-row one."""
    h, w = shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    th = np.radians(deg) * weight
    ct, st = np.cos(th), np.sin(th)
    px, py = xx - pivot[0], yy - pivot[1]
    return (ct - 1.0) * px - st * py, st * px + (ct - 1.0) * py


def paint_face(body, mouth, face, hulls):
    """Everything painted BEFORE the warp, in the order the layers stack: the
    mouth, then the tongue over it, the pupils, and the lids over all of it."""
    b = open_mouth(body, mouth) if mouth else body
    if not face:
        return b
    b = blep(b, face.get('blep', 0))
    b = glance(b, hulls, face.get('glance', 0))
    b = close_lids(b, hulls, face.get('lid', 0.0))
    return b


# ---------------------------------------------------------------------------
# the expressions
#
# Each planner returns, per frame, (body_field, tail_field, mouth_level, face)
# where face is None or {'lid': 0..1, 'glance': -1/0/1, 'blep': 0/1}.
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
        out.append(((dx, dy + (A * s * hw)[:, None]), ZERO, 0, None))
    return out


def plan_tilt(shape, n):
    """Lean, hold, return. The hold is most of the cycle on purpose -- the
    charm of a head tilt is the pause at the end of it, not the travel."""
    out = []
    for i in range(n):
        t = i / float(n)
        s = keys(t, [(0.0, 0.0), (0.22, 1.0), (0.70, 1.0), (0.94, 0.0), (1.0, 0.0)])
        out.append((bend(shape, 7.5 * s), ZERO, 0, None))
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
        out.append((f, f, 0, None))
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
        out.append((f, f, round(m), None))
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
        out.append(((dx, dy), ZERO, round(m), None))
    return out


def _still(shape):
    return (np.zeros(shape), np.zeros(shape))


def plan_blink(shape, n):
    """Open for most of the cycle, then shut and back in three frames. A blink
    is the one thing every cat does, and the onboarding hero is a still image
    without it. Frames 0..8 are the rest pose exactly -- a blink that drifts
    the head would read as a twitch."""
    out = []
    lids = [0.0] * (n - 3) + [0.55, 1.0, 0.55]
    for i in range(n):
        out.append((ZERO, ZERO, 0, {'lid': lids[i]} if lids[i] else None))
    return out


def plan_yawn(shape, n):
    """The mouth opens wide as the eyes squeeze shut and the chin lifts, holds,
    and lets go. Everything is driven off one curve so the jaw, the lids and
    the head arrive together -- a yawn is one motion, not three."""
    h, _ = shape
    hw = head_weight(h)
    out = []
    for i in range(n):
        t = i / float(n)
        s = keys(t, [(0.0, 0.0), (0.22, 1.0), (0.62, 1.0), (0.90, 0.0), (1.0, 0.0)])
        dx = np.zeros(shape)
        dy = np.broadcast_to((-18.0 * s * hw)[:, None], shape).copy()
        face = {'lid': min(1.0, s * 1.25)} if s > 0 else None
        out.append(((dx, dy), ZERO, round(3.0 * s), face))
    return out


def plan_ear(shape, n, body):
    """One ear flicks back and returns, then a smaller second flick. The
    rotation is weighted per pixel by the ear's own mask, so the head does not
    move -- which is the point: an ear flick is the thing a cat does while
    otherwise ignoring you completely."""
    w, pivot = ear_weight(body, 'left')
    out = []
    for i in range(n):
        t = i / float(n)
        s = keys(t, [(0.0, 0.0), (0.10, 1.0), (0.24, 0.0), (0.42, 0.55), (0.56, 0.0), (1.0, 0.0)])
        f = rot2d(shape, -22.0 * s, pivot, w) if s > 1e-6 else ZERO
        out.append((f, ZERO, 0, None))
    return out


def plan_shake(shape, n):
    """No. The head swings side to side with the neck bending under it, twice,
    the second swing smaller -- the mirror of the nod's two dips."""
    h, _ = shape
    hw = head_weight(h)
    out = []
    for i in range(n):
        t = i / float(n)
        s = keys(t, [(0.0, 0.0), (0.12, -1.0), (0.32, 1.0), (0.50, -0.6), (0.66, 0.45),
                     (0.80, -0.2), (0.92, 0.0), (1.0, 0.0)])
        dx, dy = bend(shape, 4.0 * s)
        dx = dx + (16.0 * s * hw)[:, None]
        out.append(((dx, dy), ZERO, 0, None))
    return out


def plan_glance(shape, n):
    """The eyes slide to one side, hold, come back, then the other side. The
    head stays put -- a cat looks with its eyes first."""
    seq = [0, 1, 1, 1, 0, 0, -1, -1, -1, 0, 0, 0]
    out = []
    for i in range(n):
        g = seq[i % len(seq)]
        out.append((ZERO, ZERO, 0, {'glance': g} if g else None))
    return out


def plan_blep(shape, n):
    """Tongue tip out, held, and back in. Nothing else moves. Frame 0 is the
    rest pose, the tongue appears for the middle of the cycle."""
    seq = [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0]
    out = []
    for i in range(n):
        out.append((ZERO, ZERO, 0, {'blep': 1} if seq[i % len(seq)] else None))
    return out


EXPRESSIONS = [
    # name        planner      frames  ms    what it is for
    ('goodNod',   plan_nod,    12,     1300, 'yes / got it / step complete'),
    ('goodTilt',  plan_tilt,   12,     2000, 'curious / listening / a question'),
    ('goodHappy', plan_happy,  12,     1000, 'celebrate / you are crushing it'),
    ('goodCheer', plan_cheer,  12,     1100, 'celebrate, out loud'),
    ('goodMeow',  plan_meow,   12,     1600, 'Eren is saying something'),
    ('goodBlink', plan_blink,  12,     2400, 'idle -- he is alive'),
    ('goodYawn',  plan_yawn,   12,     2000, 'sleepy / bedtime / nothing to do'),
    ('goodEar',   plan_ear,    12,     1600, 'idle fidget -- ignoring you'),
    ('goodShake', plan_shake,  12,     1200, 'no / wrong / not that one'),
    ('goodGlance', plan_glance, 12,    2400, 'idle -- looking around'),
    ('goodBlep',  plan_blep,   12,     2400, 'tongue out -- content'),
]

# Expressions where the tail must not move at all. Asserted, not hoped for.
HEAD_ONLY = {'goodNod', 'goodTilt', 'goodMeow', 'goodBlink', 'goodYawn', 'goodEar',
             'goodShake', 'goodGlance', 'goodBlep'}


# ---------------------------------------------------------------------------

def compose(top, bot):
    """`notail` OVER `tail`. Verified against erenGood.png: max channel diff 0."""
    ta, ba = top[..., 3:4] / 255.0, bot[..., 3:4] / 255.0
    oa = ta + ba * (1.0 - ta)
    safe = np.where(oa > 1e-6, oa, 1.0)
    rgb = (top[..., :3] * ta + bot[..., :3] * ba * (1.0 - ta)) / safe
    return np.dstack([rgb, oa * 255.0])


def render(body, tail, plan, hulls):
    """Returns the composed frames AND the warped body layer, because the tail
    check below has to know which pixels the body covered."""
    frames, bodies = [], []
    for body_f, tail_f, mouth, face in plan:
        # PAINT, THEN WARP -- in that order, always. Painting afterwards writes
        # the cavity at fixed canvas rows, so on `cheer` (which lifts the whole
        # body 21px and lags the head another 6) the face rose and the open mouth
        # stayed behind on the chest. Painted first it is just more face pixels,
        # and the same field that carries the nose carries the mouth.
        b = paint_face(body, mouth, face, hulls)
        if body_f is not ZERO:
            b = L.warp(b, body_f[0], body_f[1])
        t = tail if tail_f is ZERO else L.warp(tail, tail_f[0], tail_f[1])
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


# The muzzle window the mouth check measures in. Nothing else on the sprite is
# dark inside it: the cheek outlines sit at x 262..302 and 531..571, and the ruff
# starts at y 626 -- all outside. The window RIDES the frame's own displacement,
# so it holds the same anatomy whether the head is up, down or leaning.
MOUTH_BOX = (320, 545, 520, 630)   # x0, y0, x1, y1 at rest


def mouth_centroid(img, field=None):
    """Centre of mass of the dark pixels in the muzzle -- the "w" plus whatever
    the cavity added. Sub-pixel, and stable under warp(): bilinear interpolation
    softens the block edges symmetrically.

    `field` deforms the WINDOW the same way the content is deformed. Translating
    it is not enough. These fields scale about the paw line, so a fixed-height
    window loses a row or two off the stretched muzzle, and that clipping drags
    the centroid by ~2.4px -- the same order as the error being hunted, which
    would make the check meaningless. Sampling the field at the window's own
    edges is exact here because it is linear in y (and in x) over these rows.
    """
    x0, y0, x1, y1 = MOUTH_BOX
    if field is not None:
        dx, dy = field
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        x0, x1 = x0 + dx[cy, x0], x1 + dx[cy, x1 - 1]
        y0, y1 = y0 + dy[y0, cx], y1 + dy[y1 - 1, cx]
    x0, y0 = int(np.floor(x0)), int(np.floor(y0))
    x1, y1 = int(np.ceil(x1)), int(np.ceil(y1))
    sub = img[y0:y1, x0:x1]
    m = (sub[..., 3] > 128) & (sub[..., :3].max(axis=2) < 90)
    assert m.any(), 'mouth window is empty'
    ys, xs = np.nonzero(m)
    return xs.mean() + x0, ys.mean() + y0, int(m.sum())


def verify_mouth_travels(name, frames, plan, body):
    """The open mouth must ride the head, not sit at fixed canvas rows.

    This is the bug the user caught: on `cheer` the body lifts 21px and the head
    lags another 6 on top of a stretch about the paw line, and the mouth -- which
    was painted AFTER the warp -- stayed behind on the chest while the face rose.

    The check is exact rather than approximate, because the fields here are
    linear in y over the muzzle (scale_about is linear; the lift and lag weights
    are both saturated at 1 this far up the body). For a linear field, the
    displacement at the centroid IS the mean displacement over the mask -- so the
    mouth's measured travel has to equal the field sampled at its rest position,
    not merely resemble it.
    """
    rest = {}
    for body_f, _, level, _ in plan:
        if level and level not in rest:
            rest[level] = mouth_centroid(open_mouth(body, level))
    if not rest:
        return
    for i, ((body_f, _, level, _), f) in enumerate(zip(plan, frames)):
        if not level:
            continue
        mx, my, mn = rest[level]
        if body_f is ZERO:
            edx = edy = 0.0
        else:
            edx = float(body_f[0][int(round(my)), int(round(mx))])
            edy = float(body_f[1][int(round(my)), int(round(mx))])
        gx, gy, gn = mouth_centroid(f, body_f if body_f is not ZERO else None)
        # Area first. If the mouth stayed behind while the window rode the head,
        # the window lands on part of the muzzle and still finds SOME dark
        # pixels -- so a centroid test alone could be satisfied by the wrong
        # anatomy. The mask area only changes by the warp's own scale factor.
        assert abs(gn - mn) < 0.15 * mn, (
            '%s frame %d: the muzzle window holds %d dark px, rest pose has %d. '
            'The mouth is not where the head went.' % (name, i, gn, mn))
        ex, ey = abs(gx - (mx + edx)), abs(gy - (my + edy))
        assert max(ex, ey) < 1.5, (
            '%s frame %d: the mouth did not travel with the head. Expected the '
            'cavity at (%.1f, %.1f), found it at (%.1f, %.1f) -- off by '
            '(%.1f, %.1f)px.' % (name, i, mx + edx, my + edy, gx, gy, ex, ey))


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
    assert all(tf is ZERO for _, tf, _, _ in plan),         '%s is head-only but handed the tail layer a field' % name

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
    hulls = eye_hulls(body)
    print('%s + %s  %dx%d   baking at %.3fx  (ship width %.0f CSS px)'
          % (SRC_BODY, SRC_TAIL, CANVAS[0], CANVAS[1], BAKE_SCALE, SHIP_W))

    for name, plan_fn, n, ms, why in EXPRESSIONS:
        print('\n%s  -- %s' % (name, why))
        plan = plan_fn(body.shape[:2], n, body) if plan_fn is plan_ear else plan_fn(body.shape[:2], n)
        full, bodies = render(body, tail, plan, hulls)
        rect = union_bbox(full)
        verify(name, full, rect, ref)
        if name in HEAD_ONLY:
            verify_tail_still(name, full, bodies, plan, body, tail, ref)
            print('  tail: verified still')
        if any(m for _, _, m, _ in plan):
            verify_mouth_travels(name, full, plan, body)
            print('  mouth: verified travelling with the head')
        cropped = [L.crop(f, rect) for f in full]

        L.write_strip(name, cropped, name.replace('good', 'eren_').lower() + '.webp',
                      ms, CANVAS, rect, kind='loop', body_src=None,
                      scale=BAKE_SCALE, lossless=False, quality=80, note=why)
        L.write_filmstrip(cropped, name + '_strip.png', scale=BAKE_SCALE * 0.9,
                          bg=(38, 24, 62))


if __name__ == '__main__':
    main()
