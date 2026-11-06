const assert=require('node:assert/strict'),fs=require('node:fs'),createLoader=require('./lib/load_ts.cjs')
const base=createLoader(),{writeWithRetry,withRetry}=base('src/lib/supabaseRetry.ts'),USER='kiosk-user',HOME='kiosk-home',PROFILE='eren:profile-updated'
const clone=v=>JSON.parse(JSON.stringify(v)),deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return{promise,resolve}}
function reactFixture(){
  const states=[],refs=[],callbacks=[],effects=[],memos=[];let si,ri,ci,ei,mi,scheduled,dirty=false,live=true,late=0
  const changed=(p,d)=>!p||d.some((v,i)=>!Object.is(v,p.deps[i]))
  return{
    useState(initial){const i=si++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],v=>{if(!live)late++;const n=typeof v==='function'?v(states[i]):v;if(!Object.is(states[i],n)){states[i]=n;dirty=true}}]},
    useRef(initial){return refs[ri++]??(refs[ri-1]={current:initial})},
    useCallback(fn,deps){const i=ci++;if(changed(callbacks[i],deps))callbacks[i]={fn,deps};return callbacks[i].fn},
    useMemo(fn,deps){const i=mi++;if(changed(memos[i],deps))memos[i]={value:fn(),deps};return memos[i].value},
    useEffect(setup,deps){const i=ei++,old=effects[i];if(changed(old,deps))scheduled.push(()=>{old?.cleanup?.();effects[i]={deps,setup,cleanup:setup()}})},
    render(run){si=ri=ci=ei=mi=0;scheduled=[];dirty=false;const value=run();scheduled.forEach(f=>f());return value},
    unmount(){effects.forEach(e=>e?.cleanup?.());live=false},get dirty(){return dirty},get late(){return late},
    strictReplay(){effects.forEach(e=>e?.cleanup?.());effects.forEach(e=>{if(e)e.cleanup=e.setup()})},
  }
}
const report={takings:{served:3,wrong:0,walked:0,missedCalls:0,bestStreak:3,base:30,tips:12,inDark:0},grade:'A',coins:99999,paid:true,weather:'rain',early:false,nightTotal:999,goalMet:true,unlock:null}
const visits={bee:{wraps:[{toppings:['tomato'],sauce:'garlic',without:null}],sides:[],times:3}}
function fixture(options={}){
  const react=reactFixture(),storage=options.storage??new Map(),receipts=options.receipts??new Map(),calls=[],events=[],jobs=new Set(),foreground=new Set(),reads=[]
  const state={actor:USER,home:HOME,coins:10,mode:'ok',hold:null,raw:null,rows:[],noteError:false,refetches:0,startPaid:true,startBlocked:false,...options.state}
  global.sessionStorage={get length(){return storage.size},key:i=>[...storage.keys()][i],getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}
  global.CustomEvent=class{constructor(type,{detail}={}){this.type=type;this.detail=detail}}
  global.window={dispatchEvent:e=>events.push(e)}
  const client={from(table){assert.equal(table,'kiosk_shifts');let action='select',update=null
    const q={select(){return q},eq(){return q},order(){return q},limit(){return q},update(value){assert.deepEqual(Object.keys(value),['note']);action='note';update=value;return q},
      then(resolve,reject){reads.push({action,update});return Promise.resolve({data:clone(state.rows),error:action==='note'&&state.noteError?{message:'offline'}:null}).then(resolve,reject)}};return q},
    rpc(name,args){return{abortSignal:async signal=>{
      assert.ok(signal instanceof AbortSignal);calls.push({name,args:clone(args)})
      const start=name==='start_kiosk_shift_atomic';assert.ok(start||name==='close_kiosk_shift_atomic')
      if(state.mode===(start?'start-missing':'close-missing'))return{data:null,error:{code:'PGRST202'}}
      if(state.mode==='business'&&!start)return{data:{ok:false,reason:'no_stats'},error:null}
      if(state.raw&&!start)return clone(state.raw)
      let receipt=receipts.get(args.p_request_id)
      if(receipt)assert.deepEqual(receipt.args,args)
      else{
        let data
        if(start)data={ok:true,session_id:args.p_request_id,user_id:args.p_expected_user,household_id:args.p_household_id,shift_date:'2026-11-07',paid:state.startPaid,blocked:state.startBlocked,energy:state.startBlocked?12:80,started_at:'2026-11-07T10:00:00Z'}
        else{state.coins+=42;data={ok:true,request_id:args.p_request_id,session_id:args.p_session_id,user_id:args.p_expected_user,household_id:args.p_household_id,shift_date:'2026-11-07',paid:true,blocked:false,
          awarded:42,coins:state.coins,grade:'B',night_total:3,goal_met:false,wraps_before:5,wraps_after:8,saved_at:'2026-11-07T10:04:00Z'}}
        receipt={args:clone(args),data};receipts.set(args.p_request_id,receipt)
      }
      if(state.hold)await state.hold.promise
      if(state.mode===(start?'start-lost':'close-lost'))return{data:null,error:{message:'lost response'}}
      const data={...clone(receipt.data),...(!start?{coins:state.coins}:{})}
      if(state.mode==='malformed'&&!start)data.request_id='other-receipt'
      return{data,error:null}
    }}}
  }
  const track=fn=>(...args)=>{const p=fn(...args);jobs.add(p);p.finally(()=>jobs.delete(p));return p}
  const refetch=async()=>{state.refetches++}
  const load=createLoader({react,'@/hooks/useAuth':{useAuth:()=>({user:state.actor?{id:state.actor}:null,profile:state.home?{household_id:state.home}:null}),PROFILE_UPDATED_EVENT:PROFILE},
    '@/hooks/useErenStats':{useErenStats:()=>({stats:{kiosk_regulars:{},kiosk_wraps:5},refetch:state.unstableRefetch?async()=>refetch():refetch})},'@/lib/supabase/client':{createClient:()=>client},
    '@/lib/wishes':{dateKey:d=>d.toISOString().slice(0,10)},'@/lib/supabaseRetry':{writeWithRetry:track(writeWithRetry),withRetry:track(withRetry)},
    './supabaseRetry':{writeWithRetry:track(writeWithRetry)},'@/lib/onForeground':{onForeground:fn=>{foreground.add(fn);return()=>foreground.delete(fn)}}})
  const {useKioskRecord}=load('src/components/kiosk/useKioskRecord.ts'),saves=load('src/lib/kioskSaves.ts')
  const h={state,react,storage,receipts,calls,events,foreground,reads,saves,client,render(){return react.render(()=>useKioskRecord())},
    async settle(){for(let i=0;i<100;i++){h.render();await new Promise(r=>setImmediate(r));if(jobs.size&&!state.hold)await Promise.all([...jobs]);
      if(!react.dirty&&!jobs.size){await new Promise(r=>setImmediate(r));if(!react.dirty&&!jobs.size)return h.render()}}throw Error('Kiosk effects did not settle')},unmount:()=>react.unmount()}
  h.render();return h
}
const tests=[],test=(name,run)=>tests.push({name,run})
async function open(h){assert.equal(await h.render().beginShift(),true);return h.settle()}
test('entry confirms a server session before playing; start never patches the wallet',async()=>{
  const h=fixture();let v=await h.settle();assert.equal(v.session,null);assert.equal(v.loaded,true);v=await open(h)
  assert.equal(v.session.energy,80);assert.equal(h.calls[0].args.p_expected_user,USER);assert.equal(h.calls[0].args.p_household_id,HOME)
  assert.equal(h.events.filter(e=>e.type===PROFILE).length,0);h.unmount()
})
test('finishing journals one intent and adopts only confirmed server coins, grade and shared total',async()=>{
  const h=fixture();let v=await open(h);h.state.hold=deferred();const job=v.closeShift({report,regulars:visits});v=h.render()
  assert.equal(v.saving,true);assert.equal(v.settlement,null);assert.equal(v.pending,1);assert.equal(h.events.filter(e=>e.type===PROFILE).length,0)
  h.state.hold.resolve();h.state.hold=null;await job;v=await h.settle();assert.equal(v.settlement.awarded,42);assert.equal(v.settlement.grade,'B');assert.equal(v.settlement.night_total,3)
  assert.equal(v.pending,0);assert.equal(v.saving,false);assert.equal(h.events.find(e=>e.type===PROFILE).detail.patch.coins,52);assert.ok(h.state.refetches>0)
  assert.deepEqual(h.calls.find(c=>c.name==='close_kiosk_shift_atomic').args.p_regulars,visits);h.unmount()
})
test('same-tick close callbacks share the original receipt and never double-bank',async()=>{
  const h=fixture();const v=await open(h);await Promise.all([v.closeShift({report,regulars:visits}),v.closeShift({report,regulars:visits})]);await h.settle()
  assert.equal(h.calls.filter(c=>c.name==='close_kiosk_shift_atomic').length,1);assert.equal(h.state.coins,52);h.unmount()
})
test('a lost start reply survives reload and cannot move its day or create another session',async()=>{
  let h=fixture({state:{mode:'start-lost'}});await h.settle();assert.equal(await h.render().beginShift(),false);let v=await h.settle();assert.ok(v.startError)
  const original=h.calls[0],storage=h.storage,receipts=h.receipts;assert.equal(receipts.size,1);h.unmount()
  h=fixture({storage,receipts});v=await open(h);assert.deepEqual(h.calls[0],original);assert.equal(receipts.size,1);h.unmount()
})
test('lost close replies recover automatically after reload with original report and current wallet',async()=>{
  let h=fixture();let v=await open(h);h.state.mode='close-lost';assert.equal(await v.closeShift({report,regulars:visits}),false);v=await h.settle()
  assert.equal(v.pending,1);assert.ok(v.saveError);assert.equal(h.state.coins,52);assert.equal(h.events.filter(e=>e.type===PROFILE).length,0)
  const original=h.calls.find(c=>c.name==='close_kiosk_shift_atomic'),storage=h.storage,receipts=h.receipts;h.unmount()
  h=fixture({storage,receipts,state:{coins:0}});v=await h.settle();assert.deepEqual(h.calls[0],original);assert.equal(v.pending,0);assert.equal(v.settlement.awarded,42)
  assert.equal(h.events.find(e=>e.type===PROFILE).detail.patch.coins,0);h.unmount()
})
test('missing SQL blocks entry without legacy split payouts or pretending the shift opened',async()=>{
  const h=fixture({state:{mode:'start-missing'}});await h.settle();assert.equal(await h.render().beginShift(),false);const v=await h.settle()
  assert.equal(v.session,null);assert.match(v.startError,/saving update/);assert.equal(v.starting,false);assert.equal(h.calls.length,1);h.unmount()
})
test('missing close SQL and normal refusals preserve the same finished shift for retry',async()=>{
  for(const mode of ['close-missing','business']){const h=fixture();let v=await open(h);h.state.mode=mode;await v.closeShift({report,regulars:visits});v=await h.settle()
    assert.equal(v.pending,1);const first=h.calls.find(c=>c.name==='close_kiosk_shift_atomic');h.state.mode='ok';await v.retrySave();v=await h.settle()
    assert.equal(v.pending,0);assert.deepEqual(h.calls.at(-1),first);assert.equal(h.state.coins,52);h.unmount()}
})
test('a malformed success never clears recovery or announces unconfirmed money',async()=>{
  const h=fixture();let v=await open(h);h.state.mode='malformed';await v.closeShift({report,regulars:visits});v=await h.settle()
  assert.equal(v.settlement,null);assert.equal(v.pending,1);assert.equal(h.events.filter(e=>e.type===PROFILE).length,0)
  h.state.mode='ok';await v.retrySave();v=await h.settle();assert.equal(v.settlement.coins,52);assert.equal(h.state.coins,52);h.unmount()
})
test('unfinished confirmation blocks another shift, while foreground return retries it',async()=>{
  const h=fixture();let v=await open(h);h.state.mode='close-lost';await v.closeShift({report,regulars:visits});v=await h.settle()
  assert.equal(await v.beginShift(),false);await h.settle();assert.equal(h.calls.filter(c=>c.name==='start_kiosk_shift_atomic').length,1)
  h.state.mode='ok';for(const fn of h.foreground)fn();v=await h.settle();assert.equal(v.pending,0);assert.ok(v.settlement);h.unmount()
})
test('account/household switches and unmounts ignore late results without patching another wallet',async()=>{
  for(const change of ['actor','home','unmount']){const h=fixture();let v=await open(h);h.state.hold=deferred();const job=v.closeShift({report,regulars:visits})
    await new Promise(r=>setImmediate(r));if(change==='unmount')h.unmount();else{h.state[change]='other';h.render()}
    h.state.hold.resolve();h.state.hold=null;await job;if(change!=='unmount')await h.settle()
    assert.equal(h.events.filter(e=>e.type===PROFILE).length,0);assert.equal(h.react.late,0);if(change!=='unmount')h.unmount()}
})
test('notes wait for a confirmed paid record and report actual save success',async()=>{
  const h=fixture();let v=await open(h);assert.equal(await v.saveNote('too early'),false);await v.closeShift({report,regulars:visits});v=await h.settle()
  assert.equal(await v.saveNote('saved note'),true);h.state.noteError=true;assert.equal(await v.saveNote('failed note'),false);h.unmount()
})
test('same-tick entry taps open only one server session',async()=>{
  const h=fixture();await h.settle();const v=h.render();const result=await Promise.all([v.beginShift(),v.beginShift()]);await h.settle()
  assert.deepEqual(result,[true,false]);assert.equal(h.calls.length,1);h.unmount()
})
test('paid eligibility comes from the start receipt, including tired and already-worked practice',async()=>{
  for(const startBlocked of [true,false]){const h=fixture({state:{startPaid:false,startBlocked}});const v=await open(h)
    assert.equal(v.session.paid,false);assert.equal(v.session.blocked,startBlocked);h.unmount()}
})
test('late entry replies cannot reopen a switched account or an unmounted shop',async()=>{
  for(const unmount of [true,false]){const h=fixture();await h.settle();h.state.hold=deferred();const job=h.render().beginShift();await new Promise(r=>setImmediate(r))
    if(unmount)h.unmount();else{h.state.actor='other';h.render()}
    h.state.hold.resolve();h.state.hold=null;assert.equal(await job,false);if(!unmount){const v=await h.settle();assert.equal(v.session,null);h.unmount()}
    assert.equal(h.react.late,0)}
})
test('Strict Mode effect cleanup/replay does not duplicate or lose a pending close',async()=>{
  let h=fixture();let v=await open(h);h.state.mode='close-lost';await v.closeShift({report,regulars:visits});v=await h.settle()
  const storage=h.storage,receipts=h.receipts;h.unmount();h=fixture({storage,receipts,state:{coins:52}});h.react.strictReplay();v=await h.settle()
  assert.equal(v.pending,0);assert.equal(h.state.coins,52);assert.ok(v.settlement);assert.equal(h.react.late,0);h.unmount()
})
test('ordinary rerenders and changing stats callback references never restart a failed save',async()=>{
  const h=fixture({state:{unstableRefetch:true}});let v=await open(h);h.state.mode='close-lost';await v.closeShift({report,regulars:visits});v=await h.settle()
  const calls=h.calls.length;for(let i=0;i<10;i++)h.render();v=await h.settle();assert.equal(h.calls.length,calls);assert.equal(v.saving,false);assert.equal(v.pending,1);h.unmount()
})
test('the actual kiosk no longer uses split wallet/memory writes or full-snapshot regular replacement',async()=>{
  const interior=fs.readFileSync('src/components/kiosk/KioskInterior.tsx','utf8'),record=fs.readFileSync('src/components/kiosk/useKioskRecord.ts','utf8')
  assert.ok(!interior.includes('addCoins'));assert.ok(!record.includes(".from('eren_stats')"));assert.ok(!record.includes(".insert({"))
  const shift=fs.readFileSync('src/components/kiosk/useKioskShift.ts','utf8');assert.ok(shift.includes('order.times - (regulars[id]?.times ?? 0)'))
  assert.ok(interior.includes('const opening = useRef'));assert.ok(interior.includes('banked={Boolean(confirmed)}'))
})
;(async()=>{for(const{name,run}of tests){await run();console.log('PASS '+name)}console.log(`Kiosk client: ${tests.length}/${tests.length} passed (actual hook/helpers, mock transport)`)})().catch(e=>{console.error(e);process.exitCode=1})
