const fs = require('node:fs')
const path = require('node:path')
const load = require('./lib/load_ts.cjs')()

function rewardCatalog() {
  const { TASK_DEFS, CARE_TASK_IDS } = load('src/lib/tasks.ts')
  const achievements = load('src/lib/achievements.ts')
  const { LEVEL_REWARDS } = load('src/lib/levelRewards.ts')
  const { GACHA_SKINS, SKIN_STARDUST_PRICE } = load('src/lib/skins.ts')
  const { PLAYABLE_MINIGAME_IDS } = load('src/lib/minigames.ts')
  return {
    tasks: TASK_DEFS.map(({ id, period, coins, xp, maxProgress }) => ({ id, period, coins, xp, maxProgress: maxProgress ?? null })),
    achievements: achievements.ACHIEVEMENT_DEFS.map(({ id, coins, triggers }) => ({ id, coins, triggers })),
    levels: LEVEL_REWARDS.map(({ level, items }) => ({ level, items })),
    skins: GACHA_SKINS.filter(s => !s.unlock).map(({ id, rarity }) => ({ id, rarity })),
    boxDust: SKIN_STARDUST_PRICE,
    careIds: CARE_TASK_IDS,
    gameIds: PLAYABLE_MINIGAME_IDS,
    milestones: achievements.STREAK_MILESTONE_COINS,
    freezeDays: achievements.FREEZE_REGEN_DAYS,
    freezeMax: achievements.FREEZE_MAX,
    freezeDefault: achievements.FREEZE_DEFAULT,
    repairCost: achievements.STREAK_REPAIR_COST,
    repairDays: achievements.STREAK_REPAIR_WINDOW_DAYS,
  }
}

module.exports = rewardCatalog
if (require.main === module) {
  const file = path.resolve(__dirname, '../supabase/migration_reward_reliability.sql')
  const before = fs.readFileSync(file, 'utf8')
  if (!/\$reward_catalog\$[\s\S]*?\$reward_catalog\$/.test(before)) throw Error('Missing reward catalogue marker')
  const catalogue = rewardCatalog()
  const after = before.replace(/\$reward_catalog\$[\s\S]*?\$reward_catalog\$/, '$reward_catalog$' + JSON.stringify(catalogue) + '$reward_catalog$')
  if (process.argv.includes('--write')) fs.writeFileSync(file, after)
  else if (after !== before) throw Error('Reward catalogue is stale. Run node scripts/build_reward_catalog.cjs --write')
  console.log(`Reward catalogue: ${catalogue.tasks.length} quests, ${catalogue.achievements.length} achievements, ${catalogue.levels.length} levels, ${catalogue.skins.length} box looks`)
}
