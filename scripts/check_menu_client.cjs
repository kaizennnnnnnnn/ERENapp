const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript')
const createLoader=require('./lib/load_ts.cjs'),base=createLoader()
const {writeWithRetry}=base('src/lib/supabaseRetry.ts'),{dailyMenu}=base('src/lib/foodMenu.ts')
const USER='menu-user',HOME='menu-home',OTHER='other-home',DAY='2026-11-06',PROFILE='eren:profile-updated'
const clone=v=>JSON.parse(JSON.stringify(v)),deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return {promise,resolve}}
function reactFixture(){
  const states=[],refs=[],callbacks=[],effects=[],memos=[];let si,ri,ci,ei,mi,scheduled,dirty=false,live=true,late=0
  const changed=(p,d)=>!p||d.some((v,i)=>!Object.is(v,p.deps[i]))
  return {
    useState(initial){const i=si++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],v=>{if(!live)late++;const next=typeof v==='function'?v(states[i]):v;if(!Object.is(states[i],next)){states[i]=next;dirty=true}}]},
    useRef(initial){const i=ri++;return refs[i]??(refs[i]={current:initial})},
    useCallback(fn,deps){const i=ci++;if(changed(callbacks[i],deps))callbacks[i]={fn,deps};return callbacks[i].fn},
    useMemo(fn,deps){const i=mi++;if(changed(memos[i],deps))memos[i]={value:fn(),deps};return memos[i].value},
    useEffect(setup,deps){const i=ei++,old=effects[i];if(changed(old,deps))scheduled.push(()=>{old?.cleanup?.();effects[i]={deps,cleanup:setup()}})},
    render(run){si=ri=ci=ei=mi=0;scheduled=[];dirty=false;const value=run();scheduled.forEach(fn=>fn());return value},
    unmount(){effects.forEach(e=>e?.cleanup?.());live=false},get dirty(){return dirty},get late(){return late},
  }
}
function fixture(options={}){
  const react=reactFixture(),storage=options.storage??new Map(),events=[],foreground=new Set(),calls=[],jobs=new Set(),receipts=options.receipts??new Map()
  const state={userId:USER,home:HOME,day:DAY,coins:10,proof:[],claimed:new Set(),mode:'ok',hold:null,raw:null,
    stats:{household_id:HOME,menu_state:null,food_by_user:{[USER]:{milk:1}},food_inventory:{}},patches:[]}
  Object.assign(state,options.state)
  global.sessionStorage={get length(){return storage.size},key:i=>[...storage.keys()][i],getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}
  global.CustomEvent=class{constructor(type,{detail}){this.type=type;this.detail=detail}}
  global.window={dispatchEvent:event=>events.push(event)};global.document={visibilityState:'visible'}
  const client={from(){throw Error('Menu must not split writes')},rpc(name,args){return {abortSignal:async signal=>{
    assert.equal(name,'claim_menu_bonus_atomic');assert.ok(signal instanceof AbortSignal);calls.push(clone(args))
    if(state.mode==='missing')return {data:null,error:{code:'PGRST202'}}
    if(state.mode==='throw')throw Error('offline')
    if(state.raw)return clone(state.raw)
    let result=receipts.get(args.p_request_id)
    if(result)assert.deepEqual(args,result.args)
    else if(args.p_day!==state.day)return {data:{ok:false,reason:'period_changed',day:args.p_day},error:null}
    else{
      const menu=dailyMenu(args.p_day,args.p_household_id),done=menu.filter(k=>state.proof.includes(k)),key=args.p_household_id+':'+args.p_day
      const awarded=done.length===3&&!state.claimed.has(key)?30:0
      if(awarded){state.coins+=30;state.claimed.add(key)}
      result={args:clone(args),data:{ok:true,user_id:args.p_expected_user,household_id:args.p_household_id,day:args.p_day,
        coins:state.coins,awarded,menu_state:{day:args.p_day,done,claimed_at:state.claimed.has(key)?'2026-11-06T12:00:00Z':null}}}
      if(awarded)receipts.set(args.p_request_id,result)
    }
    const hold=state.hold;if(hold)await hold.promise
    if(state.mode==='lost')return {data:null,error:{message:'lost reply'}}
    return {data:clone(result.data),error:null}
  }}}}
  const acceptMenuState=next=>{state.stats={...state.stats,menu_state:clone(next)};state.patches.push(clone(next));return true}
  const bounded=(...args)=>{const job=writeWithRetry(...args);jobs.add(job);job.finally(()=>jobs.delete(job));return job}
  const load=createLoader({react,'./useAuth':{useAuth:()=>({user:state.userId?{id:state.userId}:null}),PROFILE_UPDATED_EVENT:PROFILE},
    './useErenStats':{useErenStats:()=>({stats:state.stats,acceptMenuState})},'@/lib/supabase/client':{createClient:()=>client},
    './supabaseRetry':{writeWithRetry:bounded},'@/lib/seededRng':{todayKey:()=>state.day},
    '@/lib/onForeground':{onForeground:fn=>{foreground.add(fn);return()=>foreground.delete(fn)}}})
  const {useFoodMenu}=load('src/hooks/useFoodMenu.ts'),saves=load('src/lib/menuSaves.ts')
  const h={state,calls,events,storage,receipts,foreground,react,saves,client,
    render(){return react.render(()=>useFoodMenu(state.home))},
    async settle(){let value;for(let i=0;i<30;i++){value=h.render();await new Promise(resolve=>setImmediate(resolve));
      if(jobs.size&&!state.hold)await Promise.all([...jobs]);if(!react.dirty&&!jobs.size)return value}
      throw Error(`Menu effect failed to settle: ${calls.length} calls, ${jobs.size} pending`)},unmount:()=>react.unmount()}
  h.render();return h
}
const tests=[],test=(name,run)=>tests.push({name,run})
test('initial reconciliation and all three saved meals adopt only confirmed progress and coins',async()=>{
  const h=fixture();let v=await h.settle();assert.deepEqual(v.progress,[false,false,false]);assert.equal(h.calls.length,1)
  for(const [i,key]of dailyMenu(DAY,HOME).entries()){
    h.state.proof.push(key);h.state.stats={...h.state.stats,food_by_user:{[USER]:{milk:i+2}}}
    v=await h.settle();assert.equal(v.progress.filter(Boolean).length,i+1)
  }
  assert.equal(v.claimed,true);assert.equal(h.state.coins,40);assert.equal(h.receipts.size,1)
  assert.equal(h.events.filter(e=>e.type===PROFILE).at(-1).detail.patch.coins,40);h.unmount()
})
test('missing RPC and transport failure settle without optimistic markers, coins or retry loops',async()=>{
  for(const mode of ['missing','throw']){
    const h=fixture({state:{mode,proof:dailyMenu(DAY,HOME)}});const v=await h.settle()
    assert.equal(v.claimed,false);assert.equal(v.busy,false);assert.ok(v.error);assert.equal(h.state.patches.length,0);assert.equal(h.events.length,0)
    const count=h.calls.length;await h.settle();assert.equal(h.calls.length,count,'Rerender must not auto-retry forever')
    h.state.mode='ok';assert.equal(await v.refresh(),true);assert.equal((await h.settle()).claimed,true);h.unmount()
  }
})
test('lost payout replies recover the same receipt after reload, without another bonus',async()=>{
  let h=fixture({state:{mode:'lost',proof:dailyMenu(DAY,HOME)}});let v=await h.settle()
  assert.equal(v.claimed,false);assert.equal(h.events.length,0);assert.equal(h.state.coins,40);assert.equal(h.storage.size,1)
  const original=clone(h.calls[0]),storage=h.storage,receipts=h.receipts,claimed=h.state.claimed;h.unmount()
  h=fixture({storage,receipts,state:{coins:40,claimed,proof:dailyMenu(DAY,HOME)}});v=await h.settle()
  assert.deepEqual(h.calls[0],original);assert.equal(v.claimed,true);assert.equal(h.state.coins,40);assert.equal(storage.size,0);h.unmount()
})
test('same-tick refreshes are locked and a meal arriving during a request triggers one follow-up',async()=>{
  const h=fixture();await h.settle();const hold=deferred();h.state.hold=hold
  const view=h.render(),before=h.calls.length,first=view.refresh();assert.equal(await view.refresh(),false)
  h.state.proof.push(dailyMenu(DAY,HOME)[0]);h.state.stats={...h.state.stats,food_by_user:{[USER]:{milk:3}}};h.render()
  h.state.hold=null;hold.resolve();await first;const v=await h.settle()
  assert.equal(h.calls.length,before+2);assert.equal(v.progress.filter(Boolean).length,1);h.unmount()
})
test('foreground refresh and identical realtime food objects do not produce a query loop',async()=>{
  const h=fixture();await h.settle();const before=h.calls.length
  h.state.stats=clone(h.state.stats);await h.settle();assert.equal(h.calls.length,before)
  for(const fn of h.foreground)fn();await h.settle();assert.equal(h.calls.length,before+1)
  h.unmount();assert.equal(h.foreground.size,0)
})
test('account/household switches and unmounts ignore late results and never patch the wrong scope',async()=>{
  for(const mode of ['unmount','household','user']){
    const h=fixture();await h.settle();const hold=deferred();h.state.hold=hold;const pending=h.render().refresh()
    if(mode==='unmount')h.unmount()
    else{h.state.hold=null;if(mode==='household'){h.state.home=OTHER;h.state.stats={...h.state.stats,household_id:OTHER}}else h.state.userId='other-user';h.render()}
    const count=h.events.length;hold.resolve();assert.equal(await pending,false)
    if(mode==='unmount')assert.equal(h.events.length,count)
    else{await h.settle();for(const e of h.events.slice(count))assert.equal(e.detail.id,h.state.userId);h.unmount()}
    assert.equal(h.react.late,0)
  }
})
test('old pending requests are reconciled before the displayed new day, even without a prior payout',async()=>{
  const h=fixture({state:{mode:'lost'}});await h.settle();assert.equal(h.storage.size,1)
  h.state.mode='ok';h.state.day='2026-11-07';for(const fn of h.foreground)fn()
  const v=await h.settle();assert.equal(v.day,'2026-11-07');assert.equal(v.error,null);assert.equal(h.storage.size,0)
  assert.equal(h.calls.at(-1).p_day,'2026-11-07');h.unmount()
})
test('invalid/wrong-scope successful responses never patch menu state or wallet',async()=>{
  for(const patch of [{user_id:'wrong'},{household_id:OTHER},{coins:'40'},{menu_state:null}]){
    const data={ok:true,user_id:USER,household_id:HOME,day:DAY,coins:40,menu_state:{day:DAY,done:[],claimed_at:null},...patch}
    const h=fixture({state:{raw:{data,error:null}}});const v=await h.settle();assert.ok(v.error);assert.equal(h.events.length,0);assert.equal(h.state.patches.length,0);h.unmount()
  }
})
test('actual shared-stats adapter accepts only menu data from its captured current scope',()=>{
  const source=ts.createSourceFile('stats.ts',fs.readFileSync('src/hooks/useErenStats.ts','utf8'),ts.ScriptTarget.Latest,true)
  let declaration;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(source)==='acceptMenuState')declaration=n;ts.forEachChild(n,visit)}visit(source);assert.ok(declaration)
  const statsRef={current:{household_id:HOME,hunger:20,food_by_user:{[USER]:{milk:2}}}},foodScope={current:{householdId:HOME,userId:USER}}
  let state=statsRef.current
  const bindings={useCallback:fn=>fn,householdId:HOME,userId:USER,statsRef,foodScope,setStats:fn=>{state=fn(state)}}
  const code=ts.transpileModule('const '+declaration.getText(source)+';return acceptMenuState',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText
  const accept=new Function(...Object.keys(bindings),code)(...Object.values(bindings)),next={day:DAY,done:['milk'],claimed_at:null}
  assert.equal(accept(next),true);assert.equal(state.hunger,20);assert.equal(state.food_by_user[USER].milk,2);assert.deepEqual(state.menu_state,next)
  foodScope.current.householdId=OTHER;assert.equal(accept({...next,claimed_at:'now'}),false);assert.equal(state.menu_state.claimed_at,null)
})
test('menu paid label depends on the confirmed claim, and no old split writes remain',()=>{
  const ui=fs.readFileSync('src/components/wish/TodaysMenu.tsx','utf8'),stats=fs.readFileSync('src/hooks/useErenStats.ts','utf8'),hook=fs.readFileSync('src/hooks/useFoodMenu.ts','utf8')
  assert.ok(ui.includes("claimed ? 'Paid'"));assert.ok(ui.includes('onRetry'))
  assert.ok(!stats.includes('writeMenuState'));assert.ok(!stats.includes('noteMenuFed'));assert.ok(!stats.includes('claimMenu'))
  assert.ok(!hook.includes('addCoins('));assert.ok(!hook.includes('.update('))
})
async function main(){
  const globals=Object.fromEntries(['sessionStorage','window','document','CustomEvent'].map(k=>[k,Object.getOwnPropertyDescriptor(global,k)]))
  const timeout=setTimeout,interval=setInterval,clear=clearInterval
  global.setTimeout=(fn,delay,...args)=>timeout(fn,delay===800||delay===1600?0:delay,...args);global.setInterval=()=>1;global.clearInterval=()=>{}
  let failed=0;try{for(const {name,run}of tests){try{await run();console.log('PASS '+name)}catch(error){failed++;console.error('FAIL '+name,error)}}}
  finally{global.setTimeout=timeout;global.setInterval=interval;global.clearInterval=clear;for(const [key,d]of Object.entries(globals)){if(d)Object.defineProperty(global,key,d);else delete global[key]}}
  console.log(`Menu client: ${tests.length-failed}/${tests.length} passed (actual hook/helper; mock transport)`);if(failed)process.exitCode=1
}
main().catch(error=>{console.error(error);process.exitCode=1})
