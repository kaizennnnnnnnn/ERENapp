const assert=require('node:assert/strict'),createLoader=require('./lib/load_ts.cjs')
const base=createLoader(),{writeWithRetry,withRetry}=base('src/lib/supabaseRetry.ts'),USER='jelly-user',HOME='jelly-home'
const clone=value=>JSON.parse(JSON.stringify(value)),defer=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return{resolve,promise}}
function hooks(){const states=[],refs=[],effects=[],memos=[],callbacks=[];let si,ri,ei,mi,ci,scheduled,dirty=false,live=true,late=0
  const changed=(old,deps)=>!old||deps.some((value,index)=>!Object.is(value,old.deps[index]))
  return{useState(initial){const i=si++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],value=>{if(!live)late++;const next=typeof value==='function'?value(states[i]):value;if(!Object.is(next,states[i])){states[i]=next;dirty=true}}]},
    useRef(value){const i=ri++;return refs[i]??(refs[i]={current:value})},
    useEffect(setup,deps){const i=ei++,old=effects[i];if(changed(old,deps))scheduled.push(()=>{old?.cleanup?.();effects[i]={deps,setup,cleanup:setup()}})},
    useMemo(fn,deps){const i=mi++;if(changed(memos[i],deps))memos[i]={deps,value:fn()};return memos[i].value},
    useCallback(fn,deps){const i=ci++;if(changed(callbacks[i],deps))callbacks[i]={deps,fn};return callbacks[i].fn},
    render(run){si=ri=ei=mi=ci=0;dirty=false;scheduled=[];const value=run();scheduled.forEach(fn=>fn());return value},
    unmount(){effects.forEach(e=>e?.cleanup?.());live=false},strictReplay(){effects.forEach(e=>e?.cleanup?.());effects.forEach(e=>{if(e)e.cleanup=e.setup()})},get dirty(){return dirty},get late(){return late}}
}
function fixture(options={}){
  const react=hooks(),storage=options.storage??new Map(),receipts=options.receipts??new Map(),jobs=new Set(),calls=[],events=[],foreground=new Set()
  const state={actor:USER,home:HOME,coins:10,supers:1,fed:4,skin:false,mode:'ok',hold:null,readHold:null,readError:false,buffs:0,credits:0,inventoryReads:0,statReads:0,private:false,...options.state}
  global.sessionStorage={get length(){return storage.size},key:i=>[...storage.keys()][i],getItem:k=>storage.get(k)??null,setItem:(k,v)=>{if(state.private)throw Error('blocked');storage.set(k,v)},removeItem:k=>storage.delete(k)}
  global.CustomEvent=class{constructor(type,{detail}={}){this.type=type;this.detail=detail}}
  global.window={dispatchEvent:event=>{events.push(event);return true}}
  const track=fn=>(...args)=>{const p=fn(...args);jobs.add(p);p.finally(()=>jobs.delete(p));return p}
  const client={from(table){assert.equal(table,'jelly_progress');const q={select:()=>q,eq:()=>q,maybeSingle:async()=>{
    const data={day:new Date().toISOString().slice(0,10),flavours:['red'],supers:state.supers,fed:state.fed};if(state.readHold)await state.readHold.promise
    return state.readError?{data:null,error:{code:state.readError==='missing'?'42P01':'42501'}}:{data,error:null}}};return q},
    rpc(name,args){assert.equal(name,'feed_super_jelly_atomic','No legacy feed/buff/coin fallback');calls.push({name,args:clone(args)})
      return{abortSignal:async signal=>{assert.ok(signal instanceof AbortSignal)
        if(state.mode==='missing')return{data:null,error:{code:'PGRST202'}}
        let receipt=receipts.get(args.p_request_id)
        if(!receipt){if(state.mode==='none'||state.supers<1)return{data:{ok:false,reason:'none'},error:null}
          state.supers--;state.fed++;state.coins+=120;const granted=state.fed>=5&&!state.skin;state.skin||=granted
          receipt={args:clone(args),data:{ok:true,version:1,request_id:args.p_request_id,user_id:args.p_expected_user,household_id:args.p_household_id,
            coins:state.coins,awarded:120,supers:state.supers,fed:state.fed,skin_granted:granted,saved_at:new Date().toISOString()}};receipts.set(args.p_request_id,receipt)
        }else assert.deepEqual(receipt.args,args)
        if(state.hold)await state.hold.promise
        if(state.mode==='lost')return{data:null,error:{message:'lost response'}}
        const data={...clone(receipt.data),coins:state.coins,current_supers:state.supers,current_fed:state.fed}
        if(state.mode==='malformed')data.request_id='other'
        return{data,error:null}
      }}}
  }
  const load=createLoader({react,'./useAuth':{useAuth:()=>({user:state.actor?{id:state.actor}:null,profile:{household_id:state.home}}),PROFILE_UPDATED_EVENT:'eren:profile-updated'},
    './useInventory':{useInventory:()=>({inventory:state.skin?[{item_id:'skin_jelly'}]:[],loaded:true,loading:false,refetch:async()=>{state.inventoryReads++}})},
    './useErenStats':{useErenStats:()=>({feedWithFood:async()=>{state.buffs++;return{success:true}},refetch:async()=>{state.statReads++}})},
    '@/contexts/TaskContext':{useTasks:()=>({addCoins:async()=>{state.credits++}})},'@/lib/supabase/client':{createClient:()=>client},
    '@/lib/supabaseRetry':{withRetry:track(withRetry)},'./supabaseRetry':{writeWithRetry:track(writeWithRetry)},
    '@/lib/onForeground':{onForeground:fn=>{foreground.add(fn);return()=>foreground.delete(fn)}}})
  const useJellies=load('src/hooks/useJellies.ts').useJellies,h={state,react,storage,receipts,calls,events,foreground,client,
    saves:load('src/lib/superJellySaves.ts'),journal:load('src/lib/savedRpc.ts'),render:()=>react.render(useJellies),
    async settle(){for(let i=0;i<100;i++){h.render();await new Promise(r=>setImmediate(r));if(jobs.size&&!state.hold&&!state.readHold)await Promise.all([...jobs]);if(!react.dirty&&!jobs.size)return h.render()}throw Error('Jelly effects did not settle')},unmount:()=>react.unmount()}
  h.render();return h
}
const tests=[],test=(name,run)=>tests.push({name,run})
test('a Super Jelly is one confirmed spend/buff/120-coin/skin save, never a split client write',async()=>{
  const h=fixture();let v=await h.settle(),result=await v.feedSuper();v=await h.settle()
  assert.equal(result.ok,true);assert.equal(result.skinGranted,true);assert.equal(v.supers,0);assert.equal(v.fed,5)
  assert.equal(h.receipts.size,1);assert.equal(h.state.coins,130);assert.equal(h.state.buffs,0);assert.equal(h.state.credits,0)
  assert.equal(h.events.filter(e=>e.type==='eren:profile-updated').at(-1).detail.patch.coins,130)
  assert.equal(h.events.filter(e=>e.type==='eren:my-action').length,1)
  assert.equal(h.state.inventoryReads,1);assert.equal(h.state.statReads,1);h.unmount()
})
test('same-tick taps share one feed and busy state clears only when that feed finishes',async()=>{
  const h=fixture({state:{hold:defer()}});let v=await h.settle(),first=v.feedSuper(),second=await v.feedSuper();assert.equal(second.ok,false)
  assert.equal(h.calls.length,1);assert.equal(h.render().feeding,true);h.state.hold.resolve();h.state.hold=null;await first;v=await h.settle();assert.equal(v.feeding,false);assert.equal(h.receipts.size,1);h.unmount()
})
test('lost fifth-feed replies recover after reload with an empty stand and the skin already owned',async()=>{
  let h=fixture({state:{mode:'lost'}}),v=await h.settle();assert.equal((await v.feedSuper()).ok,false);v=await h.settle()
  assert.equal(v.feedPending,true);assert.equal(v.supers,0);assert.equal(v.ownsSkin,true);const first=h.calls[0],storage=h.storage,receipts=h.receipts,state={...h.state,mode:'ok',coins:7,fed:6};h.unmount()
  h=fixture({storage,receipts,state});v=await h.settle();assert.equal(h.calls.length,0);assert.equal(v.feedPending,true)
  const result=await v.feedSuper();v=await h.settle();assert.equal(result.fed,5);assert.equal(v.fed,6);assert.equal(v.feedPending,false)
  assert.deepEqual(h.calls[0].args,first.args);assert.equal(h.receipts.size,1);assert.equal(h.state.coins,7);h.unmount()
})
test('missing SQL and definite no-stock refusals do not call legacy fallbacks or leave a fake pending feed',async()=>{
  for(const mode of ['missing','none']){const h=fixture({state:{mode}});let v=await h.settle();assert.equal((await v.feedSuper()).ok,false);v=await h.settle()
    assert.equal(v.feedPending,false);assert.ok(v.feedError);assert.equal(h.state.coins,10);assert.equal(h.state.supers,1);assert.equal(h.receipts.size,0);assert.equal(h.events.filter(e=>e.type==='eren:profile-updated').length,0);h.unmount()}
})
test('malformed successes preserve the intent and never adopt unconfirmed wallet or skin results',async()=>{
  const h=fixture({state:{mode:'malformed'}});let v=await h.settle();assert.equal((await v.feedSuper()).ok,false);v=await h.settle();assert.equal(v.feedPending,true)
  assert.equal(h.events.filter(e=>e.type==='eren:profile-updated').length,0);h.state.mode='ok';assert.equal((await v.feedSuper()).ok,true);v=await h.settle();assert.equal(h.receipts.size,1);assert.equal(v.feedPending,false);h.unmount()
})
test('late feeds cannot reopen a scene, change another wallet or update an unmounted hook',async()=>{
  for(const change of ['actor','home','unmount']){const h=fixture();let v=await h.settle();h.state.hold=defer();const job=v.feedSuper();await new Promise(r=>setImmediate(r))
    if(change==='unmount')h.unmount();else{h.state[change]='changed';h.render()}
    h.state.hold.resolve();h.state.hold=null;assert.equal((await job).ok,false);if(change!=='unmount'){await h.settle();h.unmount()}
    assert.equal(h.events.filter(e=>e.type==='eren:profile-updated').length,0);assert.equal(h.react.late,0)}
})
test('progress reads and unread retry state stay scoped, including late reads and private storage',async()=>{
  const h=fixture({state:{private:true,mode:'lost'}});let v=await h.settle();await v.feedSuper();v=await h.settle();assert.equal(v.feedPending,true);assert.equal(h.storage.size,0)
  h.state.mode='ok';assert.equal((await v.feedSuper()).ok,true);v=await h.settle();assert.equal(v.feedPending,false);h.unmount()
  const late=fixture({state:{readHold:defer()}});await new Promise(r=>setImmediate(r));late.state.actor='other';assert.equal(late.render().loaded,false)
  late.state.readHold.resolve();late.state.readHold=null;await late.settle();assert.equal(late.react.late,0);late.unmount()
})
test('Strict Mode cleanup never spends a feed automatically or loses a recoverable intent',async()=>{
  const h=fixture({state:{mode:'lost'}});let v=await h.settle();await v.feedSuper();await h.settle();const count=h.calls.length
  h.react.strictReplay();v=await h.settle();assert.equal(h.calls.length,count);assert.equal(v.feedPending,true);h.unmount()
})
;(async()=>{for(const{name,run}of tests){await run();console.log('PASS '+name)}console.log(`Super Jelly client: ${tests.length}/${tests.length} passed (actual hook and request journal).`)})().catch(error=>{console.error(error);process.exitCode=1})
