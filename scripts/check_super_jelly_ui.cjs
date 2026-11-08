const assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),createLoader=require('./lib/load_ts.cjs')
const mocks={'@/hooks/useCat':{useCat:()=>({t:text=>text.replace('{name}','Mochi').replaceAll('{him}','him').replaceAll('{his}','his'),p:{him:'him',his:'his'}})}}
const load=createLoader(mocks),{JELLIES}=load('src/lib/jellies.ts')
mocks['@/components/meadow']={...load('src/components/meadow/tokens.ts'),...load('src/components/meadow/Card.tsx'),
  ...load('src/components/meadow/Buttons.tsx'),...load('src/components/meadow/Chips.tsx'),MeadowIcon:load('src/components/PixelIcons.tsx').MeadowIcon}
const Tray=load('src/components/jelly/ParlourTray.tsx').default
const props={tray:JELLIES.map(jelly=>({jelly,filled:true})),count:5,size:5,supers:1,fed:4,goal:5,ownsSkin:false,busy:false,loading:false,onFeed(){},onOpenCloset(){}}
const html=extra=>renderToStaticMarkup(React.createElement(Tray,{...props,...extra}))
assert.match(html({}),/Feed Mochi/)
const recovery=html({supers:0,fed:5,ownsSkin:true,feedPending:true,feedError:'Could not confirm the feed.'})
assert.match(recovery,/Recover Super Jelly feed/);assert.match(recovery,/Retry feed/);assert.match(recovery,/role="alert"/);assert.doesNotMatch(recovery,/>Wear it</)
assert.match(html({feedPending:true,loading:true,supers:0}),/Recover Super Jelly feed/)
assert.match(html({busy:true}),/aria-busy="true"/)
assert.match(html({ownsSkin:true,supers:0}),/Wear it/)
assert.doesNotMatch(html({ownsSkin:false,supers:0}),/Feed Mochi|Retry feed/)
assert.match(html({feedError:'Super Jelly feeding needs an update. Nothing was spent.'}),/Nothing was spent/)
console.log('Super Jelly UI passed: ready, busy, loading, last-jelly recovery, fifth-skin recovery, empty and missing-update states.')
