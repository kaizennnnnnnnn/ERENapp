import { CareProvider } from '@/contexts/CareContext'
import { TaskProvider } from '@/contexts/TaskContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import CareSceneHost from '@/components/care/CareSceneHost'
import DailyBattlePop from '@/components/couple/DailyBattlePop'
import PageSwiper from '@/components/PageSwiper'
import StatsHeader from '@/components/StatsHeader'
import AppFrame from '@/components/AppFrame'
import AchievementToast from '@/components/AchievementToast'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <CareProvider>
        <TaskProvider>
          <PageSwiper>
            <div className="fixed top-0 left-0 right-0 z-[60] pointer-events-none">
              <StatsHeader />
            </div>
            <main>{children}</main>
            <CareSceneHost />
            <DailyBattlePop />
            <AchievementToast />
            <AppFrame />
          </PageSwiper>
        </TaskProvider>
      </CareProvider>
    </ThemeProvider>
  )
}
