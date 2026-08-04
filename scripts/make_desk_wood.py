"""Generate the tileable oak-plank texture behind the Serbian notebooks.

The desk started as a stack of CSS repeating-linear-gradients. Those can only
make evenly spaced parallel stripes, which is exactly what wood is not — real
grain wanders, crowds together, and swirls around knots. So the texture is
generated instead, and the scene just tiles the image.

    py scripts/make_desk_wood.py

Writes public/desk_wood.webp, tileable on BOTH axes:

  - X: the tile is a whole number of planks, so its edge falls on a seam, and a
    seam breaks the grain anyway — nothing has to line up across it.
  - Y: the noise is built in the frequency domain (random phase over a 1/f
    falloff, then an inverse FFT), which is periodic by construction. Gaussian-
    blurred white noise is NOT, and butt-joining it leaves a visible band.

Grain is drawn as sin(x + warp): the warp displaces each line sideways by a
slowly-varying amount, so lines wander and bunch instead of running as rails.
Each plank gets its own noise offset and base tone, so no two look alike.
"""

from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / 'public' / 'desk_wood.webp'

PLANK_W = 84          # px, must divide WIDTH exactly
WIDTH = PLANK_W * 4   # 336 — tile edge lands on a seam
HEIGHT = 1024         # vertical repeat; grain is self-similar enough to hide it
SEED = 20260805

# This is a BACKDROP. Full-strength grain competes with the notebook covers
# lying on it, so the finished plate is pulled toward its own mean and dimmed
# a touch — dark enough that pastel covers read as sitting ON something.
CONTRAST = 0.86
BRIGHTNESS = 0.90

# Oak ramp, dark grain line -> lit summer wood.
DARK = np.array([0x4d, 0x2f, 0x14], dtype=float)
MID = np.array([0x8d, 0x5f, 0x2c], dtype=float)
LIGHT = np.array([0xc2, 0x91, 0x50], dtype=float)


def periodic_noise(h: int, w: int, ky: float, kx: float, falloff: float, seed: int) -> np.ndarray:
    """Smooth noise that tiles exactly, anisotropic via ky/kx.

    Amplitude falls off as r**-falloff, so scaling a frequency axis UP pushes
    that axis's detail into the cheap end of the spectrum and kills it. ky > 1
    therefore STRETCHES features along Y, which is what makes grain read as
    running the length of the board. (ky < 1 does the opposite and gives
    corrugated-cardboard ripples — that was the first pass's bug.)
    """
    rng = np.random.default_rng(seed)
    fy = np.fft.fftfreq(h)[:, None] * ky
    fx = np.fft.fftfreq(w)[None, :] * kx
    r = np.sqrt(fy ** 2 + fx ** 2)
    r[0, 0] = 1.0
    spec = (r ** -falloff) * np.exp(1j * rng.uniform(0, 2 * np.pi, (h, w)))
    n = np.fft.ifft2(spec).real
    return (n - n.mean()) / (n.std() + 1e-9)


def ramp(t: np.ndarray) -> np.ndarray:
    """Map 0..1 through DARK -> MID -> LIGHT."""
    t = np.clip(t, 0, 1)[..., None]
    lo = DARK + (MID - DARK) * (t / 0.5)
    hi = MID + (LIGHT - MID) * ((t - 0.5) / 0.5)
    return np.where(t < 0.5, lo, hi)


def build() -> Image.Image:
    rng = np.random.default_rng(SEED)
    ys, xs = np.mgrid[0:HEIGHT, 0:WIDTH].astype(float)

    plank = (xs // PLANK_W).astype(int)     # which board each pixel belongs to
    x_in = xs % PLANK_W                     # position across that board

    # ── Sideways displacement of the grain lines. Three octaves: long cathedral
    # sweeps, a medium wander, then fine jitter. Without the big first octave
    # the lines stay parallel and the whole thing reads as printed stripes.
    warp = (periodic_noise(HEIGHT, WIDTH, 7.0, 1.0, 2.3, SEED + 1) * 30.0
            + periodic_noise(HEIGHT, WIDTH, 4.0, 1.0, 1.9, SEED + 2) * 9.0
            + periodic_noise(HEIGHT, WIDTH, 2.0, 1.0, 1.5, SEED + 3) * 2.2)
    # Per-board offset so neighbouring planks never share a figure.
    warp = warp + plank * 149.0

    # ── Knots, resolved BEFORE the grain so the grain can bend around them.
    # Straight grain running past a dark blotch reads as a stain, not a knot.
    knot_pull = np.zeros_like(xs)
    knot_dark = np.zeros_like(xs)
    placed = 0
    while placed < 5:
        kx = float(rng.integers(0, WIDTH))
        ky = float(rng.integers(0, HEIGHT))
        # Boards are cut; knots aren't. Keep them off the seams.
        if not (PLANK_W * 0.22 < (kx % PLANK_W) < PLANK_W * 0.78):
            continue
        placed += 1
        rx, ry = rng.uniform(4.5, 7.5), rng.uniform(8.0, 14.0)
        # Wrap the distance so a knot near an edge tiles with itself.
        dx = (xs - kx + WIDTH / 2) % WIDTH - WIDTH / 2
        dy = (ys - ky + HEIGHT / 2) % HEIGHT - HEIGHT / 2
        d = np.sqrt((dx / rx) ** 2 + (dy / ry) ** 2)
        fall = np.exp(-d / 2.6)
        knot_pull += np.sign(dx) * fall * 26.0   # shoulder the grain aside
        knot_dark += fall * 0.30
        knot_dark += np.where(d < 1.0, 0.26, 0.0)

    warp = warp + knot_pull

    # ── Grain. Line spacing itself varies, so the figure crowds in places and
    # opens up in others the way sawn oak does.
    spacing = 11.5 + periodic_noise(HEIGHT, WIDTH, 9.0, 1.0, 2.4, SEED + 4) * 3.2
    g = np.sin((x_in + warp) / np.clip(spacing, 4.0, 30.0) * 2 * np.pi)
    # ** < 1 on the 0..1 form pushes the midtones up: wide light field, narrow
    # dark line. A raw sine gives equal bands, which looks like fabric.
    t = (0.5 + 0.5 * g) ** 0.45

    tone = 0.30 + 0.52 * t
    # Ring-porous specks — oak's open pores, elongated along the grain.
    pores = periodic_noise(HEIGHT, WIDTH, 3.0, 0.7, 1.1, SEED + 5)
    tone -= np.clip(pores - 1.25, 0, None) * 0.30
    # Broad blotchiness so a board isn't evenly lit end to end.
    tone += periodic_noise(HEIGHT, WIDTH, 5.0, 0.6, 2.1, SEED + 6) * 0.06
    # Each board cut from a different part of the log.
    tone += (rng.uniform(-0.05, 0.05, WIDTH // PLANK_W))[plank]
    tone -= knot_dark

    rgb = ramp(tone)

    # ── Plank seams: a dark groove with a lit lip on ONE side only. The
    # asymmetry is what makes it read as a bevel instead of a drawn line.
    rgb[x_in >= PLANK_W - 1] *= 0.34
    rgb[(x_in >= PLANK_W - 3) & (x_in < PLANK_W - 1)] *= 0.62
    rgb[x_in < 1] = np.minimum(255, rgb[x_in < 1] * 1.30)

    # Satin sheen across the board, so it looks varnished rather than matte.
    rgb *= (1.0 + 0.055 * np.sin((x_in / PLANK_W) * np.pi))[..., None]

    rgb = (rgb.mean() + (rgb - rgb.mean()) * CONTRAST) * BRIGHTNESS

    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB')


if __name__ == '__main__':
    img = build()
    # WebP: the plate is all smooth gradient, which PNG stores badly (400 KB+).
    img.save(OUT, quality=88, method=6)
    print(f'wrote {OUT.relative_to(OUT.parents[1])}  {img.size}  {OUT.stat().st_size // 1024} KB')
