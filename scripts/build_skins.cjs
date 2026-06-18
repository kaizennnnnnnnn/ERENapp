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
  { id: 'rainbow', file: 'ErenRainbow1.png',   rarity: 'epic',      name: 'Rainbow Eren', eyesOverride: { lx: 40.5, rx: 53.7, cy: 31 } },
  { id: 'gold',    file: 'ErenGold1.png',       rarity: 'epic',      name: 'Golden Eren' },
  { id: 'shark',   file: 'ErenSharki1.png',     rarity: 'epic',      name: 'Shark Eren', eyesOverride: { lx: 42.5, rx: 55, cy: 41 } },
  { id: 'bear',    file: 'ErenBear1.png',       rarity: 'epic',      name: 'Bear Eren',   bg: 'black', reoutline: true },
  { id: 'fox',     file: 'ErenFox1.png',        rarity: 'epic',      name: 'Fox Eren',    bg: 'black', reoutline: true },
  { id: 'penguin', file: 'ErenPenguing1.png',   rarity: 'epic',      name: 'Penguin Eren' },
  { id: 'bat',     file: 'ErenBat1.png',        rarity: 'epic',      name: 'Bat Eren', eyesOverride: { lx: 43.2, rx: 55.9, cy: 39 } },
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
      // Build a full EyeLayout from two eye CENTRES + a fixed iris size. Skins
      // are trimmed TIGHT, so their iris is ~7.5–8.5% of the box (erenGood's
      // ~5.4% ÷ its 0.76 fill ratio) — much larger than the room sprites; a
      // fixed size keyed to that reads right on every skin (same ragdoll face),
      // and lidHeight makes the blink cover the whole eye, not a thin bar.
      const EYE = { w: 7.6, h: 8.6, lidH: 9.4 } // box-% sizes
      const buildEyes = (lx, rx, cy) => {
        const top = +(cy - EYE.h / 2).toFixed(2)
        const lidW = +(EYE.w * 1.12).toFixed(2)
        const gW = 26
        return {
          maskLeftA: +(lx - EYE.w / 2).toFixed(2) + '%', maskLeftB: +(rx - EYE.w / 2).toFixed(2) + '%',
          maskTop: top + '%', maskW: EYE.w + '%', maskH: EYE.h + '%',
          lidLeftA: +(lx - lidW / 2).toFixed(2) + '%', lidLeftB: +(rx - lidW / 2).toFixed(2) + '%',
          lidTop: +(top - 0.4).toFixed(2) + '%', lidWidth: lidW + '%', lidHeight: EYE.lidH + '%',
          // Catchlights point toward the nose: eye A (viewer-left) upper-RIGHT
          // of its iris, eye B upper-LEFT — mirrored, like the room sprites.
          glintLeftA: (62 - gW) + '%', glintLeftB: '38%', glintTopA: '14%', glintTopB: '14%', glintW: gW + '%',
        }
      }

      let eyes = null, eyeReason = 'none'
      let eyeBoxes = null // [{cx,cy}] image px, for the debug overlay
      if (opts.eyesOverride) {
        const o = opts.eyesOverride // {lx, rx, cy} box %
        eyes = buildEyes(o.lx, o.rx, o.cy); eyeReason = 'override'
      } else {
        // "Scan it out": find the TRUE iris blob per eye via loose blue +
        // connected components, and use each blob's BBOX CENTRE. The old
        // catchlight-gated centroid pulled the centres inward, so the eyes read
        // too close — a geometric bbox centre gives the real (wider) spacing.
        // Flat costume fur (rainbow) is rejected by compactness + a
        // catchlight-inside test, falling back to a manual override.
        const cand = new Uint8Array(W * H)
        for (let y = ey0; y < ey1; y++) for (let x = ex0; x < ex1; x++) {
          const i = (y * W + x) * 4
          if (fd[i + 3] < 128) continue
          const r = fd[i], g = fd[i + 1], b = fd[i + 2]
          if (b > 88 && b - r > 18 && b - g > 6 && r < 200) cand[y * W + x] = 1
        }
        const minSize = Math.max(10, Math.round(W * H * 0.00022))
        const lab = new Int32Array(W * H).fill(-1)
        const comps = []
        const stk = []
        for (let s = 0; s < W * H; s++) {
          if (!cand[s] || lab[s] >= 0) continue
          let size = 0, x0 = W, y0 = H, x1 = -1, y1 = -1, sx = 0
          stk.length = 0; stk.push(s); lab[s] = 1
          while (stk.length) {
            const p = stk.pop(); size++
            const px = p % W, py = (p / W) | 0
            if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py
            sx += px
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue
              const nx = px + dx, ny = py + dy
              if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
              const np = ny * W + nx
              if (cand[np] && lab[np] < 0) { lab[np] = 1; stk.push(np) }
            }
          }
          if (size < minSize || (x1 - x0 + 1) / W > 0.14 || (y1 - y0 + 1) / H > 0.14) continue
          let hasCL = false
          for (let y = y0; y <= y1 && !hasCL; y++) for (let x = x0; x <= x1; x++) {
            const i = (y * W + x) * 4
            if (fd[i + 3] > 128 && lum(fd[i], fd[i + 1], fd[i + 2]) > 195) { hasCL = true; break }
          }
          if (!hasCL) continue
          comps.push({ size, x0, y0, x1, y1, cx: sx / size })
        }
        const midX = (ex0 + ex1) / 2
        const pick = (f) => comps.filter(f).sort((a, b) => b.size - a.size)[0]
        const left = pick(c => c.cx < midX), right = pick(c => c.cx >= midX)
        if (left && right) {
          const cxL = (left.x0 + left.x1) / 2, cxR = (right.x0 + right.x1) / 2
          const cyM = (left.y0 + left.y1 + right.y0 + right.y1) / 4
          const span = (cxR - cxL) / W
          if (span > 0.07 && span < 0.32) {
            eyes = buildEyes(bx(cxL), bx(cxR), by(cyM))
            eyeBoxes = [{ cx: cxL, cy: cyM }, { cx: cxR, cy: cyM }]
            eyeReason = `ok(${comps.length}c span${(span * 100) | 0})`
          } else eyeReason = `span(${span.toFixed(2)})`
        } else eyeReason = `comps(${comps.length})`
      }

      // ── 6. Tail isolation by LEFT-RIGHT SYMMETRY. The body+head are roughly
      //       symmetric about a vertical axis; the tail is the asymmetric
      //       RIGHTWARD excursion. For each row below the chest, anything in the
      //       rightmost run that sticks out past the mirror of the (tail-free)
      //       left edge is tail — captured from its ROOT (where it first bulges
      //       past the body) to the tip, so it rotates about the hip. (A flush-
      //       attached tail can't be split by gaps or thickness; symmetry can.)
      const sil = new Uint8Array(W * H)
      for (let i = 0; i < W * H; i++) sil[i] = fd[i * 4 + 3] > 40 ? 1 : 0
      // symmetry axis = mean silhouette centre across the (tail-free) head band
      let axisSum = 0, axisN = 0
      for (let y = Math.floor(H * 0.05); y < Math.floor(H * 0.32); y++) {
        let l = -1, r = -1
        for (let x = 0; x < W; x++) if (sil[y * W + x]) { if (l < 0) l = x; r = x }
        if (l >= 0) { axisSum += (l + r) / 2; axisN++ }
      }
      const axis = axisN ? axisSum / axisN : W / 2
      // Small margin so the cut lands AT the tail's root (the body's symmetric
      // right edge), not ~30px out — otherwise a sliver of the root stays in
      // the body and sits static while the rest of the tail swings.
      const margin = Math.round(W * (opts.tailMargin != null ? opts.tailMargin : 0.005))
      const yTail = Math.floor(H * (opts.tailYStart != null ? opts.tailYStart : 0.30))
      const tailMask = new Uint8Array(W * H)
      for (let y = yTail; y < H; y++) {
        let l = -1, r = -1
        for (let x = 0; x < W; x++) if (sil[y * W + x]) { if (l < 0) l = x; r = x }
        if (l < 0) continue
        const cut = (2 * axis - l) + margin   // mirror of the body's left edge
        if (r <= cut) continue
        let x = r                              // rightmost run, pixels past `cut`
        while (x >= 0 && sil[y * W + x]) { if (x > cut) tailMask[y * W + x] = 1; x-- }
      }

      // largest tail component on the right + below the head band
      let tCount = 0, tMinX = 1e9, tMaxX = -1, tMinY = 1e9, tMaxY = -1
      {
        const lab = new Int32Array(W * H).fill(-1)
        const comps = []
        const stk = []
        for (let s = 0; s < W * H; s++) {
          if (!tailMask[s] || lab[s] >= 0) continue
          const id = comps.length
          let size = 0, sx = 0, sy = 0
          stk.length = 0; stk.push(s); lab[s] = id
          while (stk.length) {
            const p = stk.pop(); size++
            const px = p % W, py = (p / W) | 0
            sx += px; sy += py
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = px + dx, ny = py + dy
              if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
              const np = ny * W + nx
              if (tailMask[np] && lab[np] < 0) { lab[np] = id; stk.push(np) }
            }
          }
          comps.push({ id, size, cx: sx / size, cy: sy / size })
        }
        // Keep ALL right-side, below-head components (not just the largest):
        // a tail that dips left of the mirror mid-way gets split into stacked
        // pieces by the per-row cut (the mouse), and keeping only the biggest
        // left the lower piece static in the body. The far-right + size gates
        // still exclude paws/specks.
        const keepIds = new Set(comps
          .filter(c => c.cx > W * 0.55 && c.cy > H * 0.34 && c.size > W * H * 0.0025)
          .map(c => c.id))
        for (let i = 0; i < W * H; i++) {
          if (keepIds.has(lab[i])) {
            tCount++; const x = i % W, y = (i / W) | 0
            if (x < tMinX) tMinX = x; if (x > tMaxX) tMaxX = x
            if (y < tMinY) tMinY = y; if (y > tMaxY) tMaxY = y
          } else tailMask[i] = 0
        }
        // Bridge vertical gaps: rows inside the tail's span that the cut skipped
        // (the tail curved behind the mirror) get the rightmost silhouette run in
        // the tail's x-band, so the pieces reconnect into one continuous tail.
        if (tCount > 0) {
          for (let y = tMinY; y <= tMaxY; y++) {
            let has = false
            for (let x = tMinX; x <= tMaxX; x++) if (tailMask[y * W + x]) { has = true; break }
            if (has) continue
            let rx = -1
            for (let x = tMaxX; x >= tMinX; x--) if (sil[y * W + x]) { rx = x; break }
            if (rx < 0) continue
            for (let x = rx; x >= tMinX && sil[y * W + x]; x--) { tailMask[y * W + x] = 1; tCount++ }
          }
        }
      }

      // Extend the tail LEFT to its true ROOT. The symmetry cut stops at the
      // body's mirrored edge, but the tail's root sits a little left of that,
      // touching the body — those gray root pixels get left in the body and sit
      // static while the rest swings ("not cut at the root"). For each tail row,
      // grow left through non-white silhouette (the gray/outline root) and stop
      // at the bright body fur. Re-derive the bbox afterwards.
      if (tCount > 0) {
        const maxGrow = Math.round(W * 0.06)
        const add = []
        for (let y = tMinY; y <= tMaxY; y++) {
          let lx = -1
          for (let x = tMinX; x <= tMaxX; x++) if (tailMask[y * W + x]) { lx = x; break }
          if (lx < 0) continue
          for (let k = 1; k <= maxGrow; k++) {
            const nx = lx - k
            if (nx < 0) break
            const idx = y * W + nx
            if (!sil[idx] || tailMask[idx]) break
            const i = idx * 4
            if (lum(fd[i], fd[i + 1], fd[i + 2]) > 195) break // hit the body's white fur → root reached
            add.push(idx)
          }
        }
        for (const idx of add) tailMask[idx] = 1
        tMinX = 1e9; tMaxX = -1; tMinY = 1e9; tMaxY = -1
        for (let i = 0; i < W * H; i++) if (tailMask[i]) {
          const x = i % W, y = (i / W) | 0
          if (x < tMinX) tMinX = x; if (x > tMaxX) tMaxX = x
          if (y < tMinY) tMinY = y; if (y > tMaxY) tMaxY = y
        }
      }

      let tail = null, tailOrigin = null
      const haveTail = tCount > (W * H) * 0.004 && tMaxX >= 0
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
        // pivot = the ATTACHMENT SEAM: tail pixels that border the body
        // (sil minus tail). Their centroid is exactly where the tail joins the
        // body — the hip it should swing from. (`sil` still includes the tail
        // here; the body is sil AND NOT tailMask.) This keeps the attachment
        // glued and the free length swinging, for any tail orientation.
        const seam = []
        for (let y = tMinY; y <= tMaxY; y++) for (let x = tMinX; x <= tMaxX; x++) {
          if (!tailMask[y * W + x]) continue
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
            if (sil[ny * W + nx] && !tailMask[ny * W + nx]) { seam.push(x, y); break }
          }
        }
        // pivot = centroid of the UPPER part of the attachment seam = the HIP
        // where the tail emerges. (The full-seam centroid is dragged toward the
        // tip when the root edge is long; a hanging tail must swing from its top.)
        let rootX = tMinX, rootY = tMinY
        if (seam.length) {
          let ymin = 1e9, ymax = -1
          for (let k = 1; k < seam.length; k += 2) { if (seam[k] < ymin) ymin = seam[k]; if (seam[k] > ymax) ymax = seam[k] }
          const cutY = ymin + (ymax - ymin) * 0.40
          let psx = 0, psy = 0, pn = 0
          for (let k = 0; k < seam.length; k += 2) if (seam[k + 1] <= cutY) { psx += seam[k]; psy += seam[k + 1]; pn++ }
          if (pn) { rootX = psx / pn; rootY = psy / pn }
        }
        tailOrigin = `${(+bx(rootX).toFixed(1))}% ${(+by(rootY).toFixed(1))}%`
        // Erase the tail from the body, but KEEP a thin connector strip of its
        // inner edge in the body. The tail layer (full tail) is drawn over it at
        // rest; when it swings (up to -8deg) the part of the long attachment
        // seam below the hip lifts off — the static strip fills that gap so the
        // tail stays joined to the body instead of detaching. Sized to the
        // worst-case swing displacement (~0.022·W).
        const connector = Math.max(5, Math.round(W * 0.022))
        for (let y = tMinY; y <= tMaxY; y++) {
          let rowLeft = -1
          for (let x = tMinX; x <= tMaxX; x++) if (tailMask[y * W + x]) { rowLeft = x; break }
          if (rowLeft < 0) continue
          // Keep the connector strip ONLY where the tail borders the body (the
          // body sits just left of its inner edge). Where the tail curves AWAY
          // from the body (free rows), keep nothing — otherwise the strip floats
          // in space and reads as a static stub when the tail swings (otter).
          const lx = rowLeft - 1
          const attached = lx >= 0 && sil[y * W + lx] === 1 && !tailMask[y * W + lx]
          const keep = attached ? connector : 0
          for (let x = rowLeft + keep; x <= tMaxX; x++) if (tailMask[y * W + x]) fd[(y * W + x) * 4 + 3] = 0
        }
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
        // detected iris centroids (yellow dots) — should sit at each eye centre
        dx2.fillStyle = '#ffd000'
        for (const c of eyeBoxes) { dx2.beginPath(); dx2.arc(c.cx, c.cy, Math.max(2, W * 0.006), 0, 7); dx2.fill() }
      }
      if (haveTail) {
        // paint the tail mask translucent red so the CUT (its left edge) is
        // visible against the body — verification only.
        const ov = document.createElement('canvas'); ov.width = W; ov.height = H
        const oid = ov.getContext('2d').createImageData(W, H)
        for (let i = 0; i < W * H; i++) if (tailMask[i]) { const j = i * 4; oid.data[j] = 255; oid.data[j + 1] = 30; oid.data[j + 2] = 30; oid.data[j + 3] = 255 }
        ov.getContext('2d').putImageData(oid, 0, 0)
        dx2.globalAlpha = 0.45; dx2.drawImage(ov, 0, 0); dx2.globalAlpha = 1
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
