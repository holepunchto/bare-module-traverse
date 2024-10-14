const lex = require('bare-module-lexer')
const resolve = require('./lib/resolve')

module.exports = exports = function traverse (entry, opts, readModule) {
  if (typeof opts === 'function') {
    readModule = opts
    opts = {}
  }

  return {
    * [Symbol.iterator] () {
      const generator = exports.module(entry, readModule(entry), new Set(), opts)

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
      const generator = exports.module(entry, await readModule(entry), new Set(), opts)

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

exports.module = function * (url, module, visited = new Set(), opts = {}) {
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

          yield * exports.module(url, module, visited, opts)
        }

        next = resolver.next(JSON.parse(module))
      } else {
        const url = value.resolution

        const module = yield { module: url }

        if (module) {
          let key = 'default'

          if (entry.type & lex.constants.ADDON) {
            key = 'addon'
          } else if (entry.type & lex.constants.ASSET) {
            key = 'asset'
          }

          imports[entry.specifier] = { [key]: url.href, ...imports[entry.specifier] }

          yield * exports.module(url, module, visited, opts)

          break
        }

        next = resolver.next()
      }
    }
  }

  yield { dependency: { url, imports: compressImports(imports) } }
}

function compressImports (imports) {
  const entries = []

  for (const [specifier, resolved] of Object.entries(imports)) {
    entries.push([specifier, compressImportsEntry(resolved)])
  }

  return Object.fromEntries(entries)
}

function compressImportsEntry (resolved) {
  if (typeof resolved === 'string') return resolved

  const entries = Object.entries(resolved)

  if (entries.length === 1) {
    const [condition, specifier] = entries[0]

    if (condition === 'default') return specifier
  }

  return Object.fromEntries(entries)
}
