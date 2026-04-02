import { CareProvider } from '@/contexts/CareContext'
import BottomNav from '@/components/BottomNav'
import CareSceneHost from '@/components/care/CareSceneHost'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CareProvider>
      <div className="relative">
        <main>{children}</main>
        <CareSceneHost />
        <BottomNav />
      </div>
    </CareProvider>
  )
}
