import URL from 'bare-url'
import Buffer from 'bare-buffer'
import {
  type ConditionalSpecifier,
  type ImportsMap,
  type ResolutionsMap
} from 'bare-module-resolve'
import { type ResolveOptions, type Resolver } from 'bare-addon-resolve'
import { type Import, type Export } from 'bare-module-lexer'

interface Dependency {
  url: URL
  source: string | Buffer
  type: number
  imports: ImportsMap
  lexer: {
    imports: Import[]
    exports: Export[]
  }
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

interface TraverseOptions extends ResolveOptions {
  defaultType?: number
  aliases?: Record<string, AliasableExtension>
  /**
   * @param entry - The import to resolve, as produced by `bare-module-lexer`.
   * @param parentURL - The WHATWG `URL` to resolve `entry` relative to.
   * @param opts - Resolve options forwarded to the underlying resolution algorithm.
   * @returns A `Resolver` that yields the candidate resolutions for `entry`.
   */
  resolve?: (entry: Import, parentURL: URL, opts?: ResolveOptions) => Resolver
}

/**
 * Traverse the module graph rooted at `entry`, which must be a WHATWG `URL` instance. `readModule` is called with a `URL` instance for every module to be read and must either return the module source, if it exists, or `null`. `listPrefix` is called with a `URL` instance of every prefix to be listed and must yield `URL` instances that have the specified `URL` as a prefix. If not provided, prefixes won't be traversed. If `readModule` returns a promise or `listPrefix` returns a promise generator, synchronous iteration is not supported.
 * @param entry - The WHATWG `URL` of the entry module to root the graph at.
 * @param readModule - Called with the `URL` of each module to read; returns its source as a `Buffer` or `string`, or `null` if it does not exist. Returning a promise disables synchronous iteration.
 * @param listPrefix - Called with the `URL` of each prefix to list; must yield the `URL`s that have it as a prefix. If omitted, prefixes are not traversed.
 * @param probeModule - Called with the `URL` of each module to probe for existence; returns a boolean, or `undefined` to fall back to `readModule`.
 * @param resolveModule - Called with each resolution `URL` to transform; returns the `URL` to use in its place. Defaults to the identity function.
 * @returns An iterable of resolved `Dependency` records for the module graph; asynchronous when any callback returns a promise.
 */
declare function traverse(
  entry: URL,
  readModule: (url: URL) => Buffer | string | null,
  listPrefix?: (url: URL) => Iterable<URL>,
  probeModule?: (url: URL) => boolean | undefined,
  resolveModule?: (url: URL) => URL
): Iterable<Dependency>

declare function traverse(
  entry: URL,
  readModule: (url: URL) => Promise<Buffer | string | null>,
  listPrefix?: (url: URL) => AsyncIterable<URL>,
  probeModule?: (url: URL) => Promise<boolean | undefined>,
  resolveModule?: (url: URL) => Promise<URL>
): AsyncIterable<Dependency>

declare function traverse(
  entry: URL,
  opts: TraverseOptions,
  readModule: (url: URL) => Buffer | string | null,
  listPrefix?: (url: URL) => Iterable<URL>,
  probeModule?: (url: URL) => boolean | undefined,
  resolveModule?: (url: URL) => URL
): Iterable<Dependency>

declare function traverse(
  entry: URL,
  opts: TraverseOptions,
  readModule: (url: URL) => Promise<Buffer | string | null>,
  listPrefix?: (url: URL) => AsyncIterable<URL>,
  probeModule?: (url: URL) => Promise<boolean | undefined>,
  resolveModule?: (url: URL) => Promise<URL>
): AsyncIterable<Dependency>

declare namespace traverse {
  export { type TraverseOptions }

  export type Traversal = Generator<
    | { module: URL }
    | { probe: URL }
    | { resolution: URL }
    | { prefix: URL }
    | { links: Traversal[] }
    | { children: Traversal; deferred: boolean }
    | { dependency: Dependency },
    boolean,
    void | URL | URL[] | Buffer | string | boolean | null
  >

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

  export function module(
    url: URL,
    source: string | Buffer,
    attributes: Record<string, string> | null,
    artifacts: Artifacts,
    visited: Set<string>,
    opts?: TraverseOptions
  ): Traversal

  export function package(
    url: URL,
    source: string | Buffer,
    artifacts: Artifacts,
    visited: Set<string>,
    opts?: TraverseOptions
  ): Traversal

  export function preresolved(
    url: URL,
    source: string | Buffer,
    resolution: ResolutionsMap,
    artifacts: Artifacts,
    visited: Set<string>,
    opts?: TraverseOptions
  ): Traversal

  export function imports(
    parentURL: URL,
    source: string | Buffer,
    imports: ImportsMap,
    artifacts: Artifacts,
    visited: Set<string>,
    opts?: TraverseOptions
  ): Traversal

  export function link(
    entry: Import,
    specifier: string,
    condition: string,
    parentURL: URL,
    imports: ImportsMap,
    artifacts: Artifacts,
    visited: Set<string>,
    opts?: TraverseOptions
  ): Traversal

  export function prebuilds(
    packageURL: URL,
    artifacts: Artifacts,
    visited: Set<string>,
    opts?: TraverseOptions
  ): Traversal

  export function assets(
    patterns: ConditionalSpecifier,
    packageURL: URL,
    artifacts: Artifacts,
    visited: Set<string>,
    opts?: TraverseOptions
  ): Traversal
}

export = traverse
