const { lookupPackageScope, conditionMatches } = require('bare-module-resolve')
const lex = require('bare-module-lexer')
const MIME = require('bare-mime')
const resolve = require('./lib/resolve')
const errors = require('./lib/errors')

const constants = {
  SCRIPT: 1,
  MODULE: 2,
  JSON: 3,
  BUNDLE: 4,
  ADDON: 5,
  BINARY: 6,
  TEXT: 7
}

function defaultResolveModule(url) {
  return url
}

function defaultProbeModule() {
  return undefined
}

module.exports = exports = function traverse(
  entry,
  opts,
  readModule,
  listPrefix,
  probeModule,
  resolveModule
) {
  if (typeof opts === 'function') {
    resolveModule = probeModule
    probeModule = listPrefix
    listPrefix = readModule
    readModule = opts
    opts = {}
  }

  if (typeof resolveModule !== 'function') resolveModule = defaultResolveModule
  if (typeof probeModule !== 'function') probeModule = defaultProbeModule

  return {
    *[Symbol.iterator]() {
      const artifacts = { addons: [], assets: [] }

      const visited = opts.visited || new Set()

      const queue = [exports.module(entry, null, {}, artifacts, visited, opts)]
      const deferred = []

      function* drive(generator) {
        let next = generator.next()

        while (next.done !== true) {
          const value = next.value

          if (value.module) {
            next = generator.next(readModule(value.module))
          } else if (value.probe) {
            next = generator.next(probeModule(value.probe))
          } else if (value.resolution) {
            next = generator.next(resolveModule(value.resolution))
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
          } else if (value.links) {
            for (const link of value.links) yield* drive(link)

            next = generator.next()
          } else if (value.children) {
            if (value.deferred) deferred.push(value.children)
            else queue.push(value.children)

            next = generator.next()
          } else {
            yield value.dependency

            next = generator.next()
          }
        }
      }

      while (queue.length > 0 || deferred.length > 0) {
        yield* drive(queue.length > 0 ? queue.pop() : deferred.shift())
      }

      return artifacts
    },

    async *[Symbol.asyncIterator]() {
      const artifacts = { addons: [], assets: [] }

      const visited = opts.visited || new Set()

      const queue = [exports.module(entry, null, {}, artifacts, visited, opts)]
      const deferred = []

      async function* drive(generator) {
        let next = generator.next()

        while (next.done !== true) {
          const value = next.value

          if (value.module) {
            next = generator.next(await readModule(value.module))
          } else if (value.probe) {
            next = generator.next(await probeModule(value.probe))
          } else if (value.resolution) {
            next = generator.next(await resolveModule(value.resolution))
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
          } else if (value.links) {
            for (const link of value.links) yield* drive(link)

            next = generator.next()
          } else if (value.children) {
            if (value.deferred) deferred.push(value.children)
            else queue.push(value.children)

            next = generator.next()
          } else {
            yield value.dependency

            next = generator.next()
          }
        }
      }

      while (queue.length > 0 || deferred.length > 0) {
        yield* drive(queue.length > 0 ? queue.pop() : deferred.shift())
      }

      return artifacts
    }
  }
}

exports.constants = constants
exports.resolve = resolve

exports.alias = function alias(url, opts = {}) {
  const { aliases = null } = opts

  if (aliases === null) return url

  const match = url.pathname.match(/\.[a-z]+$/)

  if (match === null) return url

  const [extension] = match

  if (extension in aliases === false) return url

  url = new URL(url)

  url.pathname = url.pathname.slice(0, -extension.length) + aliases[extension]

  return url
}

exports.module = function* (url, source, attributes, artifacts, visited, opts = {}) {
  const { resolutions = null, asset = false, probed } = opts

  if (visited.has(url.href)) return false

  visited.add(url.href)

  if (probed !== undefined) opts = { ...opts, probed: undefined }

  attributes = attributes || {}

  const artifact = asset === true || moduleType(url, attributes, null, opts) === constants.ADDON

  if (source === null) {
    if (url.protocol === 'data:') {
      source = decodeDataURL(url)
    } else {
      const exists = probed !== undefined ? probed : artifact ? yield { probe: url } : undefined

      if (exists === false) {
        throw errors.MODULE_NOT_FOUND(`Cannot find module '${url.href}'`, url.href)
      }

      source = yield { module: url, artifact }

      if (exists !== true && source === null) {
        throw errors.MODULE_NOT_FOUND(`Cannot find module '${url.href}'`, url.href)
      }
    }
  }

  if (resolutions) {
    if (yield* exports.preresolved(url, source, resolutions, artifacts, visited, opts)) {
      return true
    }
  }

  const imports = {}

  let info = null

  if (url.protocol !== 'data:') {
    for (const packageURL of lookupPackageScope(url, opts)) {
      const source = yield { module: packageURL, artifact: false }

      if (source !== null) {
        info = JSON.parse(source)

        imports['#package'] = packageURL.href

        yield {
          children: exports.package(packageURL, source, artifacts, visited, opts),
          deferred: false
        }

        break
      }
    }
  }

  if (typeof attributes.imports === 'string') {
    const url = new URL(attributes.imports)

    const source = yield { module: url, artifact: false }

    if (source !== null) {
      opts = {
        ...opts,
        imports: mixinImports(opts.imports, JSON.parse(source), url)
      }
    }
  }

  const type = moduleType(url, attributes, info, opts)

  const lexer = { imports: [], exports: [] }

  if (asset === false) {
    if (type === constants.SCRIPT || type === constants.MODULE) {
      yield* exports.imports(url, source, imports, artifacts, lexer, visited, opts)
    } else if (type === constants.ADDON) {
      yield* exports.addons(url, artifacts, visited, opts)
    }
  }

  yield {
    dependency: {
      url: exports.alias(url, opts),
      source,
      type,
      imports: compressImportsMap(imports),
      lexer
    }
  }

  return true
}

exports.package = function* (url, source, artifacts, visited, opts = {}) {
  if (visited.has(url.href)) return false

  visited.add(url.href)

  if (source === null) {
    source = yield { module: url, artifact: false }

    if (source === null) return false
  }

  const info = JSON.parse(source)

  if (info) {
    yield {
      dependency: {
        url,
        source,
        type: constants.JSON,
        imports: {},
        lexer: { imports: [], exports: [] }
      }
    }

    if (info.assets) {
      yield {
        children: exports.assets(info.assets, url, artifacts, visited, opts),
        deferred: false
      }
    }

    return true
  }

  return false
}

exports.preresolved = function* (url, source, resolutions, artifacts, visited, opts = {}) {
  const {
    builtinProtocol = 'builtin:',
    linkedProtocol = 'linked:',
    deferredProtocol = 'deferred:'
  } = opts

  const imports = resolutions[url.href]

  if (typeof imports !== 'object' || imports === null) return false

  for (const [specifier, entry] of Object.entries(imports)) {
    const stack = [{ entry, asset: false }]

    while (stack.length > 0) {
      const { entry, asset } = stack.pop()

      if (typeof entry === 'string') {
        const url = new URL(entry)

        if (specifier === '#package') {
          yield {
            children: exports.package(url, null, artifacts, visited, opts),
            deferred: false
          }
        } else if (asset) {
          addURL(artifacts.assets, url)

          yield {
            children: exports.module(url, null, {}, artifacts, visited, {
              ...opts,
              asset: true
            }),
            deferred: true
          }
        } else if (
          url.protocol !== builtinProtocol &&
          url.protocol !== linkedProtocol &&
          url.protocol !== deferredProtocol
        ) {
          yield {
            children: exports.module(url, null, {}, artifacts, visited, opts),
            deferred: false
          }
        }
      } else {
        for (const [condition, child] of Object.entries(entry)) {
          stack.push({ entry: child, asset: asset || condition === 'asset' })
        }
      }
    }
  }

  const type = moduleType(url, {}, null, opts)

  const lexer = { imports: [], exports: [] }

  if (type === constants.SCRIPT || type === constants.MODULE) {
    lexer.exports = lex(source).exports
  }

  yield {
    dependency: {
      url: exports.alias(url, opts),
      source,
      type,
      imports: compressImportsMap(imports),
      lexer
    }
  }

  return true
}

exports.imports = function* (parentURL, source, imports, artifacts, lexer, visited, opts = {}) {
  const lexed = lex(source)

  lexer.exports = lexed.exports

  const links = []

  for (const entry of lexed.imports) {
    let specifier = entry.specifier
    let condition = 'default'

    if (entry.type & lex.constants.ADDON) {
      specifier = specifier || '.'
      condition = 'addon'
    } else if (entry.type & lex.constants.ASSET) {
      condition = 'asset'
    } else if (entry.type & lex.constants.REQUIRE) {
      condition = 'require'
    } else if (entry.type & lex.constants.IMPORT) {
      condition = 'import'
    }

    lexer.imports.push(entry)

    links.push(
      exports.link(entry, specifier, condition, parentURL, imports, artifacts, visited, opts)
    )
  }

  yield { links }
}

exports.link = function* (
  entry,
  specifier,
  condition,
  parentURL,
  imports,
  artifacts,
  visited,
  opts = {}
) {
  if (entry.attributes.imports) {
    const specifier = entry.attributes.imports

    yield* resolveImport(
      { type: 0, specifier, names: [], attributes: {}, position: [0, 0, 0] },
      specifier,
      'default',
      parentURL,
      imports,
      artifacts,
      visited,
      opts
    )
  }

  yield* resolveImport(entry, specifier, condition, parentURL, imports, artifacts, visited, opts)
}

function* resolveImport(entry, specifier, condition, parentURL, imports, artifacts, visited, opts) {
  const {
    resolve = exports.resolve.default,
    builtinProtocol = 'builtin:',
    linkedProtocol = 'linked:',
    deferredProtocol = 'deferred:'
  } = opts

  const matchedConditions = []

  opts = { ...opts, matchedConditions }

  matchedConditions.push(condition)

  const resolver = resolve(entry, parentURL, opts)
  const candidates = []

  let next = resolver.next()
  let resolutions = 0

  while (next.done !== true) {
    const value = next.value

    if (value.package) {
      next = resolver.next(JSON.parse(yield { module: value.package, artifact: false }))
    } else {
      const url = value.resolution

      candidates.push(url)

      let resolved = false
      let resolution = url

      if (
        url.protocol === builtinProtocol ||
        url.protocol === linkedProtocol ||
        url.protocol === deferredProtocol
      ) {
        addResolution(imports, specifier, matchedConditions, url)

        resolved = true
      } else if (condition === 'asset') {
        const prefix = url

        for (const url of yield { prefix }) {
          const resolution = yield* postresolve(url)

          yield {
            children: exports.module(resolution, null, {}, artifacts, visited, {
              ...opts,
              asset: true
            }),
            deferred: true
          }

          addURL(artifacts.assets, resolution)

          resolved = true
        }

        if (resolved) addResolution(imports, specifier, matchedConditions, url)
      } else if (
        condition === 'addon' ||
        moduleType(url, entry.attributes, null, opts) === constants.ADDON
      ) {
        let exists = yield { probe: url }
        let source = null

        if (exists === undefined) {
          source = yield { module: url, artifact: false }
          exists = source !== null
        }

        if (exists) {
          resolution = yield* postresolve(url)

          addResolution(imports, specifier, matchedConditions, exports.alias(resolution, opts))

          yield {
            children: exports.module(resolution, source, {}, artifacts, visited, {
              ...opts,
              probed: true
            }),
            deferred: false
          }

          resolved = true
        }
      } else {
        let source

        if (url.protocol === 'data:') {
          source = decodeDataURL(url)
        } else {
          source = yield { module: url, artifact: false }
        }

        if (source !== null) {
          resolution = yield* postresolve(url)

          addResolution(imports, specifier, matchedConditions, exports.alias(resolution, opts))

          let attributes = entry.attributes

          if (attributes.imports) {
            attributes = { ...attributes, imports: imports[attributes.imports].default }
          }

          yield {
            children: exports.module(resolution, source, attributes, artifacts, visited, opts),
            deferred: false
          }

          resolved = true
        }
      }

      if (resolved) {
        if (condition === 'addon') addURL(artifacts.addons, resolution)

        resolutions++
      }

      next = resolver.next(resolved)
    }
  }

  matchedConditions.pop()

  if (resolutions === 0) {
    let message = `Cannot find ${condition === 'addon' || condition === 'asset' ? condition : 'module'} '${specifier}' imported from '${parentURL.href}'`

    if (candidates.length > 0) {
      message += '\nCandidates:'
      message += '\n' + candidates.map((url) => '- ' + url.href).join('\n')
    }

    switch (condition) {
      case 'addon':
        throw errors.ADDON_NOT_FOUND(message, specifier, parentURL, candidates)
      case 'asset':
        throw errors.ASSET_NOT_FOUND(message, specifier, parentURL, candidates)
      default:
        throw errors.MODULE_NOT_FOUND(message, specifier, parentURL, candidates)
    }
  }
}

const ADDON_EXTENSION = /\.(bare|node)$/

exports.addons = function* (parentURL, artifacts, visited, opts = {}) {
  let yielded = false

  if (ADDON_EXTENSION.test(parentURL.pathname)) {
    const prefix = new URL(parentURL)

    prefix.pathname = prefix.pathname.replace(ADDON_EXTENSION, '') + '/'

    for (const url of yield { prefix }) {
      const resolution = yield* postresolve(url)

      yield {
        children: exports.module(resolution, null, {}, artifacts, visited, opts),
        deferred: false
      }

      addURL(artifacts.addons, resolution)

      yielded = true
    }
  }

  return yielded
}

exports.assets = function* (patterns, parentURL, artifacts, visited, opts = {}) {
  const matches = yield* exports.patternMatches(patterns, parentURL, [], opts)

  let yielded = false

  for (const url of matches) {
    const resolution = yield* postresolve(url)

    addURL(artifacts.assets, resolution)

    yield {
      children: exports.module(resolution, null, {}, artifacts, visited, {
        ...opts,
        asset: true
      }),
      deferred: true
    }

    yielded = true
  }

  return yielded
}

exports.patternMatches = function* patternMatches(pattern, parentURL, matches, opts = {}) {
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

    for (const [condition, patternValue, subset] of conditionMatches(pattern, conditions, opts)) {
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

function* postresolve(url) {
  return (yield { resolution: url }) || url
}

function moduleType(url, attributes, info, opts = {}) {
  const { defaultType = constants.SCRIPT, aliases = null } = opts

  if (typeof attributes.type === 'string') {
    switch (attributes.type) {
      case 'script':
        return constants.SCRIPT
      case 'module':
        return constants.MODULE
      case 'json':
        return constants.JSON
      case 'bundle':
        return constants.BUNDLE
      case 'addon':
        return constants.ADDON
      case 'binary':
        return constants.BINARY
      case 'text':
        return constants.TEXT
    }

    return 0
  }

  if (url.protocol === 'data:') {
    const { mime } = parseDataURL(url)

    if (mime !== null) {
      if (mime.subtype === 'javascript' && (mime.type === 'application' || mime.type === 'text')) {
        return defaultType === constants.MODULE ? constants.MODULE : constants.SCRIPT
      }

      if (mime.subtype === 'json' && mime.type === 'application') {
        return constants.JSON
      }
    }

    return defaultType
  }

  const match = url.pathname.match(/\.[a-z]+$/)

  if (match === null) return defaultType

  let [extension] = match

  if (aliases !== null && extension in aliases) extension = aliases[extension]

  switch (extension) {
    case '.js':
    case '.ts':
      return defaultType === constants.MODULE || (info !== null && info.type === 'module')
        ? constants.MODULE
        : constants.SCRIPT
    case '.cjs':
    case '.cts':
      return constants.SCRIPT
    case '.mjs':
    case '.mts':
      return constants.MODULE
    case '.json':
      return constants.JSON
    case '.bundle':
      return constants.BUNDLE
    case '.bare':
    case '.node':
      return constants.ADDON
    case '.bin':
      return constants.BINARY
    case '.txt':
      return constants.TEXT
  }

  return defaultType
}

function parseDataURL(url) {
  const { pathname } = url

  const comma = pathname.indexOf(',')

  const meta = comma === -1 ? pathname : pathname.slice(0, comma)
  const data = comma === -1 ? '' : pathname.slice(comma + 1)

  const base64 = /;base64$/i.test(meta)

  return { mime: MIME.parse(meta), base64, data }
}

function decodeDataURL(url) {
  const { mime, base64, data } = parseDataURL(url)

  const charset = mime === null ? undefined : mime.parameters.get('charset')

  if (charset !== undefined && !/^utf-?8$/i.test(charset)) {
    throw errors.UNSUPPORTED_DATA_URL_CHARSET(
      `Unsupported charset '${charset}' in data URL '${url.href}'`,
      charset
    )
  }

  if (base64) return Buffer.from(data, 'base64')

  return decodeURIComponent(data)
}

function addURL(collection, url) {
  if (Array.isArray(collection)) {
    let lo = 0
    let hi = collection.length - 1

    while (lo <= hi) {
      const mid = lo + ((hi - lo) >> 1)
      const found = collection[mid]

      if (found.href === url.href) return

      if (found.href < url.href) {
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }

    collection.splice(lo, 0, url)
  } else {
    collection.add(url.href)
  }
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

  if (entries.length === 0) return resolved

  const [, first] = entries[0]

  if (entries.every(([, resolved]) => resolved === first)) return first

  entries = entries.filter(
    ([condition, resolved]) => condition === 'default' || resolved !== primary
  )

  if (entries.length === 1) return entries[0][1]

  return Object.fromEntries(entries)
}

function mixinImports(target, imports, url) {
  if (typeof imports === 'object' && imports !== null && 'imports' in imports) {
    imports = imports.imports
  }

  if (typeof imports !== 'object' || imports === null) {
    throw errors.INVALID_IMPORTS_MAP(`Imports map at '${url.href}' is not valid`)
  }

  return { ...target, ...imports }
}
