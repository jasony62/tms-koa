const { Ctrl, ResultData } = require("../../lib/app")

class Main extends Ctrl {
    tmsRequireTransaction() {
        return {
            get: true
        }
    }
    get() {
        return new ResultData("I am an api.")
    }
}
module.exports = Main