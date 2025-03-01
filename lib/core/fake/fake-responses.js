 function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }// 

import { uncleaner } from 'cleaners'



import {
  asOtpErrorPayload,
  asPasswordErrorPayload
} from '../../types/server-cleaners.js'


const wasOtpErrorPayload = uncleaner(asOtpErrorPayload)
const wasPasswordErrorPayload = uncleaner(asPasswordErrorPayload)



export const statusCodes = {
  success: {
    code: 0,
    httpStatus: 200,
    message: 'Success'
  },
  error: {
    code: 1,
    httpStatus: 503,
    message: 'Error'
  },
  accountExists: {
    code: 2,
    httpStatus: 401,
    message: 'Account already exists'
  },
  noAccount: {
    code: 3,
    httpStatus: 401,
    message: 'No account'
  },
  invalidPassword: {
    code: 4,
    httpStatus: 401,
    message: 'Invalid Password'
  },
  invalidAnswers: {
    code: 5,
    httpStatus: 401,
    message: 'Invalid Answers'
  },
  invalidApiKey: {
    code: 6,
    httpStatus: 401,
    message: 'Invalid API Key'
  },
  // pinThrottled: {code: 7, httpStatus: , message: 401, 'Pin Throttled'}
  invalidOtp: {
    code: 8,
    httpStatus: 401,
    message: 'Invalid OTP'
  },
  conflict: {
    code: 10,
    httpStatus: 409,
    message: 'Conflicting change'
  },
  obsolete: {
    code: 1000,
    httpStatus: 410,
    message: 'Obsolete API'
  },

  // Variants of the "success" status code:
  created: {
    code: 0,
    httpStatus: 201,
    message: 'Account created'
  },

  // Variants of the "error" status code:
  invalidRequest: {
    code: 1,
    httpStatus: 401,
    message: 'Invalid request'
  },
  notFound: {
    code: 1,
    httpStatus: 404,
    message: 'Not found'
  },

  // Variants of the "noAccount" status code:
  noLobby: {
    code: 3,
    httpStatus: 404,
    message: 'Not found'
  },

  // Variants of the "conflict" error code:
  invalidAppId: {
    code: 10,
    httpStatus: 401,
    message: 'A login with the same appId already exists'
  }
}

/**
 * Construct an HttpResponse object with a JSON body.
 */
export function jsonResponse(
  body,
  opts = {}
) {
  const { status = 200, headers = {} } = opts
  return Promise.resolve({
    status,
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body)
  })
}

/**
 * A generic success or failure response.
 */
export function statusResponse(
  statusCode = statusCodes.success,
  message = statusCode.message
) {
  const { code, httpStatus } = statusCode
  const body = { status_code: code, message }
  return jsonResponse(body, { status: httpStatus })
}

/**
 * A success response, with payload.
 */
export function payloadResponse(
  payload,
  statusCode = statusCodes.success,
  message = statusCode.message
) {
  const { code, httpStatus } = statusCode
  const body = { status_code: code, message, results: payload }
  return jsonResponse(body, { status: httpStatus })
}

/**
 * An OTP failure response.
 */
export function otpErrorResponse(
  login,
  opts


 = {}
) {
  const { reason = 'otp', voucher } = opts
  return payloadResponse(
    wasOtpErrorPayload({
      login_id: login.loginId,
      otp_reset_auth: login.otpResetAuth,
      otp_timeout_date: login.otpResetDate,
      reason,
      voucher_auth: _optionalChain([voucher, 'optionalAccess', _ => _.voucherAuth]),
      voucher_activates: _optionalChain([voucher, 'optionalAccess', _2 => _2.activates]),
      voucher_id: _optionalChain([voucher, 'optionalAccess', _3 => _3.voucherId])
    }),
    statusCodes.invalidOtp
  )
}

/**
 * A password failure, with timeout.
 */
export function passwordErrorResponse(wait) {
  return payloadResponse(
    wasPasswordErrorPayload({
      wait_seconds: wait
    }),
    statusCodes.invalidPassword
  )
}
