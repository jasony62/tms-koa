const fs = require('fs-extra')
const path = require('path')
jest.mock('fs-extra')
const { LocalFS } = require('@/lib/model/fs/local')

describe('#model-file', function() {
  it('构造本地文件系统对象', () => {
    let fileConfig = {}
    try {
      new LocalFS('jest', '')
    } catch (e) {
      expect(e.message).toBe('没有提供文件系统配置信息(local)')
    }
    fileConfig.local = {}
    try {
      new LocalFS('jest', '')
    } catch (e) {
      expect(e.message).toBe('没有提供文件系统配置信息(local.rootDir)')
    }
    fileConfig.local = { rootDir: 'tests' }
    try {
      new LocalFS('', '')
    } catch (e) {
      expect(e.message).toBe('没有提供文件起始存储位置')
    }
    try {
      new LocalFS('jest', '')
    } catch (e) {
      expect(e.message).toBe('指定的文件系统起始路径(tests/jest)不存在')
    }
    fs.existsSync.mockReturnValue(false)
    try {
      new LocalFS('/jest/', '')
    } catch (e) {
      expect(e.message).toBe('指定的文件系统起始路径(tests/jest)不存在')
    }
  })
  it('写文件', () => {
    fs.existsSync.mockReturnValue(true)
    //const fileConfig = { local: { rootDir: 'tests' } }
    let localFS = new LocalFS('lib/model/file', '')
    let fullpath = localFS.write('tms-koa.txt', 'hello tms-koa')
    expect(fullpath).toBe('tests/lib/model/file/tms-koa.txt')
    expect(fs.ensureDirSync).toHaveBeenCalled()
    expect(fs.ensureDirSync.mock.calls[0][0]).toBe('tests/lib/model/file')
    expect(fs.writeFileSync).toHaveBeenCalled()
    expect(fs.writeFileSync.mock.calls[0][0]).toBe(
      'tests/lib/model/file/tms-koa.txt'
    )
    expect(fs.writeFileSync.mock.calls[0][1]).toBe('hello tms-koa')
  })
  it('删文件', () => {
    fs.existsSync.mockReturnValue(true)
    const fileConfig = { local: { rootDir: 'tests' } }
    let localFS = new LocalFS('lib/model/file', '')
    localFS.remove('tms-koa.txt')
    expect(fs.removeSync).toHaveBeenCalled()
    expect(fs.removeSync.mock.calls[0][0]).toBe(
      'tests/lib/model/file/tms-koa.txt'
    )
  })
  it('文件列表', () => {
    const fileConfig = { local: { rootDir: 'tests' } }
    let localFS = new LocalFS('lib/model/fs', '')
    fs.readdirSync.mockReturnValue([])
    localFS.list()
    expect(fs.readdirSync.mock.calls).toHaveLength(1)
    expect(fs.readdirSync.mock.calls[0][0]).toBe(
      path.resolve('tests/lib/model/fs')
    )
  })
})
