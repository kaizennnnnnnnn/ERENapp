"""Bake the slow tail wiggle as a real BEND (24 frames, 3400ms loop).

WHAT THIS REPLACES
------------------
@keyframes erenTailWiggle rotates the whole tail LAYER rigidly about the hip:

    0%,100% rotate(0deg);  40% rotate(-8deg);  70% rotate(-2deg);

Measured against the real geometry (origin 71.8%/80.7% of the square box ->
source pivot (814.3, 1239.6)) that rotation moves the tip dx=-63.2 / dy=+1.0
and the mid bulge dx=-29.2 / dy=-17.9. So it is a stick swinging: displacement
grows LINEARLY with distance from the hip, and the fat middle of the tail gets
dragged 18px UPWARDS, which is why it reads as a rigid prop rather than fur.

WHAT THIS DOES INSTEAD
----------------------
A real tail bends. Three changes, all in one per-row horizontal field:

  dx(y, t) = AMP * w(s) * sway(u(t, s))          s = arc position, 0 root .. 1 tip

1. CURVATURE, not rotation.  w(s) = s**POWER (L.row_ramp) with POWER > 1, so
   the root is glued and the travel accumulates toward the free end. POWER=1.0
   would reproduce the old rigid swing exactly.
2. LAG.  Row s starts its sway LAG*s into the cycle, so a bend travels up the
   tail and the tip whips and follows through instead of tracking the base.
3. NO VERTICAL COMPONENT.  The tail is near-vertical over most of its length
   (a constant 91px-wide column from y=972 to y=1100), so a horizontal field is
   a good normal, and it drops the rotation's bogus 18px lift of the bulge.
   The shear stretches the arc by 3.7px over 457 (0.8%) -- unmeasurable.

The signal itself is L.sway, which IS the house keyframe (rest 0, -1 at 40%,
-0.25 at 70%), so the established rhythm survives. It is inward-only (dx <= 0
always): swinging OUT would lift the tail off the hip and read as detached,
swinging IN only ever tucks it further behind the body.

FRAME 0 MUST BE THE UNTOUCHED SOURCE (other layers composite against it, and
the loop passes through it). A naive phase lag breaks that -- sway(-LAG) is
-0.11, so the tip would sit 6px off at t=0. Fixed by remapping time per row
instead of shifting it: u = clip((t - LAG*s) / (1 - HOLD), 0, 1). sway() reads
0 at both ends of its cycle, so every clamped row rests, row s begins moving at
t = LAG*s (staggered onset) and finishes at t = (1-HOLD) + LAG*s <= 1 (the tip
settles last). Frame 0 is then bit-identical to the source crop, asserted below.

PAYLOAD
-------
The strip ships LOSSY (quality=92), not lossless. This is not a corner cut: an
idle loop is an always-on cost on the kitchen route, public/ bytes are billed
per deploy here, and there are seven more *_tail.png pairs queued for the same
treatment. libwebp keeps alpha lossless even in lossy mode, so the silhouette --
the only thing that survives a 7x downscale to 42x83 anyway -- is bit-identical,
and the worst RGB error inside the cat at ship size is a few levels out of 255.
235.3KB -> 110.1KB for a difference no one can see. Asserted in verify_shipped()
against the actual file, not against the float buffer that produced it.

Do NOT also drop BAKE_SCALE to 0.25 to save another 50KB: the double-downsample
puts 90/255 of error on the outline, and the outline is the whole style.

Run from the repo root with `py scripts/anim_tail.py`.
"""

import math
import os
import sys

sys.path.insert(0, 'scripts')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

import anim_lib as L


# -- tuning ----------------------------------------------------------------
# AMP is peak tip travel in SOURCE px. The old rigid rotation gave 63.2; 58 is
# a hair calmer and still ~3.6 native blocks (16px/block) = 7.9 CSS px at the
# kitchen's 7.3x downscale, so it stays well clear of both the ~1.1 CSS px
# visibility floor and the rubbery zone above ~3 blocks... which is exactly
# where the house amplitude already sits, deliberately.
AMP = 58.0
# 1.0 = the old rigid swing, 2.0 = constant curvature along the whole tail.
# 1.55 glues the root, keeps the fat mid-tail clearly participating (s=0.5
# still travels 19px = 2.6 CSS px) and puts the rest of the budget in the tip.
POWER = 1.55
# Onset lag from root to tip, as a fraction of the cycle: 0.14 * 3400ms = 476ms.
LAG = 0.14
# The sway is squeezed into (1 - HOLD) so every row is back at rest before the
# loop seam. Must be >= LAG or the tip would still be moving at t=1 and the
# loop would pop. The 0.02 slack is one frame of total stillness at the seam.
HOLD = 0.16

FRAMES = 24
DURATION_MS = 3400
# Frame where the tip is furthest in (max|dx| = 57.5px); used by the A/B sheet.
PEAK_FRAME = 11
# Bake resolution: the 307x608 source crop ships as 154x304, which the kitchen
# then draws at 42x83. Halving once is free; halving twice is NOT -- at 0.25 the
# double-downsample pushes ship-size RGB error to 90/255 on the outline, which
# is visible. Measured, not assumed.
BAKE_SCALE = 0.5
# The strip is LOSSY webp. libwebp keeps alpha lossless even in lossy mode, so
# the silhouette -- the only thing a 4x downscale really carries -- is
# bit-identical, while the file halves (235.3KB -> 110.1KB). Asserted below
# against the file that actually ships.
WEBP_QUALITY = 92
# The kitchen renders the 959px-wide sprite at 131 CSS px, so source px divided
# by 7.32 = CSS px. Everything the eye actually judges is in that second unit.
DISPLAY_SCALE = 959.0 / 131.0
TAIL_SRC = 'ErenCook_tail.png'
BODY_SRC = 'ErenCook_notail.png'


def tail_span(tail):
    """(y_tip, y_root) of the tail PROPER.

    A plain alpha bbox is wrong here: ErenCook_tail.png carries a 139px crumb
    of the ground shadow line at y=1261..1262, 16 empty rows below the tail, so
    the bbox bottom is 1263 and a ramp anchored there would let the root drift.
    Take the largest connected component instead.
    """
    lab, n = ndimage.label(tail[..., 3] > 16)
    sizes = ndimage.sum(np.ones_like(lab), lab, index=range(1, n + 1))
    main = int(np.argmax(sizes)) + 1
    ys = np.where(lab == main)[0]
    return int(ys.min()), int(ys.max())


def build():
    tail = L.load(TAIL_SRC)
    body = L.load(BODY_SRC)
    h, w, _ = tail.shape
    canvas = (w, h)

    y_tip, y_root = tail_span(tail)
    bbox = L.alpha_bbox(tail, thresh=0)
    print('tail  canvas %dx%d  bbox %s  tip row %d  root row %d  (arc %d rows)'
          % (w, h, bbox, y_tip, y_root, y_root - y_tip))

    # Arc position per row, and the curvature weight on it. row_ramp IS s**POWER
    # with the same clipping, so the two stay consistent by construction.
    s = np.clip((np.arange(h, dtype=np.float64) - y_root) / float(y_tip - y_root), 0.0, 1.0)
    weight = L.row_ramp(h, y_root, y_tip, POWER)

    frames, fields = [], []
    for i in range(FRAMES):
        t = i / float(FRAMES)
        u = np.clip((t - LAG * s) / (1.0 - HOLD), 0.0, 1.0)
        dx = AMP * weight * L.sway(u)          # <= 0 everywhere: inward only
        fields.append(dx)
        # Exact identity for the resting frame -- no premul/unpremul round-trip.
        frames.append(tail if np.abs(dx).max() == 0.0 else L.warp(tail, dx))

    pad = int(np.ceil(max(np.abs(f).max() for f in fields))) + 8
    rect = L.pad_rect(bbox, pad, canvas)
    crops = [L.crop(f, rect) for f in frames]
    print('pad %dpx -> rect %s  frame %dx%d'
          % (pad, rect, rect[2] - rect[0], rect[3] - rect[1]))

    verify(tail, body, crops, fields, rect, weight, y_tip, y_root)

    meta = L.write_strip('cookTail', crops, 'cook_tail.webp', DURATION_MS, canvas, rect,
                         kind='loop', body_src='/ErenCook_notail.png', scale=BAKE_SCALE,
                         lossless=False, quality=WEBP_QUALITY,
                         note='Tail bends instead of swinging: root glued, curvature '
                              'accumulates to the tip, tip lags 476ms and follows through. '
                              'Baked rhythm runs +7.6% late vs @keyframes erenTailWiggle '
                              '(tip peaks at 47.6% of the loop, not 40%) because the '
                              'per-row time remap squeezes the sway into 84% of the cycle. '
                              'Harmless alone; do not show this against a flat-PNG cat '
                              'still running the CSS rotation, or the two will beat.')

    verify_shipped(meta, crops, rect, canvas, tail, body)

    composites = [composite(c, body, rect, canvas) for c in crops]
    L.write_filmstrip(composites, 'tail_frames.png', scale=0.28, cols=8)
    L.write_gif_scene(composites, 'tail_scene.gif', DURATION_MS,
                      room='kitchen.png', target_w=131, anchor=(0.5, 0.90))
    # The hip is where this technique fails, so make it big and obvious. Wide
    # enough to show the body's hip and hind leg, not just tail fur.
    hip = (690, 1090, 959, 1310)
    L.write_filmstrip([L.crop(c, hip) for c in composites], 'tail_hip.png',
                      scale=1.2, cols=6)
    ab_vs_old(tail, body, composites)


def ab_vs_old(tail, body, composites):
    """Before/after at the REAL on-screen size (131x210 CSS px, then magnified
    with NEAREST so the eye can judge what it cannot see at 131px) -- the only
    comparison that answers "is the bend better than what ships today".
    Three panels: the shared rest pose, the shipped rigid rotate(-8deg) at its
    peak, and this bend at its peak."""
    h, w, _ = tail.shape
    ox, oy, ang = 814.3, 1239.6, math.radians(-8.0)      # measured in the docstring
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    rx, ry = xx - ox, yy - oy
    sx = ox + rx * math.cos(-ang) - ry * math.sin(-ang)  # inverse map = rotate content by ang
    sy = oy + rx * math.sin(-ang) + ry * math.cos(-ang)
    p = L.premul(tail)
    rot = np.empty_like(p)
    for c in range(4):
        rot[..., c] = ndimage.map_coordinates(p[..., c], [sy, sx], order=1,
                                              mode='constant', cval=0.0)
    old = L.to_pil(L.unpremul(rot))
    old_comp = L.to_pil(np.zeros((h, w, 4)))
    old_comp.alpha_composite(old)
    old_comp.alpha_composite(L.to_pil(body))

    panels = [('rest (both)', L.to_pil(composites[0])),
              ('OLD rigid -8deg', old_comp),
              ('NEW bend peak', L.to_pil(composites[PEAK_FRAME]))]
    shots = []
    for _, im in panels:
        small = im.resize((131, 210), Image.LANCZOS)     # true CSS size in the kitchen
        shots.append(small.resize((131 * 4, 210 * 4), Image.NEAREST))
    gut, fw, fh = 10, shots[0].width, shots[0].height
    sheet = Image.new('RGB', (len(shots) * fw + (len(shots) + 1) * gut, fh + 2 * gut),
                      (222, 214, 200))
    d = ImageDraw.Draw(sheet)
    for k, (s_im, (label, _)) in enumerate(zip(shots, panels)):
        x = gut + k * (fw + gut)
        sheet.paste(s_im.convert('RGB'), (x, gut), s_im)
        d.text((x + 4, gut + 4), label, fill=(40, 40, 40))
    out = os.path.join(L.PREVIEW_DIR, 'tail_vs_old.png')
    sheet.save(out)
    print('  a/b -> %s  (%dx%d)' % (out, sheet.width, sheet.height))


def composite(tail_crop, body, rect, canvas):
    """Full-canvas RGBA: the shipped tail crop pasted back at rect, body over."""
    w, h = canvas
    x0, y0, x1, y1 = rect
    layer = np.zeros((h, w, 4), dtype=np.float64)
    layer[y0:y1, x0:x1] = tail_crop
    im = L.to_pil(layer)
    im.alpha_composite(L.to_pil(body))
    return np.asarray(im, dtype=np.float64)


# -- numeric self-check ----------------------------------------------------

def verify(tail, body, crops, fields, rect, weight, y_tip, y_root):
    print('\nverify')
    assert np.array_equal(crops[0], L.crop(tail, rect)), 'frame 0 is not the untouched source'
    print('  frame 0 == untouched source crop: exact')

    for f in fields:
        assert f.max() <= 1e-9, 'dx went POSITIVE (outward) -- would open the hip'
    print('  dx <= 0 on every frame/row (inward only)')

    m0 = crops[0][..., 3].sum()
    print('  %-3s %10s %10s %10s %10s' % ('f', 'max|dx|', 'tip dx', 'root dx', 'mass drift'))
    worst_drift, worst_root = 0.0, 0.0
    for i, (c, f) in enumerate(zip(crops, fields)):
        drift = (c[..., 3].sum() - m0) / m0 * 100.0
        worst_drift = max(worst_drift, abs(drift))
        worst_root = max(worst_root, abs(f[y_root]))
        print('  %-3d %10.2f %10.2f %10.2f %9.3f%%'
              % (i, abs(f).max(), f[y_tip], f[y_root], drift))
    print('  worst alpha-mass drift %.3f%%   worst root-row |dx| %.2fpx (%.2f CSS px)'
          % (worst_drift, worst_root, worst_root / DISPLAY_SCALE))
    assert worst_drift < 1.0, 'lost content off the canvas'

    # Per-frame tip STEP, in the unit the eye judges. Printed, not asserted:
    # steps(24) spaces frames uniformly in TIME, but sway() is flat at both ends
    # of its smoothstep, so the ends genuinely cost frames that barely move.
    # That is the price of a uniform steps() timeline and it is paid knowingly --
    # see the rejected note in the writeup.
    tips = [f[y_tip] / DISPLAY_SCALE for f in fields]
    steps = [abs(tips[(i + 1) % FRAMES] - tips[i]) for i in range(FRAMES)]
    print('  tip position per frame (CSS px): %s'
          % ' '.join('%.2f' % v for v in tips))
    print('  tip STEP f->f+1 (CSS px):        %s'
          % ' '.join('%.2f' % v for v in steps))
    print('  %d of %d steps move the tip less than 0.25 CSS px (sub-pixel at ship size)'
          % (sum(1 for v in steps if v < 0.25), FRAMES))

    # Border alpha is asserted on the EXPORTED frames, not here -- see
    # verify_shipped(). At full float resolution the crop border is trivially
    # empty (source column 958 is blank); it only picks up alpha when the
    # 307->154 LANCZOS halving folds the tail's real rightmost columns into the
    # last one. Measuring the pre-downscale buffer was measuring the wrong thing.
    pre = max(max(c[..., 3][0].max(), c[..., 3][-1].max(),
                  c[..., 3][:, 0].max(), c[..., 3][:, -1].max()) for c in crops)
    print('  max alpha on the pre-downscale crop border: %.1f (the real check is below)' % pre)

    # Amplitude sanity in the units the brief is written in.
    print('  peak tip travel %.1f source px = %.2f CSS px = %.2f native blocks'
          % (AMP, AMP / DISPLAY_SCALE, AMP / 16.0))
    for frac in (0.25, 0.50, 0.75, 1.00):
        y = int(round(y_root - frac * (y_root - y_tip)))
        print('    s=%.2f (y=%4d)  travel %5.1f src px  %.2f CSS px'
              % (frac, y, AMP * weight[y], AMP * weight[y] / DISPLAY_SCALE))

    # THE HIP. Measured against frame 0, never against zero: the resting art
    # already has a 36px notch at y=1140 where the tail's inner curve leaves the
    # hip. That notch is the artist's, not ours. The only thing that matters is
    # whether any frame WIDENS it -- that is what reads as the tail detaching.
    ba = body[..., 3] > 200
    x0, y0 = rect[0], rect[1]
    hip_rows = range(y_root - 104, y_root + 1)   # whole junction, notch included

    def mask(c):
        m = np.zeros(body.shape[:2], dtype=bool)
        m[y0:y0 + c.shape[0], x0:x0 + c.shape[1]] = c[..., 3] > 16
        return m

    def hip_gaps(m):
        """Daylight per row between the body's right edge and the tail's left
        edge. Positive means you can see between them."""
        out = {}
        for y in hip_rows:
            t = np.where(m[y])[0]
            b = np.where(ba[y])[0]
            if t.size and b.size:
                out[y] = int(t.min() - b.max() - 1)
        return out

    rest = mask(crops[0])
    g0 = hip_gaps(rest)
    rest_vis = (rest & ~ba).sum()
    worst_growth, worst_hidden = -10 ** 9, 0.0
    for c in crops:
        m = mask(c)
        g = hip_gaps(m)
        worst_growth = max(worst_growth, max(g[y] - g0[y] for y in g))
        worst_hidden = max(worst_hidden, 100.0 * (m & ba).sum() / rest_vis)
    print('  resting hip notch %dpx (pre-existing); worst WIDENING by any frame %+dpx'
          % (max(g0.values()), worst_growth))
    assert worst_growth <= 0, 'a frame opened daylight at the hip'
    # Sanity that this reads as a BEND and not as the tail sliding under the
    # hip: the glued root means less of the tail hides than the rigid rotation
    # already hides today, even though the tip travels the same distance.
    print('  worst tail area tucked behind the body: %.1f%% '
          '(the shipped rigid rotate(-8deg) tucks 4.8%% at its peak)' % worst_hidden)
    print()


def verify_shipped(meta, crops, rect, canvas, tail, body):
    """Everything in verify() measures float buffers. This measures the FILE --
    the lossy-webp strip the browser actually downloads and draws."""
    print('verify shipped artifact')
    path = os.path.join(L.ANIM_DIR, os.path.basename(meta['src']))
    strip = np.asarray(Image.open(path).convert('RGBA'), dtype=np.int16)
    fw, fh, n = meta['frameW'], meta['frameH'], meta['frames']
    assert strip.shape == (fh, fw * n, 4), 'strip is not %d frames of %dx%d' % (n, fw, fh)
    got = [strip[:, i * fw:(i + 1) * fw] for i in range(n)]
    # What the encoder was handed: the same rounding to_pil() does, before webp.
    want = [np.clip(np.rint(L._resize(c, BAKE_SCALE)), 0, 255).astype(np.int16) for c in crops]

    # 1. ALPHA is the silhouette, and the silhouette is all a 4x downscale really
    #    carries. libwebp stores alpha losslessly even at quality=92, so this is
    #    an equality, not a tolerance.
    a_err = max(int(np.abs(g[..., 3] - w[..., 3]).max()) for g, w in zip(got, want))
    print('  alpha vs pre-encode buffer: maxerr %d over all %d frames' % (a_err, n))
    assert a_err == 0, 'lossy webp damaged alpha -- the silhouette is not safe'

    # 2. RGB, at full res and then at the size the kitchen actually draws.
    sw = max(1, int(round(131 * meta['rect']['width'] / 100.0)))
    sh = max(1, int(round(210 * meta['rect']['height'] / 100.0)))
    full_err, ship_err = 0, 0
    for g, w in zip(got, want):
        inside = w[..., 3] > 200
        if inside.any():
            full_err = max(full_err, int(np.abs(g[..., :3] - w[..., :3]).max(axis=2)[inside].max()))
        gs = np.asarray(L.to_pil(g.astype(np.float64)).resize((sw, sh), Image.LANCZOS), dtype=np.int16)
        ws = np.asarray(L.to_pil(w.astype(np.float64)).resize((sw, sh), Image.LANCZOS), dtype=np.int16)
        m = ws[..., 3] > 200
        if m.any():
            ship_err = max(ship_err, int(np.abs(gs[..., :3] - ws[..., :3]).max(axis=2)[m].max()))
    kb = os.path.getsize(path) / 1024.0
    print('  RGB inside silhouette: maxerr %d/255 full-res, %d/255 at ship size (%dx%d)'
          % (full_err, ship_err, sw, sh))
    print('  file %.1fKB at quality=%d (lossless would be ~235KB)' % (kb, WEBP_QUALITY))
    assert ship_err <= 24, 'lossy compression is visible at ship size'

    # 3. BORDER, measured on the exported frames -- the earlier version asserted
    #    this on the pre-downscale float buffer, where it is trivially true and
    #    therefore meaningless. Three of the four borders must be empty. The
    #    RIGHT one may not be: rect runs to the canvas edge, so the tail's real
    #    rightmost columns fold into the last column under the halving.
    #    That is the source's geometry, not a warp artifact, so the assertion is
    #    "only the right edge, and only where the source itself is flush".
    #    "Flush" has to be measured with the resampling kernel's real footprint,
    #    not a guessed slop: Pillow's LANCZOS has a support radius of 3 OUTPUT
    #    px, which at this scale reaches REACH source px in both axes. A tighter
    #    tolerance flags honest spill (source row 1109 legitimately reaches
    #    export row 196); a looser one would stop catching anything.
    reach = int(math.ceil(3.0 / BAKE_SCALE))
    flush = (tail[..., 3][:, canvas[0] - reach:] > 0).max(axis=1)
    bad_rows, worst_right, rows_hit = [], 0, set()
    for i, g in enumerate(got):
        a = g[..., 3]
        assert a[0].max() == 0 and a[-1].max() == 0, 'frame %d touches the top/bottom border' % i
        assert a[:, 0].max() == 0, 'frame %d touches the LEFT border (content moved outward)' % i
        for r in np.where(a[:, -1] > 0)[0]:
            worst_right = max(worst_right, int(a[r, -1]))
            rows_hit.add(int(r))
            src = int(rect[1] + r / BAKE_SCALE)
            if not flush[max(0, src - reach):src + reach + 1].any():
                bad_rows.append((i, int(r)))
    print('  borders: top/bottom/left empty on all %d frames' % n)
    rightmost = int(np.where(tail[..., 3].max(axis=0) > 0)[0].max())
    print('  right border carries alpha on %d of %d rows (max %d) -- every one of them'
          % (len(rows_hit), fh, worst_right))
    print('    maps to a source row where the tail runs flush to x=%d (the art\'s own'
          ' rightmost column)' % rightmost)
    assert not bad_rows, 'right-border alpha where the source is NOT flush: %s' % bad_rows[:5]
    print('    consequence in the app: the component slides the row with translateX, so the'
          '\n    only destination pixel this can reach is covered by opaque ErenCook_notail.png')

    shipped_sheet(meta, got, body)
    print()


def shipped_sheet(meta, got, body):
    """Contact sheet built from the DECODED strip, composited over the body at
    the sprite's true 131x210 CSS size and then magnified with NEAREST.

    The point of this file is that it is downstream of the encoder. Every other
    preview here is rendered from float buffers, which is how a border claim
    survived being false in the artifact for a whole review round.
    """
    cw, ch = 131, 210
    r = meta['rect']
    ox, oy = int(round(cw * r['left'] / 100.0)), int(round(ch * r['top'] / 100.0))
    sw = max(1, int(round(cw * r['width'] / 100.0)))
    sh = max(1, int(round(ch * r['height'] / 100.0)))
    body_small = L.to_pil(body).resize((cw, ch), Image.LANCZOS)
    shots = []
    for g in got:
        stage = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
        stage.alpha_composite(L.to_pil(g.astype(np.float64)).resize((sw, sh), Image.LANCZOS), (ox, oy))
        stage.alpha_composite(body_small)
        shots.append(np.asarray(stage.resize((cw * 3, ch * 3), Image.NEAREST), dtype=np.float64))
    L.write_filmstrip(shots, 'tail_shipped.png', cols=8, bg=(214, 206, 192))


if __name__ == '__main__':
    build()
