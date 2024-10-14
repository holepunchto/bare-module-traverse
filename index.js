const lex = require('bare-module-lexer')
const resolve = require('./lib/resolve')
const constants = require('./lib/constants')

module.exports = exports = function traverse (entry, opts, readModule) {
  if (typeof opts === 'function') {
    readModule = opts
    opts = {}
  }

  return {
    * [Symbol.iterator] () {
      const generator = exports.module(entry, readModule(entry), constants.MODULE, new Set(), opts)

      let next = generator.next()

      while (next.done !== true) {
        const value = next.value

        if (value.module) {
          next = generator.next(readModule(value.module))
        } else {
          yield value.dependency
          next = generator.next()
        }
      }

      return next.value
    },

    async * [Symbol.asyncIterator] () {
      const generator = exports.module(entry, await readModule(entry), constants.MODULE, new Set(), opts)

      let next = generator.next()

      while (next.done !== true) {
        const value = next.value

        if (value.module) {
          next = generator.next(await readModule(value.module))
        } else {
          yield value.dependency
          next = generator.next()
        }
      }

      return next.value
    }
  }
}

function defaultResolve (entry, parentURL, opts) {
  if (entry.type & lex.constants.ADDON) {
    return resolve.addon(entry.specifier, parentURL, opts)
  } else {
    return resolve.module(entry.specifier, parentURL, opts)
  }
}

exports.resolve = resolve
exports.constants = constants

exports.module = function * (url, module, type = constants.MODULE, visited = new Set(), opts = {}) {
  const { resolve = defaultResolve } = opts

  if (visited.has(url.href)) return

  visited.add(url.href)

  const imports = {}

  for (const entry of lex(module).imports) {
    const resolver = resolve(entry, url, opts)

    let next = resolver.next()

    while (next.done !== true) {
      const value = next.value

      if (value.package) {
        const url = value.package

        const module = yield { module: url }

        if (module) {
          imports['#package'] = url.href

          if (!visited.has(url.href)) {
            yield { dependency: { url, type: constants.MODULE, imports: {} } }
          }
        }

        next = resolver.next(JSON.parse(module))
      } else {
        const url = value.resolution

        const module = yield { module: url }

        if (module) {
          let type = constants.MODULE

          if (entry.type & lex.constants.ADDON) {
            type = constants.ADDON

            imports[entry.specifier] = { addon: url.href }
          } else if (entry.type & lex.constants.ASSET) {
            type = constants.ASSET

            imports[entry.specifier] = { asset: url.href }
          } else {
            imports[entry.specifier] = url.href
          }

          yield * exports.module(url, module, type, visited, opts)

          break
        }

        next = resolver.next()
      }
    }
  }

  yield { dependency: { url, type, imports } }
}
