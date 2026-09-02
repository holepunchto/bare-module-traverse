import { type Import } from 'bare-module-lexer'
import { type ResolveOptions, type Resolver } from 'bare-addon-resolve'

/**
 * @param entry - The import to resolve, as produced by `bare-module-lexer`.
 * @param parentURL - The WHATWG `URL` to resolve `entry` relative to.
 * @param opts - Resolve options forwarded to the underlying resolution algorithm.
 * @returns A `Resolver` that yields the candidate resolutions for `entry`.
 */
declare function resolve(entry: Import, parentURL: URL, opts?: ResolveOptions): Resolver

export = resolve
