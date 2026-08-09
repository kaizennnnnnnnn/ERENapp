import type { FoodKey } from '@/types'

// ─── Food display metadata ───────────────────────────────────────────────────
// Name + swatch colour for every food key, shared by the couple surfaces that
// show a food without the full shop card: the ThoughtCloud gift picker and the
// ErenMessagePopup gift receipt. It lived as a copy-pasted literal in BOTH,
// which silently drifted the moment the shop gained the world dishes — the
// Record<FoodKey, …> type caught it, and one source of truth stops the next one.
//
// Colours mirror each item's `color` in SHOP_ITEMS (FeedScene). The shop itself
// keeps its own richer table (price / stats / category / art), so this is
// deliberately just the two fields the couple surfaces render.

export const FOOD_META: Record<FoodKey, { name: string; color: string }> = {
  kibble:     { name: 'Kibble',       color: '#D4A44A' },
  fish:       { name: 'Fish',         color: '#5BA3D9' },
  treat:      { name: 'Cat Treat',    color: '#FF6B9D' },
  tuna:       { name: 'Tuna Can',     color: '#E8A020' },
  steak:      { name: 'Steak',        color: '#CC3333' },
  cream:      { name: 'Cream',        color: '#A78BFA' },
  biscuit:    { name: 'Biscuit',      color: '#C8956A' },
  shrimp:     { name: 'Shrimp',       color: '#F0836A' },
  salmon:     { name: 'Salmon',       color: '#E8735A' },
  chicken:    { name: 'Chicken',      color: '#E8B44A' },
  sausage:    { name: 'Sausage',      color: '#A0522D' },
  milk:       { name: 'Milk',         color: '#E8E4E0' },
  cheese:     { name: 'Cheese',       color: '#F5C842' },
  yogurt:     { name: 'Yogurt',       color: '#FFB6C1' },
  cake:       { name: 'Cake',         color: '#FF85A2' },
  sushi:      { name: 'Sushi',        color: '#2D9B6A' },
  sardine:    { name: 'Sardine',      color: '#7BAFC8' },
  egg:        { name: 'Egg',          color: '#F5E6C8' },
  donut:      { name: 'Donut',        color: '#FF8FB0' },
  cookie:     { name: 'Cookie',       color: '#C89A6B' },
  jelly_caka: { name: 'Jelly Caka',   color: '#E83A4A' },
  // World dishes
  pizza:         { name: 'Pizza',         color: '#E4703A' },
  carbonara:     { name: 'Carbonara',     color: '#EFC663' },
  lasagna:       { name: 'Lasagna',       color: '#D9793F' },
  risotto:       { name: 'Risotto',       color: '#E8C765' },
  nigiri:        { name: 'Nigiri',        color: '#F0736F' },
  temaki:        { name: 'Temaki',        color: '#3C6E52' },
  maki:          { name: 'Maki Roll',     color: '#2F3B33' },
  ramen:         { name: 'Ramen',         color: '#C8632E' },
  pad_thai:      { name: 'Pad Thai',      color: '#E08A3C' },
  gyoza:         { name: 'Gyoza',         color: '#E7D2A6' },
  xiaolongbao:   { name: 'Soup Buns',     color: '#D9BE8E' },
  cevapi:        { name: 'Ćevapi',        color: '#A9663C' },
  sarma:         { name: 'Sarma',         color: '#7E9B4E' },
  doner:         { name: 'Döner',         color: '#D2A15C' },
  tacos:         { name: 'Tacos',         color: '#E0A93F' },
  wrap:          { name: 'Wrap',          color: '#DDBE84' },
  paella:        { name: 'Paella',        color: '#DE9A3E' },
  stew:          { name: 'Stew',          color: '#8E5A2E' },
  meatballs:     { name: 'Meatballs',     color: '#C4452F' },
  roast_chicken: { name: 'Roast Chicken', color: '#D8973C' },
  monsta_original: { name: 'Original Monsta', color: '#A6E728' },
  monsta_white:    { name: 'White Monsta',    color: '#2FBCB3' },
  monsta_mango:    { name: 'Mango Monsta',    color: '#F9A300' },
  monsta_loco:     { name: 'Loco Monsta',     color: '#69C7EB' },
  monsta_pipeline: { name: 'Pipeline Monsta', color: '#F96679' },
  monsta_punch:    { name: 'Punch Monsta',    color: '#E9665C' },
  monsta_rosa:     { name: 'Rosa Monsta',     color: '#D05C8D' },
  monsta_peachy:   { name: 'Peachy Monsta',   color: '#F9AB94' },
  // Violet, not the old green — Original Monsta now owns the can-green, and
  // the rainbow's colour is carried by its animated gradient anyway.
  monsta_rainbow:  { name: 'Rainbow Monsta',  color: '#B65CF0' },
  // Sampled off the can art's dominant body tone, so the swatch and the
  // sprite are the same gold rather than two guesses at one.
  monsta_gold:     { name: 'Gold Monsta',     color: '#D89C24' },
}

// Display order for food pickers — staples first (the everyday cat food), then
// the world dishes grouped by cuisine, matching the shop's category order.
export const FOOD_ORDER: FoodKey[] = [
  'kibble', 'fish', 'treat', 'tuna', 'steak', 'cream', 'biscuit', 'shrimp',
  'salmon', 'chicken', 'sausage', 'milk', 'cheese', 'yogurt', 'cake', 'sushi',
  'sardine', 'egg', 'donut', 'cookie', 'jelly_caka',
  'pizza', 'carbonara', 'lasagna', 'risotto',
  'nigiri', 'temaki', 'maki',
  'ramen', 'pad_thai', 'gyoza', 'xiaolongbao',
  'cevapi', 'sarma', 'doner',
  'tacos', 'wrap', 'paella', 'stew', 'meatballs', 'roast_chicken',
  'monsta_original', 'monsta_white', 'monsta_mango', 'monsta_loco',
  'monsta_pipeline', 'monsta_punch', 'monsta_rosa', 'monsta_peachy',
  'monsta_rainbow', 'monsta_gold',
]

/**
 * URL for a plate/can PNG in public/food.
 *
 * The ?v= is a cache-buster: the service worker serves images
 * stale-while-revalidate, so replacing a file at the same path needs the query
 * bumped or the old art keeps showing. Both the kitchen's FoodIcon and the
 * gacha's item art resolve through here — same string, so the two share one
 * cache entry instead of fetching identical bytes under two URLs, and the
 * version can't drift between them.
 */
export const foodArt = (id: string): string => `/food/${id}.png?v=2`
