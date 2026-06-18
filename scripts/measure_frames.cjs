/**
 * Measure the cat's content box inside each sprite's canvas, so skins (tightly
 * trimmed) can be sized to match each room's padded default sprite.
 * Reports, per image: canvas WxH, opaque bbox, and content fractions.
 */
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer-core')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PUB = path.join(__dirname, '..', 'public')

const FILES = [
  // room defaults (rendered via BlinkingEren `src`)
  'erenGood_notail.png', 'ErenCook_notail.png', 'ErenBell_notail.png',
  'erenSleep_notail.png', 'ErenBathroomHat_notail.png', 'ErenLab_notail.png', 'ErenVet_notail.png',
  // a few skins for comparison
  'skins/koala_notail.png', 'skins/otter_notail.png', 'skins/rainbow_notail.png', 'skins/mouse_notail.png',
]

function measure(dataUrl) {
  return new Promise(res => {
    const img = new Image()
    img.onload = () => {
      const W = img.naturalWidth, H = img.naturalHeight
      const c = document.createElement('canvas'); c.width = W; c.height = H
      const x = c.getContext('2d'); x.drawImage(img, 0, 0)
      const d = x.getImageData(0, 0, W, H).data
      let minX = W, minY = H, maxX = -1, maxY = -1
      for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
        if (d[(y * W + xx) * 4 + 3] > 16) { if (xx < minX) minX = xx; if (xx > maxX) maxX = xx; if (y < minY) minY = y; if (y > maxY) maxY = y }
      }
      const cw = maxX - minX + 1, ch = maxY - minY + 1
      res({ W, H, minX, minY, maxX, maxY, cw, ch, fracH: +(ch / H).toFixed(4), fracW: +(cw / W).toFixed(4), topGap: +(minY / H).toFixed(4), botGap: +((H - 1 - maxY) / H).toFixed(4) })
    }
    img.src = dataUrl
  })
}

;(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
  const p = await b.newPage()
  for (const f of FILES) {
    const fp = path.join(PUB, f)
    if (!fs.existsSync(fp)) { console.log(f.padEnd(30), 'MISSING'); continue }
    const url = 'data:image/png;base64,' + fs.readFileSync(fp).toString('base64')
    const m = await p.evaluate(measure, url)
    console.log(f.padEnd(30), `canvas ${m.W}x${m.H}  catH%=${(m.fracH * 100).toFixed(1)}  topGap%=${(m.topGap * 100).toFixed(1)}  botGap%=${(m.botGap * 100).toFixed(1)}  aspect=${(m.W / m.H).toFixed(3)}`)
  }
  await b.close()
})()
