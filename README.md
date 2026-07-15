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

<!-- bare-refgen:api start -->
## API

### Functions

#### `traverse`

```ts
traverse(entry: URL, readModule: (url: URL) => Buffer | string | null, listPrefix?: (url: URL) => Iterable<URL>, probeModule?: (url: URL) => boolean | undefined, resolveModule?: (url: URL) => URL): Iterable<Dependency>
```

[source](https://github.com/holepunchto/bare-module-traverse/blob/v2.4.2/index.d.ts#L42)

Traverse the module graph rooted at `entry`, which must be a WHATWG `URL` instance. `readModule` is called with a `URL` instance for every module to be read and must either return the module source, if it exists, or `null`. `listPrefix` is called with a `URL` instance of every prefix to be listed and must yield `URL` instances that have the specified `URL` as a prefix. If not provided, prefixes won't be traversed. If `readModule` returns a promise or `listPrefix` returns a promise generator, synchronous iteration is not supported.

**Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `entry` | `URL` | — | The WHATWG `URL` of the entry module to root the graph at. |
| `readModule` | `(url: URL) => Buffer \| string \| null` | — | Called with the `URL` of each module to read; returns its source as a `Buffer` or `string`, or `null` if it does not exist. Returning a promise disables synchronous iteration. |
| `listPrefix?` | `(url: URL) => Iterable<URL>` | — | Called with the `URL` of each prefix to list; must yield the `URL`s that have it as a prefix. If omitted, prefixes are not traversed. |
| `probeModule?` | `(url: URL) => boolean \| undefined` | — | Called with the `URL` of each module to probe for existence; returns a boolean, or `undefined` to fall back to `readModule`. |
| `resolveModule?` | `(url: URL) => URL` | — | Called with each resolution `URL` to transform; returns the `URL` to use in its place. Defaults to the identity function. |

**Returns** `Iterable<Dependency>` — An iterable of resolved `Dependency` records for the module graph; asynchronous when any callback returns a promise.

### Types

#### `TraverseOptions`

```ts
interface TraverseOptions extends ResolveOptions {
  defaultType?: number
  aliases?: Record<string, AliasableExtension>
  resolve?: (entry: Import, parentURL: URL, opts?: ResolveOptions) => Resolver
}
```

[source](https://github.com/holepunchto/bare-module-traverse/blob/v2.4.2/index.d.ts#L36)

#### `Artifacts`

```ts
interface Artifacts {
    addons: URL[] | Set<string>
    assets: URL[] | Set<string>
  }
```

[source](https://github.com/holepunchto/bare-module-traverse/blob/v2.4.2/index.d.ts#L91)

## `bare-module-traverse/resolve`

### Functions

#### `default(entry: Import, parentURL: URL, opts?: ResolveOptions): Resolver`

[source](https://github.com/holepunchto/bare-module-traverse/blob/v2.4.2/lib/resolve/default.d.ts#L4)

The default resolver, which simply forwards to <https://github.com/holepunchto/bare-module-resolve> and <https://github.com/holepunchto/bare-addon-resolve> with the literal options passed by the caller.

**Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `entry` | `Import` | — | The import to resolve, as produced by `bare-module-lexer`. |
| `parentURL` | `URL` | — | The WHATWG `URL` to resolve `entry` relative to. |
| `opts?` | `ResolveOptions` | — | Resolve options forwarded to the underlying resolution algorithm. |

**Returns** `Resolver` — A `Resolver` that yields the candidate resolutions for `entry`.

#### `bare(entry: Import, parentURL: URL, opts?: BareResolveOptions): Resolver`

[source](https://github.com/holepunchto/bare-module-traverse/blob/v2.4.2/lib/resolve/bare.d.ts#L10)

The Bare resolver, which matches the options used by the Bare module system.

**Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `entry` | `Import` | — | The import to resolve, as produced by `bare-module-lexer`. |
| `parentURL` | `URL` | — | The WHATWG `URL` to resolve `entry` relative to. |
| `opts?` | `BareResolveOptions` | — | Resolve options forwarded to the underlying resolution algorithm. |

**Returns** `Resolver` — A `Resolver` that yields the candidate resolutions for `entry`.

#### `node(entry: Import, parentURL: URL, opts?: NodeResolveOptions): Resolver`

[source](https://github.com/holepunchto/bare-module-traverse/blob/v2.4.2/lib/resolve/node.d.ts#L9)

The Node.js resolver, which matches the options used by the Node.js module system.

**Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `entry` | `Import` | — | The import to resolve, as produced by `bare-module-lexer`. |
| `parentURL` | `URL` | — | The WHATWG `URL` to resolve `entry` relative to. |
| `opts?` | `NodeResolveOptions` | — | Resolve options forwarded to the underlying resolution algorithm. |

**Returns** `Resolver` — A `Resolver` that yields the candidate resolutions for `entry`.

## `bare-module-traverse/resolve/default`

### Functions

#### `resolve(entry: Import, parentURL: URL, opts?: ResolveOptions): Resolver`

[source](https://github.com/holepunchto/bare-module-traverse/blob/v2.4.2/lib/resolve/default.d.ts#L4)

**Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `entry` | `Import` | — | The import to resolve, as produced by `bare-module-lexer`. |
| `parentURL` | `URL` | — | The WHATWG `URL` to resolve `entry` relative to. |
| `opts?` | `ResolveOptions` | — | Resolve options forwarded to the underlying resolution algorithm. |

**Returns** `Resolver` — A `Resolver` that yields the candidate resolutions for `entry`.

## `bare-module-traverse/resolve/bare`

### Functions

#### `resolve(entry: Import, parentURL: URL, opts?: BareResolveOptions): Resolver`

[source](https://github.com/holepunchto/bare-module-traverse/blob/v2.4.2/lib/resolve/bare.d.ts#L10)

**Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `entry` | `Import` | — | The import to resolve, as produced by `bare-module-lexer`. |
| `parentURL` | `URL` | — | The WHATWG `URL` to resolve `entry` relative to. |
| `opts?` | `BareResolveOptions` | — | Resolve options forwarded to the underlying resolution algorithm. |

**Returns** `Resolver` — A `Resolver` that yields the candidate resolutions for `entry`.

### Types

#### `BareResolveOptions`

```ts
interface BareResolveOptions extends ResolveOptions {
  linked?: boolean
  host?: string
  hosts?: string[]
}
```

[source](https://github.com/holepunchto/bare-module-traverse/blob/v2.4.2/lib/resolve/bare.d.ts#L4)

## `bare-module-traverse/resolve/node`

### Functions

#### `resolve(entry: Import, parentURL: URL, opts?: NodeResolveOptions): Resolver`

[source](https://github.com/holepunchto/bare-module-traverse/blob/v2.4.2/lib/resolve/node.d.ts#L9)

**Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `entry` | `Import` | — | The import to resolve, as produced by `bare-module-lexer`. |
| `parentURL` | `URL` | — | The WHATWG `URL` to resolve `entry` relative to. |
| `opts?` | `NodeResolveOptions` | — | Resolve options forwarded to the underlying resolution algorithm. |

**Returns** `Resolver` — A `Resolver` that yields the candidate resolutions for `entry`.

### Types

#### `NodeResolveOptions`

```ts
interface NodeResolveOptions extends ResolveOptions {
  host?: string
  hosts?: string[]
}
```

[source](https://github.com/holepunchto/bare-module-traverse/blob/v2.4.2/lib/resolve/node.d.ts#L4)
<!-- bare-refgen:api end -->

## License

Apache-2.0
