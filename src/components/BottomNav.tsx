'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, UtensilsCrossed, Dices, BedDouble, Bath, Stethoscope } from 'lucide-react'
import { useCare } from '@/contexts/CareContext'

const MAIN_NAV = [
  { href: '/home',     img: '/keyHome.png',    label: 'Home'    },
  { href: '/games',    img: '/gamesBTN.png',   label: 'Games'   },
  { href: '/memories', img: '/picsBTN.png',    label: 'Pics'    },
  { href: '/profile',  img: '/profileBTN.png', label: 'Profile' },
]

const CARE_ACTIONS = [
  { key: 'feed'  as const, icon: UtensilsCrossed, label: 'Feed',  color: '#F5A820', grad: ['#FFF3D0','#FFE090'], border: '#F5C842', shadow: '#D4920E', iconColor: '#C07010' },
  { key: 'play'  as const, icon: Dices,           label: 'Play',  color: '#FF6B9D', grad: ['#FFE8F2','#FFD0E8'], border: '#FF9DC0', shadow: '#E04880', iconColor: '#D03070' },
  { key: 'sleep' as const, icon: BedDouble,        label: 'Sleep', color: '#818CF8', grad: ['#EEF0FF','#DDE0FF'], border: '#A8B0FA', shadow: '#5058D0', iconColor: '#4850C8' },
  { key: 'wash'  as const, icon: Bath,             label: 'Wash',  color: '#38BDF8', grad: ['#E0F8FF','#C8F0FF'], border: '#70D8FA', shadow: '#0898D8', iconColor: '#0880B8' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { careMode, isSick, activeScene, enterCareMode, exitCareMode, openScene } = useCare()

  if (activeScene) return null

  // ── Care sub-nav ──────────────────────────────────────────────────────────
  if (careMode) {
    return (
      <nav className="bottom-nav z-50">
        {/* Back button */}
        <button onClick={exitCareMode} className="nav-item active:scale-90 transition-transform duration-100">
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center justify-center w-11 h-11 relative"
              style={{ background: 'linear-gradient(160deg, #F5EEFF 0%, #E8D8FC 100%)', borderRadius: 14, border: '2px solid #C8A8F0', boxShadow: '0 4px 0 #A070D0, inset 0 1px 0 rgba(255,255,255,0.7)' }}>
              {/* shine */}
              <div style={{ position: 'absolute', top: 3, left: 4, right: 4, height: 5, background: 'rgba(255,255,255,0.5)', borderRadius: 6 }} />
              <ChevronLeft size={20} strokeWidth={2.5} style={{ color: '#8040C0', filter: 'drop-shadow(0 1px 1px rgba(120,40,200,0.2))' }} />
            </div>
          </div>
        </button>

        {CARE_ACTIONS.map(({ key, icon: Icon, label, grad, border, shadow, iconColor }) => (
          <button key={key} onClick={() => openScene(key)}
            className="nav-item active:scale-90 transition-transform duration-100">
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center justify-center w-11 h-11 relative"
                style={{ background: `linear-gradient(160deg, ${grad[0]} 0%, ${grad[1]} 100%)`, borderRadius: 14, border: `2px solid ${border}`, boxShadow: `0 4px 0 ${shadow}, inset 0 1px 0 rgba(255,255,255,0.8)` }}>
                {/* gloss shine */}
                <div style={{ position: 'absolute', top: 3, left: 4, right: 4, height: 5, background: 'rgba(255,255,255,0.55)', borderRadius: 6 }} />
                <Icon size={22} strokeWidth={2.2} style={{ color: iconColor, filter: `drop-shadow(0 1px 2px ${border}88)`, position: 'relative', zIndex: 1 }} />
              </div>
              <span style={{ fontFamily: '"Press Start 2P"', fontSize: 5, color: iconColor, letterSpacing: 0 }}>{label}</span>
            </div>
          </button>
        ))}

        {isSick && (
          <button onClick={() => openScene('hospital')} className="nav-item active:scale-90 transition-transform duration-100">
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center justify-center w-11 h-11 relative"
                style={{ background: 'linear-gradient(160deg, #FFF0F0 0%, #FFD8D8 100%)', borderRadius: 14, border: '2px solid #F08080', boxShadow: '0 4px 0 #C83030, inset 0 1px 0 rgba(255,255,255,0.8)' }}>
                <div style={{ position: 'absolute', top: 3, left: 4, right: 4, height: 5, background: 'rgba(255,255,255,0.55)', borderRadius: 6 }} />
                <Stethoscope size={22} strokeWidth={2.2} style={{ color: '#C02020', filter: 'drop-shadow(0 1px 2px rgba(200,50,50,0.3))', position: 'relative', zIndex: 1 }} />
              </div>
              <span style={{ fontFamily: '"Press Start 2P"', fontSize: 5, color: '#C02020' }}>Vet</span>
            </div>
          </button>
        )}
      </nav>
    )
  }

  // ── Main nav ──────────────────────────────────────────────────────────────
  return (
    <nav className="bottom-nav z-50">

      {/* Home */}
      {(() => {
        const { href, img, label } = MAIN_NAV[0]
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link href={href} className="nav-item active:scale-90 transition-transform duration-100">
            <div className="relative">
              <img
                src={img}
                alt={label}
                width={38}
                height={38}
                style={{ imageRendering: 'pixelated', objectFit: 'contain', display: 'block', transform: active ? 'scale(1.12)' : 'scale(1)', transition: 'transform 0.15s' }}
              />
              {active && <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-[3px] rounded-full bg-[#FF6B9D]" />}
            </div>
          </Link>
        )
      })()}

      {/* Care — center hero button */}
      <button onClick={enterCareMode} className="nav-item active:scale-90 transition-transform duration-100">
        <div className="relative">
          <img
            src="/careBTN.png"
            alt="Care"
            width={46}
            height={46}
            style={{ imageRendering: 'pixelated', objectFit: 'contain', display: 'block' }}
          />
          {isSick && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
              <span className="text-white font-bold" style={{ fontSize: 8 }}>!</span>
            </span>
          )}
        </div>
      </button>

      {/* Games, Pics, Profile */}
      {MAIN_NAV.slice(1).map(({ href, img, label }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link key={href} href={href} className="nav-item active:scale-90 transition-transform duration-100">
            <div className="relative">
              <img
                src={img}
                alt={label}
                width={38}
                height={38}
                style={{ imageRendering: 'pixelated', objectFit: 'contain', display: 'block', transform: active ? 'scale(1.12)' : 'scale(1)', transition: 'transform 0.15s' }}
              />
              {active && <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-[3px] rounded-full bg-[#FF6B9D]" />}
            </div>
          </Link>
        )
      })}

    </nav>
  )
}
