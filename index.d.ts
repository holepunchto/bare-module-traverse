import URL from 'bare-url'
import Buffer from 'bare-buffer'
import {
  type ConditionalSpecifier,
  type ImportsMap,
  type ResolutionsMap,
  type ResolveOptions as ModuleResolveOptions
} from 'bare-module-resolve'
import { type ResolveOptions as AddonResolveOptions, type Resolver } from 'bare-addon-resolve'
import { type Import, type Export } from 'bare-module-lexer'

interface Dependency {
  url: URL
  source: string | Buffer
  /** The type the module is loaded as. See `constants` for possible values. */
  type: number
  /**
   * The type the module has on its own, ignoring import attributes, or `0` if
   * it has no type of its own. This differs from `type` only when an import
   * attribute asked for a different type, so a loader can use it to tell
   * whether an attribute changed the type.
   */
  naturalType: number
  imports: ImportsMap
  lexer: {
    imports: Import[]
    exports: Export[]
  }
  /**
   * The URL of the WASI provider of a WebAssembly addon, if its importer named
   * one with the `wasi` attribute.
   */
  wasi?: string
}

type AliasableExtension =
  | '.js'
  | '.cjs'
  | '.mjs'
  | '.ts'
  | '.cts'
  | '.mts'
  | '.json'
  | '.bundle'
  | '.bare'
  | '.node'
  | '.bin'
  | '.txt'

interface ResolveOptions extends ModuleResolveOptions, AddonResolveOptions {}

interface TraverseOptions extends ResolveOptions {
  /**
   * The type to assume for a module that has no type of its own, such as one
   * with an ambiguous extension or a `data:` URL that no import reaches. See
   * `constants` for possible values.
   */
  defaultType?: number
  /**
   * The type of the import that led to the entry. A JavaScript `data:` URL
   * takes its type from this: `REQUIRE` means a script and `IMPORT` a module,
   * while `IMPORT | DYNAMIC` could mean either and so needs a `type`
   * attribute.
   */
  importType?: number
  /**
   * The type recorded for a module, such as by the bundle that contains it,
   * or `undefined` or `0` if none is recorded. A recorded type takes
   * precedence over the type implied by the extension of the module, but not
   * over a `type` import attribute. See `constants` for possible values.
   */
  typeFor?: (url: URL) => number | undefined
  artifacts?: boolean
  aliases?: Record<string, AliasableExtension>
  /**
   * @param entry - The import to resolve, as produced by `bare-module-lexer`.
   * @param parentURL - The WHATWG `URL` to resolve `entry` relative to.
   * @param opts - Resolve options forwarded to the underlying resolution algorithm.
   * @returns A `Resolver` that yields the candidate resolutions for `entry`.
   */
  resolve?: (entry: Import, parentURL: URL, opts?: ResolveOptions) => Resolver
  /**
   * Record a specifier that resolves nowhere under `deferredProtocol` rather
   * than throwing, leaving it for whoever names it to resolve when they get
   * there. Only for callers that reach a resolver again, such as a module
   * system; a tool that only links wants the error.
   *
   * An addon resolved for several `hosts` must resolve for each of the native
   * ones, as WebAssembly hosts are only a fallback. A host that it resolves
   * nothing for is unresolved, and is deferred under its own conditions or
   * else fails with `ADDON_NOT_FOUND`.
   */
  deferUnresolved?: boolean
  /**
   * The URL the entry is mounted at when it is a bundle, for consumers that
   * load it with an explicit mount. The addons and assets it declares resolve
   * relative to this. Defaults to the URL of the entry itself.
   */
  mount?: URL | string
}

type ReadModule = (url: URL) => Buffer | string | null
type ListPrefix = (url: URL, expand: boolean) => Iterable<URL> & { resolved?: boolean }
type ProbeModule = (url: URL) => boolean | undefined
type ResolveModule = (url: URL) => URL

type AsyncReadModule = (url: URL) => Promise<Buffer | string | null>
type AsyncListPrefix = (
  url: URL,
  expand: boolean
) => (Iterable<URL> | AsyncIterable<URL>) & { resolved?: boolean }
type AsyncProbeModule = (url: URL) => Promise<boolean | undefined>
type AsyncResolveModule = (url: URL) => Promise<URL>

/**
 * Traverse the module graph rooted at `entry`, which must be a WHATWG `URL` instance. `readModule`
 * is called with a `URL` instance for every module to be read and must either return the module
 * source, if it exists, or `null`. `listPrefix` is called with a `URL` instance of every prefix to
 * be listed and must yield `URL` instances that have the specified `URL` as a prefix. If not
 * provided, `readModule` is called with the prefix instead and the prefix itself is listed if it
 * exists. If `readModule` returns a promise or `listPrefix` returns a promise generator,
 * synchronous iteration is not supported.
 * @param entry - The WHATWG `URL` of the entry module to root the graph at.
 * @param readModule - Called with the `URL` of each module to read; returns its source as a
 * `Buffer` or `string`, or `null` if it does not exist. Returning a promise disables synchronous
 * iteration.
 * @param listPrefix - Called with the `URL` of each prefix to list and whether every match is
 * needed or only whether one exists; must yield the `URL`s that have it as a prefix. Set
 * `resolved = true` on the returned iterable to use the `URL`s as they are, without passing them
 * to `resolveModule`. If omitted, `readModule` is used to test whether the prefix itself exists.
 * @param probeModule - Called with the `URL` of each module to probe for existence; returns a
 * boolean, or `undefined` to fall back to `readModule`.
 * @param resolveModule - Called with each resolution `URL` to transform; returns the `URL` to use
 * in its place. Defaults to the identity function.
 * @returns An iterable of resolved `Dependency` records for the module graph; asynchronous when any
 * callback returns a promise.
 */
declare function traverse(
  entry: URL,
  readModule: ReadModule,
  listPrefix?: ListPrefix,
  probeModule?: ProbeModule,
  resolveModule?: ResolveModule
): Iterable<Dependency>

declare function traverse(
  entry: URL,
  readModule: AsyncReadModule,
  listPrefix?: AsyncListPrefix,
  probeModule?: AsyncProbeModule,
  resolveModule?: AsyncResolveModule
): AsyncIterable<Dependency>

declare function traverse(
  entry: URL,
  opts: TraverseOptions,
  readModule: ReadModule,
  listPrefix?: ListPrefix,
  probeModule?: ProbeModule,
  resolveModule?: ResolveModule
): Iterable<Dependency>

declare function traverse(
  entry: URL,
  opts: TraverseOptions,
  readModule: AsyncReadModule,
  listPrefix?: AsyncListPrefix,
  probeModule?: AsyncProbeModule,
  resolveModule?: AsyncResolveModule
): AsyncIterable<Dependency>

declare namespace traverse {
  export { type TraverseOptions }

  export type Traversal = Generator<
    | { module: URL; artifact: boolean }
    | { probe: URL }
    | { resolution: URL }
    | { prefix: URL; expand: boolean }
    | { links: Traversal[] }
    | { children: Traversal; deferred: boolean }
    | { dependency: Dependency },
    boolean,
    void | URL | (URL[] & { resolved?: boolean }) | Buffer | string | boolean | null
  >

  /**
   * The addons and assets that a traversal reaches, either as sorted arrays of
   * `URL`s or as sets of URL strings. The generator functions take `null` in
   * its place to skip collecting them, except where noted.
   */
  export interface Artifacts {
    addons: URL[] | Set<string>
    assets: URL[] | Set<string>
  }

  export const constants: {
    SCRIPT: number
    MODULE: number
    JSON: number
    BUNDLE: number
    ADDON: number
    BINARY: number
    TEXT: number
  }

  /**
   * Traverse the module at `url`.
   * @param url - The `URL` of the module.
   * @param source - The source of the module, or `null` to read it by yielding it.
   * @param attributes - The import attributes the module was imported with, such as `type`,
   * `host`, `wasi`, and `imports`, or `null` for none.
   * @param artifacts - The addons and assets reached so far, or `null` to skip collecting them.
   * @param visited - The URL strings of the modules already traversed, shared between all the
   * generators of a traversal.
   * @returns A generator that returns `false` if the module was already visited and `true`
   * otherwise.
   */
  export function module(
    url: URL,
    source: string | Buffer | null,
    attributes: Record<string, string> | null,
    artifacts: Artifacts | null,
    visited: Set<string>,
    opts?: TraverseOptions
  ): Traversal

  /**
   * Traverse the package manifest at `url`, including the assets it declares.
   * @param url - The `URL` of the package manifest.
   * @param source - The source of the manifest, or `null` to read it by yielding it.
   * @param artifacts - The addons and assets reached so far, or `null` to skip collecting them.
   * @param visited - The URL strings of the modules already traversed.
   * @returns A generator that returns `false` if the manifest was already visited or doesn't
   * exist and `true` otherwise.
   */
  export function package(
    url: URL,
    source: string | Buffer | null,
    artifacts: Artifacts | null,
    visited: Set<string>,
    opts?: TraverseOptions
  ): Traversal

  interface AddonContext {
    host: string | null
    wasi: string | null
  }

  /**
   * Record in `addonContexts` that the package at `scope` loads its addons in `context`.
   * @param url - The `URL` of the addon being loaded.
   * @param scope - The URL string of the package that loads the addon.
   * @param context - The `host` and the URL of the `wasi` provider, either `null` for the
   * defaults.
   * @param addonContexts - The contexts recorded so far, keyed by package.
   * @throws If a different context was recorded for `scope`, or if `url` doesn't load on
   * `context.host`.
   */
  export function assertAddonContext(
    url: URL,
    scope: string,
    context: Partial<AddonContext>,
    addonContexts: Map<string, AddonContext>
  ): void

  /**
   * Traverse the module at `url` using the imports already resolved for it.
   * @param url - The `URL` of the module.
   * @param source - The source of the module.
   * @param attributes - The import attributes the module was imported with, or `null` for none.
   * @param resolutions - Maps module URL strings to imports maps of the same shape as
   * `Dependency.imports`.
   * @param artifacts - The addons and assets reached so far, or `null` to skip collecting them.
   * @param visited - The URL strings of the modules already traversed.
   * @returns A generator that returns `false`, without yielding anything, if `resolutions` has no
   * entry for `url` and `true` otherwise.
   */
  export function preresolved(
    url: URL,
    source: string | Buffer,
    attributes: Record<string, string> | null,
    resolutions: ResolutionsMap,
    artifacts: Artifacts | null,
    visited: Set<string>,
    opts?: TraverseOptions
  ): Traversal

  /**
   * Lex `source` and yield an import set with a `link()` generator for each of its imports.
   * @param parentURL - The `URL` of the module that `source` belongs to.
   * @param source - The source of the module.
   * @param imports - The imports map that the resolutions are added to once the import set has
   * been driven.
   * @param artifacts - The addons and assets reached so far, or `null` to skip collecting them.
   * @param lexer - The object that the lexed imports and exports are added to.
   * @param visited - The URL strings of the modules already traversed.
   */
  export function imports(
    parentURL: URL,
    source: string | Buffer,
    imports: ImportsMap,
    artifacts: Artifacts | null,
    lexer: {
      imports: Import[]
      exports: Export[]
    },
    visited: Set<string>,
    opts?: TraverseOptions
  ): Traversal

  /**
   * Resolve a single import, add the resolution to `imports`, and yield the resolved module as a
   * dependency subgraph.
   * @param entry - The import, as produced by `bare-module-lexer`.
   * @param specifier - The specifier to resolve.
   * @param condition - One of `'default'`, `'import'`, `'require'`, `'addon'`, or `'asset'`.
   * @param parentURL - The `URL` of the importing module.
   * @param imports - The imports map that the resolution is added to.
   * @param artifacts - The addons and assets reached so far, or `null` to skip collecting them.
   * @param visited - The URL strings of the modules already traversed.
   * @throws If the import can't be resolved.
   */
  export function link(
    entry: Import,
    specifier: string,
    condition: string,
    parentURL: URL,
    imports: ImportsMap,
    artifacts: Artifacts | null,
    visited: Set<string>,
    opts?: TraverseOptions
  ): Traversal

  /**
   * Traverse the addons that ship alongside the addon at `parentURL`, which are the modules in the
   * directory of the same name without the `.bare`, `.node`, or `.wasm` extension. Each is added
   * to `artifacts.addons`.
   * @param parentURL - The `URL` of the addon.
   * @param artifacts - The addons and assets reached so far.
   * @param visited - The URL strings of the modules already traversed.
   * @returns A generator that returns `true` if any addons were found and `false` otherwise.
   */
  export function addons(
    parentURL: URL,
    artifacts: Artifacts,
    visited: Set<string>,
    opts?: TraverseOptions
  ): Traversal

  /**
   * Traverse the assets that match `patterns`. Each is added to `artifacts.assets` and yielded as
   * a deferred dependency subgraph.
   * @param patterns - The patterns to match, as accepted by `patternMatches()`.
   * @param parentURL - The `URL` that the patterns are relative to.
   * @param artifacts - The addons and assets reached so far.
   * @param visited - The URL strings of the modules already traversed.
   * @returns A generator that returns `true` if any assets matched and `false` otherwise.
   */
  export function assets(
    patterns: ConditionalSpecifier,
    parentURL: URL,
    artifacts: Artifacts,
    visited: Set<string>,
    opts?: TraverseOptions
  ): Traversal

  /**
   * Find the URLs that match `pattern`, given in the same form as the `assets` field of a package
   * manifest.
   *
   * A pattern is a path that may contain a single `*` wildcard, and a leading `!` removes its
   * matches instead of adding them. An array of patterns is applied in order. An object of
   * conditions applies the pattern of the first condition that is either `default` or in
   * `opts.conditions`. If that pattern is itself an object of conditions and none of them apply,
   * the next condition is tried instead. If `opts.conditions` is an array of condition sets, the
   * patterns picked for each set are applied.
   * @param pattern - The pattern to match.
   * @param parentURL - The `URL` that the pattern is relative to.
   * @param matches - The sorted array of `URL`s that the matches are added to.
   * @returns A generator that yields the prefixes to list and returns `matches`. The matches are
   * returned as listed, even if the driver set `resolved = true` on the list.
   */
  export function patternMatches(
    pattern: ConditionalSpecifier,
    parentURL: URL,
    matches: URL[],
    opts?: TraverseOptions
  ): Generator<{ prefix: URL; expand: boolean }, URL[], URL[]>
}

export = traverse
