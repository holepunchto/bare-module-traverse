const test = require('brittle')
const traverse = require('.')

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
    { url: new URL('file:///bar.js') },
    { url: new URL('file:///baz.js') }
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
    { url: new URL('file:///bar.js') },
    { url: new URL('file:///baz.js') }
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
    { url: new URL('file:///bar.js') }
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
    { url: new URL('file:///bar.js') }
  ])
})
