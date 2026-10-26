import type { GachaRarity } from '@/types'

export const PIXEL_ROOM_SIZE = 240
type Ctx = CanvasRenderingContext2D

function box(c: Ctx, x: number, y: number, w: number, h: number, ink: string) {
  c.fillStyle = ink; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}
function poly(c: Ctx, points: number[][], ink: string) {
  c.fillStyle = ink; c.beginPath()
  points.forEach(([x,y], i) => i ? c.lineTo(Math.round(x),Math.round(y)) : c.moveTo(Math.round(x),Math.round(y)))
  c.closePath(); c.fill()
}
function oval(c: Ctx, x: number, y: number, w: number, h: number, ink: string) {
  // Integer scanlines retain stepped silhouettes when the small canvas is enlarged.
  for (let row=0;row<h;row++) {
    const span = Math.sqrt(Math.max(0,1-((row+.5-h/2)/(h/2))**2))*w/2
    box(c,Math.ceil(x+w/2-span),y+row,Math.max(1,Math.floor(span*2)),1,ink)
  }
}
function diamond(c: Ctx, x: number, y: number, size: number, ink: string) {
  poly(c,[[x,y-size],[x+size,y],[x,y+size],[x-size,y]],ink)
}

function planks(c: Ctx, epic: boolean) {
  box(c,0,150,240,90,epic?'#E5C7B6':'#D7AD7C')
  for(let row=0;row<7;row++) {
    const y=150+row*14
    box(c,0,y,240,1,epic?'#BE9B91':'#AE7C53')
    box(c,0,y+1,240,1,epic?'#F3DDC9':'#EED09C')
    for(let x=-48+(row%2)*24;x<240;x+=48) {
      box(c,x,y,1,14,epic?'#C4A295':'#B98458')
      box(c,x+8,y+9,12,1,epic?'#D9B6AA':'#C89768')
    }
  }
}

function rug(c: Ctx, royal: boolean, epic: boolean) {
  const edge=royal?'#9E6F33':epic?'#B58683':'#6F8C73'
  const trim=royal?'#F1D68F':epic?'#F8E0BC':'#E1E5BE'
  const fabric=royal?'#287D78':epic?'#BCA8C1':'#9EB6A0'
  oval(c,20,179,200,49,edge); oval(c,22,180,196,46,trim)
  oval(c,25,182,190,42,fabric)
  oval(c,29,184,182,38,trim); oval(c,30,185,180,36,fabric)
  for(let i=0;i<18;i++) {
    const a=i*Math.PI*2/18, x=Math.round(120+84*Math.cos(a)), y=Math.round(203+16*Math.sin(a))
    diamond(c,x,y,royal?2:1,trim)
  }
  if(royal) for(const x of [72,168]) {
    diamond(c,x,202,4,'#CFA95D'); diamond(c,x,202,2,'#F6DFA0')
  }
  for(let i=0;i<12;i++)box(c,67+(i*29)%108,191+(i*7)%23,3,1,royal?'#3B8C82':epic?'#CBB8CE':'#AEC3AB')
}

function plant(c: Ctx, x: number, y: number, sway: number, fancy=false) {
  const leaf=fancy?'#43866B':'#5E8F60', dark='#3F6951'
  box(c,x-7,y,14,3,fancy?'#EACB86':'#B97958')
  poly(c,[[x-6,y+3],[x+6,y+3],[x+4,y+14],[x-4,y+14]],fancy?'#F8EBCD':'#CC9270')
  box(c,x-2,y-22,2,24,dark)
  for(let i=0;i<5;i++) {
    const side=i%2?1:-1, dy=-5-i*5, dx=side*(7+i%3)+sway
    poly(c,[[x,y+dy+5],[x+dx,y+dy],[x+dx+side*3,y+dy-7],[x+side*2,y+dy-4]],i%2?dark:leaf)
    box(c,x+dx,y+dy-4,3,2,'#A0BE76')
  }
}

function chair(c: Ctx, x: number, y: number, royal=false) {
  const edge=royal?'#C49A50':'#AA6269', cloth=royal?'#2D7D79':'#D78F92', light=royal?'#72A79B':'#E8AFAC'
  box(c,x+3,y+37,5,8,'#73583F');box(c,x+39,y+37,5,8,'#73583F')
  box(c,x+4,y,38,29,edge);box(c,x+7,y+3,32,25,cloth)
  box(c,x,y+19,49,21,edge);box(c,x+3,y+22,43,14,cloth)
  box(c,x-2,y+13,10,21,light);box(c,x+41,y+13,10,21,light)
  box(c,x+10,y+23,28,3,light);box(c,x+12,y+5,23,15,royal?'#F6E8C7':'#F2D8BE')
  for(const dx of [17,25])box(c,x+dx,y+10,3,3,royal?'#D4B375':'#BC857C')
}

function lamp(c: Ctx, x: number, y: number, time: number, royal=false) {
  box(c,x-1,y-15,2,16,'#AE8449');box(c,x-6,y-1,12,2,'#D4AB68')
  oval(c,x-5,y,11,14,'#B78D4B');oval(c,x-4,y+1,9,11,royal?'#FFF1CE':'#F7DCA5')
  c.save();c.globalAlpha=.55+.16*Math.sin(time/1800+x)
  box(c,x-2,y+3,5,6,'#FFFFFF');c.restore()
  box(c,x-3,y+14,7,2,'#CEAA62');box(c,x,y+16,2,4,'#B78D4B')
}

function cottage(c: Ctx, time: number) {
  box(c,0,0,240,151,'#DDE9DC');box(c,0,93,240,57,'#A5BCA1')
  box(c,0,91,240,3,'#75946F');box(c,0,147,240,4,'#6E8968')
  for(let x=0;x<240;x+=15){box(c,x,96,1,49,'#89A183');box(c,x+1,96,1,49,'#BBCBAD')}
  box(c,0,0,240,5,'#846649');box(c,0,5,240,2,'#BA9567')
  for(const x of [8,111,222]){box(c,x,0,9,15,'#9B7752');box(c,x+2,0,3,15,'#BE9866')}
  for(const x of [12,202]){
    box(c,x,24,26,33,'#886749');box(c,x+2,26,22,29,'#D2AD7D');box(c,x+4,28,18,25,'#F5EBD2')
    box(c,x+12,37,2,13,'#6D956C');box(c,x+8,33,5,5,'#CD9290');box(c,x+14,31,4,5,'#E3B3A2')
  }
  planks(c,false)
  box(c,-3,113,48,40,'#8D6746');box(c,-3,109,49,5,'#D4AC78')
  for(let row=0;row<3;row++){
    box(c,1,116+row*11,39,9,'#BA8A5C');box(c,2,116+row*11,37,1,'#E2B982');box(c,20,120+row*11,4,2,'#765C42')
  }
  box(c,1,153,5,5,'#77583F');box(c,36,153,5,5,'#77583F')
  plant(c,24,94,Math.round(Math.sin(time/1600)))
  chair(c,197,112)
  box(c,199,73,41,4,'#9B7652')
  for(let i=0;i<6;i++)box(c,203+i*6,58+i%2*3,5,15-i%2*3,['#AF7E83','#DEBD83','#709686'][i%3])
  lamp(c,217,91,time)
  rug(c,false,false)
}

function curtain(c: Ctx, left: boolean, time: number) {
  const x=left?43:174, drift=Math.round(Math.sin(time/2400+(left?0:2)))
  for(let y=0;y<153;y++) {
    const curve=Math.round(5*Math.sin(y/153*Math.PI)), w=23-curve
    const start=x+(left?curve:0)+(y>90?drift:0)
    box(c,start,y,w,1,'#B8778E');box(c,start+3,y,4,1,'#D79BAB');box(c,start+w-4,y,3,1,'#8E5C76')
    if(y>145)box(c,start,y,w,1,'#EAC9B1')
  }
  box(c,x+1,80,22,3,'#F5DDB8');diamond(c,x+12,82,4,'#F5DDB8')
  box(c,x+12,86,2,15,'#E7CBA7')
}

function atelier(c: Ctx, time: number) {
  box(c,0,0,240,150,'#A9BFC1')
  box(c,4,0,32,148,'#C5B4CB');box(c,204,0,32,148,'#C5B4CB')
  for(const x of [2,36,202,236]){box(c,x,0,2,150,'#CCAC70');box(c,x+2,0,1,150,'#F3E1BD')}
  oval(c,57,8,126,103,'#BC9965');box(c,57,59,126,91,'#BC9965')
  oval(c,60,11,120,100,'#F5E5CE');box(c,60,59,120,89,'#F5E5CE')
  oval(c,67,19,106,90,'#D8C4BC');box(c,67,61,106,85,'#E8D6CA')
  box(c,65,145,110,3,'#C09C69');diamond(c,120,13,6,'#DEBD78');diamond(c,120,13,3,'#F8E8BE')
  planks(c,true)
  curtain(c,true,time);curtain(c,false,time)
  for(const x of [18,221]){
    poly(c,[[x-7,29],[x-2,31],[x,37],[x+2,31],[x+7,29],[x+6,36],[x,40],[x-6,36]],'#D2AD69')
    lamp(c,x,39,time)
  }
  box(c,-3,124,48,6,'#BE9D74');box(c,-1,126,43,19,'#F3DFC0')
  box(c,3,144,5,15,'#B8986B');box(c,34,144,5,15,'#B8986B');box(c,7,131,28,9,'#DDBFA1');box(c,19,134,4,2,'#A88451')
  oval(c,9,69,29,50,'#B58C57');oval(c,11,71,25,46,'#F9E9CA');oval(c,14,74,19,39,'#9CB8C3')
  box(c,19+Math.round(Math.sin(time/2600)),80,3,25,'#DCEAE1');box(c,16,99,14,2,'#B6D0D0')
  box(c,191,64,50,91,'#B18B61');box(c,194,67,44,84,'#F5E6CE');box(c,198,71,36,76,'#A68D94')
  for(let row=0;row<5;row++){
    for(let i=0;i<3;i++)box(c,200+i*10,77+row*14,10,7,['#DDAAB6','#B6C8B8','#C5B3CC'][(row+i)%3])
    box(c,198,86+row*14,36,2,'#E1C89F')
  }
  rug(c,false,true)
}

function column(c: Ctx, x: number) {
  box(c,x-3,58,16,6,'#B9904E');box(c,x-1,64,12,83,'#D5C8AF')
  box(c,x+1,64,5,82,'#FBF0D6');box(c,x+8,64,2,82,'#BFAE91')
  box(c,x-3,146,16,6,'#F0DFB9');box(c,x-5,152,20,4,'#B18B4D');box(c,x-3,148,16,2,'#DDBD76')
}

function royal(c: Ctx, time: number) {
  box(c,0,0,240,152,'#E4E6CB')
  poly(c,[[49,151],[49,65],[66,37],[120,7],[174,37],[191,65],[191,151]],'#B78944')
  poly(c,[[53,150],[53,66],[70,40],[120,12],[170,40],[187,66],[187,150]],'#F9EBC5')
  poly(c,[[60,149],[60,68],[75,46],[120,20],[165,46],[180,68],[180,149]],'#A8C6AB')
  poly(c,[[65,148],[65,69],[79,50],[120,26],[161,50],[175,69],[175,148]],'#C5D9BC')
  for(const x of [82,158])for(let y=70;y<142;y+=23)diamond(c,x,y,2,'#E8DAA2')
  box(c,0,151,240,89,'#E6E9D2')
  for(let row=0;row<7;row++)for(let x=-20+(row%2)*20;x<260;x+=40){
    const y=151+row*15
    poly(c,[[x,y+7],[x+20,y],[x+40,y+7],[x+20,y+15]],row%2?'#BED6C2':'#D0DFCA')
    box(c,x+19,y+6,2,2,'#D9C28A')
  }
  for(const x of [43,184])column(c,x)
  for(const x of [-6,224]){box(c,x,0,24,135,'#266B68');box(c,x+3,0,4,135,'#499186');box(c,x+20,0,3,135,'#174E51')}
  for(const x of [-8,112]){
    oval(c,x,-23,136,64,'#B78D4B');oval(c,x,-25,136,62,'#287B73');oval(c,x+6,-28,124,59,'#3D9183')
    for(let i=0;i<9;i++)box(c,x+13+i*13,28+Math.round(7*Math.sin(i/8*Math.PI)),2,8,'#E4C987')
  }
  oval(c,103,28,34,27,'#B68B44');oval(c,105,30,30,23,'#267872')
  poly(c,[[110,38],[115,41],[120,34],[125,41],[130,38],[128,47],[112,47]],'#ECCB7B')
  box(c,113,47,14,2,'#F8E2A3');box(c,118,39,2,5,'#FFF0BC')
  lamp(c,29,47,time,true);lamp(c,211,47,time,true)
  box(c,-5,79,37,77,'#AC874A');box(c,-2,82,31,71,'#296F68')
  for(const x of [0,15]){
    box(c,x,85,12,64,'#D6B574');box(c,x+1,86,10,62,'#307F73')
    diamond(c,x+6,99,3,'#D9B76D');box(c,x+7,119,2,5,'#F3D998')
  }
  box(c,0,156,5,6,'#AB8448');box(c,24,156,5,6,'#AB8448')
  chair(c,198,119,true)
  plant(c,223,102,Math.round(Math.sin(time/2100)),true)
  rug(c,true,false)
}

/** All backdrop pixels are drawn here; there are no room bitmap assets or image requests. */
export function drawPixelRoom(ctx: Ctx, rarity: GachaRarity, elapsed: number, reduced: boolean) {
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,PIXEL_ROOM_SIZE,PIXEL_ROOM_SIZE)
  const time=reduced?0:Math.max(0,elapsed)
  if(rarity==='legendary')royal(ctx,time)
  else if(rarity==='epic')atelier(ctx,time)
  else cottage(ctx,time)
  ctx.restore()
}
