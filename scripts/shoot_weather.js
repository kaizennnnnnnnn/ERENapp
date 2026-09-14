// Screenshots the standalone weather harness, freezing every animation at a
// given ms so frames are deterministic (a lightning strike is ~300ms out of a
// 7.3s cycle — you cannot catch it by waiting).
//   node scripts/build_weather_harness.js && node scripts/shoot_weather.js after 1500 315
const puppeteer = require('puppeteer-core')
const path = require('path'), fs = require('fs')

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const OUT = path.join(__dirname, 'weather_shots')
const TAG = process.argv[2] || 'shot'
const times = process.argv.slice(3).map(Number)
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
  const page = await browser.newPage()
  await page.setViewport({ width: 1240, height: 1000, deviceScaleFactor: 2 })
  await page.goto('file://' + path.join(OUT, 'harness.html').replace(/\\/g, '/'))
  await sleep(900)
  for (const t of (times.length ? times : [1500])) {
    await page.evaluate(ms => {
      document.getAnimations().forEach(a => { try { a.pause(); a.currentTime = ms } catch (e) {} })
    }, t)
    await sleep(180)
    const f = path.join(OUT, `${TAG}_${t}.png`)
    await page.screenshot({ path: f, fullPage: true })
    console.log(f)
  }
  await browser.close()
}
main().catch(e => { console.error(e); process.exit(1) })
