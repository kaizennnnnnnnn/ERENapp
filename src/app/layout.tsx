import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pocket Eren 🐱',
  description: 'Take care of Eren together — your virtual Ragdoll companion',
  manifest: '/manifest.json',
  icons: {
    icon: '/ErenIcon.png',
    apple: '/ErenIcon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Pocket Eren',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#FDF6FF',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#FDF6FF]">
        <div className="app-container">
          {children}
        </div>
      </body>
    </html>
  )
}
