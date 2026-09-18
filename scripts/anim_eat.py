"""Bake the eating chew cycle (6 frames, 440ms) for the four head-down eat poses.

Replaces @keyframes erenChew, which translated the WHOLE sticker -- cat, paws,
bowl contact and all -- down 2px and back. Here only the head works, and it has
to beat that 2px AT THE FACE or it is not worth the bytes.

The art, and what it forces
---------------------------
These four poses are a FRONT view of a crouched cat, foreshortened hard: the
skull fills the upper two thirds, the face is crammed into the bottom fifth,
and the muzzle sits on the canvas's bottom edge next to the two front paws.
Measured, per pose, by this script on every run:

    pose   snout (iris bottom -> contact line)   nose top vs contact line
      1            60 rows =  9.1 CSS px            3 rows above
      2            40 rows =  6.2 CSS px            below it
      3            60 rows =  9.9 CSS px            3 rows above
      4            47 rows =  7.0 CSS px            3 rows above

Two facts fall out of that table and they decide everything.

1. There is no room below the chin. A dip would clip off the frame, and the
   bottom rows are the floor contact line every scene anchors to. So the cycle
   is a PRESS: the head sinks onto a pinned contact band and the SNOUT absorbs
   every pixel of the travel.

2. The nose CAN move -- upward -- and an earlier build of this script was wrong
   to say it could not. It reasoned that the nose sits inside the bottom rows
   that pin the paws, so moving it would tear. That confuses a row band with a
   region. The pin only has to hold the PAW COLUMNS. The muzzle stands in its
   own column window BETWEEN the paws, and the bottom contour proves it:
   measured by bottom_contour() on every run, the depth of the silhouette's
   lowest opaque row, counted up from the canvas edge, is

       pose   left paw    notch      MUZZLE      notch       right paw
         1     x 60..185   x 186..226  x 227..399  x 400..438  x 439..575
               depth 1..2  17..33      1..2        13..19      0..1
         2     x 118..215  x 216..230  x 231..364  x 365..417  x 418..504
               depth 3..6  16          0..1        16..29      3..5
         3     x 110..202  x 203..215  x 216..342  x 343..382  x 383..455
               depth 2..3  13..17      11..12      15..24      1..2
         4     x 155..244  x 245..269  x 270..468  x 469..511  x 512..600
               depth 18..19 31         8..19       15..31      18..19

   Between the muzzle and each paw there is a notch -- a column band where the
   silhouette lifts a whole art block or more off the bottom edge. Poses 1, 2
   and 3 lift clear of the canvas there; pose 4's notch is a step in a shared
   chin outline rather than a gap, which is why its feather matters most. So
   the muzzle can travel without unwinding anything, as long as the field dies
   inside the notch and never reaches a paw column.

   Upward, specifically. The muzzle's own contact depth is 0..2 rows in poses 1
   and 2: down is off the canvas. Up is free -- above the nose this art is a
   blank white bridge running to the forehead, and it takes the whole
   compression without a visible seam.

Where the travel goes
---------------------
The previous build spread the press over the brow as well as the snout and
punched a rigid hole across the irises, and the arithmetic of that quietly
starved the face: the skull moved 2.4 CSS px, the eye line 0.9, the nose 0.
The viewer watches the eyes, so the read was carried by the top of the skull,
which is the part nobody watches. Now:

  * the head is RIGID from the crown down to the bottom of the irises. Eyes,
    brow, cheeks and ear bases translate together, which is what a head sinking
    into a bowl does, and it makes the irises rigid BY CONSTRUCTION -- they sit
    in the flat zone of every profile -- rather than by special-casing them;
  * all of that travel is absorbed between the iris bottom and the contact
    line. scripts/anim_preview/eat_snout_ladder.png is the reason MAX_SNOUT is
    0.44: below the eyes this art is a flat white muzzle with three black
    whisker strokes and a nose, and it takes a 44% squash without shearing
    where a textured region would not. 52% is where the eyes start to sit on
    the nose, and the ladder shows that rung too;
  * the snout starts BELOW where the irises land, not below where they start.
    warp() indexes its field by destination row, so a head that translates
    13px down carries its irises 13px into a zone that was clear of them in
    the source. Padding in source space measured a perfectly rigid field and
    baked a 4.3% flatter eye. The absorber therefore gives up as many rows as
    the head travels, which is why the two short-snouted poses end up bound by
    their own geometry rather than by the target;
  * a small brow give (capped at MAX_BROW, and it only really engages on the
    two short-snouted poses) tops the skull up to TARGET_SKULL, so poses 2 and
    4 keep a full-amplitude skull even though their snouts cannot hand the
    face the whole 2 CSS px;
  * the jaw runs on its own clock underneath the press, so the bite snaps shut
    a frame before the head is all the way down and is already releasing while
    the head is still sinking. That is what gives f2 and f3 different shapes
    instead of two samples of one peak;
  * a narrow squash on the nose-bridge columns, inside the jaw zone, shapes the
    bite, and the ears shear, so the skull is not one rigid lump;
  * and the MUZZLE PUMPS. See below -- it is the only field allowed past the
    contact line, and only inside its own column window.

The muzzle pump
---------------
"its good but its kind off weid that his nose like the mouth and all that
doesnt move but the rest is good" -- so it moves now.

muzzle_window() finds the window from the pixels every run: the muzzle's own
contact run is grown outward from the pink nose's columns, then on each side
the notch is the deepest column band between that run and the paw, and the
window's edge is feathered across one art block centred on it. The paw columns
on the far side are found independently (the contact run within half a block of
that side's own floor) and report() asserts they come out bit-identical, so the
pin that matters -- the paws on the floor line -- is still exact.

Inside that window the nose, the bridge below the irises and the chin translate
UP as one rigid piece, on the jaw clock, rectified so the muzzle never pushes
below its rest position (poses 1 and 2 have one row of canvas under the chin,
and none). The travel is absorbed in the blank white bridge between the iris
bottom and the nose top, and it stops exactly where the press stops -- at
snout_top, which is already clear of where the irises LAND, not where they
start. So the irises stay rigid and the pump is invisible except at the nose,
which is the point.

Its amplitude is TARGET_NOSE CSS px, capped so the press and the pump together
never close more than MAX_CLOSE of the eye-to-nose span: the failure mode at the
top of that range is the eyes sitting on the nose, the same one the snout ladder
is drawn for. scripts/anim_preview/eat_muzzle_ladder.png is the artifact that
settles it -- the muzzle at 3x, one column per frame, labelled with the nose's
measured travel -- and eat_paws.png is the one that proves the paw beside it
never moved.

What it comes to, measured on the baked frames at the shipped 140 CSS px:
the eye line travels 2.05 / 1.54 / 2.05 / 1.79 px and the ear tips 2.55 / 2.47
/ 2.55 / 2.55, against 0.91 / 0.93 / 1.32 / 0.89 at the eyes in the build this
replaces and a flat 2.00 everywhere in the CSS bob before that. Poses 2 and 4
fall short at the face because their snouts are 6.2 and 7.0 CSS px tall and
there is nowhere else for the travel to go; their skulls carry the read.

Three things the art forbade, tried and dropped:

  * a volume-conserving cheek bulge -- pose 1's silhouette already touches x=0
    at rows 701..708, so widening the cheeks clips;
  * ears shearing in OPPOSITE directions -- the ears are a third of the head's
    height here, so splaying and pinching them read as the whole skull
    narrowing. They shear the same way now, by unequal amounts;
  * the tail. It used to flick on the house sway signal, which put a 440ms tail
    on a cat whose idle tail sways at 3400ms, and made the only moving thing
    outside the head a twitch nobody asked for. A cat with its face in a bowl
    holds its tail still. A_TAIL is 0.

Everything is measured from the pixels (irises for the eye line, head centre,
eye separation and the snout top; the pink nose for the muzzle window and the
nose travel; the bottom contour for the notches and the paws; an eroded
fur-blob flood for the head and tail silhouettes), and every frame is
re-measured with the SAME detectors after warping, so the report below is an
end-to-end check and not a restatement of the inputs.

Run: py scripts/anim_eat.py    (py, not python -- that's the one with PIL)
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

import anim_lib as L

S2 = ndimage.generate_binary_structure(2, 2)

POSES = ['erenEat1.png', 'erenEat2.png', 'erenEat3.png', 'erenEat4.png']

# ---------------------------------------------------------------------------
# Amplitudes are in CSS px at the size the thing actually ships at --
# ChewingEren.EAT_WIDTH -- not in source px and not in art blocks. The four
# poses are four different resolutions (848 to 940 px wide) with four different
# snout heights, so a shared source-px amplitude reads as four different
# animations. What has to match across the poses is what the eye sees.
EAT_WIDTH_CSS = 140.0

TARGET_FACE = 2.05        # eye-line travel at the bottom of the bite
TARGET_SKULL = 2.55       # ear-tip travel; the brow makes up face -> skull
MAX_SNOUT = 0.44          # ceiling on the snout's peak LOCAL compression
MAX_BROW = 0.07           # ceiling on the brow's, which is a much softer read
MUZ_SQUASH = 0.07         # extra squash, nose-bridge columns of the jaw zone
A_EAR = 0.55 * 16.0       # ear-tip shear, source px (one art block is ~16)
A_TAIL = 0.0              # see the docstring: the tail holds still to eat

# The muzzle pump. TARGET_NOSE is what the nose actually travels at the peak of
# the bite, in CSS px at EAT_WIDTH, and one art block is 2.1 to 2.5 CSS px here,
# so this is ~0.8 of a block -- big enough to read at 140px, which is the whole
# reason the pump exists. MAX_CLOSE is the ceiling that holds it back: the press
# and the pump both close the gap between the iris bottom and the nose top, and
# past about half of that gap the eyes start to sit on the nose (the top rung of
# the snout ladder, and the same failure this art has always had). Pose 4 is
# bound by it -- its eye-to-nose span is 44 rows against pose 1's 57.
TARGET_NOSE = 2.00
MAX_CLOSE = 0.46
# The press and the pump close the SAME eye-to-nose gap, so on a short-gap pose
# they are in direct competition -- and the press was solved first, which handed
# it the whole MAX_CLOSE budget and left the nose with 0.32 CSS px on pose 4.
# That is the exact complaint this rebuild exists to fix ("its kind off weid
# that his nose ... doesnt move"), so the nose is now served FIRST: this many
# CSS px of pump are reserved off the top and the press takes what is left.
# Poses 1-3 solve above it anyway and are untouched; only pose 4 pays, and it
# pays in skull travel, which is the part nobody watches.
PUMP_RESERVE = 1.40
# The travel the nose has to clear at ship size, in CSS px. Below this it reads
# as a frozen nose, which was the complaint. solve_pose() buys it with press
# travel on a pose that cannot afford both.
PUMP_FLOOR = 1.20
# ... and the second ceiling, on the peak PER-ROW compression of the assembled
# field. It is much higher than MAX_SNOUT and that is not a relaxation: 0.44 is
# a ceiling on the snout's average rate across a face that carries whisker
# strokes and a cheek edge, whereas this is the worst single row anywhere in the
# cycle, and the build being replaced here already measures 0.61 of it -- at the
# lock_hard cutoff, in rows 711..719 of pose 1, which is blank white muzzle. So
# 0.61 is the proven floor, not the ceiling. 1.00 is where a row would fold over
# its neighbour; 0.88 keeps a real margin under that and is the last rung of
# eat_muzzle_ladder.png that was looked at and approved.
MAX_BRIDGE = 0.88
BRIDGE_PAD = 3.0          # rows between the end of the ramp and the nose's landing
NOTCH_SEARCH = 3.0        # blocks, outward from the muzzle's contact run
PAW_SEARCH = 6.0          # blocks, for the paw's own contact run beyond that

JAW_SHARE = 0.22          # how much of the face travel the jaw clock carries
JAW_ZONE = 0.65           # the jaw works the lower 65% of the snout
BROW_SPAN = 1.8           # brow zone height, in eye-line-to-contact gaps

FRAMES = 6
DURATION_MS = 440

# Fast close early, slow open late, so it reads as a bite and not a sine wave.
#
# Frame 0 is exactly 0 in every channel: it is the resting pose, the loop runs
# back through it, and other layers composite against it. f5 lands at 0.12,
# which is 0.24 CSS px and under the visibility floor, so f5 and f0 together
# read as 147ms of rest -- the still beat the cycle needs to read as
# bite-bite-bite rather than as a continuous hum.
#
# f1 is the anticipation and the SKULL leads it: DIP is four times JAW there,
# so the head lifts and the mouth opens under it, instead of the snout
# stretching upward off a stationary skull.
#
# f2 and f3 are deliberately different poses, not two samples of one peak. f2
# is "jaw shut, head still coming down" (JAW 1.00, DIP 0.48); f3 is "head all
# the way down, jaw already releasing" (DIP 1.00, JAW 0.42). Between them the
# whole head travels another 0.6 CSS px while the lower snout gives 0.58 of the
# jaw amplitude back.
#
# JAW_T, DIP_T and MUZ_T deliberately share a sign on every frame. All three
# drive bottom-pinned ramps, so same-sign keeps the vertical field MONOTONIC:
# the lower face only ever compresses or only ever stretches, and never pinches
# (compress here, stretch 40px higher) the way a sign flip would.
#           f0     f1     f2     f3     f4     f5
DIP_T = [0.00, -0.50, 0.48, 1.00, 0.46, 0.12]
JAW_T = [0.00, -0.12, 1.00, 0.42, 0.16, 0.03]
MUZ_T = [0.00, -0.25, 1.00, 0.50, 0.12, 0.02]
EAR_T = [0.00, 0.30, -1.00, -0.55, 0.45, 0.20]
# The pump rides the jaw clock, RECTIFIED: the muzzle lifts on the bite and
# comes back to rest, and it never pushes below rest, because in poses 1 and 2
# there is one row of canvas under the chin and none. Rectifying costs nothing
# at f1 -- the head lifts there and the muzzle holds, so the mouth still opens,
# it just opens by the skull moving instead of the chin. Frame 0 stays exactly 0.
PUMP_T = [max(t, 0.0) for t in JAW_T]
PEAK = 3                  # the frame the amplitudes are solved against
PUMP_PEAK = 2             # ... and the frame the NOSE peaks on, a beat earlier

LOCK_FRAC = 0.06          # bottom rows held bit-identical OUTSIDE the muzzle window
PAD = 6.0                 # rows of clearance around the irises (> 3 * SOFT)
SOFT = 1.8                # compression-density smoothing, rows
ERODE = 5                 # breaks the tail's fur bridge to the body in pose 2
DIL = 32                  # grows the fur blob over its own black outline
SIG = 24.0                # blur that turns the mask into a tear-proof weight

# Encoding. Lossless measures 541KB per pose (2.1MB for the four) and all four
# have to be downloaded before the first meal animates, so these ship lossy.
# q88 comes off a measured sweep of q94/90/88/86 on the final frames, not from
# feel. Against the pre-encode frames it costs a premultiplied mean of ~1.5/255
# and a p99 of ~8/255, and it is the cheapest setting that still keeps the
# contact band's FRAME-TO-FRAME deviation under WOBBLE on all four poses.
#
# Two different ceilings, because they are two different claims. BAND is the
# decoded band against the source: mostly a constant encoder bias, which does
# not move and therefore cannot read as a wobble. WOBBLE is frame i's decoded
# band against frame 0's, which is the one the eye could catch -- and it is the
# honest replacement for the old build's "bit-identical contact band", which
# was true of the arrays in memory and false of the lossy VP8 file that
# shipped. verify_encoded() asserts both after a decode.
STRIP_SCALE = 0.5
QUALITY = 88
BAND = 40                 # decoded contact band vs the source, premultiplied
WOBBLE = 24               # decoded contact band, frame i vs frame 0


# -- measuring --------------------------------------------------------------

def furmask(img):
    """Mid-luminance fur: drops the black outline and the white fills, which is
    what lets the head separate from the rump."""
    a = img[..., 3]
    lum = 0.299 * img[..., 0] + 0.587 * img[..., 1] + 0.114 * img[..., 2]
    return (a > 128) & (lum > 45) & (lum < 205)


def block_size(img, lo=8, hi=30):
    """Estimate the native pixel-art block width from the autocorrelation of
    the horizontal edge profile. A sanity check on the art, not a tuning knob."""
    a = img[..., 3]
    lum = 0.299 * img[..., 0] + 0.587 * img[..., 1] + 0.114 * img[..., 2]
    solid = a > 200
    g = np.abs(np.diff(lum, axis=1)) * (solid[:, 1:] & solid[:, :-1])
    prof = g.sum(axis=0)
    prof = prof - prof.mean()
    ac = np.correlate(prof, prof, mode='full')[len(prof) - 1:]
    return lo + int(np.argmax(ac[lo:hi + 1]))


def _blobs(mask, min_px):
    lab, n = ndimage.label(mask)
    out = []
    for k in range(1, n + 1):
        ys, xs = np.where(lab == k)
        if ys.size >= min_px:
            out.append(dict(n=ys.size, cx=xs.mean(), cy=ys.mean(),
                            x0=xs.min(), x1=xs.max(), y0=ys.min(), y1=ys.max()))
    return out


def measure(img):
    """Eye line, head centre, eye separation, muzzle -- all from the pixels.

    Also run on every BAKED frame, so the report measures the art that shipped
    rather than the numbers that went in.
    """
    h, w, _ = img.shape
    a, r, g, b = img[..., 3], img[..., 0], img[..., 1], img[..., 2]

    blue = (a > 128) & (b > r + 25) & (b > g + 15) & (b > 70)
    iris = _blobs(blue, 200)
    assert len(iris) >= 2, 'need two iris blobs, got %d' % len(iris)
    iris_px = np.zeros_like(blue)          # the kept blobs only, for the skew check
    for d in iris:
        box = (slice(d['y0'], d['y1'] + 1), slice(d['x0'], d['x1'] + 1))
        iris_px[box] |= blue[box]
    mass = sum(d['n'] for d in iris)
    split = sum(d['n'] * d['cx'] for d in iris) / mass

    def side(pred):
        """Each eye labels as two or three blue blobs (a pupil and a highlight
        split the iris), so they are grouped by which side of the iris
        centroid they fall on. Returns the centre plus the INNER edge, which
        is what keeps the muzzle pump off the eyes."""
        grp = [d for d in iris if pred(d['cx'])]
        m = sum(d['n'] for d in grp)
        return (sum(d['n'] * d['cx'] for d in grp) / m,
                sum(d['n'] * d['cy'] for d in grp) / m,
                max(d['x1'] for d in grp), min(d['x0'] for d in grp))

    lx, ly, l_in, _ = side(lambda x: x < split)
    rx, ry, _, r_in = side(lambda x: x >= split)

    # Relaxed pink: the nose is small and sits on white, so a strict threshold
    # loses it on the darker poses.
    pink = _blobs((a > 128) & (r > 170) & (r > b + 20) & (g < r - 20), 150)
    assert pink, 'no pink nose blob'
    nose = max(pink, key=lambda d: d['n'])

    return dict(
        w=w, h=h,
        css=EAT_WIDTH_CSS / float(w),      # source px -> shipped CSS px
        bbox=L.alpha_bbox(img),
        eye_y=0.5 * (ly + ry),
        cx=0.5 * (lx + rx),
        sep=abs(rx - lx),
        eye_l=(lx, ly), eye_r=(rx, ry),
        eye_l_in=float(l_in), eye_r_in=float(r_in),
        iris_y0=float(min(d['y0'] for d in iris)),
        iris_y1=float(max(d['y1'] for d in iris)),
        iris_px=iris_px,
        iris_n=int(iris_px.sum()),
        nose_x=nose['cx'], nose_y=nose['cy'],
        nose_y0=float(nose['y0']), nose_y1=float(nose['y1']),
        nose_x0=int(nose['x0']), nose_x1=int(nose['x1']),
        y_lock=h - int(np.ceil(LOCK_FRAC * h)),
        block=block_size(img),
    )


def bottom_contour(img, thresh=16):
    """Per column, how far ABOVE the canvas's bottom edge the silhouette's
    lowest opaque row sits. Empty columns read as the full height.

    This one array is the whole muzzle argument. A paw standing on the floor
    line reads 0..2 rows; the muzzle standing next to it reads 0..12; the notch
    between them reads 13..33, which is one art block or more. Nothing else in
    this script can tell those three apart -- the fur mask has no white in it,
    and a 2D label of the contact band joins muzzle to paw through the top of
    the notch, which is still solid.
    """
    h, w, _ = img.shape
    solid = img[..., 3] > thresh
    depth = np.argmax(solid[::-1, :], axis=0).astype(np.float64)
    depth[~solid.any(axis=0)] = float(h)
    return depth


def _run_around(d, k, thr, lo, hi):
    """The maximal run of columns in [lo, hi) around k with d >= thr."""
    a = b = k
    while a > lo and d[a - 1] >= thr:
        a -= 1
    while b < hi - 1 and d[b + 1] >= thr:
        b += 1
    return a, b


def muzzle_window(img, m):
    """The column window the muzzle is allowed to move in, from the pixels.

    Grown out of the nose: the muzzle's own contact run first (columns whose
    bottom contour sits within a third of a block of the nose's), then, on each
    side, the NOTCH -- the deepest column band between that run and the paw --
    and the window's edge is one art block of feather centred on it. Feathering
    there and not at the muzzle's own edge is deliberate: the notch is where the
    silhouette is already broken (or, in pose 4, already steps), so a slope in
    the field lands on a discontinuity instead of across a flat outline.

    The paw columns are then found INDEPENDENTLY of all that -- the contact run
    on the far side of the notch, within half a block of that side's own lowest
    point -- so report() can assert the window never reaches one, which is the
    guarantee the whole animation rests on.
    """
    h, w, _ = img.shape
    d = bottom_contour(img)
    blk = float(m['block'])
    base = float(d[m['nose_x0']:m['nose_x1'] + 1].max())
    tol = 0.30 * blk

    mx0, mx1 = m['nose_x0'], m['nose_x1']
    while mx0 > 0 and d[mx0 - 1] <= base + tol:
        mx0 -= 1
    while mx1 < w - 1 and d[mx1 + 1] <= base + tol:
        mx1 += 1

    S, P = int(round(NOTCH_SEARCH * blk)), int(round(PAW_SEARCH * blk))
    out = dict(depth=d, base=base, muz_run=(mx0, mx1))
    for side, edge in (('l', mx0), ('r', mx1)):
        if side == 'l':
            lo, hi, flo, fhi = max(0, edge - S), edge, max(0, edge - P), edge
        else:
            lo, hi, flo, fhi = edge + 1, min(w, edge + 1 + S), edge + 1, min(w, edge + 1 + P)
        seg = d[lo:hi]
        assert seg.size, 'no columns outside the muzzle run on the %s' % side
        peak = float(seg.max())
        assert peak >= base + 0.4 * blk, \
            'no notch on the %s of the muzzle (peak %.0f vs contact %.0f, block %.0f)' \
            % (side, peak, base, blk)
        k = lo + int(np.argmax(seg))
        far = d[flo:k] if side == 'l' else d[k + 1:fhi]
        dmin = float(far.min()) if far.size else base
        thr = 0.5 * (peak + max(base, dmin))
        a, b = _run_around(d, k, thr, flo, fhi)
        c = 0.5 * (a + b)
        fw = min(blk, float(b - a + 1))
        # paw = the contact run on the far side of the notch centre
        idx = np.arange(flo, c, dtype=int) if side == 'l' else np.arange(int(c) + 1, fhi, dtype=int)
        paw = idx[d[idx] <= dmin + 0.5 * blk]
        assert paw.size, 'no paw contact run on the %s' % side
        out[side] = dict(notch=(a, b), centre=c, feather=fw, peak=peak, dmin=dmin,
                         x_in=c + 0.5 * fw if side == 'l' else c - 0.5 * fw,
                         x_out=c - 0.5 * fw if side == 'l' else c + 0.5 * fw,
                         paw=(int(paw.min()), int(paw.max())), paw_cols=paw)

    x = np.arange(w, dtype=np.float64)
    lft, rgt = out['l'], out['r']
    col = np.minimum(L.smoothstep((x - lft['x_out']) / max(lft['x_in'] - lft['x_out'], 1e-6)),
                     L.smoothstep((rgt['x_out'] - x) / max(rgt['x_out'] - rgt['x_in'], 1e-6)))
    out['col'] = np.clip(col, 0.0, 1.0)
    for side in ('l', 'r'):
        bad = out[side]['paw_cols'][out['col'][out[side]['paw_cols']] > 0.0]
        assert bad.size == 0, \
            'the muzzle window reaches %d %s paw columns (%s..)' % (bad.size, side, bad[:6])
    return out


def parts(img, m):
    """Raw head and tail silhouettes.

    The fur mask alone is not enough: in pose 2 the tail's fur touches the
    body's through a thin bridge and the whole cat labels as one blob. Eroding
    5px first snaps every bridge, then the chosen blob is dilated back.

    The tail is not animated any more, but it is still located: finding it is
    how we prove the blob we took for the head is the head.
    """
    fur = furmask(img)
    eroded = ndimage.binary_erosion(fur, S2, iterations=ERODE)
    lab, n = ndimage.label(eroded, structure=S2)
    assert n, 'fur eroded to nothing'
    sizes = np.array([(lab == k).sum() for k in range(1, n + 1)])

    # head = the blob under the forehead, a quarter of an eye-separation above
    # the eye line; fall back to the nearest labelled pixel if that lands on a
    # white stripe.
    sx, sy = int(round(m['cx'])), int(round(m['eye_y'] - 0.25 * m['sep']))
    hid = lab[sy, sx]
    if hid == 0:
        ys, xs = np.where(eroded)
        hid = lab[ys, xs][np.argmin((xs - sx) ** 2 + (ys - sy) ** 2)]
    head_e = lab == hid

    # tail = the biggest other blob, and it had better be up and to the right
    others = [(sizes[k - 1], k) for k in range(1, n + 1) if k != hid and sizes[k - 1] > 1500]
    assert others, 'no tail blob'
    tid = max(others)[1]
    tail_e = lab == tid
    tys, txs = np.where(tail_e)
    assert txs.mean() > 0.55 * m['w'] and tys.mean() < 0.55 * m['h'], \
        'tail blob is not up-right (cx=%.0f cy=%.0f)' % (txs.mean(), tys.mean())

    grow = lambda k: ndimage.binary_dilation(k, S2, iterations=ERODE)
    head, tail = grow(head_e), grow(tail_e)

    # The fur mask has no white in it, so at the bottom of the face -- the
    # muzzle, the chin, the whisker pads -- the head blob runs thin and stops
    # short. In pose 4 it stopped 3px ABOVE the iris bottom, which left the
    # head weight on its falloff across the lower irises and skewed dy by
    # 6.7px within one eye: a squashed eye, the one deformation this art
    # cannot take. So the whole silhouette below the eye line, across the
    # cheeks' own column span, is folded in -- everything there IS head.
    band = head[int(m['iris_y0']):int(m['iris_y1']) + 1]
    cols = np.where(band.any(axis=0))[0]
    y0 = int(m['iris_y0'])
    face = np.zeros_like(head)
    face[y0:, cols.min():cols.max() + 1] = \
        img[y0:, cols.min():cols.max() + 1, 3] > 128
    return head | face, tail


def press_profile(h, y_top, y_bot, soft=SOFT):
    """A monotone 1 -> 0 ramp from y_top to y_bot, built as the integral of a
    compression density rather than as a smoothstep.

    The reason is the eyes. A smoothstep ramp has its steepest gradient at its
    midpoint, and on these poses the midpoint lands within a few px of the eye
    line -- so the first version of this baker put its maximum compression rate
    straight across the irises and squashed them 11% at the peak of the press.
    Visible, and wrong: eyes read as eyes only while they hold their shape.

    An integral-of-density ramp puts the strain exactly where the density is
    and NOWHERE else: above y_top the profile is flat 1.0, so every row up
    there translates rigidly. That is why the irises need no special case any
    more -- the whole skull down to iris_y1 + PAD sits in the flat zone, and
    it translates instead of just not deforming.
    """
    y = np.arange(h, dtype=np.float64)
    dens = np.where((y >= y_top) & (y < y_bot), 1.0, 0.0)
    dens = ndimage.gaussian_filter1d(dens, soft)
    dens[(y < y_top) | (y >= y_bot)] = 0.0
    c = np.cumsum(dens)
    prof = 1.0 - c / max(c[min(h - 1, int(y_bot))], 1e-9)
    prof[y < y_top] = 1.0
    prof[y >= y_bot] = 0.0
    return np.clip(prof, 0.0, 1.0)


def soften(mask, dil, sig):
    """Binary mask -> smooth 0..1 weight. Dilate over the art's black outline,
    blur, then remap so the plateau lands inside the shape and the falloff is
    ~sig wide. A blurred field cannot tear."""
    m = ndimage.binary_dilation(mask, S2, iterations=dil)
    f = ndimage.gaussian_filter(m.astype(np.float64), sig)
    return np.clip((f - 0.35) / 0.45, 0.0, 1.0)


def ear_masks(head_raw, y_top, y_bot):
    """Left and right ear, taken row by row as the outermost fur runs in the
    head's top band. Where the two ears have merged into the forehead the row
    yields one run and is skipped, so the field dies out on its own exactly
    where the ears stop being separate shapes."""
    h, w = head_raw.shape
    left = np.zeros((h, w), bool)
    right = np.zeros((h, w), bool)
    for y in range(max(0, int(y_top)), min(h, int(y_bot) + 1)):
        xs = np.where(head_raw[y])[0]
        if xs.size == 0:
            continue
        brk = np.where(np.diff(xs) > 1)[0]
        starts = np.concatenate(([0], brk + 1))
        ends = np.concatenate((brk, [xs.size - 1]))
        runs = [(xs[s], xs[e]) for s, e in zip(starts, ends) if xs[e] - xs[s] >= 6]
        if len(runs) < 2:
            continue
        left[y, runs[0][0]:runs[0][1] + 1] = True
        right[y, runs[-1][0]:runs[-1][1] + 1] = True
    return left, right


# -- the fields -------------------------------------------------------------

def solve_amplitudes(m, y_lock, face_cap=None):
    """Turn the CSS-px targets into source-px amplitudes and zone edges.

    Three constraints fight here.

    The face wants TARGET_FACE of travel. The snout is the only thing that can
    absorb it (see the docstring on the nose) and it shears if any row band is
    compressed past MAX_SNOUT. And -- the one that is easy to get wrong -- the
    irises have to be clear of the compression IN THE FRAME THAT SHIPS, not in
    the source. warp() indexes its field by DESTINATION row, so an iris whose
    source rows sit comfortably above the snout still lands inside the ramp
    once the head has translated down by `face`, and gets squashed there. A
    build that padded in source space measured a rigid field (skew 0.000) and a
    4.3% flatter eye on the baked pixels, which is exactly the deformation this
    art cannot take.

    So the snout starts at iris_y1 + PAD + face: the absorber gives up as many
    rows as the head travels, and what is left has to carry the whole press.
    That closes to

        face * C / (B - face) <= MAX_SNOUT,  B = y_lock - iris_y1 - PAD

    where C is the peak local rate per unit of face travel per snout row, taken
    over the whole cycle because the press and the jaw compress the same rows
    and the ceiling belongs to their sum.

    The same argument upward: at f1 the head lifts, so the brow zone has to end
    PAD + (the lift) above the irises or the anticipation stretches them.
    """
    d, j = 1.0 - JAW_SHARE, JAW_SHARE
    eye_t = [d * DIP_T[i] + j * JAW_T[i] for i in range(FRAMES)]
    k = max(eye_t)
    assert abs(eye_t[PEAK] - k) < 1e-9, 'frame %d is not the peak of the cycle' % PEAK
    up = abs(min(eye_t)) / k
    C = max(d * DIP_T[i] + (j / JAW_ZONE) * JAW_T[i] for i in range(FRAMES)) / k

    B = y_lock - m['iris_y1'] - PAD
    want = TARGET_FACE / m['css']
    face = min(want, MAX_SNOUT * B / (C + MAX_SNOUT))
    # Reserve the pump's share of the eye-to-nose gap before the press takes
    # its own (see PUMP_RESERVE). Without this the pump gets only the leftover
    # at the a_hi line in build_fields, and on a pose whose gap is short that
    # leftover is nothing.
    nose_span = m['nose_y0'] - m['iris_y1']
    cap = max(0.0, MAX_CLOSE * nose_span - PUMP_RESERVE / m['css'])
    if face_cap is not None:
        cap = min(cap, face_cap)
    nose_bound = cap < face - 1e-6
    face = min(face, cap)
    snout_rows = B - face
    snout_top = y_lock - snout_rows
    jaw_top = snout_top + (1.0 - JAW_ZONE) * snout_rows
    jaw_rows = y_lock - jaw_top

    brow_bot = m['iris_y0'] - PAD - up * face
    dip_top = m['eye_y'] - BROW_SPAN * (y_lock - m['eye_y'])
    brow_rows = brow_bot - dip_top
    assert snout_rows > 15, 'snout zone is %.0f rows, too thin to absorb a press' % snout_rows
    assert brow_rows > 40, 'brow zone is %.0f rows' % brow_rows

    skull = max(face, min(TARGET_SKULL / m['css'], face + MAX_BROW * brow_rows))
    return dict(face=face, a_dip=face * d / k, a_jaw=face * j / k,
                a_brow=skull - face, skull=skull, rate=face * C / snout_rows,
                want=want,
                bound=('nose' if nose_bound else
                       'snout' if face < want - 1e-6 else 'target'),
                brow_rate=(skull - face) / brow_rows,
                snout_top=snout_top, snout_rows=snout_rows, jaw_top=jaw_top,
                jaw_rows=jaw_rows, brow_bot=brow_bot, dip_top=dip_top,
                brow_rows=brow_rows)


def build_fields(img, m, face_cap=None):
    """The displacement bases, each already masked to its own body part. Every
    one of them is exactly zero at and below the contact line, and exactly flat
    (rigid translation, zero strain) from the crown down to the iris bottom.

    `face_cap` caps the press in source px. The press and the pump compress the
    same bridge rows, so on a pose with a short eye-to-nose gap the press can
    take so much of the bridge that no pump clears the visibility floor.
    solve_pose() searches for the largest press the nose can live with instead
    of letting this return a frozen nose and calling it solved."""
    h, w, _ = img.shape
    y_lock = m['y_lock']
    head_raw, _tail_raw = parts(img, m)
    head_w = soften(head_raw, DIL, SIG)

    # Zones and amplitudes are solved together, because where the snout starts
    # depends on how far the head travels and vice versa. PAD is the clearance
    # that keeps the smoothed compression density off the irises: the gaussian
    # spreads a density edge by ~3*SOFT rows, so PAD > 3*SOFT.
    assert PAD > 3.0 * SOFT, 'PAD must clear the density blur'
    A = solve_amplitudes(m, y_lock, face_cap)
    snout_top, jaw_top = A['snout_top'], A['jaw_top']
    brow_bot, dip_top = A['brow_bot'], A['dip_top']

    prof_press = press_profile(h, snout_top, y_lock)
    prof_jaw = press_profile(h, jaw_top, y_lock)
    prof_brow = press_profile(h, dip_top, brow_bot)
    lock_hard = L.band_weight(h, -1e6, y_lock - 8, 8)

    # dy_dip carries the head as a unit (rigid skull + the brow give); dy_jaw
    # is the mouth working the lower half of the snout on its own clock.
    dy_dip = (A['a_dip'] * prof_press + A['a_brow'] * prof_brow)[:, None] * head_w
    dy_jaw = (A['a_jaw'] * prof_jaw)[:, None] * head_w

    # Muzzle pump: this one IS L.squash_dy, a real squash about the muzzle
    # band's own centre. A banded squash has to stretch whatever sits directly
    # above it, and on this foreshortened front view that is the eyes -- so it
    # is confined to the columns BETWEEN the irises, measured off the iris
    # blobs' inner edges, where the stretch lands on the forehead's centre
    # stripe instead. Hence the modest amplitude: outside that narrow strip
    # the pinned ramps above do the work.
    # It hangs off jaw_top, not snout_top. L.squash_dy feathers its band IN over
    # `feather` rows ABOVE the band, and a feather measured against the canvas
    # height reached 20 rows past the iris bottom -- a 5.6% stretch across the
    # eyes at the peak, in the one channel that was supposed to stay off them.
    # Starting at jaw_top with a feather of half the jaw zone keeps the whole
    # thing below snout_top, which is already clear of where the irises land.
    a_muz = MUZ_SQUASH * A['jaw_rows']
    half = 0.5 * (h - jaw_top)
    factor = 1.0 - a_muz / half
    muz = L.squash_dy(h, jaw_top, float(h), factor, 0.5 * A['jaw_rows'])
    x = np.arange(w, dtype=np.float64)
    inner = min(m['nose_x'] - m['eye_l_in'], m['eye_r_in'] - m['nose_x'])
    # hw*(1 + feather ratio) <= inner - margin, so even the falloff's outer
    # end stops short of an iris.
    hw = max(12.0, min(0.34 * m['sep'], (inner - 0.04 * m['sep']) / 1.45))
    fx = 0.45 * hw
    col = np.clip(np.minimum(L.smoothstep((x - (m['nose_x'] - hw - fx)) / fx),
                             1.0 - L.smoothstep((x - (m['nose_x'] + hw)) / fx)), 0, 1)
    dy_muz = (muz * lock_hard)[:, None] * col[None, :] * head_w

    # The muzzle pump. A 0..1 basis, positive; frame_at() SUBTRACTS it, so the
    # muzzle lifts. It is the one field that is not multiplied by lock_hard --
    # crossing the contact line is the entire point -- and the column window is
    # what makes that safe, so the two always travel together: W['col'] gates
    # the field here AND picks which columns frame_at() restores bit-exactly.
    #
    # The row ramp starts at snout_top, the same line the press ramp ends on,
    # and for the same reason: that is where the irises LAND after the head has
    # travelled, not where they start. Above it the pump is exactly 0, so the
    # eyes cannot be caught in it however wide the window gets. Below nose_y0 -
    # PAD it is exactly 1, so the nose, the mouth stem and the chin translate as
    # one rigid piece and the nose does not squash. Everything in between is the
    # blank white bridge, which is where the strain goes.
    #
    # frame_at() BLENDS rather than adds: inside the window, below the flat
    # line, the pump replaces the press instead of riding on top of it. Two
    # reasons, and the second is the one that cost a rebuild.
    #
    # The muzzle is a rigid object in this art -- a nose and a chin outline, two
    # art blocks tall. The press has no business deforming it; its travel
    # belongs in the blank bridge above. Blending puts it there.
    #
    # And warp() indexes by DESTINATION row. A nose whose source rows sit below
    # the press's dying tail still LANDS in that tail once it has travelled up,
    # and the tail is 5 px of gradient across a 29-row nose: the first build of
    # this pump measured a -14.8% nose at the peak, a squashed nose on a sprite
    # whose nose is two blocks tall. Under the blend the nose sits in a field
    # that is flat by construction, at every frame, whatever it travels.
    #
    # What that costs is honest and is what the solver below pays for: the press
    # now has R rows to be absorbed in instead of the whole snout, and the pump
    # wants the same R rows. So the amplitude is bisected against the PEAK LOCAL
    # COMPRESSION of the assembled field over the whole cycle -- measured, at
    # the muzzle's own centre column, not estimated.
    W = muzzle_window(img, m)
    pump_top = snout_top
    nose_span = m['nose_y0'] - m['iris_y1']
    nxi = int(round(m['nose_x']))
    hwc = head_w[:, nxi]
    press1 = [((DIP_T[i] * (A['a_dip'] * prof_press + A['a_brow'] * prof_brow)
                + JAW_T[i] * A['a_jaw'] * prof_jaw
                + MUZ_T[i] * muz * col[nxi]) * hwc) * lock_hard for i in range(FRAMES)]

    def bridge_rate(a):
        """Peak per-row compression of the blended field anywhere in the cycle."""
        flat = m['nose_y0'] - BRIDGE_PAD - a
        if flat - pump_top < 8.0:
            return 9.9
        b = 1.0 - press_profile(h, pump_top, flat)
        return max(float(-np.diff(press1[i] * (1.0 - b) - (PUMP_T[i] * a) * b).min())
                   for i in range(FRAMES))

    a_hi = min(TARGET_NOSE / m['css'], max(0.0, MAX_CLOSE * nose_span - A['face']))
    bound = 'target' if a_hi >= TARGET_NOSE / m['css'] - 1e-9 else 'span'
    if bridge_rate(a_hi) > MAX_BRIDGE:
        bound, lo, hi = 'bridge', 0.0, a_hi
        for _ in range(40):                      # bisect; monotone in a
            mid = 0.5 * (lo + hi)
            if bridge_rate(mid) > MAX_BRIDGE:
                hi = mid
            else:
                lo = mid
        a_hi = lo
    a_pump = a_hi
    pump_flat = m['nose_y0'] - BRIDGE_PAD - a_pump
    prof_pump = 1.0 - press_profile(h, pump_top, pump_flat)
    pump = prof_pump[:, None] * W['col'][None, :]

    # Ears: both tips shear the SAME way, by unequal amounts. Shearing them in
    # opposite directions (out, then in) was tried first and read as the whole
    # skull narrowing and widening -- a shrinking cat, not an ear twitch --
    # because the ears are a third of the head's height in these poses. Same
    # direction preserves the head's width and leaves only a lean. power=2.4
    # keeps the travel in the tips and the bases glued.
    head_top = int(np.where(head_raw.any(axis=1))[0].min())
    ear_bot = head_top + 0.45 * (m['eye_y'] - head_top)
    el, er = ear_masks(head_raw, head_top, ear_bot)
    ear_ramp = L.row_ramp(h, ear_bot, head_top, power=2.4)
    ear = (1.0 * soften(el, 12, 13.0) + 0.68 * soften(er, 12, 13.0)) * head_w
    dx_ear = A_EAR * ear * ear_ramp[:, None]

    # Where the left ear tip actually is, so the report can quote its travel
    # instead of the amplitude that was fed in.
    ys, xs = np.where(el)
    tip_y = int(ys.min())
    tip_x = int(xs[ys == ys.min()].mean())

    F = dict(dy_dip=dy_dip, dy_jaw=dy_jaw, dy_muz=dy_muz, dx_ear=dx_ear,
             head_w=head_w, lock_hard=lock_hard, head_raw=head_raw,
             head_top=head_top, ear_bot=ear_bot, tip=(tip_y, tip_x),
             muz_hw=hw, factor=factor,
             muz_peak=float(np.abs(muz * lock_hard).max()),
             pump=pump, col_pump=W['col'], a_pump=a_pump, win=W,
             pump_top=pump_top, pump_flat=pump_flat, nose_span=nose_span,
             pump_rate=bridge_rate(a_pump), pump_bound=bound,
             close=(A['face'] + a_pump) / nose_span)
    F.update(A)
    return F


def frame_at(img, m, F, i):
    """One frame. Frame 0 is the untouched source, by construction and by
    shortcut -- the loop runs through it and other layers register against it."""
    dip_t, jaw_t, muz_t, ear_t = DIP_T[i], JAW_T[i], MUZ_T[i], EAR_T[i]
    pump_t = PUMP_T[i]
    if not any((dip_t, jaw_t, muz_t, ear_t, pump_t)):
        return img.copy(), np.zeros(img.shape[:2]), np.zeros(img.shape[:2])

    dy = dip_t * F['dy_dip'] + jaw_t * F['dy_jaw'] + muz_t * F['dy_muz']
    dx = ear_t * F['dx_ear']
    # Insurance: the contact band never moves, in either axis, ever. An 8-row
    # ramp, so it cannot quietly attenuate a field that belongs further up.
    dx = dx * F['lock_hard'][:, None]
    dy = dy * F['lock_hard'][:, None]
    # ... except the pump, which is exempt by design and fenced by COLUMNS
    # instead of rows. It blends rather than adds, so the muzzle it lifts is a
    # rigid piece and not a squashed one -- see build_fields. Minus, so it lifts.
    b = F['pump']
    dy = dy * (1.0 - b) - (pump_t * F['a_pump']) * b

    out = L.warp(img, dx, dy)
    # Exact, not merely close -- and column-aware, because the pin the scene
    # anchors to is the PAWS, not the bottom rows. Every column the pump cannot
    # touch is restored byte for byte; the window's own columns are what moved.
    keep = F['col_pump'] <= 0.0
    out[m['y_lock']:, keep] = img[m['y_lock']:, keep]
    return out, dx, dy


# -- diagnostics ------------------------------------------------------------

def u8(img):
    return np.clip(np.rint(img), 0, 255).astype(np.uint8)


def clip_margin(img, dx, dy, t=16):
    """Does any painted pixel leave the canvas?

    The source already touches all four borders -- the tail at the top and
    right, a whisker at the left, the paws at the bottom -- so counting border
    pixels proves nothing (a sub-pixel shift of a border run feathers over one
    extra column and the count rises without anything being lost). The honest
    test is the forward map: where each painted source pixel LANDS.

    Returns the smallest slack in px to each edge; negative means clipped.
    """
    h, w, _ = img.shape
    solid = img[..., 3] > t
    yy, xx = np.mgrid[0:h, 0:w]
    xd = (xx + dx)[solid]
    yd = (yy + dy)[solid]
    return dict(left=float(xd.min()), right=float(w - 1 - xd.max()),
                top=float(yd.min()), bottom=float(h - 1 - yd.max()))


def border_gain(frame, img, t=16):
    """Canvas-border pixels that are painted in the frame and empty in the
    source. clip_margin() asks whether anything went OFF the canvas; this asks
    the cheaper, complementary question -- whether anything arrived ON its edge
    that was not already there. The muzzle only ever lifts, so the bottom border
    can LOSE alpha under it, and that is not a fault; gaining any is."""
    fa, sa = frame[..., 3] > t, img[..., 3] > t
    return int(sum((f & ~s).sum() for f, s in
                   ((fa[0], sa[0]), (fa[-1], sa[-1]), (fa[:, 0], sa[:, 0]),
                    (fa[:, -1], sa[:, -1]))))


def display(frame, m):
    """The frame at its true on-screen size, premultiplied -- what the browser
    composites. Every "does it read" number is measured here and not on the
    source-resolution art, because 6 source px of travel is 0.9 CSS px and only
    one of those two numbers is a fact about the animation."""
    return L.premul(L._resize(frame, m['css']))


def diff_frames(frames):
    """abs(frame_i - frame_0) x4 on black: alpha change in RED (silhouette
    moved), premultiplied colour change in GREEN (interior slid)."""
    base = L.premul(frames[0])
    out = []
    for f in frames:
        p = L.premul(f)
        da = np.abs(p[..., 3] - base[..., 3]) * 4.0
        dc = np.abs(p[..., :3] - base[..., :3]).max(axis=2) * 4.0
        d = np.zeros_like(f)
        d[..., 0] = np.clip(da, 0, 255)
        d[..., 1] = np.clip(dc, 0, 255)
        d[..., 3] = 255.0
        out.append(d)
    return out


def iris_stats(f, win):
    """Iris centre, vertical spread and blue mass inside a FIXED window, from
    SOFT weights rather than a threshold.

    Two traps here, both of which produced fake regressions before this was
    written. measure() finds the irises by labelling every blue blob over 200px
    in the whole sprite, which is right for setting the animation up and wrong
    for comparing frames: a marginal blob elsewhere on the cat crosses the
    threshold on one resampled frame and not the next, and the comparison then
    reports a 6% iris that never moved. And a hard threshold on a bilinearly
    resampled edge loses a row at the top and the bottom whenever the shift is
    fractional, which reads as an iris 3px shorter when nothing has deformed.

    So: one window, taken from frame 0 and grown by the travel, and a soft blue
    weight. The spread `sy` is a second moment, which a squash changes and edge
    softening barely does -- it is the honest shape check.
    """
    y0, y1, x0, x1 = win
    c = f[y0:y1, x0:x1]
    a = np.clip(c[..., 3] / 255.0, 0.0, 1.0)
    w = a * np.clip((c[..., 2] - np.maximum(c[..., 0], c[..., 1])) / 40.0, 0.0, 1.0)
    mass = float(w.sum())
    yy = np.arange(y0, y1, dtype=np.float64)[:, None]
    cy = float((w * yy).sum() / mass)
    sy = float(np.sqrt((w * (yy - cy) ** 2).sum() / mass))
    return cy, sy, mass


def pink_cy(f, win):
    """Nose centroid from soft pink weights in a FIXED window.

    The nose's top three rows sit ABOVE the contact band, so they are inside
    the press ramp's dying tail and pick up a few hundredths of a pixel. A blob
    detector rounds that to a whole row and reports 0.15 CSS px of nose travel
    that is not there; a weighted centroid over the whole nose reports what the
    eye would see.
    """
    y0, y1, x0, x1 = win
    c = f[y0:y1, x0:x1]
    a = np.clip(c[..., 3] / 255.0, 0.0, 1.0)
    w = a * np.clip((c[..., 0] - c[..., 2]) / 40.0, 0.0, 1.0)           * np.clip((c[..., 0] - c[..., 1]) / 40.0, 0.0, 1.0)
    yy = np.arange(y0, y1, dtype=np.float64)[:, None]
    return float((w * yy).sum() / w.sum())


def report(name, img, m, F, frames, dxs, dys):
    """Re-measure the baked frames with the same detectors that set the
    animation up, and print everything in CSS px at EAT_WIDTH."""
    h, w, _ = img.shape
    y_lock, css = m['y_lock'], m['css']
    src8 = u8(img)
    a0 = float(img[..., 3].sum())
    tip_y, tip_x = F['tip']
    print('  %s  %dx%d  block~%dpx  1 src px = %.3f CSS px'
          % (name, w, h, m['block'], css))
    print('     eye_y=%.0f cx=%.0f sep=%.0f   iris %.0f..%.0f   nose %.0f..%.0f   '
          'contact line %d' % (m['eye_y'], m['cx'], m['sep'], m['iris_y0'],
                               m['iris_y1'], m['nose_y0'], m['nose_y1'], y_lock))
    d_nose = m['nose_y0'] - y_lock
    W = F['win']
    lft, rgt = W['l'], W['r']
    print('     the nose top sits %.0f rows (%.2f CSS px) %s the contact line -- inside '
          'the pin by ROW, outside it by COLUMN, which is the whole trick'
          % (abs(d_nose), abs(d_nose) * css, 'below' if d_nose >= 0 else 'above'))
    print('     bottom contour: paw x%d..%d (depth<=%.0f) | notch x%d..%d (depth %.0f) | '
          'MUZZLE x%d..%d (depth %.0f) | notch x%d..%d (depth %.0f) | paw x%d..%d (depth<=%.0f)'
          % (lft['paw'][0], lft['paw'][1], lft['dmin'] + 0.5 * m['block'],
             lft['notch'][0], lft['notch'][1], lft['peak'],
             W['muz_run'][0], W['muz_run'][1], W['base'],
             rgt['notch'][0], rgt['notch'][1], rgt['peak'],
             rgt['paw'][0], rgt['paw'][1], rgt['dmin'] + 0.5 * m['block']))
    print('     muzzle window: free x%.0f..%.0f, feathered over %.0f/%.0f px (%.2f/%.2f CSS) '
          'centred on the notches; nearest paw column is %d px outside it'
          % (lft['x_in'], rgt['x_in'], lft['feather'], rgt['feather'],
             lft['feather'] * css, rgt['feather'] * css,
             int(min(lft['x_out'] - lft['paw'][1], rgt['paw'][0] - rgt['x_out']))))
    print('     zones: skull rigid ..%.0f | brow %.0f..%.0f (%d rows) | IRISES RIGID '
          '%.0f..%.0f | snout %.0f..%d (%d rows, jaw owns the lower %d)'
          % (F['dip_top'], F['dip_top'], F['brow_bot'], F['brow_rows'],
             F['brow_bot'], F['snout_top'], F['snout_top'], y_lock,
             F['snout_rows'], F['jaw_rows']))
    print('     amplitudes: face %.2f CSS px (wanted %.2f, bound by the %s)   skull '
          '%.2f CSS px   brow give %.1f%%   peak snout squash %.1f%% (ceiling %.0f%%)'
          % (F['face'] * css, F['want'] * css, F['bound'], F['skull'] * css,
             100 * F['brow_rate'], 100 * F['rate'], 100 * MAX_SNOUT))
    print('     pump: %.2f CSS px (%.1f src px, %.2f art blocks) up at f%d, bridge %.0f..%.0f '
          '(%d rows, %.0f%% local squash), nose rigid from %.0f down'
          % (F['a_pump'] * css, F['a_pump'], F['a_pump'] / m['block'], PUMP_PEAK,
             F['pump_top'], F['pump_flat'], F['pump_flat'] - F['pump_top'],
             100 * F['pump_rate'], F['pump_flat']))
    print('     eye-to-nose span %.0f rows (%.2f CSS px); press + pump close %.0f%% of it '
          '(ceiling %.0f%%); bridge squash %.0f%% (ceiling %.0f%%); bound by the %s'
          % (F['nose_span'], F['nose_span'] * css, 100 * F['close'], 100 * MAX_CLOSE,
             100 * F['pump_rate'], 100 * MAX_BRIDGE, F['pump_bound']))
    nfree = int((F['col_pump'] > 0).sum())
    print('     lock: rows %d..%d (%d rows, %.1f%%) held on %d of %d columns; %d muzzle '
          'columns are free   left ear tip at (%d,%d)'
          % (y_lock, h - 1, h - y_lock, 100.0 * (h - y_lock) / h, w - nfree, w, nfree,
             tip_y, tip_x))
    print('     columns are CSS px at width %g, measured on the BAKED frame with the '
          'same detectors that set the animation up' % EAT_WIDTH_CSS)
    print('     f   eye dy   ear dy   ear dx  nose dy nose src  nose sq | eye-nose span  '
          'iris strain  iris spread  iris mass | alpha   slack l/r/t/b')
    ok = True
    m0 = measure(frames[0])
    ys, xs = np.where(m0['iris_px'])
    # Size the window to the IRIS's own excursion, not the field's maximum: the
    # skull travels further than the eyes, and a window that overshoots reaches
    # into the snout's compression zone and reports its squash as the iris's.
    iy = slice(int(ys.min()), int(ys.max()) + 1)
    reach = int(max(np.abs(d[iy]).max() for d in dys)) + 4
    win = (max(0, int(ys.min()) - reach), min(h, int(ys.max()) + 1 + reach),
           max(0, int(xs.min()) - 8), min(w, int(xs.max()) + 9))
    # the left iris's own column: the face centre is the nose bridge, which the
    # muzzle pump deliberately works, and probing there measures that instead
    cxi = int(round(m['eye_l'][0]))
    # The nose window has to be as tall as the pump, or the centroid saturates
    # as the nose slides out of it and under-reports its own travel.
    nreach = int(np.ceil(F['a_pump'])) + 6
    nwin = (max(0, int(m['nose_y0']) - nreach), min(h, int(m['nose_y1']) + 5),
            max(0, int(m['nose_x'] - 0.12 * m['sep'])),
            min(w, int(m['nose_x'] + 0.12 * m['sep'])))
    ncy = pink_cy(frames[0], nwin)
    nxi = int(round(m['nose_x']))
    keep = F['col_pump'] <= 0.0
    pawcols = np.concatenate([F['win']['l']['paw_cols'], F['win']['r']['paw_cols']])
    noses = []
    icy, isy, imass = iris_stats(frames[0], win)
    span0 = m0['nose_y0'] - icy
    for i, (f, dx, dy) in enumerate(zip(frames, dxs, dys)):
        mi = measure(f)
        # Track the window with the iris. A moment measured in a window the
        # object is sliding through is a moment of how much of the object's
        # soft edge the window happens to be clipping, which moved 1.9% while
        # the geometry moved 0.00%. dy is flat across the irises, so one
        # integer shift puts them back in the same place in the window.
        shift = int(round(float(dy[int(m['eye_l'][1]), cxi])))
        cy, sy, mass = iris_stats(f, (win[0] + shift, win[1] + shift,
                                      win[2], win[3]))
        eye = (cy - icy) * css
        nose = (pink_cy(f, nwin) - ncy) * css
        # the feature the compression is quoted against: eye line to nose top,
        # two things anyone can point at on the sprite
        span = 100.0 * ((m0['nose_y0'] - cy) - span0) / span0
        ih = 100.0 * (sy / isy - 1.0)
        ia = 100.0 * (mass / imass - 1.0)
        # Exact and colour-free: invert the destination-indexed field at the
        # face's centre column to get where each source row LANDS, and ask what
        # happened to the distance between the iris's top and bottom. This is
        # the number the source-space "skew" check used to miss -- it read
        # 0.000 on a field that squashed the shipped eye by 4.3%.
        inv = np.arange(h, dtype=np.float64) - dy[:, cxi]
        dest = np.interp([m['iris_y0'], m['iris_y1']], inv,
                         np.arange(h, dtype=np.float64))
        strain = 100.0 * ((dest[1] - dest[0]) / (m['iris_y1'] - m['iris_y0']) - 1.0)
        # The nose again, by the same forward map: rigid means the distance
        # between its top and bottom rows survives, and a squashed nose would
        # read as travel to the centroid without ever moving the sprite.
        ninv = np.arange(h, dtype=np.float64) - dy[:, nxi]
        ndest = np.interp([m['nose_y0'], m['nose_y1']], ninv, np.arange(h, dtype=np.float64))
        nstrain = 100.0 * ((ndest[1] - ndest[0]) / (m['nose_y1'] - m['nose_y0']) - 1.0)
        nfield = float(dy[int(round(m['nose_y'])), nxi])
        edy = float(dy[tip_y, tip_x]) * css
        edx = float(dx[tip_y, tip_x]) * css
        drift = 100.0 * (float(f[..., 3].sum()) - a0) / a0
        ident = np.array_equal(u8(f)[y_lock:, keep], src8[y_lock:, keep])
        paws = np.array_equal(u8(f)[y_lock:, pawcols], src8[y_lock:, pawcols])
        gained = border_gain(f, img)
        cm = clip_margin(img, dx, dy)
        clipped = [k for k, v in cm.items() if v < -0.5]
        ok = ok and ident and paws and not clipped and abs(drift) < 1.5 and not gained
        noses.append((nose, nfield))
        print('     %d %8.2f %8.2f %8.2f %8.2f %7.1f %7.2f%% | %10.1f%% %10.2f%% %11.2f%% '
              '%9.2f%% | %6.2f%%  %4.1f/%4.1f/%4.1f/%4.1f%s%s%s%s'
              % (i, eye, edy, edx, nose, nfield, nstrain, span, strain, ih, ia, drift,
                 cm['left'], cm['right'], cm['top'], cm['bottom'],
                 '' if ident else '   LOCK BAND NOT IDENTICAL',
                 '' if paws else '   PAW COLUMNS MOVED',
                 '' if not gained else '   BORDER ALPHA +%d' % gained,
                 '' if not clipped else '   CLIPPED: ' + ','.join(clipped)))
        assert ident, 'frame %d touched the pinned columns of the contact band' % i
        assert paws, 'frame %d moved a paw column' % i
        assert not clipped, 'frame %d pushed content off the canvas: %s' % (i, clipped)
        assert not gained, 'frame %d put alpha on %d canvas-border pixels the source ' \
                           'leaves empty' % (i, gained)
        # The nose. Frame 0 is rest; the clock is rectified, so the muzzle may
        # only ever be at rest or above it; and the peak has to be big enough to
        # see at 140 CSS px, which is the entire reason this field exists. The
        # centroid is allowed to lag the field by a tenth of a pixel -- it is a
        # soft-weighted moment over a resampled blob, not a geometry read.
        assert nose <= 0.02, 'frame %d pushed the nose DOWN %.3f CSS px' % (i, nose)
        assert abs(nstrain) < 1.5, 'frame %d strained the nose %.2f%%' % (i, nstrain)
        if i == 0:
            assert abs(nose) < 1e-9, 'frame 0 moved the nose %.3f CSS px' % nose
        if i == PUMP_PEAK:
            assert -nose > 0.75 * TARGET_NOSE or -nose > 0.9 * F['a_pump'] * css, \
                'the nose only travels %.2f CSS px at the peak' % -nose
        # Rigidity, asserted twice and independently: `strain` is geometry (the
        # forward map, above), `spread` and `mass` are the baked pixels (a second
        # moment and a soft-weighted area -- see iris_stats for why a bbox and a
        # threshold are not usable here). Both have to hold; the first one alone
        # was what the previous build trusted, and in source space it lied.
        assert abs(strain) < 1.0, 'frame %d strained an iris %.2f%%' % (i, strain)
        assert abs(ih) <= 1.0 and abs(ia) <= 1.0, \
            'frame %d deformed an iris (spread %+.2f%%, mass %+.2f%%)' % (i, ih, ia)

    # The beat. A cycle whose consecutive steps are all the same size is a hum,
    # not a bite -- so this prints the step sizes at display resolution and
    # asserts the snap is the biggest one and the rest hold is the smallest.
    ds = [display(f, m) for f in frames]
    steps = []
    for i in range(FRAMES):
        d = np.abs(ds[(i + 1) % FRAMES] - ds[i]).max(axis=2)
        steps.append((int((d > 8).sum()), float(d.max())))
    print('     beat (display px changed / max delta, i -> i+1):  %s'
          % '   '.join('%d>%d %d/%.0f' % ((i, (i + 1) % FRAMES) + steps[i])
                       for i in range(FRAMES)))
    n = [s[0] for s in steps]
    beat = int(np.argmax(n)) == 1 and int(np.argmin(n)) == 5 and n[1] > 2.0 * n[5]
    print('     beat: biggest step is the snap f1>f2 (%d px), smallest is the wrap back '
          'to rest f5>f0 (%d px), ratio %.1fx: %s'
          % (n[1], n[5], n[1] / max(n[5], 1), 'BEAT' if beat else 'FLAT'))
    ok = ok and beat
    print('     nose travel, centroid (field), per frame:  %s'
          % '   '.join('f%d %+.2f CSS / %+.1f src' % (i, n[0], n[1])
                       for i, n in enumerate(noses)))
    print('     nose peak-to-peak: %.2f CSS px = %.2f art blocks; the paw columns it runs '
          'beside (x%d..%d and x%d..%d, %d columns) are bit-identical on every frame'
          % (max(n[0] for n in noses) - min(n[0] for n in noses),
             (max(n[1] for n in noses) - min(n[1] for n in noses)) / m['block'],
             F['win']['l']['paw'][0], F['win']['l']['paw'][1],
             F['win']['r']['paw'][0], F['win']['r']['paw'][1], pawcols.size))
    print('     contact band (bottom %.0f%%, rows %d..%d) bit-identical PRE-ENCODE on all '
          '%d pinned columns in all %d frames: YES'
          % (100.0 * LOCK_FRAC, y_lock, h - 1, int(keep.sum()), len(frames)))
    F['noses'] = noses
    return ok


def verify_encoded(out_file, frames, m, F):
    """Re-open the webp that SHIPPED and measure it.

    An older build asserted the contact band was bit-identical, which was true
    of the arrays in memory and false of the file: these strips are lossy VP8,
    so no row of the shipped asset is byte-equal to anything. The honest
    guarantee is a deviation ceiling measured after a decode, in premultiplied
    space, because premultiplied is what a browser composites.

    And it is measured on the PINNED COLUMNS, because the muzzle's columns are
    supposed to move down there now. The mask is downsampled conservatively --
    a decoded column counts as pinned only if every source column feeding it is,
    and then eroded again, because LANCZOS at half scale reaches about three
    source pixels either side and would otherwise smear the muzzle's travel into
    the first pinned column and fail an assertion that is not about the muzzle.
    """
    path = os.path.join(L.ANIM_DIR, out_file)
    dec = np.asarray(Image.open(path).convert('RGBA'), dtype=np.float64)
    fw = dec.shape[1] // FRAMES
    y_lock = int(round(m['y_lock'] * STRIP_SCALE))
    keep = F['col_pump'] <= 0.0
    pin = np.ones(fw, bool)
    src_x = np.arange(len(keep))
    np.minimum.at(pin, np.clip((src_x * STRIP_SCALE).astype(int), 0, fw - 1), keep)
    pin = ndimage.binary_erosion(pin, np.ones(9, bool))
    worst, stats = 0.0, []
    for i, f in enumerate(frames):
        exp = L.premul(L._resize(f, STRIP_SCALE))
        got = L.premul(dec[:, i * fw:(i + 1) * fw])
        d = np.abs(got - exp).max(axis=2)
        stats.append((d.mean(), np.percentile(d, 99)))
        worst = max(worst, float(d[y_lock:, pin].max()))
    # and the claim that matters to the eye: the shipped contact band does not
    # move BETWEEN frames either, wherever it is pinned
    base = L.premul(dec[:, :fw])[y_lock:][:, pin]
    wob = max(float(np.abs(L.premul(dec[:, i * fw:(i + 1) * fw])[y_lock:][:, pin] - base).max())
              for i in range(FRAMES))
    kb = os.path.getsize(path) / 1024.0
    print('     decoded %s (%.0fKB, q%d): premultiplied deviation from the pre-encode '
          'frames mean %.2f p99 %.0f' % (out_file, kb, QUALITY,
                                         np.mean([s[0] for s in stats]),
                                         np.mean([s[1] for s in stats])))
    print('     contact band in the SHIPPED file, on the %d/%d pinned columns: %.0f/255 off '
          'the source (ceiling %d), %.0f/255 frame-to-frame (ceiling %d)'
          % (int(pin.sum()), fw, worst, BAND, wob, WOBBLE))
    assert worst <= BAND, 'encoded contact band sits %.0f/255 off the source' % worst
    assert wob <= WOBBLE, 'encoded contact band wobbles %.0f/255 between frames' % wob
    return kb


# -- previews ---------------------------------------------------------------

def _sheet(rows, path, bg=(232, 232, 238), gut=8, th=16):
    fw = max(t[0].shape[1] for r in rows for t in r)
    fh = max(t[0].shape[0] for r in rows for t in r)
    cols = max(len(r) for r in rows)
    sheet = Image.new('RGBA', (cols * (fw + gut) + gut, len(rows) * (fh + th + gut) + gut),
                      tuple(bg) + (255,))
    d = ImageDraw.Draw(sheet)
    for ri, row in enumerate(rows):
        for ci, (im, lab) in enumerate(row):
            x, y = gut + ci * (fw + gut), gut + ri * (fh + th + gut)
            d.text((x + 2, y), lab, fill=(20, 20, 20, 255))
            sheet.alpha_composite(L.to_pil(im), (x, y + th))
    p = os.path.join(L.PREVIEW_DIR, path)
    sheet.convert('RGB').save(p)
    print('  preview -> %s  (%dx%d)' % (p, sheet.width, sheet.height))
    return p


def face_crop(f, m, zoom=3.0):
    """The face at `zoom` times its true on-screen size. Nothing about this
    animation can be judged at source resolution."""
    h, w, _ = f.shape
    y0 = int(m['iris_y0'] - 0.42 * m['sep'])
    x0 = max(0, int(m['cx'] - 1.0 * m['sep']))
    x1 = min(w, int(m['cx'] + 1.0 * m['sep']))
    return L._resize(f[y0:h, x0:x1], m['css'] * zoom)


def _nearest(c, zoom):
    im = L.to_pil(c).resize((c.shape[1] * zoom, c.shape[0] * zoom), Image.NEAREST)
    return np.asarray(im, dtype=np.float64)


def muzzle_crop(f, m, F, zoom=3):
    """Just the muzzle: the pink nose plus one art block of fur either side,
    and everything from a little above it down to the canvas bottom. NEAREST,
    because the question this tile answers -- did the nose move, and is it still
    attached to the face -- is a per-pixel one and LANCZOS would smear it."""
    h, w, _ = f.shape
    blk = int(m['block'])
    return _nearest(f[max(0, int(m['nose_y0'] - 2.2 * blk - F['a_pump'])):h,
                      max(0, m['nose_x0'] - blk):min(w, m['nose_x1'] + blk + 1)], zoom)


def paw_crop(f, m, F, zoom=3):
    """The left paw, the notch beside it and the muzzle's own edge, in one tile:
    the still thing and the moving thing together, at the same zoom."""
    h, w, _ = f.shape
    blk = int(m['block'])
    return _nearest(f[max(0, int(m['y_lock'] - 1.6 * blk)):h,
                      max(0, int(F['win']['l']['paw'][1] - 3 * blk)):
                      min(w, int(F['win']['l']['x_in'] + 1.5 * blk))], zoom)


def ladder(rates=(0.0, 0.15, 0.22, 0.30, 0.38, 0.44, 0.52)):
    """Why MAX_SNOUT is what it is: the same press at rising compression rates,
    on the pose with the most snout (1) and the one with the least (2), at 3x
    the shipped size. Read this before changing MAX_SNOUT.

    The geometry here is the solver's, not an approximation of it: for a rate r
    the snout gives up the travel it is about to absorb, so face = r*B/(1+r)
    and the zone starts at y_lock - (B - face). A tile labelled 44% is
    therefore the frame that actually ships on a pose bound at 44%.

    What the tiles show: below the eyes this art is a flat white muzzle with
    three black whisker strokes and a nose, so it squashes a long way before
    anything shears -- 44% still reads as a cat pressing its face into a bowl,
    and 52% is where the eyes start to sit on the nose. 0.44 is the last rung
    that was looked at and approved, which is why it is the ceiling rather than
    some rounder number.
    """
    rows = []
    for src in ('erenEat1.png', 'erenEat2.png'):
        img = L.load(src)
        m = measure(img)
        head_w = soften(parts(img, m)[0], DIL, SIG)
        y_lock = m['y_lock']
        B = y_lock - m['iris_y1'] - PAD
        hard = L.band_weight(m['h'], -1e6, y_lock - 8, 8)
        row = []
        for r in rates:
            face = r * B / (1.0 + r)
            prof = press_profile(m['h'], y_lock - (B - face), y_lock)
            dy = (face * prof)[:, None] * head_w * hard[:, None]
            f = L.warp(img, 0.0, dy)
            f[y_lock:] = img[y_lock:]
            row.append((face_crop(f, m), '%s %.0f%%  %.2f CSS'
                        % (src[4:9], 100 * r, face * m['css'])))
        rows.append(row)
    return _sheet(rows, 'eat_snout_ladder.png')


# -- main -------------------------------------------------------------------

def solve_pose(img, m):
    """Build the fields with the largest press that still leaves the nose a
    visible pump.

    The press is solved first and the pump gets what is left of the bridge, so
    on a short-gap pose the two are in direct competition: pose 4 has 44 rows of
    eye-to-nose against pose 1's 57, and at full press its nose moved 0.32 CSS
    px -- the frozen nose this rebuild exists to fix. Nobody watches the skull;
    they watch the nose. So when the pump comes out under PUMP_FLOOR, hand press
    travel back until it clears, and print what it cost."""
    F = build_fields(img, m)
    if F['a_pump'] * m['css'] >= PUMP_FLOOR:
        return F
    full = F['face']
    lo, hi = 0.0, full                    # the pump is monotone decreasing in face
    for _ in range(24):
        mid = 0.5 * (lo + hi)
        if build_fields(img, m, face_cap=mid)['a_pump'] * m['css'] >= PUMP_FLOOR:
            lo = mid
        else:
            hi = mid
    F = build_fields(img, m, face_cap=lo)
    assert F['a_pump'] * m['css'] >= PUMP_FLOOR - 1e-3, (
        'even at zero press the pump solves to %.2f CSS px, under the floor'
        % (F['a_pump'] * m['css']))
    print('     press yielded to the nose: face %.2f -> %.2f CSS px buys the pump '
          '%.2f CSS px (floor %.2f)'
          % (full * m['css'], F['face'] * m['css'], F['a_pump'] * m['css'], PUMP_FLOOR))
    return F


def main():
    print('baking the eat chew cycle: %d frames, %dms, 4 poses' % (FRAMES, DURATION_MS))
    print('targets: face %.2f / skull %.2f CSS px at width %g; snout squash ceiling '
          '%.0f%%; tail amplitude %.0f'
          % (TARGET_FACE, TARGET_SKULL, EAT_WIDTH_CSS, 100 * MAX_SNOUT, A_TAIL))
    print('muzzle pump: nose %.2f CSS px up at f%d, ceiling %.0f%% of the eye-to-nose span'
          % (TARGET_NOSE, PUMP_PEAK, 100 * MAX_CLOSE))
    all_ok = True
    total_kb = 0.0
    faces, muzzles, paws = [], [], []
    for idx, src in enumerate(POSES, start=1):
        img = L.load(src)
        h, w, _ = img.shape
        m = measure(img)
        F = solve_pose(img, m)
        frames, dxs, dys = [], [], []
        for i in range(FRAMES):
            f, dx, dy = frame_at(img, m, F, i)
            frames.append(f)
            dxs.append(dx)
            dys.append(dy)
        assert np.array_equal(u8(frames[0]), u8(img)), 'frame 0 is not the source'

        all_ok &= report(src, img, m, F, frames, dxs, dys)

        L.write_strip('eat%d' % idx, frames, 'eat%d_chew.webp' % idx, DURATION_MS,
                      (w, h), (0, 0, w, h), kind='loop', body_src=None,
                      scale=STRIP_SCALE, lossless=False, quality=QUALITY,
                      note='Chew: the head presses onto a pinned contact line and '
                           'the snout absorbs it. Rigid from the crown to the iris '
                           'bottom, so the eyes travel with the skull (%.2f CSS px '
                           'at 140 wide) and never deform -- iris strain is 0.00%% '
                           'on every frame. The muzzle then pumps on the jaw clock '
                           'inside its own column window between the paws: the nose '
                           'travels %.2f CSS px and the chin with it, while the paws '
                           'and the tail hold still. Lossy VP8, so the contact band '
                           'is NOT byte-identical: it decodes within %d/255 of the '
                           'source and moves at most %d/255 between frames.'
                           % (F['face'] * m['css'], F['a_pump'] * m['css'], BAND, WOBBLE))
        total_kb += verify_encoded('eat%d_chew.webp' % idx, frames, m, F)
        L.write_filmstrip(frames, 'eat%d_frames.png' % idx, scale=0.42)
        faces.append([(face_crop(f, m), '%s f%d' % (src[4:9], i))
                      for i, f in enumerate(frames)])
        muzzles.append([(muzzle_crop(f, m, F),
                         '%s f%d  nose %+.2f CSS' % (src[4:9], i, F['noses'][i][0]))
                        for i, f in enumerate(frames)])
        pcols = np.concatenate([F['win']['l']['paw_cols'], F['win']['r']['paw_cols']])
        paws.append([(paw_crop(f, m, F), '%s f%d  paw delta %d/255' %
                      (src[4:9], i, int(np.abs(u8(f)[m['y_lock']:, pcols].astype(np.int32) -
                                               u8(img)[m['y_lock']:, pcols].astype(np.int32)).max())))
                     for i, f in enumerate(frames)])
        if idx in (1, 4):
            L.write_gif(frames, 'eat%d_chew.gif' % idx, DURATION_MS, scale=0.5)
        if idx == 1:
            L.write_gif_scene(frames, 'eat1_scene.gif', DURATION_MS,
                              room='kitchen.png', target_w=int(EAT_WIDTH_CSS),
                              anchor=(0.5, 0.90))
            L.write_filmstrip(diff_frames(frames), 'eat1_diff.png', bg=(0, 0, 0),
                              scale=0.42)
    _sheet(faces, 'eat_face_zoom.png')
    _sheet(muzzles, 'eat_muzzle_ladder.png')
    _sheet(paws, 'eat_paws.png')
    ladder()
    print('four strips: %.0fKB total' % total_kb)
    print('all poses clean: %s' % ('YES' if all_ok else 'NO'))


if __name__ == '__main__':
    main()
