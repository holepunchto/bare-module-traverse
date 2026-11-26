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

function* listPrefix(url, expand) {
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

async function* listPrefix(url, expand) {
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

`listPrefix` is called with the prefix and whether every URL with the prefix is needed or only whether one exists, as documented for `FilePrefix` in [`index.d.ts`](index.d.ts). To have the listed URLs used as they are, without passing them to `resolveModule`, return an array or other iterable with `resolved = true` set on it. If `listPrefix` isn't provided, `readModule` is called with the prefix instead, and the prefix itself is listed if it exists.

## API

See the [`bare-module-traverse` reference](https://docs.pears.com/reference/bare/modules/bare-module-traverse).

## Algorithm

The traversal algorithm is implemented by the generator functions documented in [`index.d.ts`](index.d.ts). Each yields values that ask the driver to read, probe, transform, or list modules, or that hand it subgraphs to traverse and dependencies of the module graph. The `Traversal` type documents what each value is and what the driver must pass back. To drive the generator functions, a recursive routine like the following can be used:

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
      // List the modules that have `value.prefix` as a prefix, stopping after
      // the first one if `value.expand` is `false`. Set `modules.resolved` to
      // `true` if the listed modules are already transformed
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
  drive(queue.length > 0 ? queue.shift() : deferred.shift())
}
```

## License

Apache-2.0
