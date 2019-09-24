const fs = require('fs-extra')
/**
 * 本地文件系统
 */
class LocalFS {
    /**
     * 
     * @param {string} domain 
     * @param {*} param1 
     */
    constructor(domain, { fileConfig } = {}) {
        if (!fileConfig)
            fileConfig = require(process.cwd() + '/config/fs')

        if (typeof fileConfig.local !== 'object')
            throw new Error('没有提供文件系统配置信息(local)')

        if (typeof fileConfig.local.rootDir !== 'string')
            throw new Error('没有提供文件系统配置信息(local.rootDir)')

        if (typeof domain !== 'string' || domain.length === 0)
            throw new Error('没有提供文件起始存储位置')

        const appRootDir = fileConfig.local.rootDir.replace(/\/$/, '') // 如果有替换掉结尾的斜杠  
        domain = domain.replace(/^\/|\/$/g, '')

        let rootDir = `${appRootDir}/${domain}`
        if (!fs.existsSync(rootDir)) {
            throw new Error(`指定的文件系统起始路径(${rootDir})不存在`)
        }
        this.rootDir = rootDir
    }
    /**
     * 文件的完整路径
     *  
     * @param {string} filename 
     * @param {boolean} isRelative 
     */
    fullpath(filename, isRelative = true) {
        filename = filename.replace(/^\//, '')
        let fullpath = isRelative ? `${this.rootDir}/${filename}` : filename

        return fullpath
    }
    /**
     * 写文件，如果已存在覆盖现有文件
     * 
     * @param {string} filename 
     * @param {*} content 
     * @param {boolean} isRelative 
     */
    write(filename, content, isRelative = true) {
        // 文件的完整路径
        let fullpath = this.fullpath(filename, isRelative)

        /* 文件目录是否存在，不存在则创建，默认权限777 */
        let dirname = fullpath.replace(/\/[^/]*$/, '')
        fs.ensureDirSync(dirname, 0o2777)

        fs.writeFileSync(fullpath, content)

        return fullpath
    }
    /**
     * 删文件
     * 
     * @param {string} filename 
     * @param {*} isRelative 
     */
    remove(filename, isRelative = true) {
        let fullpath = this.fullpath(filename, isRelative)
        fs.removeSync(fullpath)
    }
}

module.exports = { LocalFS }