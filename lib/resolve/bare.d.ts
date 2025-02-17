import { type Import } from 'bare-module-lexer'
import { type ResolveOptions, type Resolver } from 'bare-addon-resolve'

interface BareResolveOptions extends ResolveOptions {
  platform?: string
  arch?: string
  simulator?: boolean
  target?: string[]
}

declare function resolve(
  entry: Import,
  parentURL: URL,
  opts?: BareResolveOptions
): Resolver

declare namespace resolve {
  export { type BareResolveOptions }
}

export = resolve
