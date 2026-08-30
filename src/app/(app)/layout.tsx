import { CareProvider } from '@/contexts/CareContext'
import { TaskProvider } from '@/contexts/TaskContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { WishProvider } from '@/contexts/WishContext'
import { ErenStatsProvider } from '@/hooks/useErenStats'
import { CoupleProvider } from '@/hooks/useCouple'
import { DailyBattleProvider } from '@/hooks/useDailyBattle'
import { TrophiesProvider } from '@/hooks/useTrophies'
import { TrophyEffectsProvider } from '@/hooks/useTrophyEffects'
import CareSceneHost from '@/components/care/CareSceneHost'
import DailyBattlePop from '@/components/couple/DailyBattlePop'
import PageSwiper from '@/components/PageSwiper'
import StatsHeader from '@/components/StatsHeader'
import AppFrame from '@/components/AppFrame'
import AchievementToast from '@/components/AchievementToast'
import StreakMilestoneBurst from '@/components/StreakMilestoneBurst'
import MemoryWatcher from '@/components/memory/MemoryWatcher'
import TermsGate from '@/components/legal/TermsGate'
import AppGuard from '@/components/AppGuard'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <CareProvider>
        <TaskProvider>
          <ErenStatsProvider>
            <CoupleProvider>
              <TrophiesProvider>
                {/* Above DailyBattleProvider on purpose: the scoreboard reads
                    the day's live privileges (double hour, point steal) out of
                    it, so the effects have to exist first. */}
                <TrophyEffectsProvider>
                  <DailyBattleProvider>
                    <WishProvider>
                  <PageSwiper>
                    <div className="fixed top-0 left-0 right-0 z-[60] pointer-events-none">
                      <StatsHeader />
                    </div>
                    <main>{children}</main>
                    <CareSceneHost />
                    <DailyBattlePop />
                    <AchievementToast />
                    <StreakMilestoneBurst />
                    <MemoryWatcher />
                    <AppGuard />
                    <AppFrame />
                    {/* Last, and above everything: nothing else in the app
                        should be reachable while acceptance is outstanding. */}
                    <TermsGate />
                  </PageSwiper>
                    </WishProvider>
                  </DailyBattleProvider>
                </TrophyEffectsProvider>
              </TrophiesProvider>
            </CoupleProvider>
          </ErenStatsProvider>
        </TaskProvider>
      </CareProvider>
    </ThemeProvider>
  )
}
