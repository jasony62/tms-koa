import * as CryptoJS from "crypto-js"

type returnType = [
  boolean,
  string
]

type accountInfoType = {
  username: string,
  password: string,
  adc?: any
}

type returnAccountType = [
  boolean,
  accountInfoType | string
]

type ctxType = {
  [key: string]: any
}

/**
 * 加密
 */
class Encrypt {
  /**
   * AES 加密
   * @returns returnType
   */
  v1(text: string, key: string): returnType {
    if (key.length !== 16) 
      return [false, "秘钥长度不足16位"]

    key = CryptoJS.enc.Utf8.parse(key); // 十六位十六进制数作为密钥
    let rst = CryptoJS.AES.encrypt(text, key, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7
    })

    return [true, rst.toString()]
  }
  /**
   * base64 编码
   * @returns returnType
   */
  v2(text: string): returnType {
    let buff = Buffer.from(text)
    return [ true, buff.toString('base64') ]
  }
}
/**
 * 解密
 */
class Decrypt {
  /**
   * AES 解密
   * @returns returnType
   */
  v1(text: string, key: string): returnType {
    if (key.length !== 16) 
      return [false, "秘钥长度不足16位"]

    key = CryptoJS.enc.Utf8.parse(key); // 十六位十六进制数作为密钥
    let rst = CryptoJS.AES.decrypt(text, key, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7
    })

    return [true, rst.toString(CryptoJS.enc.Utf8)]
  }
  /**
   * base64 解码
   * @returns returnType
   */
  v2(text: string): returnType {
    let buff = Buffer.from(text, 'base64')
    return [ true, buff.toString('utf-8') ]
  }
}


export class Crypto {
  static encrypt: Encrypt = new Encrypt
  static decrypt: Decrypt = new Decrypt
}

export function encodeAccountV1(accountInfo: accountInfoType): returnAccountType {
  let username: string = accountInfo.username
  let password: string = accountInfo.password
  let key: string = accountInfo.adc || "12345678910ADc,."
  
  let unRst = Crypto.encrypt.v1(username, key)
  if (unRst[0] === false) return [false, unRst[1]]
  else username = unRst[1]
  
  let pwdRst = Crypto.encrypt.v1(password, key)
  if (pwdRst[0] === false) return [false, pwdRst[1]]
  else password = pwdRst[1]

    return [true, { username, password }]
}

export function decodeAccountV1(ctx: ctxType): returnAccountType {
  let username: string = ctx.request.body.username
  let password: string = ctx.request.body.password
  let key: string = 
    ctx.request.query.adc || 
    ctx.request.body.adc || 
    "12345678910ADc,."

  let unRst = Crypto.decrypt.v1(username, key)
  if (unRst[0] === false) return [false, unRst[1]]
  else username = unRst[1]
  let pwdRst = Crypto.decrypt.v1(password, key)
  if (pwdRst[0] === false) return [false, pwdRst[1]]
  else password = pwdRst[1]

  return [true, { username, password }]
}