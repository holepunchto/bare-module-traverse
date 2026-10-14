import URL from 'bare-url'
import { type Import } from 'bare-module-lexer'
import { type ResolveOptions as ModuleResolveOptions } from 'bare-module-resolve'
import { type ResolveOptions as AddonResolveOptions, type Resolver } from 'bare-addon-resolve'

interface ResolveOptions extends ModuleResolveOptions, AddonResolveOptions {}

/**
 * @param entry - The import to resolve, as produced by `bare-module-lexer`.
 * @param parentURL - The WHATWG `URL` to resolve `entry` relative to.
 * @param opts - Resolve options forwarded to the underlying resolution algorithm.
 * @returns A `Resolver` that yields the candidate resolutions for `entry`.
 */
declare function resolve(entry: Import, parentURL: URL, opts?: ResolveOptions): Resolver

export = resolve
