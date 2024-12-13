const lex = require('bare-module-lexer')
const resolve = require('../resolve')

module.exports = function (entry, parentURL, opts = {}) {
  const runtime = require('#runtime')

  const {
    linked = false,
    platform = runtime.platform,
    arch = runtime.arch,
    simulator = false,
    host = `${platform}-${arch}${simulator ? '-simulator' : ''}`
  } = opts

  let extensions
  let conditions = ['bare', 'node', platform, arch]

  if (simulator) conditions = [...conditions, 'simulator']

  if (entry.type & lex.constants.ADDON) {
    extensions = linked ? [] : ['.bare', '.node']
    conditions = ['addon', ...conditions]

    return resolve.addon(entry.specifier || '.', parentURL, {
      extensions,
      conditions,
      host,
      linked,
      ...opts
    })
  }

  if (entry.type & lex.constants.ASSET) {
    conditions = ['asset', ...conditions]
  } else {
    extensions = ['.js', '.cjs', '.mjs', '.json', '.bare', '.node']

    if (entry.type & lex.constants.REQUIRE) {
      conditions = ['require', ...conditions]
    } else if (entry.type & lex.constants.IMPORT) {
      conditions = ['import', ...conditions]
    }
  }

  return resolve.module(entry.specifier, parentURL, {
    extensions,
    conditions,
    ...opts
  })
}
