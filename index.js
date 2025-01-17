const { lookupPackageScope, conditionMatches } = require('bare-module-resolve')
const { lookupPrebuildsScope } = require('bare-addon-resolve')
const lex = require('bare-module-lexer')
const resolve = require('./lib/resolve')
const errors = require('./lib/errors')

module.exports = exports = function traverse(
  entry,
  opts,
  readModule,
  listPrefix
) {
  if (typeof opts === 'function') {
    listPrefix = readModule
    readModule = opts
    opts = {}
  }

  return {
    *[Symbol.iterator]() {
      const artifacts = { addons: [], assets: [] }

      const queue = [exports.module(entry, null, artifacts, new Set(), opts)]

      while (queue.length > 0) {
        const generator = queue.pop()

        let next = generator.next()

        while (next.done !== true) {
          const value = next.value

          if (value.module) {
            next = generator.next(readModule(value.module))
          } else if (value.prefix) {
            const result = []

            if (typeof listPrefix === 'function') {
              for (const url of listPrefix(value.prefix)) {
                result.push(url)
              }
            } else {
              if (readModule(value.prefix) !== null) {
                result.push(value.prefix)
              }
            }

            next = generator.next(result)
          } else {
            if (value.children) queue.push(value.children)
            else yield value.dependency

            next = generator.next()
          }
        }
      }

      return artifacts
    },

    async *[Symbol.asyncIterator]() {
      const artifacts = { addons: [], assets: [] }

      const queue = [exports.module(entry, null, artifacts, new Set(), opts)]

      while (queue.length > 0) {
        const generator = queue.pop()

        let next = generator.next()

        while (next.done !== true) {
          const value = next.value

          if (value.module) {
            next = generator.next(await readModule(value.module))
          } else if (value.prefix) {
            const result = []

            if (typeof listPrefix === 'function') {
              for await (const url of listPrefix(value.prefix)) {
                result.push(url)
              }
            } else {
              if ((await readModule(value.prefix)) !== null) {
                result.push(value.prefix)
              }
            }

            next = generator.next(result)
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

exports.resolve = resolve

exports.module = function* (url, source, artifacts, visited, opts = {}) {
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
    if (
      yield* exports.preresolved(
        url,
        source,
        resolutions,
        artifacts,
        visited,
        opts
      )
    ) {
      return true
    }
  }

  const imports = {}

  for (const packageURL of lookupPackageScope(url, opts)) {
    const source = yield { module: packageURL }

    if (source !== null) {
      imports['#package'] = packageURL.href

      yield {
        children: exports.package(packageURL, source, artifacts, visited, opts)
      }

      break
    }
  }

  yield* exports.imports(url, source, imports, artifacts, visited, opts)

  yield { dependency: { url, source, imports: compressImportsMap(imports) } }

  return true
}

exports.package = function* (url, source, artifacts, visited, opts = {}) {
  if (visited.has(url.href)) return false

  visited.add(url.href)

  const info = JSON.parse(source)

  if (info) {
    yield { dependency: { url, source, imports: {} } }

    if (info.addon) {
      yield { children: exports.prebuilds(url, artifacts, visited, opts) }
    }

    if (info.assets) {
      yield {
        children: exports.assets(info.assets, url, artifacts, visited, opts)
      }
    }

    return true
  }

  return false
}

exports.preresolved = function* (
  url,
  source,
  resolutions,
  artifacts,
  visited,
  opts = {}
) {
  const imports = resolutions[url.href]

  if (typeof imports !== 'object' || imports === null) return false

  for (const [specifier, entry] of Object.entries(imports)) {
    const stack = [entry]

    while (stack.length > 0) {
      const entry = stack.pop()

      if (typeof entry === 'string') {
        const url = new URL(entry)

        if (specifier === '#package') {
          yield {
            children: exports.package(url, null, artifacts, visited, opts)
          }
        } else {
          yield {
            children: exports.module(url, null, artifacts, visited, opts)
          }
        }
      } else {
        stack.unshift(...Object.values(entry))
      }
    }
  }

  yield { dependency: { url, source, imports: compressImportsMap(imports) } }

  return true
}

exports.imports = function* (
  parentURL,
  source,
  imports,
  artifacts,
  visited,
  opts = {}
) {
  const {
    resolve = exports.resolve.default,
    builtinProtocol = 'builtin:',
    linkedProtocol = 'linked:',
    matchedConditions = []
  } = opts

  let yielded = false

  for (const entry of lex(source).imports) {
    let specifier = entry.specifier
    let condition = 'default'

    if (entry.type & lex.constants.ADDON) {
      specifier = specifier || '.'
      condition = 'addon'
    } else if (entry.type & lex.constants.ASSET) {
      condition = 'asset'
    }

    matchedConditions.push(condition)

    const resolver = resolve(entry, parentURL, { ...opts, matchedConditions })

    let next = resolver.next()
    let resolutions = 0

    while (next.done !== true) {
      const value = next.value

      if (value.package) {
        next = resolver.next(JSON.parse(yield { module: value.package }))
      } else {
        const url = value.resolution

        let resolved = false

        if (
          url.protocol === builtinProtocol ||
          url.protocol === linkedProtocol
        ) {
          addResolution(imports, specifier, matchedConditions, url)

          resolved = yielded = true
        } else if (condition === 'asset') {
          const prefix = yield { prefix: url }

          if (prefix.length !== 0) {
            addResolution(imports, specifier, matchedConditions, url)

            for (const url of prefix) {
              yield {
                children: exports.module(url, null, artifacts, visited, opts)
              }

              addURL(artifacts.assets, url)
            }

            resolved = yielded = true
          }
        } else {
          const source = yield { module: url }

          if (source !== null) {
            addResolution(imports, specifier, matchedConditions, url)

            yield {
              children: exports.module(url, source, artifacts, visited, opts)
            }

            resolved = yielded = true
          }
        }

        if (resolved) {
          if (condition === 'addon') addURL(artifacts.addons, url)

          resolutions++
        }

        next = resolver.next(resolved)
      }
    }

    matchedConditions.pop()

    if (resolutions === 0) {
      switch (condition) {
        case 'addon':
          throw errors.ADDON_NOT_FOUND(
            `Cannot find addon '${specifier}' imported from '${parentURL.href}'`
          )
        case 'asset':
          throw errors.ASSET_NOT_FOUND(
            `Cannot find asset '${specifier}' imported from '${parentURL.href}'`
          )
        default:
          throw errors.MODULE_NOT_FOUND(
            `Cannot find module '${specifier}' imported from '${parentURL.href}'`
          )
      }
    }
  }

  return yielded
}

exports.prebuilds = function* (packageURL, artifacts, visited, opts = {}) {
  const {
    host = null, // Shorthand for single host resolution
    hosts = host !== null ? [host] : [],
    matchedConditions = []
  } = opts

  const [prebuildsURL = null] = lookupPrebuildsScope(packageURL, opts)

  if (prebuildsURL === null) return false

  let yielded = false

  for (const host of hosts) {
    const prefix = new URL(host + '/', prebuildsURL)

    const conditions = host.split('-')

    matchedConditions.push(...conditions)

    for (const url of yield { prefix }) {
      const source = yield { module: url }

      if (source !== null) {
        addURL(artifacts.addons, url)

        yield {
          children: exports.module(url, source, artifacts, visited, opts)
        }

        yielded = true
      }
    }

    for (const _ of conditions) matchedConditions.pop()
  }

  return yielded
}

exports.assets = function* (
  patterns,
  parentURL,
  artifacts,
  visited,
  opts = {}
) {
  const matches = yield* exports.patternMatches(patterns, parentURL, [], opts)

  let yielded = false

  for (const url of matches) {
    const source = yield { module: url }

    if (source !== null) {
      addURL(artifacts.assets, url)

      yield { children: exports.module(url, source, artifacts, visited, opts) }

      yielded = true
    }
  }

  return yielded
}

exports.patternMatches = function* patternMatches(
  pattern,
  parentURL,
  matches,
  opts = {}
) {
  const { conditions = [], matchedConditions = [] } = opts

  if (typeof pattern === 'string') {
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
        if (patternNegate) removeURL(matches, url)
        else addURL(matches, url)
      } else if (patternTrailer === '' || url.href.endsWith(patternTrailer)) {
        addURL(matches, url)
      } else if (patternNegate) {
        removeURL(matches, url)
      }
    }
  } else if (Array.isArray(pattern)) {
    for (const patternValue of pattern) {
      yield* patternMatches(patternValue, parentURL, matches, opts)
    }
  } else if (typeof pattern === 'object' && pattern !== null) {
    let yielded = false

    for (const [condition, patternValue, subset] of conditionMatches(
      pattern,
      conditions,
      opts
    )) {
      matchedConditions.push(condition)

      if (
        yield* patternMatches(patternValue, parentURL, matches, {
          ...opts,
          conditions: subset
        })
      ) {
        yielded = true
      }

      matchedConditions.pop()
    }

    if (yielded) return true
  }

  return matches
}

function addURL(array, url) {
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

function removeURL(array, url) {
  let lo = 0
  let hi = array.length - 1

  while (lo <= hi) {
    const mid = lo + ((hi - lo) >> 1)
    const found = array[mid]

    if (found.href === url.href) break

    if (found.href < url.href) {
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  if (array[lo].href === url.href) array.splice(lo, 1)
}

function addResolution(imports, specifier, conditions, url) {
  imports[specifier] = imports[specifier] || {}

  let current = imports[specifier]

  for (let i = 0, n = conditions.length - 1; i < n; i++) {
    const key = conditions[i]

    if (key in current === false) {
      current[key] = {}
    } else if (typeof current[key] !== 'object') {
      current[key] = { default: current[key] }
    }

    current = current[key]
  }

  const last = conditions[conditions.length - 1]

  current[last] = url.href

  if ('default' in current) {
    const value = current.default

    delete current.default

    current.default = value
  }
}

function compressImportsMap(imports) {
  const entries = []

  for (const entry of Object.entries(imports)) {
    entry[1] = compressImportsMapEntry(entry[1])

    entries.push(entry)
  }

  return Object.fromEntries(entries)
}

function compressImportsMapEntry(resolved) {
  if (typeof resolved === 'string') return resolved

  let entries = []
  let primary = null

  for (const entry of Object.entries(resolved)) {
    entry[1] = compressImportsMapEntry(entry[1])

    entries.push(entry)

    if (entry[0] === 'default') primary = entry[1]
  }

  entries = entries.filter(
    ([condition, resolved]) => condition === 'default' || resolved !== primary
  )

  if (entries.length === 1) return entries[0][1]

  return Object.fromEntries(entries)
}
