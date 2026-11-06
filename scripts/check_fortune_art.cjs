const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server')
const source=ts.createSourceFile('gift.tsx',fs.readFileSync('src/components/fortune/FortunePopup.tsx','utf8'),ts.ScriptTarget.Latest,true)
const names=new Set(['BOX_LID_GRID','BOX_BODY_GRID','PALETTE','GridLayer','PixelGiftBox','PixelSparkles'])
const statements=source.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.has(n.name?.text)
  ||ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>names.has(d.name.getText(source))))
assert.equal(statements.length,names.size)
const code=ts.transpileModule(statements.map(n=>n.getText(source)).join('\n')+'\nreturn {BOX_LID_GRID,BOX_BODY_GRID,PALETTE,PixelGiftBox}',{
  compilerOptions:{target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React}}).outputText
const {BOX_LID_GRID:lid,BOX_BODY_GRID:body,PALETTE:palette,PixelGiftBox}=new Function('React',code)(React)
for(const row of [...lid,...body]){assert.equal(row.length,24);for(const pixel of row)if(pixel!=='.')assert.ok(palette[pixel],pixel)}
assert.ok(body.some(row=>row.includes('c')),'The parcel has its heart seal')
assert.equal(lid.length+body.length,24,'Square, stable sprite footprint')
for(const size of [76,112,152])for(const animation of ['idle','shake','opening']){
  const html=renderToStaticMarkup(React.createElement(PixelGiftBox,{size,animation}))
  assert.ok(html.includes('class="fp-gift"'));assert.ok(html.includes('aria-hidden="true"'))
  assert.ok(html.includes(`width:${size}px;height:${size}px`));assert.ok(!html.includes('undefined'))
  assert.equal((html.match(/<svg/g)??[]).length,animation==='opening'?10:2)
  if(animation==='opening')assert.ok(html.includes('fpLidFly 0.7s'))
}
assert.ok(source.text.includes('.fp-loop, .fp-gift, .fp-gift * { animation: none !important; }'))
console.log('Fortune art: aligned sprite layers, heart seal, all sizes/phases and reduced motion passed')
