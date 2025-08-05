const test = require('brittle')
const traverse = require('.')

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
      imports: {
        './bar.js': 'file:///bar.js'
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: "const baz = require('./baz.js')",
      imports: {
        './baz.js': 'file:///baz.js'
      }
    },
    {
      url: new URL('file:///baz.js'),
      source: 'module.exports = 42',
      imports: {}
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
      imports: {
        './bar.js': 'file:///bar.js'
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: "import './baz.js'",
      imports: {
        './baz.js': 'file:///baz.js'
      }
    },
    {
      url: new URL('file:///baz.js'),
      source: 'export default 42',
      imports: {}
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
      imports: {
        './bar.js': 'file:///bar.js'
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: "require('./foo.js')",
      imports: {
        './foo.js': 'file:///foo.js'
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
      imports: {
        './bar.js': 'file:///bar.js'
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: "import './foo.js'",
      imports: {
        './foo.js': 'file:///foo.js'
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
      imports: {
        './bar.js': 'file:///bar.js'
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: 'module.exports = 42',
      imports: {}
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
    traverse(
      new URL('file:///foo.js'),
      { host, extensions: ['.bare'] },
      readModule
    )
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require.addon('.')",
      imports: {
        '#package': 'file:///package.json',
        '.': 'file:///prebuilds/host/foo.bare'
      }
    },
    {
      url: new URL('file:///prebuilds/host/foo.bare'),
      source: '<native code>',
      imports: {
        '#package': 'file:///package.json'
      }
    },
    {
      url: new URL('file:///package.json'),
      source: '{ "name": "foo" }',
      imports: {}
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
    traverse(
      new URL('file:///foo.js'),
      { host, extensions: ['.bare'] },
      readModule
    )
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require.addon('.', __filename)",
      imports: {
        '#package': 'file:///package.json',
        '.': 'file:///prebuilds/host/foo.bare'
      }
    },
    {
      url: new URL('file:///prebuilds/host/foo.bare'),
      source: '<native code>',
      imports: {
        '#package': 'file:///package.json'
      }
    },
    {
      url: new URL('file:///package.json'),
      source: '{ "name": "foo" }',
      imports: {}
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
    expand(
      traverse(
        new URL('file:///foo.js'),
        { host, extensions: ['.bare'] },
        readModule
      )
    )
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
    traverse(
      new URL('file:///foo.js'),
      { host, extensions: ['.bare'] },
      readModule
    )
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: 'const bar = require.addon()',
      imports: {
        '#package': 'file:///package.json',
        '.': 'file:///prebuilds/host/foo.bare'
      }
    },
    {
      url: new URL('file:///prebuilds/host/foo.bare'),
      source: '<native code>',
      imports: {
        '#package': 'file:///package.json'
      }
    },
    {
      url: new URL('file:///package.json'),
      source: '{ "name": "foo" }',
      imports: {}
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
      imports: {
        '#package': 'file:///package.json',
        '.': 'builtin:foo'
      }
    },
    {
      url: new URL('file:///package.json'),
      source: '{ "name": "foo" }',
      imports: {}
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
    traverse(
      new URL('file:///foo.js'),
      { host: 'darwin-arm64', extensions: ['.bare'] },
      readModule
    )
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require.addon('.')",
      imports: {
        '#package': 'file:///package.json',
        '.': 'linked:foo.framework/foo'
      }
    },
    {
      url: new URL('file:///package.json'),
      source: '{ "name": "foo" }',
      imports: {}
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
      imports: {
        '#package': 'file:///package.json',
        '.': {
          a: 'file:///prebuilds/host-a/foo.bare',
          b: 'file:///prebuilds/host-b/foo.bare'
        }
      }
    },
    {
      url: new URL('file:///prebuilds/host-b/foo.bare'),
      source: '<native code b>',
      imports: {
        '#package': 'file:///package.json'
      }
    },
    {
      url: new URL('file:///package.json'),
      source: '{ "name": "foo" }',
      imports: {}
    },
    {
      url: new URL('file:///prebuilds/host-a/foo.bare'),
      source: '<native code a>',
      imports: {
        '#package': 'file:///package.json'
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
      imports: {
        '#package': 'file:///package.json',
        '.': {
          a: {
            b: 'file:///prebuilds/host-a-b/foo.bare',
            default: 'file:///prebuilds/host-a/foo.bare'
          },
          default: 'file:///prebuilds/host/foo.bare'
        }
      }
    },
    {
      url: new URL('file:///prebuilds/host-a-b/foo.bare'),
      source: '<native code a b>',
      imports: {
        '#package': 'file:///package.json'
      }
    },
    {
      url: new URL('file:///package.json'),
      source: '{ "name": "foo" }',
      imports: {}
    },
    {
      url: new URL('file:///prebuilds/host-a/foo.bare'),
      source: '<native code a>',
      imports: {
        '#package': 'file:///package.json'
      }
    },
    {
      url: new URL('file:///prebuilds/host/foo.bare'),
      source: '<native code>',
      imports: {
        '#package': 'file:///package.json'
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
      imports: {
        '#package': 'file:///package.json',
        '.': {
          darwin: 'linked:foo.framework/foo',
          linux: 'linked:libfoo.so'
        }
      }
    },
    {
      url: new URL('file:///package.json'),
      source: '{ "name": "foo" }',
      imports: {}
    }
  ])

  t.alike(result.return.addons, [
    new URL('linked:foo.framework/foo'),
    new URL('linked:libfoo.so')
  ])
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
      imports: {
        './bar.txt': 'file:///bar.txt'
      }
    },
    {
      url: new URL('file:///bar.txt'),
      source: 'hello world',
      imports: {}
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
      imports: {
        './bar.txt': 'file:///bar.txt'
      }
    },
    {
      url: new URL('file:///bar.txt'),
      source: 'hello world',
      imports: {}
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
      imports: {
        './bar.js': 'file:///bar.js'
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: 'module.exports = 42',
      imports: {}
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

  const result = expand(
    traverse(new URL('file:///foo.js'), readModule, listPrefix)
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require.asset('./bar')",
      imports: {
        './bar': 'file:///bar'
      }
    },
    {
      url: new URL('file:///bar/b.txt'),
      source: 'hello b',
      imports: {}
    },
    {
      url: new URL('file:///bar/a.txt'),
      source: 'hello a',
      imports: {}
    }
  ])

  t.alike(result.return.assets, [
    new URL('file:///bar/a.txt'),
    new URL('file:///bar/b.txt')
  ])
})

test('package.json#addon', (t) => {
  function readModule(url) {
    if (url.href === 'file:///foo.js') {
      return ''
    }

    if (url.href === 'file:///package.json') {
      return '{ "name": "foo", "addon": true }'
    }

    if (url.href === 'file:///prebuilds/darwin-arm64/foo.bare') {
      return '<native code>'
    }

    if (url.href === 'file:///prebuilds/linux-arm64/foo.bare') {
      return '<native code>'
    }

    return null
  }

  function listPrefix(url) {
    if (url.href === 'file:///prebuilds/darwin-arm64/') {
      return [new URL('file:///prebuilds/darwin-arm64/foo.bare')]
    }

    if (url.href === 'file:///prebuilds/linux-arm64/') {
      return [new URL('file:///prebuilds/linux-arm64/foo.bare')]
    }

    return []
  }

  {
    const result = expand(
      traverse(
        new URL('file:///foo.js'),
        { host: 'darwin-arm64' },
        readModule,
        listPrefix
      )
    )

    t.alike(result.values, [
      {
        url: new URL('file:///foo.js'),
        source: '',
        imports: {
          '#package': 'file:///package.json'
        }
      },
      {
        url: new URL('file:///package.json'),
        source: '{ "name": "foo", "addon": true }',
        imports: {}
      },
      {
        url: new URL('file:///prebuilds/darwin-arm64/foo.bare'),
        source: '<native code>',
        imports: {
          '#package': 'file:///package.json'
        }
      }
    ])
  }
  {
    const result = expand(
      traverse(
        new URL('file:///foo.js'),
        { host: 'linux-arm64' },
        readModule,
        listPrefix
      )
    )

    t.alike(result.values, [
      {
        url: new URL('file:///foo.js'),
        source: '',
        imports: {
          '#package': 'file:///package.json'
        }
      },
      {
        url: new URL('file:///package.json'),
        source: '{ "name": "foo", "addon": true }',
        imports: {}
      },
      {
        url: new URL('file:///prebuilds/linux-arm64/foo.bare'),
        source: '<native code>',
        imports: {
          '#package': 'file:///package.json'
        }
      }
    ])
  }
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

  const result = expand(
    traverse(new URL('file:///foo.js'), readModule, listPrefix)
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: '',
      imports: {
        '#package': 'file:///package.json'
      }
    },
    {
      url: new URL('file:///package.json'),
      source: '{ "name": "foo", "assets": ["bar/"] }',
      imports: {}
    },
    {
      url: new URL('file:///bar/baz.txt'),
      source: 'hello world',
      imports: {
        '#package': 'file:///package.json'
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

  const result = expand(
    traverse(new URL('file:///foo.js'), readModule, listPrefix)
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: '',
      imports: {
        '#package': 'file:///package.json'
      }
    },
    {
      url: new URL('file:///package.json'),
      source: '{ "name": "foo", "assets": ["bar/*.txt"] }',
      imports: {}
    },
    {
      url: new URL('file:///bar/baz.txt'),
      source: 'hello world',
      imports: {
        '#package': 'file:///package.json'
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

    if (
      url.href === 'file:///bar/baz.txt' ||
      url.href === 'file:///bar/qux.txt'
    ) {
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

  const result = expand(
    traverse(new URL('file:///foo.js'), readModule, listPrefix)
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: '',
      imports: {
        '#package': 'file:///package.json'
      }
    },
    {
      url: new URL('file:///package.json'),
      source: '{ "name": "foo", "assets": ["bar/", "!bar/qux.txt"] }',
      imports: {}
    },
    {
      url: new URL('file:///bar/baz.txt'),
      source: 'hello world',
      imports: {
        '#package': 'file:///package.json'
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
      traverse(
        new URL('file:///foo.js'),
        { conditions: ['darwin'] },
        readModule,
        listPrefix
      )
    )

    t.alike(result.values, [
      {
        url: new URL('file:///foo.js'),
        source: '',
        imports: {
          '#package': 'file:///package.json'
        }
      },
      {
        url: new URL('file:///package.json'),
        source:
          '{ "name": "foo", "assets": [{ "darwin": "darwin/", "linux": "linux/" }] }',
        imports: {}
      },
      {
        url: new URL('file:///darwin/baz.txt'),
        source: 'hello darwin',
        imports: {
          '#package': 'file:///package.json'
        }
      }
    ])
  }
  {
    const result = expand(
      traverse(
        new URL('file:///foo.js'),
        { conditions: ['linux'] },
        readModule,
        listPrefix
      )
    )

    t.alike(result.values, [
      {
        url: new URL('file:///foo.js'),
        source: '',
        imports: {
          '#package': 'file:///package.json'
        }
      },
      {
        url: new URL('file:///package.json'),
        source:
          '{ "name": "foo", "assets": [{ "darwin": "darwin/", "linux": "linux/" }] }',
        imports: {}
      },
      {
        url: new URL('file:///linux/baz.txt'),
        source: 'hello linux',
        imports: {
          '#package': 'file:///package.json'
        }
      }
    ])
  }
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

  const result = expand(
    traverse(new URL('file:///foo.js'), { resolutions }, readModule)
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require('./bar.js')",
      imports: {
        './bar.js': 'file:///bar.js'
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: "const baz = require('./baz.js')",
      imports: {
        './baz.js': 'file:///baz.js'
      }
    },
    {
      url: new URL('file:///baz.js'),
      source: 'module.exports = 42',
      imports: {}
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

  const result = expand(
    traverse(new URL('file:///foo.js'), { resolutions }, readModule)
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require('./bar.js')",
      imports: {
        './bar.js': 'file:///bar.js'
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: "const baz = require('./baz.js')",
      imports: {
        './baz.js': 'file:///baz.js'
      }
    },
    {
      url: new URL('file:///baz.js'),
      source: 'module.exports = 42',
      imports: {}
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

  const result = expand(
    traverse(new URL('file:///foo.js'), { imports }, readModule)
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require('bar')",
      imports: {
        bar: 'file:///bar.js'
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: "const baz = require('baz')",
      imports: {
        baz: 'file:///baz.js'
      }
    },
    {
      url: new URL('file:///baz.js'),
      source: 'module.exports = 42',
      imports: {}
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

  const result = expand(
    traverse(new URL('file:///foo.js'), { imports, defer }, readModule)
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require('bar')",
      imports: {
        bar: 'file:///bar.js'
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: "const baz = require('baz')",
      imports: {
        baz: 'deferred:qux'
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
    traverse(
      new URL('file:///foo.js'),
      { conditions: [['a'], ['b']] },
      readModule
    )
  )

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: "const bar = require('#bar')",
      imports: {
        '#package': 'file:///package.json',
        '#bar': {
          a: 'file:///a.js',
          b: 'file:///b.js'
        }
      }
    },
    {
      url: new URL('file:///b.js'),
      source: "module.exports = 'b'",
      imports: {
        '#package': 'file:///package.json'
      }
    },
    {
      url: new URL('file:///package.json'),
      source:
        '{ "name": "foo", "imports": { "#bar": { "a": "./a.js", "b": "./b.js", "c": "./c.js" } } }',
      imports: {}
    },
    {
      url: new URL('file:///a.js'),
      source: "module.exports = 'a'",
      imports: {
        '#package': 'file:///package.json'
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
      source:
        "const bar = require('./bar.js', { with: { imports: './imports.json' } })",
      imports: {
        './bar.js': 'file:///bar.js',
        './imports.json': 'file:///imports.json'
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: "const baz = require('baz')",
      imports: {
        baz: 'file:///baz.js'
      }
    },
    {
      url: new URL('file:///baz.js'),
      source: 'module.exports = 42',
      imports: {}
    },
    {
      url: new URL('file:///imports.json'),
      source: '{ "baz": "/baz.js" }',
      imports: {}
    }
  ])
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
