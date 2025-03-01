// 

import {

  buildReducer,
  filterReducer,
  memoizeReducer
} from 'redux-keto'










import { compare } from '../../../util/compare.js'

import { findCurrencyPluginId } from '../../plugins/plugins-selectors.js'


import { currencyCodesToTokenIds } from './enabled-tokens.js'

/** Maps from txid hash to file creation date & path. */




































































export const initialEnabledTokens = []

const currencyWalletInner



 = buildReducer({
  accountId(state, action, next) {
    if (state != null) return state
    for (const accountId of Object.keys(next.root.accounts)) {
      const account = next.root.accounts[accountId]
      for (const walletId of Object.keys(account.walletInfos)) {
        if (walletId === next.id) return accountId
      }
    }
    throw new Error(`Cannot find account for walletId ${next.id}`)
  },

  pluginId: memoizeReducer(
    next => next.root.login.walletInfos[next.id].type,
    next => next.root.plugins.currency,
    (walletType, plugins) => {
      return findCurrencyPluginId(plugins, walletType)
    }
  ),

  paused(
    state,
    action,
    next
  ) {
    return state == null
      ? next.root.accounts[next.self.accountId].pauseWallets
      : action.type === 'CURRENCY_WALLET_CHANGED_PAUSED'
      ? action.payload.paused
      : state
  },

  currencyInfo(
    state,
    action,
    next
  ) {
    if (state) return state
    const { pluginId } = next.self
    return next.root.plugins.currency[pluginId].currencyInfo
  },

  displayPrivateSeed(state = null, action) {
    return action.type === 'CURRENCY_ENGINE_CHANGED_SEEDS'
      ? action.payload.displayPrivateSeed
      : state
  },

  displayPublicSeed(state = null, action) {
    return action.type === 'CURRENCY_ENGINE_CHANGED_SEEDS'
      ? action.payload.displayPublicSeed
      : state
  },

  enabledTokenIds: memoizeReducer(
    (next) =>
      next.root.accounts[next.self.accountId].builtinTokens[next.self.pluginId],
    (next) =>
      next.root.accounts[next.self.accountId].customTokens[next.self.pluginId],
    (next) => next.self.currencyInfo,
    (next) => next.self.enabledTokens,
    currencyCodesToTokenIds
  ),

  enabledTokens(
    state = initialEnabledTokens,
    action
  ) {
    if (action.type === 'CURRENCY_WALLET_ENABLED_TOKENS_CHANGED') {
      const { currencyCodes } = action.payload
      // Check for actual changes:
      currencyCodes.sort((a, b) => (a === b ? 0 : a > b ? 1 : -1))
      if (!compare(currencyCodes, state)) return currencyCodes
    }
    return state
  },

  engineFailure(state = null, action) {
    return action.type === 'CURRENCY_ENGINE_FAILED'
      ? action.payload.error
      : state
  },

  engineStarted(state = false, action) {
    return action.type === 'CURRENCY_ENGINE_STARTED'
      ? true
      : action.type === 'CURRENCY_ENGINE_STOPPED'
      ? false
      : state
  },

  fiat(state = '', action) {
    return action.type === 'CURRENCY_WALLET_FIAT_CHANGED'
      ? action.payload.fiatCurrencyCode
      : state
  },

  fiatLoaded(state = false, action) {
    return action.type === 'CURRENCY_WALLET_FIAT_CHANGED' ? true : state
  },

  files(state = {}, action) {
    switch (action.type) {
      case 'CURRENCY_WALLET_FILE_CHANGED': {
        const { json, txidHash } = action.payload
        const out = { ...state }
        out[txidHash] = json
        return out
      }
      case 'CURRENCY_WALLET_FILES_LOADED': {
        const { files } = action.payload
        return {
          ...state,
          ...files
        }
      }
    }
    return state
  },

  sortedTransactions(
    state = { txidHashes: {}, sortedList: [] },
    action
  ) {
    const { txidHashes } = state
    switch (action.type) {
      case 'CURRENCY_ENGINE_CHANGED_TXS': {
        return sortTxs(txidHashes, action.payload.txidHashes)
      }
      case 'CURRENCY_WALLET_FILE_NAMES_LOADED': {
        const { txFileNames } = action.payload
        const newTxidHashes = {}
        for (const txidHash of Object.keys(txFileNames)) {
          newTxidHashes[txidHash] = txFileNames[txidHash].creationDate
        }
        return sortTxs(txidHashes, newTxidHashes)
      }
    }
    return state
  },

  fileNames(state = {}, action) {
    switch (action.type) {
      case 'CURRENCY_WALLET_FILE_NAMES_LOADED': {
        const { txFileNames } = action.payload
        return {
          ...state,
          ...txFileNames
        }
      }
      case 'CURRENCY_WALLET_FILE_CHANGED': {
        const { fileName, creationDate, txidHash } = action.payload
        if (!state[txidHash] || creationDate < state[txidHash].creationDate) {
          state[txidHash] = { creationDate, fileName }
        }
        return state
      }
    }
    return state
  },

  fileNamesLoaded(state = false, action) {
    return action.type === 'CURRENCY_WALLET_FILE_NAMES_LOADED' ? true : state
  },

  syncRatio(state = 0, action) {
    switch (action.type) {
      case 'CURRENCY_ENGINE_CHANGED_SYNC_RATIO': {
        return action.payload.ratio
      }
      case 'CURRENCY_ENGINE_CLEARED': {
        return 0
      }
    }
    return state
  },

  balances(state = {}, action) {
    if (action.type === 'CURRENCY_ENGINE_CHANGED_BALANCE') {
      const out = { ...state }
      out[action.payload.currencyCode] = action.payload.balance
      return out
    }
    return state
  },

  height(state = 0, action) {
    return action.type === 'CURRENCY_ENGINE_CHANGED_HEIGHT'
      ? action.payload.height
      : state
  },

  name(state = null, action) {
    return action.type === 'CURRENCY_WALLET_NAME_CHANGED'
      ? action.payload.name
      : state
  },

  nameLoaded(state = false, action) {
    return action.type === 'CURRENCY_WALLET_NAME_CHANGED' ? true : state
  },

  stakingStatus(
    state = { stakedAmounts: [] },
    action
  ) {
    return action.type === 'CURRENCY_ENGINE_CHANGED_STAKING'
      ? action.payload.stakingStatus
      : state
  },

  txids: memoizeReducer(
    (next) => next.self.txs,
    (txs) => Object.keys(txs)
  ),

  txs(
    state = {},
    action,
    next
  ) {
    switch (action.type) {
      case 'CURRENCY_ENGINE_CHANGED_TXS': {
        const { txs } = action.payload
        const defaultCurrency = next.self.currencyInfo.currencyCode
        const out = { ...state }
        for (const tx of txs) {
          out[tx.txid] = mergeTx(tx, defaultCurrency, out[tx.txid])
        }
        return out
      }
      case 'CURRENCY_ENGINE_CLEARED':
        return {}
    }

    return state
  },

  gotTxs(state = {}, action) {
    if (action.type === 'CURRENCY_ENGINE_GOT_TXS') {
      state[action.payload.currencyCode] = true
    }
    return state
  },

  walletInfo(state, action, next) {
    return next.root.login.walletInfos[next.id]
  },

  publicWalletInfo(state = null, action) {
    return action.type === 'CURRENCY_WALLET_PUBLIC_INFO'
      ? action.payload.walletInfo
      : state
  }
})

export function sortTxs(
  txidHashes,
  newHashes
)


 {
  for (const newTxidHash of Object.keys(newHashes)) {
    const newTime = newHashes[newTxidHash]
    if (!txidHashes[newTxidHash] || newTime < txidHashes[newTxidHash]) {
      txidHashes[newTxidHash] = newTime
    }
  }
  const sortedList = Object.keys(txidHashes).sort(
    (txidHash1, txidHash2) => {
      if (txidHashes[txidHash1] > txidHashes[txidHash2]) return -1
      if (txidHashes[txidHash1] < txidHashes[txidHash2]) return 1
      return 0
    }
  )
  return { sortedList, txidHashes }
}

export const currencyWalletReducer



 = filterReducer(
  currencyWalletInner,
  (action, next) => {
    return /^CURRENCY_/.test(action.type) &&
      action.payload != null &&
      action.payload.walletId === next.id
      ? action
      : { type: 'UPDATE_NEXT' }
  }
)

const defaultTx = {
  blockHeight: 0,
  date: 0,
  ourReceiveAddresses: [],
  signedTx: '',
  txid: '',
  nativeAmount: {},
  networkFee: {},
  providerFee: {}
}

/**
 * Merges a new incoming transaction with an existing transaction.
 */
export function mergeTx(
  tx,
  defaultCurrency,
  oldTx = defaultTx
) {
  const out = {
    blockHeight: tx.blockHeight,
    date: tx.date,
    ourReceiveAddresses: tx.ourReceiveAddresses,
    signedTx: tx.signedTx,
    txid: tx.txid,
    otherParams: tx.otherParams,

    nativeAmount: { ...oldTx.nativeAmount },
    networkFee: { ...oldTx.networkFee }
  }

  const currencyCode =
    tx.currencyCode != null ? tx.currencyCode : defaultCurrency
  out.nativeAmount[currencyCode] = tx.nativeAmount
  out.networkFee[currencyCode] =
    tx.networkFee != null ? tx.networkFee.toString() : '0'

  if (tx.parentNetworkFee != null) {
    out.networkFee[defaultCurrency] = String(tx.parentNetworkFee)
  }

  return out
}
