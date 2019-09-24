const { Captcha } = require("../lib/app")
/**
 * 获取换取access_token的验证信息
 */
module.exports = function(ctx) {
    let veri = new Captcha()

    veri.code = '4321'

    return veri
}