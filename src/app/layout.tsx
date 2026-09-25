import type { Metadata, Viewport } from 'next'
import './globals.css'
import CloudTransition from '@/components/CloudTransition'
import SplashScreen from '@/components/SplashScreen'
import CrashTrap from '@/components/CrashTrap'
import TransientErrorSilencer from '@/components/TransientErrorSilencer'
import LongPressGuard from '@/components/LongPressGuard'

export const metadata: Metadata = {
  title: 'Eren',
  // Solo-framed on purpose: ~100% of new installs are one person, and this
  // is the first sentence the store and every share preview show them.
  // 509f96c's copy sweep reached the five onboarding files and stopped there.
  description: 'Build a pixel cat, give it a name, and look after it — on your own, or with someone.',
  manifest: '/manifest.json',
  icons: {
    icon: '/ErenAppIcon.png',
    apple: '/ErenAppIcon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Eren',
  },
  // Spec-compliant equivalent of apple-mobile-web-app-capable. Apple
  // deprecated the prefixed version; emitting both keeps iOS happy AND
  // silences the "[Deprecation] meta apple-mobile-web-app-capable" warning
  // that browsers now log on every page load.
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#FDF6FF',
  // viewport-fit: cover makes env(safe-area-inset-*) actually return real
  // values on iOS PWA — without it the inset env() values are zero.
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#FDF6FF]">
        <TransientErrorSilencer />
        {/* AFTER the silencer, never before: listeners fire in registration
            order, and this one skips anything the silencer has already
            preventDefault()ed as a benign network blip. */}
        <CrashTrap />
        <LongPressGuard />
        <SplashScreen />
        <div className="app-container">
          {children}
          {/* Lives in the ROOT layout (inside .app-container so fixed
              overlays scope to the phone frame) — it must survive the
              onboarding → (app) navigation, which the (app) layout's
              instance could not. Exactly one instance app-wide: a second
              listener would double the router.push. */}
          <CloudTransition />
        </div>
      </body>
    </html>
  )
}
