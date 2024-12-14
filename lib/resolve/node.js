const lex = require('bare-module-lexer')
const resolve = require('../resolve')

module.exports = function (entry, parentURL, opts = {}) {
  const runtime = require('#runtime')

  const {
    platform = runtime.platform,
    arch = runtime.arch,
    simulator = false,
    host = `${platform}-${arch}${simulator ? '-simulator' : ''}`,
    target = [host]
  } = opts

  let extensions
  let conditions

  if (entry.type & lex.constants.ADDON) {
    extensions = ['.node']
    conditions = target.map((host) => ['node', 'addon', ...host.split('-')])

    return resolve.addon(entry.specifier || '.', parentURL, {
      extensions,
      conditions,
      host,
      ...opts
    })
  }

  if (entry.type & lex.constants.ASSET) {
    conditions = ['node', 'asset']
  } else if (entry.type & lex.constants.REQUIRE) {
    extensions = ['.js', '.json', '.node']
    conditions = ['node', 'require']
  } else if (entry.type & lex.constants.IMPORT) {
    conditions = ['node', 'import']
  } else {
    conditions = ['node']
  }

  return resolve.module(entry.specifier, parentURL, {
    extensions,
    conditions,
    ...opts
  })
}
