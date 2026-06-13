// Screenshots the room-transition preview harness at key moments so the
// depth veil + sparkle curtain can be eyeballed. Uses real room PNGs served
// from /public over a tiny static file URL.
const puppeteer = require('puppeteer-core')
const path = require('path')

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const OUT = path.join(__dirname, 'room_shots')
const HTML = 'file://' + path.join(__dirname, 'preview_room_transition.html').replace(/\\/g, '/')
const KITCHEN = 'file://' + path.join(__dirname, '..', 'public', 'kitchen.png').replace(/\\/g, '/')
const BEDROOM = 'file://' + path.join(__dirname, '..', 'public', 'bedroom.png').replace(/\\/g, '/')

async function main() {
  const fs = require('fs')
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
  const page = await browser.newPage()
  await page.setViewport({ width: 430, height: 884, deviceScaleFactor: 2 })
  await page.goto(HTML)
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  const shot = n => page.screenshot({ path: path.join(OUT, n + '.png'), clip: { x: 20, y: 20, width: 390, height: 844 } })

  await page.evaluate((img) => window.showDrag(img, 170), KITCHEN)
  await sleep(300); await shot('1_mid_drag')

  await page.evaluate((img) => window.showSlide(img, 'left'), BEDROOM)
  await sleep(120); await shot('2_slide_early')
  await sleep(180); await shot('3_slide_mid')
  await sleep(250); await shot('4_slide_late')

  await browser.close()
  console.log('room shots →', OUT)
}
main().catch(e => { console.error(e); process.exit(1) })
