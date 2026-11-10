const assert=require('node:assert/strict'),loader=require('./lib/load_ts.cjs'),RealDate=Date
const NOW=RealDate.parse('2026-11-10T12:00:00Z');global.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[NOW]))}static now(){return NOW}}
const tests=[],test=(name,run)=>tests.push({name,run}),unhandled=[]
const onUnhandled=e=>unhandled.push(e);process.on('unhandledRejection',onUnhandled)
function fixture(){const lib=loader()('src/lib/battleResults.ts'),effects=loader()('src/lib/trophyEffects.ts'),calls=[],counts={}
  const state={fail:null,twist:false,collision:false,stored:null}
  const client={from(table){const q={mode:'read',one:false,select:()=>q,eq:()=>q,gte:()=>q,lt:()=>q,order:()=>q,maybeSingle:()=>{q.one=true;return q},upsert:rows=>{q.mode='write';q.rows=rows;return q},
    then(yes,no){const key=table+':'+q.mode,n=(counts[key]=(counts[key]??0)+1);calls.push({table,mode:q.mode,rows:q.rows})
      let error=state.fail?.key===key&&(!state.fail.n||state.fail.n===n)?{code:state.fail.code??'503',message:'history offline'}:null
      if(state.twist&&table==='daily_battle_results'&&q.mode==='write'&&n===1)error={code:'42703',message:'column twist_id does not exist'}
      let data=q.one?null:[]
      if(table==='interactions')data=[{id:'care',household_id:'home',user_id:'a',action_type:'feed',useful:true,created_at:new RealDate(NOW-86400000*3).toISOString()}]
      if(q.mode==='write'&&!error){data=q.rows;state.stored=q.rows[0];if(state.collision)data=[]}
      if(table==='weekly_battle_results'&&q.mode==='read'&&state.stored)data=state.stored
      return Promise.resolve({data:error?null:data,error}).then(yes,no)
    }};return q}}
  return{lib,effects,client,state,calls,counts,
    daily:()=>lib.backfillDailyResults(client,'home','a','b',7),weekly:()=>lib.ensureLastWeekResult(client,'home','a','b')}
}
for(const key of ['daily_battle_results:read','interactions:read','trophy_effects:read','daily_battle_results:write'])test('daily history failure stays retryable: '+key,async()=>{const h=fixture();h.state.fail={key};await assert.rejects(h.daily,/Could not/);if(!key.endsWith(':write'))assert.equal(h.calls.filter(c=>c.mode==='write').length,0);h.state.fail=null;const rows=await h.daily();assert.equal(rows.length,1);await new Promise(setImmediate);assert.deepEqual(unhandled,[])})
for(const key of ['weekly_battle_results:read','interactions:read','weekly_battle_results:write'])test('weekly history failure never invents a result: '+key,async()=>{const h=fixture();h.state.fail={key};await assert.rejects(h.weekly,/Could not/);if(!key.endsWith(':write'))assert.equal(h.calls.filter(c=>c.mode==='write').length,0);h.state.fail=null;const row=await h.weekly();assert.equal(row.user_id,'a');assert.equal(row.payout_paid,false);assert.equal(row.acknowledged,false);await new Promise(setImmediate);assert.deepEqual(unhandled,[])})
test('conflict confirmation failure does not return a fabricated unpaid weekly row',async()=>{const h=fixture();h.state.collision=true;h.state.fail={key:'weekly_battle_results:read',n:2};await assert.rejects(h.weekly,/confirm/);h.state.fail=null;assert.equal((await h.weekly()).user_id,'a')})
test('legacy missing effects table remains supported, but a transient outage blocks persisted scoring',async()=>{const h=fixture();h.state.fail={key:'trophy_effects:read',code:'42P01'};assert.equal((await h.daily()).length,1);const legacy=fixture();legacy.state.fail={key:'trophy_effects:read'};assert.deepEqual(await legacy.effects.fetchEffects(legacy.client,'home','2026-01-01'),[]);await assert.rejects(()=>legacy.effects.fetchEffects(legacy.client,'home','2026-01-01',true),/scoring effects/)})
test('twist-column rollout fallback still saves legacy rows, and its failed retry stays retryable',async()=>{const h=fixture();h.state.twist=true;const rows=await h.daily();assert.equal(rows.length,1);assert.equal('twist_id' in h.calls.filter(c=>c.mode==='write')[1].rows[0],false);const failed=fixture();failed.state.twist=true;failed.state.fail={key:'daily_battle_results:write',n:2};await assert.rejects(failed.daily,/save daily/);await new Promise(setImmediate);assert.deepEqual(unhandled,[])})
test('overlapping daily and weekly settlement callers still coalesce into single writes',async()=>{for(const method of ['daily','weekly']){const h=fixture();const [a,b]=await Promise.all([h[method](),h[method]()]);assert.deepEqual(a,b);assert.equal(h.calls.filter(c=>c.mode==='write').length,1)}})
;(async()=>{for(const t of tests){await t.run();console.log('PASS '+t.name)}console.log(`Couple history: ${tests.length}/${tests.length} scenarios passed (actual settlement/effect helpers; mock queries).`)})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{global.Date=RealDate;process.removeListener('unhandledRejection',onUnhandled)})
