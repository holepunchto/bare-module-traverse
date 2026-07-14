module.exports = class ModuleTraverseError extends Error {
  constructor(msg, fn = ModuleTraverseError, code = fn.name) {
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
    const err = new ModuleTraverseError(msg, ModuleTraverseError.MODULE_NOT_FOUND)

    err.specifier = specifier
    err.referrer = referrer
    err.candidates = candidates

    return err
  }

  static ADDON_NOT_FOUND(msg, specifier, referrer = null, candidates = []) {
    const err = new ModuleTraverseError(msg, ModuleTraverseError.ADDON_NOT_FOUND)

    err.specifier = specifier
    err.referrer = referrer
    err.candidates = candidates

    return err
  }

  static ASSET_NOT_FOUND(msg, specifier, referrer = null, candidates = []) {
    const err = new ModuleTraverseError(msg, ModuleTraverseError.ASSET_NOT_FOUND)

    err.specifier = specifier
    err.referrer = referrer
    err.candidates = candidates

    return err
  }

  static INVALID_IMPORTS_MAP(msg) {
    return new ModuleTraverseError(msg, ModuleTraverseError.INVALID_IMPORTS_MAP)
  }

  static UNSUPPORTED_DATA_URL_CHARSET(msg, charset) {
    const err = new ModuleTraverseError(msg, ModuleTraverseError.UNSUPPORTED_DATA_URL_CHARSET)

    err.charset = charset

    return err
  }
}
