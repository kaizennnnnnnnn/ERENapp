// ─── Supabase database types ──────────────────────────────────────────────────

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type ErenMood = 'idle' | 'happy' | 'hungry' | 'sleepy' | 'playful' | 'angry'
export type UserMood = 'good' | 'mid' | 'sad' | 'angry' | 'tired'
export type ActionType = 'feed' | 'play' | 'sleep' | 'wash' | 'medicine'
export type ReminderType = 'feed' | 'litter' | 'medicine' | 'vet' | 'groom' | 'play' | 'custom'
export type RepeatInterval = 'once' | 'daily' | 'weekly' | 'monthly'
export type GameType = 'catch_mouse' | 'paw_tap' | 'memory_match' | 'treat_tumble' | 'flappy_eren' | 'tic_tac_toe' | 'eren_stack' | 'yarn_pop' | 'eren_says' | 'lane_runner' | 'paw_doku' | 'yarn_sort' | 'gone_fishin' | 'defend_bowl'

export interface Household {
  id: string
  name: string
  invite_code: string
  created_at: string
}

export interface StreakData {
  current: number
  best: number
  lastDate: string | null
  // Freeze tokens auto-spent when the user misses a single day. Regen 1
  // per 14 days, capped at 2. All optional so existing rows decode fine.
  freezeTokens?: number
  lastFreezeEarnedAt?: string | null
  // Repair window: when a real break is detected, capture what was lost
  // so the profile page can offer a coin-buyable restore for 48h.
  priorCurrent?: number
  brokenAt?: string | null
}

export type AchievementId =
  | 'first_care' | 'care_100' | 'all_care_day' | 'clean_sweep'
  | 'streak_7' | 'streak_30' | 'streak_100'
  | 'first_game' | 'high_score_50' | 'all_games'
  | 'level_10' | 'level_25' | 'level_50'
  | 'battle_win' | 'mood_7'
  | 'first_nudge'

export type AchievementMap = Partial<Record<AchievementId, string>>

export interface Profile {
  id: string
  name: string
  avatar_url: string | null
  household_id: string | null
  xp: number
  level: number
  coins: number
  claimed_level?: number
  streak?: StreakData
  achievements?: AchievementMap
  // Recipient opt-in: receive a push when the partner logs a low mood.
  mood_alert_optin?: boolean
  // Phase 3 PR 9 — push opt-ins per channel.
  wish_push_optin?: boolean
  memory_push_optin?: boolean
  // Phase 3 PR 10 — quiets Eren's flavor bubble (doubles cycle) + silences
  // server-side memory unlock pushes for the user who opts in.
  quiet_eren_optin?: boolean
  birthday?: string | null
  email?: string
  created_at: string
  updated_at: string
}

export type TaskId =
  | 'daily_mood' | 'daily_feed' | 'daily_play' | 'daily_sleep' | 'daily_wash' | 'daily_game' | 'daily_nudge'
  | 'daily_chem_lesson' | 'daily_chem_streak'
  | 'weekly_all_care' | 'weekly_all_games' | 'weekly_high_score' | 'weekly_mood_5' | 'weekly_no_sick'

export type TaskPeriod = 'daily' | 'weekly'

export interface TaskDef {
  id: TaskId
  period: TaskPeriod
  title: string
  desc: string
  icon: string
  coins: number
  xp: number
  maxProgress?: number  // if set, weekly task tracks incremental progress
}

export interface TaskCompletion {
  id: string
  user_id: string
  task_id: TaskId
  period_key: string
  coins_earned: number
  xp_earned: number
  completed_at: string
}

export type FoodInventory = {
  kibble?: number
  fish?: number
  treat?: number
  tuna?: number
  steak?: number
  cream?: number
  biscuit?: number
  shrimp?: number
  salmon?: number
  chicken?: number
  sausage?: number
  milk?: number
  cheese?: number
  yogurt?: number
  cake?: number
  sushi?: number
  sardine?: number
  egg?: number
  monster?: number
  donut?: number
  cookie?: number
  jelly_caka?: number
}

export interface ErenStats {
  id: string
  household_id: string
  happiness: number
  hunger: number
  energy: number
  sleep_quality: number
  weight: number
  cleanliness: number
  is_sick: boolean
  coins: number
  food_inventory: FoodInventory
  // Per-user fridge piles, keyed by user id. New shop buys land here under
  // the buyer's id; gifts move qty from sender pile → recipient pile. The
  // shared `food_inventory` column remains as a legacy pool either user can
  // still draw from until empty.
  food_by_user?: Record<string, FoodInventory>
  mood: ErenMood
  updated_at: string
  last_decay_at?: string | null
  is_sleeping: boolean
  // Per-household skin assignment: room id → skin id (see lib/skins.ts).
  // Shared between partners and realtime-synced. Absent / missing key = the
  // room shows its built-in default look.
  room_skins?: Record<string, string> | null
}

export type FoodKey = 'kibble' | 'fish' | 'treat' | 'tuna' | 'steak' | 'cream' | 'biscuit' | 'shrimp' | 'salmon' | 'chicken' | 'sausage' | 'milk' | 'cheese' | 'yogurt' | 'cake' | 'sushi' | 'sardine' | 'egg' | 'monster' | 'donut' | 'cookie' | 'jelly_caka'
export interface GiftItem { key: FoodKey; qty: number }

export interface Interaction {
  id: string
  household_id: string
  user_id: string
  action_type: ActionType
  happiness_delta: number
  hunger_delta: number
  energy_delta: number
  sleep_delta: number
  weight_delta: number
  note: string | null
  created_at: string
  // True when the relevant stat was actually low at action time.
  // False = action still recorded, but skipped by the daily battle
  // scoreboard + action pop so spamming a maxed stat doesn't farm
  // points.
  useful?: boolean
  // joined
  profile?: Profile
}

export interface DailyMood {
  id: string
  user_id: string
  mood: UserMood
  note: string | null
  date: string
  created_at: string
  // joined
  profile?: Profile
}

export interface Reminder {
  id: string
  household_id: string
  created_by: string
  title: string
  description: string | null
  reminder_type: ReminderType
  repeat_interval: RepeatInterval | null
  next_due: string | null
  is_active: boolean
  created_at: string
  // joined
  last_completed?: string | null
}

export interface ReminderLog {
  id: string
  reminder_id: string
  user_id: string
  completed_at: string
  note: string | null
}

export interface Memory {
  id: string
  household_id: string
  user_id: string
  image_url: string | null
  text: string | null
  tags: string[]
  is_favorite: boolean
  created_at: string
  // joined
  profile?: Profile
}

export interface TimeSpent {
  id: string
  user_id: string
  session_start: string
  session_end: string | null
  duration_seconds: number | null
  date: string
}

export interface GameScore {
  id: string
  user_id: string
  game_type: GameType
  score: number
  created_at: string
}

// ─── Gacha system ────────────────────────────────────────────────────────────

export type GachaRarity = 'common' | 'rare' | 'epic' | 'legendary'
export type GachaCategory = 'outfit' | 'decoration' | 'background' | 'recipe' | 'emote' | 'frame' | 'consumable' | 'skin'
export type OutfitSlot = 'hat' | 'eyes' | 'neck'

// Eye-overlay layout for BlinkingEren — all values are percentages of the
// sprite's square box. Defined here so the skins catalogue (lib/skins.ts) and
// the asset pipeline (scripts/build_skins.cjs) can share the shape. The
// authoritative field docs live in components/BlinkingEren.tsx.
export interface EyeLayout {
  lidTop: string; lidLeftA: string; lidLeftB: string; lidWidth: string
  // Blink-lid height as a % of the sprite box. Defaults to 5.5% (tuned to the
  // room sprites' ~5% eyes); gacha skins set it to their measured iris height
  // because their anime eyes are larger.
  lidHeight?: string
  maskTop: string; maskLeftA: string; maskLeftB: string; maskW: string; maskH: string
  glintLeftA: string; glintLeftB: string; glintTopA: string; glintTopB: string; glintW: string
  sleepyLidW?: number; sleepyLidH?: number
}

export interface GachaItemDef {
  id: string
  name: string
  category: GachaCategory
  rarity: GachaRarity
  icon: string
  description: string
  // Skin items render an image instead of an emoji icon. `image` is the full
  // sprite thumbnail; `skinId` keys into the skins catalogue (lib/skins.ts)
  // for the animated room/closet render.
  image?: string
  skinId?: string
  // Outfit positioning (% relative to Eren's 200x200 container)
  slot?: OutfitSlot
  pos?: { top: number; left: number; size: number }
  // Decoration positioning (% relative to room)
  roomPos?: { bottom: number; left: number; size: number }
  // Consumable buff
  buff?: { stat: string; amount: number; duration?: string }
}

export interface GachaBannerDef {
  id: string
  name: string
  description: string
  icon: string
  featuredItems: string[]
  permanent: boolean
  bgGradient: [string, string]
  /** When set, pulls on this banner only drop items from these categories. */
  categories?: GachaCategory[]
}

export interface UserInventoryItem {
  id: string
  user_id: string
  item_id: string
  quantity: number
  equipped: boolean
  obtained_at: string
}

export interface UserGachaState {
  user_id: string
  stardust: number
  pulls_since_epic: number
  pulls_since_legendary: number
  total_pulls: number
  last_free_fortune: string | null
}

export interface GachaPullResult {
  item: GachaItemDef
  isNew: boolean
  stardustGained: number
  isPity: boolean
}

// ─── Couple features ─────────────────────────────────────────────────────────

export interface JournalMessage {
  id: string
  household_id: string
  sender_id: string
  message: string
  is_read: boolean
  created_at: string
  // Optional food gift attached to the message. When present, the qty was
  // already moved from sender → recipient at send time (see useErenStats).
  gift_item?: GiftItem | null
  // True when the message was sent via the home-screen ThoughtCloud
  // ("Eren has a message"). These messages only ever surface through
  // the ErenMessagePopup and are filtered out of the heart-button
  // journal list. The accompanying push notification also hides the
  // actual body text for these.
  via_eren?: boolean
  // SketchEren pose for a "Send Eren" nudge (e.g. 'kiss', 'love'). When set,
  // the recipient popup renders Eren in this pose instead of the static
  // sprite. Absent for ordinary ThoughtCloud messages.
  eren_state?: string
  profile?: Profile
}

// ─── Daily fortune ───────────────────────────────────────────────────────────

export interface FortuneGiftDef {
  id: string
  name: string
  icon: string
  rarity: GachaRarity
  description: string
  coinValue?: number
  stardustValue?: number
  gachaTickets?: number
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

export interface StatConfig {
  key: keyof Pick<ErenStats, 'happiness' | 'hunger' | 'energy' | 'sleep_quality' | 'cleanliness'>
  label: string
  icon: string
  color: string
  bgColor: string
}

export const STAT_CONFIGS: StatConfig[] = [
  { key: 'happiness',     label: 'Happiness',   icon: '💕', color: 'bg-pink-400',   bgColor: 'bg-pink-100'   },
  { key: 'hunger',        label: 'Hunger',      icon: '🍗', color: 'bg-amber-400',  bgColor: 'bg-amber-100'  },
  { key: 'energy',        label: 'Energy',      icon: '⚡', color: 'bg-emerald-400', bgColor: 'bg-emerald-100'},
  { key: 'sleep_quality', label: 'Sleep',       icon: '💤', color: 'bg-indigo-400',  bgColor: 'bg-indigo-100' },
  { key: 'cleanliness',   label: 'Cleanliness', icon: '🛁', color: 'bg-sky-400',     bgColor: 'bg-sky-100'    },
]

export const ACTION_CONFIGS: Record<ActionType, {
  label: string
  icon: string
  emoji: string
  color: string
  deltas: Partial<Pick<ErenStats, 'happiness' | 'hunger' | 'energy' | 'sleep_quality' | 'cleanliness'>> & { weight?: number }
  cooldownMs: number
}> = {
  feed:     { label: 'Feed Eren',    icon: '🍗', emoji: '🍗', color: 'bg-amber-400',   deltas: { hunger: 25, happiness: 2, energy: 5, weight: 0.05 },         cooldownMs: 3600000  },
  play:     { label: 'Play',         icon: '🧶', emoji: '🎾', color: 'bg-pink-400',    deltas: { happiness: 20, energy: -15, hunger: -10, weight: -0.03 },     cooldownMs: 1800000  },
  sleep:    { label: 'Put to sleep', icon: '💤', emoji: '😴', color: 'bg-indigo-400',  deltas: { sleep_quality: 30, energy: 25, hunger: -5 },                  cooldownMs: 28800000 },
  wash:     { label: 'Wash Eren',    icon: '🛁', emoji: '🛁', color: 'bg-sky-400',     deltas: { cleanliness: 60, happiness: 5 },                              cooldownMs: 43200000 },
  medicine: { label: 'Medicine',     icon: '💊', emoji: '💊', color: 'bg-green-400',   deltas: { happiness: 10, energy: 15, cleanliness: 10 },                 cooldownMs: 86400000 },
}

export const MOOD_CONFIGS: Record<UserMood, { label: string; emoji: string; color: string }> = {
  good:  { label: 'Good',  emoji: '😊', color: 'bg-green-100 text-green-700'  },
  mid:   { label: 'Mid',   emoji: '😐', color: 'bg-yellow-100 text-yellow-700'},
  sad:   { label: 'Sad',   emoji: '😔', color: 'bg-blue-100 text-blue-700'    },
  angry: { label: 'Angry', emoji: '😠', color: 'bg-red-100 text-red-700'      },
  tired: { label: 'Tired', emoji: '😴', color: 'bg-purple-100 text-purple-700'},
}
