const { lookupPackageScope } = require('bare-module-resolve')
const lex = require('bare-module-lexer')
const resolve = require('./lib/resolve')

module.exports = exports = function traverse (entry, opts, readModule, listPrefix) {
  if (typeof opts === 'function') {
    listPrefix = readModule
    readModule = opts
    opts = {}
  }

  if (typeof listPrefix !== 'function') {
    listPrefix = defaultListPrefix
  }

  return {
    * [Symbol.iterator] () {
      const generator = exports.module(entry, readModule(entry), createArtifacts(), new Set(), opts)

      let next = generator.next()

      while (next.done !== true) {
        const value = next.value

        if (value.module) {
          next = generator.next(readModule(value.module))
        } else if (value.prefix) {
          next = generator.next(listPrefix(value.prefix))
        } else {
          yield value.dependency
          next = generator.next()
        }
      }

      return next.value
    },

    async * [Symbol.asyncIterator] () {
      const generator = exports.module(entry, await readModule(entry), createArtifacts(), new Set(), opts)

      let next = generator.next()

      while (next.done !== true) {
        const value = next.value

        if (value.module) {
          next = generator.next(await readModule(value.module))
        } else if (value.prefix) {
          next = generator.next(await listPrefix(value.prefix))
        } else {
          yield value.dependency
          next = generator.next()
        }
      }

      return next.value
    }
  }
}

function defaultListPrefix () {
  return []
}

function defaultResolve (entry, parentURL, opts) {
  if (entry.type & lex.constants.ADDON) {
    return resolve.addon(entry.specifier, parentURL, opts)
  } else {
    return resolve.module(entry.specifier, parentURL, opts)
  }
}

function createArtifacts () {
  return { addons: [], assets: [] }
}

function addURL (array, url) {
  let lo = 0
  let hi = array.length - 1

  while (lo <= hi) {
    const mid = lo + ((hi - lo) >> 1)
    const found = array[mid]

    if (found.href === url.href) return

    if (found.href < url.href) {
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  array.splice(lo, 0, url)
}

exports.resolve = resolve

exports.module = function * (url, source, artifacts, visited, opts = {}) {
  const { resolve = defaultResolve } = opts

  if (visited.has(url.href)) return artifacts

  visited.add(url.href)

  const imports = {}

  for (const packageURL of lookupPackageScope(url, opts)) {
    const source = yield { module: packageURL }

    if (source !== null) {
      imports['#package'] = packageURL.href

      yield * exports.package(packageURL, source, artifacts, visited, opts)
    }
  }

  for (const entry of lex(source).imports) {
    const resolver = resolve(entry, url, opts)

    let next = resolver.next()

    while (next.done !== true) {
      const value = next.value

      if (value.package) {
        const url = value.package

        const source = yield { module: url }

        next = resolver.next(JSON.parse(source))
      } else {
        const url = value.resolution

        const source = yield { module: url }

        if (source !== null) {
          let key = 'default'

          if (entry.type & lex.constants.ADDON) {
            key = 'addon'
            addURL(artifacts.addons, url)
          } else if (entry.type & lex.constants.ASSET) {
            key = 'asset'
            addURL(artifacts.assets, url)
          }

          imports[entry.specifier] = { [key]: url.href, ...imports[entry.specifier] }

          yield * exports.module(url, source, artifacts, visited, opts)

          break
        }

        next = resolver.next()
      }
    }
  }

  yield { dependency: { url, source, imports: compressImportsMap(imports) } }

  return artifacts
}

exports.package = function * (url, source, artifacts, visited, opts = {}) {
  if (visited.has(url.href)) return artifacts

  visited.add(url.href)

  const info = JSON.parse(source)

  if (info) {
    yield { dependency: { url, source, imports: {} } }

    if (info.assets) {
      yield * exports.assets(info.assets, url, artifacts, visited, opts)
    }
  }

  return artifacts
}

exports.assets = function * (patterns, parentURL, artifacts, visited, opts = {}) {
  const matches = yield * exports.matches(patterns, parentURL, opts)

  for (const href of matches) {
    const url = new URL(href)

    const source = yield { module: url }

    if (source !== null) {
      addURL(artifacts.assets, url)

      yield * exports.module(url, source, artifacts, visited, opts)
    }
  }

  return artifacts
}

exports.matches = function * (patterns, parentURL) {
  const matches = new Set()

  for (let pattern of patterns) {
    let patternNegate = false
    let patternBase
    let patternTrailer

    if (pattern[0] === '!') {
      pattern = pattern.substring(1)
      patternNegate = true
    }

    const patternIndex = pattern.indexOf('*')

    if (patternIndex === -1) {
      patternBase = pattern
      patternTrailer = ''
    } else {
      patternBase = pattern.substring(0, patternIndex)
      patternTrailer = pattern.substring(patternIndex + 1)
    }

    const prefix = new URL(patternBase, parentURL)

    for (const url of yield { prefix }) {
      if (patternIndex === -1) {
        if (patternNegate) matches.delete(url.href)
        else matches.add(url.href)
      } else if (patternTrailer === '' || url.href.endsWith(patternTrailer)) {
        matches.add(url.href)
      } else if (patternNegate) {
        matches.delete(url.href)
      }
    }
  }

  return matches
}

function compressImportsMap (imports) {
  const entries = []

  for (const entry of Object.entries(imports)) {
    entry[1] = compressImportsMapEntry(entry[1])

    entries.push(entry)
  }

  return Object.fromEntries(entries)
}

function compressImportsMapEntry (resolved) {
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
