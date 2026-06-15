import os
from PIL import Image
from process_poses import clean_and_trim   # reuse the halo-peel + trim

SRC = r'C:\Users\Lenovo\Downloads'
OUT = r'C:\Users\Lenovo\OneDrive\Desktop\WEBSITES\ERENapp\public'

# Soaping stages 1->3, then the wet (pre-shake) pose.
JOBS = [
    ('Eren1', 'erenWash1'),
    ('Eren2', 'erenWash2'),
    ('Eren3', 'erenWash3'),
    ('ErenWet', 'erenWashWet'),
]

if __name__ == '__main__':
    for sname, oname in JOBS:
        im = Image.open(os.path.join(SRC, sname + '.png'))
        out = clean_and_trim(im)
        out.save(os.path.join(OUT, oname + '.png'))
        w, h = out.size
        print(f'{oname}.png  {w}x{h}  (aspect {w/h:.3f})')
