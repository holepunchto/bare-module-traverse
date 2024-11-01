const lex = require('bare-module-lexer')
const resolve = require('../resolve')

module.exports = function (entry, parentURL, opts) {
  let extensions
  let conditions

  if (entry.type & lex.constants.ADDON) {
    extensions = ['.node']

    return resolve.addon(entry.specifier, parentURL, { extensions, conditions, ...opts })
  }

  if (entry.type & lex.constants.REQUIRE) {
    extensions = ['.js', '.json', '.node']
    conditions = ['node', 'require']
  } else if (entry.type & lex.constants.IMPORT) {
    conditions = ['node', 'import']
  }

  return resolve.module(entry.specifier, parentURL, { extensions, conditions, ...opts })
}
