const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const createLoader=require('./lib/load_ts.cjs')
const base=createLoader()
const {writeWithRetry}=base('src/lib/supabaseRetry.ts')
const {FORTUNE_GIFTS,canClaimFortune}=base('src/lib/fortune.ts')
const USER='fortune-user',OTHER='other-user',PROFILE='eren:profile-updated'
const clone=v=>JSON.parse(JSON.stringify(v))
const today=()=>new Date().toISOString()
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return {promise,resolve}}
function reactFixture(){
  const states=[],refs=[],callbacks=[],effects=[];let si,ri,ci,ei,scheduled,mounted=true,late=0
  const changed=(p,d)=>!p||d.some((v,i)=>!Object.is(v,p.deps[i]))
  return {
    useState(initial){const i=si++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],v=>{if(!mounted)late++;states[i]=typeof v==='function'?v(states[i]):v}]},
    useRef(initial){const i=ri++;return refs[i]??(refs[i]={current:initial})},
    useCallback(fn,deps){const i=ci++;if(changed(callbacks[i],deps))callbacks[i]={fn,deps};return callbacks[i].fn},
    useEffect(setup,deps){const i=ei++,previous=effects[i];if(changed(previous,deps))scheduled.push(()=>{previous?.cleanup?.();effects[i]={deps,cleanup:setup()}})},
    render(run){si=ri=ci=ei=0;scheduled=[];const result=run();scheduled.forEach(fn=>fn());return result},
    unmount(){effects.forEach(e=>e?.cleanup?.());mounted=false},get lateUpdates(){return late},
  }
}
function server(){
  const users=new Map([USER,OTHER].map(id=>[id,{coins:10,stardust:0,gacha_tickets:0,last_free_fortune:null,mutations:0}]))
  const receipts=new Map(),calls=[],reads=[]
  const s={users,receipts,calls,reads,mode:'ok',readMode:'ok',gift:FORTUNE_GIFTS[0],hold:null,readHold:null,raw:null,
    client:{
      from(table){assert.equal(table,'user_gacha_state');let id,signal;const q={
        select(cols){assert.equal(cols,'last_free_fortune');return q},eq(col,v){assert.equal(col,'user_id');id=v;return q},
        abortSignal(value){signal=value;assert.ok(signal instanceof AbortSignal);return q},
        async maybeSingle(){reads.push({id,signal});const hold=s.readHold;if(hold)return hold.promise;if(s.readMode==='error')return {data:null,error:{code:'503'}};
          return {data:{last_free_fortune:users.get(id)?.last_free_fortune??null},error:null}},
      };return q},
      rpc(name,args){return {abortSignal:async signal=>{
        assert.equal(name,'claim_fortune_atomic');assert.ok(signal instanceof AbortSignal);calls.push(clone(args))
        const hold=s.hold;if(hold)await hold.promise
        if(s.mode==='throw')throw Error('offline')
        if(s.mode==='missing')return {data:null,error:{code:'PGRST202'}}
        if(s.raw)return clone(s.raw)
        const u=users.get(args.p_expected_user),gift=s.gift
        let receipt=receipts.get(args.p_request_id)
        if(!receipt){
          if(u.last_free_fortune&&!canClaimFortune(u.last_free_fortune))return {data:{ok:false,reason:'cooldown',last_free_fortune:u.last_free_fortune},error:null}
          u.coins+=gift.coinValue??0;u.stardust+=gift.stardustValue??0;u.gacha_tickets+=gift.gachaTickets??0;u.last_free_fortune=today();u.mutations++
          receipt={args:clone(args),gift_id:gift.id,claimed_at:u.last_free_fortune};receipts.set(args.p_request_id,receipt)
        }
        assert.deepEqual(args,receipt.args,'Every retry must preserve the original actor, timezone and receipt')
        if(s.mode==='lost')return {data:null,error:{message:'lost reply'}}
        return {data:{ok:true,user_id:args.p_expected_user,...clone(u),gift_id:receipt.gift_id,claimed_at:receipt.claimed_at},error:null}
      }}},
    },
  };return s
}
function fixture(options={}){
  const react=reactFixture(),s=options.server??server(),session=options.session??new Map(),local=options.local??new Map()
  if(options.readMode)s.readMode=options.readMode
  const events=[],listeners=new Map(),pending=[],foreground=new Set(),state={userId:options.userId===undefined?USER:options.userId}
  global.sessionStorage={get length(){return session.size},key:i=>[...session.keys()][i],getItem:k=>session.get(k)??null,setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)}
  global.localStorage={getItem:k=>{if(options.blockedStorage)throw Error('blocked');return local.get(k)??null},setItem:(k,v)=>{if(options.blockedStorage)throw Error('blocked');local.set(k,v)},removeItem:k=>{if(options.blockedStorage)throw Error('blocked');local.delete(k)}}
  global.CustomEvent=class{constructor(type,{detail}){this.type=type;this.detail=detail}}
  global.window={addEventListener:(name,fn)=>{if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn)},removeEventListener:(name,fn)=>listeners.get(name)?.delete(fn),
    dispatchEvent:event=>{events.push(event);for(const fn of listeners.get(event.type)??[])fn(event)}}
  global.document={visibilityState:'visible'}
  const bounded=(...args)=>{const task=writeWithRetry(...args);pending.push(task);return task}
  const load=createLoader({react,'@/hooks/useAuth':{useAuth:()=>({user:state.userId?{id:state.userId}:null}),PROFILE_UPDATED_EVENT:PROFILE},
    './useAuth':{useAuth:()=>({user:state.userId?{id:state.userId}:null}),PROFILE_UPDATED_EVENT:PROFILE},
    '@/lib/supabase/client':{createClient:()=>s.client},'@/lib/supabaseRetry':{writeWithRetry:bounded},'./supabaseRetry':{writeWithRetry:bounded},
    '@/lib/onForeground':{onForeground:fn=>{foreground.add(fn);return ()=>foreground.delete(fn)}},...options.mocks})
  const {useFortune}=load('src/hooks/useFortune.ts'),helpers=load('src/lib/fortuneSaves.ts')
  const h={s,session,local,events,listeners,foreground,helpers,state,
    render(id=state.userId){state.userId=id;return react.render(()=>useFortune())},
    async drain(){while(pending.length)await Promise.all(pending.splice(0));await new Promise(resolve=>setImmediate(resolve))},
    async settle(){await h.drain();return h.render()},unmount:()=>react.unmount(),get lateUpdates(){return react.lateUpdates}}
  h.render();return h
}
const tests=[];const test=(name,run)=>tests.push({name,run})
test('all 18 confirmed gifts reveal the real gift, adopt saved coins and preserve shower event order',async()=>{
  for(const gift of FORTUNE_GIFTS){
    const h=fixture({blockedStorage:true});h.s.gift=gift
    assert.equal((await h.settle()).canClaim,true)
    assert.equal((await h.render().claimFortune()).id,gift.id)
    const v=await h.settle();assert.equal(v.claiming,false);assert.equal(v.canClaim,false);assert.equal(v.lastGift.id,gift.id)
    const names=h.events.map(e=>e.type)
    assert.deepEqual(names,gift.coinValue?['eren:coin-claim',PROFILE,'eren:fortune-saved']:[PROFILE,'eren:fortune-saved'])
    assert.equal(h.events.find(e=>e.type===PROFILE).detail.patch.coins,10+(gift.coinValue??0))
    assert.equal(h.s.users.get(USER).mutations,1);h.unmount()
  }
})
test('lost replies keep a pending recovery despite a saved cooldown, including fresh-module reload',async()=>{
  let h=fixture();await h.settle();h.s.mode='lost'
  assert.equal(await h.render().claimFortune(),null)
  let v=await h.settle();assert.equal(v.recoverable,true);assert.equal(v.canClaim,true);assert.equal(v.claiming,false);assert.equal(h.events.length,0)
  assert.equal(h.s.calls.length,3);assert.equal(h.s.users.get(USER).mutations,1)
  const s=h.s,session=h.session,original=clone(s.calls[0]);h.unmount()
  h=fixture({server:s,session});v=await h.settle();assert.equal(v.recoverable,true);assert.equal(v.canClaim,true)
  s.mode='ok';assert.ok(await v.claimFortune());assert.equal((await h.settle()).canClaim,false)
  assert.deepEqual(s.calls[3],original);assert.equal(s.users.get(USER).mutations,1);assert.equal(session.size,0);h.unmount()
})
test('same-tick double taps share one request and cannot roll a second gift',async()=>{
  const h=fixture();await h.settle();const hold=deferred();h.s.hold=hold
  const view=h.render(),first=view.claimFortune();assert.equal(await view.claimFortune(),null)
  await Promise.resolve();assert.equal(h.s.calls.length,1);hold.resolve()
  assert.ok(await first);assert.equal((await h.settle()).claiming,false);assert.equal(h.s.users.get(USER).mutations,1);h.unmount()
})
test('shared save helper coalesces simultaneous instances for the same user',async()=>{
  const h=fixture();await h.settle();const hold=deferred();h.s.hold=hold
  const a=h.helpers.saveFortune(h.s.client,USER),b=h.helpers.saveFortune(h.s.client,USER)
  assert.equal(h.s.calls.length,1);hold.resolve();assert.equal((await a).gift_id,(await b).gift_id)
  assert.equal(h.s.users.get(USER).mutations,1);h.unmount()
})
test('missing RPCs and transport failures never reveal or locally stamp gifts; busy always releases',async()=>{
  for(const mode of ['missing','throw']){
    const h=fixture();await h.settle();h.s.mode=mode
    assert.equal(await h.render().claimFortune(),null)
    const v=await h.settle();assert.equal(v.claiming,false);assert.equal(v.lastGift,null);assert.equal(h.events.length,0);assert.equal(h.local.size,0)
    assert.equal(h.s.users.get(USER).mutations,0);assert.equal(v.recoverable,mode==='throw')
    h.s.mode='ok';assert.ok(await v.claimFortune());h.unmount()
  }
})
test('failed or malformed availability reads fail closed even with an expired cache and can refresh',async()=>{
  for(const stamp of [null,'2000-01-01T00:00:00Z']){
    const h=fixture({readMode:'error',local:new Map([['eren_fortune_last_'+USER,stamp]])})
    let v=await h.settle();assert.equal(v.canClaim,false);assert.equal(v.loaded,false);assert.equal(v.readError,true)
    assert.equal(await v.claimFortune(),null);assert.equal(h.s.calls.length,0)
    h.s.readMode='ok';await v.refresh();v=await h.settle();assert.equal(v.canClaim,true);assert.equal(v.readError,false);h.unmount()
  }
  const h=fixture();h.s.users.get(USER).last_free_fortune='not-a-date';await h.render().refresh()
  assert.equal((await h.settle()).canClaim,false);assert.equal(h.render().readError,true);h.unmount()
})
test('late reads cannot undo a claim or a newer read',async()=>{
  const h=fixture();await h.settle();const old=deferred();h.s.readHold=old
  const read=h.render().refresh();h.s.readHold=null
  assert.ok(await h.render().claimFortune())
  old.resolve({data:{last_free_fortune:null},error:null});await read
  assert.equal((await h.settle()).canClaim,false);h.unmount()
})
test('account switches and unmounts discard late claims without events or state changes',async()=>{
  for(const action of ['unmount','switch']){
    const h=fixture();await h.settle();const hold=deferred();h.s.hold=hold
    const request=h.render().claimFortune()
    if(action==='unmount')h.unmount()
    else{h.s.hold=null;h.render(OTHER);await new Promise(resolve=>setImmediate(resolve));assert.ok(await h.render().claimFortune())}
    const events=h.events.length;hold.resolve();assert.equal(await request,null);assert.equal(h.events.length,events)
    if(action==='switch'){assert.equal((await h.settle()).claiming,false);h.unmount()}
    assert.equal(h.lateUpdates,0)
  }
})
test('cooldown refusal shows the confirmed cooldown without a reward; invalid responses never reveal',async()=>{
  const h=fixture();await h.settle();h.s.users.get(USER).last_free_fortune=today()
  assert.equal(await h.render().claimFortune(),null);assert.equal((await h.settle()).canClaim,false);assert.equal(h.events.length,0);h.unmount()
  for(const patch of [{user_id:OTHER},{gift_id:'invented'},{coins:'20'},{last_free_fortune:'invalid'}]){
    const h=fixture();await h.settle();h.s.raw={data:{ok:true,user_id:USER,gift_id:FORTUNE_GIFTS[0].id,coins:20,last_free_fortune:today(),...patch},error:null}
    assert.equal(await h.render().claimFortune(),null);assert.equal(h.events.length,0);assert.equal((await h.settle()).lastGift,null);h.unmount()
  }
})
test('saved/storage/foreground refresh is scoped to the actor; anonymous hooks do not query',async()=>{
  const h=fixture();await h.settle();const count=h.s.reads.length
  window.dispatchEvent(new CustomEvent('eren:fortune-saved',{detail:{userId:OTHER}}));await h.drain();assert.equal(h.s.reads.length,count)
  h.s.users.get(USER).last_free_fortune=today()
  window.dispatchEvent(new CustomEvent('eren:fortune-saved',{detail:{userId:USER}}));assert.equal((await h.settle()).canClaim,false)
  assert.equal(h.foreground.size,1);h.unmount();assert.equal(h.foreground.size,0)
  for(const listeners of h.listeners.values())assert.equal(listeners.size,0)
  const anon=fixture({userId:null});assert.equal((await anon.settle()).canClaim,false);assert.equal(anon.s.reads.length,0);anon.unmount()
})
test('future and invalid cached timestamps never unlock a gift',()=>{
  assert.equal(canClaimFortune(null),true);assert.equal(canClaimFortune('invalid'),false)
  assert.equal(canClaimFortune(new Date(Date.now()+86400000).toISOString()),false)
  assert.equal(canClaimFortune(today()),false);assert.equal(canClaimFortune(new Date(Date.now()-172800000).toISOString()),true)
})
test('recovered coin reveal releases the actual HUD claim flag even with an unchanged balance',()=>{
  const source=ts.createSourceFile('header.tsx',fs.readFileSync('src/components/StatsHeader.tsx','utf8'),ts.ScriptTarget.Latest,true)
  let handler;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(source)==='onBurst')handler=n;ts.forEachChild(n,visit)}visit(source);assert.ok(handler)
  const coinClaimRef={current:true},awaitingBurstRef={current:false},flights=[]
  const bindings={coinClaimRef,awaitingBurstRef,launchCoinFlight:x=>flights.push(x),coinCountFor:x=>x}
  const code=ts.transpileModule('const '+handler.getText(source)+';return onBurst',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText
  const onBurst=new Function(...Object.keys(bindings),code)(...Object.values(bindings))
  onBurst({detail:{x:1,y:2,amount:10}})
  assert.equal(coinClaimRef.current,false);assert.equal(flights.length,1)
})
test('actual popup handler has a same-tick lock, unmount guard and recoverable failure state',async()=>{
  const source=ts.createSourceFile('popup.tsx',fs.readFileSync('src/components/fortune/FortunePopup.tsx','utf8'),ts.ScriptTarget.Latest,true)
  let handler;function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='handleClaim')handler=n;ts.forEachChild(n,visit)}visit(source);assert.ok(handler)
  for(const unmount of [false,true]){
    const phases=[],hold=deferred(),alive={current:true};let calls=0
    const bindings={canClaim:true,claiming:false,claimLock:{current:false},alive,playSound:()=>{},setFailed:()=>{},setPhase:p=>phases.push(p),setGift:()=>{},
      claimFortune:()=>{calls++;return hold.promise},timers:{current:[]}}
    const code=ts.transpileModule(handler.getText(source)+'\nreturn handleClaim',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText
    const run=new Function(...Object.keys(bindings),code)(...Object.values(bindings))
    const first=run();await run();assert.equal(calls,1);if(unmount)alive.current=false;hold.resolve(null);await first
    assert.equal(bindings.claimLock.current,false);assert.deepEqual(phases,unmount?['shake']:['shake','intro'])
  }
  const hook=fs.readFileSync('src/hooks/useFortune.ts','utf8')
  for(const forbidden of ['rollFortuneGift','.upsert(','.insert(','.update(','addCoins('])assert.ok(!hook.includes(forbidden),forbidden)
})
async function main(){
  const keys=['sessionStorage','localStorage','window','document','CustomEvent']
  const globals=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(global,k)]))
  const timeout=global.setTimeout,interval=global.setInterval,clear=global.clearInterval
  global.setTimeout=(fn,delay,...args)=>timeout(fn,delay===800||delay===1600?0:delay,...args)
  global.setInterval=()=>1;global.clearInterval=()=>{}
  let failed=0
  try{for(const {name,run} of tests){try{await run();console.log('PASS '+name)}catch(error){failed++;console.error('FAIL '+name,error)}}}
  finally{global.setTimeout=timeout;global.setInterval=interval;global.clearInterval=clear;for(const [key,descriptor] of Object.entries(globals)){if(descriptor)Object.defineProperty(global,key,descriptor);else delete global[key]}}
  console.log(`Fortune client: ${tests.length-failed}/${tests.length} passed (actual hook/helper; mock transport)`);if(failed)process.exitCode=1
}
main().catch(error=>{console.error(error);process.exitCode=1})
