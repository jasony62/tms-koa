import { customAlphabet } from 'nanoid'
import * as _ from 'lodash'
import * as PwdValidator from 'password-validator'
import * as Crypto from 'crypto'
import { AccountConfig } from '../config'

/**
 *
 */
export class PasswordValidator {
  pwd
  options
  config
  containProjects
  checkProjectsLength

  constructor(pwd, config, options = {}) {
    this.pwd = pwd
    this.options = options
    if (Object.prototype.toString.call(config) !== '[object Object]')
      config = {}
    this.config = {
      min: config.min ? config.min : 0, // 密码最小长度
      max: config.max ? config.max : 100, // 密码最大长度
      pwdBlack: Array.isArray(config.pwdBlack) ? config.pwdBlack : [], // 密码黑名单
      hasSpaces: config.hasSpaces ? true : false, // 是否包含空格
      hasAccount: config.hasAccount ? true : false, // 是否包含空格
      hasKeyBoardContinuousChar: config.hasKeyBoardContinuousChar
        ? true
        : false, // 是否包含键盘序字符
      hasKeyBoardContinuousCharSize: config.hasKeyBoardContinuousCharSize
        ? parseInt(config.hasKeyBoardContinuousCharSize)
        : 3, // 检查键盘序字符长度
      KeyBoardContinuousCharAlphabet:
        config.KeyBoardContinuousCharAlphabet ||
        '1234567890 qwertyuiop asdfghjkl zxcvbnm qaz wsx edc rfv tgb yhn ujm okm ijn uhb ygv tfc rdx esz', // 指定键盘序字符
      matchLowercaseAndUppercase: config.matchLowercaseAndUppercase
        ? true
        : false,
    }

    this.containProjects = []
    this.checkProjectsLength = 0
    // {mustCheckNum: 3, contains: ["digits", "uppercase", "lowercase", "symbols"]}
    if (
      Object.prototype.toString.call(config.containProjects) ===
        '[object Object]' &&
      Array.isArray(config.containProjects.contains) &&
      config.containProjects.contains.length > 0
    ) {
      this.containProjects = config.containProjects.contains
      if (
        config.containProjects.mustCheckNum &&
        new RegExp(/^[1-9]\d*$/).test(config.containProjects.mustCheckNum)
      )
        this.checkProjectsLength = config.containProjects.mustCheckNum
      else this.checkProjectsLength = this.containProjects.length
    }
  }

  // 校验密码
  validate() {
    const {
      min,
      max,
      pwdBlack,
      hasSpaces,
      hasAccount,
      hasKeyBoardContinuousChar,
      hasKeyBoardContinuousCharSize = 3,
      matchLowercaseAndUppercase,
    } = this.config

    const schema = new PwdValidator()
    schema.is().min(min).is().max(max)
    if (hasSpaces === false) schema.has().not().spaces()
    if (pwdBlack.length > 0) schema.is().not().oneOf(pwdBlack)
    if (schema.validate(this.pwd) === false)
      return [false, '密码长度错误或为风险密码']

    // 密码中不能包含账号
    if (hasAccount === false && this.options.account) {
      let account = this.options.account
      let reverseAccount = account.split('').reverse().join('')
      let pwd = this.pwd
      if (matchLowercaseAndUppercase === false) {
        account = account.toLowerCase()
        reverseAccount = reverseAccount.toLowerCase()
        pwd = pwd.toLowerCase()
      }
      if (pwd.includes(account) || pwd.includes(reverseAccount))
        return [false, '密码中不能包含账号']
    }
    // 密码中不能包含 n 位以上的连续键盘字符
    if (hasKeyBoardContinuousChar === false) {
      let pwd = this.pwd
      if (matchLowercaseAndUppercase === false) {
        pwd = pwd.toLowerCase()
      }
      let rst = this.isKeyBoardContinuousChar(
        pwd,
        hasKeyBoardContinuousCharSize
      )
      if (rst === true)
        return [
          false,
          `密码中不能包含连续${hasKeyBoardContinuousCharSize}位的键盘序字符`,
        ]
    }
    //
    if (this.containProjects) {
      let passNum = 0
      let msg = '密码中还缺少必备字符'
      for (const project of this.containProjects) {
        const schemaPj = new PwdValidator()
        schemaPj.has()[project]()
        if (schemaPj.validate(this.pwd) !== false) passNum++
        else {
          switch (project) {
            case 'digits':
              msg += '【数字】'
              break
            case 'uppercase':
              msg += '【大写字母】'
              break
            case 'lowercase':
              msg += '【小写字母】'
              break
            case 'symbols':
              msg += '【特殊字符】'
              break
            default:
              msg += `【${project}】`
              break
          }
        }
      }
      if (passNum < this.checkProjectsLength) {
        msg += ` 至少【${this.checkProjectsLength - passNum}】项`
        return [false, msg]
      }
    }

    return [true]
  }
  /**
   * 判断键盘连续字符
   */
  isKeyBoardContinuousChar(pwd, keyBoardSize = 3) {
    const keyBoardContinuousChar = this.config.KeyBoardContinuousCharAlphabet
    const reverseKeyBoardContinuousChar = keyBoardContinuousChar
      .split('')
      .reverse()
      .join('')

    for (let i = 0; i < pwd.length - keyBoardSize + 1; i++) {
      const pwdSizeChar = pwd.substr(i, keyBoardSize)
      if (
        keyBoardContinuousChar.indexOf(pwdSizeChar) !== -1 ||
        reverseKeyBoardContinuousChar.indexOf(pwdSizeChar) !== -1
      ) {
        return true
      }
    }
    return false
  }
}

const SALT = Symbol('salt')
const HASH = Symbol('hash')
const OPTIONS = Symbol('options')
/**
 *
 */
export class PasswordProcess {
  myPlaintextPassword

  constructor(myPlaintextPassword, salt = '', options = {}) {
    this.myPlaintextPassword = myPlaintextPassword
    this.salt = salt
    this.options = options
  }

  get hash() {
    if (!this[HASH]) this[HASH] = this.getPwdHash(this.myPlaintextPassword)

    return this[HASH]
  }

  get salt() {
    return this[SALT]
  }

  set salt(value) {
    this[SALT] = value
  }

  get options() {
    return this[OPTIONS]
  }

  set options(value) {
    this[OPTIONS] = value
  }

  getPwdHash(pwd) {
    if (!this.salt) throw '未找到加密密钥'
    return Crypto.createHash('sha256')
      .update(pwd + this.salt)
      .digest('hex')
  }

  compare(otherPlaintextPassword) {
    return this.hash === otherPlaintextPassword
  }

  static getSalt(length = 16) {
    const nanoid = customAlphabet(
      '0123456789qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM',
      length
    )
    return nanoid()
  }

  pwdStrengthCheck() {
    let pwdStrengthCheck = _.get(
      AccountConfig,
      'authConfig.pwdStrengthCheck',
      null
    )
    if (
      Object.prototype.toString.call(pwdStrengthCheck) !== '[object Object]' ||
      Object.keys(pwdStrengthCheck).length === 0
    )
      return [true]

    //
    const modelValidator = new PasswordValidator(
      this.myPlaintextPassword,
      pwdStrengthCheck,
      this.options
    )
    const rst = modelValidator.validate()

    return rst
  }
}

export default { PasswordProcess, PasswordValidator }
