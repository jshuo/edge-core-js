// 

import { buildReducer, memoizeReducer } from 'redux-keto'


import { base58 } from '../../util/encoding.js'


import { searchTree } from './login.js'


import { findPin2Stash } from './pin2.js'













export const login



 = buildReducer({
  apiKey(state = '', action) {
    return action.type === 'INIT' ? action.payload.apiKey : state
  },

  appId(state = '', action) {
    return action.type === 'INIT' ? action.payload.appId : state
  },

  deviceDescription(state = null, action) {
    return action.type === 'INIT' ? action.payload.deviceDescription : state
  },

  localUsers: memoizeReducer(
    (next) => next.login.appId,
    (next) => next.login.stashes,
    (appId, stashes) => {
      const out = []
      for (const username of Object.keys(stashes)) {
        const stashTree = stashes[username]
        const stash = searchTree(stashTree, stash => stash.appId === appId)

        const keyLoginEnabled =
          stash != null &&
          (stash.passwordAuthBox != null || stash.loginAuthBox != null)
        const pin2Stash = findPin2Stash(stashTree, appId)
        const { recovery2Key } = stashTree

        out.push({
          keyLoginEnabled,
          lastLogin: stashTree.lastLogin,
          pinLoginEnabled: pin2Stash != null,
          recovery2Key:
            recovery2Key != null ? base58.stringify(recovery2Key) : undefined,
          username,
          voucherId: stash != null ? stash.voucherId : undefined
        })
      }
      return out
    }
  ),

  serverUri(state = '', action) {
    return action.type === 'INIT' ? action.payload.authServer : state
  },

  stashes(state = {}, action) {
    switch (action.type) {
      case 'INIT': {
        const out = {}

        // Extract the usernames from the top-level objects:
        for (const stash of action.payload.stashes) {
          if (stash.username != null) {
            const { username } = stash
            out[username] = stash
          }
        }

        return out
      }

      case 'LOGIN_STASH_DELETED': {
        const copy = { ...state }
        delete copy[action.payload]
        return copy
      }

      case 'LOGIN_STASH_SAVED': {
        const { username } = action.payload
        if (username == null) throw new Error('Missing username')

        const out = { ...state }
        out[username] = action.payload
        return out
      }
    }
    return state
  },

  walletInfos(state, action, next) {
    // Optimize the common case:
    if (next.accountIds.length === 1) {
      const id = next.accountIds[0]
      return next.accounts[id].walletInfos
    }

    const out = {}
    for (const accountId of next.accountIds) {
      const account = next.accounts[accountId]
      for (const id of Object.keys(account.walletInfos)) {
        const info = account.walletInfos[id]
        out[id] = info
      }
    }
    return out
  }
})
