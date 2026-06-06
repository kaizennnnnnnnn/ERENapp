// before/after on a dark bg: full view + zoomed head crop.
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer')
const ROOT=path.join(__dirname,'public')
const server=http.createServer((req,res)=>{if(req.url==='/test'){res.end('<!doctype html>');return}
  fs.readFile(path.join(ROOT,req.url.split('?')[0]),(e,data)=>{if(e){res.statusCode=404;res.end('x');return}res.setHeader('Content-Type','image/png');res.end(data)})})
async function main(){
  await new Promise(r=>server.listen(0,r));const port=server.address().port
  const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:'new'})
  const page=await browser.newPage();await page.goto(`http://localhost:${port}/test`)
  const url=await page.evaluate(async(port)=>{
    async function load(n){const img=new Image();img.crossOrigin='anonymous'
      await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=`http://localhost:${port}/${n}`});return img}
    const before=await load('__before.png'),after=await load('ErenLab.png')
    const W=before.naturalWidth,H=before.naturalHeight
    const fScale=0.42,full=Math.round(W*fScale)
    const hx=110,hy=180,hw=560,hh=240,hScale=2.4,hWp=Math.round(hw*hScale)
    const pad=20,colW=Math.max(full,hWp)
    const c=document.createElement('canvas')
    c.width=pad*3+colW*2;c.height=pad*3+Math.round(H*fScale)+Math.round(hh*hScale)+30
    const x=c.getContext('2d');x.imageSmoothingEnabled=false
    x.fillStyle='#20301f';x.fillRect(0,0,c.width,c.height)
    x.fillStyle='#fff';x.font='16px sans-serif'
    x.fillText('BEFORE',pad,16);x.fillText('AFTER',pad*2+colW,16)
    const drawFull=(img,ox)=>x.drawImage(img,0,0,W,H,ox,24,full,Math.round(H*fScale))
    drawFull(before,pad);drawFull(after,pad*2+colW)
    const oy=24+Math.round(H*fScale)+pad
    const drawHead=(img,ox)=>x.drawImage(img,hx,hy,hw,hh,ox,oy,hWp,Math.round(hh*hScale))
    drawHead(before,pad);drawHead(after,pad*2+colW)
    return c.toDataURL('image/png')
  },port)
  fs.writeFileSync(path.join(__dirname,'__ba.png'),Buffer.from(url.split(',')[1],'base64'));console.log('wrote __ba.png')
  await browser.close();server.close()
}
main().catch(e=>{console.error(e);server.close();process.exit(2)})
