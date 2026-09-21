# -*- coding: utf-8 -*-
"""Smooth the dither band ruled across the bedroom window's sky.

The bedroom sky steps from a deep navy to a lighter horizon navy through a
single 28-row STIPPLE RAMP -- alternating (4,19,82) and (13,45,106) pixels at
increasing density. At 1:1 that is ordinary pixel-art dithering. The room is
never drawn at 1:1: `background-size: cover` puts a 768x1376 painting into a
~474x850 box, a 0.617 downscale, and a one-pixel stipple at 0.617 beats
against the sample grid. The band stopped reading as a gradient and started
reading as a textured stripe ruled across the whole window, which is what it
looked like on the phone -- the one thing in the room that was visibly not
painted.

So the ramp is replaced by an actual gradient: for every sky column, the solid
colour just above the band is interpolated to the solid colour just below it.
Same two endpoints, same height, no stipple -- and nothing to alias.

Only pixels that ARE the ramp are touched. The mask is a colour test against
the segment between the two dither colours, so stars, the moon's glow, the
mountains, the mullions, the sash and the curtains keep every pixel they had.

Idempotent: re-running finds the same band and recomputes the same gradient.

    py scripts/fix_bedroom_sky_band.py            # writes public/bedroom.png
    py scripts/fix_bedroom_sky_band.py --dry      # report only

Afterwards regenerate the window cut from the repainted art:

    py scripts/build_window_frames.py sleep
"""
import sys
import numpy as np
from PIL import Image

ART = 'public/bedroom.png'

# The band, measured off the painting (see the module docstring).
Y0, Y1 = 584, 615          # rows to repaint, inclusive
ABOVE = (576, 584)         # solid sky to take the top colour from
BELOW = (616, 623)         # solid sky to take the bottom colour from
XS, XE = 235, 516          # the window's glass, generously bounded

DARK = np.array([4, 19, 82], float)
LIGHT = np.array([13, 45, 106], float)
# Distance from the DARK->LIGHT segment. Tight on purpose: the ridgeline that
# rises into the band on the right is a blue only ~18 away from the ramp, and
# at a loose tolerance the gradient was painted straight over the mountain.
# Every real ramp pixel is ON the segment or antialiased onto it, so nothing
# is lost by holding this near zero.
TOL = 14.0


def near_ramp(px: np.ndarray) -> np.ndarray:
    """True where a pixel sits on (or very near) the dither's own colour ramp.

    Distance to the SEGMENT, not to either endpoint: the ramp's antialiased
    in-between pixels are as much a part of the band as its two extremes, and
    a two-endpoint test leaves them behind as a row of specks.
    """
    d = LIGHT - DARK
    v = px.astype(float) - DARK
    t = np.clip((v @ d) / (d @ d), 0.0, 1.0)
    return np.linalg.norm(v - t[..., None] * d, axis=-1) < TOL


def main() -> int:
    dry = '--dry' in sys.argv
    im = Image.open(ART).convert('RGB')
    a = np.array(im)

    band = a[Y0:Y1 + 1, XS:XE]
    mask = near_ramp(band)

    top = a[ABOVE[0]:ABOVE[1], XS:XE].astype(float)
    bot = a[BELOW[0]:BELOW[1], XS:XE].astype(float)

    # The two endpoint colours are read from the columns where the band
    # unambiguously runs sky-to-sky -- not from every column, because the
    # ridgeline and the sash interrupt some of them. They come out flat across
    # the window (5,19,80 -> 8,46,107), so one pair drives the whole gradient.
    # Per-column endpoints were tried first and were worse: the columns that
    # failed the end test kept their stipple and left three ragged patches of
    # the old band behind, which is the artefact this is meant to remove.
    def near(px, ref, tol=22.0):
        return np.linalg.norm(px.astype(float) - ref, axis=-1) < tol

    sel = (near(a[ABOVE[0]:ABOVE[1], XS:XE], DARK).mean(axis=0) > 0.7)         & (near(a[BELOW[0]:BELOW[1], XS:XE], LIGHT).mean(axis=0) > 0.7)
    c_top = np.median(top[:, sel], axis=(0, 1))
    c_bot = np.median(bot[:, sel], axis=(0, 1))

    n = Y1 - Y0 + 1
    t = ((np.arange(n) + 0.5) / n)[:, None, None]
    ramp = c_top[None, None] * (1 - t) + c_bot[None, None] * t

    out = band.copy()
    out[mask] = np.round(np.broadcast_to(ramp, band.shape))[mask].astype(np.uint8)
    write = mask

    print('columns sampled:  %d / %d' % (int(sel.sum()), XE - XS))
    print('pixels rewritten: %d' % int(write.sum()))
    print('top    %s' % c_top.round(1))
    print('bottom %s' % c_bot.round(1))

    if dry:
        return 0
    a[Y0:Y1 + 1, XS:XE] = out
    Image.fromarray(a).save(ART)
    print('wrote', ART)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
