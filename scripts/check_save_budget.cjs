const assert=require('node:assert/strict'),createLoader=require('./lib/load_ts.cjs')
async function main(){const original={setTimeout,clearTimeout,now:Date.now};let clock=0,id=0;const timers=new Map(),flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()}
  global.setTimeout=(fn,ms)=>{const key=++id;timers.set(key,{at:clock+ms,fn});return key};global.clearTimeout=key=>timers.delete(key);Date.now=()=>clock
  const advance=async()=>{await flush();assert.ok(timers.size,'A stalled request must have a timeout');const[key,t]=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];timers.delete(key);clock=t.at;t.fn();await flush()}
  try{const{writeWithRetry}=createLoader()('src/lib/supabaseRetry.ts');let checks=0
    for(const fastErrors of [0,1]){clock=0;timers.clear();let calls=0,settled=false;const running=writeWithRetry(signal=>{calls++;if(calls<=fastErrors)return Promise.resolve({data:null,error:{code:'503'}});return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('timeout')),{once:true}))},2,()=>true,{budgetMs:6000}).then(r=>{settled=true;return r})
      while(!settled)await advance();assert.ok((await running).error);assert.equal(clock,6000);assert.equal(calls,fastErrors+1);assert.equal(timers.size,0);checks++}
    clock=0;timers.clear();let calls=0,settled=false;const quick=writeWithRetry(async()=>++calls===1?{data:null,error:{code:'503'}}:{data:42,error:null},2,()=>true,{budgetMs:6000}).then(r=>{settled=true;return r});await flush();while(!settled)await advance();assert.equal((await quick).data,42);assert.equal(clock,800);assert.equal(calls,2);checks++
    clock=0;timers.clear();calls=0;settled=false;const legacy=writeWithRetry(signal=>{calls++;return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('timeout')),{once:true}))}).then(r=>{settled=true;return r});while(!settled)await advance();await legacy;assert.equal(clock,20400);assert.equal(calls,3);checks++
    clock=0;timers.clear();calls=0;const missing=await writeWithRetry(async()=>{calls++;return{data:null,error:{code:'missing'}}},2,()=>false,{budgetMs:6000});assert.ok(missing.error);assert.equal(calls,1);assert.equal(timers.size,0);checks++
    console.log(`Save budget: ${checks} checks passed; receipt-backed stalled saves stop at 6s rather than 20.4s, quick retry and legacy policy preserved.`)
  }finally{global.setTimeout=original.setTimeout;global.clearTimeout=original.clearTimeout;Date.now=original.now}
}
main().catch(e=>{console.error(e);process.exitCode=1})
