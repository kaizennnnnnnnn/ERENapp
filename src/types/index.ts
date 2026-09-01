// ─── Supabase database types ──────────────────────────────────────────────────

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type ErenMood = 'idle' | 'happy' | 'hungry' | 'sleepy' | 'playful' | 'angry'
export type UserMood = 'good' | 'mid' | 'sad' | 'angry' | 'tired'
export type ActionType = 'feed' | 'play' | 'sleep' | 'wash' | 'medicine' | 'lolipop'
export type ReminderType = 'feed' | 'litter' | 'medicine' | 'vet' | 'groom' | 'play' | 'custom'
export type RepeatInterval = 'once' | 'daily' | 'weekly' | 'monthly'
export type GameType = 'catch_mouse' | 'paw_tap' | 'memory_match' | 'treat_tumble' | 'flappy_eren' | 'tic_tac_toe' | 'eren_stack' | 'yarn_pop' | 'eren_says' | 'lane_runner' | 'paw_doku' | 'yarn_sort' | 'gone_fishin' | 'defend_bowl' | 'purr_beat'

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
  /** Sender colour within the household: the creator is 'brown_heart', the
   *  partner who joins is 'pink_heart'. Stamped at onboarding — replaces the
   *  hardcoded-email check that made every household after the first one
   *  render two identical pink partners. */
  heart?: 'brown_heart' | 'pink_heart' | 'sparkle'
  /** When this account last accepted the terms and content rules. Stamped
   *  server-side by accept_terms(). Null for accounts created before the
   *  gate existed — TermsGate re-asks them. */
  terms_accepted_at?: string | null
  // ── Trophy battle (migration_trophy_battle.sql) ──────────────────────────
  /** Spendable trophies. Minted only by claim_daily_trophy(). */
  trophies?: number
  /** Bought in the Trophy Shop's prestige shelf; shown beside the name. */
  equipped_title?: string | null
  equipped_frame?: string | null
  created_at: string
  updated_at: string
}

export type TaskId =
  | 'daily_mood' | 'daily_feed' | 'daily_play' | 'daily_sleep' | 'daily_wash' | 'daily_game' | 'daily_nudge'
  | 'daily_chem_lesson' | 'daily_chem_streak' | 'daily_serbian'
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

/**
 * The donut case. Twenty-seven of them, so they get their own union rather
 * than another screenful inside FoodKey — the catalogue (price, art, where you
 * can buy one) lives in lib/donuts.ts and is keyed by exactly this.
 *
 * `donut` has no suffix because it shipped before the rest and Phase 3 wishes
 * ask for it by that id.
 */
export type DonutKey =
  | 'donut' | 'donut_choco'
  | 'donut_vanilla' | 'donut_honey' | 'donut_caramel' | 'donut_mint'
  | 'donut_matcha' | 'donut_blueberry' | 'donut_red_velvet' | 'donut_mocha'
  | 'donut_lattice' | 'donut_sakura' | 'donut_hibiscus' | 'donut_black_forest'
  | 'donut_ube' | 'donut_maple_bacon' | 'donut_mochi' | 'donut_sesame'
  | 'donut_gold_leaf' | 'donut_pizza' | 'donut_lavender' | 'donut_biscoff'
  | 'donut_pistachio' | 'donut_white_choc'
  | 'donut_tiger' | 'donut_arcade' | 'donut_neon'

export type FoodInventory = Partial<Record<DonutKey, number>> & {
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
  cookie?: number
  jelly_caka?: number
  // World dishes (pixel-art plates). Grouped in the shop by cuisine —
  // italian / sushi / asian / balkan / world.
  pizza?: number
  carbonara?: number
  lasagna?: number
  risotto?: number
  nigiri?: number
  temaki?: number
  maki?: number
  ramen?: number
  pad_thai?: number
  gyoza?: number
  xiaolongbao?: number
  cevapi?: number
  sarma?: number
  doner?: number
  tacos?: number
  wrap?: number
  paella?: number
  stew?: number
  meatballs?: number
  roast_chicken?: number
  monsta_original?: number
  monsta_white?: number
  monsta_mango?: number
  monsta_loco?: number
  monsta_pipeline?: number
  monsta_punch?: number
  monsta_rosa?: number
  monsta_peachy?: number
  monsta_rainbow?: number
  monsta_gold?: number
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
  // The sky outside each room's window: room id → WeatherId (see lib/weather).
  // Household rather than per-user for the same reason room_skins is — there
  // is one house, and the storm she put over the bath should still be there
  // when you open the door.
  room_weather?: Record<string, string> | null
  // The accessory Eren is currently wearing (trophyShop AccessoryItem id), or
  // null for a bare cat. Household-wide on purpose: the point of a crown is
  // that the other person finds it on him.
  equipped_accessory?: string | null
  // Kiosk memory, household-wide: costume id -> the order they had last
  // time and how many times they've been served right (see kioskShift's
  // Regulars), plus lifetime wraps, which is what puts new things on the
  // kiosk's menu.
  kiosk_regulars?: Record<string, unknown> | null
  kiosk_wraps?: number | null
  // Every donut id Eren has actually been fed, household-wide. The donut case
  // in the bakery reads this to mark what he's tasted. Household rather than
  // per-user on purpose: it's the CAT's palate, not a personal checklist.
  donuts_tasted?: string[] | null
  // Today's 3-food menu: which of it has been fed, and whether it's been paid
  // out. Shared rather than per-user so feeding the salmon on one phone ticks
  // it on the other. Replaced wholesale when the day rolls over.
  menu_state?: { day: string; done: string[]; claimed_at: string | null } | null
  /**
   * The donut effect currently running on Eren, if any (see donutEffects).
   * On the household row on purpose — feeding him the neon one should be
   * something the other person walks in on.
   */
  donut_effect?: { id: string; until: string } | null
}

export type FoodKey = 'kibble' | 'fish' | 'treat' | 'tuna' | 'steak' | 'cream' | 'biscuit' | 'shrimp' | 'salmon' | 'chicken' | 'sausage' | 'milk' | 'cheese' | 'yogurt' | 'cake' | 'sushi' | 'sardine' | 'egg' | 'cookie' | 'jelly_caka'
  // The whole donut case — kitchen shelf, bakery specials and gacha pulls all
  // land in the fridge the same way. See lib/donuts.ts.
  | DonutKey
  // World dishes — same lifecycle as the staples above (buyable, giftable).
  | 'pizza' | 'carbonara' | 'lasagna' | 'risotto'
  | 'nigiri' | 'temaki' | 'maki'
  | 'ramen' | 'pad_thai' | 'gyoza' | 'xiaolongbao'
  | 'cevapi' | 'sarma' | 'doner'
  | 'tacos' | 'wrap' | 'paella' | 'stew' | 'meatballs' | 'roast_chicken'
  // Monsta cans. All nine are fridge foods — a pulled can is granted here so
  // it lands somewhere you can actually feed it from.
  | 'monsta_original' | 'monsta_white' | 'monsta_mango' | 'monsta_loco'
  | 'monsta_pipeline' | 'monsta_punch' | 'monsta_rosa' | 'monsta_peachy'
  | 'monsta_rainbow' | 'monsta_gold'
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
// Two kinds of drop, and every one of them has real art. The emoji-only
// categories (outfit / decoration / background / recipe / emote / frame) and
// their equip plumbing were removed — this app draws pixel art, not emoji.
export type GachaCategory = 'consumable' | 'skin'

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

// Eyelid palette for BlinkingEren's blink. A closed lid is FUR, so it has to be
// the colour of the face wearing it: Eren's ragdoll brown by default, but a skin
// that repaints his whole head (Rainbow, Golden) brings its own. Lives here, next
// to EyeLayout, so the skins catalogue can define tones without importing a
// component. Field docs live in components/BlinkingEren.tsx.
export interface LidTone {
  base: string
  sheen: string
  seam: string
  flat: string
}

export interface GachaItemDef {
  id: string
  name: string
  category: GachaCategory
  rarity: GachaRarity
  description: string
  /** Item art. Every gacha item has some — a drop with no picture isn't a prize. */
  image: string
  /** Keys into the skins catalogue (lib/skins.ts) for the room/closet render. */
  skinId?: string
  // Which skin gacha a skin item belongs to. Two banners both drop `category:
  // 'skin'` (animal costumes vs food costumes); this keeps each banner's pool
  // to its own set. Undefined on non-skin items.
  skinSet?: 'animal' | 'food'
  // Non-gacha unlock route. 'drink' = granted the first time the matching
  // SPECIAL EDITION can is fed; 'jelly' = granted for completing the Jelly
  // Parlour set. Such an item is still catalogued (it counts toward the
  // collection and shows in the closet) but never enters a banner pool — see
  // bannerFilter in lib/gacha.ts.
  unlock?: 'drink' | 'jelly'
  // Consumable buff
  buff?: { stat: string; amount: number; duration?: string }
}

export interface GachaBannerDef {
  id: string
  name: string
  description: string
  featuredItems: string[]
  permanent: boolean
  bgGradient: [string, string]
  /** When set, pulls on this banner only drop items from these categories. */
  categories?: GachaCategory[]
  /** For a skin banner: which skin set it draws from. Lets two `['skin']`
   *  banners (animal costumes vs food costumes) keep separate pools. */
  skinSet?: 'animal' | 'food'
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
  // Bakery donut machine — rolling 24h, so an instant rather than a date.
  // Absent until supabase/migration_donut_machine.sql is applied; a missing
  // column reads as "never spun", which is the correct starting state anyway.
  last_free_donut?: string | null
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
  // The vet's reward for a clean bill of health. Lifts every bar except
  // cleanliness — a sweet doesn't wash him, and topping that up here would
  // undercut the bathroom entirely. No weight either: it's a prize for good
  // care, so it shouldn't quietly push him toward "Overweight" on the next
  // checkup. The 30-minute wait is enforced in VetScene (LOLIPOP_COOLDOWN_MS).
  lolipop:  { label: 'Lolipop',      icon: '🍭', emoji: '🍭', color: 'bg-pink-400',    deltas: { happiness: 20, hunger: 10, energy: 10, sleep_quality: 10 },   cooldownMs: 1800000  },
}

// ─── /talk — the chat with Eren ───────────────────────────────────────────────
// Private per user (see supabase/migration_eren_chat.sql). `role` mirrors the
// Anthropic API's own vocabulary so rows replay into the model untouched.

export interface ErenChatMessage {
  id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

/** A fact Eren chose to keep, written by him through the `remember` tool. */
export interface ErenChatMemory {
  id: string
  user_id: string
  fact: string
  created_at: string
}

export const MOOD_CONFIGS: Record<UserMood, { label: string; emoji: string; color: string }> = {
  good:  { label: 'Good',  emoji: '😊', color: 'bg-green-100 text-green-700'  },
  mid:   { label: 'Mid',   emoji: '😐', color: 'bg-yellow-100 text-yellow-700'},
  sad:   { label: 'Sad',   emoji: '😔', color: 'bg-blue-100 text-blue-700'    },
  angry: { label: 'Angry', emoji: '😠', color: 'bg-red-100 text-red-700'      },
  tired: { label: 'Tired', emoji: '😴', color: 'bg-purple-100 text-purple-700'},
}
