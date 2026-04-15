import type { GachaItemDef, GachaBannerDef, GachaRarity, GachaCategory, OutfitSlot } from '@/types'

// ═══════════════════════════════════════════════════════════════════════════════
// GACHA SYSTEM — Eren's Capsule Machine
// ═══════════════════════════════════════════════════════════════════════════════

export const PULL_COST_SINGLE = 0   // TODO: restore to 50
export const PULL_COST_TEN    = 0   // TODO: restore to 450

export const PITY_EPIC      = 30   // guaranteed Epic+ every 30 pulls
export const PITY_LEGENDARY  = 100  // guaranteed Legendary every 100 pulls

export const DUPLICATE_STARDUST: Record<GachaRarity, number> = {
  common: 5, rare: 15, epic: 50, legendary: 200,
}

export const RARITY_WEIGHTS: Record<GachaRarity, number> = {
  common: 60, rare: 25, epic: 12, legendary: 3,
}

export const RARITY_COLORS: Record<GachaRarity, { bg: string; border: string; text: string; glow: string }> = {
  common:    { bg: '#E5E7EB', border: '#9CA3AF', text: '#6B7280', glow: 'rgba(156,163,175,0.4)' },
  rare:      { bg: '#BFDBFE', border: '#60A5FA', text: '#2563EB', glow: 'rgba(96,165,250,0.5)' },
  epic:      { bg: '#E9D5FF', border: '#A78BFA', text: '#7C3AED', glow: 'rgba(167,139,250,0.6)' },
  legendary: { bg: '#FEF3C7', border: '#F59E0B', text: '#B45309', glow: 'rgba(245,158,11,0.6)' },
}

// ─── All gacha items ─────────────────────────────────────────────────────────

export const GACHA_ITEMS: GachaItemDef[] = [
  // ── OUTFITS — slot: hat (above head), eyes (on face), neck (below chin) ──
  // Common — neck items
  { id: 'outfit_red_bowtie',     name: 'Red Bowtie',        category: 'outfit', rarity: 'common',    icon: '🎀', description: 'A classic red bowtie for a dapper cat.',     slot: 'neck', pos: { top: 48, left: 50, size: 24 } },
  { id: 'outfit_blue_scarf',     name: 'Blue Scarf',        category: 'outfit', rarity: 'common',    icon: '🧣', description: 'A cozy blue scarf.',                         slot: 'neck', pos: { top: 50, left: 50, size: 30 } },
  { id: 'outfit_green_bandana',  name: 'Green Bandana',     category: 'outfit', rarity: 'common',    icon: '🟩', description: 'A leafy green bandana.',                      slot: 'neck', pos: { top: 46, left: 50, size: 26 } },
  { id: 'outfit_pink_collar',    name: 'Pink Collar',       category: 'outfit', rarity: 'common',    icon: '💗', description: 'A cute pink collar with a bell.',              slot: 'neck', pos: { top: 50, left: 50, size: 22 } },
  { id: 'outfit_yellow_ribbon',  name: 'Yellow Ribbon',     category: 'outfit', rarity: 'common',    icon: '🎗️', description: 'A bright yellow ribbon on the ear.',           slot: 'hat',  pos: { top: 2, left: 68, size: 20 } },
  // Rare — hats + glasses
  { id: 'outfit_pirate_hat',     name: 'Pirate Hat',        category: 'outfit', rarity: 'rare',      icon: '🏴‍☠️', description: 'Ahoy! Captain Eren reporting.',               slot: 'hat',  pos: { top: -6, left: 50, size: 36 } },
  { id: 'outfit_chef_hat',       name: 'Chef Hat',          category: 'outfit', rarity: 'rare',      icon: '👨‍🍳', description: 'Master chef Eren, at your service.',           slot: 'hat',  pos: { top: -10, left: 50, size: 34 } },
  { id: 'outfit_sunglasses',     name: 'Cool Shades',       category: 'outfit', rarity: 'rare',      icon: '😎', description: 'Too cool for school.',                         slot: 'eyes', pos: { top: 30, left: 50, size: 32 } },
  { id: 'outfit_flower_crown',   name: 'Flower Crown',      category: 'outfit', rarity: 'rare',      icon: '🌸', description: 'A delicate crown of spring flowers.',           slot: 'hat',  pos: { top: -2, left: 50, size: 38 } },
  { id: 'outfit_detective_hat',  name: 'Detective Hat',     category: 'outfit', rarity: 'rare',      icon: '🕵️', description: 'Elementary, my dear hooman.',                  slot: 'hat',  pos: { top: -6, left: 50, size: 34 } },
  // Epic
  { id: 'outfit_wizard_hat',     name: 'Wizard Hat',        category: 'outfit', rarity: 'epic',      icon: '🧙', description: 'A mystical purple wizard hat with stars.',       slot: 'hat',  pos: { top: -14, left: 50, size: 40 } },
  { id: 'outfit_crown',          name: 'Royal Crown',       category: 'outfit', rarity: 'epic',      icon: '👑', description: 'For the king of the household.',                slot: 'hat',  pos: { top: -4, left: 50, size: 28 } },
  { id: 'outfit_astronaut',      name: 'Space Helmet',      category: 'outfit', rarity: 'epic',      icon: '🚀', description: 'One small step for cat, one giant leap.',       slot: 'hat',  pos: { top: -4, left: 50, size: 44 } },
  // Legendary
  { id: 'outfit_angel_wings',    name: 'Angel Wings',       category: 'outfit', rarity: 'legendary', icon: '😇', description: 'Heavenly wings that shimmer with light.',       slot: 'hat',  pos: { top: -8, left: 50, size: 36 } },
  { id: 'outfit_dragon',         name: 'Dragon Costume',    category: 'outfit', rarity: 'legendary', icon: '🐉', description: 'Eren transforms into a fierce (cute) dragon.', slot: 'hat',  pos: { top: -12, left: 50, size: 42 } },

  // ── DECORATIONS — roomPos: bottom%, left%, size in px ───────────
  // Common
  { id: 'deco_potted_plant',     name: 'Potted Plant',      category: 'decoration', rarity: 'common',    icon: '🪴', description: 'A simple green friend.',                    roomPos: { bottom: 8, left: 8, size: 32 } },
  { id: 'deco_small_rug',        name: 'Small Rug',         category: 'decoration', rarity: 'common',    icon: '🟫', description: 'A cozy little rug.',                         roomPos: { bottom: 4, left: 50, size: 30 } },
  { id: 'deco_wall_clock',       name: 'Wall Clock',        category: 'decoration', rarity: 'common',    icon: '🕐', description: 'Tick tock, time for treats!',                 roomPos: { bottom: 65, left: 12, size: 28 } },
  { id: 'deco_candle',           name: 'Candle',            category: 'decoration', rarity: 'common',    icon: '🕯️', description: 'Soft flickering light.',                     roomPos: { bottom: 10, left: 88, size: 26 } },
  { id: 'deco_book_stack',       name: 'Book Stack',        category: 'decoration', rarity: 'common',    icon: '📚', description: 'A pile of well-loved books.',                 roomPos: { bottom: 6, left: 18, size: 28 } },
  // Rare
  { id: 'deco_cat_tree',         name: 'Cat Tree',          category: 'decoration', rarity: 'rare',      icon: '🌳', description: 'Multi-level climbing paradise.',               roomPos: { bottom: 8, left: 85, size: 40 } },
  { id: 'deco_fish_tank',        name: 'Fish Tank',         category: 'decoration', rarity: 'rare',      icon: '🐟', description: 'Eren\'s personal TV channel.',                roomPos: { bottom: 45, left: 88, size: 34 } },
  { id: 'deco_fairy_lights',     name: 'Fairy Lights',      category: 'decoration', rarity: 'rare',      icon: '✨', description: 'Twinkling string lights.',                    roomPos: { bottom: 75, left: 50, size: 36 } },
  { id: 'deco_vinyl_player',     name: 'Vinyl Player',      category: 'decoration', rarity: 'rare',      icon: '🎵', description: 'Lo-fi beats for study and naps.',             roomPos: { bottom: 12, left: 80, size: 30 } },
  // Epic
  { id: 'deco_crystal_ball',     name: 'Crystal Ball',      category: 'decoration', rarity: 'epic',      icon: '🔮', description: 'A glowing mystic orb.',                       roomPos: { bottom: 10, left: 14, size: 32 } },
  { id: 'deco_neon_sign',        name: 'Neon Eren Sign',    category: 'decoration', rarity: 'epic',      icon: '💜', description: '"EREN" in glowing purple neon.',              roomPos: { bottom: 70, left: 80, size: 34 } },
  { id: 'deco_fountain',         name: 'Cat Fountain',      category: 'decoration', rarity: 'epic',      icon: '⛲', description: 'A luxurious water fountain.',                  roomPos: { bottom: 8, left: 75, size: 36 } },
  // Legendary
  { id: 'deco_pixel_arcade',     name: 'Pixel Arcade Machine', category: 'decoration', rarity: 'legendary', icon: '🕹️', description: 'A retro arcade cabinet with cat games.', roomPos: { bottom: 10, left: 10, size: 42 } },
  { id: 'deco_enchanted_tree',   name: 'Enchanted Tree',    category: 'decoration', rarity: 'legendary', icon: '🌲', description: 'A magical glowing tree with floating leaves.', roomPos: { bottom: 10, left: 90, size: 44 } },

  // ── BACKGROUNDS ────────────────────────────────────────────────
  // Common
  { id: 'bg_sunset',             name: 'Sunset Sky',        category: 'background', rarity: 'common',    icon: '🌅', description: 'Warm orange and pink hues.' },
  { id: 'bg_clouds',             name: 'Fluffy Clouds',     category: 'background', rarity: 'common',    icon: '☁️', description: 'Soft white clouds on blue.' },
  { id: 'bg_forest',             name: 'Forest Path',       category: 'background', rarity: 'common',    icon: '🌲', description: 'A serene forest walkway.' },
  // Rare
  { id: 'bg_beach',              name: 'Beach Day',         category: 'background', rarity: 'rare',      icon: '🏖️', description: 'Sandy shores and crystal water.' },
  { id: 'bg_rainy',              name: 'Rainy Window',      category: 'background', rarity: 'rare',      icon: '🌧️', description: 'Cozy rain drops on glass.' },
  { id: 'bg_sakura',             name: 'Cherry Blossoms',   category: 'background', rarity: 'rare',      icon: '🌸', description: 'Pink petals floating in spring air.' },
  // Epic
  { id: 'bg_northern_lights',    name: 'Northern Lights',   category: 'background', rarity: 'epic',      icon: '🌌', description: 'Dancing aurora in the night sky.' },
  { id: 'bg_underwater',         name: 'Underwater World',  category: 'background', rarity: 'epic',      icon: '🐙', description: 'Deep sea with glowing creatures.' },
  // Legendary
  { id: 'bg_space',              name: 'Cosmic Nebula',     category: 'background', rarity: 'legendary', icon: '🪐', description: 'A breathtaking purple-pink galaxy.' },

  // ── FOOD RECIPES ───────────────────────────────────────────────
  // Common
  { id: 'recipe_tuna_bowl',      name: 'Tuna Bowl',         category: 'recipe', rarity: 'common',    icon: '🐟', description: 'A hearty tuna meal. +30 hunger.' },
  { id: 'recipe_milk_bowl',      name: 'Warm Milk',         category: 'recipe', rarity: 'common',    icon: '🥛', description: 'A comforting warm milk. +10 sleep.' },
  { id: 'recipe_kibble_mix',     name: 'Kibble Mix',        category: 'recipe', rarity: 'common',    icon: '🥣', description: 'Nutritious kibble blend. +20 hunger.' },
  // Rare
  { id: 'recipe_sushi_platter',  name: 'Sushi Platter',     category: 'recipe', rarity: 'rare',      icon: '🍣', description: 'Fancy sushi! +30 hunger +15 happy.' },
  { id: 'recipe_golden_cream',   name: 'Golden Cream',      category: 'recipe', rarity: 'rare',      icon: '🍦', description: 'Luxurious cream. +20 happy.' },
  // Epic
  { id: 'recipe_royal_feast',    name: 'Royal Feast',       category: 'recipe', rarity: 'epic',      icon: '🍖', description: 'A feast fit for a king! +40 hunger +25 happy.' },
  // Legendary
  { id: 'recipe_ethereal_nectar', name: 'Ethereal Nectar',  category: 'recipe', rarity: 'legendary', icon: '✨', description: 'Restores all stats by 30.' },

  // ── EMOTES (Eren animations) ───────────────────────────────────
  // Common
  { id: 'emote_wave',            name: 'Wave',              category: 'emote', rarity: 'common',    icon: '👋', description: 'Eren waves his paw.' },
  { id: 'emote_nod',             name: 'Nod',               category: 'emote', rarity: 'common',    icon: '😊', description: 'Eren nods approvingly.' },
  { id: 'emote_yawn',            name: 'Big Yawn',          category: 'emote', rarity: 'common',    icon: '🥱', description: 'A big sleepy yawn.' },
  // Rare
  { id: 'emote_dance',           name: 'Happy Dance',       category: 'emote', rarity: 'rare',      icon: '💃', description: 'Eren does a little dance!' },
  { id: 'emote_spin',            name: 'Spin',              category: 'emote', rarity: 'rare',      icon: '🔄', description: 'A playful full spin.' },
  { id: 'emote_hearts',          name: 'Love Hearts',       category: 'emote', rarity: 'rare',      icon: '💕', description: 'Hearts float around Eren.' },
  // Epic
  { id: 'emote_fireworks',       name: 'Fireworks',         category: 'emote', rarity: 'epic',      icon: '🎆', description: 'Fireworks burst behind Eren!' },
  { id: 'emote_rainbow',         name: 'Rainbow Trail',     category: 'emote', rarity: 'epic',      icon: '🌈', description: 'A rainbow follows Eren.' },
  // Legendary
  { id: 'emote_golden_aura',     name: 'Golden Aura',       category: 'emote', rarity: 'legendary', icon: '⭐', description: 'Eren glows with a divine golden aura.' },

  // ── PHOTO FRAMES ───────────────────────────────────────────────
  // Common
  { id: 'frame_simple_white',    name: 'White Frame',       category: 'frame', rarity: 'common',    icon: '🖼️', description: 'A clean white border.' },
  { id: 'frame_wooden',          name: 'Wooden Frame',      category: 'frame', rarity: 'common',    icon: '🪵', description: 'Rustic wooden border.' },
  // Rare
  { id: 'frame_pixel',           name: 'Pixel Frame',       category: 'frame', rarity: 'rare',      icon: '👾', description: 'Retro pixel art border.' },
  { id: 'frame_hearts',          name: 'Hearts Frame',      category: 'frame', rarity: 'rare',      icon: '💕', description: 'Surrounded by tiny hearts.' },
  { id: 'frame_sakura',          name: 'Sakura Frame',      category: 'frame', rarity: 'rare',      icon: '🌸', description: 'Cherry blossom petals border.' },
  // Epic
  { id: 'frame_golden',          name: 'Golden Frame',      category: 'frame', rarity: 'epic',      icon: '🏆', description: 'An ornate golden border.' },
  // Legendary
  { id: 'frame_enchanted',       name: 'Enchanted Frame',   category: 'frame', rarity: 'legendary', icon: '🪄', description: 'A shimmering, animated magical border.' },

  // ── CONSUMABLES — limited-use foods & drinks with special buffs ─
  // Common
  { id: 'cons_milk_tea',         name: 'Milk Tea',          category: 'consumable', rarity: 'common',    icon: '🧋', description: '+10 happiness. A warm treat.',                    buff: { stat: 'happiness', amount: 10 } },
  { id: 'cons_cookie',           name: 'Fish Cookie',       category: 'consumable', rarity: 'common',    icon: '🍪', description: '+10 hunger. Crunchy fish-shaped cookie.',          buff: { stat: 'hunger', amount: 10 } },
  { id: 'cons_catnip_pouch',     name: 'Catnip Pouch',      category: 'consumable', rarity: 'common',    icon: '🌿', description: '+15 energy. A little burst of energy!',            buff: { stat: 'energy', amount: 15 } },
  { id: 'cons_warm_milk',        name: 'Warm Milk',         category: 'consumable', rarity: 'common',    icon: '🥛', description: '+10 sleep quality. Cozy and warm.',                buff: { stat: 'sleep_quality', amount: 10 } },
  // Rare
  { id: 'cons_sushi_roll',       name: 'Premium Sushi Roll', category: 'consumable', rarity: 'rare',     icon: '🍣', description: '+20 hunger +10 happiness. Fancy!',                buff: { stat: 'hunger', amount: 20 } },
  { id: 'cons_golden_milk',      name: 'Golden Milk',       category: 'consumable', rarity: 'rare',      icon: '✨', description: '+20 sleep quality. Warm golden goodness.',         buff: { stat: 'sleep_quality', amount: 20 } },
  { id: 'cons_energy_drink',     name: 'Cat Energy Drink',  category: 'consumable', rarity: 'rare',      icon: '⚡', description: '+25 energy. ZOOM!',                              buff: { stat: 'energy', amount: 25 } },
  { id: 'cons_bubble_bath',      name: 'Luxury Bubble Bath', category: 'consumable', rarity: 'rare',     icon: '🫧', description: '+25 cleanliness. Spa day!',                      buff: { stat: 'cleanliness', amount: 25 } },
  { id: 'cons_love_potion',      name: 'Love Potion',       category: 'consumable', rarity: 'rare',      icon: '💕', description: '+25 happiness. Eren feels so loved!',             buff: { stat: 'happiness', amount: 25 } },
  // Epic
  { id: 'cons_royal_feast',      name: 'Royal Feast',       category: 'consumable', rarity: 'epic',      icon: '🍖', description: '+40 hunger +20 happiness. Fit for a king!',       buff: { stat: 'hunger', amount: 40 } },
  { id: 'cons_aurora_juice',     name: 'Aurora Juice',      category: 'consumable', rarity: 'epic',      icon: '🌌', description: '+30 energy +15 happiness. Northern lights in a cup.', buff: { stat: 'energy', amount: 30 } },
  { id: 'cons_zen_incense',      name: 'Zen Incense',       category: 'consumable', rarity: 'epic',      icon: '🧘', description: '+30 sleep +20 happiness. Deep calm.',              buff: { stat: 'sleep_quality', amount: 30 } },
  // Legendary
  { id: 'cons_ethereal_nectar',  name: 'Ethereal Nectar',   category: 'consumable', rarity: 'legendary', icon: '🌟', description: 'ALL stats +25. Liquid starlight.',                buff: { stat: 'all', amount: 25 } },
  { id: 'cons_phoenix_feather',  name: 'Phoenix Feather',   category: 'consumable', rarity: 'legendary', icon: '🔥', description: 'Fully restores ALL stats to 100. Miraculous.',    buff: { stat: 'all', amount: 100 } },
]

// ─── Banners ─────────────────────────────────────────────────────────────────

export const GACHA_BANNERS: GachaBannerDef[] = [
  {
    id: 'standard',
    name: "Eren's Capsule Machine",
    description: 'The classic capsule machine with all items available.',
    icon: '🎰',
    featuredItems: [],
    permanent: true,
    bgGradient: ['#7C3AED', '#A78BFA'],
  },
  {
    id: 'fashion',
    name: 'Fashion Week',
    description: 'Boosted outfit drop rates! Dress up Eren in style.',
    icon: '👗',
    featuredItems: ['outfit_wizard_hat', 'outfit_crown', 'outfit_angel_wings', 'outfit_flower_crown'],
    permanent: true,
    bgGradient: ['#EC4899', '#F472B6'],
  },
  {
    id: 'cozy_home',
    name: 'Cozy Home',
    description: 'Boosted decoration & background drops. Make Eren\'s home beautiful.',
    icon: '🏠',
    featuredItems: ['deco_fairy_lights', 'deco_neon_sign', 'bg_rainy', 'bg_northern_lights'],
    permanent: true,
    bgGradient: ['#F59E0B', '#FBBF24'],
  },
]

// ─── Pull mechanics ──────────────────────────────────────────────────────────

export function rollRarity(pullsSinceEpic: number, pullsSinceLegendary: number): GachaRarity {
  // Pity overrides
  if (pullsSinceLegendary >= PITY_LEGENDARY - 1) return 'legendary'
  if (pullsSinceEpic >= PITY_EPIC - 1) return 'epic'

  // Weighted random
  const total = RARITY_WEIGHTS.common + RARITY_WEIGHTS.rare + RARITY_WEIGHTS.epic + RARITY_WEIGHTS.legendary
  const roll = Math.random() * total
  if (roll < RARITY_WEIGHTS.legendary) return 'legendary'
  if (roll < RARITY_WEIGHTS.legendary + RARITY_WEIGHTS.epic) return 'epic'
  if (roll < RARITY_WEIGHTS.legendary + RARITY_WEIGHTS.epic + RARITY_WEIGHTS.rare) return 'rare'
  return 'common'
}

export function rollItem(rarity: GachaRarity, bannerId: string): GachaItemDef {
  const banner = GACHA_BANNERS.find(b => b.id === bannerId)
  const pool = GACHA_ITEMS.filter(i => i.rarity === rarity)
  if (pool.length === 0) return GACHA_ITEMS[0] // fallback

  // Banner featured items have 50% chance if applicable
  if (banner && banner.featuredItems.length > 0 && Math.random() < 0.5) {
    const featured = pool.filter(i => banner.featuredItems.includes(i.id))
    if (featured.length > 0) return featured[Math.floor(Math.random() * featured.length)]
  }

  return pool[Math.floor(Math.random() * pool.length)]
}

export function getItemById(id: string): GachaItemDef | undefined {
  return GACHA_ITEMS.find(i => i.id === id)
}

export function getItemsByCategory(category: GachaCategory): GachaItemDef[] {
  return GACHA_ITEMS.filter(i => i.category === category)
}

export function getCategoryLabel(cat: GachaCategory): string {
  return { outfit: 'Outfits', decoration: 'Decorations', background: 'Backgrounds', recipe: 'Recipes', emote: 'Emotes', frame: 'Frames', consumable: 'Items' }[cat]
}

export const CATEGORY_ICONS: Record<GachaCategory, string> = {
  outfit: '👔', decoration: '🪴', background: '🖼️', recipe: '🍳', emote: '💫', frame: '🖼️', consumable: '🧪',
}
