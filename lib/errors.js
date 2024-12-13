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

  static MODULE_NOT_FOUND(msg) {
    return new ModuleTraverseError(
      msg,
      'MODULE_NOT_FOUND',
      ModuleTraverseError.MODULE_NOT_FOUND
    )
  }

  static ADDON_NOT_FOUND(msg) {
    return new ModuleTraverseError(
      msg,
      'ADDON_NOT_FOUND',
      ModuleTraverseError.ADDON_NOT_FOUND
    )
  }

  static ASSET_NOT_FOUND(msg) {
    return new ModuleTraverseError(
      msg,
      'ASSET_NOT_FOUND',
      ModuleTraverseError.ASSET_NOT_FOUND
    )
  }
}
