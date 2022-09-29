/**
 * 存储在配置文件中的账号
 */
class FileModel {
  accounts

  constructor(accounts) {
    this.accounts = accounts
  }
  list() {
    return { accounts: this.accounts, total: this.accounts.length }
  }
  create(newAccount) {
    let maxId = this.accounts.reduce((maxId, account) => {
      return account.id > maxId ? account.id : maxId
    }, 0)
    newAccount.id = maxId + 1
    this.accounts.push(newAccount)
    return Promise.resolve(newAccount)
  }
  processAndCreate(newAccount) {
    const found = this.accounts.find(
      (account) => account.username === newAccount.username
    )
    if (found) {
      return Promise.reject('账号已存在')
    }
    return this.create(newAccount)
  }
  forbid(id) {
    const found = this.accounts.find((account) => (account.id = id))
    if (found) {
      found.forbidden = true
      return true
    }
    return false
  }
  unforbid(id) {
    const found = this.accounts.find((account) => (account.id = id))
    if (found) {
      found.forbidden = false
      return true
    }
    return false
  }

  authenticate(username, password) {
    /**配置文件存储账号 */
    const found = this.accounts.find(
      (account) =>
        account.username === username && account.password === password
    )

    return [!!found, found]
  }
}

export { FileModel }
