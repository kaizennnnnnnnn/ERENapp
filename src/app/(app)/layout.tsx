import { CareProvider } from '@/contexts/CareContext'
import { TaskProvider } from '@/contexts/TaskContext'
import CareSceneHost from '@/components/care/CareSceneHost'
import PageSwiper from '@/components/PageSwiper'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CareProvider>
      <TaskProvider>
        <PageSwiper>
          <main>{children}</main>
          <CareSceneHost />
        </PageSwiper>
      </TaskProvider>
    </CareProvider>
  )
}
