// Every sky, in the real window, over the real painting — cropped to the glass.
//
// build_weather_harness.js renders whole 400x850 phones side by side, which is
// 2800px of page for one row and unreadable once downscaled. This one crops each
// cell to the window aperture plus a margin, so eleven skies across four rooms
// fit on one sheet you can actually judge a WASH on: does the treeline, the
// mountain, the moon still show through, or did the effect paint over them.
//
//   node scripts/build_wx_wash.js [ids...]   ->  scripts/weather_shots/wash.html
//   node scripts/shoot_wx_wash.js <tag>
const fs = require('fs')
const path = require('path')
const ts = require('typescript')
const React = require('react')
const ReactDOMServer = require('react-dom/server')

const ROOT = path.join(__dirname, '..')
const OUT = path.join(__dirname, 'weather_shots')
fs.mkdirSync(OUT, { recursive: true })

function load(rel, out) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
  const js = ts.transpileModule(src, { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  } }).outputText
  const f = path.join(OUT, out)
  fs.writeFileSync(f, js)
  delete require.cache[require.resolve(f)]
  return require(f)
}

const WeatherFx = load('src/components/weather/WeatherFx.tsx', '_WeatherFx.wash.js').default
const { ROOM_WINDOWS } = load('src/lib/roomWindows.ts', '_roomWindows.wash.js')
const { WEATHER, roomIsNightOnly } = load('src/lib/weather.ts', '_weather.wash.js')

const VW = 400, VH = 850
// The day painting behind each window cut.
const ART = { home: 'livingRoom.png', feed: 'kitchen.png', play: 'playroom.png',
  sleep: 'bedroom.png', wash: 'bathroom.png', chemistry: 'ChemistryDay.png',
  talk: 'AtticDay.png' }

const ids = process.argv.slice(2).filter(a => !a.startsWith('--'))
const kinds = ids.length ? ids : WEATHER.map(w => w.id)
const rooms = (process.env.WX_ROOMS || 'home,sleep,feed,play').split(',')
const ZOOM = Number(process.env.WX_ZOOM || 0.62)
const PAD = 0.16   // margin around the aperture, as a fraction of it

function cell(id, room) {
  const win = ROOM_WINDOWS[room]
  const scale = Math.max(VW / win.art.w, VH / win.art.h)
  const bw = win.art.w * scale, bh = win.art.h * scale
  const x = win.box.l * bw, y = win.box.t * bh
  const w = win.box.w * bw, h = win.box.h * bh
  const mx = w * PAD, my = h * PAD
  const cw = Math.round((w + mx * 2) * ZOOM), ch = Math.round((h + my * 2) * ZOOM)

  // The bedroom is the one room that is always dark, so its skies must be
  // judged unlit — that is the whole reason this sheet exists.
  const lit = !roomIsNightOnly(room)
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(WeatherFx, { id, lit }))
  const file = f => 'file://' + path.join(ROOT, 'public', f).split(path.sep).join('/')
  const artFile = path.join(ROOT, 'public', ART[room] || '')
  const art = fs.existsSync(artFile) ? file(ART[room]) : ''
  const cut = file('weather/' + room + (lit ? '' : '') + '.png')

  return `<div class="cell"><div class="lbl">${room}</div>`
    + `<div class="crop" style="width:${cw}px;height:${ch}px">`
    + `<div class="cover" style="width:${bw}px;height:${bh}px;`
    + `transform:scale(${ZOOM});transform-origin:0 0;`
    + `margin-left:${-(x - mx) * ZOOM}px;margin-top:${-(y - my) * ZOOM}px">`
    + (art ? `<img src="${art}" class="fill">` : '')
    + `<div class="pane" style="left:${win.box.l * 100}%;top:${win.box.t * 100}%;`
    + `width:${win.box.w * 100}%;height:${win.box.h * 100}%">${html}</div>`
    + `<img src="${cut}" class="fill">`
    + `</div></div></div>`
}

let body = ''
for (const id of kinds) {
  body += `<div class="row"><div class="tag">${id}</div>`
  for (const room of rooms) body += cell(id, room)
  // the same sky at picker-tile size, which is the other place it ships
  for (const [tw, th] of [[64, 52]]) {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(WeatherFx, { id, plate: true }))
    body += `<div class="cell"><div class="lbl">tile</div>`
      + `<div class="pane tile" style="width:${tw}px;height:${th}px">${html}</div></div>`
  }
  body += `</div>`
}

fs.writeFileSync(path.join(OUT, 'wash.html'), `<!doctype html><meta charset="utf-8"><style>
  body { margin:0; padding:8px; background:#101018; font:10px ui-monospace,monospace; }
  .row { display:flex; gap:8px; align-items:flex-start; margin-bottom:10px; }
  .tag { color:#ff0; font-weight:700; font-size:12px; width:78px; flex:none; padding-top:12px; }
  .lbl { color:#9cf; height:12px; }
  .crop { position:relative; overflow:hidden; outline:1px solid #555; }
  .cover { position:relative; }
  .fill { position:absolute; inset:0; width:100%; height:100%; }
  .pane { position:absolute; overflow:hidden; container-type:size; }
  .tile { position:relative; outline:1px solid #555; }
</style><div id="sheet">${body}</div>`)
console.log(path.join(OUT, 'wash.html'))
