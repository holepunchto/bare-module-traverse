const lex = require('bare-module-lexer')
const resolve = require('./lib/resolve')

module.exports = exports = function traverse (entry, opts, readModule) {
  if (typeof opts === 'function') {
    readModule = opts
    opts = {}
  } else if (typeof readModule !== 'function') {
    readModule = defaultReadModule
  }

  return {
    * [Symbol.iterator] () {
      const generator = exports.module(entry, null, new Set(), opts)

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
      const generator = exports.module(entry, null, new Set(), opts)

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

function defaultReadModule () {
  return null
}

function defaultResolve (entry, parentURL, opts) {
  if (entry.type & lex.constants.ADDON) {
    return resolve.addon(entry.specifier, parentURL, opts)
  } else {
    return resolve.module(entry.specifier, parentURL, opts)
  }
}

exports.resolve = resolve

exports.module = function * (url, module = null, visited = new Set(), opts = {}) {
  const { resolve = defaultResolve } = opts

  if (visited.has(url.href)) return

  if (module === null) module = yield { module: url }

  if (module) {
    visited.add(url.href)

    for (const entry of lex(module).imports) {
      const resolver = resolve(entry, url, opts)

      let next = resolver.next()

      while (next.done !== true) {
        const value = next.value

        if (value.package) {
          const url = value.package

          const module = yield { module: url }

          if (module && !visited.has(url.href)) {
            yield { dependency: { url } }
          }

          next = resolver.next(JSON.parse(module))
        } else {
          const url = value.resolution

          if (visited.has(url.href)) break

          const module = yield { module: url }

          if (module) {
            yield { dependency: { url } }

            if ((entry.type & (lex.constants.ADDON | lex.constants.ASSET)) === 0) {
              yield * exports.module(url, module, visited, opts)
            }

            break
          }

          next = resolver.next()
        }
      }
    }
  }
}
