// "Tap to skip" under a gacha cinematic (the parcel, the serving dish, the
// capsule and opening videos): a quiet pill in Meadow's rounded type, low on the screen
// and see-through, so it is findable without taking anything from the show.
// The tap itself belongs to the cinematic's own full-screen layer.

export default function TapToSkip() {
  return (
    <span className="meadow-root absolute" style={{
      left: '50%', transform: 'translateX(-50%)', bottom: 'calc(var(--safe-bottom) + 18px)',
      padding: '6px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.14)',
      color: 'rgba(255,255,255,0.78)', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', pointerEvents: 'none',
    }}>Tap to skip</span>
  )
}
