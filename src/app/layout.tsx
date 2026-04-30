import type { Metadata, Viewport } from 'next'
import './globals.css'
import SplashScreen from '@/components/SplashScreen'

export const metadata: Metadata = {
  title: 'Eren',
  description: 'Take care of Eren together — your virtual Ragdoll companion',
  manifest: '/manifest.json',
  icons: {
    icon: '/ErenIcon.png',
    apple: '/ErenIcon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Eren',
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
        <SplashScreen />
        <div className="app-container">
          {children}
        </div>
      </body>
    </html>
  )
}
