const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')

module.exports = function createLoader(mocks = {}) {
  const cache = new Map()
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    const localRequire = id => {
      if (id in mocks) return mocks[id]
      if (!id.startsWith('.') && !id.startsWith('@/')) return require(id)
      const base = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : path.resolve(path.dirname(file), id)
      const target = ['', '.ts', '.tsx', '.json'].map(ext => base + ext).find(f => fs.existsSync(f) && fs.statSync(f).isFile())
      if (!target) throw new Error(`Cannot load ${id} from ${file}`)
      return target.endsWith('.json') ? JSON.parse(fs.readFileSync(target, 'utf8')) : load(target)
    }
    const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    })
    new Function('require', 'module', 'exports', outputText)(localRequire, module, module.exports)
    return module.exports
  }
  return relative => load(path.join(root, relative))
}
