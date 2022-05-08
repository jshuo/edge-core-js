// 

import { base64 } from 'rfc4648'


import { makeCreateKit } from '../login/create.js'
import {
  findFirstKey,
  makeAccountType,
  makeKeysKit,
  makeStorageKeyInfo
} from '../login/keys.js'
import { applyKit, searchTree } from '../login/login.js'







function checkLogin(login) {
  if (login == null || login.loginKey == null) {
    throw new Error('Incomplete login')
  }
}

export function findAppLogin(loginTree, appId) {
  const out = searchTree(loginTree, login => login.appId === appId)
  if (!out) throw new Error(`Internal error: cannot find login for ${appId}`)
  return out
}

/**
 * Creates a child login under the provided login, with the given appId.
 */
async function createChildLogin(
  ai,
  loginTree,
  login,
  appId,
  wantRepo = true
) {
  const { username } = loginTree
  checkLogin(login)
  if (username == null) throw new Error('Cannot create child: missing username')

  const opts = { pin: loginTree.pin }
  if (wantRepo) {
    opts.keyInfo = makeStorageKeyInfo(ai, makeAccountType(appId))
  }
  const kit = await makeCreateKit(ai, login, appId, username, opts)
  const parentKit = {
    serverPath: kit.serverPath,
    server: kit.server,
    login: { children: [kit.login] },
    stash: { children: [kit.stash] },
    loginId: login.loginId
  }
  return applyKit(ai, loginTree, parentKit)
}

/**
 * Ensures that the loginTree contains an account for the specified appId.
 * @return A `Promise`, which will resolve to a loginTree that does have
 * the requested account.
 */
export async function ensureAccountExists(
  ai,
  loginTree,
  appId
) {
  const accountType = makeAccountType(appId)

  // If there is no app login, make that:
  const login = searchTree(loginTree, login => login.appId === appId)
  if (login == null) {
    return createChildLogin(ai, loginTree, loginTree, appId, true)
  }

  // Otherwise, make the repo:
  if (findFirstKey(login.keyInfos, accountType) == null) {
    checkLogin(login)
    const keyInfo = makeStorageKeyInfo(ai, accountType)
    const keysKit = makeKeysKit(ai, login, keyInfo)
    return applyKit(ai, loginTree, keysKit)
  }

  // Everything is fine, so do nothing:
  return loginTree
}

/**
 * Creates an `EdgeAccount` API object.
 */
export async function makeAccount(
  ai,
  appId,
  loginTree,
  loginType,
  opts
) {
  const { pauseWallets = false } = opts
  const { log } = ai.props
  log.warn(
    `Login: decrypted keys for user ${base64.stringify(loginTree.loginId)}`
  )

  loginTree = await ensureAccountExists(ai, loginTree, appId)
  log.warn('Login: account exists for appId')
  const { username } = loginTree
  if (username == null) throw new Error('Cannot log in: missing username')

  // Add the login to redux:
  const rootLogin = loginTree.loginKey != null
  ai.props.dispatch({
    type: 'LOGIN',
    payload: {
      appId,
      username,
      loginKey: rootLogin
        ? loginTree.loginKey
        : findAppLogin(loginTree, appId).loginKey,
      pauseWallets,
      rootLogin,
      loginType
    }
  })

  return waitForAccount(ai, ai.props.state.lastAccountId)
}

/**
 * Waits for the account API to appear and returns it.
 */
export function waitForAccount(
  ai,
  accountId
) {
  const out = ai.waitFor(
    (props) => {
      const accountState = props.state.accounts[accountId]
      if (accountState.loadFailure != null) throw accountState.loadFailure

      const accountOutput = props.output.accounts[accountId]
      if (accountOutput != null && accountOutput.accountApi != null) {
        return accountOutput.accountApi
      }
    }
  )
  return out
}
