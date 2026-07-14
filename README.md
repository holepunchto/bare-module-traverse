# bare-module-traverse

Low-level module graph traversal for Bare. The algorithm is implemented as a generator function that yields either modules to be read, modules to be probed for existence, resolutions to be transformed, prefixes to be listed, sets of imports to be resolved, child dependencies to be traversed, or resolved dependencies of the module graph. As a convenience, the main export is a synchronous and asynchronous iterable that relies on modules being read, modules being probed, resolutions being transformed, and prefixes being listed by callbacks. For asynchronous iteration, the callbacks may return promises which will be awaited before being passed to the generator.

```
npm i bare-module-traverse
```

## Usage

For synchronous traversal:

```js
const traverse = require('bare-module-traverse')

function readModule(url) {
  // Read `url` if it exists, otherwise `null`
}

function* listPrefix(url) {
  // Yield URLs that have `url` as a prefix. The list may be empty.
}

for (const dependency of traverse(new URL('file:///directory/file.js'), readModule, listPrefix)) {
  console.log(dependency)
}
```

For asynchronous traversal:

```js
const traverse = require('bare-module-traverse')

async function readModule(url) {
  // Read `url` if it exists, otherwise `null`
}

async function* listPrefix(url) {
  // Yield URLs that have `url` as a prefix. The list may be empty.
}

for await (const dependency of traverse(
  new URL('file:///directory/file.js'),
  readModule,
  listPrefix
)) {
  console.log(dependency)
}
```

## API

#### `const dependencies = traverse(url[, options], readModule[, listPrefix[, probeModule[, resolveModule]]])`

Traverse the module graph rooted at `url`, which must be a WHATWG `URL` instance. `readModule` is called with a `URL` instance for every module to be read and must either return the module source, if it exists, or `null`. `listPrefix` is called with a `URL` instance of every prefix to be listed and must yield `URL` instances that have the specified `URL` as a prefix. If not provided, prefixes won't be traversed. `probeModule` is called with a `URL` instance to test whether a module exists and must return `true` if it does, `false` if it doesn't, or `undefined` if probing isn't supported; this lets existence be checked without reading the full module source, such as when locating an addon or asset. When it returns `undefined`, existence is instead determined by reading the module, so no source is read twice. If not provided, `probeModule` returns `undefined` and no probing is performed. `resolveModule` is called with a `URL` instance for every resolved, existing module and must return the `URL` to use in its place, applying any post-resolution transform; a file system implementation would canonicalize symlinks here with `realpath` so a module reached through different symlinks dedupes against its real location. If not provided, resolutions are used unchanged. If `readModule`, `probeModule`, or `resolveModule` returns a promise, or `listPrefix` returns a promise generator, synchronous iteration is not supported.

Options include:

```js
options = {
  defaultType: constants.SCRIPT,
  aliases: {
    // Map an extension to a supported extension, e.g. `'.ts': '.js'`. The
    // aliased extension is used for module type detection, so `readModule()`
    // must return source compatible with that type. Aliased modules are also
    // emitted with the aliased extension, and resolutions to them are
    // rewritten to match, so `'.ts': '.js'` yields a `file:///foo.js`
    // dependency rather than `file:///foo.ts`.
  },
  resolve: resolve.default,
  visited: new Set()
}
```

`visited` is a `Set` of already visited module hrefs. If provided, modules whose href is already in the set are skipped and the set is updated in place as traversal proceeds. This allows a single set to be shared across several traversals so that a later traversal, such as one rooted at a dynamically imported module, does not revisit modules already seen by an earlier one.

Options supported by <https://github.com/holepunchto/bare-module-resolve> and <https://github.com/holepunchto/bare-addon-resolve> may also be specified.

#### `for (const dependency of dependencies)`

Synchronously iterate the module graph. Each yielded dependency has the following shape:

```js
dependency = {
  url: URL,
  source: 'string' | Buffer, // Source as returned by `readModule()`
  type: constants.SCRIPT, // The detected module type, or `0` if unknown
  imports: {
    // See https://github.com/holepunchto/bare-module#imports
  },
  lexer: {
    imports: [
      // See https://github.com/holepunchto/bare-module-lexer#api
    ],
    exports: [
      // See https://github.com/holepunchto/bare-module-lexer#api
    ]
  }
}
```

#### `for await (const dependency of dependencies)`

Asynchronously iterate the module graph. If `readModule` returns a promise or `listPrefix` returns a promise generator, these will be awaited. The same comments as `for (const dependency of dependencies)` apply.

#### `constants`

The module type constants used by the `type` field of each dependency and accepted as the `defaultType` option.

| Constant | Description        |
| :------- | :----------------- |
| `SCRIPT` | A CommonJS module. |
| `MODULE` | An ES module.      |
| `JSON`   | A JSON module.     |
| `BUNDLE` | A bundle module.   |
| `ADDON`  | A native addon.    |
| `BINARY` | A binary module.   |
| `TEXT`   | A text module.     |

### Resolution

Module and addon resolution is configurable by providing a resolver function. A resolver function is a generator function that yields values matching the shapes defined by <https://github.com/holepunchto/bare-module-resolve#algorithm>. Several resolvers are provided out of the box to support the most common use cases.

#### `resolve.module`

Convenience export from <https://github.com/holepunchto/bare-module-resolve>.

#### `resolve.addon`

Convenience export from <https://github.com/holepunchto/bare-addon-resolve>.

#### `resolve.default`

The default resolver, which simply forwards to <https://github.com/holepunchto/bare-module-resolve> and <https://github.com/holepunchto/bare-addon-resolve> with the literal options passed by the caller.

#### `resolve.bare`

The Bare resolver, which matches the options used by the Bare module system. The resolver accepts the following additional options:

```js
options = {
  host,
  hosts: [host]
}
```

For single target traversal it is sufficient to pass `host`. For multi target traversal pass a list of `hosts` identifiers instead.

#### `resolve.node`

The Node.js resolver, which matches the options used by the Node.js module system. The resolver accepts the following additional options:

```js
options = {
  host,
  hosts: [host]
}
```

For single target traversal it is sufficient to pass `host`. For multi target traversal pass a list of `hosts` identifiers instead.

### Algorithm

The following generator functions implement the traversal algorithm. The yielded values have the following shape:

**Source module**

A module to be read. The driver returns its source if it exists, otherwise `null`. When `artifact` is `true`, the module is an addon or asset whose contents are loaded lazily and referenced by path. A driver that only needs to locate such artifacts, such as a module loader, may return `null` without reading, having already established existence by probing; a driver that embeds their contents, such as a bundler, reads them as normal.

```js
next.value = {
  module: URL,
  artifact: boolean
}
```

**Probed module**

A module whose existence is to be tested without reading its full source, such as when locating an addon or asset. The driver returns `true` if it exists, `false` if it doesn't, or `undefined` if probing isn't supported, in which case existence is instead determined by reading the module.

```js
next.value = {
  probe: URL
}
```

**Resolved module**

A resolved, existing module whose URL is to be transformed. The driver returns the URL to use in its place, applying any post-resolution transform, such as canonicalizing symlinks with `realpath`, or the URL unchanged.

```js
next.value = {
  resolution: URL
}
```

**File prefix**

A prefix to be listed. The driver returns the URLs that have it as a prefix, of which there may be none.

```js
next.value = {
  prefix: URL
}
```

**Import set**

A set of independent imports to resolve. Each generator must be driven to completion before the parent generator is resumed, since the parent's resolved imports aren't complete until they are. The generators yield the same values as any other and may themselves yield dependency subgraphs to be traversed. A driver may drive them one at a time or, as their resolutions are independent, concurrently.

```js
next.value = {
  links: [Generator]
}
```

**Dependency subgraph**

A child subgraph to be traversed by driving its generator as the parent is driven. If `deferred` is `true`, it must be traversed only once all non-deferred subgraphs have been, ensuring, for example, that a module reached both as an import and as an asset is claimed by the import traversal first.

```js
next.value = {
  children: Generator,
  deferred: boolean
}
```

**Dependency node**

A fully resolved node of the module graph and the traversal's output. This is what the iterable forms yield to the caller.

```js
next.value = {
  dependency: {
    url: URL,
    source: 'string' | Buffer,
    type: constants.SCRIPT,
    imports: {
      // See https://github.com/holepunchto/bare-module#imports
    },
    lexer: {
      imports: [
        // See https://github.com/holepunchto/bare-module-lexer#api
      ],
      exports: [
        // See https://github.com/holepunchto/bare-module-lexer#api
      ]
    }
  }
}
```

To drive the generator functions, a recursive routine like the following can be used:

```js
const artifacts = { addons: [], assets: [] }
const visited = new Set()

const queue = [traverse.module(url, null, {}, artifacts, visited)]
const deferred = []

function drive(generator) {
  let next = generator.next()

  while (next.done !== true) {
    const value = next.value

    if (value.module) {
      // Read `value.module` if it exists, otherwise `null`. When
      // `value.artifact` is `true`, the module is an addon or asset that may be
      // left unread, returning `null`, unless its contents are needed
      let source

      next = generator.next(source)
    } else if (value.probe) {
      // Test whether `value.probe` exists, returning `true`, `false`, or
      // `undefined` if probing isn't supported
      let exists

      next = generator.next(exists)
    } else if (value.resolution) {
      // Transform `value.resolution`, e.g. canonicalize it with `realpath`, or
      // pass it through unchanged
      let resolution = value.resolution

      next = generator.next(resolution)
    } else if (value.prefix) {
      // List the modules that have `value.prefix` as a prefix
      let modules

      next = generator.next(modules)
    } else if (value.links) {
      // Drive each import to completion before resuming; their resolutions are
      // independent, so a concurrent driver may instead drive them in parallel
      for (const link of value.links) drive(link)

      next = generator.next()
    } else if (value.children) {
      // Defer the subgraph if requested, otherwise traverse it next
      if (value.deferred) deferred.push(value.children)
      else queue.push(value.children)

      next = generator.next()
    } else {
      const dependency = value.dependency

      next = generator.next()
    }
  }
}

while (queue.length > 0 || deferred.length > 0) {
  drive(queue.length > 0 ? queue.pop() : deferred.shift())
}
```

Options are the same as `traverse()` for all functions.

> [!WARNING]
> These functions are currently subject to change between minor releases. If using them directly, make sure to specify a tilde range (`~1.2.3`) when declaring the module dependency.

#### `const generator = traverse.module(url, source, attributes, artifacts, visited[, options])`

#### `const generator = traverse.package(url, source, artifacts, visited[, options])`

#### `const generator = traverse.preresolved(url, source, resolutions, artifacts, visited[, options])`

#### `const generator = traverse.imports(parentURL, source, imports, artifacts, lexer, visited[, options])`

#### `const generator = traverse.link(entry, specifier, condition, parentURL, imports, artifacts, visited[, options])`

#### `const generator = traverse.addons(parentURL, artifacts, visited[, options])`

#### `const generator = traverse.assets(patterns, parentURL, artifacts, visited[, options])`

## License

Apache-2.0
