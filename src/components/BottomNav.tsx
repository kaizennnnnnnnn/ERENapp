'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, UtensilsCrossed, Dices, BedDouble, Bath, Stethoscope } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCare } from '@/contexts/CareContext'

const MAIN_NAV = [
  { href: '/home',     img: '/keyHome.png',    label: 'Home'    },
  { href: '/games',    img: '/gamesBTN.png',   label: 'Games'   },
  { href: '/memories', img: '/picsBTN.png',    label: 'Pics'    },
  { href: '/profile',  img: '/profileBTN.png', label: 'Profile' },
]

const CARE_ACTIONS = [
  { key: 'feed'  as const, icon: UtensilsCrossed, label: 'Feed',  color: '#F5A820' },
  { key: 'play'  as const, icon: Dices,           label: 'Play',  color: '#FF6B9D' },
  { key: 'sleep' as const, icon: BedDouble,        label: 'Sleep', color: '#818CF8' },
  { key: 'wash'  as const, icon: Bath,             label: 'Wash',  color: '#38BDF8' },
]

// Staggered breathing delays so each button feels alive independently
const BREATHE_DELAYS = ['0s', '0.6s', '1.2s', '1.8s', '2.4s']

export default function BottomNav() {
  const pathname = usePathname()
  const { careMode, isSick, activeScene, enterCareMode, exitCareMode, openScene } = useCare()

  if (activeScene) return null

  // ── Care sub-nav ──────────────────────────────────────────────────────────
  if (careMode) {
    return (
      <nav className="bottom-nav z-50">
        <button onClick={exitCareMode} className="nav-item">
          <div className="flex items-center justify-center w-10 h-10"
            style={{ background: 'linear-gradient(135deg, #F0E8FF, #E0D0F8)', borderRadius: 8, border: '2px solid #C8B0E8', boxShadow: '0 3px 0 #A880D0' }}>
            <ChevronLeft size={20} strokeWidth={2.5} style={{ color: '#9060C0' }} />
          </div>
        </button>

        {CARE_ACTIONS.map(({ key, icon: Icon, label, color }, i) => (
          <button key={key} onClick={() => openScene(key)}
            className="nav-item nav-breathe"
            style={{ animationDelay: BREATHE_DELAYS[i + 1] }}>
            <div className="flex items-center justify-center w-11 h-11"
              style={{ background: 'white', borderRadius: 8, border: `2px solid ${color}50`, boxShadow: `0 3px 0 ${color}40` }}>
              <Icon size={22} strokeWidth={2} style={{ color }} />
            </div>
          </button>
        ))}

        {isSick && (
          <button onClick={() => openScene('hospital')} className="nav-item">
            <div className="flex items-center justify-center w-11 h-11"
              style={{ background: 'white', borderRadius: 8, border: '2px solid #FCA5A550', boxShadow: '0 3px 0 #F8707040' }}>
              <Stethoscope size={22} strokeWidth={2} className="text-red-400" />
            </div>
          </button>
        )}
      </nav>
    )
  }

  // ── Main nav ──────────────────────────────────────────────────────────────
  // Order: Home(0) | Care(1) | Games(2) | Memories(3) | Profile(4)
  return (
    <nav className="bottom-nav z-50">

      {/* Home */}
      {(() => {
        const { href, img, label } = MAIN_NAV[0]
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link href={href} className="nav-item nav-breathe" style={{ animationDelay: BREATHE_DELAYS[0] }}>
            <div className="relative">
              <img
                src={img}
                alt={label}
                width={38}
                height={38}
                style={{ imageRendering: 'pixelated', opacity: active ? 1 : 0.55, objectFit: 'contain', display: 'block' }}
              />
              {active && <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-[3px] rounded-full bg-[#FF6B9D]" />}
            </div>
          </Link>
        )
      })()}

      {/* Care — center hero button */}
      <button onClick={enterCareMode} className="nav-item nav-breathe" style={{ animationDelay: BREATHE_DELAYS[1] }}>
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
      {MAIN_NAV.slice(1).map(({ href, img, label }, i) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link key={href} href={href} className="nav-item nav-breathe" style={{ animationDelay: BREATHE_DELAYS[i + 2] }}>
            <div className="relative">
              <img
                src={img}
                alt={label}
                width={38}
                height={38}
                style={{ imageRendering: 'pixelated', opacity: active ? 1 : 0.55, objectFit: 'contain', display: 'block' }}
              />
              {active && <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-[3px] rounded-full bg-[#FF6B9D]" />}
            </div>
          </Link>
        )
      })}

    </nav>
  )
}
