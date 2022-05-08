// 

import { buildReducer, mapReducer } from 'redux-keto'



import {

  currencyWalletReducer
} from './wallet/currency-wallet-reducer.js'






export const currency



 = buildReducer({
  currencyWalletIds(state, action, next) {
    // Optimize the common case:
    if (next.accountIds.length === 1) {
      const id = next.accountIds[0]
      return next.accounts[id].activeWalletIds
    }

    const allIds = next.accountIds.map(
      accountId => next.accounts[accountId].activeWalletIds
    )
    return [].concat(...allIds)
  },

  wallets: mapReducer(
    currencyWalletReducer,
    (props) => props.currency.currencyWalletIds
  )
})
