const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const createLoader = require('./lib/load_ts.cjs')
const tests = []
const test = (name, run) => tests.push({name,run})
const clone = value => JSON.parse(JSON.stringify(value))
let storage
function browser() {
  storage=new Map()
  global.sessionStorage={get length(){return storage.size},key:i=>[...storage.keys()][i],
    getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}
}
function modules() {
  const load=createLoader({'./supabaseRetry':{writeWithRetry:async run=>run(new AbortController().signal)}})
  return load('src/lib/rewardSaves.ts')
}
function server() {
  const receipts=new Map(),calls=[]
  let coins=100,mode='ok',hold
  return {
    calls,receipts,get coins(){return coins},set mode(v){mode=v},set hold(v){hold=v},
    client:{from(){throw Error('No direct table writes')},rpc:(name,args)=>({abortSignal:async signal=>{
      assert.equal(name,'claim_reward_atomic');assert.ok(signal instanceof AbortSignal)
      calls.push(clone(args));if(hold)await hold
      if(mode==='throw')throw Error('offline')
      if(mode==='missing')return {data:null,error:{code:'PGRST202'}}
      if(mode==='refuse')return {data:{ok:false,reason:'insufficient'},error:null}
      let receipt=receipts.get(args.p_request_id)
      if(!receipt){
        coins+=args.p_kind==='wallet'?args.p_input.amount:25
        receipt={args:clone(args),outcome:{tasks:[],achievements:[],walletDelta:args.p_input.amount}}
        receipts.set(args.p_request_id,receipt)
      }
      assert.deepEqual(args,receipt.args)
      if(mode==='lost')return {data:null,error:{message:'lost after commit'}}
      return {data:{ok:true,outcome:receipt.outcome,profile:{coins,xp:0,level:1,streak:{current:1,best:1,lastDate:'today'},achievements:{},claimed_level:0}},error:null}
    }})},
  }
}
test('fresh modules recover original request, day, timezone, target and current balance',async()=>{
  for(const [kind,input,slot] of [
    ['wallet',{amount:25},'wallet:unique'],['task',{taskId:'daily_feed',day:'2026-01-01',timeZone:'Europe/Budapest'},'task:daily_feed:2026-01-01'],
    ['road',{target:10,householdId:'home'},'road:home'],['repair',{day:'2026-01-01',timeZone:'UTC'},'repair'],
  ]){
    browser();let reward=modules();const fixture=server();fixture.mode='lost'
    assert.equal((await reward.saveReward(fixture.client,'user',kind,input,slot)).ok,false)
    assert.equal(fixture.receipts.size,1)
    const original=clone(fixture.calls[0]),before=fixture.coins
    reward=modules();const pending=reward.pendingRewardSaves('user')
    assert.equal(pending.length,1);assert.equal(pending[0].slot,slot)
    assert.equal(reward.pendingRewardSaves('other').length,0)
    fixture.mode='ok'
    assert.equal((await reward.recoverReward(fixture.client,'user',pending[0])).profile.coins,before)
    assert.deepEqual(fixture.calls[1],original)
    assert.equal(fixture.receipts.size,1);assert.equal(storage.size,0)
  }
})
test('equal wallet payouts remain distinct and queue against the latest balance',async()=>{
  browser();const reward=modules(),fixture=server()
  const results=await Promise.all(['one','two','three'].map(id=>reward.saveReward(fixture.client,'user','wallet',{amount:10},'wallet:'+id)))
  assert.deepEqual(results.map(r=>r.profile.coins),[110,120,130])
  assert.equal(fixture.receipts.size,3)
})
test('queued recovery cannot create another debit after original confirms',async()=>{
  browser();const reward=modules(),fixture=server();let release
  fixture.hold=new Promise(resolve=>{release=resolve})
  const original=reward.saveReward(fixture.client,'user','wallet',{amount:-100},'wallet:one')
  await new Promise(resolve=>setImmediate(resolve))
  const request=reward.pendingRewardSaves('user')[0]
  const recovery=reward.recoverReward(fixture.client,'user',request)
  release()
  assert.equal((await original).profile.coins,0)
  assert.equal((await recovery).reason,'nothing_pending')
  assert.equal(fixture.calls.length,1);assert.equal(fixture.receipts.size,1)
})
test('queued intentions are journaled before networking starts and survive a fresh module',async()=>{
  browser();const reward=modules(),fixture=server();let release
  fixture.hold=new Promise(resolve=>{release=resolve})
  const first=reward.saveReward(fixture.client,'user','wallet',{amount:10},'one')
  const second=reward.saveReward(fixture.client,'user','wallet',{amount:20},'two')
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(fixture.calls.length,1,'Second request is still queued')
  const fresh=modules(),pending=fresh.pendingRewardSaves('user')
  assert.deepEqual(pending.map(p=>p.slot).sort(),['one','two'])
  release();await first;await second
  assert.equal(fixture.coins,130)
})
test('stale account guard, missing RPC, business errors and throws release the queue',async()=>{
  browser();const reward=modules(),fixture=server()
  assert.equal((await reward.saveReward(fixture.client,'user','wallet',{amount:10},'one',()=>false)).reason,'session_changed')
  assert.equal(fixture.calls.length,0)
  fixture.mode='missing'
  assert.equal((await reward.saveReward(fixture.client,'user','wallet',{amount:10},'one')).reason,'not_ready')
  assert.equal(storage.size,0)
  fixture.mode='throw'
  assert.equal((await reward.saveReward(fixture.client,'user','wallet',{amount:10},'one')).reason,'connection')
  assert.equal(storage.size,1)
  fixture.mode='refuse'
  assert.equal((await reward.recoverReward(fixture.client,'user',reward.pendingRewardSaves('user')[0])).reason,'insufficient')
  assert.equal(storage.size,0)
  fixture.mode='ok'
  assert.equal((await reward.saveReward(fixture.client,'user','wallet',{amount:10},'two')).profile.coins,110)
})

// Execute the actual context callbacks without importing Next or mounting UI.
const source=ts.createSourceFile('TaskContext.tsx',fs.readFileSync('src/contexts/TaskContext.tsx','utf8'),ts.ScriptTarget.Latest,true)
const body=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='TaskProvider').body
function callback(name,bindings){
  const statement=body.statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(source)===name))
  assert.ok(statement,name)
  const code=ts.transpileModule(statement.getText(source)+'\nreturn '+name,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText
  return new Function(...Object.keys(bindings),code)(...Object.values(bindings))
}
test('actual context adopts only confirmed snapshots, releases busy and ignores switched users',async()=>{
  browser();const reward=modules(),fixture=server(),events=[],state={},user={id:'user'},currentUser={current:'user'}
  const bindings={...reward,useCallback:fn=>fn,user,currentUser,mounted:{current:true},activeRequests:{current:0},supabase:fixture.client,
    setRewardBusy:v=>{state.busy=v},setPendingRewards:v=>{state.pending=v},setRewardError:v=>{state.error=v},
    loadCompletions:async()=>{},adoptReward:r=>{events.push(r);state.coins=r.profile.coins;return true}}
  const perform=callback('performReward',bindings)
  fixture.mode='lost'
  assert.equal((await perform('wallet',{amount:10},'one')).ok,false)
  assert.equal(events.length,0);assert.equal(state.coins,undefined);assert.equal(state.busy,false);assert.equal(state.pending,1)
  fixture.mode='ok'
  assert.equal((await perform('wallet',{amount:10},'one')).ok,true)
  assert.equal(state.coins,110);assert.equal(events.length,1);assert.equal(state.pending,0)
  let release;fixture.hold=new Promise(resolve=>{release=resolve})
  const late=perform('wallet',{amount:10},'two')
  await new Promise(resolve=>setImmediate(resolve));currentUser.current='other';release()
  assert.equal((await late).reason,'session_changed');assert.equal(events.length,1);assert.equal(state.busy,false)
})
test('actual adoption maps saved fields/events and never computes a local wallet delta',async()=>{
  browser();const events=[],state={},news=[]
  const bindings={useCallback:fn=>fn,user:{id:'user'},completedRef:{current:new Set()},loadCompletions:async()=>{},
    window:{dispatchEvent:event=>events.push(event)},CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail}},
    Event:class{constructor(type){this.type=type}},PROFILE_UPDATED_EVENT:'profile',ACHIEVEMENT_DEFS:[{id:'first_care'}],receiveRewardNews:(...entry)=>news.push(entry)}
  for(const field of ['Coins','Xp','Level','Streak','Achievements','CompletedIds'])bindings['set'+field]=value=>{state[field]=value}
  const adopt=callback('adoptReward',bindings)
  assert.equal(adopt({ok:false}),false);assert.equal(events.length,0)
  const saved={coins:42,xp:20,level:1,streak:{current:7,freezeTokens:1},achievements:{first_care:'now'},claimed_level:1}
  assert.equal(adopt({ok:true,profile:saved,outcome:{}}),false);assert.equal(events.length,0)
  assert.equal(adopt({ok:true,profile:{...saved,coins:'42'},outcome:{tasks:[],achievements:[]}}),false);assert.equal(events.length,0)
  assert.equal(adopt({ok:true,profile:saved,outcome:{tasks:[{id:'daily_feed',period:'daily',periodKey:'daily:today',coins:25,xp:20}],achievements:['first_care'],milestones:[7],milestoneCoins:50}}),true)
  assert.equal(state.Coins,42);assert.equal(state.Xp,20);assert.deepEqual(state.Achievements,saved.achievements)
  assert.ok(state.CompletedIds.has('daily_feed:daily:today'))
  assert.ok(news.some(entry=>entry[1]==='quests'&&entry[2]==='task:daily_feed:daily:today'))
  assert.ok(news.some(entry=>entry[1]==='profile'&&entry[2]==='achievement:first_care'))
  assert.deepEqual(events.map(e=>e.type),['profile','eren:quest-complete','eren:streak-milestone','eren:achievement-unlocked'])
})
test('road recovery stays available after all rewards are claimed; no split writes remain',()=>{
  const road=fs.readFileSync('src/app/(app)/rewards/page.tsx','utf8')
  assert.ok(road.includes('claimLock.current = true'))
  assert.ok(road.includes('claimLevelRewards(pendingTarget ?? target'))
  assert.ok(road.indexOf('pendingTarget !== null ?')<road.indexOf(') : allClaimed ?'))
  for(const forbidden of ['writeWithRetry','addManyToMyFood','grantSkin(','.update({'])assert.ok(!road.includes(forbidden),forbidden)
})
async function main(){let failed=0;try{for(const {name,run} of tests){try{await run();console.log('PASS '+name)}catch(e){failed++;console.error('FAIL '+name,e)}}}finally{delete global.sessionStorage}
  console.log(`Reward client checks: ${tests.length-failed}/${tests.length} passed`);if(failed)process.exitCode=1}
main().catch(e=>{console.error(e);process.exitCode=1})
