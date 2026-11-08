const assert=require('node:assert/strict'),load=require('./lib/load_ts.cjs')()
const {kioskWeek}=load('src/lib/kioskWeek.ts'),{kioskNotice,nightRemaining}=load('src/lib/kioskNights.ts')
const row=(day,user='me',served=3,version=2)=>({shift_date:day,user_id:user,served,version})
const rows=[row('2026-11-02'),row('2026-11-02'),row('2026-11-03','them'),row('2026-11-04','me',0),
  row('2026-11-05','me',4,1),row('2026-11-08'),row('2026-11-09'),row('2026-11-01')]
const week=kioskWeek(rows,'me','2026-11-08')
assert.equal(week.mine,2);assert.equal(week.theirs,1);assert.equal(week.days[0].date,'2026-11-02');assert.equal(week.days[6].today,true)
const next=kioskWeek(rows,'me','2026-11-09');assert.equal(next.mine,1);assert.equal(next.days[0].today,true);assert.equal(next.days[1].future,true)
const year=kioskWeek([],'me','2027-01-01');assert.equal(year.days[0].date,'2026-12-28');assert.equal(year.days[6].date,'2027-01-03')
const leap=kioskWeek([row('2028-02-29')],'me','2028-03-01');assert.equal(leap.mine,1)
for(let index=0;index<366;index++){
  const date=new Date('2028-01-01T12:00:00Z');date.setUTCDate(date.getUTCDate()+index)
  const key=date.toISOString().slice(0,10),value=kioskWeek([row(key)],'me',key)
  assert.equal(value.days.length,7);assert.equal(value.mine,1);assert.equal(value.days.filter(day=>day.today).length,1)
  assert.equal(new Date(value.days[0].date+'T12:00:00Z').getUTCDay(),1)
}
const night={worked:false,bonus_due:0,server_time:'2026-11-08T02:00:00Z',resets_at:'2026-11-08T03:00:00Z',receivedAt:performance.now()}
assert.match(kioskNotice(night,30,0,0,false),/paid shift/)
for(const energy of [null,0,29,101,NaN])assert.equal(kioskNotice(night,energy,0,0,false),null)
assert.equal(kioskNotice({...night,worked:true},80,0,0,false),null)
assert.match(kioskNotice({...night,bonus_due:40},0,0,0,false),/bonus/)
assert.match(kioskNotice(null,null,1,0,false),/finished shift/)
assert.match(kioskNotice(null,null,0,1,false),/bonus needs confirmation/)
assert.match(kioskNotice(null,null,0,0,true),/New kiosk rewards/)
assert.equal(kioskNotice({...night,receivedAt:performance.now()-3600001},80,0,0,false),null)
assert.equal(nightRemaining(night,night.receivedAt+3600001),0)
console.log('Kiosk week passed: 366 dates, Monday/year/leap boundaries, duplicate/legacy/practice exclusions and honest notice priorities.')
