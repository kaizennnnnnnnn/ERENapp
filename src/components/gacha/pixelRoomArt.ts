import type { GachaRarity } from '@/types'
import type { GachaMachine, SkinRoomVariant } from '@/lib/gachaPresentation'

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

function tiledFloor(c: Ctx, variant: SkinRoomVariant, royal=false) {
  const colors=royal?['#EDE6C9','#B6D1CB','#D6B67D']:variant===1?['#E5CAB9','#CAB6BB','#AE8D83']:['#F0E3CE','#A9C9BA','#C5AD8D']
  box(c,0,150,240,90,colors[0])
  for(let row=0;row<7;row++)for(let col=-1;col<13;col++) {
    const x=col*22+(row%2?11:0),y=150+row*14
    if(variant===2)poly(c,[[x,y+7],[x+11,y],[x+22,y+7],[x+11,y+14]],colors[(col+row+20)%2])
    else box(c,x,y,21,13,colors[(col+row+20)%2])
    if(royal)diamond(c,x+11,y+7,1,colors[2])
  }
}

function roomMat(c: Ctx, tier: number, variant: SkinRoomVariant, color: string) {
  const trim=tier===2?'#E9CA83':'#F3DFC2',edge=tier===2?'#A37D42':'#9C8B82'
  if(variant===1) {
    box(c,28,180,184,46,edge);box(c,30,182,180,42,trim);box(c,33,185,174,36,color)
    for(let x=35;x<208;x+=7){box(c,x,177,2,4,trim);box(c,x,226,2,4,trim)}
    for(const x of [39,201])for(let y=190;y<219;y+=8)diamond(c,x,y,tier+1,trim)
  } else {
    oval(c,20,179,200,49,edge);oval(c,22,180,196,46,trim);oval(c,25,182,190,42,color)
    if(variant===2)for(let i=0;i<22;i++) {
      const a=i*Math.PI*2/22,x=120+94*Math.cos(a),y=203+20*Math.sin(a)
      oval(c,Math.round(x)-2,Math.round(y)-2,5,5,trim)
    }
    for(const x of [41,199])diamond(c,x,203,tier+2,trim)
  }
}

function bookcase(c: Ctx, x: number, y: number, tier: number, cloth=false) {
  box(c,x,y,46,154-y,tier===2?'#AF8B50':'#92745D');box(c,x+3,y+3,40,148-y,'#F0DDC1')
  for(let row=0;row<4;row++) {
    const sy=y+10+row*(137-y)/4
    box(c,x+5,sy,36,15,'#AD9B92')
    for(let i=0;i<5;i++)box(c,x+7+i*6,sy+2+(i%2)*2,5,cloth?7:11-(i%2)*2,['#B4C7B3','#D49CA7','#C6B4CE','#E1C28D'][(i+row)%4])
    box(c,x+3,sy+15,40,2,tier===2?'#DABE7E':'#BA9776')
  }
  box(c,x+2,154,5,5,'#886B4D');box(c,x+38,154,5,5,'#886B4D')
}

function mirrorDesk(c: Ctx, x: number, time: number, tier: number) {
  oval(c,x+9,64,28,50,tier===2?'#CEA555':'#B99C7F');oval(c,x+12,67,22,44,'#F9EBD3');oval(c,x+15,70,16,38,'#9EBEC7')
  box(c,x+20+Math.round(Math.sin(time/2400)),75,2,28,'#DFEAE1')
  box(c,x,119,47,6,'#C4A16D');box(c,x+3,125,40,19,'#F3DDC0');box(c,x+6,130,32,9,'#DEC1AB')
  box(c,x+20,133,5,2,'#AA8651');box(c,x+5,144,5,13,'#B5956C');box(c,x+35,144,5,13,'#B5956C')
}

function wallFrame(c: Ctx, x: number, y: number, type: number, tier: number) {
  box(c,x,y,29,32,tier===2?'#C6A461':'#9E8270');box(c,x+2,y+2,25,28,'#F5E7CE')
  if(type===0){box(c,x+8,y+10,13,12,'#BD92AE');box(c,x+5,y+13,19,6,'#DEC6C7');box(c,x+13,y+6,3,21,'#9D7292')}
  else if(type===1){box(c,x+7,y+8,15,17,'#ADC4B2');box(c,x+11,y+6,7,21,'#6F9E83');box(c,x+5,y+13,20,5,'#C5D8BC')}
  else {oval(c,x+6,y+8,17,17,'#D4B873');oval(c,x+10,y+6,14,15,'#F5E7CE')}
}

function arch(c: Ctx, tier: number, variant: SkinRoomVariant, wall: string, trim: string) {
  const outer=tier===2?'#B98E47':trim
  if(variant===0) {
    oval(c,55,12,130,108,outer);box(c,55,65,130,85,outer)
    oval(c,59,17,122,103,wall);box(c,59,67,122,81,wall)
  } else if(variant===1) {
    poly(c,[[54,150],[54,57],[120,8],[186,57],[186,150]],outer)
    poly(c,[[59,148],[59,60],[120,15],[181,60],[181,148]],wall)
  } else {
    box(c,53,25,134,125,outer);box(c,58,30,124,118,wall)
    box(c,49,21,142,7,tier===2?'#EDD39A':'#E6C6B4')
    diamond(c,120,24,7,outer);diamond(c,120,24,3,'#F9E7BD')
  }
}

function dressingRoom(c: Ctx, tier: number, variant: SkinRoomVariant, time: number) {
  const wall=tier===2?'#EEE4D1':tier===1?'#D9D1DE':'#E2D7D8'
  box(c,0,0,240,151,wall);box(c,0,107,240,43,tier===2?'#A9BABD':'#B4A8B4')
  box(c,0,105,240,3,tier===2?'#D9BB7D':'#CFBBC6')
  if(tier>0){arch(c,tier,variant,wall,tier===1?'#B194B3':'#B78F52');for(const x of [44,184])column(c,x)}
  else {box(c,0,0,240,6,'#A28775');for(const x of [46,186])box(c,x,0,6,150,'#C2AC9D')}
  for(const x of [15,199])wallFrame(c,x,24,variant,tier)
  planks(c,tier>0)
  if(variant===1){chair(c,1,110,tier===2);bookcase(c,191,62,tier,true);plant(c,25,89,Math.round(Math.sin(time/1900)),tier===2)}
  else {mirrorDesk(c,-2,time,tier);chair(c,196,110,tier===2);box(c,197,82,43,3,'#B1967F');for(let i=0;i<5;i++)box(c,200+i*8,62,6,20,['#D2A2B6','#AFC4C3','#E2C998'][i%3])}
  if(tier===1&&variant===1){curtain(c,true,time);curtain(c,false,time)}
  if(tier===2){for(const x of [29,211])lamp(c,x,55,time,true);box(c,0,0,240,10,'#7B819B');box(c,0,10,240,3,'#E7C884')}
  roomMat(c,tier,variant,variant===1?'#B5A5BC':tier===2?'#819CAC':'#B7BCA3')
}

function steam(c: Ctx, x: number, y: number, time: number, count=2) {
  for(let i=0;i<count;i++) {
    const phase=(time/1800+i*.45)%1, dy=Math.round(phase*17)
    c.save();c.globalAlpha=Math.sin(phase*Math.PI)*.65
    box(c,x+i*7+Math.round(Math.sin(phase*5)),y-dy,2,6,'#FFF9E6');c.restore()
  }
}

function jars(c: Ctx, x: number, y: number, tier: number) {
  for(let i=0;i<3;i++) {
    box(c,x+i*12,y,9,3,tier===2?'#D5B46F':'#B89673');box(c,x+i*12+1,y+3,7,12,['#DEB8A2','#B4C9BA','#D7BCC5'][i])
    box(c,x+i*12+2,y+7,5,4,'#F6E9D2');box(c,x+i*12+2,y+4,1,8,'#FFF5DE')
  }
}

function counter(c: Ctx, x: number, tier: number, mixer: boolean, time: number) {
  const trim=tier===2?'#C3A061':'#A98972'
  box(c,x,114,48,40,trim);box(c,x+3,119,42,31,tier===2?'#F5E6C7':'#E9C7B6')
  box(c,x-2,111,52,5,'#F2EBD9');box(c,x+6,122,15,24,'#BCD1C5');box(c,x+25,122,15,24,'#BCD1C5')
  box(c,x+17,131,2,5,trim);box(c,x+27,131,2,5,trim)
  if(mixer){box(c,x+12,92,6,20,'#BA829B');box(c,x+15,90,21,7,'#D8A8BD');box(c,x+31,95,3,9,'#A48289');oval(c,x+21,103,20,9,'#AABABD');box(c,x+23,103,16,2,'#E8F1DD')}
  else {box(c,x+9,98,26,12,tier===2?'#8FBEB3':'#C18F9A');box(c,x+17,94,11,6,'#E3C3AD');box(c,x+35,99,6,6,'#C7AD8C');steam(c,x+17,93,time)}
}

function oven(c: Ctx, x: number, tier: number, time: number) {
  box(c,x,106,46,49,tier===2?'#BD9A5E':'#AB9587');box(c,x+3,110,40,40,'#F0DEC4')
  box(c,x+7,120,32,24,'#637C82');box(c,x+10,123,26,17,'#B2B89D');box(c,x+10,128,26,2,'#F4DDA4')
  for(const dx of [10,21,32])box(c,x+dx,113,3,3,'#B48E5E')
  for(let i=0;i<3;i++){oval(c,x+12+i*8,130,6,5,'#D8A86E');box(c,x+14+i*8,130,2,2,'#F9E3B3')}
  steam(c,x+12,102,time,3)
}

function kitchen(c: Ctx, tier: number, variant: SkinRoomVariant, time: number) {
  const wall=variant===1?'#D9D6E2':variant===2?'#F0D9CA':'#D1E3DC'
  const trim=tier===2?'#C5A063':tier===1?'#B9A1A0':'#8AA99A'
  box(c,0,0,240,151,wall)
  for(let y=55;y<151;y+=15)for(let x=-10+(y%2)*10;x<240;x+=24){box(c,x,y,23,14,tier===2?'#E4E3CC':variant===1?'#C5CDCB':'#B9D1C6');box(c,x+1,y+1,21,1,'#E6EDDB')}
  box(c,0,53,240,3,trim);box(c,0,147,240,4,trim)
  if(tier>0){arch(c,tier,variant,tier===2?'#EDE7D2':wall,trim);for(const x of [44,184]){if(tier===2)column(c,x);else box(c,x,32,4,118,trim)}}
  else {box(c,0,0,240,6,'#9E8972');box(c,0,6,240,2,'#D9C49F')}
  if(tier===2){box(c,0,0,240,15,'#418F86');box(c,0,15,240,3,'#E5C68A')}
  box(c,0,150,240,2,trim);tiledFloor(c,variant,tier===2)
  if(variant===0){counter(c,-3,tier,true,time);oven(c,196,tier,time)}
  else if(variant===1){bookcase(c,-3,67,tier);counter(c,195,tier,false,time)}
  else {oven(c,-2,tier,time);counter(c,195,tier,true,time)}
  for(const x of [9,198]){box(c,x,60,35,3,trim);jars(c,x,43,tier)}
  if(variant===2){box(c,8,29,35,3,trim);for(let i=0;i<3;i++){box(c,12+i*10,32,2,15,'#B4956F');oval(c,9+i*10,45,8,8,'#C5AA7D')}}
  else {wallFrame(c,12,13,variant,tier);wallFrame(c,199,13,variant===0?1:2,tier)}
  if(tier>0){oval(c,106,22,13,13,'#FFF0D1');oval(c,114,17,14,17,'#FFF0D1');oval(c,124,22,12,13,'#FFF0D1');box(c,109,31,24,10,'#E8CF9F');box(c,111,33,20,6,'#FDF0D9')}
  for(const x of [27,214])lamp(c,x,tier===2?74:84,time,tier===2)
  roomMat(c,tier,variant,variant===0?'#A0C1B2':variant===1?'#B4A6BF':'#D4A4A1')
}

function terrarium(c: Ctx, x: number, y: number, tier: number, aquatic: boolean, time: number) {
  const frame=tier===2?'#C4A165':aquatic?'#7A9FAD':'#799C81'
  box(c,x,y,45,153-y,frame);box(c,x+3,y+3,39,147-y,aquatic?'#A6D2D4':'#BCD5BC')
  box(c,x+3,140,39,10,aquatic?'#DACFB0':'#9DAD7C')
  for(let i=0;i<4;i++) {
    const sway=Math.round(Math.sin(time/1900+i)),xx=x+8+i*9
    poly(c,[[xx,142],[xx-3+sway,120-i*4],[xx+2+sway,115-i*4],[xx+3,142]],aquatic?'#679F95':'#639469')
    if(aquatic){const p=(time/2900+i*.2)%1;oval(c,xx,Math.round(139-p*37),3,3,'#E1F0D9')}
    else {oval(c,xx-2,138,8,4,i%2?'#DAC6A4':'#BBAA8E')}
  }
  box(c,x+6,y+7,2,33,'#E4EDDC');box(c,x+3,150,39,3,frame)
}

function habitat(c: Ctx, tier: number, variant: SkinRoomVariant, time: number) {
  const wall=variant===1?'#D9DFE7':variant===2?'#D3E6DE':'#D7E3CC'
  const trim=tier===2?'#BCA065':variant===1?'#919FB6':variant===2?'#93B5AA':'#83A07A'
  box(c,0,0,240,151,wall)
  if(tier===0){box(c,0,104,240,46,'#B2C6AC');for(let x=0;x<240;x+=18)box(c,x,106,1,42,trim);box(c,0,101,240,4,trim)}
  else {arch(c,tier,variant,wall,trim);for(const x of [43,184]){if(tier===2)column(c,x);else box(c,x,53,5,97,trim)}}
  if(variant===1){box(c,0,0,240,8,'#7E95A5');for(let i=0;i<16;i++)diamond(c,9+i*15,17+(i%3)*9,tier>0?2:1,'#EEF0D8')}
  else {box(c,0,0,240,7,trim);for(let i=0;i<12;i++){const x=7+i*20;box(c,x,7,1,12,'#668B70');poly(c,[[x,10],[x-5,16],[x,20],[x+5,14]],i%2?'#94B287':'#719E7D')}}
  if(tier===2){for(const x of [0,220]){box(c,x,0,20,128,variant===1?'#738B9C':variant===2?'#6CABA2':'#477F6D');box(c,x+3,0,3,128,'#AEC9B0')}box(c,0,7,240,3,'#D6B777')}
  if(variant===0)planks(c,tier>0);else tiledFloor(c,variant,tier===2)
  if(variant===0){terrarium(c,-3,87,tier,false,time);bookcase(c,195,73,tier);plant(c,220,66,Math.round(Math.sin(time/1700)),tier===2)}
  else if(variant===1){bookcase(c,-3,78,tier);chair(c,197,111,tier===2);plant(c,25,66,Math.round(Math.sin(time/2100)),tier===2)}
  else {terrarium(c,195,83,tier,true,time);box(c,-2,120,47,34,trim);box(c,2,124,39,26,'#D7C6B0');plant(c,21,104,Math.round(Math.sin(time/1800)),tier===2)}
  for(const x of [18,214])lamp(c,x,variant===1?58:42,time,tier===2)
  if(variant===1){oval(c,108,25,24,25,'#D9C48D');oval(c,116,21,22,23,wall)}
  else if(variant===2){for(let i=0;i<5;i++){const dx=(i-2)*5;poly(c,[[120,44],[108+dx,27+Math.abs(i-2)*2],[114+dx,22+Math.abs(i-2)*2]],'#CEAD77')}box(c,114,43,12,3,'#E4D4A8')}
  else {diamond(c,120,33,tier===2?10:6,'#86AA91');poly(c,[[112,33],[97,25],[104,40],[113,43]],trim);poly(c,[[128,33],[143,25],[136,40],[127,43]],trim)}
  roomMat(c,tier,variant,variant===0?'#99B58E':variant===1?'#A1B0C6':'#83B9B2')
}

/** All backdrop pixels are drawn here; there are no room bitmap assets or image requests. */
export function drawPixelRoom(ctx: Ctx, machine: GachaMachine, rarity: GachaRarity, variant: SkinRoomVariant, elapsed: number, reduced: boolean) {
  if(machine==='food')return
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,PIXEL_ROOM_SIZE,PIXEL_ROOM_SIZE)
  const time=reduced?0:Math.max(0,elapsed)
  const tier=rarity==='legendary'?2:rarity==='epic'?1:0
  if(machine==='foodsuits')kitchen(ctx,tier,variant,time)
  else if(machine==='creatures')habitat(ctx,tier,variant,time)
  else if(variant!==0)dressingRoom(ctx,tier,variant,time)
  else if(tier===2)royal(ctx,time)
  else if(tier===1)atelier(ctx,time)
  else cottage(ctx,time)
  ctx.restore()
}
