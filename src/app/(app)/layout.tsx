import { CareProvider } from '@/contexts/CareContext'
import { TaskProvider } from '@/contexts/TaskContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { WishProvider } from '@/contexts/WishContext'
import { ErenStatsProvider } from '@/hooks/useErenStats'
import { CoupleProvider } from '@/hooks/useCouple'
import { DailyBattleProvider } from '@/hooks/useDailyBattle'
import CareSceneHost from '@/components/care/CareSceneHost'
import CloudTransition from '@/components/CloudTransition'
import DailyBattlePop from '@/components/couple/DailyBattlePop'
import PageSwiper from '@/components/PageSwiper'
import StatsHeader from '@/components/StatsHeader'
import AppFrame from '@/components/AppFrame'
import AchievementToast from '@/components/AchievementToast'
import MemoryWatcher from '@/components/memory/MemoryWatcher'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <CareProvider>
        <TaskProvider>
          <ErenStatsProvider>
            <CoupleProvider>
              <DailyBattleProvider>
                <WishProvider>
                  <PageSwiper>
                    <div className="fixed top-0 left-0 right-0 z-[60] pointer-events-none">
                      <StatsHeader />
                    </div>
                    <main>{children}</main>
                    <CareSceneHost />
                    <CloudTransition />
                    <DailyBattlePop />
                    <AchievementToast />
                    <MemoryWatcher />
                    <AppFrame />
                  </PageSwiper>
                </WishProvider>
              </DailyBattleProvider>
            </CoupleProvider>
          </ErenStatsProvider>
        </TaskProvider>
      </CareProvider>
    </ThemeProvider>
  )
}
