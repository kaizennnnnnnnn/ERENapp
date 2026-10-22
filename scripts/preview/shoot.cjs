// ─── Preview screenshots without logging in ──────────────────────────────────
// Usage: node scripts/preview/shoot.cjs [runName,runName...]
//
// Opens a throwaway preview route (see docs/MEADOW.md, "Screenshots without
// logging in") on a dev server at :3100 with a FAKE session, and answers every
// Supabase and /api request locally from MOCK_ROWS, so nothing reaches the
// real project. Saves <shot>_<width>.png into review-pictures/ at 390x844 and
// 360x740 (2x).
//
// To use it for a screen: point PREVIEW_PATH at your preview route, put the
// rows your screen reads into MOCK_ROWS (table name -> rows), and describe
// the states to capture in RUNS. A step can click a button (by its text or
// aria-label), type into an input, wait, and save a viewport or full-page shot.

const path = require('path')
const puppeteer = require('puppeteer-core')

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = 'http://localhost:3100'
const PREVIEW_PATH = '/bucketpreview'          // your preview route
const OUT = path.join(__dirname, '..', '..', 'review-pictures')
const SIZES = [[390, 844], [360, 740]]

const REF = 'bjnnqqxjjihmsbljeayf'
const HOST = `${REF}.supabase.co`
const ME = '11111111-1111-4111-8111-111111111111'
const PARTNER_ID = '22222222-2222-4222-8222-222222222222'
const HH = '33333333-3333-4333-8333-333333333333'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const ME_ROW = {
  id: ME, household_id: HH, name: 'Jovan', heart: 'brown_heart', level: 5, xp: 1000, coins: 500, claimed_level: 0,
  memory_caught_up: true, terms_accepted_at: '2026-01-01T00:00:00Z',
  streak: { current: 3, longest: 5, lastDate: null, freezeTokens: 1 }, achievements: {},
}
const PARTNER_ROW = { id: PARTNER_ID, household_id: HH, name: 'Ana Petrovic', heart: 'pink_heart', streak: null }
const STATS = {
  id: 'stats', household_id: HH, hunger: 80, happiness: 80, energy: 80, cleanliness: 80, health: 90, weight: 4.2,
  mood: 'idle', is_sleeping: false, is_sick: false, last_decay_at: new Date().toISOString(),
  food_inventory: {}, food_by_user: {}, room_skins: {}, donuts_tasted: [],
  cat_name: 'Eren', cat_sex: 'male', cat_look: null, last_notified_at: {},
}

// Table -> rows returned for any GET on it. Tables not listed return [].
const MOCK_ROWS = {
  eren_stats: [STATS],
  // Today's mood, or home opens on the mood gate.
  daily_moods: [{ user_id: ME, household_id: HH, mood: 'good', date: today() }],
  user_gacha_state: [{ stardust: 120, gacha_tickets: 2 }],
  // bucket_list: [ ... ],
}

// Named runs. Run only some with: node scripts/preview/shoot.cjs list,add
const RUNS = {
  list: { query: '', do: [{ shot: 'preview_list' }, { full: 'preview_list_full' }] },
  // add: { do: [{ click: 'text=Add a plan' }, { type: ['#plan-title', 'Swim with dolphins'], shot: 'preview_add' }] },
  // solo: { solo: true, do: [{ shot: 'preview_solo' }] },
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')

async function shoot(browser, w, h, name, run) {
  const exp = Math.floor(Date.now() / 1000) + 86400
  const user = { id: ME, aud: 'authenticated', role: 'authenticated', email: 'me@example.com', app_metadata: {}, user_metadata: {}, created_at: '2025-01-01T00:00:00Z' }
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: ME, exp, role: 'authenticated', aud: 'authenticated' })}.c2ln`
  const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user }

  const ctx = await browser.createBrowserContext()
  const p = await ctx.newPage()
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2 })
  const errs = []
  p.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 200)))
  const cdp = await p.createCDPSession()
  await cdp.send('Network.enable')
  await cdp.send('Network.setBlockedURLs', { urls: [`*${HOST}/realtime*`, `wss://${HOST}/*`] })
  const writes = []

  await p.setRequestInterception(true)
  p.on('request', req => {
    const u = new URL(req.url())
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    const json = (body, status = 200) => req.respond({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(body) })
    if (u.host === HOST) {
      if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: cors })
      if (u.pathname === '/auth/v1/user') return json(user)
      if (u.pathname.startsWith('/auth/')) return json({})
      const table = u.pathname.replace('/rest/v1/', '')
      const q = decodeURIComponent(u.search)
      // .single() / .maybeSingle() ask for one object.
      const wantsObject = (req.headers()['accept'] || '').includes('vnd.pgrst.object')
      const reply = rows => wantsObject ? json(rows[0] ?? null, rows.length ? 200 : 406) : json(rows)
      if (req.method() === 'GET' || req.method() === 'HEAD') {
        if (table === 'profiles') {
          if (q.includes(`id=eq.${ME}`)) return reply([ME_ROW])
          if (q.includes('neq.')) return json(run.solo ? [] : [PARTNER_ROW])
          if (q.includes('household_id=eq.')) return json(run.solo ? [ME_ROW] : [ME_ROW, PARTNER_ROW])
          return json([])
        }
        return reply(MOCK_ROWS[table] ?? [])
      }
      let body = null
      try { body = JSON.parse(req.postData() || 'null') } catch { body = req.postData() }
      writes.push({ m: req.method(), table, body })
      // Inserts/updates that ask for the row back get what they sent.
      if (q.includes('select=')) return reply([{ id: 'mock-' + writes.length, ...(Array.isArray(body) ? body[0] : body) }])
      return req.respond({ status: req.method() === 'POST' ? 201 : 204, headers: cors, body: '' })
    }
    // App API routes (push, decay, reminders) never run for real from a preview.
    if (u.host === 'localhost:3100' && u.pathname.startsWith('/api/')) { writes.push({ api: u.pathname }); return json({ ok: true }) }
    if (!['localhost:3100', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(u.host)) return req.abort()
    return req.continue()
  })

  await p.evaluateOnNewDocument(() => { Math.random = () => 0.1 })   // steady picks between runs
  await p.setCookie({ name: `sb-${REF}-auth-token`, value: JSON.stringify(session), domain: 'localhost', path: '/' })
  await p.goto(`${BASE}${PREVIEW_PATH}${run.query ?? ''}`, { waitUntil: 'networkidle2', timeout: 240000 })
  // Drop the splash screen.
  for (let i = 0; i < 6; i++) { await p.evaluate(() => window.dispatchEvent(new Event('eren:app-ready'))); await sleep(500) }
  await sleep(run.settle ?? 1500)

  for (const s of run.do || []) {
    if (s.click) {
      const ok = await p.evaluate(sel => {
        const [kind, text] = sel.split('=')
        const els = [...document.querySelectorAll('button, a')]
        const el = kind === 'text'
          ? els.find(e => e.textContent.trim().startsWith(text))
          : els.find(e => (e.getAttribute('aria-label') || '').startsWith(text))
        if (el) el.click()
        return !!el
      }, s.click)
      if (!ok) errs.push('NOCLICK ' + s.click)
    }
    if (s.type) { await p.focus(s.type[0]); await p.keyboard.type(s.type[1]) }
    await sleep(s.wait ?? 700)
    if (s.shot) await p.screenshot({ path: path.join(OUT, `${s.shot}_${w}.png`) })
    if (s.full) await p.screenshot({ path: path.join(OUT, `${s.full}_${w}.png`), fullPage: true })
  }

  const overflowX = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  console.log(`${w} ${name}: sideways overflow ${overflowX}px; writes ${JSON.stringify(writes).slice(0, 400)}`, errs)
  await ctx.close()
}

;(async () => {
  const only = process.argv[2]?.split(',')
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
  for (const [w, h] of SIZES) {
    for (const [name, run] of Object.entries(RUNS)) {
      if (only && !only.includes(name)) continue
      await shoot(browser, w, h, name, run)
    }
  }
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
