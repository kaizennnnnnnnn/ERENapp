const puppeteer = require('puppeteer-core')
const path = require('path')
;(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' })
  const page = await b.newPage()
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message))
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 240)) })
  await page.setViewport({ width: 1340, height: 950, deviceScaleFactor: 1 })
  let ok = false
  for (let a = 0; a < 8 && !ok; a++) {
    await page.goto('http://localhost:3000/wxpick', { waitUntil: 'networkidle0', timeout: 120000 })
    ok = await page.evaluate(() => !!document.querySelector('.legal-page')).catch(() => false)
    if (!ok) await new Promise(r => setTimeout(r, 1500))
  }
  await page.evaluate(() => window.dispatchEvent(new Event('eren:app-ready')))
  // Drive each panel to a different target so one sheet shows a normal room,
  // the bedroom's refused keys and the all-seven target together.
  const want = (process.argv[3] || '').split(',')
  await page.evaluate((want) => {
    document.querySelectorAll('.legal-page > div').forEach((col, i) => {
      const t = want[i]
      if (!t) return
      const b = [...col.querySelectorAll('button')].find(x => x.textContent.includes(t))
      if (b) b.click()
    })
  }, want)
  await new Promise(r => setTimeout(r, 1400))
  const box = await page.evaluate(() => {
    const e = document.querySelector('.legal-page'); const r = e.getBoundingClientRect()
    return { x: r.x + scrollX, y: r.y + scrollY, width: Math.ceil(r.width), height: Math.ceil(r.height) }
  })
  await page.screenshot({ path: process.argv[2] || 'scripts/wxpick.png', captureBeyondViewport: true, clip: box })
  console.log('ready=' + ok, box.width + 'x' + box.height)
  if (errs.length) console.log('ERRORS:\n' + errs.slice(0, 6).join('\n'))
  await b.close()
})().catch(e => { console.error(e); process.exit(1) })
