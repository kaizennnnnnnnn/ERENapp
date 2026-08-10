// Eren in his lab goggles, shared by the room and the Brew bench.
//
// ErenLab.png wears blue lab goggles, so the eye overlays are retuned to the
// lenses (measured off the sprite): the blink lids sit over the dark pupils in
// each lens, and the shine masks sit on the cool highlight in each lens's
// upper-left. Colours are shifted into the goggle-blue family so the blink
// reads as the eye closing behind tinted glass and the shine reads as a glassy
// reflection rather than a stray white dot.
//
// Lives in its own module because two components need it and the measurements
// belong to the sprite, not to either screen.

const LAB_EYES = {
  // Blink lids — over the visible pupils.
  lidTop:    '35%',
  lidLeftA:  '40.5%',
  lidLeftB:  '51.5%',
  lidWidth:  '7%',
  // Shine masks — upper-left highlight of each lens.
  maskTop:   '33.7%',
  maskLeftA: '37.5%',
  maskLeftB: '50.4%',
  maskW:     '6.8%',
  maskH:     '5.4%',
  glintLeftA: '24%',
  glintLeftB: '24%',
  glintTopA:  '18%',
  glintTopB:  '18%',
  glintW:     '40%',
}

/** Goggle-blue eyelid, a touch deeper than the lens base. */
const LAB_LID_COLOR = '#5C86A0'
/** Cool blue-white reflection, so the shine reads as glass. */
const LAB_GLINT =
  'radial-gradient(circle at 42% 38%, #ffffff 0%, #eaf6ff 26%, rgba(150,205,240,0.82) 54%, rgba(120,185,230,0) 82%)'

export const LAB_EREN = {
  src: '/ErenLab_notail.png',
  tailSrc: '/ErenLab_tail.png',
  tailOrigin: '69.2% 72.7%',
  eyes: LAB_EYES,
  lidColor: LAB_LID_COLOR,
  glintBackground: LAB_GLINT,
  // The eye sits behind a tinted lens — keep the recolourable lid bar, not the
  // realistic fur-toned closed eye, which would look wrong through glass.
  plainLid: true,
}
