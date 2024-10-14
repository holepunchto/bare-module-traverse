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

  const modules = new Map()
  const imports = {}

  for (const entry of lex(module).imports) {
    const resolver = resolve(entry, url, opts)

    let next = resolver.next()

    while (next.done !== true) {
      const value = next.value

      if (value.package) {
        const url = value.package

        const module = modules.get(url.href) || (yield { module: url })

        if (module) {
          modules.set(url.href, module)

          imports['#package'] = url.href
        }

        next = resolver.next(JSON.parse(module))
      } else {
        const url = value.resolution

        const module = modules.get(url.href) || (yield { module: url })

        if (module) {
          modules.set(url.href, module)

          let key = 'default'

          if (entry.type & lex.constants.ADDON) {
            key = 'addon'
          } else if (entry.type & lex.constants.ASSET) {
            key = 'asset'
          }

          imports[entry.specifier] = { [key]: url.href, ...imports[entry.specifier] }

          break
        }

        next = resolver.next()
      }
    }
  }

  yield { dependency: { url, type, imports: compressImports(imports) } }

  for (const resolved of Object.values(imports)) {
    if (typeof resolved === 'string') {
      yield * exports.module(new URL(resolved), modules.get(resolved), constants.MODULE, visited, opts)
    } else {
      let type = 0

      if ('default' in resolved) type |= constants.MODULE
      if ('addon' in resolved) type |= constants.ADDON
      if ('asset' in resolved) type |= constants.ASSET

      for (const href of Object.values(resolved)) {
        yield * exports.module(new URL(href), modules.get(href), type, visited, opts)
      }
    }
  }
}

function compressImports (imports) {
  const result = {}

  for (const [specifier, resolved] of Object.entries(imports)) {
    result[specifier] = compressImportsEntry(resolved)
  }

  return result
}

function compressImportsEntry (resolved) {
  if (typeof resolved === 'string') return resolved

  const entries = Object
    .entries(resolved)
    .filter(([condition, specifier]) => condition === 'default' || specifier !== resolved.default)

  if (entries.length === 1) {
    const [condition, specifier] = entries[0]

    if (condition === 'default') return specifier
  }

  return Object.fromEntries(entries)
}
