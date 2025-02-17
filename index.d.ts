import URL from 'bare-url'
import Buffer from 'bare-buffer'
import {
  type ConditionalSpecifier,
  type ImportsMap,
  type ResolutionsMap
} from 'bare-module-resolve'
import { type ResolveOptions, type Resolver } from 'bare-addon-resolve'
import { type Import } from 'bare-module-lexer'

type Dependency = { url: URL; source: string | Buffer; imports: ImportsMap }

interface TraverseOptions extends ResolveOptions {
  resolve?: (entry: Import, parentURL: URL, opts?: ResolveOptions) => Resolver
}

declare function traverse(
  entry: URL,
  readModule: (url: URL) => string | null,
  listPrefix?: (url: URL) => Generator<URL> | URL[]
): Iterable<Dependency>

declare function traverse(
  entry: URL,
  readModule: (url: URL) => Promise<string | null>,
  listPrefix?: (url: URL) => AsyncGenerator<URL>
): AsyncIterable<Dependency>

declare function traverse(
  entry: URL,
  opts: TraverseOptions,
  readModule: (url: URL) => string | null,
  listPrefix?: (url: URL) => Generator<URL> | URL[]
): Iterable<Dependency>

declare function traverse(
  entry: URL,
  opts: TraverseOptions,
  readModule: (url: URL) => Promise<string | null>,
  listPrefix?: (url: URL) => AsyncGenerator<URL>
): AsyncIterable<Dependency>

declare namespace traverse {
  export { type TraverseOptions }

  export type Traversal = Generator<
    { module: URL } | { prefix: URL } | { children: URL } | { dependency: URL }
  >

  export function module(
    url: URL,
    source: string | Buffer,
    artifacts: { addons: URL[]; assets: URL[] },
    visited: Set<string>,
    opts?: TraverseOptions
  ): Traversal

  export function package(
    url: URL,
    source: string | Buffer,
    artifacts: { addons: URL[]; assets: URL[] },
    visited: Set<string>,
    opts?: TraverseOptions
  ): Traversal

  export function preresolved(
    url: URL,
    source: string | Buffer,
    resolution: ResolutionsMap,
    artifacts: { addons: URL[]; assets: URL[] },
    visited: Set<string>,
    opts?: TraverseOptions
  ): Traversal

  export function imports(
    parentURL: URL,
    source: string | Buffer,
    imports: ImportsMap,
    artifacts: { addons: URL[]; assets: URL[] },
    visited: Set<string>,
    opts?: TraverseOptions
  ): Traversal

  export function prebuilds(
    packageURL: URL,
    artifacts: { addons: URL[]; assets: URL[] },
    visited: Set<string>,
    opts?: TraverseOptions
  ): Traversal

  export function assets(
    patterns: ConditionalSpecifier,
    packageURL: URL,
    artifacts: { addons: URL[]; assets: URL[] },
    visited: Set<string>,
    opts?: TraverseOptions
  ): Traversal
}

export = traverse
