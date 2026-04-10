import { CareProvider } from '@/contexts/CareContext'
import { TaskProvider } from '@/contexts/TaskContext'
import CareSceneHost from '@/components/care/CareSceneHost'
import PageSwiper from '@/components/PageSwiper'
import StatsHeader from '@/components/StatsHeader'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CareProvider>
      <TaskProvider>
        <PageSwiper>
          <div className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
            <StatsHeader />
          </div>
          <main>{children}</main>
          <CareSceneHost />
        </PageSwiper>
      </TaskProvider>
    </CareProvider>
  )
}
