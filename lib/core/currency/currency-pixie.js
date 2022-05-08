// 

import { combinePixies, mapPixie } from 'redux-pixies'


import {


  walletPixie
} from './wallet/currency-wallet-pixie.js'





export const currency = combinePixies({
  wallets: mapPixie(
    walletPixie,
    (props) => props.state.currency.currencyWalletIds,
    (props, walletId) => ({
      ...props,
      walletId,
      walletState: props.state.currency.wallets[walletId],
      walletOutput: props.output.currency.wallets[walletId]
    })
  )
})
