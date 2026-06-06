// Remove the light AA halo that rings the OUTSIDE of a sprite's dark outline
// (the "white spots on his frame"). A fringe pixel is: opaque + light, touching
// TRANSPARENT on one side and the DARK outline on the other. Each is recolored
// to the average of its dark neighbors so the silhouette gets a clean dark edge.
// White FUR edges (paws/chin) touch transparent but NOT a dark outline, so
// they're left alone.
//   node __fringe.js <file> <detect|apply> [selfLum=140] [darkLum=80]
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer')
const ROOT=path.join(__dirname,'public')
const FILE=process.argv[2]||'ErenLab.png'
const MODE=process.argv[3]||'detect'
const SELF_LUM=parseInt(process.argv[4]||'140',10)
const DARK_LUM=parseInt(process.argv[5]||'80',10)
const server=http.createServer((req,res)=>{if(req.url==='/test'){res.end('<!doctype html>');return}
  fs.readFile(path.join(ROOT,req.url.split('?')[0]),(e,data)=>{if(e){res.statusCode=404;res.end('x');return}res.setHeader('Content-Type','image/png');res.end(data)})})
async function main(){
  await new Promise(r=>server.listen(0,r));const port=server.address().port
  const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:'new'})
  const page=await browser.newPage();await page.goto(`http://localhost:${port}/test`)
  const r=await page.evaluate(async(port,FILE,MODE,SELF_LUM,DARK_LUM)=>{
    const img=new Image();img.crossOrigin='anonymous'
    await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=`http://localhost:${port}/${FILE}`})
    const W=img.naturalWidth,H=img.naturalHeight
    const c=document.createElement('canvas');c.width=W;c.height=H
    const ctx=c.getContext('2d');ctx.drawImage(img,0,0)
    const im=ctx.getImageData(0,0,W,H),d=im.data
    const idx=(x,y)=>(y*W+x)*4
    const lum=i=>0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]
    const trans=(x,y)=>d[idx(x,y)+3]<100
    const dark=(x,y)=>{const i=idx(x,y);return d[i+3]>=100 && lum(i)<DARK_LUM}
    const isFringe=(x,y)=>{
      const i=idx(x,y)
      if(d[i+3]<120) return false
      if(lum(i)<SELF_LUM) return false
      let t=0,dk=0
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dy)continue
        const nx=x+dx,ny=y+dy
        if(nx<0||ny<0||nx>=W||ny>=H){t++;continue}
        if(trans(nx,ny))t++
        else if(dark(nx,ny))dk++
      }
      return t>=1 && dk>=1
    }
    const px=[]
    for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(isFringe(x,y))px.push([x,y])
    if(MODE==='apply'){
      const orig=new Uint8ClampedArray(d)
      const olum=i=>0.299*orig[i]+0.587*orig[i+1]+0.114*orig[i+2]
      for(const[x,y]of px){
        let r=0,g=0,b=0,n=0
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
          if(!dx&&!dy)continue
          const nx=x+dx,ny=y+dy
          if(nx<0||ny<0||nx>=W||ny>=H)continue
          const j=idx(nx,ny)
          if(orig[j+3]>=100 && olum(j)<DARK_LUM){r+=orig[j];g+=orig[j+1];b+=orig[j+2];n++}
        }
        const i=idx(x,y)
        if(n){d[i]=Math.round(r/n);d[i+1]=Math.round(g/n);d[i+2]=Math.round(b/n);d[i+3]=255}
      }
      ctx.putImageData(im,0,0)
      return {W,H,count:px.length,png:c.toDataURL('image/png')}
    }
    const scale=4
    const c2=document.createElement('canvas');c2.width=W*scale;c2.height=H*scale
    const x2=c2.getContext('2d');x2.imageSmoothingEnabled=false
    x2.fillStyle='#20301f';x2.fillRect(0,0,c2.width,c2.height)  // dark chem-night-ish bg
    x2.drawImage(c,0,0,W*scale,H*scale)
    x2.fillStyle='rgba(255,0,255,0.9)'
    for(const[x,y]of px)x2.fillRect(x*scale,y*scale,scale,scale)
    return {W,H,count:px.length,preview:c2.toDataURL('image/png')}
  },port,FILE,MODE,SELF_LUM,DARK_LUM)
  console.log(`${FILE} fringe pixels: ${r.count}`)
  if(MODE==='apply'){fs.writeFileSync(path.join(ROOT,FILE),Buffer.from(r.png.split(',')[1],'base64'));console.log('wrote cleaned '+FILE)}
  else{fs.writeFileSync(path.join(__dirname,'__fringe_preview.png'),Buffer.from(r.preview.split(',')[1],'base64'));console.log('wrote __fringe_preview.png')}
  await browser.close();server.close()
}
main().catch(e=>{console.error(e);server.close();process.exit(2)})
