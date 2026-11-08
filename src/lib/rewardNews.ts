export type RewardNewsTarget = 'quests' | 'profile' | 'play' | 'kitchen' | 'menu' | 'kiosk'
export const REWARD_NEWS_CHANGED = 'eren:reward-news-changed'
const TARGETS: RewardNewsTarget[] = ['quests', 'profile', 'play', 'kitchen', 'menu', 'kiosk']
type News = Record<RewardNewsTarget, { seen: string[]; unread: string[] }>
const memory = new Map<string, News>()
export const rewardNewsKey = (actor: string) => `eren:reward-news:v1:${actor}`
const empty = (): News => ({
  quests: { seen: [], unread: [] }, profile: { seen: [], unread: [] }, play: { seen: [], unread: [] },
  kitchen: { seen: [], unread: [] }, menu: { seen: [], unread: [] }, kiosk: { seen: [], unread: [] },
})
export function readRewardNews(actor: string): News {
  const known = memory.get(actor) ?? empty()
  let stored: News | null = null
  try { stored = JSON.parse(localStorage.getItem(rewardNewsKey(actor)) ?? 'null') } catch { /* Memory-only storage works too. */ }
  const next = empty()
  for (const target of TARGETS) {
    const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && id.length <= 180) : []
    const seen = new Set([...known[target].seen, ...strings(stored?.[target]?.seen)])
    next[target] = { seen: Array.from(seen).slice(-1000),
      unread: Array.from(new Set([...known[target].unread, ...strings(stored?.[target]?.unread)])).filter(id => !seen.has(id)).slice(-1000) }
  }
  memory.set(actor, next)
  return next
}
function write(actor: string, next: News, emit: boolean) {
  memory.set(actor, next)
  try { localStorage.setItem(rewardNewsKey(actor), JSON.stringify(next)) } catch { /* Keep the unread state in memory. */ }
  if (emit && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(REWARD_NEWS_CHANGED, { detail: { actor } }))
}
export function receiveRewardNews(actor: string, target: RewardNewsTarget, id: string) {
  const next = readRewardNews(actor), group = next[target]
  if (!id || group.seen.includes(id) || group.unread.includes(id)) return
  group.unread = [...group.unread, id].slice(-1000)
  write(actor, next, true)
}
export function markRewardNewsSeen(actor: string, target: RewardNewsTarget, emit = true) {
  const next = readRewardNews(actor), group = next[target]
  if (!group.unread.length) return
  group.seen = Array.from(new Set([...group.seen, ...group.unread])).slice(-1000)
  group.unread = []
  write(actor, next, emit)
}
