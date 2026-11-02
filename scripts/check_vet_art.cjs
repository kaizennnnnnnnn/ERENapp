const assert = require('node:assert/strict')
const fs = require('node:fs')
const crypto = require('node:crypto')
const ts = require('typescript')
const vm = require('node:vm')
const load = require('./lib/load_ts.cjs')()
const { roomArt } = load('src/lib/roomArt.ts')

const day = '/vet-cottage-day.png', night = '/vet-cottage-night.png'
function pngSize(path) {
  const bytes = fs.readFileSync('public' + path)
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}
assert.deepEqual(pngSize(day), pngSize(night), 'Day/night composition must not shift at sunset')
const size = pngSize(day)
assert.ok(size.width >= 768 && Math.abs(size.width / size.height - 9 / 16) < 0.01)
assert.equal(crypto.createHash('sha256').update(fs.readFileSync('public' + day)).digest('hex'),
  '25b7e316493f19f5b2a7c24d718b5b1059474e6327662e7e05f2bdcd5c6cfb94', 'Keep the exact picture selected by the owner')
for (const room of ['vet', 'hospital']) {
  assert.equal(roomArt(room, false), day)
  assert.equal(roomArt(room, true), night)
}
for (const [file, room] of [['VetScene', 'vet'], ['HospitalScene', 'hospital']]) {
  const source = fs.readFileSync(`src/components/care/${file}.tsx`, 'utf8')
  assert.ok(source.includes(`roomArt('${room}', isDark)`))
  assert.doesNotMatch(source, /vetBACK|wetDark/, 'Do not bypass the shared room-art mapping')
}
assert.match(fs.readFileSync('src/components/closet/ClosetView.tsx', 'utf8'), /roomArt\(room.id, dark\)/)
const sw = fs.readFileSync('public/sw.js', 'utf8')
const ast = ts.createSourceFile('sw.js', sw, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
let precache
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'PRECACHE_IMAGES') precache = vm.runInNewContext(node.initializer.getText(ast))
  ts.forEachChild(node, visit)
}
visit(ast)
assert.ok(precache.includes(day) && precache.includes(night), 'Both paintings must work offline')
assert.match(sw, /const IMAGE_ASSET_EPOCH = 'a1'/, 'Do not force a complete art-cache download for two new filenames')
console.log('Vet artwork checks passed: exact selected day picture, matched portrait dimensions, shared day/night art, outfit preview consistency and offline precache without a full cache reset.')
