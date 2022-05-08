// 

import { uncleaner } from 'cleaners'

import {
  asChangeVouchersPayload,
  asLoginPayload
} from '../../types/server-cleaners.js'


import { applyLoginPayload, makeAuthJson } from './login.js'
import { loginFetch } from './login-fetch.js'
import { getStashById } from './login-selectors.js'
import { saveStash } from './login-stash.js'


const wasChangeVouchersPayload = uncleaner(asChangeVouchersPayload)

/**
 * Approves or rejects vouchers on the server.
 */
export async function changeVoucherStatus(
  ai,
  login,
  vouchers
) {
  const { stashTree } = getStashById(ai, login.loginId)
  const reply = await loginFetch(ai, 'POST', '/v2/login/vouchers', {
    ...makeAuthJson(stashTree, login),
    data: wasChangeVouchersPayload(vouchers)
  })
  const newStashTree = applyLoginPayload(
    stashTree,
    login.loginKey,
    asLoginPayload(reply)
  )
  return saveStash(ai, newStashTree)
}
