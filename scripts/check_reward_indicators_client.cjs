const assert=require('node:assert/strict'),fs=require('node:fs'),createLoader=require('./lib/load_ts.cjs')
const base=createLoader(),{PLAYABLE_MINIGAME_IDS}=base('src/lib/minigames.ts'),{GACHA_ITEMS}=base('src/lib/gacha.ts')
const {writeWithRetry,withRetry}=base('src/lib/supabaseRetry.ts')
const USER='indicator-user',HOME='indicator-home',NOW=Date.parse('2026-11-06T12:00:00Z')
const clone=v=>JSON.parse(JSON.stringify(v)),defer=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return{promise,resolve}}
const fixtures=[]
function hooks(){
  const states=[],refs=[],callbacks=[],effects=[];let si,ri,ci,ei,scheduled,dirty=false,live=true,late=0
  const changed=(p,d)=>!p||d.some((v,i)=>!Object.is(v,p.deps[i]))
  return{
    createContext:value=>({Provider:'context-provider',value}),
    useState(initial){const i=si++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],v=>{if(!live)late++;const n=typeof v==='function'?v(states[i]):v;if(!Object.is(states[i],n)){states[i]=n;dirty=true}}]},
    useRef:initial=>{const i=ri++;return refs[i]??(refs[i]={current:initial})},
    useCallback(fn,deps){const i=ci++;if(changed(callbacks[i],deps))callbacks[i]={fn,deps};return callbacks[i].fn},
    useEffect(setup,deps){const i=ei++,old=effects[i];if(changed(old,deps))scheduled.push(()=>{old?.cleanup?.();effects[i]={deps,cleanup:setup()}})},
    render(run){si=ri=ci=ei=0;scheduled=[];dirty=false;const v=run();scheduled.forEach(fn=>fn());return v},
    unmount(){effects.forEach(e=>e?.cleanup?.());live=false},get dirty(){return dirty},get late(){return late},
  }
}
function fixture(kind='provider',options={}){
  const react=hooks(),storage=options.storage??new Map(),session=options.session??new Map(),receipts=options.receipts??new Map(),calls=[],events=[],listeners=new Map(),foreground=new Set(),jobs=new Set(),intervals=new Map()
  const state={user:USER,home:HOME,path:'/home',scene:null,now:NOW,mode:'ok',hold:null,supers:0,weekly:0,pending:0,level:3,claimed:3,loading:false,
    nightMode:'missing',worked:false,bonusDue:0,energy:80,statsLoading:false,
    gacha:{user_id:USER,gacha_tickets:0,total_pulls:0,stardust:0,pulls_since_epic:0,pulls_since_legendary:0,last_free_food_gacha:null,last_free_donut:null,last_free_fortune:null},...options.state}
  Date.now=()=>state.now
  global.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v))}
  global.sessionStorage={get length(){return session.size},key:i=>Array.from(session.keys())[i],getItem:k=>session.get(k)??null,setItem:(k,v)=>session.set(k,String(v)),removeItem:k=>session.delete(k)}
  global.CustomEvent=class{constructor(type,opts){this.type=type;this.detail=opts?.detail}}
  global.document={visibilityState:'visible'}
  global.window={addEventListener:(type,fn)=>{if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn)},
    removeEventListener:(type,fn)=>listeners.get(type)?.delete(fn),
    dispatchEvent:event=>{events.push(event);for(const fn of listeners.get(event.type)??[])fn(event);return true}}
  const realSetInterval=global.setInterval,realClearInterval=global.clearInterval
  global.setInterval=(fn,ms)=>{const key={};intervals.set(key,{fn,ms});return key}
  global.clearInterval=key=>intervals.delete(key)
  const getGacha=actor=>state.gacha?.user_id===actor?clone(state.gacha):null
  const client={from(table){
    let actor=state.user,insert=null
    const q={select:()=>q,eq:(key,value)=>{if(key==='user_id')actor=value;return q},gt:()=>q,limit:()=>q,
      insert:value=>{insert=value;return q},
      then:(yes,no)=>{calls.push({table,actor,insert});const data=table==='user_gacha_state'?getGacha(actor):table==='jelly_progress'?{supers:state.supers}:Array.from({length:state.weekly},()=>({payout_coins:100}))
        return Promise.resolve({data,error:null}).then(yes,no)},
      maybeSingle:()=>q,
      single:async()=>{if(insert)state.gacha={...clone(insert),gacha_tickets:0,last_free_food_gacha:null,last_free_donut:null};return{data:getGacha(actor),error:null}}}
    return q
  },rpc(name,args){return{abortSignal:async signal=>{
    assert.ok(signal instanceof AbortSignal);calls.push({name,args:clone(args)})
    if(state.mode==='offline')throw Error('offline')
    if(name==='get_kiosk_night_status'){
      if(state.nightMode==='missing')return{data:null,error:{code:'PGRST202'}}
      if(state.nightMode==='offline')return{data:null,error:{code:'42501'}}
      const day=new Date(state.now-4*3600000).toISOString().slice(0,10),reset=new Date(day+'T04:00:00Z');reset.setUTCDate(reset.getUTCDate()+1)
      const data={ok:true,version:2,user_id:args.p_expected_user,household_id:args.p_household_id,night_date:day,time_zone:'UTC',
        server_time:new Date(state.now).toISOString(),starts_at:day+'T04:00:00Z',resets_at:reset.toISOString(),worked:state.worked,bonus_due:state.bonusDue,night_total:0,rows:[]}
      if(state.hold)await state.hold.promise
      if(state.nightMode==='bad-actor')data.user_id='other'
      if(state.nightMode==='bad-home')data.household_id='other'
      return{data,error:null}
    }
    if(name==='read_reward_indicators'){
      if(state.mode==='legacy')return{data:null,error:{code:'PGRST202'}}
      const data={ok:true,user_id:args.p_expected_user,gacha:getGacha(args.p_expected_user)??{last_free_donut:null,last_free_food_gacha:null,gacha_tickets:0},supers:state.supers,weekly:state.weekly}
      if(state.hold)await state.hold.promise
      if(state.mode==='bad-actor')data.user_id='somebody-else'
      return{data,error:null}
    }
    if(state.mode==='missing')return{data:null,error:{code:'PGRST202'}}
    let receipt=receipts.get(args.p_request_id)
    if(!receipt){
      const g=state.gacha,free=name==='claim_free_food_gacha_atomic',ticket=!free&&args.p_use_ticket
      if(free&&g.last_free_food_gacha&&Date.parse(g.last_free_food_gacha)+86400000>state.now)return{data:{ok:false,reason:'cooldown',state:clone(g)},error:null}
      if(free)assert.equal(args.p_expected_user,state.user)
      else {assert.equal(name,'pull_gacha_atomic');if(ticket)g.gacha_tickets--;else state.coins-=args.p_count===10?450:50}
      if(free)g.last_free_food_gacha=new Date(state.now).toISOString()
      g.total_pulls++;const item=GACHA_ITEMS.find(i=>i.category==='consumable')
      receipt={name,args:clone(args),data:{ok:true,coins:state.coins,results:[{itemId:item.id,isNew:true,stardustGained:0,isPity:false}],state:clone(g)}};receipts.set(args.p_request_id,receipt)
    }else{assert.equal(receipt.name,name);assert.deepEqual(receipt.args,args)}
    if(state.hold)await state.hold.promise
    if(state.mode==='lost')return{data:null,error:{message:'lost reply'}}
    const data={...clone(receipt.data),coins:state.coins,state:clone(state.gacha)}
    if(state.mode==='malformed')data.results=[]
    return{data,error:null}
  }}}}
  state.coins=options.state?.coins??500
  const track=fn=>(...args)=>{const p=fn(...args);jobs.add(p);p.finally(()=>jobs.delete(p));return p}
  const refetch=async()=>{}
  const load=createLoader({react,'next/navigation':{usePathname:()=>state.path},
    '@/hooks/useAuth':{useAuth:()=>({user:state.user?{id:state.user}:null,profile:state.user?{id:state.user,household_id:state.home,claimed_level:state.claimed}:null}),PROFILE_UPDATED_EVENT:'eren:profile-updated'},
    './useAuth':{useAuth:()=>({user:state.user?{id:state.user}:null}),PROFILE_UPDATED_EVENT:'eren:profile-updated'},
    './CareContext':{useCare:()=>({activeScene:state.scene})},'./TaskContext':{useTasks:()=>({pendingRewards:state.pending,level:state.level,loading:state.loading})},
    '@/contexts/TaskContext':{useTasks:()=>({coins:state.coins})},'./useErenStats':{useErenStats:()=>({refetch})},
    '@/hooks/useErenStats':{useErenStats:()=>({stats:{household_id:state.home,energy:state.energy},loading:state.statsLoading})},
    '@/lib/supabase/client':{createClient:()=>client},'./supabaseRetry':{writeWithRetry:track(writeWithRetry),withRetry:track(withRetry)},
    '@/lib/supabaseRetry':{writeWithRetry:track(writeWithRetry),withRetry:track(withRetry)},
    '@/lib/onForeground':{onForeground:fn=>{foreground.add(fn);return()=>foreground.delete(fn)}}})
  const run=kind==='provider'?()=>load('src/contexts/RewardIndicators.tsx').RewardIndicatorsProvider({children:null}).props.value:()=>load('src/hooks/useGacha.ts').useGacha()
  const h={state,calls,events,storage,session,receipts,react,foreground,intervals,client,
    helpers:load('src/lib/rewardIndicators.ts'),news:load('src/lib/rewardNews.ts'),journal:load('src/lib/savedRpc.ts'),
    render:()=>react.render(run),
    async settle(){let value;for(let i=0;i<80;i++){value=h.render();await new Promise(r=>setImmediate(r));if(jobs.size&&!state.hold)await Promise.all(Array.from(jobs));if(!react.dirty&&!jobs.size)return h.render()}throw Error('Indicator effects did not settle')},
    unmount(){react.unmount();global.setInterval=realSetInterval;global.clearInterval=realClearInterval}}
  fixtures.push(h);h.render();return h
}
const tests=[],test=(name,run)=>tests.push({name,run})
test('cooldowns distinguish unknown/invalid stamps, rolling 24h and future clocks',()=>{
  const h=fixture();const {untilFree,freeFoodWait,freeWaitLabel}=h.helpers
  assert.equal(untilFree(undefined,NOW),null);assert.equal(untilFree('bad',NOW),null);assert.equal(untilFree(null,NOW),0)
  assert.equal(untilFree(new Date(NOW-86400000).toISOString(),NOW),0);assert.equal(untilFree(new Date(NOW-86400000+1).toISOString(),NOW),1)
  assert.equal(untilFree(new Date(NOW+3600000).toISOString(),NOW),90000000)
  assert.equal(freeFoodWait({},NOW),null);assert.equal(freeWaitLabel(86400000),'24h 0m');h.unmount()
})
test('new games seed quietly, remain new until that game opens and do not cross accounts',async()=>{
  const h=fixture();let v=await h.settle();assert.deepEqual(v.newGames,[])
  h.unmount()
  const storage=new Map([['eren:seen-games:v1:'+USER,JSON.stringify(PLAYABLE_MINIGAME_IDS.filter(id=>id!=='purr_beat'))]])
  const n=fixture('provider',{storage,state:{path:'/games'}});v=await n.settle();assert.deepEqual(v.newGames,['purr_beat']);assert.ok(v.tabs.play)
  n.state.path='/games/purr-beat';v=await n.settle();assert.deepEqual(v.newGames,[])
  n.state.user='another-user';v=await n.settle();assert.deepEqual(v.newGames,[]);n.unmount()
})
test('confirmed readiness marks only actionable places; expiry and claim refresh clear the right dots',async()=>{
  const h=fixture('provider',{state:{supers:2,weekly:1,level:5,claimed:3}});let v=await h.settle()
  assert.ok(v.places['/bakery']);assert.ok(v.places['/gacha']);assert.ok(v.places['/jelly']);assert.ok(v.tabs.play);assert.ok(v.tabs.me)
  h.state.gacha.last_free_donut=new Date(NOW).toISOString();h.state.gacha.last_free_food_gacha=new Date(NOW).toISOString();h.state.supers=0
  for(const fn of h.foreground)fn();v=await h.settle();assert.deepEqual(v.places,{})
  h.state.now+=86400000;for(const timer of h.intervals.values())if(timer.ms===15000)timer.fn();v=await h.settle();assert.ok(v.places['/bakery']);assert.ok(v.places['/gacha']);h.unmount()
})
test('unread received rewards persist until the matching view opens and replay never marks seen rewards new again',async()=>{
  const h=fixture();await h.settle()
  h.news.receiveRewardNews(USER,'quests','task:feed:today');h.news.receiveRewardNews(USER,'profile','achievement:first')
  let v=await h.settle();assert.equal(v.news.quests,true);assert.equal(v.news.profile,true);assert.ok(v.tabs.me)
  v.markNewsSeen('quests');v=await h.settle();assert.equal(v.news.quests,false)
  h.news.receiveRewardNews(USER,'quests','task:feed:today');v=await h.settle();assert.equal(v.news.quests,false)
  h.state.path='/profile';v=await h.settle();assert.equal(v.news.profile,false)
  h.news.receiveRewardNews(USER,'kitchen','food:one');v=await h.settle();assert.equal(v.news.kitchen,true)
  h.state.scene='feed';v=await h.settle();assert.equal(v.news.kitchen,false)
  const storage=h.storage;h.unmount();const again=fixture('provider',{storage});v=await again.settle();assert.equal(v.news.quests,false);again.unmount()
})
test('bad/offline reads never invent free rewards; missing new SQL retains legacy donut/Jelly badges',async()=>{
  const h=fixture('provider',{state:{mode:'legacy',supers:1,gacha:{user_id:USER,last_free_donut:null,gacha_tickets:0}}});let v=await h.settle()
  assert.ok(v.places['/bakery']);assert.ok(v.places['/jelly']);assert.equal(v.places['/gacha'],undefined);h.unmount()
  for(const mode of ['offline','bad-actor']){const f=fixture('provider',{state:{mode}});v=await f.settle();assert.deepEqual(v.places,{});f.unmount()}
})
test('late status reads cannot paint another account or update an unmounted provider',async()=>{
  for(const unmount of [false,true]){
    const hold=defer(),h=fixture('provider',{state:{hold,supers:4}});await new Promise(r=>setImmediate(r))
    if(unmount)h.unmount();else{h.state.user='changed';h.state.hold=null;h.state.supers=0;assert.deepEqual(h.render().places,{})}
    hold.resolve();h.state.hold=null;const v=await h.settle();assert.equal(h.react.late,0)
    if(!unmount){assert.equal(v.places['/jelly'],undefined);h.unmount()}
  }
})
test('free food wins over held tickets and costs no coins, then normal ticket pulls still work',async()=>{
  const h=fixture('gacha',{state:{coins:0}});h.state.gacha.gacha_tickets=3;let v=await h.settle();assert.equal(v.freeFoodReady,true)
  await v.pullSingle('food',true);v=await h.settle();assert.equal(h.calls.filter(c=>c.name).at(-1).name,'claim_free_food_gacha_atomic')
  assert.equal(h.state.coins,0);assert.equal(h.state.gacha.gacha_tickets,3);assert.equal(v.freeFoodReady,false);assert.equal(h.news.readRewardNews(USER).kitchen.unread.length,1)
  await v.pullSingle('food',true);v=await h.settle();assert.equal(h.calls.filter(c=>c.name).at(-1).name,'pull_gacha_atomic');assert.equal(h.state.gacha.gacha_tickets,2);h.unmount()
})
test('lost free-pull replies recover the same food after reload despite the now-active cooldown',async()=>{
  let h=fixture('gacha',{state:{mode:'lost'}}),v=await h.settle();await v.pullSingle('food');v=await h.settle()
  assert.equal(v.retryPull.bannerId,'food');assert.equal(h.receipts.size,1);const first=h.calls.find(c=>c.name),session=h.session,storage=h.storage,receipts=h.receipts,state=clone(h.state)
  h.unmount();h=fixture('gacha',{session,storage,receipts,state:{...state,mode:'ok'}});v=await h.settle();assert.equal(v.freeFoodReady,false)
  await v.pullSingle('food');v=await h.settle();assert.equal(h.receipts.size,1);assert.deepEqual(h.calls.find(c=>c.name).args,first.args);assert.equal(v.retryPull,null);h.unmount()
})
test('same-tick pulls share one intent and malformed replies keep recovery instead of spending twice',async()=>{
  const h=fixture('gacha',{state:{mode:'malformed'}});let v=await h.settle()
  const one=v.pullSingle('food'),two=v.pullSingle('food');assert.equal(await two,null);await one;v=await h.settle()
  assert.equal(h.receipts.size,1);assert.ok(v.pullError);assert.equal(h.session.size,1)
  h.state.mode='ok';await v.pullSingle('food');v=await h.settle();assert.equal(h.receipts.size,1);assert.equal(h.session.size,0);h.unmount()
})
test('existing paid pull recovery takes precedence over a newly available daily free pull',async()=>{
  const h=fixture('gacha',{state:{mode:'lost'}});await h.settle()
  const saved=createLoader({'./supabaseRetry':{writeWithRetry}})('src/lib/savedRpc.ts')
  // Seed only the durable intent; the actual hook must recover it via the paid RPC.
  saved.prepareSavedRpc(USER,'pull_gacha_atomic','food:1',{p_banner_id:'food',p_count:1,p_use_ticket:false})
  h.state.mode='ok';let v=h.render();await v.pullSingle('food');v=await h.settle()
  assert.equal(h.calls.find(c=>c.name).name,'pull_gacha_atomic');assert.equal(h.state.coins,450);assert.equal(v.freeFoodReady,true);h.unmount()
})

test('kiosk readiness uses confirmed household nights and enough energy, with bonus priority even when tired',async()=>{
  const h=fixture('provider',{state:{nightMode:'ok'}});let v=await h.settle();assert.match(v.places['/shawarma'],/paid shift/)
  h.state.energy=29;v=await h.settle();assert.equal(v.places['/shawarma'],undefined)
  h.state.bonusDue=40;for(const fn of h.foreground)fn();v=await h.settle();assert.match(v.places['/shawarma'],/bonus/)
  h.state.bonusDue=0;h.state.energy=80;h.state.worked=true;for(const fn of h.foreground)fn();v=await h.settle();assert.equal(v.places['/shawarma'],undefined)
  h.state.worked=false;h.state.statsLoading=true;for(const fn of h.foreground)fn();v=await h.settle();assert.equal(v.places['/shawarma'],undefined);h.unmount()
})
test('kiosk failures and mismatched household replies never invent a paid shift',async()=>{
  for(const nightMode of ['missing','offline','bad-actor','bad-home']){const h=fixture('provider',{state:{nightMode}});const v=await h.settle();assert.equal(v.places['/shawarma'],undefined);h.unmount()}
})
test('kiosk save and bonus recovery dots survive missing status, and remain scoped to the household',async()=>{
  const h=fixture();await h.settle()
  h.journal.prepareSavedRpc(USER,'close_kiosk_night_atomic',HOME+':shift',{p_expected_user:USER,p_household_id:HOME})
  for(const fn of h.foreground)fn();let v=await h.settle();assert.match(v.places['/shawarma'],/finished shift/)
  h.state.home='different-home';v=await h.settle();assert.equal(v.places['/shawarma'],undefined)
  h.journal.prepareSavedRpc(USER,'claim_kiosk_night_bonus_atomic','different-home:bonus',{p_expected_user:USER,p_household_id:'different-home'})
  for(const fn of h.foreground)fn();v=await h.settle();assert.match(v.places['/shawarma'],/bonus needs confirmation/);h.unmount()
})
test('received kiosk rewards remain unread until the kiosk opens, and receipt replay never re-dots them',async()=>{
  const h=fixture();await h.settle();h.news.receiveRewardNews(USER,'kiosk','shift:one');let v=await h.settle()
  assert.match(v.places['/shawarma'],/New kiosk rewards/);assert.equal(v.news.kiosk,true)
  h.state.path='/shawarma';v=await h.settle();assert.equal(v.news.kiosk,false);assert.equal(v.places['/shawarma'],undefined)
  h.state.path='/home';h.news.receiveRewardNews(USER,'kiosk','shift:one');v=await h.settle();assert.equal(v.news.kiosk,false);h.unmount()
})
test('late kiosk reads cannot cross accounts or households, or update an unmounted provider',async()=>{
  for(const change of ['actor','home','unmount']){
    const hold=defer(),h=fixture('provider',{state:{nightMode:'ok',hold}});await new Promise(r=>setImmediate(r))
    if(change==='unmount')h.unmount()
    else{h.state[change==='actor'?'user':'home']='changed';h.state.nightMode='missing';h.state.hold=null;assert.equal(h.render().places['/shawarma'],undefined)}
    hold.resolve();h.state.hold=null;const value=await h.settle();assert.equal(h.react.late,0)
    if(change!=='unmount'){assert.equal(value.places['/shawarma'],undefined);h.unmount()}
  }
})
test('an unconfirmed Super Jelly feed stays marked with zero stock and is household-scoped',async()=>{
  const h=fixture();await h.settle()
  h.journal.prepareSavedRpc(USER,'feed_super_jelly_atomic',HOME+':feed',{p_expected_user:USER,p_household_id:HOME})
  for(const fn of h.foreground)fn();let v=await h.settle();assert.match(v.places['/jelly'],/feed needs confirmation/)
  h.state.home='another-home';v=await h.settle();assert.equal(v.places['/jelly'],undefined);h.unmount()
})
test('an unconfirmed Jelly round keeps the Parlour marked, independently of stock and account',async()=>{
  const h=fixture();await h.settle()
  h.journal.prepareSavedRpc(USER,'finish_jelly_round_atomic',HOME+':run:one',{p_expected_user:USER,p_household_id:HOME,p_game:'run',p_score:300})
  for(const fn of h.foreground)fn();let v=await h.settle();assert.match(v.places['/jelly'],/round needs confirmation/)
  h.state.home='another-home';v=await h.settle();assert.equal(v.places['/jelly'],undefined);h.unmount()
})
;(async()=>{for(const{name,run}of tests){await run();console.log('PASS '+name)}console.log('Reward indicators: '+tests.length+'/'+tests.length+' client scenarios passed')})()
  .catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{for(const f of fixtures)f.unmount()})
