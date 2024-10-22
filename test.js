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
      url: new URL('file:///baz.js'),
      imports: {}
    },
    {
      url: new URL('file:///bar.js'),
      imports: {
        './baz.js': 'file:///baz.js'
      }
    },
    {
      url: new URL('file:///foo.js'),
      imports: {
        './bar.js': 'file:///bar.js'
      }
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
      url: new URL('file:///baz.js'),
      imports: {}
    },
    {
      url: new URL('file:///bar.js'),
      imports: {
        './baz.js': 'file:///baz.js'
      }
    },
    {
      url: new URL('file:///foo.js'),
      imports: {
        './bar.js': 'file:///bar.js'
      }
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
      url: new URL('file:///bar.js'),
      imports: {
        './foo.js': 'file:///foo.js'
      }
    },
    {
      url: new URL('file:///foo.js'),
      imports: {
        './bar.js': 'file:///bar.js'
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
      url: new URL('file:///bar.js'),
      imports: {
        './foo.js': 'file:///foo.js'
      }
    },
    {
      url: new URL('file:///foo.js'),
      imports: {
        './bar.js': 'file:///bar.js'
      }
    }
  ])
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
      url: new URL('file:///package.json'),
      imports: {}
    },
    {
      url: new URL('file:///prebuilds/host/foo.bare'),
      imports: {
        '#package': 'file:///package.json'
      }
    },
    {
      url: new URL('file:///foo.js'),
      imports: {
        '#package': 'file:///package.json',
        '.': {
          addon: 'file:///prebuilds/host/foo.bare'
        }
      }
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
      url: new URL('file:///bar.txt'),
      imports: {}
    },
    {
      url: new URL('file:///foo.js'),
      imports: {
        './bar.txt': {
          asset: 'file:///bar.txt'
        }
      }
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
      url: new URL('file:///bar.js'),
      imports: {}
    },
    {
      url: new URL('file:///foo.js'),
      imports: {
        './bar.js': 'file:///bar.js'
      }
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
      url: new URL('file:///package.json'),
      imports: {}
    },
    {
      url: new URL('file:///bar/baz.txt'),
      imports: {
        '#package': 'file:///package.json'
      }
    },
    {
      url: new URL('file:///foo.js'),
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
      url: new URL('file:///package.json'),
      imports: {}
    },
    {
      url: new URL('file:///bar/baz.txt'),
      imports: {
        '#package': 'file:///package.json'
      }
    },
    {
      url: new URL('file:///foo.js'),
      imports: {
        '#package': 'file:///package.json'
      }
    }
  ])
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
