// 

import { buildReducer, mapReducer } from 'redux-keto'


import { accountReducer } from './account/account-reducer.js'

import { currency } from './currency/currency-reducer.js'
import { DEFAULT_RATE_HINTS } from './exchange/exchange-pixie.js'
import {

  exchangeCache
} from './exchange/exchange-reducer.js'
import { login } from './login/login-reducer.js'
import { plugins } from './plugins/plugins-reducer.js'
import {

  storageWallets
} from './storage/storage-reducer.js'




















export const defaultLogSettings = {
  sources: {},
  defaultLogLevel: 'warn'
}

export const reducer = buildReducer({
  accountCount(state = 0, action) {
    return action.type === 'LOGIN' ? state + 1 : state
  },

  accountIds(state = [], action, next) {
    switch (action.type) {
      case 'LOGIN':
        return [...state, next.lastAccountId]

      case 'LOGOUT': {
        const { accountId } = action.payload
        const out = state.filter(id => id !== accountId)
        if (out.length === state.length) {
          throw new Error(`Login ${accountId} does not exist`)
        }
        return out
      }

      case 'CLOSE':
        return []
    }
    return state
  },

  accounts: mapReducer(accountReducer, (next) => next.accountIds),

  hideKeys(state = true, action) {
    return action.type === 'INIT' ? action.payload.hideKeys : state
  },

  lastAccountId(state, action, next) {
    return `login${next.accountCount}`
  },

  logSettings(state = defaultLogSettings, action) {
    switch (action.type) {
      case 'INIT':
        return action.payload.logSettings
      case 'CHANGE_LOG_SETTINGS':
        return action.payload
    }
    return state
  },

  paused(state = false, action) {
    return action.type === 'PAUSE' ? action.payload : state
  },

  rateHintCache(state = DEFAULT_RATE_HINTS, action) {
    switch (action.type) {
      case 'INIT':
      case 'UPDATE_RATE_HINT_CACHE':
        return action.payload.rateHintCache
    }
    return state
  },

  ready(state = false, action) {
    return action.type === 'INIT' ? true : state
  },

  currency,
  exchangeCache,
  login,
  plugins,
  storageWallets
})
