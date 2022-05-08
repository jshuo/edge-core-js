


import { combineReducers } from 'redux'



























/**
 * Individual repo reducer.
 */
const storageWalletReducer


 = combineReducers({
  lastChanges(state = [], action) {
    if (action.type === 'STORAGE_WALLET_SYNCED') {
      const { changes } = action.payload
      return changes.length > 0 ? changes : state
    }
    return state
  },

  localDisklet(state = null) {
    return state
  },

  paths(state = null) {
    return state
  },

  status(
    state = { lastSync: 0, lastHash: undefined },
    action
  ) {
    return action.type === 'STORAGE_WALLET_SYNCED'
      ? action.payload.status
      : state
  }
})

/**
 * Repo list reducer.
 */
export const storageWallets = function storageWalletsReducer(
  state = {},
  action
) {
  switch (action.type) {
    case 'STORAGE_WALLET_ADDED': {
      const { id, initialState } = action.payload
      const out = { ...state }
      out[id] = storageWalletReducer(initialState, { type: 'UPDATE_NEXT' })
      return out
    }

    case 'STORAGE_WALLET_SYNCED': {
      const { id } = action.payload
      if (state[id] != null) {
        const out = { ...state }
        out[id] = storageWalletReducer(state[id], action)
        return out
      }
      return state
    }
  }
  return state
}
