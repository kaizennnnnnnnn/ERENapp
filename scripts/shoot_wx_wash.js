// Freezes every animation at a fixed ms and shoots the wash sheet, then hands
// back a downscaled copy (vision rejects anything over ~2000px on a side).
const puppeteer = require('puppeteer-core')
const path = require('path'), fs = require('fs')
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const OUT = path.join(__dirname, 'weather_shots')
const TAG = process.argv[2] || 'wash'
const AT = Number(process.argv[3] || 1500)
const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
  const page = await browser.newPage()
  await page.setViewport({ width: 900, height: 1200, deviceScaleFactor: 1 })
  await page.goto('file://' + path.join(OUT, 'wash.html').split(path.sep).join('/'))
  await sleep(1000)
  await page.evaluate(ms => {
    document.getAnimations().forEach(a => { try { a.pause(); a.currentTime = ms } catch (e) {} })
  }, AT)
  await sleep(200)
  const box = await page.evaluate(() => {
    const r = document.getElementById('sheet').getBoundingClientRect()
    return { x: 0, y: 0, width: Math.ceil(r.width + 16), height: Math.ceil(r.height + 16) }
  })
  const f = path.join(OUT, `${TAG}.png`)
  await page.screenshot({ path: f, captureBeyondViewport: true, clip: box })
  console.log(f, box.width + 'x' + box.height)
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
