const assert=require('node:assert/strict'),createLoader=require('./lib/load_ts.cjs'),base=createLoader(),{writeWithRetry}=base('src/lib/supabaseRetry.ts')
const USER='round-user',HOME='round-home',clone=v=>JSON.parse(JSON.stringify(v)),defer=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return{promise,resolve}}
function hooks(){const states=[],refs=[],effects=[],callbacks=[];let si,ri,ei,ci,scheduled,dirty=false,live=true,late=0
  const changed=(old,d)=>!old||d.some((v,i)=>!Object.is(v,old.deps[i]))
  return{useState(initial){const i=si++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],v=>{if(!live)late++;const next=typeof v==='function'?v(states[i]):v;if(!Object.is(next,states[i])){states[i]=next;dirty=true}}]},useRef(v){const i=ri++;return refs[i]??(refs[i]={current:v})},
    useEffect(fn,deps){const i=ei++,old=effects[i];if(changed(old,deps))scheduled.push(()=>{old?.cleanup?.();effects[i]={deps,fn,cleanup:fn()}})},
    useCallback(fn,deps){const i=ci++;if(changed(callbacks[i],deps))callbacks[i]={deps,fn};return callbacks[i].fn},
    render(run){si=ri=ei=ci=0;dirty=false;scheduled=[];const value=run();scheduled.forEach(f=>f());return value},unmount(){effects.forEach(e=>e?.cleanup?.());live=false},
    strict(){effects.forEach(e=>e?.cleanup?.());effects.forEach(e=>{if(e)e.cleanup=e.fn()})},get dirty(){return dirty},get late(){return late}}
}
function fixture(options={}){
  const react=hooks(),storage=options.storage??new Map(),receipts=options.receipts??new Map(),calls=[],events=[],jobs=new Set(),foreground=new Set()
  const state={actor:USER,home:HOME,game:'run',mode:'ok',coins:10,supers:0,fed:2,today:[],day:new Date().toISOString().slice(0,10),best:0,peer:100,lead:false,writes:0,plays:0,refetches:0,quests:0,hold:null,private:false,...options.state}
  global.sessionStorage={get length(){return storage.size},key:i=>[...storage.keys()][i],getItem:k=>storage.get(k)??null,setItem:(k,v)=>{if(state.private)throw Error('private');storage.set(k,v)},removeItem:k=>storage.delete(k)}
  global.CustomEvent=class{constructor(type,{detail}={}){this.type=type;this.detail=detail}}
  global.window={dispatchEvent:event=>{events.push(event);return true}}
  const client={from(){throw Error('No split table writes')},rpc(name,args){assert.equal(name,'finish_jelly_round_atomic');calls.push(clone(args));return{abortSignal:async signal=>{
    assert.ok(signal instanceof AbortSignal)
    if(state.mode==='missing')return{data:null,error:{code:'PGRST202'}}
    if(state.mode==='business')return{data:{ok:false,reason:'no_stats'},error:null}
    let r=receipts.get(args.p_request_id)
    if(r)assert.deepEqual(r.args,args,'No re-rolling or changing recovered score')
    else{
      const eligible=args.p_score>=(args.p_game==='run'?220:240),lead=args.p_score>state.peer&&state.peer>0,bonus=eligible&&lead&&!state.lead
      const wins=[]
      if(eligible){for(const flavour of bonus?['red','yellow']:['red']){const isNew=!state.today.includes(flavour);if(isNew)state.today.push(flavour);const minted=isNew&&state.today.length===5;if(minted)state.supers++
        wins.push({flavour,effect:flavour==='red'?1:0,is_new:isNew,minted_super:minted,tray_count:state.today.length})}}
      const awarded=wins.reduce((s,w)=>s+(w.flavour==='red'?45:60),0);state.coins+=awarded;state.writes++;if(args.p_score>0)state.plays++;state.lead||=bonus
      r={args:clone(args),data:{ok:true,version:1,request_id:args.p_request_id,user_id:args.p_expected_user,household_id:args.p_household_id,game:args.p_game,score:args.p_score,
        best:Math.max(state.best,args.p_score),is_best:args.p_score>state.best,theirs_today:state.peer,their_name:'Partner',took_lead:lead,bonus_jelly:bonus,wins,awarded,coins:state.coins,saved_at:new Date().toISOString()}};state.best=r.data.best;receipts.set(args.p_request_id,r)
    }
    if(state.hold)await state.hold.promise
    if(state.mode==='lost')return{data:null,error:{message:'lost reply'}}
    const data={...clone(r.data),coins:state.coins,current_day:state.day,current_flavours:clone(state.today),current_supers:state.supers,current_fed:state.fed}
    if(state.mode==='malformed')data.request_id='wrong'
    if(state.mode==='bad-bonus')data.bonus_jelly='yes'
    if(state.mode==='bad-count')data.wins=[]
    if(state.mode==='bad-flavour')data.wins[0].flavour='blue'
    if(state.mode==='bad-effect')data.wins[0].effect=99
    if(state.mode==='bad-coins')data.awarded=9000
    if(state.mode==='bad-home')data.household_id='other'
    if(state.mode==='bad-tray')data.current_flavours=['red','red']
    return{data,error:null}
  }}}}
  const track=(...args)=>{const p=writeWithRetry(...args);jobs.add(p);p.finally(()=>jobs.delete(p));return p}
  const load=createLoader({react,'./useAuth':{useAuth:()=>({user:state.actor?{id:state.actor}:null,profile:state.home?{household_id:state.home}:null}),PROFILE_UPDATED_EVENT:'eren:profile-updated'},
    './useErenStats':{useErenStats:()=>({refetch:async()=>{state.refetches++}})},'@/contexts/TaskContext':{useTasks:()=>({completeTask:async()=>{state.quests++}})},
    '@/lib/supabase/client':{createClient:()=>client},'./supabaseRetry':{writeWithRetry:track},'@/lib/onForeground':{onForeground:fn=>{foreground.add(fn);return()=>foreground.delete(fn)}}})
  const useRound=load('src/hooks/useJellyRound.ts').useJellyRound,h={state,react,storage,receipts,calls,events,foreground,client,saves:load('src/lib/jellyRoundSaves.ts'),
    render:()=>react.render(()=>useRound(state.game)),async settle(){for(let i=0;i<100;i++){h.render();await new Promise(r=>setImmediate(r));if(jobs.size&&!state.hold)await Promise.all([...jobs]);if(!jobs.size&&!react.dirty)return h.render()}throw Error('Round effects did not settle')},unmount:()=>react.unmount()}
  h.render();return h
}
const tests=[],test=(name,run)=>tests.push({name,run})
test('both games reveal only confirmed server rolls, score, bonus and wallet together',async()=>{
  for(const game of ['run','jump']){const h=fixture({state:{game}});let v=await h.settle();const job=v.finish(300);v=h.render();assert.equal(v.result,null);assert.equal(v.saving,true);assert.equal(h.events.filter(e=>e.type==='eren:profile-updated').length,0)
    await job;v=await h.settle();assert.equal(v.result.prizes.length,2);assert.equal(v.result.awarded,105);assert.equal(v.result.best,300);assert.equal(v.result.bonus_jelly,true);assert.equal(v.pending,0);assert.equal(v.saving,false)
    assert.equal(h.events.filter(e=>e.type==='eren:profile-updated')[0].detail.patch.coins,115);assert.equal(h.state.quests,1);assert.equal(h.state.refetches,1);assert.equal(h.state.plays,1);h.unmount()}
})
test('same-tick ends and retries share one request; next run with the same score is distinct',async()=>{
  const h=fixture({state:{hold:defer()}});let v=await h.settle();const job=v.finish(300);await v.finish(300);await v.retry();assert.equal(v.clear(),false);assert.equal(h.receipts.size,1)
  h.state.hold.resolve();h.state.hold=null;await job;v=await h.settle();assert.equal(v.clear(),true);v=h.render();await v.finish(300);await h.settle();assert.equal(h.receipts.size,2);assert.equal(h.state.plays,2);h.unmount()
})
test('lost fifth-slot/duel replies survive reload and recover their original prizes with current stock and wallet',async()=>{
  let h=fixture({state:{mode:'lost',today:['green','purple','orange','yellow']}}),v=await h.settle();await v.finish(300);v=await h.settle();assert.equal(v.pending,1);assert.equal(v.result,null);assert.equal(h.state.supers,1)
  const storage=h.storage,receipts=h.receipts,args=h.calls[0],state={...h.state,mode:'ok',coins:7,supers:0,fed:3,day:'2000-01-01',today:['green']};h.unmount()
  h=fixture({storage,receipts,state});v=await h.settle();assert.equal(h.calls.length,0);assert.equal(v.pending,1);assert.equal(v.clear(),false);await v.retry();v=await h.settle()
  assert.deepEqual(h.calls[0],args);assert.equal(v.result.prizes.length,2);assert.equal(v.result.prizes[0].mintedSuper,true);assert.equal(v.result.trayCount,0);assert.equal(v.result.coins,7);assert.equal(v.pending,0);assert.equal(h.state.writes,1);assert.equal(h.state.plays,1);h.unmount()
})
test('missing SQL and no-stats refusals keep the result for retry without a legacy payout',async()=>{
  for(const mode of ['missing','business']){const h=fixture({state:{mode}});let v=await h.settle();await v.finish(300);v=await h.settle();assert.equal(v.result,null);assert.equal(v.pending,1);assert.ok(v.error);assert.equal(h.state.writes,0);assert.equal(h.state.quests,0)
    h.state.mode='ok';await v.retry();v=await h.settle();assert.equal(v.pending,0);assert.equal(v.result.awarded,105);h.unmount()}
})
test('malformed successes never reveal a fake prize or adopt a wallet; retry reuses the receipt',async()=>{
  for(const mode of ['malformed','bad-bonus','bad-count','bad-flavour','bad-effect','bad-coins','bad-home','bad-tray']){const h=fixture({state:{mode}});let v=await h.settle();await v.finish(300);v=await h.settle();assert.equal(v.result,null,mode);assert.equal(v.pending,1,mode);assert.equal(h.events.filter(e=>e.type==='eren:profile-updated').length,0)
    h.state.mode='ok';await v.retry();v=await h.settle();assert.equal(v.pending,0);assert.equal(h.state.writes,1);h.unmount()}
})
test('late replies cannot paint another actor, household, game, ABA scope, or an unmounted page',async()=>{
  for(const key of ['actor','home','game','aba','unmount']){const h=fixture({state:{hold:defer()}});let v=await h.settle();const job=v.finish(300);await new Promise(r=>setImmediate(r))
    if(key==='unmount')h.unmount();else if(key==='aba'){h.state.actor='other';h.render();h.state.actor=USER;h.render()}else{h.state[key]=key==='game'?'jump':'other';h.render()}
    h.state.hold.resolve();h.state.hold=null;await job;if(key!=='unmount'){v=await h.settle();assert.equal(v.result,null);h.unmount()}
    assert.equal(h.events.filter(e=>e.type==='eren:profile-updated').length,0);assert.equal(h.react.late,0,key)}
})
test('scoped journals and old callbacks cannot spend or block another user/game/household',async()=>{
  const h=fixture({state:{mode:'lost'}});let old=await h.settle();await old.finish(300);await h.settle();h.state.actor='other';h.state.home='other-home';h.state.game='jump';let v=await h.settle()
  assert.equal(v.pending,0);const calls=h.calls.length;await old.retry();await old.finish(400);assert.equal(old.clear(),false);assert.equal(h.calls.length,calls)
  h.state.mode='ok';await v.finish(300);v=await h.settle();assert.equal(v.result.game,'jump');h.unmount()
})
test('zero and short runs still confirm correctly, without invented jelly or a play action for zero',async()=>{
  for(const score of [0,219]){const h=fixture({state:{peer:0}});let v=await h.settle();await v.finish(score);v=await h.settle();assert.equal(v.result.prizes.length,0);assert.equal(v.result.awarded,0);assert.equal(h.state.plays,score>0?1:0);assert.equal(h.state.quests,score>0?1:0);h.unmount()}
})
test('Strict Mode and foreground reads never resubmit automatically; private storage still recovers in memory',async()=>{
  const h=fixture({state:{private:true,mode:'lost'}});let v=await h.settle();h.react.strict();await h.settle();assert.equal(h.calls.length,0)
  v=h.render();await v.finish(300);v=await h.settle();assert.equal(v.pending,1);assert.equal(h.storage.size,0);const count=h.calls.length;for(const fn of h.foreground)fn();await h.settle();assert.equal(h.calls.length,count)
  h.state.mode='ok';await v.retry();v=await h.settle();assert.equal(v.pending,0);assert.equal(h.state.writes,1);h.unmount()
})
test('same-user round writes queue together and a queued stale scope never starts its request',async()=>{
  const h=fixture({state:{hold:defer()}});await h.settle();const r1=h.saves.prepareJellyRound(USER,HOME,'run',300),r2=h.saves.prepareJellyRound(USER,HOME,'jump',400)
  let active=true;const first=h.saves.saveJellyRound(h.client,USER,r1),second=h.saves.saveJellyRound(h.client,USER,r2,()=>active)
  await new Promise(r=>setImmediate(r));assert.equal(h.calls.length,1);active=false;h.state.hold.resolve();h.state.hold=null
  assert.equal((await first).ok,true);assert.equal((await second).reason,'session_changed');assert.equal(h.state.writes,1);assert.equal(h.saves.pendingJellyRounds(USER,HOME,'jump').length,1);h.unmount()
})
;(async()=>{for(const{name,run}of tests){await run();console.log('PASS '+name)}console.log(`Jelly round client: ${tests.length}/${tests.length} passed (real hook and request journal).`)})().catch(e=>{console.error(e);process.exitCode=1})
