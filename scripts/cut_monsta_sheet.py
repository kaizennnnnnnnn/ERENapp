"""Cut the ten Monsta cans (and the rainbow/gold FX) out of the artist's sheet.

    py scripts/cut_monsta_sheet.py

Source: scripts/art_src/monsta_cans_sheet.png (3130x1024 RGBA), two panels:

    [ 10 coloured cans on black, 2 rows x 5 ]  [ white card, same 10 cans as black silhouettes ]

Sheet order is reading order and matches the monsta block of FOOD_ORDER in
src/lib/foodMeta.ts (checked by colour against the FOOD_META swatches).

Writes (and owns — re-running regenerates all of them byte-for-byte):
    public/food/monsta_<id>.png           384x384, one per can
    public/food/fx/monsta_rainbow_sparkle_<n>.png   one per floating sparkle
    public/food/fx/monsta_gold_rays_{a,b}.png       the 8 rays, two interleaved sets
    public/food/fx/monsta_fx.json         canvas sizes + CSS geometry for every layer
    src/lib/canArtData.ts                 what the app needs of that: the layer box,
                                          each layer's transform-origin, and CAN_ART_V

Why each step exists
--------------------
* CUT BY THE MASK, NOT BY COLOUR. Every can is outlined in near-black and sits on
  black, so no colour key can find the edge. The white card on the right is the
  silhouette of the same art. It is REGISTERED to the colour panel first (scale
  from the content bounding boxes, then an integer IoU search), not assumed
  aligned: the card's own margin shifts it relative to the split.
* REPAINT THE CUT EDGE. The source has a 1px anti-alias rim just outside the
  dark outline that is LIGHT grey, and its partially-transparent pixels are near
  white. Kept, it is a pale halo on every dark card. The outermost EDGE_BLEED
  sheet pixels of each element take the colour of the nearest pixel further in
  (the outline itself), so the edge is outline-dark with a soft alpha — no white
  halo, and no black fringe because nothing outside the mask is ever kept.
* ONE SCALE FOR ALL TEN. The artist drew the set at one scale, so bodies must
  stay equal: the tallest can-with-attachments (gold, crown included) sets the
  scale so it fills 124/128 of the canvas height — the old food-art content rule.
* ONE BASELINE, CENTRED ON THE BODY. Every can's body bottom lands on the same
  canvas row, and each is centred on its body columns, never on a tail, whisker
  or badge (those hang off to the side as drawn).
* 384px CANVAS. The gacha reveal shows a can at 136 CSS px (PullAnimation
  ITEM_PX), which is 408 device px on a 3x iPhone. 384 keeps that at a 1.06x
  upscale, the ratio PullAnimation already accepts as invisible; 256 was 1.59x
  and visibly soft. 512 would push the cut scale past 1 (upscaling the sheet
  itself) for 1.8x the bytes. The renderers use object-fit: contain on a
  square box, so the extra resolution costs only bytes.
* FX ARE SEPARATE LAYERS. The rainbow's floating sparkles and the gold can's ray
  dashes are loose blobs in the mask. They are cut into their own PNGs in the
  SAME frame and scale as the can, on a 1.5x canvas centred on the can canvas,
  so a renderer stacks them over the can at any icon size and animates them.
* THE APP'S NUMBERS ARE GENERATED. CanFx needs each layer's transform-origin
  and foodArt needs a cache-bust; both are written to src/lib/canArtData.ts
  here, so a re-cut can never leave the origins stale or ship new pixels under
  an old ?v= (the service worker serves images stale-while-revalidate).
  CAN_ART_V is a hash of the pixels written, so it changes exactly when they do.

Downscaling is LANCZOS on premultiplied float channels (no nearest, no 8-bit
premultiply round-trip), straight from the hi-res sheet.
"""

import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / 'scripts' / 'art_src' / 'monsta_cans_sheet.png'
FOOD_DIR = ROOT / 'public' / 'food'
FX_DIR = FOOD_DIR / 'fx'
TS_OUT = ROOT / 'src' / 'lib' / 'canArtData.ts'

# Reading order on the sheet == FOOD_ORDER's monsta block.
IDS = [
    'monsta_original', 'monsta_white', 'monsta_mango', 'monsta_loco', 'monsta_pipeline',
    'monsta_punch', 'monsta_rosa', 'monsta_peachy', 'monsta_rainbow', 'monsta_gold',
]
FX_KIND = {'monsta_rainbow': 'sparkle', 'monsta_gold': 'ray'}   # the only cans allowed loose parts

CANVAS = 384                                  # can PNG side
CONTENT = CANVAS * 124 // 128                 # 372 — the tallest can's height
BASELINE = CANVAS - (CANVAS - CONTENT) // 2   # 378 — every body bottom lands on this row
FX_CANVAS = CANVAS * 3 // 2                   # 576, centred on the can canvas
FX_PAD = (FX_CANVAS - CANVAS) // 2            # 96
# Where every FX layer sits, as CSS % of the can box: -25 / -25 / 150 / 150.
LAYER_BOX = {'left': -100 * FX_PAD / CANVAS, 'top': -100 * FX_PAD / CANVAS,
             'width': 100 * FX_CANVAS / CANVAS, 'height': 100 * FX_CANVAS / CANVAS}

MASK_LO, MASK_HI = 16, 240   # card darkness ramped to alpha (card white is ~250, not 255)
EDGE_BLEED = 2               # sheet px at each cut edge repainted from further in
BODY_BAND = (0.25, 0.97)     # rows (fraction of can height) where the body width is measured
TOUCH_GAP = 3                # a blob this close to a can is attached to it (ear, tail, badge)
FX_REACH = 160               # a loose blob further than this from every can is not FX
MIN_FX_AREA = 150            # loose blobs smaller than this are specks and are dropped
ALPHA_FLOOR = 2              # resampled alpha below this is LANCZOS ringing, not art
BODY_TOL = 2                 # px of edge jitter tolerated when matching body rows
REG_SEARCH = 8               # +/- px searched around the bbox-aligned mask offset


# ── loading + registration ─────────────────────────────────────────────────

def split_panels(rgba):
    """The card is the largest blob of opaque near-white; its bbox is the right panel."""
    white = (rgba[..., :3].min(axis=2) >= 200) & (rgba[..., 3] == 255)
    lab, n = nd.label(white)
    if n == 0:
        raise SystemExit('no white card found — is this the two-panel sheet?')
    sizes = nd.sum(white, lab, range(1, n + 1))
    card = nd.find_objects(lab)[int(np.argmax(sizes))]
    return card[1].start


def colour_silhouette(colour):
    """What the colour panel says is art: its own alpha if it has one, else non-black."""
    alpha = colour[..., 3]
    if (alpha < 128).mean() > 0.05:
        return alpha >= 128
    return colour[..., :3].max(axis=2) > 24


def iou(a, b):
    union = (a | b).sum()
    return (a & b).sum() / union if union else 0.0


def shifted(mask, dx, dy, shape):
    """mask sampled at (y + dy, x + dx) for every (y, x) of `shape`; zero outside."""
    out = np.zeros(shape, dtype=mask.dtype)
    h, w = shape
    ys0, xs0 = max(0, -dy), max(0, -dx)
    ys1, xs1 = min(h, mask.shape[0] - dy), min(w, mask.shape[1] - dx)
    if ys1 > ys0 and xs1 > xs0:
        out[ys0:ys1, xs0:xs1] = mask[ys0 + dy:ys1 + dy, xs0 + dx:xs1 + dx]
    return out


def register(colour, card_dark, split):
    """Map the card's silhouette onto the colour panel. Returns alpha in colour coords."""
    ref = colour_silhouette(colour)
    sil = card_dark >= 128
    (ry, rx), (my, mx) = [np.nonzero(m) for m in (ref, sil)]
    sx = (mx.max() - mx.min() + 1) / (rx.max() - rx.min() + 1)
    sy = (my.max() - my.min() + 1) / (ry.max() - ry.min() + 1)
    if abs(sx - 1) > 0.002 or abs(sy - 1) > 0.002:
        h, w = card_dark.shape
        img = Image.fromarray(np.ascontiguousarray(card_dark, dtype=np.float32))
        card_dark = np.asarray(img.resize((round(w / sx), round(h / sy)), Image.BILINEAR))
        sil = card_dark >= 128
        my, mx = np.nonzero(sil)
    dx0, dy0 = int(mx.min() - rx.min()), int(my.min() - ry.min())
    best = max(
        ((iou(ref, shifted(sil, dx0 + i, dy0 + j, ref.shape)), dx0 + i, dy0 + j)
         for i in range(-REG_SEARCH, REG_SEARCH + 1) for j in range(-REG_SEARCH, REG_SEARCH + 1)),
        key=lambda t: t[0])
    score, dx, dy = best
    print(f'registration: scale x{sx:.4f} y{sy:.4f}  offset card->colour dx={dx} dy={dy} '
          f'(sheet x + {split + dx})  IoU={score:.4f}')
    if score < 0.95:
        raise SystemExit('mask does not line up with the colour panel — look at the sheet')
    dark = shifted(card_dark, dx, dy, ref.shape)
    return np.clip((dark - MASK_LO) / (MASK_HI - MASK_LO), 0.0, 1.0)


# ── parts: cans, attachments, FX, specks ───────────────────────────────────

def label_parts(alpha):
    """10 cans (with everything touching them) + loose FX per can. Specks dropped."""
    solid = alpha >= 0.5
    lab, n = nd.label(solid, structure=np.ones((3, 3)))
    sizes = nd.sum(solid, lab, range(1, n + 1))
    order = np.argsort(sizes)[::-1]
    if n < len(IDS):
        raise SystemExit(f'expected >= {len(IDS)} blobs, found {n}')
    can_labels = [int(i) + 1 for i in order[:len(IDS)]]
    can_labels = reading_order(lab, can_labels)

    dist, (iy, ix) = nd.distance_transform_edt(~np.isin(lab, can_labels), return_indices=True)
    cans = {c: lab == c for c in can_labels}
    fx = {c: [] for c in can_labels}
    specks = 0
    for blob in range(1, n + 1):
        if blob in cans:
            continue
        px = lab == blob
        d = dist[px].min()
        at = np.argmin(np.where(px, dist, np.inf))
        near = lab[iy.flat[at], ix.flat[at]]
        if d <= TOUCH_GAP:
            cans[near] |= px
        elif d <= FX_REACH and sizes[blob - 1] >= MIN_FX_AREA:
            fx[near].append(px)
        else:
            specks += 1
    print(f'blobs: {n}  cans: {len(can_labels)}  specks dropped: {specks}')
    return [(cans[c], fx[c]) for c in can_labels], solid


def reading_order(lab, labels):
    """Two rows of five, left to right."""
    cy = {c: np.nonzero(lab == c)[0].mean() for c in labels}
    cx = {c: np.nonzero(lab == c)[1].mean() for c in labels}
    by_y = sorted(labels, key=lambda c: cy[c])
    half = len(labels) // 2
    rows = [sorted(by_y[:half], key=lambda c: cx[c]), sorted(by_y[half:], key=lambda c: cx[c])]
    if max(cy[c] for c in rows[0]) >= min(cy[c] for c in rows[1]):
        raise SystemExit('cans do not sit in two clean rows')
    return rows[0] + rows[1]


def longest_run(row):
    """(start, stop) of the longest run of True in a 1-D bool array."""
    padded = np.concatenate(([0], row.astype(np.int8), [0]))
    d = np.diff(padded)
    starts, stops = np.nonzero(d == 1)[0], np.nonzero(d == -1)[0]
    i = int(np.argmax(stops - starts))
    return int(starts[i]), int(stops[i])


def band_runs(can):
    """Each band row's longest solid run, plus the can's top and bottom rows."""
    rows = np.nonzero(can.any(axis=1))[0]
    top, bottom = int(rows.min()), int(rows.max()) + 1
    band = range(top + int(BODY_BAND[0] * (bottom - top)), top + int(BODY_BAND[1] * (bottom - top)))
    return [longest_run(can[y]) for y in band], top, bottom


def modal_width(can):
    """The row width shared by the most band rows (+/- BODY_TOL)."""
    widths = np.array([r - l for l, r in band_runs(can)[0]])
    votes = [(np.abs(widths - w) <= BODY_TOL).sum() for w in widths]
    return int(widths[int(np.argmax(votes))])


def body_geometry(can, set_width):
    """The can's own body (not tail, whiskers or badge): its sides, centre x, baseline, top.

    A can is a straight-sided tube and the artist drew all ten at one width, so
    the body is found in the band rows whose longest solid run (a tail or
    whisker across a gap is a separate run) is the SET's body width. Rows where
    a tail is fused on (mango: most of its band) or a whisker crosses the
    outline (punch) are wider and are ignored; the sides are the median edges
    of the rows that are left.
    """
    edges, top, bottom = band_runs(can)
    body = [(l, r) for l, r in edges if abs(r - l - set_width) <= 3 * BODY_TOL]
    if len(body) < 10:
        raise SystemExit(f'no clean body rows at width {set_width} — look at the sheet')
    left = int(np.median([l for l, _ in body]))
    right = int(np.median([r for _, r in body]))
    baseline = int(np.nonzero(can[:, left:right].any(axis=1))[0].max()) + 1
    return {'left': left, 'right': right, 'cx': (left + right) / 2,
            'baseline': baseline, 'top': top, 'bottom': bottom}


# ── edge repair + resampling ───────────────────────────────────────────────

def bleed_edge(rgb, solid):
    """Repaint the outer EDGE_BLEED px of an element from the nearest pixel further in."""
    ys, xs = np.nonzero(solid)
    pad = EDGE_BLEED + 3
    y0, y1 = max(0, ys.min() - pad), min(solid.shape[0], ys.max() + pad + 1)
    x0, x1 = max(0, xs.min() - pad), min(solid.shape[1], xs.max() + pad + 1)
    s = solid[y0:y1, x0:x1]
    core = nd.binary_erosion(s, iterations=EDGE_BLEED)
    if not core.any():                            # a hairline: nothing further in
        core = s
    _, (iy, ix) = nd.distance_transform_edt(~core, return_indices=True)
    out = rgb.copy()
    out[y0:y1, x0:x1] = rgb[y0:y1, x0:x1][iy, ix]
    return out


def element_layer(rgb, alpha, part, others):
    """Straight RGB + alpha for one element, zero everywhere else."""
    region = nd.binary_dilation(part, iterations=2) & ~others
    a = np.where(region, alpha, 0.0)
    return bleed_edge(rgb, part), a


def resample(rgb, a, box, size):
    """LANCZOS the sheet region `box` (float x0, y0, x1, y1; may overhang) to size x size."""
    x0, y0, x1, y1 = box
    cx0, cy0 = math.floor(x0) - 4, math.floor(y0) - 4
    cx1, cy1 = math.ceil(x1) + 4, math.ceil(y1) + 4
    h, w = a.shape
    crop_a = np.zeros((cy1 - cy0, cx1 - cx0), np.float32)
    crop_rgb = np.zeros((cy1 - cy0, cx1 - cx0, 3), np.float32)
    sy0, sx0, sy1, sx1 = max(cy0, 0), max(cx0, 0), min(cy1, h), min(cx1, w)
    crop_a[sy0 - cy0:sy1 - cy0, sx0 - cx0:sx1 - cx0] = a[sy0:sy1, sx0:sx1]
    crop_rgb[sy0 - cy0:sy1 - cy0, sx0 - cx0:sx1 - cx0] = rgb[sy0:sy1, sx0:sx1]
    local = (x0 - cx0, y0 - cy0, x1 - cx0, y1 - cy0)

    def lanczos(ch):
        img = Image.fromarray(np.ascontiguousarray(ch, dtype=np.float32))
        return np.asarray(img.resize((size, size), Image.LANCZOS, box=local))

    out_a = np.clip(lanczos(crop_a * 255), 0, 255)
    out_a[out_a < ALPHA_FLOOR] = 0
    safe = np.maximum(out_a / 255, 1e-6)
    out_rgb = [np.clip(lanczos(crop_rgb[..., c] * crop_a) / safe, 0, 255) for c in range(3)]
    stack = np.dstack(out_rgb + [out_a])
    stack[out_a == 0, :3] = 0
    return Image.fromarray(np.round(stack).astype(np.uint8))


# ── output ─────────────────────────────────────────────────────────────────

def can_box(geo, scale):
    """Sheet region that maps onto the 256 can canvas (body centred, baseline on BASELINE)."""
    x0 = geo['cx'] - (CANVAS / 2) / scale
    y0 = geo['baseline'] - BASELINE / scale
    return (x0, y0, x0 + CANVAS / scale, y0 + CANVAS / scale)


def fx_box(box, scale):
    pad = FX_PAD / scale
    return (box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad)


def pct(v):
    return round(v * 100, 3)


def to_can_pct(sx, sy, box, scale):
    """Sheet point -> % of the can box."""
    return pct((sx - box[0]) * scale / CANVAS), pct((sy - box[1]) * scale / CANVAS)


def to_layer_pct(sx, sy, box, scale):
    """Sheet point -> % of the 1.5x FX layer box (a transform-origin)."""
    return (pct(((sx - box[0]) * scale + FX_PAD) / FX_CANVAS),
            pct(((sy - box[1]) * scale + FX_PAD) / FX_CANVAS))


def mean_hex(rgb, part):
    core = nd.binary_erosion(part, iterations=EDGE_BLEED + 1)
    c = rgb[core if core.any() else part].mean(axis=0)
    return '#' + ''.join(f'{int(round(v)):02X}' for v in c)


def element_record(part, rgb, box, scale):
    ys, xs = np.nonzero(part)
    mx, my = xs.mean() + 0.5, ys.mean() + 0.5          # pixel CENTRES, continuous coords
    cx, cy = to_can_pct(mx, my, box, scale)
    l, t = to_can_pct(xs.min(), ys.min(), box, scale)
    r, b = to_can_pct(xs.max() + 1, ys.max() + 1, box, scale)
    ox, oy = to_layer_pct(mx, my, box, scale)
    return {'center': [cx, cy], 'bbox': [l, t, round(r - l, 3), round(b - t, 3)],
            'origin': [ox, oy], 'color': mean_hex(rgb, part)}


def write_png(img, path, digest):
    """Save one output and fold its pixels (not its zlib bytes) into CAN_ART_V."""
    img.save(path, optimize=True)
    digest.update(f'{path.name} {img.width}x{img.height}\n'.encode())
    digest.update(img.tobytes())


def fx_layers(can_id, fx, rgb, alpha, everything, box, scale, digest):
    """Write the FX PNGs for one can; return their JSON records."""
    fbox = fx_box(box, scale)
    kind = FX_KIND[can_id]
    parts = sorted(fx, key=lambda p: np.nonzero(p)[1].mean())
    if kind == 'sparkle':
        groups = [(f'{can_id}_sparkle_{i}', [p]) for i, p in enumerate(parts, 1)]
    else:
        groups = ray_sets(can_id, parts)
    records = []
    for name, members in groups:
        union = np.logical_or.reduce(members)
        lrgb, la = element_layer(rgb, alpha, union, everything & ~union)
        layer = resample(lrgb, la, fbox, FX_CANVAS)
        check_fit(layer, name)
        write_png(layer, FX_DIR / f'{name}.png', digest)
        rec = {'file': f'/food/fx/{name}.png', 'kind': kind, 'canvas': FX_CANVAS, 'box': LAYER_BOX}
        if len(members) == 1:
            rec.update(element_record(members[0], rgb, box, scale))
        else:
            rec['members'] = [element_record(m, rgb, box, scale) for m in members]
        records.append(rec)
    if kind == 'ray':                                # rays pulse about their common centre
        pts = [np.nonzero(p) for p in parts]
        cx = np.mean([p[1].mean() for p in pts]) + 0.5
        cy = np.mean([p[0].mean() for p in pts]) + 0.5
        for rec in records:
            rec['origin'] = list(to_layer_pct(cx, cy, box, scale))
    return records


def ray_sets(can_id, parts):
    """Per side of the can, alternate top-to-bottom: set a = 1st+3rd, set b = 2nd+4th."""
    xs = [np.nonzero(p)[1].mean() for p in parts]
    mid = np.mean(xs)
    sets = {'a': [], 'b': []}
    for side in (lambda x: x < mid, lambda x: x >= mid):
        mine = sorted((p for p, x in zip(parts, xs) if side(x)), key=lambda p: np.nonzero(p)[0].mean())
        for i, p in enumerate(mine):
            sets['ab'[i % 2]].append(p)
    return [(f'{can_id}_rays_{k}', v) for k, v in sets.items()]


def check_fit(img, name):
    """Fail loudly if anything reaches the canvas edge (it would clip)."""
    bbox = img.getchannel('A').getbbox()
    if bbox is None or bbox[0] < 1 or bbox[1] < 1 or bbox[2] > img.width - 1 or bbox[3] > img.height - 1:
        raise SystemExit(f'{name}: content touches the canvas edge {bbox}')
    return bbox


def write_ts(manifest, version):
    """src/lib/canArtData.ts: the part of the manifest the app renders from."""
    num = lambda v: f'{v:g}'                                    # 50.0 -> 50, 33.243 -> 33.243
    box = ', '.join(f"{k}: '{num(v)}%'" for k, v in LAYER_BOX.items())
    cans = []
    for can_id, entry in manifest['cans'].items():
        if 'layers' not in entry:
            continue
        rows = [f"    {{ name: '{Path(l['file']).stem}', kind: '{l['kind']}', "
                f"origin: [{num(l['origin'][0])}, {num(l['origin'][1])}] }},"
                for l in entry['layers']]
        cans.append(f'  {can_id}: [\n' + '\n'.join(rows) + '\n  ],')
    TS_OUT.write_text(f"""// AUTO-GENERATED by scripts/cut_monsta_sheet.py — do not edit by hand.
// Re-run `py scripts/cut_monsta_sheet.py` and this is rewritten with the art.

/**
 * Cache-bust for every can PNG and FX layer (foodArt / canFxArt in foodMeta):
 * a hash of the pixels the cut wrote, so it changes exactly when they do. The
 * service worker serves images stale-while-revalidate, so new art under an old
 * ?v= would keep showing on phones.
 */
export const CAN_ART_V = '{version}'

/** Where every FX layer sits: a 1.5x box centred on the can's square art box. */
export const CAN_FX_BOX = {{ {box} }} as const

export interface CanFxLayerData {{
  /** File name in public/food/fx, without the extension. */
  name: string
  kind: 'sparkle' | 'ray'
  /** transform-origin, % of the layer box: a sparkle's own centre, or the
   *  rays' shared radial centre, so a scale pulses in place or pushes outward. */
  origin: readonly [number, number]
}}

/** The moving layers of each can that has them, in the order they are drawn. */
export const CAN_FX_LAYERS: Partial<Record<string, readonly CanFxLayerData[]>> = {{
{chr(10).join(cans)}
}}
""", encoding='utf-8')


def main():
    sheet = np.asarray(Image.open(SHEET).convert('RGBA')).astype(np.float32)
    split = split_panels(sheet.astype(np.uint8))
    colour = sheet[:, :split]
    card_dark = 255 - sheet[:, split:, :3].mean(axis=2)
    print(f'sheet {sheet.shape[1]}x{sheet.shape[0]}  split at x={split}')
    alpha = register(colour, card_dark, split)
    rgb = colour[..., :3]
    parts, solid = label_parts(alpha)

    set_width = int(np.median([modal_width(can) for can, _ in parts]))
    geos = [body_geometry(can, set_width) for can, _ in parts]
    print(f'set body width {set_width}px')
    tallest = max(g['baseline'] - g['top'] for g in geos)
    scale = CONTENT / tallest
    print(f'uniform scale {scale:.5f}  (tallest can {tallest}px -> {CONTENT}px of {CANVAS})')

    FX_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        'generator': 'scripts/cut_monsta_sheet.py', 'canCanvas': CANVAS,
        'units': ('All % of the can box, except origin (% of the layer box, for transform-origin). '
                  'bbox is [left, top, width, height]. body.top is the top of the can WITH its '
                  'ears/arc/crown; body.baseline is the bottom of the can.'),
        'cans': {},
    }
    digest = hashlib.sha256()
    for can_id, (can, fx), geo in zip(IDS, parts, geos):
        if fx and can_id not in FX_KIND:
            raise SystemExit(f'{can_id}: {len(fx)} loose blobs but it has no FX — look at the sheet')
        box = can_box(geo, scale)
        lrgb, la = element_layer(rgb, alpha, can, solid & ~can)
        img = resample(lrgb, la, box, CANVAS)
        bbox = check_fit(img, can_id)
        write_png(img, FOOD_DIR / f'{can_id}.png', digest)
        entry = {'body': {'left': to_can_pct(geo['left'], 0, box, scale)[0],
                          'right': to_can_pct(geo['right'], 0, box, scale)[0],
                          'top': to_can_pct(0, geo['top'], box, scale)[1],
                          'baseline': to_can_pct(0, geo['baseline'], box, scale)[1]}}
        if fx:
            entry['layers'] = fx_layers(can_id, fx, rgb, alpha, solid, box, scale, digest)
        manifest['cans'][can_id] = entry
        print(f'{can_id:<16} body {geo["right"] - geo["left"]}px wide  content bbox {bbox}'
              f'  fx {len(fx)}')

    (FX_DIR / 'monsta_fx.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    version = digest.hexdigest()[:8]
    write_ts(manifest, version)
    print(f'wrote {len(IDS)} cans to {FOOD_DIR}, FX + monsta_fx.json to {FX_DIR}, '
          f'and {TS_OUT.name} (CAN_ART_V {version})')


if __name__ == '__main__':
    main()
