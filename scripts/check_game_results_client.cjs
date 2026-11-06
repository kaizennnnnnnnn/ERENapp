const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript')
const createLoader=require('./lib/load_ts.cjs'),base=createLoader(),{coinsForGame}=base('src/lib/gameRewards.ts')
const {writeWithRetry}=base('src/lib/supabaseRetry.ts'),{PLAYABLE_MINIGAME_IDS}=base('src/lib/minigames.ts')
const USER='game-user',HOME='game-home',PROFILE='eren:profile-updated'
const clone=v=>JSON.parse(JSON.stringify(v)),deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return{promise,resolve}}
function reactFixture(){
  const states=[],refs=[],callbacks=[],effects=[];let si,ri,ci,ei,scheduled,dirty=false,live=true,late=0
  const changed=(p,d)=>!p||d.some((v,i)=>!Object.is(v,p.deps[i]))
  return {
    useState(initial){const i=si++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],v=>{if(!live)late++;const next=typeof v==='function'?v(states[i]):v;if(!Object.is(states[i],next)){states[i]=next;dirty=true}}]},
    useRef(initial){const i=ri++;return refs[i]??(refs[i]={current:initial})},
    useCallback(fn,deps){const i=ci++;if(changed(callbacks[i],deps))callbacks[i]={fn,deps};return callbacks[i].fn},
    useEffect(setup,deps){const i=ei++,old=effects[i];if(changed(old,deps))scheduled.push(()=>{old?.cleanup?.();effects[i]={deps,setup,cleanup:setup()}})},
    render(run){si=ri=ci=ei=0;scheduled=[];dirty=false;const value=run();scheduled.forEach(fn=>fn());return value},
    unmount(){effects.forEach(e=>e?.cleanup?.());live=false},get dirty(){return dirty},get late(){return late},
    strictReplay(){effects.forEach(e=>e?.cleanup?.());effects.forEach(e=>{if(e)e.cleanup=e.setup()})},
  }
}
function fixture(options={}){
  const react=reactFixture(),storage=options.storage??new Map(),receipts=options.receipts??new Map(),calls=[],events=[],foreground=new Set(),jobs=new Set()
  const state={userId:USER,home:HOME,game:'memory_match',coins:10,energy:50,mode:'ok',hold:null,raw:null,...options.state}
  global.sessionStorage={get length(){return storage.size},key:i=>[...storage.keys()][i],getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}
  global.CustomEvent=class{constructor(type,{detail}){this.type=type;this.detail=detail}}
  global.window={dispatchEvent:event=>events.push(event)}
  const client={from(){throw Error('Games must not split table writes')},rpc(name,args){return{abortSignal:async signal=>{
    assert.equal(name,'save_game_result_atomic');assert.ok(signal instanceof AbortSignal);calls.push(clone(args))
    if(state.mode==='missing')return{data:null,error:{code:'PGRST202'}}
    if(state.mode==='business')return{data:{ok:false,reason:'no_stats'},error:null}
    if(state.mode==='throw')throw Error('offline')
    if(state.raw)return clone(state.raw)
    let result=receipts.get(args.p_request_id)
    if(result)assert.deepEqual(result.args,args,'Recovery keeps exact run intent')
    else{
      const blocked=state.energy<30,awarded=blocked?0:coinsForGame(args.p_game_type,args.p_score,args.p_won)
      state.coins+=awarded
      result={args:clone(args),data:{ok:true,request_id:args.p_request_id,user_id:args.p_expected_user,household_id:args.p_household_id,
        game_type:args.p_game_type,score:args.p_score,awarded,coins:state.coins,blocked,energy:state.energy,
        score_id:args.p_save_score&&args.p_score>0?'saved-score-id':null,saved_at:'2026-11-06T12:00:00Z'}}
      receipts.set(args.p_request_id,result)
    }
    if(state.hold)await state.hold.promise
    if(state.mode==='lost')return{data:null,error:{message:'lost response'}}
    const data={...clone(result.data),coins:state.coins}
    if(state.mode==='malformed')data.request_id='wrong-receipt'
    return{data,error:null}
  }}}}
  const bounded=(...args)=>{const job=writeWithRetry(...args);jobs.add(job);job.finally(()=>jobs.delete(job));return job}
  const load=createLoader({react,'@/hooks/useAuth':{useAuth:()=>({user:state.userId?{id:state.userId}:null,profile:state.home?{household_id:state.home}:null}),PROFILE_UPDATED_EVENT:PROFILE},
    '@/lib/supabase/client':{createClient:()=>client},'./supabaseRetry':{writeWithRetry:bounded},
    '@/lib/onForeground':{onForeground:fn=>{foreground.add(fn);return()=>foreground.delete(fn)}}})
  const {useGameRewards}=load('src/hooks/useGameRewards.ts'),saves=load('src/lib/gameSaves.ts')
  const h={state,react,storage,receipts,calls,events,foreground,saves,client,
    render(){return react.render(()=>useGameRewards(state.game))},
    async settle(){let value;for(let i=0;i<100;i++){value=h.render();await new Promise(resolve=>setImmediate(resolve));
      if(jobs.size&&!state.hold)await Promise.all([...jobs]);if(!react.dirty&&!jobs.size){await new Promise(resolve=>setImmediate(resolve));if(!react.dirty&&!jobs.size)return h.render()}}
      throw Error(`Game effects did not settle (${calls.length} calls)`)},unmount:()=>react.unmount()}
  h.render();return h
}
const tests=[],test=(name,run)=>tests.push({name,run})
test('all 11 games adopt only confirmed rewards, with exact server arguments and one wallet snapshot',async()=>{
  for(const game of PLAYABLE_MINIGAME_IDS){
    const h=fixture({state:{game}});let v=await h.settle();v.reportGameResult({gameType:game,score:100,won:game==='tic_tac_toe'})
    v=h.render();assert.equal(v.reward.status,'saving');assert.equal(v.reward.coins,0);assert.equal(h.events.length,0)
    v=await h.settle();assert.equal(v.reward.status,'saved');assert.equal(v.reward.coins,coinsForGame(game,100,game==='tic_tac_toe'))
    assert.equal(v.reward.balance,h.state.coins);assert.equal(v.pending,0);assert.equal(v.busy,false)
    assert.equal(h.calls[0].p_expected_user,USER);assert.equal(h.calls[0].p_household_id,HOME)
    assert.equal(h.events.filter(e=>e.type===PROFILE).length,1);assert.equal(h.events[0].detail.patch.coins,h.state.coins);h.unmount()
  }
})
test('same-tick finish callbacks share one run, while a new round with the same score is saved separately',async()=>{
  const h=fixture();let v=await h.settle();const opts={gameType:'memory_match',score:20}
  v.reportGameResult(opts);v.reportGameResult(opts);v=await h.settle();assert.equal(h.receipts.size,1)
  v.clearReward();v.reportGameResult(opts);v=await h.settle();assert.equal(h.receipts.size,2);assert.equal(v.reward.status,'saved');h.unmount()
})
test('lost replies survive fresh modules/reload and return the same reward with the current wallet',async()=>{
  let h=fixture({state:{mode:'lost'}}),v=await h.settle();v.reportGameResult({gameType:'memory_match',score:100});v=await h.settle()
  assert.equal(v.reward.status,'error');assert.equal(v.pending,1);assert.equal(h.events.length,0);assert.equal(h.receipts.size,1)
  const original=clone(h.calls[0]),storage=h.storage,receipts=h.receipts;h.unmount()
  h=fixture({storage,receipts,state:{coins:0,energy:0}});v=await h.settle()
  assert.deepEqual(h.calls[0],original);assert.equal(receipts.size,1);assert.equal(v.pending,0)
  assert.equal(h.events[0].detail.patch.coins,0);h.unmount()
})
test('missing RPC retains game intent for installation retry, unlike legacy saved-RPC defaults',async()=>{
  const h=fixture({state:{mode:'missing'}});let v=await h.settle();v.reportGameResult({gameType:'memory_match',score:100});v=await h.settle()
  assert.equal(h.calls.length,1);assert.equal(v.reward.status,'error');assert.equal(v.pending,1);assert.equal(h.events.length,0)
  const original=clone(h.calls[0]);h.state.mode='ok';await v.retry();v=await h.settle()
  assert.deepEqual(h.calls.at(-1),original);assert.equal(v.reward.status,'saved');assert.equal(v.pending,0);h.unmount()
})
test('a temporarily missing stats row keeps its unsaved run available for a real retry',async()=>{
  const h=fixture({state:{mode:'business'}});let v=await h.settle();v.reportGameResult({gameType:'memory_match',score:100});v=await h.settle()
  assert.equal(v.reward.status,'error');assert.equal(v.pending,1);assert.equal(h.events.length,0);assert.equal(h.state.coins,10)
  const original=clone(h.calls[0]);h.state.mode='ok';await v.retry();v=await h.settle()
  assert.deepEqual(h.calls.at(-1),original);assert.equal(v.reward.status,'saved');assert.equal(v.pending,0);h.unmount()
})
test('a malformed success never animates or discards its receipt, and retry cannot double-credit it',async()=>{
  const h=fixture({state:{mode:'malformed'}});let v=await h.settle();v.reportGameResult({gameType:'memory_match',score:100});v=await h.settle()
  assert.equal(v.reward.status,'error');assert.equal(v.pending,1);assert.equal(h.events.length,0);const balance=h.state.coins
  h.state.mode='ok';await v.retry();v=await h.settle();assert.equal(v.reward.status,'saved');assert.equal(h.state.coins,balance);assert.equal(h.receipts.size,1);h.unmount()
})
test('failed transports unlock without query loops; foreground and explicit retry recover',async()=>{
  const h=fixture({state:{mode:'throw'}});let v=await h.settle();v.reportGameResult({gameType:'memory_match',score:100});v=await h.settle()
  assert.equal(v.reward.status,'error');assert.equal(v.busy,false);const count=h.calls.length
  await h.settle();assert.equal(h.calls.length,count);h.state.mode='ok'
  for(const fn of h.foreground)fn();v=await h.settle();assert.equal(v.reward.status,'saved');h.unmount();assert.equal(h.foreground.size,0)
})
test('clearing a result does not erase pending saves or let an older reply replace a newer round',async()=>{
  const h=fixture();let v=await h.settle();h.state.hold=deferred()
  v.reportGameResult({gameType:'memory_match',score:10});await new Promise(r=>setImmediate(r));v=h.render()
  v.clearReward();v.reportGameResult({gameType:'memory_match',score:200});assert.equal(h.storage.size,2)
  const hold=h.state.hold;h.state.hold=null;hold.resolve();v=await h.settle()
  assert.equal(h.receipts.size,2);assert.equal(v.reward.coins,coinsForGame('memory_match',200));assert.equal(v.pending,0);h.unmount()
})
test('late account, household and unmount replies cannot patch another wallet or update dead components',async()=>{
  for(const mode of ['user','household','unmount']){
    const h=fixture();let v=await h.settle();h.state.hold=deferred();v.reportGameResult({gameType:'memory_match',score:100})
    await new Promise(r=>setImmediate(r));const hold=h.state.hold
    if(mode==='unmount')h.unmount();else{if(mode==='user')h.state.userId='other-user';else h.state.home='other-home';h.render()}
    h.state.hold=null;hold.resolve();await h.settle();assert.equal(h.events.length,0);assert.equal(h.react.late,0)
    if(mode!=='unmount')h.unmount()
  }
})
test('zero/losing rounds keep participation rewards but no score row; tired positive scores still save',async()=>{
  for(const opts of [{gameType:'memory_match',score:0},{gameType:'tic_tac_toe',score:0,won:false,saveScore:false}]){
    const h=fixture({state:{game:opts.gameType}});let v=await h.settle();v.reportGameResult(opts);v=await h.settle()
    assert.equal(v.reward.coins,3);assert.equal(v.reward.scoreSaved,false);h.unmount()
  }
  const h=fixture({state:{energy:0}});let v=await h.settle();v.reportGameResult({gameType:'memory_match',score:100});v=await h.settle()
  assert.equal(v.reward.blocked,true);assert.equal(v.reward.coins,0);assert.equal(v.reward.scoreSaved,true);h.unmount()
})
test('arcade recovery drains multiple pending games without rerolling, and anonymous scope never starts writes',async()=>{
  const h=fixture({state:{game:undefined,mode:'missing'}});await h.settle()
  h.saves.prepareGameResult(USER,HOME,{gameType:'eren_says',score:5});h.saves.prepareGameResult(USER,HOME,{gameType:'yarn_pop',score:500})
  let v=h.render();await v.retry();v=await h.settle();assert.equal(v.pending,2);h.state.mode='ok';await v.retry();v=await h.settle()
  assert.equal(v.pending,0);assert.equal(h.receipts.size,2);h.unmount()
  const empty=fixture({state:{userId:null}});v=await empty.settle();v.reportGameResult({gameType:'memory_match',score:100});await empty.settle()
  assert.equal(empty.calls.length,0);empty.unmount()
})
test('Strict Mode cleanup/replay cannot adopt an abandoned recovery or corrupt the busy counter',async()=>{
  const h=fixture();let v=await h.settle();h.state.hold=deferred()
  h.saves.prepareGameResult(USER,HOME,{gameType:'memory_match',score:10})
  h.saves.prepareGameResult(USER,HOME,{gameType:'memory_match',score:20})
  const first=v.retry();await new Promise(r=>setImmediate(r));h.react.strictReplay()
  const hold=h.state.hold;h.state.hold=null;hold.resolve();await first;v=await h.settle()
  assert.equal(h.receipts.size,2);assert.equal(v.busy,false);assert.equal(v.pending,0)
  assert.equal(h.events.filter(e=>e.type===PROFILE).length,2);h.unmount()
})
test('arcade score refresh ignores older reads, switched accounts and cancelled requests',async()=>{
  const file='src/app/(app)/games/page.tsx',source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  let callback
  function find(node){if(ts.isVariableDeclaration(node)&&node.name.getText(source)==='loadScores')callback=node.initializer.arguments[0].getText(source);ts.forEachChild(node,find)}
  find(source);assert.ok(callback)
  const jobs=[],scores=[],failures=[],scoreReadVersion={current:0},scoreScope={current:USER}
  const code=ts.transpileModule('const loadScores='+callback+';',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText
  const client={from:()=>({select:()=>({eq:()=>{const d=deferred();jobs.push(d);return d.promise}})})}
  const read=new Function('createClient','withRetry','scoreReadVersion','scoreScope','setScores','setScoresFailed',code+';return loadScores')(
    ()=>client,fn=>fn(),scoreReadVersion,scoreScope,v=>scores.push(v),v=>failures.push(v))
  const old=read(USER,()=>false),fresh=read(USER,()=>false)
  jobs[1].resolve({data:[{game_type:'memory_match',score:120}],error:null});await fresh
  jobs[0].resolve({data:[{game_type:'memory_match',score:20}],error:null});await old
  assert.deepEqual(scores,[{memory_match:120}])
  const switched=read(USER,()=>false);scoreScope.current='another-user';jobs[2].resolve({data:[{game_type:'memory_match',score:900}],error:null});await switched
  scoreScope.current=USER;const cancelled=read(USER,()=>true);jobs[3].resolve({data:[],error:null});await cancelled
  assert.equal(scores.length,1);assert.deepEqual(failures,[false])
})
test('invalid scores and retired games never send writes; all game pages use confirmed shared controls',async()=>{
  const h=fixture();let v=await h.settle();for(const score of [-1,1.5,NaN,Infinity,2147483648])v.reportGameResult({gameType:'memory_match',score})
  assert.equal(h.calls.length,0);assert.throws(()=>h.saves.prepareGameResult(USER,HOME,{gameType:'catch_mouse',score:1}));h.unmount()
  for(const id of PLAYABLE_MINIGAME_IDS){
    const source=fs.readFileSync(`src/app/(app)/games/${id.replaceAll('_','-')}/page.tsx`,'utf8')
    assert.ok(source.includes(`useGameRewards('${id}')`));assert.ok(source.includes('<GameCoinReward result={reward} onRetry={retry} />'))
    assert.ok(!source.includes('setReward(reportGameResult'));assert.ok(!source.includes(".from('game_scores').insert"))
  }
  const reward=fs.readFileSync('src/components/games/GameCoinReward.tsx','utf8')
  assert.ok(reward.includes("result.status !== 'saved'"));assert.ok(reward.indexOf('Retry save')<reward.indexOf('function ConfirmedGameCoins'))
})
;(async()=>{for(const{name,run}of tests){await run();console.log('PASS '+name)}console.log(`Game client: ${tests.length}/${tests.length} passed (actual hook/helper; mock transport)`)})().catch(e=>{console.error(e);process.exitCode=1})
