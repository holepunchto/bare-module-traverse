module.exports = class ModuleTraverseError extends Error {
  constructor(msg, code, fn = ModuleTraverseError) {
    super(`${code}: ${msg}`)
    this.code = code

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, fn)
    }
  }

  get name() {
    return 'ModuleTraverseError'
  }

  static MODULE_NOT_FOUND(msg, specifier, referrer = null, candidates = []) {
    const err = new ModuleTraverseError(
      msg,
      'MODULE_NOT_FOUND',
      ModuleTraverseError.MODULE_NOT_FOUND
    )

    err.specifier = specifier
    err.referrer = referrer
    err.candidates = candidates

    return err
  }

  static ADDON_NOT_FOUND(msg, specifier, referrer = null, candidates = []) {
    const err = new ModuleTraverseError(
      msg,
      'ADDON_NOT_FOUND',
      ModuleTraverseError.ADDON_NOT_FOUND
    )

    err.specifier = specifier
    err.referrer = referrer
    err.candidates = candidates

    return err
  }

  static ASSET_NOT_FOUND(msg, specifier, referrer = null, candidates = []) {
    const err = new ModuleTraverseError(
      msg,
      'ASSET_NOT_FOUND',
      ModuleTraverseError.ASSET_NOT_FOUND
    )

    err.specifier = specifier
    err.referrer = referrer
    err.candidates = candidates

    return err
  }

  static INVALID_IMPORTS_MAP(msg) {
    return new ModuleTraverseError(
      msg,
      'INVALID_IMPORTS_MAP',
      ModuleTraverseError.INVALID_IMPORTS_MAP
    )
  }
}
