const assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),createLoader=require('./lib/load_ts.cjs')
const mocks={'@/hooks/useCat':{useCat:()=>({name:'Mochi',sex:'male',t:text=>text.replace('{name}','Mochi').replaceAll('{him}','him').replaceAll('{his}','his'),p:{him:'him',his:'his'}})},'@/hooks/useReducedMotion':{useReducedMotion:()=>true}}
const load=createLoader(mocks),{JELLIES}=load('src/lib/jellies.ts')
mocks['@/components/meadow']={...load('src/components/meadow/tokens.ts'),...load('src/components/meadow/Card.tsx'),
  ...load('src/components/meadow/Buttons.tsx'),...load('src/components/meadow/Chips.tsx'),MeadowIcon:load('src/components/PixelIcons.tsx').MeadowIcon}
const Tray=load('src/components/jelly/ParlourTray.tsx').default
const props={tray:JELLIES.map(jelly=>({jelly,filled:true})),count:5,size:5,supers:1,fed:4,goal:5,ownsSkin:false,busy:false,loading:false,onFeed(){},onOpenCloset(){}}
const html=extra=>renderToStaticMarkup(React.createElement(Tray,{...props,...extra}))
assert.match(html({}),/Open kitchen/)
const recovery=html({supers:0,fed:5,ownsSkin:true,feedPending:true,feedError:'Could not confirm the feed.'})
assert.match(recovery,/Open kitchen/);assert.match(recovery,/role="alert"/);assert.doesNotMatch(recovery,/>Wear it</)
assert.match(html({feedPending:true,loading:true,supers:0}),/Open kitchen/)
assert.match(html({busy:true}),/aria-busy="true"/)
assert.match(html({ownsSkin:true,supers:0}),/Wear it/)
assert.doesNotMatch(html({ownsSkin:false,supers:0}),/Open kitchen/)
assert.match(html({feedError:'Super Jelly feeding needs an update. Nothing was spent.'}),/Nothing was spent/)
console.log('Super Jelly UI passed: ready, busy, loading, last-jelly recovery, fifth-skin recovery, empty and missing-update states.')
const Shelf=load('src/components/jelly/SuperJellyShelf.tsx').default,Feed=load('src/components/jelly/SuperJellyFeed.tsx').default
const shelf=extra=>renderToStaticMarkup(React.createElement(Shelf,{count:1,fed:4,goal:5,loaded:true,busy:false,pending:false,error:null,disabled:false,sleeping:false,onFeed(){},...extra}))
assert.match(shelf({}),/Feed Super Jelly to Mochi/);assert.match(shelf({}),/jelly_super.png/)
assert.equal(shelf({count:0}),'');assert.match(shelf({count:0,pending:true}),/Recover Super Jelly feed/)
assert.match(shelf({count:0,pending:true,sleeping:true}),/Recover feed/)
assert.match(shelf({sleeping:true}),/Mochi is asleep/);assert.match(shelf({busy:true}),/aria-busy="true"/)
assert.match(shelf({loaded:false}),/Checking/);assert.match(shelf({error:'Nothing was spent.'}),/role="alert"/)
const fed=snack=>renderToStaticMarkup(React.createElement(Feed,{fed:3,goal:5,supersLeft:0,snack,onClose(){}}))
assert.doesNotMatch(fed(),/surprise for later/)
for(const food_key of load('src/lib/jellies.ts').SUPER_JELLY_SNACKS){const result=fed({food_key,quantity:1});assert.match(result,/A surprise for later/);assert.match(result,/One added to your fridge/);assert.doesNotMatch(result,/undefined/)}
console.log('Super Jelly fridge UI passed: ready, asleep, loading, busy, zero-stock recovery, no fabricated legacy gifts and five snack reveals.')
