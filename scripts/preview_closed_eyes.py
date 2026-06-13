# Composite the new eye-shaped closed lids onto a sprite exactly the way
# BlinkingEren lays them out (square box, sprite object-fit:contain height-fit,
# eye coords as % of the box) so we can confirm they follow the eye contour
# instead of reading as two squares.
from PIL import Image, ImageDraw

def preview(sprite_path, S, eyes, out):
    im = Image.open(sprite_path).convert('RGBA')
    w, h = im.size
    # object-fit: contain in an S×S box → height-fit for a portrait sprite.
    scale = S / h
    nw = int(w * scale)
    sprite = im.resize((nw, S), Image.LANCZOS)
    box = Image.new('RGBA', (S, S), (210, 200, 220, 255))   # neutral bg
    box.alpha_composite(sprite, ((S - nw) // 2, 0))

    # Upscale for inspection, draw the closed-lid ellipses on top.
    up = 3
    big = box.resize((S * up, S * up), Image.NEAREST)
    d = ImageDraw.Draw(big, 'RGBA')
    maskW, maskH, maskTop = eyes['maskW'], eyes['maskH'], eyes['maskTop']
    for left in (eyes['maskLeftA'], eyes['maskLeftB']):
        # mirror the component's closedEye() calc(), all in % of the S box
        lx = (left - maskW * 0.25) / 100 * S * up
        ty = (maskTop - maskH * 0.1) / 100 * S * up
        ew = maskW * 1.5 / 100 * S * up
        eh = maskH * 1.2 / 100 * S * up
        # crease gradient approximated by two stacked ellipses
        d.ellipse([lx, ty, lx + ew, ty + eh], fill=(107, 107, 107, 255))
        d.ellipse([lx, ty + eh * 0.55, lx + ew, ty + eh], fill=(70, 70, 70, 200))
    big.convert('RGB').save(out)
    print(f'{out}: {S}x{S}')

# Bedroom (erenSleep): maskW/H fall back to DEFAULT_EYES (5.7 / 5.4).
preview(r'c:\Users\Lenovo\OneDrive\Desktop\WEBSITES\ERENapp\public\erenSleep.png', 230, {
    'maskLeftA': 40.3, 'maskLeftB': 52.8, 'maskTop': 36.3, 'maskW': 5.7, 'maskH': 5.4,
}, r'c:\Users\Lenovo\OneDrive\Desktop\WEBSITES\ERENapp\scripts\closed_eyes_bedroom.png')

# Vet (ErenVet): explicit mask coords from VET_EYES.
preview(r'c:\Users\Lenovo\OneDrive\Desktop\WEBSITES\ERENapp\public\ErenVet.png', 200, {
    'maskLeftA': 40.32, 'maskLeftB': 54.40, 'maskTop': 31.11, 'maskW': 5.54, 'maskH': 4.50,
}, r'c:\Users\Lenovo\OneDrive\Desktop\WEBSITES\ERENapp\scripts\closed_eyes_vet.png')
