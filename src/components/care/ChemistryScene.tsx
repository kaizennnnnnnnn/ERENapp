'use client'

// Chemistry lab — placeholder room. Currently just renders the background +
// Eren sitting on the rug; the actual gameplay loop ("what we do in this
// room") will land in a follow-up commit once we decide what it is.

import BlinkingEren from '@/components/BlinkingEren'
import ErenIdleLayer from '@/components/ErenIdleLayer'
import LightSwitch from '@/components/LightSwitch'
import { useIsDark } from '@/hooks/useIsDark'

interface Props { onClose: () => void }

export default function ChemistryScene(_props: Props) {
  void _props
  const isDark = useIsDark()

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden">

      {/* ══ BACKGROUND IMAGE ══ */}
      <div className="absolute inset-0" style={{
        backgroundImage: `url(${isDark ? '/ChemistryNight.png' : '/ChemistryDay.png'})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        pointerEvents: 'none',
      }} />

      {/* ══ EREN ══ sits on the rug, roughly centered with the desk above */}
      <div className="absolute z-10" style={{
        bottom: '18%',
        left: '50%',
        transform: 'translateX(-50%)',
      }}>
        <ErenIdleLayer>
          <BlinkingEren size={180} />
        </ErenIdleLayer>
      </div>

      <LightSwitch targetBottom="22%" targetLeft="50%" persistKey="chemistry" />
    </div>
  )
}
