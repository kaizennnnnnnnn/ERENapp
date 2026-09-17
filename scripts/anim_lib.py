"""Shared helpers for baking Eren sprite-animation frame strips.

READ-ONLY for the per-animation bakers (scripts/anim_tail.py, anim_blink.py,
anim_eat.py): they import it, they never edit it. The strip layout and the JSON
manifest written here are the contract src/lib/erenAnim.ts (and therefore the
playback component) reads, so a baker changing it would break the other two.

Run with `py` (not `python`) -- that's the interpreter with Pillow/numpy/scipy.

Conventions
-----------
* Images are float64 (H, W, 4) RGBA, 0..255, straight (un-premultiplied) alpha.
* A displacement field says where content MOVES TO: warp() samples the source
  at (x - dx, y - dy), so dx=+5 slides those pixels 5px right.
* Every strip is ONE ROW of N equal frames, left to right, frame 0 first. The
  playback component animates background-position-x 0%->100% with steps(N).
* `rect` in a manifest is the frame's placement inside the FULL sprite canvas,
  in percent, so the component can position an overlay (tail, eye band) over
  the body PNG with no letterbox math. A full-canvas animation uses 0/0/100/100.
"""

import json
import os

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, 'public')
ANIM_DIR = os.path.join(PUBLIC, 'anim')
PREVIEW_DIR = os.path.join(ROOT, 'scripts', 'anim_preview')
for _d in (ANIM_DIR, PREVIEW_DIR):
    os.makedirs(_d, exist_ok=True)


# -- loading / geometry -----------------------------------------------------

def load(rel):
    """Load an RGBA sprite. `rel` is relative to public/ unless absolute."""
    p = rel if os.path.isabs(rel) else os.path.join(PUBLIC, rel)
    return np.asarray(Image.open(p).convert('RGBA'), dtype=np.float64)


def to_pil(img):
    return Image.fromarray(np.clip(np.rint(img), 0, 255).astype(np.uint8), 'RGBA')


def save_png(img, path):
    to_pil(img).save(path)


def alpha_bbox(img, thresh=16):
    """(x0, y0, x1, y1) with x1/y1 EXCLUSIVE."""
    m = img[..., 3] > thresh
    ys, xs = np.where(m)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def pad_rect(rect, pad, canvas):
    """Grow a rect by `pad` px, clamped to the canvas (w, h)."""
    x0, y0, x1, y1 = rect
    w, h = canvas
    return (max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad))


def crop(img, rect):
    x0, y0, x1, y1 = rect
    return img[y0:y1, x0:x1].copy()


# -- alpha-safe warping ----------------------------------------------------

def premul(img):
    out = img.copy()
    a = img[..., 3:4] / 255.0
    out[..., :3] = img[..., :3] * a
    return out


def unpremul(img):
    out = img.copy()
    a = np.clip(img[..., 3:4], 0, 255) / 255.0
    safe = np.where(a > 1e-4, a, 1.0)
    out[..., :3] = np.clip(img[..., :3] / safe, 0, 255)
    out[..., 3:4] = np.clip(img[..., 3:4], 0, 255)
    return out


def _field(v, h, w):
    v = np.asarray(v, dtype=np.float64)
    if v.ndim == 1:
        v = v.reshape(-1, 1)
    return np.broadcast_to(v, (h, w))


def warp(img, dx, dy=None, order=1):
    """Displace content by (dx, dy) fields, interpolating in premultiplied
    space so no dark/white halo bleeds out of the transparent surround.

    dx/dy may be a scalar, a length-H column vector, or a full (H, W) array.
    order=1 (bilinear) is deliberate: cubic overshoots on this art's hard
    block edges and rings.
    """
    h, w, _ = img.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    sx = xx - _field(dx, h, w)
    sy = yy if dy is None else yy - _field(dy, h, w)
    p = premul(img)
    out = np.empty_like(p)
    for c in range(4):
        out[..., c] = ndimage.map_coordinates(p[..., c], [sy, sx], order=order,
                                              mode='constant', cval=0.0)
    return unpremul(out)


def feather_edges(img, px):
    """Ramp alpha to 0 over `px` at all four borders. Use on an OVERLAY crop so
    its boundary can't read as a rectangle over the body underneath."""
    if px <= 0:
        return img
    h, w, _ = img.shape
    ry = smoothstep(np.clip(np.minimum(np.arange(h), h - 1 - np.arange(h)) / float(px), 0, 1))
    rx = smoothstep(np.clip(np.minimum(np.arange(w), w - 1 - np.arange(w)) / float(px), 0, 1))
    out = img.copy()
    out[..., 3] = img[..., 3] * np.outer(ry, rx)
    return out


# -- easing / signal shaping ----------------------------------------------

def smoothstep(t):
    t = np.clip(t, 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def sway(t):
    """The house tail signal, matching @keyframes erenTailWiggle: rest at 0,
    peaks INWARD (-1) at 40% of the cycle, eases back through -0.25 at 70%.
    Inward-only -- swinging the tip out opens a gap at the hip. t wraps mod 1."""
    t = np.atleast_1d(np.asarray(t, dtype=np.float64)) % 1.0
    out = np.empty_like(t)
    a = t < 0.40
    out[a] = -smoothstep(t[a] / 0.40)
    b = (t >= 0.40) & (t < 0.70)
    out[b] = -1.0 + 0.75 * smoothstep((t[b] - 0.40) / 0.30)
    c = t >= 0.70
    out[c] = -0.25 * (1.0 - smoothstep((t[c] - 0.70) / 0.30))
    return out if out.size > 1 else float(out[0])


def row_ramp(h, y_root, y_tip, power=1.6):
    """0 at the root row, 1 at the tip row, eased by `power` so a bend keeps
    the base glued and puts the travel in the free end."""
    s = (np.arange(h, dtype=np.float64) - y_root) / float(y_tip - y_root)
    return np.clip(s, 0.0, 1.0) ** power


def band_weight(h, y0, y1, feather):
    """1.0 inside rows [y0, y1], smoothly 0 outside over `feather` rows. Use
    this to move a body part without tearing it off its neighbours."""
    y = np.arange(h, dtype=np.float64)
    up = smoothstep((y - (y0 - feather)) / max(feather, 1e-6))
    dn = 1.0 - smoothstep((y - y1) / max(feather, 1e-6))
    return np.clip(np.minimum(up, dn), 0.0, 1.0)


def squash_dy(h, y0, y1, factor, feather):
    """Vertical dy field that scales rows [y0, y1] about their centre by
    `factor` (1.0 = no change, 0.94 = squashed), ramping to 0 outside so the
    surrounding art is untouched. Feed to warp(img, 0, dy)."""
    y = np.arange(h, dtype=np.float64)
    c = 0.5 * (y0 + y1)
    dy = (y - c) * (factor - 1.0)
    return dy * band_weight(h, y0, y1, feather)


# -- output: strip + manifest ---------------------------------------------

def _resize(img, scale):
    if scale == 1.0:
        return img
    h, w, _ = img.shape
    im = to_pil(premul(img)).resize((max(1, int(round(w * scale))), max(1, int(round(h * scale)))),
                                    Image.LANCZOS)
    return unpremul(np.asarray(im, dtype=np.float64))


def write_strip(name, frames, out_file, duration_ms, canvas, rect, *,
                kind='loop', body_src=None, scale=1.0, lossless=True, quality=92,
                note=''):
    """Write public/anim/<out_file> as a 1-row strip plus public/anim/<name>.json.

    name        manifest key, e.g. 'cookTail'
    frames      list of equal-sized RGBA arrays, frame 0 first
    out_file    e.g. 'cook_tail.webp'
    duration_ms full loop length (the component's animation-duration)
    canvas      (w, h) of the FULL sprite canvas `rect` is measured against
    rect        (x0, y0, x1, y1) placement of the frame inside that canvas
    body_src    the sprite PNG this layer composites over ('/ErenCook_notail.png')
    """
    assert frames, 'no frames'
    shapes = {f.shape for f in frames}
    assert len(shapes) == 1, 'frames must all be the same size, got %s' % shapes
    scaled = [_resize(f, scale) for f in frames]
    fh, fw, _ = scaled[0].shape
    strip = np.zeros((fh, fw * len(scaled), 4), dtype=np.float64)
    for i, f in enumerate(scaled):
        strip[:, i * fw:(i + 1) * fw] = f
    out_path = os.path.join(ANIM_DIR, out_file)
    kw = dict(lossless=True, method=6) if lossless else dict(quality=quality, method=6)
    to_pil(strip).save(out_path, 'WEBP', **kw)

    cw, ch = canvas
    x0, y0, x1, y1 = rect
    meta = {
        'name': name,
        'src': '/anim/' + out_file,
        'frames': len(frames),
        'durationMs': duration_ms,
        'kind': kind,
        'frameW': fw, 'frameH': fh,
        'canvas': [cw, ch],
        'rect': {
            'left': round(100.0 * x0 / cw, 4), 'top': round(100.0 * y0 / ch, 4),
            'width': round(100.0 * (x1 - x0) / cw, 4), 'height': round(100.0 * (y1 - y0) / ch, 4),
        },
        'bodySrc': body_src,
        'note': note,
    }
    with open(os.path.join(ANIM_DIR, name + '.json'), 'w') as fp:
        json.dump(meta, fp, indent=2)
    kb = os.path.getsize(out_path) / 1024.0
    print('  strip %-22s %d frames  %dx%d each  %.0fKB  -> %s'
          % (name, len(frames), fw, fh, kb, meta['src']))
    return meta


# -- output: human/vision preview -----------------------------------------

def write_filmstrip(frames, out_file, *, bg=(228, 228, 234), scale=1.0, cols=None,
                    labels=True, gutter=6):
    """Contact sheet of every frame on a flat background, index-labelled -- the
    artifact a vision pass actually reads. Saved under scripts/anim_preview/."""
    fs = [_resize(f, scale) for f in frames]
    fh, fw, _ = fs[0].shape
    cols = cols or min(len(fs), 8)
    rows = (len(fs) + cols - 1) // cols
    head = 14 if labels else 0
    W = cols * fw + (cols + 1) * gutter
    H = rows * (fh + head) + (rows + 1) * gutter
    sheet = Image.new('RGBA', (W, H), tuple(bg) + (255,))
    d = ImageDraw.Draw(sheet)
    for i, f in enumerate(fs):
        r, c = divmod(i, cols)
        x = gutter + c * (fw + gutter)
        y = gutter + r * (fh + head + gutter)
        if labels:
            d.text((x + 2, y), str(i), fill=(30, 30, 30, 255))
        sheet.alpha_composite(to_pil(f), (x, y + head))
    p = os.path.join(PREVIEW_DIR, out_file)
    sheet.convert('RGB').save(p)
    print('  filmstrip -> %s  (%dx%d)' % (p, W, H))
    return p


def write_gif(frames, out_file, duration_ms, *, bg=(228, 228, 234), scale=1.0,
              ping_pong=False):
    """Flat-background GIF of the cycle, for a quick human look."""
    fs = [_resize(f, scale) for f in frames]
    if ping_pong and len(fs) > 2:
        fs = fs + fs[-2:0:-1]
    ims = []
    for f in fs:
        o = Image.new('RGBA', (f.shape[1], f.shape[0]), tuple(bg) + (255,))
        o.alpha_composite(to_pil(f))
        ims.append(o.convert('P', palette=Image.ADAPTIVE, colors=255))
    p = os.path.join(PREVIEW_DIR, out_file)
    ims[0].save(p, save_all=True, append_images=ims[1:], loop=0,
                duration=max(20, int(round(duration_ms / len(ims)))), disposal=2)
    print('  gif -> %s (%d frames, %dms)' % (p, len(ims), duration_ms))
    return p


def write_gif_scene(frames, out_file, duration_ms, *, room='kitchen.png',
                    target_w=131, anchor=(0.5, 0.90), zoom=2, ping_pong=False):
    """GIF of the cycle composited into the real room at the real on-screen
    size, then zoomed -- the honest 'does this look good in the app' preview.

    target_w  the sprite's true CSS width in the room (kitchen idle ~= 131)
    anchor    (x, y) of the sprite's BOTTOM-CENTRE in room fractions
    """
    bgim = Image.open(os.path.join(PUBLIC, room)).convert('RGBA')
    fh, fw, _ = frames[0].shape
    sc = float(target_w) / fw
    view = int(target_w * 2.6)
    ims = []
    for f in frames:
        spr = to_pil(_resize(f, sc))
        cx = int(bgim.width * anchor[0])
        by = int(bgim.height * anchor[1])
        stage = bgim.copy()
        stage.alpha_composite(spr, (cx - spr.width // 2, by - spr.height))
        box = (max(0, cx - view // 2), max(0, by - int(view * 0.86)),
               min(bgim.width, cx + view // 2), min(bgim.height, by + int(view * 0.14)))
        v = stage.crop(box)
        v = v.resize((v.width * zoom, v.height * zoom), Image.LANCZOS)
        ims.append(v.convert('P', palette=Image.ADAPTIVE, colors=255))
    if ping_pong and len(ims) > 2:
        ims = ims + ims[-2:0:-1]
    p = os.path.join(PREVIEW_DIR, out_file)
    ims[0].save(p, save_all=True, append_images=ims[1:], loop=0,
                duration=max(20, int(round(duration_ms / len(ims)))), disposal=2)
    print('  scene gif -> %s' % p)
    return p
