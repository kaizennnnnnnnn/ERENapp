"""Bake Eren's blink as real frames, drawn on the art's own block grid.

Replaces the CSS gradient ellipse that scaleY's over each eye (@keyframes
erenBlink) -- a shape nobody drew -- with the eyelid the artist would have
drawn: the socket fills with the fur that surrounds it, and the eye's black
collapses onto a lid seam quantised to the art's own block grid.

Output is a tight overlay strip over BOTH eyes, at scale 1.0 so the browser
downscales it by exactly the factor it downscales the body PNG by.

    py scripts/anim_blink.py          (run from the repo root; `py`, not `python`)

THE OVERLAY PAINTS ONLY THE EYELID, NOT THE FACE
------------------------------------------------
The frame is 376x152 because that is the box the lid has to be positioned in,
but its ALPHA is cut to the two sockets and nothing else:

    frame 0 (open)   alpha 0 everywhere. The body PNG's own eyes are the
                     resting pose, so the honest way to draw "no blink" is to
                     draw nothing. The eyes are open 94% of the 6s cycle, so
                     for 94% of the time this layer contributes zero pixels.
    frame 1 / 2      alpha 1 over exactly the pixels this frame changed (plus a
                     2px dilation), ramping to 0 over the next 8px.

Two things depended on that and both were broken while the frame was an opaque
rectangle:

  * the animated catchlights. StripEren paints them UNDER this strip on purpose,
    so a closing lid covers the shine. An opaque frame 0 covered the shine all
    the time -- the 5s erenEyeShine was running on an invisible div.
  * the face's own rendering. The body goes 959 -> 131 CSS px; a 376px-wide
    frame goes -> 51.4 px from a SEPARATELY decoded image. Same source pixels,
    different scale factor and filter phase, so an opaque band does not land on
    the head the way the head landed and its border prints a faint line across
    the forehead. Transparent frame 0 means that cannot happen at rest, and the
    8px ramp means even mid-blink it fades instead of stepping. browser_check()
    below measures it on the SHIPPED file rather than trusting the argument.

WHICH CLOSED EYE -- seven were baked and looked at, big and at shipping size
---------------------------------------------------------------------------
Shipped: `bot2`. The seam is the socket's own bottom TWO block rows, so it is
the lower edge the artist already drew -- a shallow bowl, deepest in the middle,
lifting at both corners -- and the fur fills everything above it.

    mid1  1-block seam at the socket's middle .. at 131 CSS px it is a 2.4px
          line and reads as a smudge, not an eye
    mid2  2 blocks at the middle ............. reads as a frown / eyebrow bar
    flat1 1 block straight across ............ reads as an erased eye, and the
          straight line ignores that the eye is tilted
    bot1  1 block on the bottom edge ......... right shape, too thin to carry
    bot2  2 blocks on the bottom edge ........ SHIPPED: 4.9 CSS px of arc, reads
          unmistakably as a closed eye, and invents no shape
    bot2up bot2 lifted one block row -- REJECTED, see below
    bot2r bot2 with the corner lift capped at one block -- flatter, and the per-
          eye shape loses the readable U

WHY NOT LIFT THE ARC (bot2up)
-----------------------------
Sitting the arc on the socket floor does leave four block rows of plain brow
above it, and at 131 CSS px that is a fair complaint: the face reads a little
heavy-browed. Lifting the whole arc one row centres it on the eye. It was baked,
rendered at ship size next to bot2, and rejected, for a reason that is about
motion rather than taste:

The half frame's lid is the socket's own top contour plus two blocks, so at the
OUTER and INNER columns -- where the socket is only three blocks deep -- the eye
is already fully shut on frame 1. bot2's arc at those columns is rows 2..3 and
3..4, which CONTAINS the half frame's single black row: between frame 1 and
frame 2 the corner's black grows, it never moves. bot2up's arc is rows 1..2 and
2..3, disjoint from it: the black jumps from the bottom of the corner to the top
of it and the fur underneath reopens, twice per blink, 42ms apart. descent_check()
asserts the general form of that -- the lid's leading edge may never travel back
up -- and bot2up fails it at both outer columns by two block rows.

Shape, second: with the arc lifted off the muzzle line the outer ends stop
tapering into the cheek and read as two tall vertical brackets rather than a
lash line. Visible at 13x of ship size, marginal at 1x.

Third, the brow only reads as sullen if you hold frame 2, and nothing holds it:
erenBlinkSlide gives it 72ms twice per 6s, and `paused`/`reduced` rests on
frame 0.

The decision was made on scripts/anim_preview/blink_candidates_real.png and
blink_browser.png, which are the only views at the size this actually ships at.

MEASURED ART GRID (pixel scan of public/ErenCook_notail.png, 959x1536)
----------------------------------------------------------------------
The sprite is pixel art on a ~60x87 logical grid, upscaled with soft
resampling. Scanned from the ink mask, both eyes land on the same grid:

    block          16.714 px across, 17.917 px down
    eye ink top    y = 552 (block row 0); bottom y = 659.5 (6 block rows)
    left eye       x 322..439  (7 block columns from x0 = 322)
    right eye      x 537..654  (7 block columns from x0 = 537)
    fur->ink edge  ~1.9 px ramp (y551 = 84, y552 = 33, y553 = 3, y554 = 0)
    eye black      mean (1.2, 1.6, 1.7) -- effectively pure black
    fur above      flat taupe, median ~(89, 77, 67), rows 536..551

The socket is NOT a rectangle: it is a hexagonal blob tilted down toward the
nose (outer block column spans rows 1..3, inner spans 2..4), so both the lid
seam and the half-lid are derived from the socket's own per-column extent
rather than assumed flat. Measured, left eye: tops 1 0 0 0 0 1 2, bottoms
3 4 5 5 5 5 4; the right eye is its mirror.
"""

import os
import sys

sys.path.insert(0, 'scripts')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

import anim_lib as L

BODY = 'ErenCook_notail.png'
CANVAS = (959, 1536)

BLOCK_W = 16.714
BLOCK_H = 17.917
EYE_TOP = 552.0
N_COL = 7
N_ROW = 6
EYE_X0 = ((322.0, +1), (537.0, -1))     # (leftmost block boundary, nose side)

INK = np.array([2.0, 2.0, 2.0])         # the eye's own black
RAMP = 1.9                              # the art's own edge ramp, in px
EXT = 2.5                               # overshoot so no antialiased sliver of
                                        # the open eye survives under a fill
OVERLAP = RAMP * 0.5 + 1.0              # interior block columns overlap by this
                                        # much and their coverage is MAXed, so
                                        # two columns of unequal height cannot
                                        # leave a half-covered seam on the
                                        # boundary they share. _win reaches 1.0
                                        # half a ramp inside its own edge, and a
                                        # block boundary can fall up to a whole
                                        # pixel from the nearest sample centre,
                                        # so half a ramp plus one pixel is the
                                        # smallest overlap that reaches 1.0 on
                                        # every SAMPLED pixel of the boundary.
                                        # RAMP*0.6 left 0.94 coverage on one
                                        # column and 6% of the ink with it (see
                                        # build())

# The frame box. Generous on purpose: the lid needs room, and the alpha cut is
# what keeps the overlay off the rest of the face -- not a tight crop.
CROP = (300, 530, 676, 682)
GROW = 2                                # px of alpha-1 margin around the change
FADE = 8                                # px the alpha ramps to 0 over

# The animated catchlights StripEren paints UNDER this strip (COOK_GLINTS in
# FeedScene.tsx), as the shine DOT's box in canvas percent: left, top, w, h.
# Frame 0 has to leave them alone and frames 1/2 have to hide them -- that is
# the whole reason the strip sits above them in the layer order.
GLINT_DOTS = (
    (35.35 + 0.603 * 8.65, 37.11 + 0.03 * 4.56, 0.18 * 8.65, 0.18 * 8.65 * 959.0 / 1536.0),
    (57.77 + 0.205 * 8.65, 37.11 + 0.03 * 4.56, 0.18 * 8.65, 0.18 * 8.65 * 959.0 / 1536.0),
)

FACE = (300, 520, 680, 700)             # judging crop of the composite
SHIP_W, SHIP_H = 131.0, 210.0           # the sprite's CSS box in the kitchen
SCREEN = SHIP_W / CANVAS[0]             # the sprite's true on-screen scale


# -- measurement -----------------------------------------------------------

def ink_mask(body):
    """Everything that is not fur/white: the eye's black and its blue iris."""
    rgb, a = body[..., :3], body[..., 3]
    black = (rgb.max(axis=2) < 70) & (a > 128)
    blue = (rgb[..., 2] > rgb[..., 0] + 50) & (rgb[..., 2] > 110) & (a > 128)
    return black | blue


def socket_blocks(ink, x0, ywin=(545, 672), inset=3):
    """Per block column, the (first, last) block row the eye's ink occupies.

    Scanned over the column's INTERIOR: the 2px antialias ramp a neighbouring
    block bleeds across the boundary is one column wide and would otherwise
    hand a column its neighbour's taller extent.
    """
    out = []
    for k in range(N_COL):
        xa = int(round(x0 + k * BLOCK_W)) + inset
        xb = int(round(x0 + (k + 1) * BLOCK_W)) - inset
        hit = ink[ywin[0]:ywin[1], xa:xb].mean(axis=1) >= 0.4
        rows = np.where(hit)[0] + ywin[0]
        jt = int(round((rows.min() - EYE_TOP) / BLOCK_H))
        jb = int(round((rows.max() + 1 - EYE_TOP) / BLOCK_H)) - 1
        out.append((max(0, jt), min(N_ROW - 1, jb)))
    return out


def eye_hull(ink, rect):
    """The two eyes as solid shapes: the ink with its holes filled, so the white
    catchlight counts as eye and a fill is allowed to cover it."""
    x_lo, y_lo, x_hi, y_hi = rect
    band = np.zeros((y_hi - y_lo, x_hi - x_lo), dtype=bool)
    band[545 - y_lo:672 - y_lo] = ink[545:672, x_lo:x_hi]
    return ndimage.binary_fill_holes(band)


def writable(body, rect, hull):
    """Where a fill is allowed to write: inside the eye, or anywhere the
    original is dark -- i.e. fur, including the eye's own antialias fringe,
    which is dark by definition. The white muzzle blaze rises to within 1px of
    the left eye's inner-bottom corner, so this is what keeps a fill's overshoot
    off it: by construction, not by hoping the rect is tight enough.

    The hull term gets NO outward allowance and the dark cutoff is 100..120.
    Three tries were needed: a 2px hull dilation let ~15 units of fur onto 11
    blaze pixels at the inner corners, a 120..160 cutoff onto 4 more, and a
    1.9px ramp on the hull onto 3. Fur tops out near luma 90 and the eye's own
    fringe ramps from 78 down to 2, so nothing this baker legitimately writes
    is anywhere near 100 -- the allowance was never buying anything.
    """
    lum = L.crop(body, rect)[..., :3].mean(axis=2)
    dark = 1.0 - L.smoothstep((lum - 100.0) / 20.0)
    return np.maximum(hull.astype(np.float64), dark)


# -- the lid ---------------------------------------------------------------

def lid_plan(blocks, inner, *, frac=None, mode='tilt', thick=1, rise=None,
             off=0, lift=0):
    """Block row the lid seam's TOP lands on, per block column.

    'tilt'    the seam sits at `frac` of each column's OWN socket height, so it
              inherits the eye's downward tilt and steps once, like a drawn
              line (technique a: the lid descends over the socket).
    'flat'    one block row straight across the whole eye (technique b).
    'offset'  the seam is the socket's own TOP contour pushed down `off` blocks,
              so a half-lidded eye keeps the tilt the artist drew and the
              aperture below it is the same height in every column. Not
              monotone-filtered: the socket's own contour is the shape, and
              flattening it is what made the half frame read as a brow bar.
    'bottom'  the seam is the socket's own bottom `thick` blocks, so it takes
              the shape the artist already drew for the eye's lower edge -- a
              shallow bowl, deepest in the middle, rising at both corners.
              `lift` raises that whole arc by n block rows (still clamped
              inside the socket) without changing its shape.

    Always snapped to the block grid and clamped inside the socket. 'tilt' and
    'flat' also get a monotone pass toward the nose so the line steps once
    instead of jittering column to column.
    """
    if mode == 'bottom':
        j = [max(bt, bb - (thick - 1) - lift) for bt, bb in blocks]
        if rise is not None:      # cap how far the corners lift off the deepest
            j = [min(max(v, max(j) - rise), bb) for v, (_, bb) in zip(j, blocks)]
        return j, [thick] * N_COL

    if mode == 'offset':
        return [min(bt + off, bb) for bt, bb in blocks], [thick] * N_COL

    if mode == 'flat':
        jt = min(b[0] for b in blocks)
        jb = max(b[1] for b in blocks)
        j = [int(np.floor(jt + frac * (jb - jt + 1) + 0.5))] * N_COL
    else:
        j = [int(np.floor(bt + frac * (bb - bt + 1) + 0.5)) for bt, bb in blocks]
    j = [min(max(v, blocks[i][0]), blocks[i][1]) for i, v in enumerate(j)]

    order = range(N_COL) if inner > 0 else range(N_COL - 1, -1, -1)
    run, out = None, [0] * N_COL
    for i in order:
        run = j[i] if run is None else max(run, j[i])
        out[i] = min(run, blocks[i][1])
    return out, [thick] * N_COL


def eye_plan(blocks, x0, inner, *, clear_below=False, **kw):
    lid, th = lid_plan(blocks, inner, **kw)
    return dict(x0=x0, blocks=blocks, lid=lid, thick=th, clear_below=clear_below)


# -- fur -------------------------------------------------------------------

GRAIN_HI = 1.3          # measured: the brow fur's per-pixel grain, std
GRAIN_LO = 2.4          # and its slow level drift (the band runs 79..98)


def fur_field(body, rect, hull, seed=20260917):
    """The fur a closed lid is made of.

    LEVEL: not one flat taupe. The real fur drifts smoothly (the brow band runs
    79..98 in R), so a single median would step in tone against the socket's own
    surround. This takes a normalised-convolution estimate of the fur level --
    every CLEAN fur pixel, smoothed wide enough to extrapolate across the
    socket, with ink, its antialias fringe, white and the blaze excluded from
    BOTH numerator and weight -- so the fill meets the surrounding fur at
    exactly its local value.

    Excluding the fringe matters more than it looks: the socket's whole
    perimeter is antialiased ink at luma 40..120, and counting those as fur
    dragged the extrapolated level inside the socket down to 30 (vs a true ~90).

    GRAIN: generated, and monochrome. Measured on the brow band, the grain is
    std 1.3 per pixel with the channels 0.9+ correlated, i.e. luminance noise on
    one flat hue. Independent per-channel noise reads as colour speckle, and
    tiling a real fur band repeats the SAME noise every period, which reads as a
    dapple even when the source's own noise is below threshold.
    """
    x_lo, y_lo, x_hi, y_hi = rect
    img = L.crop(body, rect)[..., :3]
    lum = img.mean(axis=2)
    clean = ndimage.distance_transform_edt(~hull) > 3.0
    w = ((lum > 55.0) & (lum < 118.0) & clean).astype(np.float64)[..., None]
    s = (24.0, 24.0, 0.0)
    num = ndimage.gaussian_filter(img * w, s, mode='nearest')
    den = ndimage.gaussian_filter(np.repeat(w, 3, axis=2), s, mode='nearest')
    level = num / np.maximum(den, 1e-6)

    rng = np.random.default_rng(seed)
    n = rng.standard_normal((y_hi - y_lo, x_hi - x_lo))
    def octave(sigma, target):
        g = ndimage.gaussian_filter(n, sigma, mode='reflect')
        return g * (target / max(g.std(), 1e-6))
    grain = octave(0.8, GRAIN_HI) + octave(7.0, GRAIN_LO)
    return level + grain[..., None], level, grain


# -- frame construction ----------------------------------------------------

def _win(coord, lo, hi, ramp):
    """1 inside [lo, hi), ramping over `ramp` px CENTRED on each boundary, so a
    step in the seam reads as the art's own 2px antialiasing."""
    up = L.smoothstep((coord - lo) / ramp + 0.5)
    dn = 1.0 - L.smoothstep((coord - hi) / ramp + 0.5)
    return np.minimum(up, dn)


def build(body, rect, plan, fur, gate=None):
    """Fur over the socket down to the seam, then the black seam on top of it.

    Fur is laid through the seam band rather than up to it, so the seam's upper
    edge antialiases against fur and never lets a sliver of the open eye bleed
    into the ramp.

    Coverage from neighbouring block columns is MAXed, and every interior
    boundary is OVERLAPPED by OVERLAP px so both columns already read 1.0 where
    they meet. Abutting the windows and summing them is exact only while the two
    columns have the same vertical extent; where they do not -- and the socket
    steps in five places per eye -- the taller column contributes 1 and the
    shorter 0, they sum to 0.5, and half the original ink survives as a 1px line
    down the shared edge. That is what left a 1x15px dark sliver in the right
    eye at x=570 (the col1/col2 boundary). Overlapping costs a <3px overhang
    where a step occurs, which is fur written onto fur -- invisible by
    construction -- and 0.4 CSS px on the seam's staircase.
    """
    x_lo, y_lo, x_hi, y_hi = rect
    out = L.crop(body, rect)
    h, w, _ = out.shape
    xs = np.arange(x_lo, x_hi, dtype=np.float64)
    ys = np.arange(y_lo, y_hi, dtype=np.float64)
    cov_fur = np.zeros((h, w))
    cov_lid = np.zeros((h, w))

    for eye in plan:
        for k in range(N_COL):
            xa = eye['x0'] + k * BLOCK_W - (EXT if k == 0 else OVERLAP)
            xb = eye['x0'] + (k + 1) * BLOCK_W + (EXT if k == N_COL - 1 else OVERLAP)
            hw = _win(xs, xa, xb, RAMP)[None, :]

            jt, jb = eye['blocks'][k]
            jl, th = eye['lid'][k], eye['thick'][k]
            y_top = EYE_TOP + jt * BLOCK_H - EXT
            y_seam0 = EYE_TOP + jl * BLOCK_H
            y_floor = EYE_TOP + (jb + 1) * BLOCK_H
            y_seam1 = min(EYE_TOP + (jl + th) * BLOCK_H, y_floor)
            y_fur1 = y_floor + EXT if eye['clear_below'] else y_seam1

            cov_fur = np.maximum(cov_fur, hw * _win(ys, y_top, y_fur1, RAMP)[:, None])
            cov_lid = np.maximum(cov_lid, hw * _win(ys, y_seam0, y_seam1, RAMP)[:, None])

    if gate is not None:
        cov_fur = np.minimum(cov_fur, gate)
        cov_lid = np.minimum(cov_lid, gate)

    base = out[..., :3]
    mid = base * (1.0 - cov_fur)[..., None] + fur * cov_fur[..., None]
    out[..., :3] = mid * (1.0 - cov_lid)[..., None] + INK * cov_lid[..., None]
    return out


def cut_alpha(frame, base, *, grow=GROW, fade=FADE):
    """Keep the pixels this frame actually changed and throw the rest away.

    alpha is 1 over the changed pixels dilated by `grow`, then falls to 0 over
    the next `fade` px measured as a true distance, so the boundary hugs the
    socket instead of being a rectangle. RGB is left untouched everywhere,
    including under alpha 0: a decoder that interpolates un-premultiplied would
    otherwise pull black out of the cleared region and print a halo.

    A frame that changed nothing comes back fully transparent -- which is the
    honest drawing of "the eyes are open", since the body PNG already draws them.
    """
    out = frame.copy()
    d = np.abs(frame[..., :3] - base[..., :3]).max(axis=2) > 0.5
    if not d.any():
        out[..., 3] = 0.0
        return out
    g = ndimage.binary_dilation(d, ndimage.generate_binary_structure(2, 2),
                                iterations=grow)
    dist = ndimage.distance_transform_edt(~g)
    out[..., 3] = base[..., 3] * (1.0 - L.smoothstep(dist / float(fade)))
    return out


def composite(body, frame, rect):
    out = body.copy()
    x0, y0, x1, y1 = rect
    dst = out[y0:y1, x0:x1]
    a = frame[..., 3:4] / 255.0
    dst[..., :3] = dst[..., :3] * (1.0 - a) + frame[..., :3] * a
    dst[..., 3:4] = np.maximum(dst[..., 3:4], frame[..., 3:4])
    return out


# -- previews --------------------------------------------------------------

def sheet(images, out_file, *, bg=(228, 228, 234), gutter=6, labels=None, cols=None):
    """Contact sheet of already-sized PIL RGB images. Wraps at `cols` so no
    sheet's longest side passes 2000px (vision silently drops larger images)."""
    fw, fh = images[0].size
    head = 14
    cols = cols or len(images)
    rows = (len(images) + cols - 1) // cols
    W = cols * fw + (cols + 1) * gutter
    H = rows * (fh + head) + (rows + 1) * gutter
    im = Image.new('RGB', (W, H), bg)
    d = ImageDraw.Draw(im)
    labels = labels or [str(i) for i in range(len(images))]
    for i, f in enumerate(images):
        r, c = divmod(i, cols)
        x = gutter + c * (fw + gutter)
        y = gutter + r * (fh + head + gutter)
        d.text((x + 2, y), labels[i], fill=(30, 30, 30))
        im.paste(f, (x, y + head))
    p = os.path.join(L.PREVIEW_DIR, out_file)
    im.save(p)
    print('  preview -> %s  (%dx%d)' % (p, W, H))
    return p


def alpha_img(frame, rect):
    """The frame's alpha as an image, with the two catchlight dots outlined in
    red: white means the strip paints there, so a dot inside white is a shine
    this frame hides, and a dot on black is a shine it lets through."""
    a = np.clip(frame[..., 3], 0, 255).astype(np.uint8)
    im = Image.fromarray(np.repeat(a[..., None], 3, axis=2))
    d = ImageDraw.Draw(im)
    cw, ch = CANVAS
    x_lo, y_lo, _, _ = rect
    for gl, gt, gw, gh in GLINT_DOTS:
        d.rectangle([gl / 100.0 * cw - x_lo, gt / 100.0 * ch - y_lo,
                     (gl + gw) / 100.0 * cw - x_lo, (gt + gh) / 100.0 * ch - y_lo],
                    outline=(230, 40, 40), width=2)
    return im


def face_img(comp, scale):
    c = L.crop(comp, FACE)
    im = L.to_pil(c)
    flat = Image.new('RGB', im.size, (228, 228, 234))
    flat.paste(im, (0, 0), im)
    return flat.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)


def real_img(comp, up=4):
    """The face at the size it actually ships at: LANCZOS down by 131/959, then
    NEAREST up so we can see those few pixels. This scales the COMPOSITE, i.e.
    the best case -- browser_img() is the honest one."""
    c = L.crop(comp, FACE)
    im = L.to_pil(c)
    flat = Image.new('RGB', im.size, (228, 228, 234))
    flat.paste(im, (0, 0), im)
    w = max(1, int(round(im.width * SCREEN)))
    h = max(1, int(round(im.height * SCREEN)))
    return flat.resize((w, h), Image.LANCZOS).resize((w * up, h * up), Image.NEAREST)


# -- the browser's own path ------------------------------------------------

def browser_paint(body, frame, rect, dpr=1):
    """Downscale the body and the strip frame SEPARATELY, the way the browser
    does, then composite -- so any mismatch between the two scale phases shows
    up instead of being hidden by compositing at full resolution first.

    Returns (painted, body_only) as RGBA PIL images of the sprite's CSS box.
    """
    cw, ch = CANVAS
    W, H = int(round(SHIP_W * dpr)), int(round(SHIP_H * dpr))
    body_only = L.to_pil(body).resize((W, H), Image.LANCZOS)
    x0, y0, x1, y1 = rect
    fw = max(1, int(round((x1 - x0) / float(cw) * W)))
    fh = max(1, int(round((y1 - y0) / float(ch) * H)))
    ox = int(round(x0 / float(cw) * W))
    oy = int(round(y0 / float(ch) * H))
    painted = body_only.copy()
    painted.alpha_composite(L.to_pil(frame).resize((fw, fh), Image.LANCZOS), (ox, oy))
    return painted, body_only


def browser_img(body, frame, rect, up=6, dpr=1):
    painted, _ = browser_paint(body, frame, rect, dpr)
    flat = Image.new('RGB', painted.size, (228, 228, 234))
    flat.paste(painted, (0, 0), painted)
    # crop to the head so the sheet is readable
    box = (int(0.22 * flat.width), int(0.14 * flat.height),
           int(0.80 * flat.width), int(0.44 * flat.height))
    c = flat.crop(box)
    return c.resize((c.width * up, c.height * up), Image.NEAREST)


def browser_check(body, frames, names, rect, changed_masks):
    """Issue 3, measured instead of argued: how far does the separately-scaled
    overlay push the face away from what the body alone would have painted, in
    the region the frame did NOT mean to change?"""
    print('\n  browser path (body and strip scaled separately, then composited)')
    for dpr in (1, 2, 3):
        for f, n, ch in zip(frames, names, changed_masks):
            painted, plain = browser_paint(body, f, rect, dpr)
            a = np.asarray(painted, dtype=np.float64)[..., :3]
            b = np.asarray(plain, dtype=np.float64)[..., :3]
            d = np.abs(a - b).max(axis=2)
            # the same change mask, taken down the same path, marks where the
            # frame is SUPPOSED to differ
            cw, chh = CANVAS
            W, H = painted.size
            x0, y0, x1, y1 = rect
            m = Image.fromarray((ch * 255).astype(np.uint8)).resize(
                (max(1, int(round((x1 - x0) / float(cw) * W))),
                 max(1, int(round((y1 - y0) / float(chh) * H)))), Image.LANCZOS)
            full = Image.new('L', painted.size, 0)
            full.paste(m, (int(round(x0 / float(cw) * W)), int(round(y0 / float(chh) * H))))
            intended = np.asarray(full, dtype=np.float64) > 6.0
            # the eyelid's own antialiased edge lands just outside a mask that
            # was itself downscaled, so anything within a 2px collar of the lid
            # is the lid. Past the collar is the face, and that is the number
            # issue 3 is about.
            collar = ndimage.binary_dilation(intended, iterations=2)
            edge, face = d[~intended], d[~collar]
            print('    dpr %d  %-6s  lid edge +-2px: max %5.1f   REST OF THE FACE: '
                  'max %4.1f  mean %.3f  px>2: %d'
                  % (dpr, n, edge.max(), face.max(), face.mean(),
                     int((face > 2).sum())))
            assert face.max() <= 4.0, (
                '%s at dpr %d moves the face by %.1f outside the eyelid'
                % (n, dpr, face.max()))


# -- checks ----------------------------------------------------------------

def report(frames, names, rect, hull, body, covers=None):
    x_lo, y_lo, x_hi, y_hi = rect
    base = L.crop(body, rect)
    light = (base[..., :3].mean(axis=2) > 140.0) & ~hull
    print('\n  numeric check (crop %s, %dx%d)' % (str(rect), x_hi - x_lo, y_hi - y_lo))
    for f, n in zip(frames, names):
        d = np.abs(f[..., :3] - base[..., :3]).max(axis=2)
        changed = d > 0.5
        a = f[..., 3]
        line = ('    %-5s maxdiff-vs-body %5.1f  changed %6d px  alpha>0 on %6d px '
                '(%.1f%% of the frame)'
                % (n, d.max(), changed.sum(), int((a > 0.5).sum()),
                   100.0 * (a > 0.5).mean()))
        if changed.any():
            ys, xs = np.where(changed)
            m = min(xs.min(), ys.min(),
                    (x_hi - x_lo - 1) - xs.max(), (y_hi - y_lo - 1) - ys.max())
            line += ('\n          bbox x %d..%d y %d..%d  margin %dpx'
                     % (x_lo + xs.min(), x_lo + xs.max(),
                        y_lo + ys.min(), y_lo + ys.max(), m))
            stray = int((changed & light).sum())
            assert stray == 0, ('%s writes %d px that were light and outside the eye '
                                '(blaze / whiskers)' % (n, stray))
            # every changed pixel must be carried at full alpha, or the fill is
            # blended back toward the eye it is covering
            assert a[changed].min() > 254.5, (
                '%s has a changed pixel at alpha %.1f' % (n, a[changed].min()))
            if covers and covers[names.index(n)]:
                # the shut frame has to hide the whole eye; the half frame is
                # supposed to leave its lower aperture showing, so only the part
                # it covers is asserted (by the `changed` test just above)
                assert a[hull].min() > 254.5, (
                    '%s does not cover the open eye at alpha 1 (min %.1f)' % (n, a[hull].min()))
        else:
            assert a.max() == 0.0, 'frame %s changed nothing but is not transparent' % n
        print(line)
        b = max(f[0, :, 3].max(), f[-1, :, 3].max(), f[:, 0, 3].max(), f[:, -1, 3].max())
        assert b == 0.0, 'frame %s touches the crop border with alpha %.1f' % (n, b)


def fur_only_mask(eye, rect, hull):
    """The eye pixels this frame fills with fur and nothing else -- BLOCK
    BOUNDARIES INCLUDED, because a boundary is the only place a coverage
    shortfall can hide.

    Both limits are evaluated per output column from every block column whose
    window reaches that x, not per block rectangle. Two neighbours of unequal
    height both write across the boundary they share, so a pixel there is
    "above the seam" only if it is above BOTH seams -- scanning block rectangles
    instead flags the shorter column's own legitimate overhang, and misses the
    one-pixel line this check exists to catch.
    """
    x_lo, y_lo, x_hi, y_hi = rect
    xs = np.arange(x_lo, x_hi, dtype=np.float64)
    fur_top = np.full(xs.shape, np.inf)
    seam_top = np.full(xs.shape, np.inf)
    for k in range(N_COL):
        xa = eye['x0'] + k * BLOCK_W - (EXT if k == 0 else OVERLAP)
        xb = eye['x0'] + (k + 1) * BLOCK_W + (EXT if k == N_COL - 1 else OVERLAP)
        hit = _win(xs, xa, xb, RAMP) > 0.02
        jt, jl = eye['blocks'][k][0], eye['lid'][k]
        fur_top = np.where(hit, np.minimum(fur_top, EYE_TOP + jt * BLOCK_H), fur_top)
        seam_top = np.where(hit, np.minimum(seam_top, EYE_TOP + jl * BLOCK_H), seam_top)
    ys = np.arange(y_lo, y_hi, dtype=np.float64)[:, None]
    return hull & (ys >= fur_top[None, :] + RAMP) & (ys < seam_top[None, :] - RAMP)


def seam_check(frames, names, plans, rect, hull):
    """Issue 4: no surviving ink anywhere the lid filled with fur, on EITHER eye,
    and the two eyes have to come out of the same scan."""
    print('\n  fur-fill purity (no ink may survive above the seam)')
    for f, n, plan in zip(frames, names, plans):
        for side, eye in zip(('left', 'right'), plan):
            m = fur_only_mask(eye, rect, hull)
            lum = f[..., :3].mean(axis=2)[m]
            dark = int((lum < 60.0).sum())
            print('    %-5s %-5s eye  %5d px scanned  luma %.0f..%.0f  under 60: %d'
                  % (n, side, m.sum(), lum.min(), lum.max(), dark))
            assert dark == 0, ('%s %s eye keeps %d ink px above the seam'
                               % (n, side, dark))


def glint_check(frames, names, rect):
    """Issue 2, asserted: the catchlights are siblings UNDER this strip, so the
    strip's alpha over them is exactly how much of the shine survives. Frame 0
    must let 100% through (the eyes are open) and the closing frames must hide
    all of it (a shut eye has no catchlight)."""
    cw, ch = CANVAS
    x_lo, y_lo, _, _ = rect
    print('\n  catchlights (painted under this strip, so alpha here IS occlusion)')
    for f, n in zip(frames, names):
        seen = []
        for gl, gt, gw, gh in GLINT_DOTS:
            x0 = int(np.floor(gl / 100.0 * cw)) - x_lo
            y0 = int(np.floor(gt / 100.0 * ch)) - y_lo
            x1 = int(np.ceil((gl + gw) / 100.0 * cw)) - x_lo
            y1 = int(np.ceil((gt + gh) / 100.0 * ch)) - y_lo
            seen.append(100.0 * (1.0 - f[y0:y1, x0:x1, 3] / 255.0).mean())
        print('    %-5s shine visible: left %5.1f%%  right %5.1f%%' % (n, seen[0], seen[1]))
        want_hidden = n != 'open'
        for v in seen:
            if want_hidden:
                assert v == 0.0, '%s leaves %.1f%% of a catchlight showing' % (n, v)
            else:
                assert v == 100.0, '%s hides %.1f%% of a catchlight' % (n, 100.0 - v)


def descent_check(half, shut, names=('left', 'right')):
    """The lid closes; it never reopens. Per block column, the BOTTOM of the
    half frame's seam -- the lid's leading edge -- may not sit below the bottom
    of the shut frame's seam. Violating it means the black jumps upward between
    two frames 42ms apart, which is what ruled out lifting the arc (bot2up)."""
    print('\n  lid descent (the leading edge may only move down)')
    for side, h, s in zip(names, half, shut):
        hb = [j + t for j, t in zip(h['lid'], h['thick'])]
        sb = [j + t for j, t in zip(s['lid'], s['thick'])]
        bad = [(k, hb[k], sb[k]) for k in range(N_COL) if hb[k] > sb[k]]
        print('    %-5s eye  half edge %s  shut edge %s  reversals %s'
              % (side, hb, sb, bad or 'none'))
        assert not bad, ('%s eye: the lid travels back up at columns %s'
                         % (side, [b[0] for b in bad]))


def leak_check(body, rect, plan, fur, gate, hull):
    """The same question asked exactly, with no geometry at all: rebuild the shut
    frame from a body whose eyes have been PAINTED OUT, and diff. Wherever the
    lid's coverage is complete the two builds are identical; any pixel where the
    original ink still influences the result is a pixel the lid failed to cover,
    whatever column or boundary it sits on."""
    x_lo, y_lo, x_hi, y_hi = rect
    clean = body.copy()
    dil = ndimage.binary_dilation(hull, iterations=3)
    win = clean[y_lo:y_hi, x_lo:x_hi]
    win[..., :3] = np.where(dil[..., None], fur, win[..., :3])
    a = build(body, rect, plan, fur, gate)
    b = build(clean, rect, plan, fur, gate)
    d = np.abs(a - b).max(axis=2)
    print('    shut frame vs the same bake off an eyeless body: max leak %.2f '
          'inside the eye, %.2f inside the eye+3px' % (d[hull].max(), d[dil].max()))
    assert d[hull].max() < 0.2, 'the original ink still shows through the shut lid'


def verify_shipped(out_file, body, rect, hull, n_frames):
    """Assert on the FILE, not on the array that went into it. The previous bake
    shipped an opaque RGB rectangle while every assertion passed, because the
    assertions ran on a feathered copy that was never written."""
    p = os.path.join(L.ANIM_DIR, out_file)
    im = Image.open(p)
    print('\n  shipped file %s' % p)
    print('    PIL mode %s  size %s  has_transparency_data %s'
          % (im.mode, im.size, getattr(im, 'has_transparency_data', None)))
    assert im.mode == 'RGBA', 'shipped strip has no alpha channel (mode %s)' % im.mode
    with open(p, 'rb') as fp:
        head = fp.read(64)
    i = head.find(b'VP8L')
    if i >= 0:
        bits = int.from_bytes(head[i + 9:i + 13], 'little')
        print('    VP8L header alpha_is_used bit: %d' % ((bits >> 28) & 1))
        assert (bits >> 28) & 1, 'VP8L alpha_is_used is 0'

    arr = np.asarray(im, dtype=np.float64)
    fw = arr.shape[1] // n_frames
    frames = [arr[:, i * fw:(i + 1) * fw] for i in range(n_frames)]
    for i, f in enumerate(frames):
        a = f[..., 3]
        b = max(a[0].max(), a[-1].max(), a[:, 0].max(), a[:, -1].max())
        assert b == 0, 'shipped frame %d touches a border with alpha %.0f' % (i, b)
        print('    frame %d  alpha 0..%.0f  opaque on %6d px (%.1f%%)  border alpha %.0f'
              % (i, a.max(), int((a > 254.5).sum()), 100.0 * (a > 0.5).mean(), b))
    assert frames[0][..., 3].max() == 0, 'shipped frame 0 is not fully transparent'

    # No halo: a decoder that interpolates un-premultiplied mixes the RGB of
    # neighbouring pixels regardless of their alpha, so every pixel in the ramp
    # must still carry the fur colour. libwebp's lossless coder is free to
    # rewrite RGB under alpha 0 (it does -- that is why frame 0's cleared area
    # reads as black), which is harmless only because the ramp itself is intact.
    base = L.crop(body, rect)
    for i, f in enumerate(frames):
        a = f[..., 3]
        ramp = (a > 0) & (a < 255)
        if ramp.any():
            d = np.abs(f[..., :3] - base[..., :3]).max(axis=2)[ramp].max()
            print('    frame %d  %5d ramp px, RGB vs the body there: max diff %.0f'
                  % (i, int(ramp.sum()), d))
            assert d == 0, ('shipped frame %d has %.0f of colour error in the alpha '
                            'ramp -- an un-premultiplied scaler would halo' % (i, d))
    last = n_frames - 1
    assert frames[last][..., 3][hull].min() == 255, (
        'shipped frame %d does not cover the open eye at alpha 255' % last)
    rest = composite(body, frames[0], rect)
    print('    frame 0 composited over the body: max abs diff %.1f over %d px'
          % (np.abs(rest - body).max(), body.shape[0] * body.shape[1]))
    assert np.abs(rest - body).max() == 0, 'frame 0 is not a no-op over the body'
    return frames


def main():
    body = L.load(BODY)
    ink = ink_mask(body)
    rect = CROP
    base = L.crop(body, rect)
    hull = eye_hull(ink, rect)
    gate = writable(body, rect, hull)
    fur, level, grain = fur_field(body, rect, hull)
    print('bake blink  body=%s  eye hull %d px, off-limits %d px' % (
        BODY, hull.sum(), int((gate < 0.02).sum())))
    print('  lid fur level R %.0f..%.0f (local, not flat)  grain std %.2f' % (
        level[..., 0].min(), level[..., 0].max(), grain.std()))

    eyes = []
    for x0, inner in EYE_X0:
        b = socket_blocks(ink, x0)
        eyes.append((x0, inner, b))
        print('  socket x0=%-6.0f %s' % (x0, ' '.join('%d-%d' % v for v in b)))

    def plan(**kw):
        return [eye_plan(b, x0, inner, **kw) for x0, inner, b in eyes]

    # 0 open, 1 half-lidded, 2 shut. The component plays 0-1-2-1-0.
    P_OPEN = []
    # the half lid is the socket's own top contour pushed down two blocks, so it
    # keeps the eye's drawn tilt; a flat cut here read as an angry brow bar
    P_HALF = plan(mode='offset', off=2)
    CANDIDATES = {
        # (a) lid descend, seam on the eye's own tilt, 1 and 2 blocks thick
        'mid1': plan(frac=0.50, clear_below=True),
        'mid2': plan(frac=0.50, thick=2, clear_below=True),
        # (b) socket fill + a flat seam straight across
        'flat1': plan(frac=0.50, mode='flat', clear_below=True),
        # (a) taken all the way down: the seam IS the eye's own bottom edge, so
        # it keeps the bowl the artist drew instead of an invented straight line
        'bot1': plan(mode='bottom', clear_below=True),
        'bot2': plan(mode='bottom', thick=2, clear_below=True),
        'bot2up': plan(mode='bottom', thick=2, lift=1, clear_below=True),
        'bot2r': plan(mode='bottom', thick=2, rise=1, clear_below=True),
    }
    SHUT = 'bot2'

    raw = {k: build(body, rect, p, fur, gate) for k, p in
           [('open', P_OPEN), ('half', P_HALF)] + list(CANDIDATES.items())}
    print('  half   seam blocks  left %s  right %s'
          % (P_HALF[0]['lid'], P_HALF[1]['lid']))
    for k, v in CANDIDATES.items():
        print('  %-6s seam blocks  left %s  right %s x%d'
              % (k, v[0]['lid'], v[1]['lid'], v[0]['thick'][0]))

    assert np.abs(raw['open'] - base).max() == 0, 'frame 0 is not the raw crop'

    # the gate must be inert over the lid itself -- prove it only ever bites at
    # the blaze, by rebuilding the shut frame ungated and diffing
    ungated = build(body, rect, CANDIDATES[SHUT], fur)
    clip = np.abs(ungated - raw[SHUT]).max(axis=2)
    print('  gate clips %d px (max %.0f), all where the original luma was %.0f+'
          % (int((clip > 0.5).sum()), clip.max(),
             base[..., :3].mean(axis=2)[clip > 0.5].min()
             if (clip > 0.5).any() else 0))

    fin = {k: cut_alpha(v, base) for k, v in raw.items()}
    order = ['open', 'half'] + list(CANDIDATES)
    comps = {k: composite(body, fin[k], rect) for k in order}

    # every candidate side by side, big and at true on-screen size
    sheet([face_img(comps[k], 1.25) for k in order], 'blink_candidates.png',
          labels=order, cols=4)
    sheet([real_img(comps[k], up=6) for k in order], 'blink_candidates_real.png',
          labels=order, cols=4)

    frames = [fin['open'], fin['half'], fin[SHUT]]
    names = ['open', 'half', 'shut']
    plans = [P_OPEN, P_HALF, CANDIDATES[SHUT]]
    report(frames, names, rect, hull, body, covers=[False, False, True])
    seam_check(frames[1:], names[1:], plans[1:], rect, hull)
    leak_check(body, rect, CANDIDATES[SHUT], fur, gate, hull)
    descent_check(P_HALF, CANDIDATES[SHUT])

    shut_eye = CANDIDATES[SHUT][0]
    seam = [(EYE_TOP + j * BLOCK_H, EYE_TOP + (j + t) * BLOCK_H)
            for j, t in zip(shut_eye['lid'], shut_eye['thick'])]
    lo, hi = min(s[0] for s in seam), max(s[1] for s in seam)
    print('\n    shut seam y %.0f..%.0f  ->  %.1f CSS px tall at the shipping size'
          % (lo, hi, (hi - lo) * SCREEN))
    travel = [(l - jt) * BLOCK_H for l, (jt, _) in zip(shut_eye['lid'], shut_eye['blocks'])]
    half_travel = [(l - jt) * BLOCK_H for l, (jt, _) in
                   zip(P_HALF[0]['lid'], P_HALF[0]['blocks'])]
    print('    lid displacement  half %.0f..%.0f px (%.1f..%.1f blocks)'
          % (min(half_travel), max(half_travel),
             min(half_travel) / BLOCK_H, max(half_travel) / BLOCK_H))
    print('                      shut %.0f..%.0f px (%.1f..%.1f blocks)'
          % (min(travel), max(travel), min(travel) / BLOCK_H, max(travel) / BLOCK_H))

    print()
    L.write_strip('cookBlink', frames, 'cook_blink.webp', 6000,
                  CANVAS, rect, kind='blink',
                  body_src='/ErenCook_notail.png', scale=1.0,
                  note='Eyelid-only overlay: alpha is cut to the two sockets, and '
                       'frame 0 is fully transparent because the body PNG already '
                       'draws the open eyes. The socket fills with its own fur and '
                       'the eye closes onto its own drawn bottom edge, two blocks '
                       'of the art grid thick. Composite over the body PNG at rect.')

    shipped = verify_shipped('cook_blink.webp', body, rect, hull, len(frames))
    # the separate-downscale question (issue 3) asked of the pixels that ship,
    # not of the float arrays that went into the encoder
    glint_check(shipped, names, rect)
    browser_check(body, shipped, names, rect,
                  [(np.abs(f[..., :3] - base[..., :3]).max(axis=2) > 0.5).astype(np.float64)
                   for f in shipped])

    # previews are built from the SHIPPED pixels, not from the arrays above
    shots = [composite(body, f, rect) for f in shipped]
    L.write_filmstrip(shots, 'blink_frames.png', scale=0.28)
    sheet([face_img(c, 1.5) for c in shots], 'blink_face.png',
          labels=['0 open', '1 half', '2 shut'])
    sheet([real_img(c) for c in shots], 'blink_real.png',
          labels=['0 open', '1 half', '2 shut'])
    sheet([browser_img(body, f, rect) for f in shipped], 'blink_browser.png',
          labels=['0 open', '1 half', '2 shut'])
    sheet([alpha_img(f, rect) for f in shipped], 'blink_alpha.png',
          labels=['0 open alpha', '1 half alpha', '2 shut alpha'])
    L.write_gif_scene(shots, 'blink_scene.gif', 1200, room='kitchen.png',
                      target_w=131, anchor=(0.5, 0.90))
    L.write_gif_scene(shots, 'blink_scene_loop.gif', 1600, room='kitchen.png',
                      target_w=131, anchor=(0.5, 0.90), ping_pong=True)


if __name__ == '__main__':
    main()
