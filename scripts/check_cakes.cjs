// Run with: node scripts/check_cakes.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '..')
const cache = new Map()
const mocks = {
  '@/hooks/useCat': { useCat: () => ({ t: text => text.replace('{name}', 'Eren') }) },
  '@/lib/sounds': { playSound: () => {} },
  '@/components/meadow': {
    M: { soft: '#f4f2ef', text: '#302c29', text2: '#716c66', danger: '#C0453A' },
    TYPE: { number: { fontWeight: 800 } },
    MeadowIcon: () => React.createElement('span', { 'aria-hidden': true }),
    Sheet: ({ open, children }) => open ? React.createElement('div', { role: 'dialog' }, children) : null,
  },
}
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const module = { exports: {} }
  cache.set(file, module)
  const localRequire = id => {
    if (mocks[id]) return mocks[id]
    if (!id.startsWith('.') && !id.startsWith('@/')) return require(id)
    const base = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : path.resolve(path.dirname(file), id)
    const target = ['.ts', '.tsx'].map(ext => base + ext).find(candidate => fs.existsSync(candidate))
    assert.ok(target, id)
    return load(target)
  }
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  })
  new Function('require', 'module', 'exports', outputText)(localRequire, module, module.exports)
  return module.exports
}
const { CAKES, getCake, getCakeByFoodId, cakeArt } = load(path.join(root, 'src/lib/cakes.ts'))
const { purchaseCakeFood } = load(path.join(root, 'src/lib/cakePurchase.ts'))
const { foodArt } = load(path.join(root, 'src/lib/foodMeta.ts'))
const { default: CakeSprite } = load(path.join(root, 'src/components/bakery/CakeSprite.tsx'))
const { default: CakeMenuSheet } = load(path.join(root, 'src/components/bakery/CakeMenuSheet.tsx'))
const originalPrices = { strawberry: 60, chocolate: 90, vanilla: 50, matcha: 110, blueberry: 95, macaron: 140, tiramisu: 170, royal: 250 }
assert.equal(CAKES.length, 12)
assert.equal(new Set(CAKES.map(cake => cake.id)).size, CAKES.length)
assert.equal(new Set(CAKES.map(cake => cake.name)).size, CAKES.length)
assert.equal(new Set(CAKES.map(cake => cake.foodId)).size, CAKES.length)
assert.deepEqual(CAKES.slice(0, 8).map(cake => cake.id), Object.keys(originalPrices))
for (const [id, price] of Object.entries(originalPrices)) assert.equal(getCake(id).price, price)
for (const id of ['honey_hive', 'moonbeam', 'moss_cottage', 'lily_pond']) assert.ok(getCake(id))
assert.equal(getCake('unknown'), undefined)
const digests = new Set()
for (const cake of CAKES) {
  assert.match(cake.id, /^[a-z_]+$/)
  assert.equal(getCakeByFoodId(cake.foodId),cake)
  assert.equal(cake.foodId,'cake_'+cake.id)
  assert.equal(foodArt(cake.foodId),cakeArt(cake.id))
  assert.ok(cake.hungerD>0&&cake.happyD>0&&cake.weightD>0)
  assert.ok(Number.isSafeInteger(cake.price) && cake.price > 0)
  assert.ok(cake.blurb.length <= 36, cake.id)
  assert.equal(cakeArt(cake.id), '/cakes/' + cake.id + '.png?v=1')
  const png = fs.readFileSync(path.join(root, 'public/cakes', cake.id + '.png'))
  assert.equal(png.subarray(1, 4).toString(), 'PNG')
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [128, 128])
  digests.add(require('node:crypto').createHash('sha256').update(png).digest('hex'))
  for (const size of [80, 96]) {
    const html = renderToStaticMarkup(React.createElement(CakeSprite, { cake, size }))
    assert.ok(html.includes('src="' + cakeArt(cake.id) + '"'))
    assert.ok(html.includes('width="' + size + '"') && html.includes('height="' + size + '"'))
    assert.ok(html.includes('alt=""') && html.includes('draggable="false"'))
    assert.ok(!html.includes('<svg'), cake.id)
  }
}
assert.equal(digests.size, CAKES.length, 'Every pastry needs distinct artwork')
const menu = (coins, busy = false, open = true) => renderToStaticMarkup(React.createElement(CakeMenuSheet, {
  open, coins, busy, onBuy: () => {}, onClose: () => {},
}))
assert.equal(menu(100000, false, false), '')
assert.equal(foodArt('cake'),'/food/cake.png?v=6','The kitchen cake slice must retain its identity')
const failedMenu=renderToStaticMarkup(React.createElement(CakeMenuSheet,{
  open:true,coins:1000,busy:false,error:'Please try again.',onBuy:()=>{},onClose:()=>{},
}))
assert.ok(failedMenu.includes('role="alert"')&&failedMenu.includes('Please try again.'))
for (const [coins, busy] of [[0, false], [80, false], [100000, false], [100000, true]]) {
  const html = menu(coins, busy)
  assert.equal((html.match(/<button /g) ?? []).length, 12)
  assert.equal((html.match(/ disabled=""/g) ?? []).length, CAKES.filter(cake => busy || coins < cake.price).length)
  for (const cake of CAKES) assert.ok(html.includes('src="' + cakeArt(cake.id) + '"'))
}
const page = fs.readFileSync(path.join(root, 'src/app/(app)/bakery/page.tsx'), 'utf8')
assert.ok(page.includes('<CakeSprite cake={fx.sold.cake} size={80} />'), 'Purchase fly-up must use the same real artwork')
async function checkoutChecks() {
  for (const cake of CAKES) for (const failure of ['none','stock','payment']) {
    let coins=1000, quantity=2
    const events=[]
    const ok=await purchaseCakeFood(cake,{
      addFood:async key=>{assert.equal(key,cake.foodId);quantity++;events.push('stock');return failure!=='stock'},
      spendCoins:async amount=>{assert.equal(amount,cake.price);events.push('pay');if(failure==='payment')return false;coins-=amount;return true},
      removeFood:async key=>{assert.equal(key,cake.foodId);quantity--;events.push('rollback');return true},
    })
    assert.equal(ok,failure==='none')
    assert.equal(quantity,failure==='none'?3:2,'Failure must retain exactly the previous stock')
    assert.equal(coins,failure==='none'?1000-cake.price:1000,'Failure must not cost coins')
    assert.deepEqual(events,failure==='stock'?['stock','rollback']:failure==='payment'?['stock','pay','rollback']:['stock','pay'])
  }
  console.log('Cake checks passed: 12 edible pastries, eight original prices, four new designs, shared artwork, affordable/busy states and 36 success/failure stock/payment checks.')
}
checkoutChecks().catch(error=>{console.error(error);process.exitCode=1})
