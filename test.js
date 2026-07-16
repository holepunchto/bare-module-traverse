const test = require('brittle')
const lex = require('bare-module-lexer')
const traverse = require('.')
const constants = traverse.constants

const { REQUIRE, IMPORT, ADDON, ASSET, REEXPORT } = lex.constants

const host = 'host'

test('require', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "const bar = require('./bar.js')"
    }

    if (url.href === 'file:///bar.js') {
      return "const baz = require('./baz.js')"
    }

    if (url.href === 'file:///baz.js') {
      return 'module.exports = 42'
    }

    return null
  }

  const result = expand(traverse(new URL('file:///foo.js'), readModule))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require('./bar.js')",
      type: constants.SCRIPT,
      imports: {
        './bar.js': 'file:///bar.js'
      },
      lexer: {
        imports: [
          {
            specifier: './bar.js',
            type: REQUIRE,
            names: [],
            attributes: {},
            position: [12, 21, 29]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: "const baz = require('./baz.js')",
      type: constants.SCRIPT,
      imports: {
        './baz.js': 'file:///baz.js'
      },
      lexer: {
        imports: [
          {
            specifier: './baz.js',
            type: REQUIRE,
            names: [],
            attributes: {},
            position: [12, 21, 29]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///baz.js'),
      source: 'module.exports = 42',
      type: constants.SCRIPT,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])
})

test('import', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "import './bar.js'"
    }

    if (url.href === 'file:///bar.js') {
      return "import './baz.js'"
    }

    if (url.href === 'file:///baz.js') {
      return 'export default 42'
    }

    return null
  }

  const result = expand(traverse(new URL('file:///foo.js'), readModule))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "import './bar.js'",
      type: constants.SCRIPT,
      imports: {
        './bar.js': 'file:///bar.js'
      },
      lexer: {
        imports: [
          {
            specifier: './bar.js',
            type: IMPORT,
            names: [],
            attributes: {},
            position: [0, 8, 16]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: "import './baz.js'",
      type: constants.SCRIPT,
      imports: {
        './baz.js': 'file:///baz.js'
      },
      lexer: {
        imports: [
          {
            specifier: './baz.js',
            type: IMPORT,
            names: [],
            attributes: {},
            position: [0, 8, 16]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///baz.js'),
      source: 'export default 42',
      type: constants.SCRIPT,
      imports: {},
      lexer: {
        imports: [],
        exports: [{ name: 'default', position: [0, 7, 14] }]
      }
    }
  ])
})

test('cyclic require', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "require('./bar.js')"
    }

    if (url.href === 'file:///bar.js') {
      return "require('./foo.js')"
    }

    return null
  }

  const result = expand(traverse(new URL('file:///foo.js'), readModule))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "require('./bar.js')",
      type: constants.SCRIPT,
      imports: {
        './bar.js': 'file:///bar.js'
      },
      lexer: {
        imports: [
          {
            specifier: './bar.js',
            type: REQUIRE,
            names: [],
            attributes: {},
            position: [0, 9, 17]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: "require('./foo.js')",
      type: constants.SCRIPT,
      imports: {
        './foo.js': 'file:///foo.js'
      },
      lexer: {
        imports: [
          {
            specifier: './foo.js',
            type: REQUIRE,
            names: [],
            attributes: {},
            position: [0, 9, 17]
          }
        ],
        exports: []
      }
    }
  ])
})

test('cyclic import', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "import './bar.js'"
    }

    if (url.href === 'file:///bar.js') {
      return "import './foo.js'"
    }

    return null
  }

  const result = expand(traverse(new URL('file:///foo.js'), readModule))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "import './bar.js'",
      type: constants.SCRIPT,
      imports: {
        './bar.js': 'file:///bar.js'
      },
      lexer: {
        imports: [
          {
            specifier: './bar.js',
            type: IMPORT,
            names: [],
            attributes: {},
            position: [0, 8, 16]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: "import './foo.js'",
      type: constants.SCRIPT,
      imports: {
        './foo.js': 'file:///foo.js'
      },
      lexer: {
        imports: [
          {
            specifier: './foo.js',
            type: IMPORT,
            names: [],
            attributes: {},
            position: [0, 8, 16]
          }
        ],
        exports: []
      }
    }
  ])
})

test('require, module missing', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "const bar = require('./bar.js')"
    }

    return null
  }

  try {
    expand(traverse(new URL('file:///foo.js'), readModule))
    t.fail()
  } catch (err) {
    t.comment(err.message)
  }
})

test('require, same module twice', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "require('./bar.js'), require('./bar.js')"
    }

    if (url.href === 'file:///bar.js') {
      return 'module.exports = 42'
    }

    return null
  }

  const result = expand(traverse(new URL('file:///foo.js'), readModule))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "require('./bar.js'), require('./bar.js')",
      type: constants.SCRIPT,
      imports: {
        './bar.js': 'file:///bar.js'
      },
      lexer: {
        imports: [
          {
            specifier: './bar.js',
            type: REQUIRE,
            names: [],
            attributes: {},
            position: [0, 9, 17]
          },
          {
            specifier: './bar.js',
            type: REQUIRE,
            names: [],
            attributes: {},
            position: [21, 30, 38]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: 'module.exports = 42',
      type: constants.SCRIPT,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])
})

test('require.addon', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "const bar = require.addon('.')"
    }

    if (url.href === 'file:///package.json') {
      return '{ "name": "foo" }'
    }

    if (url.href === 'file:///prebuilds/host/foo.bare') {
      return '<native code>'
    }

    return null
  }

  const result = expand(
    traverse(new URL('file:///foo.js'), { host, extensions: ['.bare'] }, readModule)
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require.addon('.')",
      type: constants.SCRIPT,
      imports: {
        '#package': 'file:///package.json',
        '.': 'file:///prebuilds/host/foo.bare'
      },
      lexer: {
        imports: [
          {
            specifier: '.',
            type: REQUIRE | ADDON,
            names: [],
            attributes: {},
            position: [12, 27, 28]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///prebuilds/host/foo.bare'),
      source: '<native code>',
      type: constants.ADDON,
      imports: {
        '#package': 'file:///package.json'
      },
      lexer: {
        imports: [],
        exports: []
      }
    },
    {
      url: new URL('file:///package.json'),
      source: '{ "name": "foo" }',
      type: constants.JSON,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])

  t.alike(result.return.addons, [new URL('file:///prebuilds/host/foo.bare')])
})

test('require.addon, referrer', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "const bar = require.addon('.', __filename)"
    }

    if (url.href === 'file:///package.json') {
      return '{ "name": "foo" }'
    }

    if (url.href === 'file:///prebuilds/host/foo.bare') {
      return '<native code>'
    }

    return null
  }

  const result = expand(
    traverse(new URL('file:///foo.js'), { host, extensions: ['.bare'] }, readModule)
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require.addon('.', __filename)",
      type: constants.SCRIPT,
      imports: {
        '#package': 'file:///package.json',
        '.': 'file:///prebuilds/host/foo.bare'
      },
      lexer: {
        imports: [
          {
            specifier: '.',
            type: REQUIRE | ADDON,
            names: [],
            attributes: {},
            position: [12, 27, 28]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///prebuilds/host/foo.bare'),
      source: '<native code>',
      type: constants.ADDON,
      imports: {
        '#package': 'file:///package.json'
      },
      lexer: {
        imports: [],
        exports: []
      }
    },
    {
      url: new URL('file:///package.json'),
      source: '{ "name": "foo" }',
      type: constants.JSON,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])

  t.alike(result.return.addons, [new URL('file:///prebuilds/host/foo.bare')])
})

test('require.addon, addon missing', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "const bar = require.addon('.')"
    }

    if (url.href === 'file:///package.json') {
      return '{ "name": "foo" }'
    }

    return null
  }

  try {
    expand(traverse(new URL('file:///foo.js'), { host, extensions: ['.bare'] }, readModule))
    t.fail()
  } catch (err) {
    t.comment(err.message)
  }
})

test('require.addon, default specifier', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return 'const bar = require.addon()'
    }

    if (url.href === 'file:///package.json') {
      return '{ "name": "foo" }'
    }

    if (url.href === 'file:///prebuilds/host/foo.bare') {
      return '<native code>'
    }

    return null
  }

  const result = expand(
    traverse(new URL('file:///foo.js'), { host, extensions: ['.bare'] }, readModule)
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: 'const bar = require.addon()',
      type: constants.SCRIPT,
      imports: {
        '#package': 'file:///package.json',
        '.': 'file:///prebuilds/host/foo.bare'
      },
      lexer: {
        imports: [
          {
            specifier: '',
            type: REQUIRE | ADDON,
            names: [],
            attributes: {},
            position: [12, 26, 26]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///prebuilds/host/foo.bare'),
      source: '<native code>',
      type: constants.ADDON,
      imports: {
        '#package': 'file:///package.json'
      },
      lexer: {
        imports: [],
        exports: []
      }
    },
    {
      url: new URL('file:///package.json'),
      source: '{ "name": "foo" }',
      type: constants.JSON,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])

  t.alike(result.return.addons, [new URL('file:///prebuilds/host/foo.bare')])
})

test('require.addon, builtin', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "const bar = require.addon('.')"
    }

    if (url.href === 'file:///package.json') {
      return '{ "name": "foo" }'
    }

    return null
  }

  const result = expand(
    traverse(
      new URL('file:///foo.js'),
      { host, extensions: ['.bare'], builtins: ['foo'] },
      readModule
    )
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require.addon('.')",
      type: constants.SCRIPT,
      imports: {
        '#package': 'file:///package.json',
        '.': 'builtin:foo'
      },
      lexer: {
        imports: [
          {
            specifier: '.',
            type: REQUIRE | ADDON,
            names: [],
            attributes: {},
            position: [12, 27, 28]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///package.json'),
      source: '{ "name": "foo" }',
      type: constants.JSON,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])

  t.alike(result.return.addons, [new URL('builtin:foo')])
})

test('require.addon, linked', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "const bar = require.addon('.')"
    }

    if (url.href === 'file:///package.json') {
      return '{ "name": "foo" }'
    }

    return null
  }

  const result = expand(
    traverse(new URL('file:///foo.js'), { host: 'darwin-arm64', extensions: ['.bare'] }, readModule)
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require.addon('.')",
      type: constants.SCRIPT,
      imports: {
        '#package': 'file:///package.json',
        '.': 'linked:foo.framework/foo'
      },
      lexer: {
        imports: [
          {
            specifier: '.',
            type: REQUIRE | ADDON,
            names: [],
            attributes: {},
            position: [12, 27, 28]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///package.json'),
      source: '{ "name": "foo" }',
      type: constants.JSON,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])

  t.alike(result.return.addons, [new URL('linked:foo.framework/foo')])
})

test('require.addon, hosts list', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "module.exports = require.addon('.')"
    }

    if (url.href === 'file:///package.json') {
      return '{ "name": "foo" }'
    }

    if (url.href === 'file:///prebuilds/host-a/foo.bare') {
      return '<native code a>'
    }

    if (url.href === 'file:///prebuilds/host-b/foo.bare') {
      return '<native code b>'
    }

    return null
  }

  const result = expand(
    traverse(
      new URL('file:///foo.js'),
      { hosts: ['host-a', 'host-b'], extensions: ['.bare'] },
      readModule
    )
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "module.exports = require.addon('.')",
      type: constants.SCRIPT,
      imports: {
        '#package': 'file:///package.json',
        '.': {
          a: 'file:///prebuilds/host-a/foo.bare',
          b: 'file:///prebuilds/host-b/foo.bare'
        }
      },
      lexer: {
        imports: [
          {
            specifier: '.',
            type: REQUIRE | ADDON | REEXPORT,
            names: [],
            attributes: {},
            position: [17, 32, 33]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///prebuilds/host-b/foo.bare'),
      source: '<native code b>',
      type: constants.ADDON,
      imports: {
        '#package': 'file:///package.json'
      },
      lexer: {
        imports: [],
        exports: []
      }
    },
    {
      url: new URL('file:///package.json'),
      source: '{ "name": "foo" }',
      type: constants.JSON,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    },
    {
      url: new URL('file:///prebuilds/host-a/foo.bare'),
      source: '<native code a>',
      type: constants.ADDON,
      imports: {
        '#package': 'file:///package.json'
      },
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])

  t.alike(result.return.addons, [
    new URL('file:///prebuilds/host-a/foo.bare'),
    new URL('file:///prebuilds/host-b/foo.bare')
  ])
})

test('require.addon, hosts list, host variants', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "module.exports = require.addon('.')"
    }

    if (url.href === 'file:///package.json') {
      return '{ "name": "foo" }'
    }

    if (url.href === 'file:///prebuilds/host/foo.bare') {
      return '<native code>'
    }

    if (url.href === 'file:///prebuilds/host-a/foo.bare') {
      return '<native code a>'
    }

    if (url.href === 'file:///prebuilds/host-a-b/foo.bare') {
      return '<native code a b>'
    }

    return null
  }

  const result = expand(
    traverse(
      new URL('file:///foo.js'),
      { hosts: ['host', 'host-a', 'host-a-b'], extensions: ['.bare'] },
      readModule
    )
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "module.exports = require.addon('.')",
      type: constants.SCRIPT,
      imports: {
        '#package': 'file:///package.json',
        '.': {
          a: {
            b: 'file:///prebuilds/host-a-b/foo.bare',
            default: 'file:///prebuilds/host-a/foo.bare'
          },
          default: 'file:///prebuilds/host/foo.bare'
        }
      },
      lexer: {
        imports: [
          {
            specifier: '.',
            type: REQUIRE | ADDON | REEXPORT,
            names: [],
            attributes: {},
            position: [17, 32, 33]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///prebuilds/host-a-b/foo.bare'),
      source: '<native code a b>',
      type: constants.ADDON,
      imports: {
        '#package': 'file:///package.json'
      },
      lexer: {
        imports: [],
        exports: []
      }
    },
    {
      url: new URL('file:///package.json'),
      source: '{ "name": "foo" }',
      type: constants.JSON,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    },
    {
      url: new URL('file:///prebuilds/host-a/foo.bare'),
      source: '<native code a>',
      type: constants.ADDON,
      imports: {
        '#package': 'file:///package.json'
      },
      lexer: {
        imports: [],
        exports: []
      }
    },
    {
      url: new URL('file:///prebuilds/host/foo.bare'),
      source: '<native code>',
      type: constants.ADDON,
      imports: {
        '#package': 'file:///package.json'
      },
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])

  t.alike(result.return.addons, [
    new URL('file:///prebuilds/host-a-b/foo.bare'),
    new URL('file:///prebuilds/host-a/foo.bare'),
    new URL('file:///prebuilds/host/foo.bare')
  ])
})

test('require.addon, hosts list, linked', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "module.exports = require.addon('.')"
    }

    if (url.href === 'file:///package.json') {
      return '{ "name": "foo" }'
    }

    return null
  }

  const result = expand(
    traverse(
      new URL('file:///foo.js'),
      {
        hosts: ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64'],
        extensions: ['.bare']
      },
      readModule
    )
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "module.exports = require.addon('.')",
      type: constants.SCRIPT,
      imports: {
        '#package': 'file:///package.json',
        '.': {
          darwin: 'linked:foo.framework/foo',
          linux: 'linked:libfoo.so'
        }
      },
      lexer: {
        imports: [
          {
            specifier: '.',
            type: REQUIRE | ADDON | REEXPORT,
            names: [],
            attributes: {},
            position: [17, 32, 33]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///package.json'),
      source: '{ "name": "foo" }',
      type: constants.JSON,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])

  t.alike(result.return.addons, [new URL('linked:foo.framework/foo'), new URL('linked:libfoo.so')])
})

test('require.asset', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "const bar = require.asset('./bar.txt')"
    }

    if (url.href === 'file:///bar.txt') {
      return 'hello world'
    }

    return null
  }

  const result = expand(traverse(new URL('file:///foo.js'), readModule))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require.asset('./bar.txt')",
      type: constants.SCRIPT,
      imports: {
        './bar.txt': 'file:///bar.txt'
      },
      lexer: {
        imports: [
          {
            specifier: './bar.txt',
            type: REQUIRE | ASSET,
            names: [],
            attributes: {},
            position: [12, 27, 36]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.txt'),
      source: 'hello world',
      type: constants.TEXT,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])

  t.alike(result.return.assets, [new URL('file:///bar.txt')])
})

test('require.asset, referrer', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "const bar = require.asset('./bar.txt', __filename)"
    }

    if (url.href === 'file:///bar.txt') {
      return 'hello world'
    }

    return null
  }

  const result = expand(traverse(new URL('file:///foo.js'), readModule))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require.asset('./bar.txt', __filename)",
      type: constants.SCRIPT,
      imports: {
        './bar.txt': 'file:///bar.txt'
      },
      lexer: {
        imports: [
          {
            specifier: './bar.txt',
            type: REQUIRE | ASSET,
            names: [],
            attributes: {},
            position: [12, 27, 36]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.txt'),
      source: 'hello world',
      type: constants.TEXT,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])

  t.alike(result.return.assets, [new URL('file:///bar.txt')])
})

test('require + require.asset', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "require('./bar.js'), require.asset('./bar.js')"
    }

    if (url.href === 'file:///bar.js') {
      return 'module.exports = 42'
    }

    return null
  }

  const result = expand(traverse(new URL('file:///foo.js'), readModule))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "require('./bar.js'), require.asset('./bar.js')",
      type: constants.SCRIPT,
      imports: {
        './bar.js': 'file:///bar.js'
      },
      lexer: {
        imports: [
          {
            specifier: './bar.js',
            type: REQUIRE,
            names: [],
            attributes: {},
            position: [0, 9, 17]
          },
          {
            specifier: './bar.js',
            type: REQUIRE | ASSET,
            names: [],
            attributes: {},
            position: [21, 36, 44]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: 'module.exports = 42',
      type: constants.SCRIPT,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])

  t.alike(result.return.assets, [new URL('file:///bar.js')])
})

test('require.asset then require with type attribute', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "require.asset('./bar.js'); require('./bar.js', { with: { type: 'text' } })"
    }

    if (url.href === 'file:///bar.js') {
      return 'module.exports = 42'
    }

    return null
  }

  const result = expand(traverse(new URL('file:///foo.js'), readModule))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "require.asset('./bar.js'); require('./bar.js', { with: { type: 'text' } })",
      type: constants.SCRIPT,
      imports: {
        './bar.js': 'file:///bar.js'
      },
      lexer: {
        imports: [
          {
            specifier: './bar.js',
            type: REQUIRE | ASSET,
            names: [],
            attributes: {},
            position: [0, 15, 23]
          },
          {
            specifier: './bar.js',
            type: REQUIRE,
            names: [],
            attributes: { type: 'text' },
            position: [27, 36, 44]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: 'module.exports = 42',
      type: constants.TEXT,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])

  t.alike(result.return.assets, [new URL('file:///bar.js')])
})

test('require with type attribute then require.asset', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "require('./bar.js', { with: { type: 'text' } }); require.asset('./bar.js')"
    }

    if (url.href === 'file:///bar.js') {
      return 'module.exports = 42'
    }

    return null
  }

  const result = expand(traverse(new URL('file:///foo.js'), readModule))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "require('./bar.js', { with: { type: 'text' } }); require.asset('./bar.js')",
      type: constants.SCRIPT,
      imports: {
        './bar.js': 'file:///bar.js'
      },
      lexer: {
        imports: [
          {
            specifier: './bar.js',
            type: REQUIRE,
            names: [],
            attributes: { type: 'text' },
            position: [0, 9, 17]
          },
          {
            specifier: './bar.js',
            type: REQUIRE | ASSET,
            names: [],
            attributes: {},
            position: [49, 64, 72]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: 'module.exports = 42',
      type: constants.TEXT,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])

  t.alike(result.return.assets, [new URL('file:///bar.js')])
})

test('require.asset does not follow the imports of a module asset', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "require.asset('./bar.js')"
    }

    if (url.href === 'file:///bar.js') {
      return "require('./baz.js')"
    }

    if (url.href === 'file:///baz.js') {
      return 'module.exports = 42'
    }

    return null
  }

  const result = expand(traverse(new URL('file:///foo.js'), readModule))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "require.asset('./bar.js')",
      type: constants.SCRIPT,
      imports: {
        './bar.js': 'file:///bar.js'
      },
      lexer: {
        imports: [
          {
            specifier: './bar.js',
            type: REQUIRE | ASSET,
            names: [],
            attributes: {},
            position: [0, 15, 23]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: "require('./baz.js')",
      type: constants.SCRIPT,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])

  t.alike(result.return.assets, [new URL('file:///bar.js')])
})

test('require.asset, directory', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "const bar = require.asset('./bar')"
    }

    if (url.href === 'file:///bar/a.txt') {
      return 'hello a'
    }

    if (url.href === 'file:///bar/b.txt') {
      return 'hello b'
    }

    return null
  }

  function listPrefix(url) {
    if (url.href === 'file:///bar') {
      return [new URL('file:///bar/a.txt'), new URL('file:///bar/b.txt')]
    }

    return []
  }

  const result = expand(traverse(new URL('file:///foo.js'), readModule, listPrefix))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require.asset('./bar')",
      type: constants.SCRIPT,
      imports: {
        './bar': 'file:///bar'
      },
      lexer: {
        imports: [
          {
            specifier: './bar',
            type: REQUIRE | ASSET,
            names: [],
            attributes: {},
            position: [12, 27, 32]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar/a.txt'),
      source: 'hello a',
      type: constants.TEXT,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    },
    {
      url: new URL('file:///bar/b.txt'),
      source: 'hello b',
      type: constants.TEXT,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])

  t.alike(result.return.assets, [new URL('file:///bar/a.txt'), new URL('file:///bar/b.txt')])
})

test('package.json#assets', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return ''
    }

    if (url.href === 'file:///package.json') {
      return '{ "name": "foo", "assets": ["bar/"] }'
    }

    if (url.href === 'file:///bar/baz.txt') {
      return 'hello world'
    }

    return null
  }

  function listPrefix(url) {
    if (url.href === 'file:///bar/') {
      return [new URL('file:///bar/baz.txt')]
    }

    return []
  }

  const result = expand(traverse(new URL('file:///foo.js'), readModule, listPrefix))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: '',
      type: constants.SCRIPT,
      imports: {
        '#package': 'file:///package.json'
      },
      lexer: {
        imports: [],
        exports: []
      }
    },
    {
      url: new URL('file:///package.json'),
      source: '{ "name": "foo", "assets": ["bar/"] }',
      type: constants.JSON,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    },
    {
      url: new URL('file:///bar/baz.txt'),
      source: 'hello world',
      type: constants.TEXT,
      imports: { '#package': 'file:///package.json' },
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])
})

test('package.json#assets, pattern match', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return ''
    }

    if (url.href === 'file:///package.json') {
      return '{ "name": "foo", "assets": ["bar/*.txt"] }'
    }

    if (url.href === 'file:///bar/baz.bin') {
      return '<binary blob>'
    }

    if (url.href === 'file:///bar/baz.txt') {
      return 'hello world'
    }

    return null
  }

  function listPrefix(url) {
    if (url.href === 'file:///bar/') {
      return [new URL('file:///bar/baz.bin'), new URL('file:///bar/baz.txt')]
    }

    return []
  }

  const result = expand(traverse(new URL('file:///foo.js'), readModule, listPrefix))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: '',
      type: constants.SCRIPT,
      imports: {
        '#package': 'file:///package.json'
      },
      lexer: {
        imports: [],
        exports: []
      }
    },
    {
      url: new URL('file:///package.json'),
      source: '{ "name": "foo", "assets": ["bar/*.txt"] }',
      type: constants.JSON,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    },
    {
      url: new URL('file:///bar/baz.txt'),
      source: 'hello world',
      type: constants.TEXT,
      imports: {
        '#package': 'file:///package.json'
      },
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])
})

test('package.json#assets, negate', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return ''
    }

    if (url.href === 'file:///package.json') {
      return '{ "name": "foo", "assets": ["bar/", "!bar/qux.txt"] }'
    }

    if (url.href === 'file:///bar/baz.txt' || url.href === 'file:///bar/qux.txt') {
      return 'hello world'
    }

    return null
  }

  function listPrefix(url) {
    if (url.href === 'file:///bar/') {
      return [new URL('file:///bar/baz.txt'), new URL('file:///bar/qux.txt')]
    }

    if (url.href === 'file:///bar/qux.txt') {
      return [new URL('file:///bar/qux.txt')]
    }

    return []
  }

  const result = expand(traverse(new URL('file:///foo.js'), readModule, listPrefix))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: '',
      type: constants.SCRIPT,
      imports: {
        '#package': 'file:///package.json'
      },
      lexer: {
        imports: [],
        exports: []
      }
    },
    {
      url: new URL('file:///package.json'),
      source: '{ "name": "foo", "assets": ["bar/", "!bar/qux.txt"] }',
      type: constants.JSON,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    },
    {
      url: new URL('file:///bar/baz.txt'),
      source: 'hello world',
      type: constants.TEXT,
      imports: {
        '#package': 'file:///package.json'
      },
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])
})

test('package.json#assets, conditional pattern', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return ''
    }

    if (url.href === 'file:///package.json') {
      return '{ "name": "foo", "assets": [{ "darwin": "darwin/", "linux": "linux/" }] }'
    }

    if (url.href === 'file:///darwin/baz.txt') {
      return 'hello darwin'
    }

    if (url.href === 'file:///linux/baz.txt') {
      return 'hello linux'
    }

    return null
  }

  function listPrefix(url) {
    if (url.href === 'file:///darwin/') {
      return [new URL('file:///darwin/baz.txt')]
    }

    if (url.href === 'file:///linux/') {
      return [new URL('file:///linux/baz.txt')]
    }

    return []
  }

  {
    const result = expand(
      traverse(new URL('file:///foo.js'), { conditions: ['darwin'] }, readModule, listPrefix)
    )

    t.alike(result.values, [
      {
        url: new URL('file:///foo.js'),
        source: '',
        type: constants.SCRIPT,
        imports: {
          '#package': 'file:///package.json'
        },
        lexer: {
          imports: [],
          exports: []
        }
      },
      {
        url: new URL('file:///package.json'),
        source: '{ "name": "foo", "assets": [{ "darwin": "darwin/", "linux": "linux/" }] }',
        type: constants.JSON,
        imports: {},
        lexer: {
          imports: [],
          exports: []
        }
      },
      {
        url: new URL('file:///darwin/baz.txt'),
        source: 'hello darwin',
        type: constants.TEXT,
        imports: {
          '#package': 'file:///package.json'
        },
        lexer: {
          imports: [],
          exports: []
        }
      }
    ])
  }
  {
    const result = expand(
      traverse(new URL('file:///foo.js'), { conditions: ['linux'] }, readModule, listPrefix)
    )

    t.alike(result.values, [
      {
        url: new URL('file:///foo.js'),
        source: '',
        type: constants.SCRIPT,
        imports: {
          '#package': 'file:///package.json'
        },
        lexer: {
          imports: [],
          exports: []
        }
      },
      {
        url: new URL('file:///package.json'),
        source: '{ "name": "foo", "assets": [{ "darwin": "darwin/", "linux": "linux/" }] }',
        type: constants.JSON,
        imports: {},
        lexer: {
          imports: [],
          exports: []
        }
      },
      {
        url: new URL('file:///linux/baz.txt'),
        source: 'hello linux',
        type: constants.TEXT,
        imports: {
          '#package': 'file:///package.json'
        },
        lexer: {
          imports: [],
          exports: []
        }
      }
    ])
  }
})

test('package.json#assets, also imported as module with type attribute', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "require('./bar/baz.js', { with: { type: 'text' } })"
    }

    if (url.href === 'file:///package.json') {
      return '{ "name": "foo", "assets": ["bar/"] }'
    }

    if (url.href === 'file:///bar/baz.js') {
      return 'module.exports = 42'
    }

    return null
  }

  function listPrefix(url) {
    if (url.href === 'file:///bar/') {
      return [new URL('file:///bar/baz.js')]
    }

    return []
  }

  const result = expand(traverse(new URL('file:///foo.js'), readModule, listPrefix))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "require('./bar/baz.js', { with: { type: 'text' } })",
      type: constants.SCRIPT,
      imports: {
        '#package': 'file:///package.json',
        './bar/baz.js': 'file:///bar/baz.js'
      },
      lexer: {
        imports: [
          {
            specifier: './bar/baz.js',
            type: REQUIRE,
            names: [],
            attributes: { type: 'text' },
            position: [0, 9, 21]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar/baz.js'),
      source: 'module.exports = 42',
      type: constants.TEXT,
      imports: {
        '#package': 'file:///package.json'
      },
      lexer: {
        imports: [],
        exports: []
      }
    },
    {
      url: new URL('file:///package.json'),
      source: '{ "name": "foo", "assets": ["bar/"] }',
      type: constants.JSON,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])

  t.alike(result.return.assets, [new URL('file:///bar/baz.js')])
})

test('resolutions map', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "const bar = require('./bar.js')"
    }

    if (url.href === 'file:///bar.js') {
      return "const baz = require('./baz.js')"
    }

    if (url.href === 'file:///baz.js') {
      return 'module.exports = 42'
    }

    return null
  }

  const resolutions = {
    'file:///foo.js': {
      './bar.js': 'file:///bar.js'
    },
    'file:///bar.js': {
      './baz.js': 'file:///baz.js'
    },
    'file:///baz.js': {}
  }

  const result = expand(traverse(new URL('file:///foo.js'), { resolutions }, readModule))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require('./bar.js')",
      type: constants.SCRIPT,
      imports: {
        './bar.js': 'file:///bar.js'
      },
      lexer: {
        imports: [],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: "const baz = require('./baz.js')",
      type: constants.SCRIPT,
      imports: {
        './baz.js': 'file:///baz.js'
      },
      lexer: {
        imports: [],
        exports: []
      }
    },
    {
      url: new URL('file:///baz.js'),
      source: 'module.exports = 42',
      type: constants.SCRIPT,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])
})

test('resolutions map, partial', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "const bar = require('./bar.js')"
    }

    if (url.href === 'file:///bar.js') {
      return "const baz = require('./baz.js')"
    }

    if (url.href === 'file:///baz.js') {
      return 'module.exports = 42'
    }

    return null
  }

  const resolutions = {
    'file:///foo.js': {
      './bar.js': 'file:///bar.js'
    },
    'file:///baz.js': {}
  }

  const result = expand(traverse(new URL('file:///foo.js'), { resolutions }, readModule))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require('./bar.js')",
      type: constants.SCRIPT,
      imports: {
        './bar.js': 'file:///bar.js'
      },
      lexer: {
        imports: [],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: "const baz = require('./baz.js')",
      type: constants.SCRIPT,
      imports: {
        './baz.js': 'file:///baz.js'
      },
      lexer: {
        imports: [
          {
            specifier: './baz.js',
            type: REQUIRE,
            names: [],
            attributes: {},
            position: [12, 21, 29]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///baz.js'),
      source: 'module.exports = 42',
      type: constants.SCRIPT,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])
})

test('resolutions map, module missing', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "const bar = require('./bar.js')"
    }

    return null
  }

  const resolutions = {
    'file:///foo.js': {
      './bar.js': 'file:///bar.js'
    }
  }

  try {
    expand(traverse(new URL('file:///foo.js'), { resolutions }, readModule))
    t.fail()
  } catch (err) {
    t.comment(err.message)
  }
})

test('resolutions map, builtin', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "const bar = require('./bar.js')"
    }

    return null
  }

  const resolutions = {
    'file:///foo.js': {
      './bar.js': 'builtin:bar.js'
    }
  }

  const result = expand(traverse(new URL('file:///foo.js'), { resolutions }, readModule))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require('./bar.js')",
      type: constants.SCRIPT,
      imports: {
        './bar.js': 'builtin:bar.js'
      },
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])
})

test('resolutions map, #package entry', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return 'module.exports = 42'
    }

    if (url.href === 'file:///package.json') {
      return '{ "name": "foo" }'
    }

    return null
  }

  const resolutions = {
    'file:///foo.js': {
      '#package': 'file:///package.json'
    },
    'file:///package.json': {}
  }

  const result = expand(traverse(new URL('file:///foo.js'), { resolutions }, readModule))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: 'module.exports = 42',
      type: constants.SCRIPT,
      imports: {
        '#package': 'file:///package.json'
      },
      lexer: {
        imports: [],
        exports: []
      }
    },
    {
      url: new URL('file:///package.json'),
      source: '{ "name": "foo" }',
      type: constants.JSON,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])
})

test('imports map', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "const bar = require('bar')"
    }

    if (url.href === 'file:///bar.js') {
      return "const baz = require('baz')"
    }

    if (url.href === 'file:///baz.js') {
      return 'module.exports = 42'
    }

    return null
  }

  const imports = {
    bar: 'file:///bar.js',
    baz: 'file:///baz.js'
  }

  const result = expand(traverse(new URL('file:///foo.js'), { imports }, readModule))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require('bar')",
      type: constants.SCRIPT,
      imports: {
        bar: 'file:///bar.js'
      },
      lexer: {
        imports: [
          {
            specifier: 'bar',
            type: REQUIRE,
            names: [],
            attributes: {},
            position: [12, 21, 24]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: "const baz = require('baz')",
      type: constants.SCRIPT,
      imports: {
        baz: 'file:///baz.js'
      },
      lexer: {
        imports: [
          {
            specifier: 'baz',
            type: REQUIRE,
            names: [],
            attributes: {},
            position: [12, 21, 24]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///baz.js'),
      source: 'module.exports = 42',
      type: constants.SCRIPT,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])
})

test('imports map, deferred', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "const bar = require('bar')"
    }

    if (url.href === 'file:///bar.js') {
      return "const baz = require('baz')"
    }

    return null
  }

  const imports = {
    bar: 'file:///bar.js',
    baz: 'qux'
  }

  const defer = ['qux']

  const result = expand(traverse(new URL('file:///foo.js'), { imports, defer }, readModule))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require('bar')",
      type: constants.SCRIPT,
      imports: {
        bar: 'file:///bar.js'
      },
      lexer: {
        imports: [
          {
            specifier: 'bar',
            type: REQUIRE,
            names: [],
            attributes: {},
            position: [12, 21, 24]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: "const baz = require('baz')",
      type: constants.SCRIPT,
      imports: {
        baz: 'deferred:qux'
      },
      lexer: {
        imports: [
          {
            specifier: 'baz',
            type: REQUIRE,
            names: [],
            attributes: {},
            position: [12, 21, 24]
          }
        ],
        exports: []
      }
    }
  ])
})

test('conditional imports, conditions matrix', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "const bar = require('#bar')"
    }

    if (url.href === 'file:///a.js') {
      return "module.exports = 'a'"
    }

    if (url.href === 'file:///b.js') {
      return "module.exports = 'b'"
    }

    if (url.href === 'file:///c.js') {
      return "module.exports = 'c'"
    }

    if (url.href === 'file:///package.json') {
      return '{ "name": "foo", "imports": { "#bar": { "a": "./a.js", "b": "./b.js", "c": "./c.js" } } }'
    }

    return null
  }

  const result = expand(
    traverse(new URL('file:///foo.js'), { conditions: [['a'], ['b']] }, readModule)
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require('#bar')",
      type: constants.SCRIPT,
      imports: {
        '#package': 'file:///package.json',
        '#bar': { a: 'file:///a.js', b: 'file:///b.js' }
      },
      lexer: {
        imports: [
          {
            specifier: '#bar',
            type: REQUIRE,
            names: [],
            attributes: {},
            position: [12, 21, 25]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///b.js'),
      source: "module.exports = 'b'",
      type: constants.SCRIPT,
      imports: {
        '#package': 'file:///package.json'
      },
      lexer: {
        imports: [],
        exports: []
      }
    },
    {
      url: new URL('file:///package.json'),
      source:
        '{ "name": "foo", "imports": { "#bar": { "a": "./a.js", "b": "./b.js", "c": "./c.js" } } }',
      type: constants.JSON,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    },
    {
      url: new URL('file:///a.js'),
      source: "module.exports = 'a'",
      type: constants.SCRIPT,
      imports: {
        '#package': 'file:///package.json'
      },
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])
})

test('imports attribute', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "const bar = require('./bar.js', { with: { imports: './imports.json' } })"
    }

    if (url.href === 'file:///bar.js') {
      return "const baz = require('baz')"
    }

    if (url.href === 'file:///baz.js') {
      return 'module.exports = 42'
    }

    if (url.href === 'file:///imports.json') {
      return '{ "baz": "/baz.js" }'
    }

    return null
  }

  const result = expand(traverse(new URL('file:///foo.js'), readModule))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require('./bar.js', { with: { imports: './imports.json' } })",
      type: constants.SCRIPT,
      imports: {
        './imports.json': 'file:///imports.json',
        './bar.js': 'file:///bar.js'
      },
      lexer: {
        imports: [
          {
            specifier: './bar.js',
            type: REQUIRE,
            names: [],
            attributes: { imports: './imports.json' },
            position: [12, 21, 29]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: "const baz = require('baz')",
      type: constants.SCRIPT,
      imports: {
        baz: 'file:///baz.js'
      },
      lexer: {
        imports: [
          {
            specifier: 'baz',
            type: REQUIRE,
            names: [],
            attributes: {},
            position: [12, 21, 24]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///baz.js'),
      source: 'module.exports = 42',
      type: constants.SCRIPT,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    },
    {
      url: new URL('file:///imports.json'),
      source: '{ "baz": "/baz.js" }',
      type: constants.JSON,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])
})

test('aliases, .ts to .js', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.ts') {
      return "const bar = require('./bar.ts')"
    }

    if (url.href === 'file:///bar.ts') {
      return 'module.exports = 42'
    }

    return null
  }

  const result = expand(
    traverse(new URL('file:///foo.ts'), { aliases: { '.ts': '.js' } }, readModule)
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require('./bar.ts')",
      type: constants.SCRIPT,
      imports: {
        './bar.ts': 'file:///bar.js'
      },
      lexer: {
        imports: [
          {
            specifier: './bar.ts',
            type: REQUIRE,
            names: [],
            attributes: {},
            position: [12, 21, 29]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: 'module.exports = 42',
      type: constants.SCRIPT,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])
})

test('aliases, .mts to .mjs', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.mts') {
      return "import './bar.mts'"
    }

    if (url.href === 'file:///bar.mts') {
      return 'export default 42'
    }

    return null
  }

  const result = expand(
    traverse(new URL('file:///foo.mts'), { aliases: { '.mts': '.mjs' } }, readModule)
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.mjs'),
      source: "import './bar.mts'",
      type: constants.MODULE,
      imports: {
        './bar.mts': 'file:///bar.mjs'
      },
      lexer: {
        imports: [
          {
            specifier: './bar.mts',
            type: IMPORT,
            names: [],
            attributes: {},
            position: [0, 8, 17]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.mjs'),
      source: 'export default 42',
      type: constants.MODULE,
      imports: {},
      lexer: {
        imports: [],
        exports: [{ name: 'default', position: [0, 7, 14] }]
      }
    }
  ])
})

test('aliases, .ts to .js with defaultType MODULE', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.ts') {
      return "import './bar.ts'"
    }

    if (url.href === 'file:///bar.ts') {
      return 'export default 42'
    }

    return null
  }

  const result = expand(
    traverse(
      new URL('file:///foo.ts'),
      {
        defaultType: traverse.constants.MODULE,
        aliases: { '.ts': '.js' }
      },
      readModule
    )
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "import './bar.ts'",
      type: constants.MODULE,
      imports: { './bar.ts': 'file:///bar.js' },
      lexer: {
        imports: [
          {
            specifier: './bar.ts',
            type: IMPORT,
            names: [],
            attributes: {},
            position: [0, 8, 16]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: 'export default 42',
      type: constants.MODULE,
      imports: {},
      lexer: {
        imports: [],
        exports: [{ name: 'default', position: [0, 7, 14] }]
      }
    }
  ])
})

test('aliases, extensionless .ts to .js, bare resolver', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.ts') {
      return "const bar = require('./bar')"
    }

    if (url.href === 'file:///bar.ts') {
      return 'module.exports = 42'
    }

    return null
  }

  const result = expand(
    traverse(
      new URL('file:///foo.ts'),
      { resolve: traverse.resolve.bare, aliases: { '.ts': '.js' } },
      readModule
    )
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require('./bar')",
      type: constants.SCRIPT,
      imports: { './bar': 'file:///bar.js' },
      lexer: {
        imports: [
          {
            specifier: './bar',
            type: REQUIRE,
            names: [],
            attributes: {},
            position: [12, 21, 26]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: 'module.exports = 42',
      type: constants.SCRIPT,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])
})

test('aliases, extensionless .cts to .cjs, bare resolver', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.cts') {
      return "const bar = require('./bar')"
    }

    if (url.href === 'file:///bar.cts') {
      return 'module.exports = 42'
    }

    return null
  }

  const result = expand(
    traverse(
      new URL('file:///foo.cts'),
      { resolve: traverse.resolve.bare, aliases: { '.cts': '.cjs' } },
      readModule
    )
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.cjs'),
      source: "const bar = require('./bar')",
      type: constants.SCRIPT,
      imports: { './bar': 'file:///bar.cjs' },
      lexer: {
        imports: [
          {
            specifier: './bar',
            type: REQUIRE,
            names: [],
            attributes: {},
            position: [12, 21, 26]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.cjs'),
      source: 'module.exports = 42',
      type: constants.SCRIPT,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])
})

test('aliases, extensionless .mts to .mjs, bare resolver', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.mts') {
      return "import './bar'"
    }

    if (url.href === 'file:///bar.mts') {
      return 'export default 42'
    }

    return null
  }

  const result = expand(
    traverse(
      new URL('file:///foo.mts'),
      { resolve: traverse.resolve.bare, aliases: { '.mts': '.mjs' } },
      readModule
    )
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.mjs'),
      source: "import './bar'",
      type: constants.MODULE,
      imports: {
        './bar': 'file:///bar.mjs'
      },
      lexer: {
        imports: [
          {
            specifier: './bar',
            type: IMPORT,
            names: [],
            attributes: {},
            position: [0, 8, 13]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.mjs'),
      source: 'export default 42',
      type: constants.MODULE,
      imports: {},
      lexer: {
        imports: [],
        exports: [{ name: 'default', position: [0, 7, 14] }]
      }
    }
  ])
})

test('require, TypeScript source', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.ts') {
      return "const bar: number = require('./bar.ts')"
    }

    if (url.href === 'file:///bar.ts') {
      return 'module.exports = 42'
    }

    return null
  }

  const result = expand(traverse(new URL('file:///foo.ts'), readModule))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.ts'),
      source: "const bar: number = require('./bar.ts')",
      type: constants.SCRIPT,
      imports: { './bar.ts': 'file:///bar.ts' },
      lexer: {
        imports: [
          {
            specifier: './bar.ts',
            type: REQUIRE,
            names: [],
            attributes: {},
            position: [20, 29, 37]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.ts'),
      source: 'module.exports = 42',
      type: constants.SCRIPT,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])
})

test('require, TypeScript source, .cts', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.cts') {
      return "const bar = require('./bar.cts')"
    }

    if (url.href === 'file:///bar.cts') {
      return 'module.exports = 42'
    }

    return null
  }

  const result = expand(traverse(new URL('file:///foo.cts'), readModule))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.cts'),
      source: "const bar = require('./bar.cts')",
      type: constants.SCRIPT,
      imports: {
        './bar.cts': 'file:///bar.cts'
      },
      lexer: {
        imports: [
          {
            specifier: './bar.cts',
            type: REQUIRE,
            names: [],
            attributes: {},
            position: [12, 21, 30]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.cts'),
      source: 'module.exports = 42',
      type: constants.SCRIPT,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])
})

test('import, TypeScript source, .mts', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.mts') {
      return "import { type Bar, baz } from './bar.mts'"
    }

    if (url.href === 'file:///bar.mts') {
      return 'export type Bar = number\nexport const baz = 42'
    }

    return null
  }

  const result = expand(traverse(new URL('file:///foo.mts'), readModule))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.mts'),
      source: "import { type Bar, baz } from './bar.mts'",
      type: constants.MODULE,
      imports: {
        './bar.mts': 'file:///bar.mts'
      },
      lexer: {
        imports: [
          {
            specifier: './bar.mts',
            type: IMPORT,
            names: ['baz'],
            attributes: {},
            position: [0, 31, 40]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.mts'),
      source: 'export type Bar = number\nexport const baz = 42',
      type: constants.MODULE,
      imports: {},
      lexer: {
        imports: [],
        exports: [{ name: 'baz', position: [25, 38, 41] }]
      }
    }
  ])
})

test('import, TypeScript source, package type module', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.ts') {
      return "import './bar.ts'"
    }

    if (url.href === 'file:///package.json') {
      return '{ "type": "module" }'
    }

    if (url.href === 'file:///bar.ts') {
      return 'export default 42'
    }

    return null
  }

  const result = expand(traverse(new URL('file:///foo.ts'), readModule))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.ts'),
      source: "import './bar.ts'",
      type: constants.MODULE,
      imports: {
        '#package': 'file:///package.json',
        './bar.ts': 'file:///bar.ts'
      },
      lexer: {
        imports: [
          {
            specifier: './bar.ts',
            type: IMPORT,
            names: [],
            attributes: {},
            position: [0, 8, 16]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.ts'),
      source: 'export default 42',
      type: constants.MODULE,
      imports: { '#package': 'file:///package.json' },
      lexer: {
        imports: [],
        exports: [{ name: 'default', position: [0, 7, 14] }]
      }
    },
    {
      url: new URL('file:///package.json'),
      source: '{ "type": "module" }',
      type: constants.JSON,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])
})

test('conditional exports resolve per condition', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.mjs') {
      return "import 'pkg'\nrequire('pkg')"
    }

    if (url.href === 'file:///node_modules/pkg/package.json') {
      return '{ "exports": { "import": "./esm.mjs", "require": "./cjs.cjs" } }'
    }

    if (url.href === 'file:///node_modules/pkg/esm.mjs') {
      return 'export default 1'
    }

    if (url.href === 'file:///node_modules/pkg/cjs.cjs') {
      return 'module.exports = 2'
    }

    return null
  }

  const result = expand(
    traverse(new URL('file:///foo.mjs'), { resolve: traverse.resolve.bare }, readModule)
  )

  const foo = result.values.find((value) => value.url.href === 'file:///foo.mjs')

  t.alike(foo.imports, {
    pkg: {
      import: 'file:///node_modules/pkg/esm.mjs',
      require: 'file:///node_modules/pkg/cjs.cjs'
    }
  })

  t.alike(result.values.map((value) => value.url.href).sort(), [
    'file:///foo.mjs',
    'file:///node_modules/pkg/cjs.cjs',
    'file:///node_modules/pkg/esm.mjs',
    'file:///node_modules/pkg/package.json'
  ])
})

test('conditional exports collapse when equal', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.mjs') {
      return "import 'pkg'\nrequire('pkg')"
    }

    if (url.href === 'file:///node_modules/pkg/package.json') {
      return '{ "exports": "./index.js" }'
    }

    if (url.href === 'file:///node_modules/pkg/index.js') {
      return 'module.exports = 1'
    }

    return null
  }

  const result = expand(
    traverse(new URL('file:///foo.mjs'), { resolve: traverse.resolve.bare }, readModule)
  )

  const foo = result.values.find((value) => value.url.href === 'file:///foo.mjs')

  t.alike(foo.imports, { pkg: 'file:///node_modules/pkg/index.js' })
})

test('resolution transform canonicalizes and dedupes', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "const a = require('./a.js')\nconst b = require('./b.js')"
    }

    if (url.href === 'file:///a.js' || url.href === 'file:///b.js') {
      return 'module.exports = 42'
    }

    return null
  }

  function resolveModule(url) {
    if (url.href === 'file:///a.js' || url.href === 'file:///b.js') {
      return new URL('file:///real.js')
    }

    return url
  }

  const result = expand(traverse(new URL('file:///foo.js'), readModule, null, null, resolveModule))

  const foo = result.values.find((value) => value.url.href === 'file:///foo.js')

  t.alike(foo.imports, {
    './a.js': 'file:///real.js',
    './b.js': 'file:///real.js'
  })

  const urls = result.values.map((value) => value.url.href)

  t.absent(urls.includes('file:///a.js'))
  t.absent(urls.includes('file:///b.js'))
  t.is(urls.filter((href) => href === 'file:///real.js').length, 1)
})

test('resolution transform applied to addon', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "const bar = require.addon('.')"
    }

    if (url.href === 'file:///package.json') {
      return '{ "name": "foo" }'
    }

    if (url.href === 'file:///prebuilds/host/foo.bare') {
      return '<native code>'
    }

    return null
  }

  function resolveModule(url) {
    if (url.href === 'file:///prebuilds/host/foo.bare') {
      return new URL('file:///real/foo.bare')
    }

    return url
  }

  const result = expand(
    traverse(
      new URL('file:///foo.js'),
      { host, extensions: ['.bare'] },
      readModule,
      null,
      null,
      resolveModule
    )
  )

  const foo = result.values.find((value) => value.url.href === 'file:///foo.js')

  t.is(foo.imports['.'], 'file:///real/foo.bare')

  t.alike(result.return.addons, [new URL('file:///real/foo.bare')])

  const urls = result.values.map((value) => value.url.href)

  t.ok(urls.includes('file:///real/foo.bare'))
  t.absent(urls.includes('file:///prebuilds/host/foo.bare'))
})

test('resolution transform is called for every existing module', (t) => {
  const resolved = []

  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "const bar = require('./bar.js')"
    }

    if (url.href === 'file:///bar.js') {
      return 'module.exports = 42'
    }

    return null
  }

  function resolveModule(url) {
    resolved.push(url.href)

    return url
  }

  expand(traverse(new URL('file:///foo.js'), readModule, null, null, resolveModule))

  t.alike(resolved, ['file:///bar.js'])
})

test('probe, custom probe reports addon exists', (t) => {
  const probed = []

  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "const bar = require.addon('.')"
    }

    if (url.href === 'file:///package.json') {
      return '{ "name": "foo" }'
    }

    if (url.href === 'file:///prebuilds/host/foo.bare') {
      return '<native code>'
    }

    return null
  }

  function probeModule(url) {
    probed.push(url.href)

    if (url.href === 'file:///prebuilds/host/foo.bare') return true

    return undefined
  }

  const result = expand(
    traverse(
      new URL('file:///foo.js'),
      { host, extensions: ['.bare'] },
      readModule,
      null,
      probeModule
    )
  )

  t.alike(probed, ['file:///prebuilds/host/foo.bare'])

  t.alike(result.return.addons, [new URL('file:///prebuilds/host/foo.bare')])

  const addon = result.values.find((value) => value.url.href === 'file:///prebuilds/host/foo.bare')

  t.is(addon.source, '<native code>')
  t.is(addon.type, constants.ADDON)
})

test('probe, custom probe reports addon missing', (t) => {
  const read = []

  function readModule(url) {
    read.push(url.href)

    if (url.href === 'file:///foo.js') {
      return "const bar = require.addon('.')"
    }

    if (url.href === 'file:///package.json') {
      return '{ "name": "foo" }'
    }

    if (url.href === 'file:///prebuilds/host/foo.bare') {
      t.fail()
    }

    return null
  }

  function probeModule(url) {
    if (url.href === 'file:///prebuilds/host/foo.bare') return false

    return undefined
  }

  try {
    expand(
      traverse(
        new URL('file:///foo.js'),
        { host, extensions: ['.bare'] },
        readModule,
        null,
        probeModule
      )
    )
    t.fail('should throw')
  } catch (err) {
    t.comment(err.message)
  }

  t.absent(read.includes('file:///prebuilds/host/foo.bare'))
})

test('probe, default probe reads addon exactly once', (t) => {
  const read = []

  function readModule(url) {
    read.push(url.href)

    if (url.href === 'file:///foo.js') {
      return "const bar = require.addon('.')"
    }

    if (url.href === 'file:///package.json') {
      return '{ "name": "foo" }'
    }

    if (url.href === 'file:///prebuilds/host/foo.bare') {
      return '<native code>'
    }

    return null
  }

  const result = expand(
    traverse(new URL('file:///foo.js'), { host, extensions: ['.bare'] }, readModule)
  )

  t.is(read.filter((href) => href === 'file:///prebuilds/host/foo.bare').length, 1)

  t.alike(result.return.addons, [new URL('file:///prebuilds/host/foo.bare')])
})

test('probe, async custom probe', async (t) => {
  const probed = []

  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return "const bar = require.addon('.')"
    }

    if (url.href === 'file:///package.json') {
      return '{ "name": "foo" }'
    }

    if (url.href === 'file:///prebuilds/host/foo.bare') {
      return '<native code>'
    }

    return null
  }

  async function probeModule(url) {
    probed.push(url.href)

    return url.href === 'file:///prebuilds/host/foo.bare'
  }

  const addons = []

  for await (const dependency of traverse(
    new URL('file:///foo.js'),
    { host, extensions: ['.bare'] },
    readModule,
    null,
    probeModule
  )) {
    if (dependency.type === constants.ADDON) addons.push(dependency.url.href)
  }

  t.alike(probed, ['file:///prebuilds/host/foo.bare'])
  t.alike(addons, ['file:///prebuilds/host/foo.bare'])
})

test('data URL entry', (t) => {
  const read = []

  function readModule(url) {
    read.push(url.href)

    if (url.href === 'file:///bar.js') {
      return 'module.exports = 42'
    }

    return null
  }

  const entry = dataURL('require("file:///bar.js")')

  const result = expand(traverse(entry, readModule))

  t.absent(read.includes(entry.href))

  t.alike(result.values, [
    {
      url: entry,
      source: 'require("file:///bar.js")',
      type: constants.SCRIPT,
      imports: {
        'file:///bar.js': 'file:///bar.js'
      },
      lexer: {
        imports: [
          {
            specifier: 'file:///bar.js',
            type: REQUIRE,
            names: [],
            attributes: {},
            position: [0, 9, 23]
          }
        ],
        exports: []
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: 'module.exports = 42',
      type: constants.SCRIPT,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])
})

test('data URL import', (t) => {
  const entry = dataURL('{"foo":42}', 'application/json')

  const read = []

  function readModule(url) {
    read.push(url.href)

    if (url.href === 'file:///foo.js') {
      return `const x = require('${entry.href}')`
    }

    return null
  }

  const result = expand(traverse(new URL('file:///foo.js'), readModule))

  t.absent(read.includes(entry.href))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: `const x = require('${entry.href}')`,
      type: constants.SCRIPT,
      imports: {
        [entry.href]: entry.href
      },
      lexer: {
        imports: [
          {
            specifier: entry.href,
            type: REQUIRE,
            names: [],
            attributes: {},
            position: [10, 19, 61]
          }
        ],
        exports: []
      }
    },
    {
      url: entry,
      source: '{"foo":42}',
      type: constants.JSON,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])
})

test('data URL base64', (t) => {
  const read = []

  function readModule(url) {
    read.push(url.href)

    return null
  }

  const entry = base64DataURL('{"bar":1}', 'application/json')

  const result = expand(traverse(entry, readModule))

  t.alike(read, [])

  t.alike(result.values, [
    {
      url: entry,
      source: Buffer.from('{"bar":1}'),
      type: constants.JSON,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])
})

test('data URL without media type', (t) => {
  const entry = dataURL('module.exports = 42', '')

  const result = expand(traverse(entry, () => null))

  t.alike(result.values, [
    {
      url: entry,
      source: 'module.exports = 42',
      type: constants.SCRIPT,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])
})

test('data URL with UTF-8 charset', (t) => {
  const entry = dataURL('module.exports = 42', 'text/javascript;charset=utf-8')

  const result = expand(traverse(entry, () => null))

  t.alike(result.values, [
    {
      url: entry,
      source: 'module.exports = 42',
      type: constants.SCRIPT,
      imports: {},
      lexer: {
        imports: [],
        exports: []
      }
    }
  ])
})

test('data URL with unknown charset', (t) => {
  const entry = dataURL('module.exports = 42', 'text/javascript;charset=utf-16')

  t.exception(() => expand(traverse(entry, () => null)), /UNKNOWN_DATA_URL_CHARSET/)
})

test('data URL without media type inherits module type from ES module referrer', (t) => {
  const entry = dataURL('export default 42', '')

  function readModule(url) {
    if (url.href === 'file:///foo.mjs') {
      return `import ${JSON.stringify(entry.href)}`
    }

    return null
  }

  const result = expand(traverse(new URL('file:///foo.mjs'), readModule))

  const dependency = result.values.find((d) => d.url.href === entry.href)

  t.is(dependency.type, constants.MODULE)
})

test('data URL without media type inherits script type from CommonJS referrer', (t) => {
  const entry = dataURL('module.exports = 42', '')

  function readModule(url) {
    if (url.href === 'file:///foo.cjs') {
      return `require(${JSON.stringify(entry.href)})`
    }

    return null
  }

  const result = expand(traverse(new URL('file:///foo.cjs'), readModule))

  const dependency = result.values.find((d) => d.url.href === entry.href)

  t.is(dependency.type, constants.SCRIPT)
})

test('data URL import inherits module type from ES module referrer', (t) => {
  const entry = dataURL('export default 42')

  function readModule(url) {
    if (url.href === 'file:///foo.mjs') {
      return `import ${JSON.stringify(entry.href)}`
    }

    return null
  }

  const result = expand(traverse(new URL('file:///foo.mjs'), readModule))

  const dependency = result.values.find((d) => d.url.href === entry.href)

  t.is(dependency.type, constants.MODULE)
})

test('data URL import inherits script type from CommonJS referrer', (t) => {
  const entry = dataURL('module.exports = 42')

  function readModule(url) {
    if (url.href === 'file:///foo.cjs') {
      return `require(${JSON.stringify(entry.href)})`
    }

    return null
  }

  const result = expand(traverse(new URL('file:///foo.cjs'), readModule))

  const dependency = result.values.find((d) => d.url.href === entry.href)

  t.is(dependency.type, constants.SCRIPT)
})

test('data URL in resolutions map inherits module type from ES module referrer', (t) => {
  const entry = dataURL('export default 42')

  function readModule(url) {
    if (url.href === 'file:///foo.mjs') {
      return `import ${JSON.stringify(entry.href)}`
    }

    return null
  }

  const resolutions = {
    'file:///foo.mjs': {
      [entry.href]: entry.href
    }
  }

  const result = expand(traverse(new URL('file:///foo.mjs'), { resolutions }, readModule))

  const dependency = result.values.find((d) => d.url.href === entry.href)

  t.is(dependency.type, constants.MODULE)
})

test('data URL in resolutions map inherits script type from CommonJS referrer', (t) => {
  const entry = dataURL('module.exports = 42')

  function readModule(url) {
    if (url.href === 'file:///foo.cjs') {
      return `require(${JSON.stringify(entry.href)})`
    }

    return null
  }

  const resolutions = {
    'file:///foo.cjs': {
      [entry.href]: entry.href
    }
  }

  const result = expand(traverse(new URL('file:///foo.cjs'), { resolutions }, readModule))

  const dependency = result.values.find((d) => d.url.href === entry.href)

  t.is(dependency.type, constants.SCRIPT)
})

test('data URL with JSON media type', (t) => {
  const entry = dataURL('{ "foo": 42 }', 'application/json')

  const result = expand(traverse(entry, () => null))

  const dependency = result.values.find((d) => d.url.href === entry.href)

  t.is(dependency.type, constants.JSON)
})

test('data URL with text media type', (t) => {
  const entry = dataURL('hello', 'text/plain')

  const result = expand(traverse(entry, () => null))

  const dependency = result.values.find((d) => d.url.href === entry.href)

  t.is(dependency.type, constants.TEXT)
})

test('data URL with binary media type', (t) => {
  const entry = dataURL('hello', 'application/octet-stream')

  const result = expand(traverse(entry, () => null))

  const dependency = result.values.find((d) => d.url.href === entry.href)

  t.is(dependency.type, constants.BINARY)
})

test('data URL with unsupported media type', (t) => {
  const entry = dataURL('<a/>', 'application/xml')

  t.exception(() => expand(traverse(entry, () => null)), /TYPE_INCOMPATIBLE/)
})

test('data URL with incompatible type attribute', (t) => {
  const entry = dataURL('export default 42', 'text/javascript')

  function readModule(url) {
    if (url.href === 'file:///foo.mjs') {
      return `import d from ${JSON.stringify(entry.href)} with { type: 'json' }`
    }

    return null
  }

  t.exception(() => expand(traverse(new URL('file:///foo.mjs'), readModule)), /TYPE_INCOMPATIBLE/)
})

test('data URL with type attribute disambiguating JavaScript', (t) => {
  const entry = dataURL('module.exports = 42', 'text/javascript')

  function readModule(url) {
    if (url.href === 'file:///foo.mjs') {
      return `import d from ${JSON.stringify(entry.href)} with { type: 'script' }`
    }

    return null
  }

  const result = expand(traverse(new URL('file:///foo.mjs'), readModule))

  const dependency = result.values.find((d) => d.url.href === entry.href)

  t.is(dependency.type, constants.SCRIPT)
})

function expand(iterable) {
  const iterator = iterable[Symbol.iterator]()
  const values = []

  let next = iterator.next()

  while (next.done !== true) {
    values.push(next.value)

    next = iterator.next()
  }

  return { values, return: next.value }
}

function dataURL(data, mediaType = 'text/javascript') {
  return new URL(`data:${mediaType},${encodeURIComponent(data)}`)
}

function base64DataURL(data, mediaType = 'text/javascript') {
  return new URL(`data:${mediaType};base64,${Buffer.from(data).toString('base64')}`)
}
