const lex = require('bare-module-lexer')

exports.module = require('bare-module-resolve').module
exports.addon = require('bare-addon-resolve').addon

exports.default = function resolve (entry, parentURL, opts) {
  if (entry.type & lex.constants.ADDON) {
    return exports.addon(entry.specifier, parentURL, opts)
  }

  return exports.module(entry.specifier, parentURL, opts)
}

exports.bare = function resolve (entry, parentURL, opts = {}) {
  const runtime = require('#runtime')

  const {
    platform = runtime.platform,
    arch = runtime.arch,
    simulator = false
  } = opts

  let extensions
  let conditions = ['bare', 'node', platform, arch]

  if (simulator) conditions = [...conditions, 'simulator']

  if (entry.type & lex.constants.ADDON) {
    extensions = ['.bare', '.node']
    conditions = ['addon', ...conditions]

    return exports.addon(entry.specifier, parentURL, { extensions, conditions, ...opts })
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

  return exports.module(entry.specifier, parentURL, { extensions, conditions, ...opts })
}

exports.node = function resolve (entry, parentURL, opts) {
  let extensions
  let conditions

  if (entry.type & lex.constants.ADDON) {
    extensions = ['.node']

    return exports.addon(entry.specifier, parentURL, { extensions, conditions, ...opts })
  }

  if (entry.type & lex.constants.REQUIRE) {
    extensions = ['.js', '.json', '.node']
    conditions = ['node', 'require']
  } else if (entry.type & lex.constants.IMPORT) {
    conditions = ['node', 'import']
  }

  return exports.module(entry.specifier, parentURL, { extensions, conditions, ...opts })
}
