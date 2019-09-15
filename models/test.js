const { DbModel } = require('../lib/model')
class Test extends DbModel {
    constructor() {
        super('test', { debug: true })
    }
}

function create() {
    return new Test()
}

module.exports = { Test, create }