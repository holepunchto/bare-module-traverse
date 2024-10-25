module.exports = class ModuleTraverseError extends Error {
  constructor (msg, code, fn = ModuleTraverseError) {
    super(`${code}: ${msg}`)
    this.code = code

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, fn)
    }
  }

  get name () {
    return 'ModuleTraverseError'
  }

  static MODULE_NOT_FOUND (msg) {
    return new ModuleTraverseError(msg, 'MODULE_NOT_FOUND', ModuleTraverseError.MODULE_NOT_FOUND)
  }
}
