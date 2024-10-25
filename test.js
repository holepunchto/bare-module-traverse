const test = require('brittle')
const traverse = require('.')

const host = 'host'

test('require', (t) => {
  function readModule (url) {
    if (url.href === 'file:///foo.js') {
      return 'const bar = require(\'./bar.js\')'
    }

    if (url.href === 'file:///bar.js') {
      return 'const baz = require(\'./baz.js\')'
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
      source: 'const bar = require(\'./bar.js\')',
      imports: {
        './bar.js': 'file:///bar.js'
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: 'const baz = require(\'./baz.js\')',
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
  function readModule (url) {
    if (url.href === 'file:///foo.js') {
      return 'import \'./bar.js\''
    }

    if (url.href === 'file:///bar.js') {
      return 'import \'./baz.js\''
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
      source: 'import \'./bar.js\'',
      imports: {
        './bar.js': 'file:///bar.js'
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: 'import \'./baz.js\'',
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
  function readModule (url) {
    if (url.href === 'file:///foo.js') {
      return 'require(\'./bar.js\')'
    }

    if (url.href === 'file:///bar.js') {
      return 'require(\'./foo.js\')'
    }

    return null
  }

  const result = expand(traverse(new URL('file:///foo.js'), readModule))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: 'require(\'./bar.js\')',
      imports: {
        './bar.js': 'file:///bar.js'
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: 'require(\'./foo.js\')',
      imports: {
        './foo.js': 'file:///foo.js'
      }
    }
  ])
})

test('cyclic import', (t) => {
  function readModule (url) {
    if (url.href === 'file:///foo.js') {
      return 'import \'./bar.js\''
    }

    if (url.href === 'file:///bar.js') {
      return 'import \'./foo.js\''
    }

    return null
  }

  const result = expand(traverse(new URL('file:///foo.js'), readModule))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: 'import \'./bar.js\'',
      imports: {
        './bar.js': 'file:///bar.js'
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: 'import \'./foo.js\'',
      imports: {
        './foo.js': 'file:///foo.js'
      }
    }
  ])
})

test('require, module missing', (t) => {
  function readModule (url) {
    if (url.href === 'file:///foo.js') {
      return 'const bar = require(\'./bar.js\')'
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

test('require.addon', (t) => {
  function readModule (url) {
    if (url.href === 'file:///foo.js') {
      return 'const bar = require.addon(\'.\')'
    }

    if (url.href === 'file:///package.json') {
      return '{ "name": "foo" }'
    }

    if (url.href === 'file:///prebuilds/host/foo.bare') {
      return '<native code>'
    }

    return null
  }

  const result = expand(traverse(new URL('file:///foo.js'), { host, extensions: ['.bare'] }, readModule))

  t.alike(result.values, [
    {
      url: new URL('file:///foo.js'),
      source: 'const bar = require.addon(\'.\')',
      imports: {
        '#package': 'file:///package.json',
        '.': {
          addon: 'file:///prebuilds/host/foo.bare'
        }
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

  t.alike(result.return.addons, [
    new URL('file:///prebuilds/host/foo.bare')
  ])
})

test('require.asset', (t) => {
  function readModule (url) {
    if (url.href === 'file:///foo.js') {
      return 'const bar = require.asset(\'./bar.txt\')'
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
      source: 'const bar = require.asset(\'./bar.txt\')',
      imports: {
        './bar.txt': {
          asset: 'file:///bar.txt'
        }
      }
    },
    {
      url: new URL('file:///bar.txt'),
      source: 'hello world',
      imports: {}
    }
  ])

  t.alike(result.return.assets, [
    new URL('file:///bar.txt')
  ])
})

test('require + require.asset', (t) => {
  function readModule (url) {
    if (url.href === 'file:///foo.js') {
      return 'require(\'./bar.js\'), require.asset(\'./bar.js\')'
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
      source: 'require(\'./bar.js\'), require.asset(\'./bar.js\')',
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

  t.alike(result.return.assets, [
    new URL('file:///bar.js')
  ])
})

test('package.json#assets', (t) => {
  function readModule (url) {
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

  function listPrefix (url) {
    if (url.href === 'file:///bar/') {
      return [
        new URL('file:///bar/baz.txt')
      ]
    }

    return []
  }

  const result = expand(traverse(new URL('file:///foo.js'), readModule, listPrefix))

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
  function readModule (url) {
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

  function listPrefix (url) {
    if (url.href === 'file:///bar/') {
      return [
        new URL('file:///bar/baz.bin'),
        new URL('file:///bar/baz.txt')
      ]
    }

    return []
  }

  const result = expand(traverse(new URL('file:///foo.js'), readModule, listPrefix))

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
  function readModule (url) {
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

  function listPrefix (url) {
    if (url.href === 'file:///bar/') {
      return [
        new URL('file:///bar/baz.txt'),
        new URL('file:///bar/qux.txt')
      ]
    }

    if (url.href === 'file:///bar/qux.txt') {
      return [
        new URL('file:///bar/qux.txt')
      ]
    }

    return []
  }

  const result = expand(traverse(new URL('file:///foo.js'), readModule, listPrefix))

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

test('resolutions map', (t) => {
  function readModule (url) {
    if (url.href === 'file:///foo.js') {
      return 'const bar = require(\'./bar.js\')'
    }

    if (url.href === 'file:///bar.js') {
      return 'const baz = require(\'./baz.js\')'
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
      source: 'const bar = require(\'./bar.js\')',
      imports: {
        './bar.js': 'file:///bar.js'
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: 'const baz = require(\'./baz.js\')',
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
  function readModule (url) {
    if (url.href === 'file:///foo.js') {
      return 'const bar = require(\'./bar.js\')'
    }

    if (url.href === 'file:///bar.js') {
      return 'const baz = require(\'./baz.js\')'
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
      source: 'const bar = require(\'./bar.js\')',
      imports: {
        './bar.js': 'file:///bar.js'
      }
    },
    {
      url: new URL('file:///bar.js'),
      source: 'const baz = require(\'./baz.js\')',
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
  function readModule (url) {
    if (url.href === 'file:///foo.js') {
      return 'const bar = require(\'./bar.js\')'
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

function expand (iterable) {
  const iterator = iterable[Symbol.iterator]()
  const values = []

  let next = iterator.next()

  while (next.done !== true) {
    values.push(next.value)

    next = iterator.next()
  }

  return { values, return: next.value }
}
