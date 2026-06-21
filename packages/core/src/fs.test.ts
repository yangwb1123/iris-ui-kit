import { describe, it, expect } from 'vitest'
import { createVirtualFs, normalizePath } from './fs'

describe('normalizePath', () => {
  it('makes paths absolute, collapses slashes, drops trailing slash', () => {
    expect(normalizePath('Documents/note.txt')).toBe('/Documents/note.txt')
    expect(normalizePath('/Documents//a/')).toBe('/Documents/a')
    expect(normalizePath('/')).toBe('/')
    expect(normalizePath('')).toBe('/')
  })
})

describe('createVirtualFs', () => {
  it('writes + reads files; root is never a file', () => {
    const fs = createVirtualFs()
    fs.write('/a.txt', 'hello')
    expect(fs.read('/a.txt')).toBe('hello')
    fs.write('a.txt', 'world') // normalizes to /a.txt → overwrite
    expect(fs.read('/a.txt')).toBe('world')
    fs.write('/', 'nope')
    expect(fs.read('/')).toBeUndefined()
  })

  it('lists immediate children: implied folders (from file paths) first, then files, each sorted', () => {
    const fs = createVirtualFs()
    fs.write('/Documents/note.txt', 'n')
    fs.write('/Documents/todo.md', 't')
    fs.write('/readme.txt', 'r')
    fs.mkdir('/Pictures') // empty folder persists
    const root = fs.list('/')
    expect(root.map((e) => `${e.type}:${e.name}`)).toEqual([
      'folder:Documents',
      'folder:Pictures',
      'file:readme.txt',
    ])
    expect(fs.list('/Documents').map((e) => e.name)).toEqual(['note.txt', 'todo.md'])
  })

  it('exists for files and (implied + explicit) directories', () => {
    const fs = createVirtualFs()
    fs.write('/Documents/note.txt', 'n')
    expect(fs.exists('/Documents/note.txt')).toBe(true)
    expect(fs.exists('/Documents')).toBe(true) // implied
    expect(fs.exists('/')).toBe(true)
    expect(fs.exists('/missing')).toBe(false)
  })

  it('remove deletes a file, or a folder and its whole subtree', () => {
    const fs = createVirtualFs()
    fs.write('/Documents/a.txt', 'a')
    fs.write('/Documents/sub/b.txt', 'b')
    fs.write('/keep.txt', 'k')
    fs.remove('/Documents')
    expect(fs.read('/Documents/a.txt')).toBeUndefined()
    expect(fs.read('/Documents/sub/b.txt')).toBeUndefined()
    expect(fs.exists('/Documents')).toBe(false)
    expect(fs.read('/keep.txt')).toBe('k')
  })

  it('rename moves a file, and re-prefixes a whole folder subtree', () => {
    const fs = createVirtualFs()
    fs.write('/Documents/a.txt', 'a')
    fs.write('/Documents/sub/b.txt', 'b')
    fs.rename('/Documents/a.txt', '/Documents/renamed.txt')
    expect(fs.read('/Documents/renamed.txt')).toBe('a')
    expect(fs.read('/Documents/a.txt')).toBeUndefined()
    fs.rename('/Documents', '/Docs')
    expect(fs.read('/Docs/renamed.txt')).toBe('a')
    expect(fs.read('/Docs/sub/b.txt')).toBe('b')
    expect(fs.exists('/Documents')).toBe(false)
  })

  it('seeds from initial state + notifies subscribers on change', () => {
    const fs = createVirtualFs({ initial: { files: { '/seed.txt': 's' }, folders: ['/Empty'] } })
    expect(fs.read('/seed.txt')).toBe('s')
    expect(fs.exists('/Empty')).toBe(true)
    let calls = 0
    const off = fs.subscribe(() => (calls += 1))
    fs.write('/x.txt', 'x')
    off()
    fs.write('/y.txt', 'y')
    expect(calls).toBe(1)
  })
})
