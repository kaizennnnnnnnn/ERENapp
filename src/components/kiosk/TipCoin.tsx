'use client'

// The coin going in the jar.
//
// The jar has always filled — it just filled by itself, a level that rose
// because a number somewhere went up. Now you watch somebody decide: the coin
// comes off the ledge in front of them, arcs across, and the level moves when
// it lands. Nothing about the money changed. It just has a cause now.

import { TIP_JAR, SILL_PCT } from './kioskShift'

/** Where it starts: in front of whoever's at the window, on the ledge. */
const FROM = { x: 50, y: SILL_PCT - 2.4 }
/** And where it ends: the mouth of the jar. */
const TO = { x: TIP_JAR.x, y: TIP_JAR.top + 1.6 }

/** The picture is 768 x 1376, so a percentage DOWN is not the same distance
 *  as a percentage ACROSS. Both legs of the flight are converted into cqi —
 *  percent of the picture's width — or the arc lands short. */
const PIC_ASPECT = 1376 / 768

export const COIN_MS = 560

export default function TipCoin({ id }: { id: number }) {
  const dx = TO.x - FROM.x
  const dy = (TO.y - FROM.y) * PIC_ASPECT
  return (
    <span
      key={id}
      aria-hidden
      className="pointer-events-none"
      style={{
        position: 'absolute',
        left: `${FROM.x}%`, top: `${FROM.y}%`,
        width: '2.6cqi', height: '2.6cqi',
        borderRadius: '50%',
        background: 'radial-gradient(circle at 34% 30%, #FFE9A8, #E8BA4A 58%, #A8761E 100%)',
        boxShadow: '0 0 6px rgba(255,206,90,0.55)',
        zIndex: 9,
        opacity: 0,
        ['--dx' as string]: `${dx.toFixed(2)}cqi`,
        ['--dy' as string]: `${dy.toFixed(2)}cqi`,
        animation: `kioskTipCoin ${COIN_MS}ms cubic-bezier(0.4, 0, 0.7, 1) both`,
      }}
    />
  )
}
