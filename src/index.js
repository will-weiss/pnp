const fs = require('fs')
const _ = require('lodash')
const Promise = require('bluebird')
const express = require('express')
const Hogan = require('hogan.js')
const { NodeVM } = require('vm2')

const relativeLocation = process.argv[2]
const port = 8007
const maxTimeout = 30000

const delimeters = '<?pnp ?>'
const parseOptions = { delimeters }

const indexFileDir = `${process.cwd()}/${relativeLocation}`
const indexFileLocation = `${indexFileDir}/index.pnp`

const app = express()
const vm = new NodeVM({ console: 'inherit', sandbox: {}, require: { external: true } })

function scanPnp(pnpFile, delimeters) {
  return Hogan.scan(pnpFile, delimeters)
}

function parsePnp(pnpFile, opts) {
  return Hogan.parse(scanPnp(pnpFile, opts.delimeters), pnpFile, opts)
}

function interpretCodeResult(result) {
  if (Array.isArray(result))      return result.map(interpretCodeResult).join('')
  if (typeof result === 'object') return JSON.stringify(result)
                                  return result
}

function resolveCode(code) {
  return Promise.resolve().then(() => {
    const iife = `module.exports = function() { ${code} };`
    const resolver = vm.run(iife, indexFileLocation)
    return resolver()
  })
  .then(interpretCodeResult)
}

function renderPage(pnpFile) {
  const tokens = parsePnp(pnpFile, parseOptions)
  const scripts = []

  const tokensWithScriptsReplaced = tokens.map(token => {
    if (token.tag !== '_v') return token
    const n = scripts.length
    const code = token.n
    scripts.push(code)
    return _.defaults({ n: `${n}`, tag: '{' }, token)
  })

  const template = Hogan.generate(tokensWithScriptsReplaced, pnpFile, parseOptions)

  return Promise.map(scripts, resolveCode)
    .then(scriptData => template.render(scriptData))
}

app.get('/', (req, res) => {
  fs.readFile(indexFileLocation, 'utf8', (err, pnpFile) => {
    if (err) return res.status(500).send(`${indexFileLocation} not found`)

    renderPage(pnpFile).then(rendered => {
      res.send(rendered)
    })
  })
})

app.listen(port, err => {
  if (err) throw err
  console.log(`Listening on port: ${port}`)
})
