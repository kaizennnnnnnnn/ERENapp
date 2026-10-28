'use client'

import { MeadowIcon, RoundButton, M, type MeadowIconName } from '@/components/meadow'
import { requestCloudNav, type CloudTheme } from '@/components/CloudTransition'
import { playSound } from '@/lib/sounds'

const DOCK_BOTTOM = 8
const DOCK_HEIGHT = 70

// Keep the swipe dots and home toast above the complete icon-and-label row.
export const DOCK_CLEARANCE = DOCK_BOTTOM + DOCK_HEIGHT + 8

const PLACES: ReadonlyArray<{ href: string; icon: MeadowIconName; label: string; cloud: CloudTheme }> = [
  { href: '/gacha', icon: 'gacha', label: 'Gacha', cloud: 'rainbow' },
  { href: '/bakery', icon: 'cake', label: 'Bakery', cloud: 'pink' },
  { href: '/shawarma', icon: 'shawarma', label: 'Shawarma', cloud: 'smoke' },
  { href: '/jelly', icon: 'jelly', label: 'Jelly', cloud: 'mint' },
]

export default function HomeDock() {
  return (
    <nav aria-label="Places" className="meadow-root absolute left-0 right-0 z-20"
      style={{ bottom: DOCK_BOTTOM, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, padding: '0 16px', height: DOCK_HEIGHT }}>
      {PLACES.map((place, index) => (
        <div key={place.href} className="home-dock-pop"
          style={{ minWidth: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', animationDelay: `${0.18 + index * 0.08}s` }}>
          <RoundButton surface="art" size={44} href={place.href} ariaLabel={place.label}
            style={{ position: 'relative' }}
            onClick={event => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
              event.preventDefault()
              playSound('ui_tap')
              requestCloudNav(place.href, place.cloud)
            }}>
            <MeadowIcon name={place.icon} size={26} />
            <span style={{
              position: 'absolute', top: 50, left: '50%', transform: 'translateX(-50%)',
              display: 'block', padding: '2px 6px', borderRadius: 6,
              background: '#FFFFFF', boxShadow: `0 2px 0 ${M.overArtLip}`,
              color: M.text, fontSize: 12, lineHeight: '16px', fontWeight: 800,
              letterSpacing: 0, whiteSpace: 'nowrap',
            }}>
              {place.label}
            </span>
          </RoundButton>
        </div>
      ))}
    </nav>
  )
}
