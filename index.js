const { lookupPackageScope } = require('bare-module-resolve')
const lex = require('bare-module-lexer')
const resolve = require('./lib/resolve')
const errors = require('./lib/errors')

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
      const artifacts = createArtifacts()

      const queue = [exports.module(entry, null, artifacts, new Set(), opts)]

      while (queue.length > 0) {
        const generator = queue.pop()

        let next = generator.next()

        while (next.done !== true) {
          const value = next.value

          if (value.module) {
            next = generator.next(readModule(value.module))
          } else if (value.prefix) {
            next = generator.next(listPrefix(value.prefix))
          } else {
            if (value.children) queue.push(value.children)
            else yield value.dependency

            next = generator.next()
          }
        }
      }

      return artifacts
    },

    async * [Symbol.asyncIterator] () {
      const artifacts = createArtifacts()

      const queue = [exports.module(entry, null, artifacts, new Set(), opts)]

      while (queue.length > 0) {
        const generator = queue.pop()

        let next = generator.next()

        while (next.done !== true) {
          const value = next.value

          if (value.module) {
            next = generator.next(await readModule(value.module))
          } else if (value.prefix) {
            next = generator.next(await listPrefix(value.prefix))
          } else {
            if (value.children) queue.push(value.children)
            else yield value.dependency

            next = generator.next()
          }
        }
      }

      return artifacts
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
  const { resolutions = null } = opts

  if (visited.has(url.href)) return false

  if (source === null) {
    source = yield { module: url }

    if (source === null) {
      throw errors.MODULE_NOT_FOUND(`Cannot find module '${url.href}'`)
    }
  }

  visited.add(url.href)

  if (resolutions) {
    if (yield * exports.preresolved(url, source, resolutions, artifacts, visited, opts)) {
      return true
    }
  }

  const imports = {}

  for (const packageURL of lookupPackageScope(url, opts)) {
    const source = yield { module: packageURL }

    if (source !== null) {
      imports['#package'] = packageURL.href

      yield { children: exports.package(packageURL, source, artifacts, visited, opts) }
    }
  }

  yield * exports.imports(url, source, imports, artifacts, visited, opts)

  yield { dependency: { url, source, imports: compressImportsMap(imports) } }

  return true
}

exports.package = function * (url, source, artifacts, visited, opts = {}) {
  if (visited.has(url.href)) return false

  visited.add(url.href)

  const info = JSON.parse(source)

  if (info) {
    yield { dependency: { url, source, imports: {} } }

    if (info.assets) {
      yield { children: exports.assets(info.assets, url, artifacts, visited, opts) }
    }

    return true
  }

  return false
}

exports.preresolved = function * (url, source, resolutions, artifacts, visited, opts = {}) {
  const imports = resolutions[url.href]

  if (typeof imports !== 'object' || imports === null) return false

  for (const [specifier, entry] of Object.entries(imports)) {
    const stack = [entry]

    while (stack.length > 0) {
      const entry = stack.pop()

      if (typeof entry === 'string') {
        const url = new URL(entry)

        if (specifier === '#package') {
          yield { children: exports.package(url, null, artifacts, visited, opts) }
        } else {
          yield { children: exports.module(url, null, artifacts, visited, opts) }
        }
      } else {
        stack.unshift(...Object.values(entry))
      }
    }
  }

  yield { dependency: { url, source, imports: compressImportsMap(imports) } }

  return true
}

exports.imports = function * (parentURL, source, imports, artifacts, visited, opts = {}) {
  const { resolve = defaultResolve } = opts

  let yielded = false

  for (const entry of lex(source).imports) {
    const resolver = resolve(entry, parentURL, opts)

    let next = resolver.next()
    let resolved = false

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

          yield { children: exports.module(url, source, artifacts, visited, opts) }

          resolved = yielded = true

          break
        }

        next = resolver.next()
      }
    }

    if (!resolved) {
      throw errors.MODULE_NOT_FOUND(`Cannot find module '${entry.specifier}' imported from '${parentURL.href}'`)
    }
  }

  return yielded
}

exports.assets = function * (patterns, parentURL, artifacts, visited, opts = {}) {
  const matches = yield * exports.matches(patterns, parentURL, opts)

  let yielded = false

  for (const href of matches) {
    const url = new URL(href)
    const source = yield { module: url }

    if (source !== null) {
      addURL(artifacts.assets, url)

      yield { children: exports.module(url, source, artifacts, visited, opts) }

      yielded = true
    }
  }

  return yielded
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

  let entries = []
  let primary = null

  for (const entry of Object.entries(resolved)) {
    entry[1] = compressImportsMapEntry(entry[1])

    entries.push(entry)

    if (entry[0] === 'default') primary = entry[1]
  }

  entries = entries.filter(([condition, resolved]) => condition === 'default' || resolved !== primary)

  if (entries.length === 1) {
    const [condition, resolved] = entries[0]

    if (condition === 'default') return resolved
  }

  return Object.fromEntries(entries)
}
