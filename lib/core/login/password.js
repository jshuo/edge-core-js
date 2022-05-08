// 

import { uncleaner } from 'cleaners'

import { asChangePasswordPayload } from '../../types/server-cleaners.js'

import { decrypt, encrypt } from '../../util/crypto/crypto.js'

import { makeSnrp, scrypt, userIdSnrp } from '../scrypt/scrypt-selectors.js'
import { applyKit, makeLoginTree, serverLogin, syncLogin } from './login.js'
import { fixUsername, getStash, hashUsername } from './login-selectors.js'
import { saveStash } from './login-stash.js'


const wasChangePasswordPayload = uncleaner(asChangePasswordPayload)
const passwordAuthSnrp = userIdSnrp

function makeHashInput(username, password) {
  return fixUsername(username) + password
}

/**
 * Extracts the loginKey from the login stash.
 */
async function loginPasswordOffline(
  ai,
  username,
  password,
  opts
) {
  const { now = new Date() } = opts
  const stashTree = getStash(ai, username)

  const { passwordBox, passwordKeySnrp } = stashTree
  if (passwordBox == null || passwordKeySnrp == null) {
    throw new Error('Missing data for offline password login')
  }
  const up = makeHashInput(username, password)
  const passwordKey = await scrypt(ai, up, passwordKeySnrp)
  const loginKey = decrypt(passwordBox, passwordKey)
  const loginTree = makeLoginTree(stashTree, loginKey)
  stashTree.lastLogin = now
  saveStash(ai, stashTree).catch(() => {})

  // Since we logged in offline, update the stash in the background:
  // TODO: If the user provides an OTP token, add that to the stash.
  const { log } = ai.props
  syncLogin(ai, loginTree, loginTree).catch(e => log.error(e))

  return loginTree
}

/**
 * Fetches the loginKey from the server.
 */
async function loginPasswordOnline(
  ai,
  username,
  password,
  opts
) {
  const stashTree = getStash(ai, username)

  // Request:
  const up = makeHashInput(username, password)
  const [userId, passwordAuth] = await Promise.all([
    hashUsername(ai, username),
    scrypt(ai, up, passwordAuthSnrp)
  ])
  const request = {
    userId,
    passwordAuth
  }
  return serverLogin(ai, stashTree, stashTree, opts, request, async reply => {
    const { passwordBox, passwordKeySnrp } = reply
    if (passwordBox == null || passwordKeySnrp == null) {
      throw new Error('Missing data for online password login')
    }
    const passwordKey = await scrypt(ai, up, passwordKeySnrp)
    return decrypt(passwordBox, passwordKey)
  })
}

/**
 * Logs a user in using a password.
 * @param username string
 * @param password string
 * @return A `Promise` for the new root login.
 */
export async function loginPassword(
  ai,
  username,
  password,
  opts
) {
  return loginPasswordOffline(ai, username, password, opts).catch(() =>
    loginPasswordOnline(ai, username, password, opts)
  )
}

export async function changePassword(
  ai,
  accountId,
  password
) {
  const { loginTree, username } = ai.props.state.accounts[accountId]

  const kit = await makePasswordKit(ai, loginTree, username, password)
  await applyKit(ai, loginTree, kit)
}

/**
 * Returns true if the given password is correct.
 */
export async function checkPassword(
  ai,
  login,
  password
) {
  const { username, passwordAuth } = login
  if (username == null || passwordAuth == null) return false

  // Derive passwordAuth:
  const up = makeHashInput(username, password)
  const newPasswordAuth = await scrypt(ai, up, passwordAuthSnrp)

  // Compare what we derived with what we have:
  for (let i = 0; i < passwordAuth.length; ++i) {
    if (newPasswordAuth[i] !== passwordAuth[i]) return false
  }

  return true
}

export async function deletePassword(
  ai,
  accountId
) {
  const { loginTree } = ai.props.state.accounts[accountId]

  const kit = {
    serverMethod: 'DELETE',
    serverPath: '/v2/login/password',
    stash: {
      passwordAuthSnrp: undefined,
      passwordBox: undefined,
      passwordKeySnrp: undefined
    },
    login: {
      passwordAuth: undefined
    },
    loginId: loginTree.loginId
  }
  // Only remove `passwordAuth` if we have another way to get in:
  if (loginTree.loginAuth != null) {
    kit.stash.passwordAuthBox = undefined
    kit.login.passwordAuth = undefined
  }
  await applyKit(ai, loginTree, kit)
}

/**
 * Creates the data needed to attach a password to a login.
 */
export function makePasswordKit(
  ai,
  login,
  username,
  password
) {
  const up = makeHashInput(username, password)
  const { io } = ai.props

  // loginKey chain:
  const boxPromise = makeSnrp(ai).then(passwordKeySnrp => {
    return scrypt(ai, up, passwordKeySnrp).then(passwordKey => {
      const passwordBox = encrypt(io, login.loginKey, passwordKey)
      return { passwordKeySnrp, passwordBox }
    })
  })

  // authKey chain:
  const authPromise = scrypt(ai, up, passwordAuthSnrp).then(passwordAuth => {
    const passwordAuthBox = encrypt(io, passwordAuth, login.loginKey)
    return { passwordAuth, passwordAuthBox }
  })

  return Promise.all([boxPromise, authPromise]).then(values => {
    const [
      { passwordKeySnrp, passwordBox },
      { passwordAuth, passwordAuthBox }
    ] = values

    return {
      serverPath: '/v2/login/password',
      server: wasChangePasswordPayload({
        passwordAuth,
        passwordAuthSnrp, // TODO: Use this on the other side
        passwordKeySnrp,
        passwordBox,
        passwordAuthBox
      }),
      stash: {
        passwordKeySnrp,
        passwordBox,
        passwordAuthBox
      },
      login: {
        passwordAuth
      },
      loginId: login.loginId
    }
  })
}
