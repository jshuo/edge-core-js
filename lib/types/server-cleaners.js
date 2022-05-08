// 

import {

  asArray,
  asBoolean,
  asCodec,
  asDate,
  asNumber,
  asObject,
  asOptional,
  asString,
  asUnknown,
  asValue
} from 'cleaners'
import { base16, base32, base64 } from 'rfc4648'































/**
 * A string of hex-encoded binary data.
 */
export const asBase16 = asCodec(
  raw => base16.parse(asString(raw)),
  clean => base16.stringify(clean).toLowerCase()
)

/**
 * A string of base32-encoded binary data.
 */
export const asBase32 = asCodec(
  raw => base32.parse(asString(raw), { loose: true }),
  clean => base32.stringify(clean, { pad: false })
)

/**
 * A string of base64-encoded binary data.
 */
export const asBase64 = asCodec(
  raw => base64.parse(asString(raw)),
  clean => base64.stringify(clean)
)

// ---------------------------------------------------------------------
// public Edge types
// ---------------------------------------------------------------------

export const asEdgePendingVoucher = asObject({
  voucherId: asString,
  activates: asDate,
  created: asDate,
  ip: asString,
  ipDescription: asString,
  deviceDescription: asOptional(asString)
})

const asEdgeRecoveryQuestionChoice = asObject(
  {
    min_length: asNumber,
    category: asValue('address', 'must', 'numeric', 'recovery2', 'string'),
    question: asString
  }
)

// ---------------------------------------------------------------------
// internal Edge types
// ---------------------------------------------------------------------

export const asEdgeBox = asObject({
  encryptionType: asNumber,
  data_base64: asString,
  iv_hex: asString
})

export const asEdgeSnrp = asObject({
  salt_hex: asBase16,
  n: asNumber,
  r: asNumber,
  p: asNumber
})

export const asEdgeLobbyRequest = asObject({
  loginRequest: asOptional(asObject({ appId: asString }).withRest),
  publicKey: asBase64,
  timeout: asOptional(asNumber)
}).withRest

export const asEdgeLobbyReply = asObject({
  publicKey: asBase64,
  box: asEdgeBox
})

/**
 * An array of base64-encoded hashed recovery answers.
 */
export const asRecovery2Auth = asArray(asBase64)

// ---------------------------------------------------------------------
// top-level request & response bodies
// ---------------------------------------------------------------------

export const asLoginRequestBody = asObject({
  // The request payload:
  data: asUnknown,

  // Common fields for all login methods:
  deviceDescription: asOptional(asString),
  otp: asOptional(asString),
  voucherId: asOptional(asString),
  voucherAuth: asOptional(asBase64),

  // Secret-key login:
  loginId: asOptional(asBase64),
  loginAuth: asOptional(asBase64),

  // Password login:
  userId: asOptional(asBase64),
  passwordAuth: asOptional(asBase64),

  // PIN login:
  pin2Id: asOptional(asBase64),
  pin2Auth: asOptional(asBase64),

  // Recovery login:
  recovery2Id: asOptional(asBase64),
  recovery2Auth: asOptional(asRecovery2Auth),

  // Messages:
  loginIds: asOptional(asArray(asBase64)),

  // OTP reset:
  otpResetAuth: asOptional(asString),

  // Legacy:
  did: asOptional(asString),
  l1: asOptional(asBase64),
  lp1: asOptional(asBase64),
  lpin1: asOptional(asBase64),
  lra1: asOptional(asBase64),
  recoveryAuth: asOptional(asBase64) // lra1
})

export const asLoginResponseBody = asObject({
  // The response payload:
  results: asOptional(asUnknown),

  // What type of response is this (success or failure)?:
  status_code: asNumber,
  message: asString
})

// ---------------------------------------------------------------------
// request payloads
// ---------------------------------------------------------------------

export const asChangeOtpPayload = asObject({
  otpTimeout: asOptional(asNumber, 7 * 24 * 60 * 60), // seconds
  otpKey: asBase32
})

export const asChangePasswordPayload = asObject(
  {
    passwordAuth: asBase64,
    passwordAuthBox: asEdgeBox,
    passwordAuthSnrp: asEdgeSnrp,
    passwordBox: asEdgeBox,
    passwordKeySnrp: asEdgeSnrp
  }
)

export const asChangePin2Payload = asObject({
  pin2Id: asOptional(asBase64),
  pin2Auth: asOptional(asBase64),
  pin2Box: asOptional(asEdgeBox),
  pin2KeyBox: asOptional(asEdgeBox),
  pin2TextBox: asEdgeBox
})

export const asChangeRecovery2Payload = asObject(
  {
    recovery2Id: asBase64,
    recovery2Auth: asRecovery2Auth,
    recovery2Box: asEdgeBox,
    recovery2KeyBox: asEdgeBox,
    question2Box: asEdgeBox
  }
)

export const asChangeSecretPayload = asObject({
  loginAuthBox: asEdgeBox,
  loginAuth: asBase64
})

export const asChangeVouchersPayload = asObject(
  {
    approvedVouchers: asOptional(asArray(asString)),
    rejectedVouchers: asOptional(asArray(asString))
  }
)

export const asCreateKeysPayload = asObject({
  keyBoxes: asArray(asEdgeBox),
  newSyncKeys: asOptional(asArray(asString), [])
})

export const asCreateLoginPayload = asObject({
  appId: asString,
  loginId: asBase64,
  parentBox: asOptional(asEdgeBox)
}).withRest

// ---------------------------------------------------------------------
// response payloads
// ---------------------------------------------------------------------

export const asLobbyPayload = asObject({
  request: asEdgeLobbyRequest,
  replies: asArray(asEdgeLobbyReply)
})

export const asLoginPayload = asObject({
  // Identity:
  appId: asString,
  created: asDate,
  loginId: asBase64,
  userId: asOptional(asBase64),

  // Nested logins:
  children: asOptional(asArray(raw => asLoginPayload(raw))),
  parentBox: asOptional(asEdgeBox),

  // 2-factor login:
  otpKey: asOptional(asBase32),
  otpResetDate: asOptional(asDate),
  otpTimeout: asOptional(asNumber),

  // Password login:
  passwordAuthBox: asOptional(asEdgeBox),
  passwordAuthSnrp: asOptional(asEdgeSnrp),
  passwordBox: asOptional(asEdgeBox),
  passwordKeySnrp: asOptional(asEdgeSnrp),

  // PIN v2 login:
  pin2Box: asOptional(asEdgeBox),
  pin2KeyBox: asOptional(asEdgeBox),
  pin2TextBox: asOptional(asEdgeBox),

  // Recovery v2 login:
  question2Box: asOptional(asEdgeBox),
  recovery2Box: asOptional(asEdgeBox),
  recovery2KeyBox: asOptional(asEdgeBox),

  // Secret-key login:
  loginAuthBox: asOptional(asEdgeBox),

  // Voucher login:
  pendingVouchers: asOptional(asArray(asEdgePendingVoucher), []),

  // Resources:
  keyBoxes: asOptional(asArray(asEdgeBox)),
  mnemonicBox: asOptional(asEdgeBox),
  rootKeyBox: asOptional(asEdgeBox),
  syncKeyBox: asOptional(asEdgeBox)
})

export const asMessagesPayload = asArray(
  asObject({
    loginId: asBase64,
    otpResetPending: asOptional(asBoolean, false),
    pendingVouchers: asOptional(asArray(asEdgePendingVoucher), []),
    recovery2Corrupt: asOptional(asBoolean, false)
  })
)

export const asOtpErrorPayload = asObject({
  login_id: asOptional(asBase64),
  otp_reset_auth: asOptional(asString),
  otp_timeout_date: asOptional(asDate),
  reason: asOptional(asString),
  voucher_activates: asOptional(asDate),
  voucher_auth: asOptional(asBase64),
  voucher_id: asOptional(asString)
})

export const asOtpResetPayload = asObject({
  otpResetDate: asDate
})

export const asPasswordErrorPayload = asObject({
  wait_seconds: asOptional(asNumber)
})

export const asQuestionChoicesPayload = asArray(
  asEdgeRecoveryQuestionChoice
)

export const asRecovery2InfoPayload = asObject({
  question2Box: asEdgeBox
})

export const asUsernameInfoPayload = asObject({
  // Password login:
  passwordAuthSnrp: asOptional(asEdgeSnrp),

  // Recovery v1 login:
  questionBox: asOptional(asEdgeBox),
  questionKeySnrp: asOptional(asEdgeSnrp),
  recoveryAuthSnrp: asOptional(asEdgeSnrp)
})
