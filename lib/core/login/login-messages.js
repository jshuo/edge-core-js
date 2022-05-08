// 

import { base64 } from 'rfc4648'

import { asMessagesPayload } from '../../types/server-cleaners.js'


import { loginFetch } from './login-fetch.js'

/**
 * Fetches any login-related messages for all the users on this device.
 */
export function fetchLoginMessages(ai) {
  const stashes = ai.props.state.login.stashes

  const loginMap = {} // loginId -> username
  const loginIds = []
  for (const username of Object.keys(stashes)) {
    const loginId = stashes[username].loginId
    if (loginId != null) {
      loginMap[base64.stringify(loginId)] = username
      loginIds.push(loginId)
    }
  }

  const request = {
    loginIds
  }
  return loginFetch(ai, 'POST', '/v2/messages', request).then(reply => {
    const out = {}
    for (const message of asMessagesPayload(reply)) {
      const { loginId, ...rest } = message
      const id = base64.stringify(loginId)
      const username = loginMap[id]
      if (username != null) out[username] = { ...rest, loginId: id }
    }
    return out
  })
}
