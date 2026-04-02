import { CareProvider } from '@/contexts/CareContext'
import { TaskProvider } from '@/contexts/TaskContext'
import BottomNav from '@/components/BottomNav'
import CareSceneHost from '@/components/care/CareSceneHost'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CareProvider>
      <TaskProvider>
        <div className="relative">
          <main>{children}</main>
          <CareSceneHost />
          <BottomNav />
        </div>
      </TaskProvider>
    </CareProvider>
  )
}
