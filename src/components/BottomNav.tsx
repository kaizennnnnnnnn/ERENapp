'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UtensilsCrossed, Dices, BedDouble, Bath, Stethoscope } from 'lucide-react'
import { useCare } from '@/contexts/CareContext'

const CARE_ACTIONS = [
  { key: 'feed'  as const, icon: UtensilsCrossed, label: 'Feed',  grad: ['#FFF3D0','#FFE090'] as [string,string], border: '#F5C842', shadow: '#D4920E', iconColor: '#C07010' },
  { key: 'play'  as const, icon: Dices,           label: 'Play',  grad: ['#FFE8F2','#FFD0E8'] as [string,string], border: '#FF9DC0', shadow: '#E04880', iconColor: '#D03070' },
  { key: 'sleep' as const, icon: BedDouble,        label: 'Sleep', grad: ['#EEF0FF','#DDE0FF'] as [string,string], border: '#A8B0FA', shadow: '#5058D0', iconColor: '#4850C8' },
  { key: 'wash'  as const, icon: Bath,             label: 'Wash',  grad: ['#E0F8FF','#C8F0FF'] as [string,string], border: '#70D8FA', shadow: '#0898D8', iconColor: '#0880B8' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { isSick, activeScene, openScene } = useCare()

  if (activeScene) return null

  const homeActive = pathname === '/home' || pathname.startsWith('/home/')

  return (
    <nav className="bottom-nav z-50">

      {/* Home */}
      <Link href="/home" className="nav-item active:scale-90 transition-transform duration-100">
        <div className="relative">
          <img src="/keyHome.png" alt="Home" width={38} height={38}
            style={{ imageRendering: 'pixelated', objectFit: 'contain', display: 'block',
              transform: homeActive ? 'scale(1.12)' : 'scale(1)', transition: 'transform 0.15s' }} />
          {homeActive && <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-[3px] rounded-full bg-[#FF6B9D]" />}
        </div>
      </Link>

      {/* Care action buttons — directly open scenes */}
      {CARE_ACTIONS.map(({ key, icon: Icon, label, grad, border, shadow, iconColor }) => (
        <button key={key} onClick={() => openScene(key)}
          className="nav-item active:scale-90 transition-transform duration-100">
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center justify-center w-11 h-11 relative"
              style={{ background: `linear-gradient(160deg, ${grad[0]} 0%, ${grad[1]} 100%)`, borderRadius: 14, border: `2px solid ${border}`, boxShadow: `0 4px 0 ${shadow}, inset 0 1px 0 rgba(255,255,255,0.8)` }}>
              <div style={{ position: 'absolute', top: 3, left: 4, right: 4, height: 5, background: 'rgba(255,255,255,0.55)', borderRadius: 6 }} />
              <Icon size={22} strokeWidth={2.2} style={{ color: iconColor, filter: `drop-shadow(0 1px 2px ${border}88)`, position: 'relative', zIndex: 1 }} />
            </div>
            <span style={{ fontFamily: '"Press Start 2P"', fontSize: 5, color: iconColor, letterSpacing: 0 }}>{label}</span>
          </div>
        </button>
      ))}

      {/* Hospital — only when sick */}
      {isSick && (
        <button onClick={() => openScene('hospital')} className="nav-item active:scale-90 transition-transform duration-100">
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center justify-center w-11 h-11 relative"
              style={{ background: 'linear-gradient(160deg, #FFF0F0 0%, #FFD8D8 100%)', borderRadius: 14, border: '2px solid #F08080', boxShadow: '0 4px 0 #C83030, inset 0 1px 0 rgba(255,255,255,0.8)' }}>
              <div style={{ position: 'absolute', top: 3, left: 4, right: 4, height: 5, background: 'rgba(255,255,255,0.55)', borderRadius: 6 }} />
              <Stethoscope size={22} strokeWidth={2.2} style={{ color: '#C02020', position: 'relative', zIndex: 1 }} />
            </div>
            <span style={{ fontFamily: '"Press Start 2P"', fontSize: 5, color: '#C02020' }}>Vet</span>
          </div>
        </button>
      )}

    </nav>
  )
}
