import type { CSSProperties, ReactNode } from 'react'
import { HEADER_CLEARANCE, NAV_HEIGHT, NAV_PAGE_PADDING } from '@/components/meadow/tokens'

export type LoadingLayout = 'room' | 'arcade' | 'game' | 'machine' | 'counter' | 'kiosk'
  | 'profile' | 'couple' | 'settings' | 'notes' | 'photos' | 'list' | 'collection'
  | 'closet' | 'rewards' | 'chat' | 'form' | 'document' | 'rows' | 'parlour' | 'tray' | 'portrait' | 'items'

const TAB_PAGES = new Set(['/home', '/couple', '/games', '/profile'])
const BACK_PAGES = new Set(['/settings', '/closet', '/gacha/collection', '/hallway', '/bucket-list', '/rewards', '/jelly', '/trophies'])

export function loadingLayoutForPath(path: string): LoadingLayout {
  const route = path.split(/[?#]/)[0].replace(/\/$/, '') || '/'
  if (route.startsWith('/games/')) return 'game'
  if (route === '/games') return 'arcade'
  if (route === '/gacha/collection' || route === '/trophies') return 'collection'
  if (route === '/gacha') return 'machine'
  if (route === '/shawarma') return 'kiosk'
  if (route === '/bakery') return 'counter'
  if (route === '/jelly') return 'parlour'
  if (route.startsWith('/jelly/')) return 'game'
  if (route === '/closet') return 'closet'
  if (route === '/profile') return 'profile'
  if (route === '/couple') return 'couple'
  if (route === '/settings' || route === '/care/reminders') return 'settings'
  if (route === '/notes') return 'notes'
  if (route === '/memories' || route === '/hallway') return 'photos'
  if (route === '/bucket-list') return 'list'
  if (route === '/rewards') return 'rewards'
  if (route === '/talk') return 'chat'
  if (route.startsWith('/auth/') || route === '/onboarding') return 'form'
  if (['/privacy', '/terms', '/delete-account'].includes(route)) return 'document'
  return 'room'
}

export function SkeletonBlock({ width = '100%', height = 16, circle = false, style }: {
  width?: CSSProperties['width']; height?: CSSProperties['height']; circle?: boolean; style?: CSSProperties
}) {
  return <span aria-hidden="true" className="eren-skeleton-block" style={{
    display: 'block', width, height, borderRadius: circle ? 999 : 6, flexShrink: 0, ...style,
  }} />
}

function Lines({ count = 2 }: { count?: number }) {
  return <div className="eren-skeleton-lines">{Array.from({ length: count }, (_, i) =>
    <SkeletonBlock key={i} width={i === count - 1 ? '62%' : '88%'} height={i === 0 ? 16 : 12} />,
  )}</div>
}

function Panel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="eren-skeleton-panel" style={style}>{children}</div>
}

function Rows({ count = 5, toggles = false }: { count?: number; toggles?: boolean }) {
  return <Panel>{Array.from({ length: count }, (_, i) => <div className="eren-skeleton-row" key={i}>
    <SkeletonBlock width={38} height={38} circle /><Lines />
    {toggles && <SkeletonBlock width={42} height={24} circle />}
  </div>)}</Panel>
}

function Tiles({ photos = false, count = 6 }: { photos?: boolean; count?: number }) {
  return <div className="eren-skeleton-grid">{Array.from({ length: count }, (_, i) =>
    <Panel key={i}><SkeletonBlock height="auto" style={{ aspectRatio: photos ? '4 / 3' : '1 / 1' }} /><Lines /></Panel>,
  )}</div>
}

function JellyTray() {
  const arch = [{ x: 10, y: 112 }, { x: 27, y: 52 }, { x: 50, y: 30 }, { x: 73, y: 52 }, { x: 90, y: 112 }]
  return <Panel><div style={{ height: 186, position: 'relative' }}>
    {arch.map((at, i) => <SkeletonBlock key={i} width={46} height={46} circle style={{ position: 'absolute', left: `calc(${at.x}% - 23px)`, top: at.y - 23 }} />)}
    <SkeletonBlock width={96} height={86} style={{ position: 'absolute', left: 'calc(50% - 48px)', bottom: 0 }} />
  </div><Lines /><SkeletonBlock height={48} /></Panel>
}

function HomeRoom() {
  return <>
    <div className="eren-home-stage" data-loading-anchor="home-stage">
      <div className="eren-home-stats">
        <SkeletonBlock width={48} height={48} circle style={{ position: 'absolute', left: 0, top: 0 }} />
        <div className="eren-home-needs">
          {Array.from({ length: 5 }, (_, i) => <SkeletonBlock key={i} height="auto" circle style={{ flex: '1 1 0', minWidth: 0, maxWidth: 32, aspectRatio: '1' }} />)}
        </div>
        <SkeletonBlock width={74} height={40} circle style={{ position: 'absolute', right: 0, top: 4 }} />
      </div>
      <div className="eren-home-hud" data-loading-anchor="home-hud">
        <SkeletonBlock height={36} circle style={{ flex: 1, minWidth: 0 }} />
        {Array.from({ length: 5 }, (_, i) => <SkeletonBlock key={i} width={36} height={36} circle />)}
      </div>
      <div className="eren-home-cat" data-loading-anchor="home-cat">
        <SkeletonBlock width={160} height={176} style={{ borderRadius: 12 }} />
      </div>
      <div className="eren-home-places" data-loading-anchor="home-places">
        {Array.from({ length: 4 }, (_, i) => <div key={i}>
          <SkeletonBlock width={44} height={44} circle />
          <SkeletonBlock width={i === 2 ? 66 : 48} height={20} />
        </div>)}
      </div>
    </div>
    <div className="eren-home-tabs" data-loading-anchor="home-tabs">
      {Array.from({ length: 5 }, (_, i) => <div key={i}>
        <SkeletonBlock width={22} height={22} /><SkeletonBlock width={30} height={8} />
      </div>)}
    </div>
  </>
}

function Portrait() {
  return <div className="eren-skeleton-closet"><Panel style={{ padding: 12, gap: 12 }}>
    <SkeletonBlock height={248} /><Lines /><SkeletonBlock height={46} />
  </Panel></div>
}

function ItemShelf({ top = 24 }: { top?: number }) {
  return <div className="eren-skeleton-item-shelf">
    <SkeletonBlock width="42%" height={12} style={{ margin: `${top}px 8px 12px` }} />
    <div className="eren-skeleton-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
      {Array.from({ length: 6 }, (_, i) => <Panel key={i} style={{ padding: 6, gap: 6 }}>
        <SkeletonBlock height="auto" style={{ aspectRatio: '1' }} /><SkeletonBlock width="74%" height={12} />
      </Panel>)}
    </div>
  </div>
}

function Room({ scene }: { scene: string }) {
  if (scene === 'home') return <HomeRoom />
  const table = ['feed', 'chemistry', 'vet', 'hospital', 'garden'].includes(scene)
  return <div className="eren-skeleton-room" data-scene={scene}>
    <div className="eren-skeleton-row" style={{ padding: 0 }}>
      <SkeletonBlock width={44} height={44} circle /><Lines /><SkeletonBlock width={82} height={34} circle />
    </div>
    <div className="eren-skeleton-needs">{Array.from({ length: 5 }, (_, i) => <SkeletonBlock key={i} width={42} height={42} circle />)}</div>
    <div className="eren-skeleton-room-stage">
      <SkeletonBlock width="27%" height={76} style={{ position: 'absolute', left: '8%', top: '9%' }} />
      <SkeletonBlock width="22%" height={112} style={{ position: 'absolute', right: '8%', top: '5%' }} />
      <SkeletonBlock width={86} height={112} style={{ position: 'absolute', left: 'calc(50% - 43px)', bottom: table ? '32%' : '20%', borderRadius: '35% 35% 18% 18%' }} />
      {(table || scene === 'sleep' || scene === 'wash') && <SkeletonBlock width="84%" height={scene === 'sleep' ? 100 : 64} style={{ position: 'absolute', bottom: '13%', left: '8%' }} />}
      <SkeletonBlock width="74%" height={12} style={{ position: 'absolute', bottom: '8%', left: '13%', opacity: .45 }} />
    </div>
    <div className="eren-skeleton-actions">{Array.from({ length: scene === 'home' ? 4 : 2 }, (_, i) => <SkeletonBlock key={i} height={48} style={{ flex: 1, minWidth: 0 }} />)}</div>
  </div>
}

function Game({ path }: { path: string }) {
  const kind = path.split('/').pop()
  const columns = kind === 'paw-doku' ? 9 : kind === 'tic-tac-toe' ? 3 : kind === 'eren-says' ? 2 : 4
  const board = ['memory-match', 'tic-tac-toe', 'paw-doku', 'eren-says', 'yarn-pop'].includes(kind ?? '')
  return <>
    <div className="eren-skeleton-actions"><SkeletonBlock height={44} /><SkeletonBlock height={44} /></div>
    {board ? <div className="eren-skeleton-board" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {Array.from({ length: columns * columns }, (_, i) => <SkeletonBlock key={i} height="auto" style={{ aspectRatio: '1' }} />)}
    </div> : kind === 'yarn-sort' ? <div className="eren-skeleton-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', padding: '60px 12px' }}>
      {Array.from({ length: 8 }, (_, i) => <SkeletonBlock key={i} height={120} style={{ borderRadius: '6px 6px 22px 22px' }} />)}
    </div> : <SkeletonBlock height="auto" style={{ aspectRatio: '3 / 4', maxHeight: 430, margin: '28px 0' }} />}
    <SkeletonBlock width={74} height={88} style={{ margin: '16px auto' }} />
  </>
}

function Contents({ layout, path, scene }: { layout: LoadingLayout; path: string; scene: string }) {
  switch (layout) {
    case 'room': return <Room scene={scene} />
    case 'arcade': return <><Panel><Lines /><SkeletonBlock height={8} /><div className="eren-skeleton-actions"><SkeletonBlock height={40} /><SkeletonBlock height={40} /></div></Panel><Tiles count={8} /></>
    case 'game': return <Game path={path} />
    case 'machine': return <><SkeletonBlock height={44} circle /><div className="eren-skeleton-machine"><SkeletonBlock width="76%" height={40} style={{ margin: '0 auto' }} /><SkeletonBlock height="100%" style={{ borderRadius: '44% 44% 35% 35%' }} /><SkeletonBlock width="76%" height={90} style={{ margin: '0 auto' }} /></div><Panel><SkeletonBlock height={8} /><div className="eren-skeleton-actions"><SkeletonBlock height={58} /><SkeletonBlock height={58} /></div></Panel></>
    case 'counter': return <><SkeletonBlock height={40} width="65%" style={{ margin: '12px auto 40px' }} /><div className="eren-skeleton-grid" style={{ marginTop: 'auto' }}>{Array.from({ length: 4 }, (_, i) => <SkeletonBlock key={i} height={100} />)}</div><SkeletonBlock height={24} /><Panel><Lines /><SkeletonBlock height={48} /></Panel></>
    case 'parlour': return <><JellyTray /><Tiles count={2} /></>
    case 'tray': return <JellyTray />
    case 'kiosk': return <><SkeletonBlock width="66%" height={42} style={{ margin: '0 auto 30px' }} /><SkeletonBlock height={200} /><div className="eren-skeleton-actions"><SkeletonBlock height={108} /><SkeletonBlock height={108} /></div><Panel><Lines count={3} /><SkeletonBlock height={48} /></Panel></>
    case 'profile': return <><Panel style={{ padding: '20px 18px 16px', gap: 0 }}><div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>{[0, 1, 2].map(i => i === 1 ? <SkeletonBlock key={i} width="38%" height={36} circle style={{ marginTop: 12 }} /> : <div key={i} style={{ width: 64, display: 'grid', justifyItems: 'center', gap: 6 }}><SkeletonBlock width={60} height={60} circle /><SkeletonBlock width={44} height={16} /></div>)}</div><SkeletonBlock height={1} style={{ margin: '16px 0 14px' }} /><SkeletonBlock width={140} height={18} style={{ margin: '0 auto' }} /></Panel><div className="eren-skeleton-grid">{[0, 1, 2, 3].map(i => <Panel key={i}><SkeletonBlock width="62%" height={12} /><SkeletonBlock width={48} height={28} /><SkeletonBlock height={6} /></Panel>)}</div><div className="eren-skeleton-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', marginTop: 8 }}>{[0, 1, 2, 3].map(i => <div key={i} style={{ display: 'grid', justifyItems: 'center', gap: 10 }}><SkeletonBlock width={60} height={60} /><SkeletonBlock width="76%" height={24} /></div>)}</div></>
    case 'couple': return <><Panel><div className="eren-skeleton-row" style={{ justifyContent: 'space-around' }}><SkeletonBlock width={72} height={72} circle /><SkeletonBlock width={72} height={72} circle /></div><SkeletonBlock width="60%" height={20} style={{ margin: '0 auto' }} /><SkeletonBlock height={8} /></Panel><Rows count={2} /><Panel><Lines count={3} /><SkeletonBlock height={46} /></Panel></>
    case 'settings': return <><SkeletonBlock width="35%" height={12} /><Rows count={3} toggles /><SkeletonBlock width="28%" height={12} style={{ marginTop: 14 }} /><Rows count={4} toggles /></>
    case 'notes': return <><SkeletonBlock height={48} /><Tiles count={4} /></>
    case 'photos': return <Tiles photos count={6} />
    case 'list': return <><Panel><Lines /><SkeletonBlock height={8} /><SkeletonBlock height={48} /></Panel><Rows count={5} /></>
    case 'rows': return <Rows count={5} />
    case 'closet': return <><SkeletonBlock width="36%" height={12} style={{ margin: '8px 8px 0' }} /><div className="eren-skeleton-actions">{[0, 1, 2, 3].map(i => <div key={i} style={{ flex: 1, display: 'grid', justifyItems: 'center', gap: 6 }}><SkeletonBlock width={60} height={60} /><SkeletonBlock width={46} height={12} /></div>)}</div><SkeletonBlock height={40} /><Portrait /></>
    case 'portrait': return <Portrait />
    case 'items': return <ItemShelf />
    case 'collection': return <><Panel><Lines /><SkeletonBlock height={8} /></Panel><SkeletonBlock height={40} /><ItemShelf top={8} /></>
    case 'rewards': return <><Panel><div className="eren-skeleton-row"><SkeletonBlock width={64} height={64} circle /><Lines count={3} /></div><SkeletonBlock height={8} /></Panel><Rows count={5} /></>
    case 'chat': return <><div className="eren-skeleton-row"><SkeletonBlock width={44} height={44} circle /><Lines /><SkeletonBlock width={40} height={40} circle /></div><SkeletonBlock height={8} />{[0, 1, 2, 3].map(i => <SkeletonBlock key={i} width={i % 2 ? '64%' : '78%'} height={i % 2 ? 48 : 76} style={{ margin: i % 2 ? '8px 0 8px auto' : '8px 0', borderRadius: 8 }} />)}<SkeletonBlock height={48} style={{ marginTop: 'auto' }} /></>
    case 'form': return <><SkeletonBlock width={80} height={96} style={{ margin: '26px auto' }} /><SkeletonBlock width="60%" height={28} style={{ margin: '0 auto 24px' }} /><Panel><Lines /><SkeletonBlock height={48} /><Lines /><SkeletonBlock height={48} /><SkeletonBlock height={48} style={{ marginTop: 10 }} /></Panel></>
    case 'document': return <>{[0, 1, 2, 3].map(i => <Panel key={i}><Lines count={5} /></Panel>)}</>
  }
}

const STYLES = `
  @keyframes erenSkeletonShimmer { 0%,10% { transform: translateX(-100%); } 90%,100% { transform: translateX(100%); } }
  .eren-skeleton-block { position: relative; overflow: hidden; isolation: isolate; background: var(--skeleton-ink, #dedfdb); max-width: 100%; }
  .eren-skeleton-block::after { content: ''; position: absolute; inset: 0; pointer-events: none; border-radius: inherit; background: linear-gradient(100deg, transparent 20%, var(--skeleton-shine, rgba(255,255,255,.65)) 50%, transparent 80%); transform: translateX(-100%); animation: erenSkeletonShimmer 2s cubic-bezier(.4,0,.2,1) infinite; }
  .eren-skeleton-content { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .eren-skeleton-panel { display: flex; flex-direction: column; gap: 14px; padding: 16px; background: var(--skeleton-panel, #fff); border-radius: 8px; min-width: 0; }
  .eren-skeleton-lines { display: flex; flex-direction: column; gap: 9px; flex: 1; min-width: 0; }
  .eren-skeleton-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; min-width: 0; }
  .eren-skeleton-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .eren-skeleton-actions { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .eren-skeleton-actions > .eren-skeleton-block { flex: 1; min-width: 0; }
  .eren-skeleton-board { display: grid; gap: 5px; margin: 30px 0 4px; }
  .eren-skeleton-closet { width: 272px; max-width: 100%; margin: 18px auto 0; }
  .eren-skeleton-machine { display: grid; grid-template-rows: 40px minmax(110px, 1fr) 90px; gap: 8px; flex: 1; min-height: 256px; padding: 0 20px; }
  .eren-loading-page { position: fixed; inset: 0; z-index: 45; display: flex; flex-direction: column; overflow: hidden; background: #f4f4f1; padding: max(56px, calc(var(--safe-top, 0px) + 12px)) 16px calc(32px + env(safe-area-inset-bottom, 0px)); }
  .eren-loading-page[data-nav="true"] { padding-bottom: ${NAV_PAGE_PADDING}; }
  .eren-loading-page[data-layout="room"][data-scene="home"] { padding: 0; }
  .eren-loading-page[data-layout="kiosk"] { background: #191f1c; --skeleton-ink: #3b4840; --skeleton-panel: #252e28; --skeleton-shine: rgba(255,255,255,.12); }
  .eren-loading-page[data-embedded="true"] { position: absolute; }
  .eren-loading-page > .eren-skeleton-content { flex: 1; min-height: 0; }
  .eren-skeleton-heading { display: flex; flex-shrink: 0; align-items: center; justify-content: space-between; gap: 16px; height: 44px; margin-bottom: 18px; }
  .eren-skeleton-back-heading { flex-shrink: 0; margin-bottom: 18px; }
  .eren-skeleton-back-heading > .eren-skeleton-heading { margin: 0; }
  .eren-home-stage { position: absolute; top: 0; left: 0; right: 0; bottom: ${NAV_HEIGHT}; }
  .eren-home-stats { position: absolute; top: calc(var(--safe-top, 0px) + 6px); left: 16px; right: 16px; height: 48px; }
  .eren-home-needs { position: absolute; left: 82px; right: 82px; top: 0; height: 48px; display: flex; align-items: center; gap: 8px; padding: 0 8px; border-radius: 999px; background: #fff; }
  .eren-home-hud { position: absolute; left: 16px; right: 16px; top: calc(var(--safe-top, 0px) + ${HEADER_CLEARANCE}px); height: 36px; display: flex; gap: 6px; }
  .eren-home-cat { position: absolute; bottom: 10%; left: 50%; transform: translateX(-50%); width: 200px; height: 200px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 16px; }
  .eren-home-places { position: absolute; left: 0; right: 0; bottom: 8px; height: 70px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 0 16px; }
  .eren-home-places > div { display: flex; align-items: center; flex-direction: column; gap: 6px; min-width: 0; }
  .eren-home-tabs { position: absolute; bottom: 0; left: 0; right: 0; height: ${NAV_HEIGHT}; display: flex; gap: 0; padding: 6px 8px max(24px, env(safe-area-inset-bottom, 0px)); background: #fff; border-top: 1px solid #ece8e1; }
  .eren-home-tabs > div { flex: 1; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 6px; height: 50px; }
  .eren-skeleton-room { display: flex; flex-direction: column; min-height: 460px; height: 100%; }
  .eren-skeleton-needs { display: flex; justify-content: space-around; gap: 8px; margin: 24px 0 8px; }
  .eren-skeleton-room-stage { position: relative; flex: 1; min-height: 270px; border-bottom: 2px solid #e5e6e2; margin-bottom: 24px; }
  @media (prefers-reduced-motion: reduce) { .eren-skeleton-block::after { animation: none; display: none; } }
`

/** Use inside an already-rendered page; keep usable cached results visible. */
export function SkeletonContent({ layout = 'list', path = '', scene = 'home', label = 'Loading content' }: {
  layout?: LoadingLayout; path?: string; scene?: string; label?: string
}) {
  return <div role="status" aria-busy="true" aria-label={label} className="eren-skeleton-content" data-loading-layout={layout}>
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className="eren-skeleton-content" style={{ flex: 1 }}><Contents layout={layout} path={path} scene={scene} /></div>
    <style>{STYLES}</style>
  </div>
}

/** Pure markup: App Router can stream the destination layout before its JS arrives. */
export function PageSkeleton({ path = '/home', scene = 'home', label = 'Loading page', embedded = false }: {
  path?: string; scene?: string; label?: string; embedded?: boolean
}) {
  const layout = loadingLayoutForPath(path)
  const route = path.split(/[?#]/)[0].replace(/\/$/, '') || '/home'
  const back = BACK_PAGES.has(route)
  const withNav = TAB_PAGES.has(route) && (layout !== 'room' || scene === 'home')
  return <div className="eren-loading-page" data-layout={layout} data-scene={layout === 'room' ? scene : undefined} data-nav={withNav || undefined} data-embedded={embedded || undefined}>
    {layout !== 'room' && (back ? <div className="eren-skeleton-back-heading" aria-hidden="true">
      <div className="eren-skeleton-heading"><SkeletonBlock width={44} height={44} circle /><SkeletonBlock width={40} height={40} circle /></div>
      <SkeletonBlock width="42%" height={34} style={{ margin: '12px 0 0 8px' }} />
    </div> : <div className="eren-skeleton-heading" aria-hidden="true"><SkeletonBlock width="42%" height={26} /><SkeletonBlock width={40} height={40} circle /></div>)}
    <SkeletonContent layout={layout} path={path} scene={scene} label={label} />
  </div>
}
