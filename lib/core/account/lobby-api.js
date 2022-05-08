// 

import { uncleaner } from 'cleaners'
import { bridgifyObject } from 'yaob'







import { asLobbyLoginPayload } from '../login/edge.js'
import { fetchLobbyRequest, sendLobbyReply } from '../login/lobby.js'
import { sanitizeLoginStash, syncAccount } from '../login/login.js'
import { getStashById } from '../login/login-selectors.js'

import { ensureAccountExists, findAppLogin } from './account-init.js'

const wasLobbyLoginPayload = uncleaner(asLobbyLoginPayload)






const infoServerUri = 'https://info1.edge.app'

/**
 * Translate an appId into a user-presentable icon and string.
 */
export async function fetchAppIdInfo(
  ai,
  appId
) {
  try {
    const url = `${infoServerUri}/v1/appIdInfo/${appId}`
    const response = await ai.props.io.fetch(url)
    if (!response.ok) {
      throw new Error(`Fetching ${url} returned ${response.status}`)
    }

    const { appName, imageUrl } = await response.json()
    if (!appName) throw new Error(`No appName in appId lookup response.`)

    return { displayImageUrl: imageUrl, displayName: appName }
  } catch (e) {
    ai.props.onError(e)

    // If we can't find the info, just show the appId as a fallback:
    return { displayName: appId }
  }
}

/**
 * Performs an edge login, approving the request in the provided lobby JSON.
 */
async function approveLoginRequest(
  ai,
  accountId,
  appId,
  lobbyId,
  lobbyJson
) {
  const { loginTree } = ai.props.state.accounts[accountId]

  // Ensure that the login object & account repo exist:
  await syncAccount(ai, accountId)

  const newLoginTree = await ensureAccountExists(ai, loginTree, appId)
  const requestedLogin = findAppLogin(newLoginTree, appId)
  if (!requestedLogin) {
    throw new Error('Failed to create the requested login object')
  }

  // Create a sanitized login stash object:
  const { stashTree } = getStashById(ai, loginTree.loginId)
  const loginStash = sanitizeLoginStash(stashTree, appId)

  // Send the reply:
  const replyData = wasLobbyLoginPayload({
    appId,
    loginKey: requestedLogin.loginKey,
    loginStash
  })
  await sendLobbyReply(ai, lobbyId, lobbyJson, replyData).then(() => {
    let timeout
    const accountApi = ai.props.output.accounts[accountId].accountApi
    if (accountApi != null) {
      accountApi.on('close', () => {
        if (timeout != null) clearTimeout(timeout)
      })
    }

    timeout = setTimeout(() => {
      timeout = undefined
      syncAccount(ai, accountId)
        .then(() => {
          timeout = setTimeout(() => {
            timeout = undefined
            syncAccount(ai, accountId).catch(e => ai.props.onError(e))
          }, 20000)
        })
        .catch(e => ai.props.onError(e))
    }, 10000)
  })
}

/**
 * Fetches the contents of a lobby and returns them as an EdgeLobby API.
 */
export async function makeLobbyApi(
  ai,
  accountId,
  lobbyId
) {
  // Look up the lobby on the server:
  const lobbyJson = await fetchLobbyRequest(ai, lobbyId)

  // If the lobby has a login request, set up that API:
  let loginRequest
  if (lobbyJson.loginRequest != null) {
    const { appId } = lobbyJson.loginRequest
    if (typeof appId !== 'string') throw new TypeError('Invalid login request')
    const { displayName, displayImageUrl } = await fetchAppIdInfo(ai, appId)

    // Make the API:
    loginRequest = {
      appId,
      displayName,
      displayImageUrl,
      approve() {
        return approveLoginRequest(ai, accountId, appId, lobbyId, lobbyJson)
      }
    }
    bridgifyObject(loginRequest)
  }

  const out = {
    loginRequest
  }
  bridgifyObject(out)

  return out
}
