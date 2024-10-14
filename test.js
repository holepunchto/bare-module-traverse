const test = require('brittle')
const traverse = require('.')

const { MODULE, ADDON, ASSET } = traverse.constants

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

  const result = []

  for (const dependency of traverse(new URL('file:///foo.js'), readModule)) {
    result.push(dependency)
  }

  t.alike(result, [
    {
      url: new URL('file:///baz.js'),
      type: MODULE,
      imports: {}
    },
    {
      url: new URL('file:///bar.js'),
      type: MODULE,
      imports: {
        './baz.js': 'file:///baz.js'
      }
    },
    {
      url: new URL('file:///foo.js'),
      type: MODULE,
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

  const result = []

  for (const dependency of traverse(new URL('file:///foo.js'), readModule)) {
    result.push(dependency)
  }

  t.alike(result, [
    {
      url: new URL('file:///baz.js'),
      type: MODULE,
      imports: {}
    },
    {
      url: new URL('file:///bar.js'),
      type: MODULE,
      imports: {
        './baz.js': 'file:///baz.js'
      }
    },
    {
      url: new URL('file:///foo.js'),
      type: MODULE,
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

  const result = []

  for (const dependency of traverse(new URL('file:///foo.js'), readModule)) {
    result.push(dependency)
  }

  t.alike(result, [
    {
      url: new URL('file:///bar.js'),
      type: MODULE,
      imports: {
        './foo.js': 'file:///foo.js'
      }
    },
    {
      url: new URL('file:///foo.js'),
      type: MODULE,
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

  const result = []

  for (const dependency of traverse(new URL('file:///foo.js'), readModule)) {
    result.push(dependency)
  }

  t.alike(result, [
    {
      url: new URL('file:///bar.js'),
      type: MODULE,
      imports: {
        './foo.js': 'file:///foo.js'
      }
    },
    {
      url: new URL('file:///foo.js'),
      type: MODULE,
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

  const result = []

  for (const dependency of traverse(new URL('file:///foo.js'), { host, extensions: ['.bare'] }, readModule)) {
    result.push(dependency)
  }

  t.alike(result, [
    {
      url: new URL('file:///package.json'),
      type: MODULE,
      imports: {}
    },
    {
      url: new URL('file:///prebuilds/host/foo.bare'),
      type: ADDON,
      imports: {}
    },
    {
      url: new URL('file:///foo.js'),
      type: MODULE,
      imports: {
        '#package': 'file:///package.json',
        '.': {
          addon: 'file:///prebuilds/host/foo.bare'
        }
      }
    }
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

  const result = []

  for (const dependency of traverse(new URL('file:///foo.js'), readModule)) {
    result.push(dependency)
  }

  t.alike(result, [
    {
      url: new URL('file:///bar.txt'),
      type: ASSET,
      imports: {}
    },
    {
      url: new URL('file:///foo.js'),
      type: MODULE,
      imports: {
        './bar.txt': {
          asset: 'file:///bar.txt'
        }
      }
    }
  ])
})
