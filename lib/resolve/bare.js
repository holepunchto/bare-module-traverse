const lex = require('bare-module-lexer')
const resolve = require('../resolve')

module.exports = function (entry, parentURL, opts = {}) {
  const runtime = require('#runtime')

  const {
    linked = false,
    platform = runtime.platform,
    arch = runtime.arch,
    simulator = false,
    host = `${platform}-${arch}${simulator ? '-simulator' : ''}`,
    target = [host]
  } = opts

  let extensions
  let conditions = target.map((host) => ['bare', 'node', ...host.split('-')])

  if (entry.type & lex.constants.ADDON) {
    extensions = linked ? [] : ['.bare', '.node']
    conditions = conditions.map((conditions) => ['addon', ...conditions])

    return resolve.addon(entry.specifier || '.', parentURL, {
      extensions,
      conditions,
      hosts: target,
      linked,
      ...opts
    })
  }

  if (entry.type & lex.constants.ASSET) {
    conditions = conditions.map((conditions) => ['asset', ...conditions])
  } else {
    extensions = ['.js', '.cjs', '.mjs', '.json', '.bare', '.node']

    if (entry.type & lex.constants.REQUIRE) {
      conditions = conditions.map((conditions) => ['require', ...conditions])
    } else if (entry.type & lex.constants.IMPORT) {
      conditions = conditions.map((conditions) => ['import', ...conditions])
    }
  }

  return resolve.module(entry.specifier, parentURL, {
    extensions,
    conditions,
    ...opts
  })
}
