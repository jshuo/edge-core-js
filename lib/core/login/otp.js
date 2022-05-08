// 

import { uncleaner } from 'cleaners'
import { base32 } from 'rfc4648'

import {
  asChangeOtpPayload,
  asOtpResetPayload
} from '../../types/server-cleaners.js'

import { totp } from '../../util/crypto/hotp.js'
import { applyKit, serverLogin } from '../login/login.js'

import { loginFetch } from './login-fetch.js'
import { getStashById, hashUsername } from './login-selectors.js'



const wasChangeOtpPayload = uncleaner(asChangeOtpPayload)

/**
 * Gets the current OTP for a logged-in account.
 */
export function getLoginOtp(login) {
  if (login.otpKey != null) return totp(login.otpKey)
}

/**
 * Gets the current OTP from either the disk storage or login options.
 */
export function getStashOtp(
  stash,
  opts
) {
  const { otp, otpKey } = opts
  if (otp != null) {
    if (/[0-9]+/.test(otp) && otp.length < 16) return otp
    return totp(base32.parse(otp, { loose: true }))
  }
  if (otpKey != null) return totp(base32.parse(otpKey, { loose: true }))
  if (stash.otpKey != null) return totp(stash.otpKey)
}

export async function enableOtp(
  ai,
  accountId,
  otpTimeout
) {
  const { loginTree } = ai.props.state.accounts[accountId]
  const { otpKey = ai.props.io.random(10) } = loginTree

  const kit = {
    serverPath: '/v2/login/otp',
    server: wasChangeOtpPayload({
      otpKey,
      otpTimeout
    }),
    stash: {
      otpKey,
      otpResetDate: undefined,
      otpTimeout
    },
    login: {
      otpKey,
      otpResetDate: undefined,
      otpTimeout
    },
    loginId: loginTree.loginId
  }
  await applyKit(ai, loginTree, kit)
}

export async function disableOtp(
  ai,
  accountId
) {
  const { loginTree } = ai.props.state.accounts[accountId]

  const kit = {
    serverMethod: 'DELETE',
    serverPath: '/v2/login/otp',
    stash: {
      otpKey: undefined,
      otpResetDate: undefined,
      otpTimeout: undefined
    },
    login: {
      otpKey: undefined,
      otpResetDate: undefined,
      otpTimeout: undefined
    },
    loginId: loginTree.loginId
  }
  await applyKit(ai, loginTree, kit)
}

export async function cancelOtpReset(
  ai,
  accountId
) {
  const { loginTree } = ai.props.state.accounts[accountId]
  const { otpTimeout, otpKey } = loginTree
  if (otpTimeout == null || otpKey == null) {
    throw new Error('Cannot cancel 2FA reset: 2FA is not enabled.')
  }

  const kit = {
    serverPath: '/v2/login/otp',
    server: wasChangeOtpPayload({
      otpTimeout,
      otpKey
    }),
    stash: {
      otpResetDate: undefined
    },
    login: {
      otpResetDate: undefined
    },
    loginId: loginTree.loginId
  }
  await applyKit(ai, loginTree, kit)
}

/**
 * Requests an OTP reset.
 */
export async function resetOtp(
  ai,
  username,
  resetToken
) {
  const request = {
    userId: await hashUsername(ai, username),
    otpResetAuth: resetToken
  }
  return loginFetch(ai, 'DELETE', '/v2/login/otp', request).then(reply => {
    const { otpResetDate } = asOtpResetPayload(reply)
    return otpResetDate
  })
}

/**
 * If the device doesn't have the right OTP key,
 * this can prevent most things from working.
 * Let the user provide an updated key, and present that to the server.
 * If the key works, the server will let us in & resolve the issue.
 */
export async function repairOtp(
  ai,
  accountId,
  otpKey
) {
  if (ai.props.state.accounts[accountId] == null) return
  const { login } = ai.props.state.accounts[accountId]
  const { userId, passwordAuth } = login

  const { stashTree, stash } = getStashById(ai, login.loginId)
  if (passwordAuth == null || userId == null) {
    throw new Error('Cannot repair OTP: There is no password on this account')
  }
  const request = {
    userId,
    passwordAuth,
    otp: totp(otpKey)
  }
  const opts = {
    // Avoid updating the lastLogin date:
    now: stashTree.lastLogin
  }
  await serverLogin(ai, stashTree, stash, opts, request, async () => {
    return login.loginKey
  })
}
