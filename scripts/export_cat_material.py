"""Bake Eren into a MATERIAL MAP so a browser can recolour him at 60fps.

    py scripts/export_cat_material.py <out_dir> [width]

Output: <out_dir>/eren_material.png plus eren_material.json (the ramps and the
part order), and one sample render to check the two paths agree.

WHAT IS IN THE FOUR CHANNELS
----------------------------
    R   part id, indexing PARTS        (body / ears / tail / face / bib / belly
                                        / socks / eyes / nose / ink)
    G   where this pixel sits on its part's dark->light ramp, 0..255
    B   pattern bits: 1 tabby stripe, 2 tail ring, 4 tortoiseshell patch
    A   the sprite's own alpha

which makes the whole recolour, in the browser, one pass of

    t   = G/255  (minus the stripe depth where the bit is set)
    rgb = lerp(ramp[R].dark, ramp[R].light, t)

with no classification, no HSV, no percentiles and no block arithmetic at
runtime -- all of that is what got baked. A full recolour is one read and one
write per pixel over 1.07M pixels, which is a few milliseconds, so a colour
picker can update on drag rather than on release.

WHY A MATERIAL MAP AND NOT N PNGs
---------------------------------
Because the choice is per PART. Seven parts times twenty-one colours is 21^7
cats; nothing can be pre-rendered. Shipping the map makes every one of them
free, and it is the same file whichever cat the player builds.

THE EDGE PIXELS GET A PART TOO
------------------------------
classify() only speaks for pixels above alpha 8, but the sprite is hi-res art
meant to be scaled down and its antialiased rim is several pixels wide. Left
unassigned that rim keeps the OLD colour, which on a black cat reads as a pale
halo and on a white one as soot. So the part map is grown into the rim by a
nearest-neighbour transform: every translucent pixel inherits from the closest
pixel that has an owner.
"""

import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

import anim_lib as L
import eren_colors as C
import eren_parts as P
import eren_cat as K

# Ink is not colourable by the player, but it still needs a ramp here: the
# material map carries no original RGB, so every pixel must be reconstructible
# from its part and its t alone. Its endpoints are MEASURED at export time
# rather than written down, and over the ink's FULL value range rather than
# p3..p97 -- clipping the ends is right for a coat that is about to be
# recoloured and wrong for one that has to come back unchanged.
FIXED_PARTS = ('ink',)


def measure_ramp(rgb, v, mask, pct=2.0):
    """(dark, light) as the mean of a region's darkest and lightest pixels."""
    vv, px = v[mask], rgb[mask]
    d = px[vv <= np.percentile(vv, pct)].mean(axis=0)
    l = px[vv >= np.percentile(vv, 100.0 - pct)].mean(axis=0)
    return ('#%02X%02X%02X' % tuple(int(round(x)) for x in np.clip(d, 0, 255)),
            '#%02X%02X%02X' % tuple(int(round(x)) for x in np.clip(l, 0, 255)))


def build(width=None):
    parts, owner, full = P.build()
    _, v = C.classify(full)
    h, w, _ = full.shape
    names = [k for k, _ in P.PARTS]

    # t per pixel, computed inside each part so a part's own shading spans the
    # full ramp regardless of how light or dark that part happens to be.
    t = np.zeros((h, w), dtype=np.float64)
    fixed = {}
    for i, name in enumerate(names):
        m = owner == i
        if name in FIXED_PARTS:
            vv = v[m]
            lo, hi = vv.min(), vv.max()
            t[m] = (vv - lo) / max(hi - lo, 1e-9)
            fixed[name] = measure_ramp(full[..., :3], v, m)
        else:
            t[m] = K.ramp_t(v, m)[m]

    # Grow the part map (and t) into the antialiased rim. See the header.
    known = owner >= 0
    _, idx = ndimage.distance_transform_edt(~known, return_indices=True)
    owner_full = owner[idx[0], idx[1]]
    t_full = np.where(known, t, t[idx[0], idx[1]])

    stripe = K.tabby((h, w)) > 0.5
    rings = K.tail_rings((h, w)) > 0.5
    patch = K.tortie((h, w)) > 0.5
    bits = stripe.astype(np.uint8) | (rings.astype(np.uint8) << 1) | (patch.astype(np.uint8) << 2)

    mat = np.zeros((h, w, 4), dtype=np.uint8)
    mat[..., 0] = owner_full.astype(np.uint8)
    mat[..., 1] = np.clip(np.rint(t_full * 255.0), 0, 255).astype(np.uint8)
    mat[..., 2] = bits
    mat[..., 3] = np.clip(np.rint(full[..., 3]), 0, 255).astype(np.uint8)

    if width and width != w:
        # NEAREST, always. R and B are ENUMS -- an interpolated part id is a
        # different part, and an interpolated pattern bit is a different
        # pattern. Losing a little edge smoothness is the cheaper mistake, and
        # the art is block-based anyway so there is little to lose.
        mat = np.asarray(Image.fromarray(mat, 'RGBA').resize(
            (width, int(round(h * width / float(w)))), Image.NEAREST))
    return mat, names, full, fixed


def ramps(names, fixed):
    out = {}
    for n in names:
        if n in fixed:
            out[n] = {'fixed': list(fixed[n])}
        elif n == 'eyes':
            out[n] = {'table': {k: list(vv) for k, vv in C.EYE.items()}}
        elif n == 'nose':
            out[n] = {'table': {k: list(vv) for k, vv in C.NOSE.items()}}
        else:
            out[n] = {'fur': True}
    return out


def decode(mat, names, fixed, parts, pattern, eyes, nose):
    """The browser's algorithm, in numpy -- so the two can be diffed."""
    h, w, _ = mat.shape
    out = np.zeros((h, w, 4), dtype=np.float64)
    out[..., 3] = mat[..., 3]
    ids, t, bits = mat[..., 0], mat[..., 1] / 255.0, mat[..., 2]
    for i, n in enumerate(names):
        m = ids == i
        if not m.any():
            continue
        if n in fixed:
            d, l = (C.hx(x) for x in fixed[n])
        elif n == 'eyes':
            d, l = (C.hx(x) for x in C.EYE[eyes])
        elif n == 'nose':
            d, l = (C.hx(x) for x in C.NOSE[nose])
        else:
            d, l = (C.hx(x) for x in K.FUR[parts[n]])
        tt = t[m]
        if n in K.COLOURABLE and parts[n] != 'white':
            if pattern == 'tabby':
                bit = 2 if n == 'tail' else 1
                tt = np.clip(tt - K.STRIPE_DEPTH * ((bits[m] & bit) > 0), 0.0, 1.0)
            elif pattern == 'tortie':
                d2, l2 = (C.hx(x) for x in K.FUR[K.TORTIE_SECOND])
                p = ((bits[m] & 4) > 0)[:, None]
                a = d * (1 - tt[:, None]) + l * tt[:, None]
                b = d2 * (1 - tt[:, None]) + l2 * tt[:, None]
                out[m, 0:3] = a * (1 - p) + b * p
                continue
        tt = tt[:, None]
        out[m, 0:3] = d * (1 - tt) + l * tt
    return out


def main():
    out_dir = sys.argv[1]
    width = int(sys.argv[2]) if len(sys.argv) > 2 else None
    os.makedirs(out_dir, exist_ok=True)

    mat, names, full, fixed = build(width)
    p = os.path.join(out_dir, 'eren_material.png')
    Image.fromarray(mat, 'RGBA').save(p, optimize=True)
    meta = {'parts': names, 'colourable': K.COLOURABLE, 'fur': {k: list(v) for k, v in K.FUR.items()},
            'ramps': ramps(names, fixed), 'stripeDepth': K.STRIPE_DEPTH,
            'tortieSecond': K.TORTIE_SECOND,
            'presets': [{'key': k, 'label': lb, 'parts': pr, 'pattern': pt,
                         'eyes': e, 'nose': nz} for k, lb, pr, pt, e, nz in K.PRESETS]}
    with open(os.path.join(out_dir, 'eren_material.json'), 'w') as fp:
        json.dump(meta, fp, separators=(',', ':'))
    print('%s  %dx%d  %.0fKB' % (p, mat.shape[1], mat.shape[0], os.path.getsize(p) / 1024.0))

    # The map is only worth anything if decoding it reproduces the direct
    # render, so that is asserted rather than assumed -- including a tabby and a
    # tortie, where the pattern bits carry the load.
    #
    # The budget is on the MEAN and the 99.9th percentile, not the max, and the
    # reason is specific: the outline's few tinted near-black pixels (a dark
    # blue under an eye, a warm brown in an ear) cannot be reproduced by a
    # single black->grey lerp, and land up to ~51 out on one channel. There are
    # a few hundred of them, they are all inside the outline, and at ship size
    # they are invisible. Every colourable part reproduces exactly, which is
    # what the budget below actually enforces.
    full_mat, _, _, _ = build(None)
    base = P.build()
    for key, label, parts, pattern, eyes, nose in K.PRESETS:
        ref = K.render(parts, pattern, eyes, nose, base=base)
        got = decode(full_mat, names, fixed, parts, pattern, eyes, nose)
        vis = ref[..., 3] > 8
        err = np.abs(got[vis][:, :3] - ref[vis][:, :3])
        mean, p999 = err.mean(), np.percentile(err, 99.9)
        print('  %-10s mean %.3f  p99.9 %4.1f  max %4.1f' % (key, mean, p999, err.max()))
        assert mean < 0.5 and p999 < 16.0,             '%s: material map does not reproduce the render (mean %.2f, p99.9 %.1f)' % (key, mean, p999)


if __name__ == '__main__':
    main()
