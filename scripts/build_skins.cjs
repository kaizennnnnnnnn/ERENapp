/**
 * build_skins.cjs — one-shot asset pipeline for gacha SKINS.
 *
 * For each source PNG in Downloads it produces, in public/skins/:
 *   <id>.png         cleaned + trimmed full sprite (gacha reveal / collection / closet thumb)
 *   <id>_notail.png  body with the tail erased   (BlinkingEren `src`)
 *   <id>_tail.png    tail isolated, everything else transparent (BlinkingEren `tailSrc`)
 *
 * …and measures, per skin, the BlinkingEren eye-layout + tail pivot, written to
 * scripts/skins_manifest.json (consumed by lib/skins.ts).
 *
 * All pixel work runs in a headless-Chrome canvas (no PIL/sharp); Node just
 * shuttles base64 PNGs in and out and writes files. Also emits a contact sheet
 * (scripts/_skins_contact.html) for visual verification.
 *
 * Run:  node scripts/build_skins.cjs
 */
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer-core')

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const SRC_DIR = 'C:\\Users\\Lenovo\\Downloads'
const OUT_DIR = path.join(__dirname, '..', 'public', 'skins')
const MANIFEST = path.join(__dirname, 'skins_manifest.json')
const CONTACT = path.join(__dirname, '_skins_contact.html')

// id, source file, rarity, display name, and optional per-skin pipeline params.
const SKINS = [
  // rainbow/shark/bat: blue fur or hood defeats auto iris detection — eye
  // centres measured by hand from the cleaned sprite (box %: lx, rx, cy).
  { id: 'rainbow', file: 'ErenRainbow1.png',   rarity: 'epic',      name: 'Rainbow Eren', eyesOverride: { lx: 40.5, rx: 53.7, cy: 30 } },
  { id: 'gold',    file: 'ErenGold1.png',       rarity: 'epic',      name: 'Golden Eren' },
  { id: 'shark',   file: 'ErenSharki1.png',     rarity: 'epic',      name: 'Shark Eren', eyesOverride: { lx: 42.5, rx: 55, cy: 40 } },
  { id: 'bear',    file: 'ErenBear1.png',       rarity: 'epic',      name: 'Bear Eren',   bg: 'black', reoutline: true },
  { id: 'fox',     file: 'ErenFox1.png',        rarity: 'epic',      name: 'Fox Eren',    bg: 'black', reoutline: true },
  { id: 'penguin', file: 'ErenPenguing1.png',   rarity: 'epic',      name: 'Penguin Eren' },
  { id: 'bat',     file: 'ErenBat1.png',        rarity: 'epic',      name: 'Bat Eren', eyesOverride: { lx: 43.2, rx: 55.9, cy: 38 } },
  { id: 'fish',    file: 'ErenFish1.png',       rarity: 'rare',      name: 'Fish Hat Eren' },
  { id: 'dog',     file: 'ErenDogi1.png',       rarity: 'rare',      name: 'Puppy Eren' },
  { id: 'chicken', file: 'ErenChicken1.png',    rarity: 'rare',      name: 'Chick Hood Eren' },
  { id: 'chick',   file: 'ErenChic1.png',       rarity: 'rare',      name: 'Lil Chick Eren' },
  { id: 'frog',    file: 'ErenFrogi1.png',      rarity: 'rare',      name: 'Frog Eren' },
  { id: 'panda',   file: 'ErenPanda1.png',      rarity: 'rare',      name: 'Panda Eren' },
  { id: 'owl',     file: 'ErenOwl1.png',        rarity: 'rare',      name: 'Owl Eren' },
  { id: 'axolotl', file: 'ErenPink1.png',       rarity: 'rare',      name: 'Axolotl Eren' },
  { id: 'sheep',   file: 'ErenSheep1.png',      rarity: 'rare',      name: 'Sheep Eren' },
  { id: 'raccoon', file: 'ErenRacoon1.png',     rarity: 'rare',      name: 'Raccoon Eren' },
  { id: 'koala',   file: 'ErenCoala1.png',      rarity: 'rare',      name: 'Koala Eren' },
  { id: 'otter',   file: 'ErenOtter1.png',      rarity: 'rare',      name: 'Otter Eren' },
  { id: 'mouse',   file: 'ErenMouseFull1.png',  rarity: 'legendary', name: 'Mouse Eren' },
  { id: 'bunny',   file: 'ErenBunnyFull1.png',  rarity: 'legendary', name: 'Bunny Eren' },
]

// ───────────────────────── browser-side processing ─────────────────────────
// Runs inside the page. Pure canvas pixel work. Returns dataURLs + measurements.
function processInBrowser(dataUrl, opts) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const W0 = img.naturalWidth, H0 = img.naturalHeight
      const cv = document.createElement('canvas')
      cv.width = W0; cv.height = H0
      const ctx = cv.getContext('2d')
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, 0, 0)
      const id = ctx.getImageData(0, 0, W0, H0)
      const d = id.data
      const A = (x, y) => d[(y * W0 + x) * 4 + 3]
      const setA0 = (x, y) => { d[(y * W0 + x) * 4 + 3] = 0 }
      const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b

      // ── 1. Background removal (flood-fill from the border) ──────────────
      // Detect the bg colour from the corners. If already transparent, skip.
      const corners = [[0, 0], [W0 - 1, 0], [0, H0 - 1], [W0 - 1, H0 - 1]]
      let bgOpaque = 0, br = 0, bgc = 0, bb = 0
      for (const [cx, cy] of corners) {
        const i = (cy * W0 + cx) * 4
        if (d[i + 3] > 200) { bgOpaque++; br += d[i]; bgc += d[i + 1]; bb += d[i + 2] }
      }
      if (bgOpaque >= 2) {
        br /= bgOpaque; bgc /= bgOpaque; bb /= bgOpaque
        const tol = (opts.bg === 'black' || Math.max(br, bgc, bb) < 60) ? 60 : 38
        const match = (x, y) => {
          const i = (y * W0 + x) * 4
          if (d[i + 3] < 40) return true // already clear → treat as bg
          return Math.abs(d[i] - br) <= tol && Math.abs(d[i + 1] - bgc) <= tol && Math.abs(d[i + 2] - bb) <= tol
        }
        const seen = new Uint8Array(W0 * H0)
        const stack = []
        for (let x = 0; x < W0; x++) { stack.push([x, 0], [x, H0 - 1]) }
        for (let y = 0; y < H0; y++) { stack.push([0, y], [W0 - 1, y]) }
        while (stack.length) {
          const [x, y] = stack.pop()
          if (x < 0 || y < 0 || x >= W0 || y >= H0) continue
          const k = y * W0 + x
          if (seen[k]) continue
          if (!match(x, y)) continue
          seen[k] = 1
          setA0(x, y)
          stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
        }
      }

      // ── 2. Halo peel — near-white pixels bordering BOTH transparency and a
      //       dark outline (the AI sticker's outer white ring). 3 passes. ────
      for (let pass = 0; pass < 3; pass++) {
        const kill = []
        for (let y = 0; y < H0; y++) {
          for (let x = 0; x < W0; x++) {
            const i = (y * W0 + x) * 4
            if (d[i + 3] < 32 || Math.min(d[i], d[i + 1], d[i + 2]) < 190) continue
            let tT = false, tD = false
            for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
              if (!dx && !dy) continue
              const nx = x + dx, ny = y + dy
              if (nx < 0 || ny < 0 || nx >= W0 || ny >= H0) continue
              const j = (ny * W0 + nx) * 4
              if (d[j + 3] < 64) tT = true
              else if (d[j + 3] >= 128 && lum(d[j], d[j + 1], d[j + 2]) <= 95) tD = true
            }
            if (tT && tD) kill.push(i)
          }
        }
        if (!kill.length) break
        for (const i of kill) d[i + 3] = 0
      }
      // Drop any leftover translucent near-white fringe.
      for (let p = 0; p < d.length; p += 4) {
        if (d[p + 3] < 255 && Math.min(d[p], d[p + 1], d[p + 2]) >= 200) d[p + 3] = 0
      }

      // ── 3. Re-outline (black-bg skins lost their outer outline to flood) ──
      if (opts.reoutline) {
        const add = []
        for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) {
          if (A(x, y) > 0) continue
          let near = false
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy
            if (nx < 0 || ny < 0 || nx >= W0 || ny >= H0) continue
            if (A(nx, ny) > 180) { near = true; break }
          }
          if (near) add.push((y * W0 + x) * 4)
        }
        for (const i of add) { d[i] = 26; d[i + 1] = 22; d[i + 2] = 20; d[i + 3] = 255 }
      }

      ctx.putImageData(id, 0, 0)

      // ── 4. Trim to opaque bbox ──────────────────────────────────────────
      let minX = W0, minY = H0, maxX = -1, maxY = -1
      for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) {
        if (A(x, y) > 8) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
      }
      const W = maxX - minX + 1, H = maxY - minY + 1
      const full = document.createElement('canvas')
      full.width = W; full.height = H
      const fctx = full.getContext('2d')
      fctx.imageSmoothingEnabled = false
      fctx.drawImage(cv, minX, minY, W, H, 0, 0, W, H)
      const fid = fctx.getImageData(0, 0, W, H)
      const fd = fid.data
      const a = (x, y) => fd[(y * W + x) * 4 + 3]

      // Letterbox→square-box coordinate conversion (objectFit: contain).
      const M = Math.max(W, H)
      const offX = (M - W) / 2, offY = (M - H) / 2
      const bx = (px) => ((px + offX) / M) * 100
      const by = (py) => ((py + offY) / M) * 100

      // ── 5. Eye detection — vivid blue iris in the central-upper region.
      //      An iris pixel is vivid blue AND sits near both a bright catchlight
      //      and a dark pupil/outline within a small window. That light+dark
      //      juxtaposition is unique to the eye; it rejects flat blue costume
      //      fur (e.g. the rainbow skin) which has no such local contrast. ──
      const ex0 = Math.floor(W * 0.27), ex1 = Math.ceil(W * 0.73)
      const ey0 = Math.floor(H * 0.20), ey1 = Math.ceil(H * 0.60)
      const rr = Math.max(3, Math.round(W * 0.02)), step = Math.max(1, Math.round(rr / 4))
      const hasContrast = (x, y) => {
        let bright = false, dark = false
        for (let dy = -rr; dy <= rr; dy += step) for (let dx = -rr; dx <= rr; dx += step) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
          const i = (ny * W + nx) * 4
          if (fd[i + 3] < 128) continue
          const L2 = lum(fd[i], fd[i + 1], fd[i + 2])
          if (L2 > 205) bright = true
          else if (L2 < 70) dark = true
          if (bright && dark) return true
        }
        return false
      }
      const eyePix = []
      for (let y = ey0; y < ey1; y++) for (let x = ex0; x < ex1; x++) {
        const i = (y * W + x) * 4
        const r = fd[i], g = fd[i + 1], b = fd[i + 2], al = fd[i + 3]
        if (al < 128) continue
        if (b > 115 && b - r > 45 && b - g > 30 && r < 165 && hasContrast(x, y)) eyePix.push([x, y])
      }
      // Build a full EyeLayout from two eye CENTRES (box %) + a fixed eye size.
      // The detected blue cluster is unreliable for SIZE (only the most
      // saturated iris pixels survive the filter), but its CENTROID is a
      // dependable eye centre. Every skin is the same ragdoll face at similar
      // framing, so a constant iris size (≈ erenGood's) reads correctly on all.
      const EYE = { w: 5.6, h: 5.2, lidW: 7.0 } // box-% sizes
      const buildEyes = (lx, cyL, rx, cyR) => ({
        maskLeftA: +(lx - EYE.w / 2).toFixed(2) + '%',
        maskLeftB: +(rx - EYE.w / 2).toFixed(2) + '%',
        maskTop:   +(Math.min(cyL, cyR) - EYE.h / 2).toFixed(2) + '%',
        maskW: EYE.w + '%', maskH: EYE.h + '%',
        lidLeftA: +(lx - EYE.lidW / 2).toFixed(2) + '%',
        lidLeftB: +(rx - EYE.lidW / 2).toFixed(2) + '%',
        lidTop:   +(Math.min(cyL, cyR) - EYE.h / 2 - 0.3).toFixed(2) + '%',
        lidWidth: EYE.lidW + '%',
        glintLeftA: '30%', glintLeftB: '30%', glintTopA: '26%', glintTopB: '26%', glintW: '38%',
      })

      let eyes = null, eyeReason = opts.eyesOverride ? 'override' : 'none'
      let eyeBoxes = null // {cxL,cyL,cxR,cyR} in image px, for the debug overlay
      if (opts.eyesOverride) {
        const o = opts.eyesOverride // {lx, rx, cy} in box %
        eyes = buildEyes(o.lx, o.cy, o.rx, o.cy)
      } else if (eyePix.length >= 12) {
        // Split into left / right clusters by the midpoint of the blue extent.
        const xs = eyePix.map(p => p[0]).sort((p, q) => p - q)
        const midGuess = (xs[0] + xs[xs.length - 1]) / 2
        const L = eyePix.filter(p => p[0] < midGuess), R = eyePix.filter(p => p[0] >= midGuess)
        const centroid = (pts) => {
          let sx = 0, sy = 0
          for (const [x, y] of pts) { sx += x; sy += y }
          return { cx: sx / pts.length, cy: sy / pts.length }
        }
        const bbox = (pts) => {
          let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1
          for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
          return { spanW: (x1 - x0) / W, spanH: (y1 - y0) / H }
        }
        if (L.length >= 5 && R.length >= 5) {
          const cL = centroid(L), cR = centroid(R)
          // Sanity: each iris cluster should be compact. Loose blue spread over
          // the costume (rainbow fur, shark/bat hood) → reject, use a manual
          // eyeCenters override instead.
          const eL = bbox(L), eR = bbox(R)
          const span = (cR.cx - cL.cx) / W
          if (eL.spanW > 0.16 || eR.spanW > 0.16 || eL.spanH > 0.14 || eR.spanH > 0.14 || span > 0.30 || span < 0.05) {
            eyeReason = `spread(span=${span.toFixed(2)},eLw=${eL.spanW.toFixed(2)})`
          } else {
            eyeBoxes = { cxL: cL.cx, cyL: cL.cy, cxR: cR.cx, cyR: cR.cy }
            eyes = buildEyes(bx(cL.cx), by(cL.cy), bx(cR.cx), by(cR.cy))
            eyeReason = `ok(${eyePix.length})`
          }
        } else { eyeReason = 'one-cluster' }
      } else { eyeReason = `few(${eyePix.length})` }

      // ── 6. Tail isolation — rightmost opaque run separated from the body by
      //       a transparent gap, in the lower portion of the sprite. ────────
      const gap = opts.tailGap || Math.max(4, Math.round(W * 0.03))
      const yStart = Math.floor(H * (opts.tailYStart != null ? opts.tailYStart : 0.42))
      const tailMask = new Uint8Array(W * H)
      let tCount = 0, tMinX = 1e9, tMaxX = -1, tMinY = 1e9, tMaxY = -1
      for (let y = yStart; y < H; y++) {
        // find rightmost opaque pixel
        let rx = -1
        for (let x = W - 1; x >= 0; x--) { if (a(x, y) > 40) { rx = x; break } }
        if (rx < 0) continue
        // walk left over the rightmost run, then require a gap of transparency
        let x = rx
        while (x >= 0 && a(x, y) > 40) x--           // x = first transparent left of run
        let g2 = 0, xx = x
        while (xx >= 0 && a(xx, y) <= 40) { g2++; xx-- }
        if (xx < 0) continue                          // run reaches left edge → it's the body, skip
        if (g2 < gap) continue                        // not separated → not the curled tail
        // accept the rightmost run [x+1 .. rx] as tail for this row
        for (let tx = x + 1; tx <= rx; tx++) {
          if (a(tx, y) <= 40) continue
          tailMask[y * W + tx] = 1; tCount++
          if (tx < tMinX) tMinX = tx; if (tx > tMaxX) tMaxX = tx
          if (y < tMinY) tMinY = y; if (y > tMaxY) tMaxY = y
        }
      }
      // Keep only the LARGEST connected component of the tail mask — the gap
      // rule also catches a stray paw blob in the bottom rows; the real tail
      // dwarfs it. Re-derive the bbox from the surviving component.
      if (tCount > 0) {
        const label = new Int32Array(W * H).fill(-1)
        let bestId = -1, bestSize = 0, cur = 0
        const stk = []
        for (let s = 0; s < W * H; s++) {
          if (!tailMask[s] || label[s] >= 0) continue
          let size = 0; stk.length = 0; stk.push(s); label[s] = cur
          while (stk.length) {
            const p = stk.pop(); size++
            const px = p % W, py = (p / W) | 0
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = px + dx, ny = py + dy
              if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
              const np = ny * W + nx
              if (tailMask[np] && label[np] < 0) { label[np] = cur; stk.push(np) }
            }
          }
          if (size > bestSize) { bestSize = size; bestId = cur }
          cur++
        }
        tCount = 0; tMinX = 1e9; tMaxX = -1; tMinY = 1e9; tMaxY = -1
        for (let i = 0; i < W * H; i++) {
          if (label[i] === bestId) {
            tCount++; const x = i % W, y = (i / W) | 0
            if (x < tMinX) tMinX = x; if (x > tMaxX) tMaxX = x
            if (y < tMinY) tMinY = y; if (y > tMaxY) tMaxY = y
          } else tailMask[i] = 0
        }
      }

      let tail = null, tailOrigin = null
      // A real curling tail is a sizeable mass on the RIGHT that starts in the
      // mid-body, not a stray fragment hugging the bottom-centre (koala). Guard
      // against those so a bad fragment is dropped (skin just breathes+blinks).
      const tCenterX = (tMinX + tMaxX) / 2
      const haveTail = tCount > (W * H) * 0.006 && tMaxX >= 0 &&
        tCenterX > W * 0.52 && tMinY < H * 0.72
      if (haveTail) {
        const tc = document.createElement('canvas')
        tc.width = W; tc.height = H
        const tctx = tc.getContext('2d')
        const tid = tctx.createImageData(W, H)
        for (let i = 0; i < W * H; i++) {
          if (tailMask[i]) { const j = i * 4; tid.data[j] = fd[j]; tid.data[j + 1] = fd[j + 1]; tid.data[j + 2] = fd[j + 2]; tid.data[j + 3] = fd[j + 3] }
        }
        tctx.putImageData(tid, 0, 0)
        tail = tc.toDataURL('image/png')
        // pivot = where the tail joins the hip: its bottom-left, nudged inward
        const rootX = tMinX + (tMaxX - tMinX) * 0.12
        const rootY = tMinY + (tMaxY - tMinY) * 0.9
        tailOrigin = `${(+bx(rootX).toFixed(1))}% ${(+by(rootY).toFixed(1))}%`
        // erase tail from body
        for (let i = 0; i < W * H; i++) if (tailMask[i]) fd[i * 4 + 3] = 0
        fctx.putImageData(fid, 0, 0)
      }

      const notail = full.toDataURL('image/png')
      // re-draw full (un-erased) for the thumbnail
      const fc2 = document.createElement('canvas')
      fc2.width = W; fc2.height = H
      const f2 = fc2.getContext('2d'); f2.imageSmoothingEnabled = false
      f2.drawImage(cv, minX, minY, W, H, 0, 0, W, H)
      const fullUrl = fc2.toDataURL('image/png')

      // debug overlay: clean full + eye mask rects (cyan) + glint dots (red) +
      // tail bbox (lime) + pivot (magenta). Verification only.
      const dbgC = document.createElement('canvas')
      dbgC.width = W; dbgC.height = H
      const dx2 = dbgC.getContext('2d'); dx2.imageSmoothingEnabled = false
      dx2.drawImage(fc2, 0, 0)
      dx2.lineWidth = Math.max(2, Math.round(W * 0.006))
      if (eyes) {
        // draw the FINAL mask rects (what BlinkingEren will use), box%→image px
        const toPx = (s, off) => (parseFloat(s) / 100) * M - off
        const mw = (parseFloat(eyes.maskW) / 100) * M, mh = (parseFloat(eyes.maskH) / 100) * M
        dx2.strokeStyle = '#00e5ff'
        dx2.strokeRect(toPx(eyes.maskLeftA, offX), toPx(eyes.maskTop, offY), mw, mh)
        dx2.strokeRect(toPx(eyes.maskLeftB, offX), toPx(eyes.maskTop, offY), mw, mh)
      }
      if (eyeBoxes) {
        dx2.fillStyle = '#ff1d5e'
        for (const c of [[eyeBoxes.cxL, eyeBoxes.cyL], [eyeBoxes.cxR, eyeBoxes.cyR]]) {
          dx2.beginPath(); dx2.arc(c[0], c[1], Math.max(2, W * 0.006), 0, 7); dx2.fill()
        }
      }
      if (haveTail) {
        dx2.strokeStyle = '#7CFC00'; dx2.strokeRect(tMinX, tMinY, tMaxX - tMinX, tMaxY - tMinY)
        const pr = (tailOrigin || '0% 0%').split(' ').map(s => parseFloat(s) / 100)
        dx2.fillStyle = '#ff00ff'; dx2.beginPath()
        dx2.arc(pr[0] * M - offX, pr[1] * M - offY, Math.max(3, W * 0.01), 0, 7); dx2.fill()
      }
      const dbgUrl = dbgC.toDataURL('image/png')

      resolve({
        width: W, height: H, aspect: +(W / H).toFixed(3),
        full: fullUrl, notail, tail, tailOrigin, dbg: dbgUrl, eyeReason,
        eyes,
        tail_px: tCount, tail_bbox: haveTail ? { tMinX, tMaxX, tMinY, tMaxY } : null,
      })
    }
    img.onerror = () => resolve({ error: 'decode failed' })
    img.src = dataUrl
  })
}

;(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
  const page = await browser.newPage()
  page.on('console', m => { if (m.type() === 'error') console.log('  [page error]', m.text()) })

  const manifest = []
  const sheet = []
  for (const s of SKINS) {
    const srcPath = path.join(SRC_DIR, s.file)
    if (!fs.existsSync(srcPath)) { console.log(`MISSING ${s.file}`); continue }
    const b64 = fs.readFileSync(srcPath).toString('base64')
    const dataUrl = `data:image/png;base64,${b64}`
    const r = await page.evaluate(processInBrowser, dataUrl, { bg: s.bg, reoutline: s.reoutline, tailGap: s.tailGap, tailYStart: s.tailYStart, eyesOverride: s.eyesOverride })
    if (r.error) { console.log(`ERR ${s.id}: ${r.error}`); continue }
    const write = (suffix, url) => {
      if (!url) return
      fs.writeFileSync(path.join(OUT_DIR, `${s.id}${suffix}.png`), Buffer.from(url.split(',')[1], 'base64'))
    }
    write('', r.full)
    write('_notail', r.notail)
    write('_tail', r.tail)
    manifest.push({
      id: s.id, name: s.name, rarity: s.rarity,
      width: r.width, height: r.height, aspect: r.aspect,
      hasTail: !!r.tail, tailOrigin: r.tailOrigin, eyes: r.eyes, eyeReason: r.eyeReason,
    })
    sheet.push({ id: s.id, rarity: s.rarity, dbg: r.dbg, tail: r.tail, notail: r.notail, hasTail: !!r.tail, eyeReason: r.eyeReason, tailOrigin: r.tailOrigin })
    console.log(`${s.id.padEnd(9)} ${r.width}x${r.height} aspect=${r.aspect} tail=${r.tail ? 'Y@' + r.tailOrigin : 'n'} eyes=${r.eyeReason}`)
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2))

  // Emit a typed data file consumed by lib/skins.ts (regenerated on art change).
  const tsRows = manifest.map(m => {
    const eyes = m.eyes ? JSON.stringify(m.eyes) : 'undefined'
    const tail = m.hasTail ? `'/skins/${m.id}_tail.png'` : 'undefined'
    const to = m.hasTail && m.tailOrigin ? `'${m.tailOrigin}'` : 'undefined'
    return `  { id: '${m.id}', name: ${JSON.stringify(m.name)}, rarity: '${m.rarity}', aspect: ${m.aspect}, ` +
      `src: '/skins/${m.id}_notail.png', tailSrc: ${tail}, tailOrigin: ${to}, thumb: '/skins/${m.id}.png', eyes: ${eyes} },`
  }).join('\n')
  const tsFile = path.join(__dirname, '..', 'src', 'lib', 'skinsData.ts')
  fs.writeFileSync(tsFile, `// AUTO-GENERATED by scripts/build_skins.cjs — do not edit by hand.\n` +
    `import type { GachaRarity, EyeLayout } from '@/types'\n\n` +
    `export interface SkinRenderData {\n` +
    `  id: string\n  name: string\n  rarity: GachaRarity\n  aspect: number\n` +
    `  src: string\n  tailSrc?: string\n  tailOrigin?: string\n  thumb: string\n  eyes?: Partial<EyeLayout>\n}\n\n` +
    `export const SKIN_DATA: SkinRenderData[] = [\n${tsRows}\n]\n`)
  console.log('TS data →', tsFile)

  // self-contained contact sheet (inline base64) — open via file://, no server.
  const cells = sheet.map(m => `
    <div class="cell">
      <div class="row">
        <div class="t"><div class="lab">overlay (eyes/tail)</div><img src="${m.dbg}"></div>
        <div class="t"><div class="lab">notail</div><img src="${m.notail}"></div>
        <div class="t"><div class="lab">tail</div>${m.hasTail ? `<img src="${m.tail}">` : '<span class="no">none</span>'}</div>
      </div>
      <div class="meta">${m.id} · ${m.rarity} · tail ${m.hasTail ? 'Y ' + m.tailOrigin : 'N'} · eyes ${m.eyeReason}</div>
    </div>`).join('')
  fs.writeFileSync(CONTACT, `<!doctype html><meta charset=utf8><body style="background:#5b6b7a;margin:0;font-family:monospace;color:#fff">
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px">${cells}</div>
  <style>
    .cell{background:#2a2f36;border:1px solid #000;padding:4px}
    .row{display:flex;gap:4px}
    .t{flex:1;text-align:center;background:#7d8a96;background-image:linear-gradient(45deg,#6b7682 25%,transparent 25%),linear-gradient(-45deg,#6b7682 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#6b7682 75%),linear-gradient(-45deg,transparent 75%,#6b7682 75%);background-size:16px 16px;background-position:0 0,0 8px,8px -8px,-8px 0}
    .t img{width:100%;image-rendering:pixelated}
    .lab{font-size:9px;color:#cfe}
    .no{font-size:10px;color:#f88;display:block;padding:20px 0}
    .meta{font-size:9px;margin-top:3px;color:#9fd}
  </style></body>`)
  console.log('\nManifest →', MANIFEST)
  console.log('Contact  →', CONTACT, '(open /._skins_contact.html via dev server or file://)')
  await browser.close()
})()
