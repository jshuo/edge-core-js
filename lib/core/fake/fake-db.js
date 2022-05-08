









import { verifyData } from '../../util/crypto/verify.js'

/**
 * A barcode-login lobby stored in the fake database.
 */
















/**
 * Emulates the Airbitz login server database.
 */
export class FakeDb {
  
  
  

  constructor() {
    this.lobbies = {}
    this.logins = []
    this.repos = {}
  }

  getLoginById(loginId) {
    return this.logins.find(login => verifyData(login.loginId, loginId))
  }

  getLoginByPin2Id(pin2Id) {
    return this.logins.find(
      login => login.pin2Id != null && verifyData(login.pin2Id, pin2Id)
    )
  }

  getLoginByRecovery2Id(recovery2Id) {
    return this.logins.find(
      login =>
        login.recovery2Id != null && verifyData(login.recovery2Id, recovery2Id)
    )
  }

  getLoginsByParent(parent) {
    return this.logins.filter(child => child.parentId === parent.loginId)
  }

  insertLogin(login) {
    this.logins.push(login)
  }

  // Dumping & restoration --------------------------------------------

  setupFakeUser(user) {
    const setupLogin = (dump) => {
      const { children, ...rest } = dump
      this.insertLogin(rest)
      for (const child of children) {
        child.parentId = dump.loginId
        setupLogin(child)
      }
    }
    setupLogin(user.server)

    // Create fake repos:
    for (const syncKey of Object.keys(user.repos)) {
      this.repos[syncKey] = { ...user.repos[syncKey] }
    }
  }

  dumpLogin(login) {
    const makeTree = (login) => ({
      ...login,
      children: this.getLoginsByParent(login).map(login => makeTree(login))
    })
    return makeTree(login)
  }
}

/**
 * Recursively builds up a login reply tree,
 * which the server sends back in response to a v2 login request.
 */
export function makeLoginPayload(db, login) {
  const children = db
    .getLoginsByParent(login)
    .map(child => makeLoginPayload(db, child))

  return {
    // Identity:
    appId: login.appId,
    created: login.created,
    loginId: login.loginId,

    // Nested logins:
    children,
    parentBox: login.parentBox,

    // Login methods:
    passwordAuthBox: login.passwordAuthBox,
    passwordAuthSnrp: login.passwordAuthSnrp,
    passwordBox: login.passwordBox,
    passwordKeySnrp: login.passwordKeySnrp,
    pin2Box: login.pin2Box,
    pin2KeyBox: login.pin2KeyBox,
    pin2TextBox: login.pin2TextBox,
    question2Box: login.question2Box,
    recovery2Box: login.recovery2Box,
    recovery2KeyBox: login.recovery2KeyBox,
    otpKey: login.otpKey,
    otpResetDate: login.otpResetDate,
    otpTimeout: login.otpTimeout,
    pendingVouchers: makePendingVouchers(login),
    loginAuthBox: login.loginAuthBox,

    // Resources:
    keyBoxes: login.keyBoxes,
    mnemonicBox: login.mnemonicBox,
    rootKeyBox: login.rootKeyBox,
    syncKeyBox: login.syncKeyBox
  }
}

export function makePendingVouchers(login) {
  return login.vouchers
    .filter(voucher => voucher.status === 'pending')
    .map(voucher => ({
      activates: voucher.activates,
      created: voucher.created,
      deviceDescription: voucher.deviceDescription,
      ip: voucher.ip,
      ipDescription: voucher.ipDescription,
      voucherId: voucher.voucherId
    }))
}
