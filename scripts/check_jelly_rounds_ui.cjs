const assert=require('node:assert/strict'),fs=require('node:fs'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),loadFactory=require('./lib/load_ts.cjs')
const mocks={'@/hooks/useReducedMotion':{useReducedMotion:()=>true},'@/hooks/useCat':{useCat:()=>({name:'Mochi',t:t=>t,p:{him:'him'}})}}
const load=loadFactory(mocks)
mocks['@/components/meadow']={...load('src/components/meadow/tokens.ts'),...load('src/components/meadow/Buttons.tsx'),MeadowIcon:load('src/components/PixelIcons.tsx').MeadowIcon}
const Recovery=load('src/components/jelly/JellyRoundRecovery.tsx').default,Prize=load('src/components/jelly/JellyPrize.tsx').default
const recovery=props=>renderToStaticMarkup(React.createElement(Recovery,{saving:false,error:null,onRetry(){},onExit(){},...props}))
assert.match(recovery({}),/Recover Jelly round/);assert.match(recovery({}),/Your round is waiting/)
assert.match(recovery({saving:true}),/Saving your round/);assert.match(recovery({saving:true}),/aria-busy="true"/)
assert.match(recovery({error:'Your round is kept for retry.'}),/role="alert"/)
const {JELLIES}=load('src/lib/jellies.ts'),wins=JELLIES.slice(0,2).map((jelly,i)=>({jelly,effect:jelly.effects[0],isNew:true,mintedSuper:i===0,trayCount:5}))
const html=renderToStaticMarkup(React.createElement(Prize,{score:300,best:300,isBest:true,unit:'M',threshold:220,duel:{theirName:'Partner',theirsToday:200,tookLead:true},wins,awardFailed:false,trayCount:5,traySize:5,onPlayAgain(){},onExit(){}}))
assert.match(html,/Strawberry Wobble/i);assert.match(html,/Apple Fizz/i);assert.match(html,/DUEL BONUS/);assert.match(html,/kitchen fridge for Mochi/)
for(const game of ['run','jump']){const source=fs.readFileSync(`src/app/(app)/jelly/${game}/page.tsx`,'utf8')
  assert.match(source,/await round.finish\(final\)/);assert.match(source,/if \(!round.clear\(\)\) return/);assert.match(source,/onRetry=\{\(\) => \{ void round.retry\(\) \}\}/)
  assert.doesNotMatch(source,/duel\.submit|awardJelly\(|applyAction\(|completeTask\(/)}
console.log('Jelly round UI: waiting/saving/error recovery, two prizes/fifth-slot fridge message, and both actual game-end integrations passed.')
