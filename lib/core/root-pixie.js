



import { combinePixies } from 'redux-pixies'


import { accounts } from './account/account-pixie.js'

import { context } from './context/context-pixie.js'
import { currency } from './currency/currency-pixie.js'
import { exchange } from './exchange/exchange-pixie.js'


import { scrypt } from './scrypt/scrypt-pixie.js'

// The top-level pixie output structure:






















/**
 * Downstream pixies take props that extend from `RootProps`,
 * so this casts those back down if necessary.
 */
export const toApiInput = (input) => input

export const rootPixie = combinePixies({
  accounts,
  context,
  currency,
  exchange,
  scrypt
})
