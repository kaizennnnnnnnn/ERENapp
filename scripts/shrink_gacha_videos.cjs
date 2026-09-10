/**
 * Re-encode the gacha reveal videos, in place, at a sane bitrate.
 *
 * THE PROBLEM THEY WERE: ten 5-second 1080x1916 clips at 11,600-20,700 kbps —
 * three to four times Netflix's 1080p rate, for an animation that plays on a
 * phone. 84.7 MB, carried in full by every single Vercel deployment, which is
 * how deployment storage reached 52 GB against a 10 GB limit.
 *
 * THE RECIPE, and why each part of it:
 *   -crf 23            measured, not guessed. VMAF against the original:
 *                        CRF 22 plain  -> 96.41 @ 2.65 MB
 *                        CRF 23 +anim  -> 96.09 @ 2.13 MB   <- this one
 *                        CRF 25 +anim  -> 94.67 @ 1.63 MB
 *                        CRF 28 plain  -> 90.94 @ 1.23 MB
 *                      93 is the usual "visually indistinguishable" line and 95
 *                      is transparent, so 96.1 is comfortably past both while
 *                      still cutting the file to under a quarter.
 *   -tune animation    these ARE animations. It buys the same quality as CRF 22
 *                      untuned for 20% fewer bytes, which is free.
 *   -an                the app plays these with `muted` on the <video> element
 *                      (gacha/page.tsx), so the 128 kbps AAC track is bytes
 *                      nobody can ever hear.
 *   +faststart         moves the index to the front so playback can begin
 *                      before the whole file has arrived. On a reveal that
 *                      fires the moment you tap, that is the difference between
 *                      instant and a visible stall.
 *   resolution kept    1080 wide is right for a modern phone; downscaling would
 *                      be visible on the one screen this is designed for.
 *
 * Needs ffmpeg, which is not a project dependency. Install it alongside the
 * other undeclared dev tool, IN ONE COMMAND, or npm prunes whichever you leave
 * out (they are both --no-save):
 *   npm i puppeteer-core ffmpeg-static --no-save
 *
 * Each output is probed before the original is replaced. A truncated reveal
 * video would be discovered by a player, mid-pull, with no way back.
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const ffmpeg = require('ffmpeg-static')
const ROOT = path.join(__dirname, '..')
const TARGETS = [
  ...fs.readdirSync(path.join(ROOT, 'public/gacha'))
    .filter(f => f.endsWith('.mp4'))
    .map(f => path.join('public/gacha', f)),
  'public/rainbow_opening.mp4',
]

let before = 0
let after = 0
const failed = []

for (const rel of TARGETS) {
  const src = path.join(ROOT, rel)
  const tmp = src.replace(/\.mp4$/, '.shrink.mp4')
  const b = fs.statSync(src).size
  try {
    execFileSync(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', src,
      '-c:v', 'libx264', '-crf', '23', '-preset', 'slow', '-tune', 'animation',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', tmp,
    ], { stdio: ['ignore', 'ignore', 'pipe'] })

    // Prove the file decodes end to end before trusting it. Judged on the EXIT
    // CODE — execFileSync throws on a non-zero one — not on the output, which
    // is null here because stdout is ignored and ffmpeg logs to stderr anyway.
    execFileSync(ffmpeg, ['-v', 'error', '-i', tmp, '-f', 'null', '-'],
      { stdio: ['ignore', 'ignore', 'ignore'] })
    const a = fs.statSync(tmp).size
    if (a < 50_000) throw new Error(`suspiciously small: ${a} bytes`)

    fs.unlinkSync(src)
    fs.renameSync(tmp, src)
    before += b
    after += a
    console.log(`${path.basename(rel).padEnd(24)} ${(b / 1048576).toFixed(2).padStart(6)} MB -> ${(a / 1048576).toFixed(2).padStart(5)} MB  (${(100 * a / b).toFixed(1)}%)`)
  } catch (e) {
    failed.push([rel, e.message.split('\n')[0]])
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp)
    console.log(`${path.basename(rel).padEnd(24)} FAILED — original left alone: ${e.message.split('\n')[0]}`)
  }
}

console.log()
if (failed.length) console.log(`${failed.length} failed; their originals are untouched.`)
console.log(`before ${(before / 1048576).toFixed(1)} MB`)
console.log(`after  ${(after / 1048576).toFixed(1)} MB  (${(100 * after / before).toFixed(1)}%)`)
console.log(`saved  ${((before - after) / 1048576).toFixed(1)} MB per deployment`)
