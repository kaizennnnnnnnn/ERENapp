// Renders WeatherFx to a standalone HTML page, with no Next dev server in the
// loop (this repo lives in a OneDrive folder and .next gets corrupted under it).
// TypeScript transpiles the component, react-dom/server renders it, and the
// result is dropped into a page that reproduces every aperture it ships into.
//
//   node scripts/build_weather_harness.js  ->  scripts/weather_shots/harness.html
const fs = require('fs')
const path = require('path')
const ts = require('typescript')
const React = require('react')
const ReactDOMServer = require('react-dom/server')

const ROOT = path.join(__dirname, '..')
const OUT = path.join(__dirname, 'weather_shots')
fs.mkdirSync(OUT, { recursive: true })

// ── transpile the component ────────────────────────────────────────────────
const src = fs.readFileSync(path.join(ROOT, 'src/components/weather/WeatherFx.tsx'), 'utf8')
const js = ts.transpileModule(src, {
  compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
}).outputText

const tmp = path.join(OUT, '_WeatherFx.gen.js')
fs.writeFileSync(tmp, js)
const WeatherFx = require(tmp).default

// ── the apertures it actually ships into ───────────────────────────────────
const { ROOM_WINDOWS } = (() => {
  const wsrc = fs.readFileSync(path.join(ROOT, 'src/lib/roomWindows.ts'), 'utf8')
  const wjs = ts.transpileModule(wsrc, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const f = path.join(OUT, '_roomWindows.gen.js')
  fs.writeFileSync(f, wjs)
  return require(f)
})()

const VW = 400, VH = 850   // a phone
const KINDS = process.argv.slice(2)
const kinds = KINDS.length ? KINDS : ['rain', 'storm']

function box(room, win) {
  const scale = Math.max(VW / win.art.w, VH / win.art.h)
  return {
    w: Math.round(win.box.w * win.art.w * scale),
    h: Math.round(win.box.h * win.art.h * scale),
  }
}

// ── the real thing: room art with its window cut drawn back over the sky ───
// This is exactly what RoomWeather builds — a cover box at the picture's own
// aspect, the effect inside the aperture, the cut on top at full size.
let rooms = ''
for (const id of (process.env.WX_ROOMS ? kinds : [])) {
  rooms += `<div class="row"><div class="tag">${id} ROOMS</div>`
  for (const [room, win] of Object.entries(ROOM_WINDOWS)) {
    const scale = Math.max(VW / win.art.w, VH / win.art.h)
    const bw = win.art.w * scale, bh = win.art.h * scale
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(WeatherFx, { id, lit: true }))
    const cut = 'file://' + path.join(ROOT, 'public/weather', room + '.png').split(path.sep).join('/')
    // The room's own painting, so the wash and the streaks are judged against
    // the sky the artist actually painted rather than against a black page.
    const ART = { home: 'livingRoom.png', feed: 'kitchen.png', play: 'playroom.png',
      sleep: 'bedroom.png', wash: 'bathroom.png', chemistry: 'ChemistryDay.png',
      talk: 'AtticDay.png' }
    const artFile = path.join(ROOT, 'public', ART[room] || '')
    const art = fs.existsSync(artFile)
      ? 'file://' + artFile.split(path.sep).join('/') : ''
    rooms += `<div class="cell"><div class="lbl">${room}</div>`
      + `<div class="phone" style="width:${VW}px;height:${VH}px">`
      + `<div class="cover" style="width:${bw}px;height:${bh}px;margin-left:${(VW - bw) / 2}px;margin-top:${(VH - bh) / 2}px">`
      + (art ? `<img src="${art}" style="position:absolute;inset:0;width:100%;height:100%">` : '')
      + `<div class="pane" style="left:${win.box.l * 100}%;top:${win.box.t * 100}%;width:${win.box.w * 100}%;height:${win.box.h * 100}%;position:absolute">${html}</div>`
      + `<img src="${cut}" style="position:absolute;inset:0;width:100%;height:100%">`
      + `</div></div></div>`
  }
  rooms += `</div>`
}

let body = ''
for (const still of [false, true]) {
  for (const id of kinds) {
    body += `<div class="row"><div class="tag">${id}${still ? ' STILL' : ''}</div>`
    for (const [room, win] of Object.entries(ROOM_WINDOWS)) {
      const { w, h } = box(room, win)
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(WeatherFx, { id, still, lit: true }))
      body += `<div class="cell"><div class="lbl">${room} ${w}x${h}</div>`
        + `<div class="pane" style="width:${w}px;height:${h}px">${html}</div></div>`
    }
    for (const [tw, th] of [[46, 26], [64, 52]]) {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(WeatherFx, { id, still }))
      body += `<div class="cell"><div class="lbl">tile${th}</div>`
        + `<div class="pane" style="width:${tw}px;height:${th}px">${html}</div></div>`
    }
    body += `</div>`
  }
}

const page = `<!doctype html><meta charset="utf-8"><style>
  body { margin:0; padding:10px; background:#101018; font:9px ui-monospace,monospace; }
  .row { display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; margin-bottom:16px; }
  .tag { color:#ff0; font-weight:700; font-size:12px; width:92px; }
  .lbl { color:#9cf; }
  .pane { position:relative; overflow:hidden; container-type:size; outline:1px solid #555; }
  .phone { position:relative; overflow:hidden; outline:1px solid #555; }
  .cover { position:relative; }
</style>${rooms}${body}`

const file = path.join(OUT, 'harness.html')
fs.writeFileSync(file, page)
console.log(file)
