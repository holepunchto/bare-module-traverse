# bare-module-traverse

Low-level module graph traversal for Bare. The algorithm is implemented as a generator function that yields either modules to be read, prefixes to be listed, child dependencies to be traversed, or resolved dependencies of the module graph. As a convenience, the main export is a synchronous and asynchronous iterable that relies on modules being read and prefixes being listed by callbacks. For asynchronous iteration, the callbacks may return promises which will be awaited before being passed to the generator.

```
npm i bare-module-traverse
```

## Usage

For synchronous traversal:

``` js
const traverse = require('bare-module-traverse')

function readModule (url) {
  // Read `url` if it exists, otherwise `null`
}

function listPrefix (url) {
  // Return a list of URLs that have `url` as a prefix. The list may be empty.
}

for (const dependency of traverse(new URL('file:///directory/file.js'), readModule, listPrefix)) {
  console.log(dependency)
}
```

For asynchronous traversal:

``` js
const traverse = require('bare-module-traverse')

async function readModule (url) {
  // Read `url` if it exists, otherwise `null`
}

async function listPrefix (url) {
  // Return a list of URLs that have `url` as a prefix. The list may be empty.
}

for await (const dependency of traverse(new URL('file:///directory/file.js'), readModule, listPrefix)) {
  console.log(dependency)
}
```

## API

#### `const dependencies = traverse(url[, options], readModule[, listPrefix])`

Traverse the module graph rooted at `url`, which must be a WHATWG `URL` instance. `readModule` is called with a `URL` instance for every module to be read and must either return the module source, if it exists, or `null`. `listPrefix` is called with a `URL` instance of every prefix to be listed and must return a list of `URL` instances that have the specified `URL` as a prefix. If not provided, prefixes won't be traversed. If one or both of `readModule` or `listPrefix` returns a promise, synchronous iteration is not supported.

#### `for (const dependency of dependencies)`

Synchronously iterate the module graph. Each yielded dependency has the following shape:

```js
{
  url: URL,
  source: 'string' | Buffer, // Source as returned by `readModule()`
  imports: {
    // See https://github.com/holepunchto/bare-module#imports
  }
}
```

#### `for await (const dependency of dependencies)`

Asynchronously iterate the module graph. If one or both of `readModule` or `listPrefix` returns promises, these will be awaited. The same comments as `for (const dependency of dependencies)` apply.

### Algorithm

The following generator functions implement the traversal algorithm. To drive the generator functions, a loop like the following can be used:

```js
const generator = traverse.module(url, source, artifacts, visited)

let next = generator.next()

while (next.done !== true) {
  const value = next.value

  if (value.module) {
    const source = /* Read `value.module` if it exists, otherwise `null` */;

    next = generator.next(source)
  } else if (value.prefix) {
    const modules = /* List the modules that have `value.prefix` as a prefix */;

    next = generator.next(modules)
  } else if (value.children) {
    next = generator.next(value.children)
  } else {
    const dependency = value.dependency

    next = generator.next()
  }
}
```

Options are the same as `traverse()` for all functions.

#### `const generator = traverse.module(url, source, artifacts, visited[, options])`

#### `const generator = traverse.package(url, source, artifacts, visited[, options])`

#### `const generator = traverse.assets(patterns, parentURL, artifacts, visited[, options])`

## License

Apache-2.0
