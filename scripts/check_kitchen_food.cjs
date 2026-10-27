// Run with: node scripts/check_kitchen_food.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '..')
const cache = new Map()

function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const module = { exports: {} }
  cache.set(file, module)
  const localRequire = id => {
    if (!id.startsWith('.') && !id.startsWith('@/')) return require(id)
    const base = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : path.resolve(path.dirname(file), id)
    return load(['.ts','.tsx'].map(ext=>base+ext).find(candidate=>fs.existsSync(candidate)))
  }
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  })
  new Function('require','module','exports',outputText)(localRequire,module,module.exports)
  return module.exports
}

const meta = load(path.join(root,'src/lib/foodMeta.ts'))
const donuts = load(path.join(root,'src/lib/donuts.ts'))
const menu = load(path.join(root,'src/lib/foodMenu.ts'))
const { default: FoodIcon } = load(path.join(root,'src/components/care/FoodIcon.tsx'))
const file = path.join(root,'src/components/care/FeedScene.tsx')
const source = ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
// Execute the real catalogue declarations without mounting the room or mocking its hooks.
const names = new Set(['MONSTA_PRICE','SHOP_ITEMS','ALL_DONUT_IDS','KITCHEN_SHELF','SHELF_ITEMS'])
const declarations = source.statements.filter(node=>ts.isVariableStatement(node)
  && node.declarationList.declarations.some(decl=>ts.isIdentifier(decl.name)&&names.has(decl.name.text)))
assert.equal(declarations.length,names.size)
const { outputText } = ts.transpileModule(declarations.map(node=>node.getText(source)).join('\n'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
})
const catalogue = new Function('DONUTS','KITCHEN_DONUTS','FOOD_META','RETIRED_SHOP_FOODS',
  outputText+'\nreturn {SHOP_ITEMS,SHELF_ITEMS}')(
  donuts.DONUTS,donuts.KITCHEN_DONUTS,meta.FOOD_META,meta.RETIRED_SHOP_FOODS)
const { SHOP_ITEMS, SHELF_ITEMS } = catalogue
assert.equal(new Set(SHOP_ITEMS.map(item=>item.id)).size,SHOP_ITEMS.length,'No duplicate inventory entries')
assert.equal(new Set(SHELF_ITEMS.map(item=>item.id)).size,SHELF_ITEMS.length,'No duplicate shop entries')
assert.deepEqual(new Set(SHOP_ITEMS.map(item=>item.id)),new Set(Object.keys(meta.FOOD_META)))
assert.equal(SHELF_ITEMS.length,50)
assert.equal(SHELF_ITEMS.filter(item=>item.cat==='seafood').length,4)
assert.equal(SHELF_ITEMS.filter(item=>item.cat==='sushi').length,3)
assert.deepEqual(SHELF_ITEMS.filter(item=>item.id.startsWith('donut')).map(item=>item.id),donuts.KITCHEN_DONUTS.map(item=>item.id))

for (const [legacy,replacement] of Object.entries(meta.RETIRED_SHOP_FOODS)) {
  assert.ok(!SHELF_ITEMS.some(item=>item.id===legacy),'Retired duplicates cannot be bought')
  assert.ok(SHOP_ITEMS.some(item=>item.id===legacy),'Existing fridge stock must remain usable')
  assert.ok(SHELF_ITEMS.some(item=>item.id===replacement))
  assert.equal(meta.foodArt(legacy),meta.foodArt(replacement))
  assert.ok(meta.FOOD_ORDER.includes(legacy),'Gifted legacy stock must remain accessible')
  assert.ok(!menu.MENU_POOL.includes(legacy),'Daily menus cannot request retired shop items')
}
for (const id of ['chicken','roast_chicken','biscuit','cookie']) assert.ok(SHELF_ITEMS.some(item=>item.id===id),'Distinct foods stay on sale')
for (const item of SHELF_ITEMS) assert.ok(item.price>0&&item.hungerD>0&&item.weightD>0)
assert.equal(menu.MENU_POOL.length,40)
assert.equal(new Set(menu.MENU_POOL).size,menu.MENU_POOL.length)
assert.ok(menu.MENU_POOL.every(id=>SHELF_ITEMS.some(item=>item.id===id)))
for (let day=1;day<=28;day++) for (const household of [null,'one','two']) {
  const key=`2026-10-${String(day).padStart(2,'0')}`
  const roll=menu.dailyMenu(key,household)
  assert.deepEqual(roll,menu.dailyMenu(key,household))
  assert.equal(new Set(roll).size,3)
  assert.ok(roll.every(id=>!meta.RETIRED_SHOP_FOODS[id]&&menu.MENU_POOL.includes(id)))
}

for (const id of Object.keys(meta.FOOD_META)) {
  const asset = fs.readFileSync(path.join(root,'public',meta.foodArt(id).split('?')[0]))
  assert.equal(asset.subarray(1,4).toString(),'PNG')
  assert.ok(asset.readUInt32BE(16)>0&&asset.readUInt32BE(20)>0)
  const html=renderToStaticMarkup(React.createElement(FoodIcon,{id,size:62}))
  assert.ok(html.includes(`src="${meta.foodArt(id)}"`),`${id}: missing catalogue picture`)
  assert.ok(!html.includes('<svg'),`${id}: old block icon still renders`)
  if (id==='monsta_rainbow') assert.ok(html.includes('canfx-sparkle'))
  if (id==='monsta_gold') assert.ok(html.includes('canfx-ray'))
}
const refreshed = [
  'treat','sausage','cream','milk','cheese','yogurt','cookie',
  'steak','carbonara','risotto','gyoza','cevapi','sarma','meatballs','roast_chicken',
  'ramen','pad_thai','paella','stew','xiaolongbao',
]
for (const id of refreshed) {
  const png=fs.readFileSync(path.join(root,'public/food',id+'.png'))
  assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[128,128])
  assert.ok(meta.foodArt(id).endsWith('?v=6'),'Updated sprites must invalidate stale image caches')
}
assert.ok(renderToStaticMarkup(React.createElement(FoodIcon,{id:'unknown'})).includes('<svg'))
console.log(`Kitchen food checks passed: ${SHOP_ITEMS.length} pictured inventory foods, 50 unique shop foods, ${refreshed.length} normalized refreshed assets, retired-stock compatibility, daily menus and special-can effects.`)
