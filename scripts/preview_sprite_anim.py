"""Generate scripts/preview_sprite_anim.html -- a live-CSS proof of the baked strips.

    py scripts/preview_sprite_anim.py

Why this exists: the filmstrips the bakers produce prove the ART is right, but
not that the PLAYBACK is right. The frames advance by sliding an N-frame row
with a stepped transform, and an off-by-one in that arithmetic shows up as two
half-frames in the window -- something only a real browser can reveal.

So this page clones the sprite once per sample time with a negative
animation-delay (every animation inside a sample reads the same --d, so one
sample is the whole page frozen at wall-clock time X). One screenshot of the
page therefore covers the entire cycle, and each row doubles as a filmstrip.

Reads the manifests the bakers wrote, so it never hardcodes a frame count.
"""

import glob
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANIM_DIR = os.path.join(ROOT, 'public', 'anim')
OUT = os.path.join(ROOT, 'scripts', 'preview_sprite_anim.html')

# The kitchen renders the idle cook in a 210px square box (the portrait sprite
# height-fits, so ~131px wide) and the eat pose at 140px wide.
IDLE_H = 210
EAT_W = 140


def anims():
    out = {}
    for f in sorted(glob.glob(os.path.join(ANIM_DIR, '*.json'))):
        with open(f) as fp:
            m = json.load(fp)
        if m.get('name') != 'smoke':
            out[m['name']] = m
    return out


def strip_div(a, extra=''):
    """SpriteStrip's markup: a window placed by rect, holding an N-wide row."""
    r = a['rect']
    kf = ('erenBlinkSlide %dms step-end infinite' % a['durationMs']) if a['kind'] == 'blink' \
        else ('erenStripSlide %dms steps(%d) infinite' % (a['durationMs'], a['frames']))
    return (
        '<div class="win" style="left:%s%%;top:%s%%;width:%s%%;height:%s%%;%s">'
        '<div class="row" style="width:%d%%;background-image:url(../public%s);'
        'animation:%s;animation-delay:var(--d)"></div></div>'
        % (r['left'], r['top'], r['width'], r['height'], extra,
           a['frames'] * 100, a['src'], kf)
    )


def baked_idle(A, delay_ms, h=IDLE_H):
    tail, blink = A.get('cookTail'), A.get('cookBlink')
    cw, ch = tail['canvas']
    inner = ''
    if tail:
        inner += strip_div(tail)
    inner += '<img class="body" src="../public/ErenCook_notail.png" alt="">'
    if blink:
        inner += strip_div(blink)
    return (
        '<div class="sample" style="--d:-%dms"><div class="box" style="height:%dpx;width:%dpx">'
        '<div class="col" style="aspect-ratio:%d/%d">'
        '<div class="breathe" style="animation-delay:var(--d)">%s</div>'
        '</div></div><span class="t">%dms</span></div>'
        % (delay_ms, h, h, cw, ch, inner, delay_ms)
    )


def current_idle(delay_ms):
    """What ships today: one flat PNG plus a rigid rotation of the tail layer."""
    return (
        '<div class="sample" style="--d:-%dms"><div class="box" style="height:%dpx;width:%dpx">'
        '<div class="col" style="aspect-ratio:959/1536">'
        '<div class="breathe" style="animation-delay:var(--d)">'
        '<img class="body tailrot" src="../public/ErenCook_tail.png" alt="">'
        '<img class="body" src="../public/ErenCook_notail.png" alt="">'
        '</div></div></div><span class="t">%dms</span></div>'
        % (delay_ms, IDLE_H, IDLE_H, delay_ms)
    )


def baked_eat(a, delay_ms):
    cw, ch = a['canvas']
    return (
        '<div class="sample" style="--d:-%dms"><div class="box" style="width:%dpx;aspect-ratio:%d/%d">'
        '<div class="fill">%s</div>'
        '</div><span class="t">%dms</span></div>'
        % (delay_ms, EAT_W, cw, ch, strip_div(a), delay_ms)
    )


def current_eat(delay_ms):
    return (
        '<div class="sample" style="--d:-%dms"><div class="box" style="width:%dpx;aspect-ratio:925/765">'
        '<div class="chew" style="animation-delay:var(--d)">'
        '<img src="../public/erenEat1.png" style="width:100%%;display:block" alt="">'
        '</div></div><span class="t">%dms</span></div>'
        % (delay_ms, EAT_W, delay_ms)
    )


CSS = """
:root { color-scheme: light }
body { margin:0; background:#f4f4f7; font:12px/1.4 ui-monospace,monospace; color:#222 }
h2 { font-size:13px; margin:18px 12px 2px; letter-spacing:.06em }
p.note { margin:0 12px 8px; color:#666; font-size:11px; max-width:1100px }
.row-wrap { display:flex; flex-wrap:wrap; gap:4px; padding:4px 12px 10px; align-items:flex-end }
.sample { text-align:center }
.sample .t { display:block; color:#888; font-size:10px }
.box { position:relative; background:#e7e3da; outline:1px solid #d5d0c6 }
.col { position:absolute; top:0; bottom:0; left:50%; transform:translateX(-50%) }
.fill { position:absolute; inset:0 }
.breathe { position:absolute; inset:0; transform-origin:bottom center;
           animation:erenBreathe 4s ease-in-out infinite; backface-visibility:hidden }
.body { position:absolute; inset:0; width:100%; height:100%; object-fit:contain;
        image-rendering:auto }
.tailrot { transform-origin:71.8% 80.7%; animation:erenTailWiggle 3.4s ease-in-out infinite;
           animation-delay:var(--d) }
.win { position:absolute; overflow:hidden; pointer-events:none }
.row { height:100%; background-size:100% 100%; background-repeat:no-repeat;
       image-rendering:auto; backface-visibility:hidden }
.chew { animation:erenChew 440ms ease-in-out infinite }

@keyframes erenStripSlide { from { transform:translateX(0) translateZ(0) }
                            to   { transform:translateX(-100%) translateZ(0) } }
@keyframes erenBlinkSlide {
  0%,    27.6% { transform:translateX(0) }
  28.0%       { transform:translateX(-33.3333%) }
  28.7%       { transform:translateX(-66.6667%) }
  29.9%       { transform:translateX(-33.3333%) }
  30.6%, 59.6% { transform:translateX(0) }
  60.0%       { transform:translateX(-33.3333%) }
  60.7%       { transform:translateX(-66.6667%) }
  61.9%       { transform:translateX(-33.3333%) }
  62.6%, 100% { transform:translateX(0) }
}
@keyframes erenBreathe { 0%,100% { transform:scaleY(1) translateZ(0) }
                         50%     { transform:scaleY(1.022) translateZ(0) } }
@keyframes erenTailWiggle { 0%,100% { transform:rotate(0deg) }
                            40%     { transform:rotate(-8deg) }
                            70%     { transform:rotate(-2deg) } }
@keyframes erenChew { 0%,100% { transform:translateY(0) } 50% { transform:translateY(2px) } }
"""


def main():
    A = anims()
    out = ['<!doctype html><meta charset="utf-8"><title>Eren sprite-anim preview</title>',
           '<style>%s</style>' % CSS]

    if 'cookTail' in A:
        tail = A['cookTail']
        n = 10
        times = [int(round(i * tail['durationMs'] / n)) for i in range(n)]
        out.append('<h2>1. IDLE TAIL -- baked bend (top) vs the rigid CSS rotation that ships today (bottom)</h2>')
        out.append('<p class="note">Each tile is the same sprite frozen at a different point in the 3.4s cycle, '
                   'at the size it renders in the kitchen (%dpx box). The baked row should show the tail CURVING '
                   'with the tip lagging; the bottom row swings it as one rigid piece. A tile showing two '
                   'half-frames at once would mean the steps() arithmetic is off.</p>' % IDLE_H)
        out.append('<div class="row-wrap">%s</div>' % ''.join(baked_idle(A, t) for t in times))
        out.append('<div class="row-wrap">%s</div>' % ''.join(current_idle(t) for t in times))

    if 'cookBlink' in A:
        b = A['cookBlink']
        d = b['durationMs']
        # Sample densely across the first blink (the keyframe puts it at ~28% of
        # the cycle) plus one resting tile for reference.
        marks = [0.0, 0.276, 0.281, 0.290, 0.300, 0.307, 0.32]
        out.append('<h2>2. BLINK -- the baked lid through one blink (~%dms window at %.0f%% of the cycle)</h2>'
                   % (int(0.031 * d), 100 * 0.276))
        out.append('<p class="note">First tile is the resting eye. The rest step through open -> half -> shut -> '
                   'half -> open. Watch for a visible rectangle around the eye band: the strip is an overlay, so '
                   'its edge is feathered and frame 0 is a pixel copy of the body underneath.</p>')
        out.append('<div class="row-wrap">%s</div>'
                   % ''.join(baked_idle(A, int(round(m * d))) for m in marks))
        out.append('<p class="note">Same samples at 3x, because the eye is only ~4px at ship size.</p>')
        out.append('<div class="row-wrap">%s</div>'
                   % ''.join(baked_idle(A, int(round(m * d)), h=IDLE_H * 3) for m in marks))

    eats = [k for k in A if k.startswith('eat')]
    if eats:
        a = A[sorted(eats)[0]]
        n = a['frames']
        times = [int(round(i * a['durationMs'] / n)) for i in range(n)]
        out.append('<h2>3. CHEW -- baked jaw/head/ear cycle (top) vs the 2px whole-sticker bob today (bottom)</h2>')
        out.append('<p class="note">%d frames over %dms. The paws must sit dead still across the whole row.</p>'
                   % (n, a['durationMs']))
        out.append('<div class="row-wrap">%s</div>' % ''.join(baked_eat(a, t) for t in times))
        out.append('<div class="row-wrap">%s</div>' % ''.join(current_eat(t) for t in times))

    with open(OUT, 'w', newline='\n') as fp:
        fp.write('\n'.join(out))
    print('wrote %s' % OUT)
    print('  animations: %s' % ', '.join(sorted(A)))


if __name__ == '__main__':
    main()
