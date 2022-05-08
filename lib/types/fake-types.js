// 

import {

  asArray,
  asDate,
  asNumber,
  asObject,
  asOptional,
  asString,
  asValue
} from 'cleaners'

import {
  asBase32,
  asBase64,
  asEdgeBox,
  asEdgeSnrp,
  asRecovery2Auth
} from './server-cleaners.js'



















































































export const asVoucherDump = asObject({
  // Identity:
  loginId: asBase64,
  voucherAuth: asBase64,
  voucherId: asString,

  // Login capability:
  created: asDate,
  activates: asDate, // Automatically becomes approved on this date
  status: asValue('pending', 'approved', 'rejected'),

  // Information about the login:
  ip: asString,
  ipDescription: asString,
  deviceDescription: asOptional(asString)
})

export const asLoginDump = asObject({
  // Identity:
  appId: asString,
  created: raw => (raw == null ? new Date() : asDate(raw)),
  loginId: asBase64,

  // Nested logins:
  children: asOptional(
    asArray(raw => asLoginDump(raw)),
    []
  ),
  parentBox: asOptional(asEdgeBox),
  parentId: () => undefined,

  // 2-factor login:
  otpKey: asOptional(asBase32),
  otpResetAuth: asOptional(asString),
  otpResetDate: asOptional(asDate),
  otpTimeout: asOptional(asNumber),

  // Password login:
  passwordAuth: asOptional(asBase64),
  passwordAuthBox: asOptional(asEdgeBox),
  passwordAuthSnrp: asOptional(asEdgeSnrp),
  passwordBox: asOptional(asEdgeBox),
  passwordKeySnrp: asOptional(asEdgeSnrp),

  // PIN v2 login:
  pin2Id: asOptional(asBase64),
  pin2Auth: asOptional(asBase64),
  pin2Box: asOptional(asEdgeBox),
  pin2KeyBox: asOptional(asEdgeBox),
  pin2TextBox: asOptional(asEdgeBox),

  // Recovery v2 login:
  recovery2Id: asOptional(asBase64),
  recovery2Auth: asOptional(asRecovery2Auth),
  question2Box: asOptional(asEdgeBox),
  recovery2Box: asOptional(asEdgeBox),
  recovery2KeyBox: asOptional(asEdgeBox),

  // Secret-key login:
  loginAuth: asOptional(asBase64),
  loginAuthBox: asOptional(asEdgeBox),

  // Keys and assorted goodies:
  keyBoxes: asOptional(asArray(asEdgeBox), []),
  mnemonicBox: asOptional(asEdgeBox),
  rootKeyBox: asOptional(asEdgeBox),
  syncKeyBox: asOptional(asEdgeBox),
  vouchers: asOptional(asArray(asVoucherDump), []),

  // Obsolete:
  pinBox: asOptional(asEdgeBox),
  pinId: asOptional(asString),
  pinKeyBox: asOptional(asEdgeBox)
})

export const asFakeUser = asObject({
  lastLogin: asOptional(asDateObject),
  loginId: asBase64,
  loginKey: asBase64,
  repos: asObject(asObject(asEdgeBox)),
  server: asLoginDump,
  username: asString
})

export const asFakeUsers = asArray(asFakeUser)

function asDateObject(raw) {
  if (raw instanceof Date) return raw
  throw new TypeError('Expecting a Date')
}
