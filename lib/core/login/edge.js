// 

import { asObject, asString } from 'cleaners'
import { bridgifyObject, close, update, watchMethod } from 'yaob'

import { asBase64 } from '../../types/server-cleaners.js'





import { makeAccount } from '../account/account-init.js'

import { makeLobby } from './lobby.js'
import { makeLoginTree, searchTree, syncLogin } from './login.js'
import { getStashById } from './login-selectors.js'
import { asLoginStash, saveStash } from './login-stash.js'







export const asLobbyLoginPayload = asObject({
  appId: asString,
  loginKey: asBase64,
  loginStash: asLoginStash
})

/**
 * Turns a reply into a logged-in account.
 */
async function unpackAccount(
  ai,
  payload,
  appId,
  opts
) {
  const { now = new Date() } = opts
  const { loginKey, loginStash: stashTree } = payload

  // Find the appropriate child:
  const child = searchTree(stashTree, stash => stash.appId === appId)
  if (child == null) {
    throw new Error(`Cannot find requested appId: "${appId}"`)
  }

  // Rescue any existing vouchers:
  try {
    const old = getStashById(ai, child.loginId)
    child.voucherId = old.stash.voucherId
    child.voucherAuth = old.stash.voucherAuth
  } catch (error) {}

  stashTree.lastLogin = now
  await saveStash(ai, stashTree)

  // This is almost guaranteed to blow up spectacularly:
  const loginTree = makeLoginTree(stashTree, loginKey, appId)
  const login = searchTree(loginTree, login => login.appId === appId)
  if (login == null) {
    throw new Error(`Cannot find requested appId: "${appId}"`)
  }
  const newLoginTree = await syncLogin(ai, loginTree, login)
  return await makeAccount(ai, appId, newLoginTree, 'edgeLogin', opts)
}

/**
 * Creates a new account request lobby on the server.
 */
export async function requestEdgeLogin(
  ai,
  appId,
  opts = {}
) {
  function handleError(error) {
    // Stop the long-polling:
    for (const cleanup of cleanups) cleanup()

    // Update the API:
    out.state = 'error'
    out.error = error
    update(out)
    close(out)
  }

  async function handleReply(reply) {
    // Stop the long-polling:
    for (const cleanup of cleanups) cleanup()

    // Decode the reply:
    const payload = asLobbyLoginPayload(reply)
    const { username } = payload.loginStash
    if (username == null) throw new Error('No username in reply')
    out.state = 'started'
    out.username = username
    update(out)

    // Log in:
    const account = await unpackAccount(ai, payload, appId, opts)
    out.state = 'done'
    out.account = account
    update(out)
    close(out)
  }

  async function cancelRequest() {
    // Stop the long-polling:
    for (const cleanup of cleanups) cleanup()

    // Update the API:
    out.state = 'closed'
    update(out)
    close(out)
  }

  const lobby = await makeLobby(ai, { loginRequest: { appId } })
  const cleanups = [
    lobby.close,
    lobby.on('error', handleError),
    lobby.on('reply', reply => {
      handleReply(reply).catch(handleError)
    })
  ]

  const out = {
    id: lobby.lobbyId,
    cancelRequest,
    watch: watchMethod,

    state: 'pending',
    account: undefined,
    error: undefined,
    username: undefined
  }
  return bridgifyObject(out)
}
