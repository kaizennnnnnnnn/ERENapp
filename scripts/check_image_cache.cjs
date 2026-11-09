const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm')
const source=fs.readFileSync('public/sw.js','utf8'),origin='https://eren.test',deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return{promise,resolve}}
function worker(){const listeners={},entries=new Map(),requests=[],adds=[];let now=0,mode='ok',hold=null,active=0,peak=0
  const cache={keys:async()=>[...entries.keys()].map(url=>({url})),match:async request=>entries.get(typeof request==='string'?new URL(request,origin).href:request.url),put:async(req,res)=>entries.set(req.url,res),add:async url=>{adds.push(url);active++;peak=Math.max(peak,active);await new Promise(r=>setImmediate(r));active--;if(url.includes('ErenCook'))throw Error('missing');entries.set(new URL(url,origin).href,{body:url})}}
  const env={self:{location:{origin},addEventListener:(n,fn)=>{listeners[n]=fn},skipWaiting(){},clients:{claim:async()=>{}}},caches:{open:async()=>cache,keys:async()=>['eren-images-a1'],delete:async()=>true},URL,Response,Date:class extends Date{static now(){return now}},setTimeout,clearTimeout,console,fetch:async req=>{requests.push(req.url);if(hold)await hold.promise;if(mode==='offline')throw Error('offline');return{ok:mode!=='bad',body:'fresh',clone(){return this}}}}
  vm.runInNewContext(source,env)
  return{listeners,cache,entries,requests,adds,set now(n){now=n},set mode(m){mode=m},set hold(h){hold=h},get peak(){return peak},async request(path='/HomeDay.png'){const waits=[];let response;listeners.fetch({request:{method:'GET',url:new URL(path,origin).href,mode:'cors'},respondWith(p){response=p},waitUntil(p){waits.push(p)}});const result=await response;return{result,settled:()=>Promise.all(waits)}}}
}
async function main(){let checks=0;const w=worker(),key=origin+'/HomeDay.png';w.entries.set(key,{body:'cached'});const hold=deferred();w.hold=hold
  const results=[];for(let i=0;i<200;i++)results.push(await w.request())
  assert.ok(results.every(r=>r.result.body==='cached'),'Cached art must not wait for refresh');assert.equal(w.requests.length,1,'200 cached consumers share one network refresh');checks++
  hold.resolve();for(const r of results)await r.settled();w.hold=null;assert.equal((await w.request()).result.body,'fresh');assert.equal(w.requests.length,1);checks++
  w.now=300001;await(await w.request()).settled();assert.equal(w.requests.length,2);checks++
  await(await w.request('/HomeDay.png?v=2')).settled();assert.equal(w.requests.length,3,'Cache-busted URLs remain distinct');checks++
  w.mode='offline';w.now=600002;const offline=await w.request();assert.equal(offline.result.body,'fresh');await offline.settled();await(await w.request()).settled();assert.equal(w.requests.length,4,'Offline refreshes cannot create a retry storm');checks++
  w.mode='bad';w.now=900003;await(await w.request()).settled();assert.equal(w.entries.get(key).body,'fresh','A failed HTTP response must not poison art');checks++
  const cold=worker();const first=await cold.request('/new.png');assert.equal(first.result.body,'fresh');assert.equal(cold.entries.get(origin+'/new.png').body,'fresh');checks++
  let install;const boot=worker();boot.listeners.install({waitUntil(p){install=p}});await install;assert.equal(boot.peak,4);assert.equal(boot.adds.length,75);assert.ok(boot.entries.has(origin+'/bedroom.png'),'One missing file must not stop the rest of the precache');checks++
  const existing=worker();existing.entries.set(key,{body:'old'});let update;existing.listeners.install({waitUntil(p){update=p}});await update;assert.ok(!existing.adds.includes('/HomeDay.png'));assert.ok(existing.adds.includes('/offline.html'));checks++
  const before=w.requests.length;let intercepted=false;w.listeners.fetch({request:{method:'GET',url:'https://other.test/a.png',mode:'cors'},respondWith(){intercepted=true}});assert.equal(intercepted,false);w.listeners.fetch({request:{method:'POST',url:key},respondWith(){intercepted=true}});assert.equal(intercepted,false);assert.equal(w.requests.length,before);checks++
  console.log(`Image cache: ${checks} checks passed; 200 warm requests -> 1 refresh, precache concurrency capped at 4, offline/versioned art retained.`)
}
main().catch(e=>{console.error(e);process.exitCode=1})
