// Screenshots the two-page gacha (food / animal) at phone size: landing page,
// swiped-right page, and the dot-click navigation path.
const puppeteer = require('puppeteer-core')
const path = require('path')

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const OUT = path.join(__dirname, 'gacha_shots')
const BASE = 'http://localhost:3000'

async function main() {
  const fs = require('fs')
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
  const sleep = ms => new Promise(r => setTimeout(r, ms))

  await page.goto(BASE + '/gacha', { waitUntil: 'networkidle0' })
  await sleep(9000) // ride out the SplashScreen safety net on a cold deep-link
  console.log('url after load:', page.url())
  await page.screenshot({ path: path.join(OUT, '1_food.png') })

  // Swipe right (scroll the snap container one page)
  await page.evaluate(() => {
    const el = document.querySelector('.snap-x')
    if (el) el.scrollTo({ left: el.clientWidth, behavior: 'instant' })
  })
  await sleep(800)
  await page.screenshot({ path: path.join(OUT, '2_animal.png') })

  // Dot navigation back to page 1
  await page.evaluate(() => {
    const dots = document.querySelectorAll('button[aria-label="food"]')
    if (dots[0]) dots[0].click()
  })
  await sleep(900)
  await page.screenshot({ path: path.join(OUT, '3_back_to_food.png') })

  await browser.close()
  console.log('shots written to', OUT)
}
main().catch(e => { console.error(e); process.exit(1) })
