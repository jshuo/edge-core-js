// 

import {

  asArray,
  asBoolean,
  asEither,
  asMap,
  asNull,
  asNumber,
  asObject,
  asOptional,
  asString,
  asValue
} from 'cleaners'






import { asJsonObject } from '../../../util/file-helpers.js'

/**
 * The on-disk metadata format,
 * which has a mandatory `exchangeAmount` table and no `amountFiat`.
 */

























































































// ---------------------------------------------------------------------
// building-block cleaners
// ---------------------------------------------------------------------

/**
 * Turns user-provided metadata into its on-disk format.
 */
export function packMetadata(
  raw,
  walletFiat
) {
  const clean = asDiskMetadata(raw)

  if (typeof raw.amountFiat === 'number') {
    clean.exchangeAmount[walletFiat] = raw.amountFiat
  }

  return clean
}

/**
 * Turns on-disk metadata into the user-facing format.
 */
export function unpackMetadata(
  raw,
  walletFiat
) {
  const clean = asDiskMetadata(raw)
  const { exchangeAmount } = clean

  // Delete corrupt amounts that exceed the Javascript number range:
  for (const currency of Object.keys(exchangeAmount)) {
    if (/e/.test(String(exchangeAmount[currency]))) {
      delete exchangeAmount[currency]
    }
  }

  return { ...clean, amountFiat: exchangeAmount[walletFiat] }
}

const asFeeRate = asValue(
  'high',
  'standard',
  'low'
)

export const asEdgeTxSwap = asObject({
  orderId: asOptional(asString),
  orderUri: asOptional(asString),
  isEstimate: asBoolean,

  // The EdgeSwapInfo from the swap plugin:
  plugin: asObject({
    pluginId: asString,
    displayName: asString,
    supportEmail: asOptional(asString)
  }),

  // Address information:
  payoutAddress: asString,
  payoutCurrencyCode: asString,
  payoutNativeAmount: asString,
  payoutWalletId: asString,
  refundAddress: asOptional(asString)
})

const asDiskMetadata = asObject({
  bizId: asOptional(asNumber),
  category: asOptional(asString),
  exchangeAmount: asOptional(asMap(asNumber), {}),
  name: asOptional(asString),
  notes: asOptional(asString)
})

// ---------------------------------------------------------------------
// file cleaners
// ---------------------------------------------------------------------

/**
 * This uses currency codes, since we cannot break the data on disk.
 * To fix this one day, we can either migrate to a new file name,
 * or we can use `asEither` to switch between this format
 * and some new format based on token ID's.
 */
export const asEnabledTokensFile = asArray(asString)

export const asTransactionFile = asObject({
  txid: asString,
  internal: asBoolean,
  creationDate: asNumber,
  currencies: asMap(
    asObject({
      metadata: asDiskMetadata,
      nativeAmount: asOptional(asString),
      providerFeeSent: asOptional(asString)
    })
  ),
  deviceDescription: asOptional(asString),
  feeRateRequested: asOptional(asEither(asFeeRate, asJsonObject)),
  feeRateUsed: asOptional(asJsonObject),
  payees: asOptional(
    asArray(
      asObject({
        address: asString,
        amount: asString,
        currency: asString,
        tag: asOptional(asString)
      })
    )
  ),
  secret: asOptional(asString),
  swap: asOptional(asEdgeTxSwap)
})

export const asLegacyTransactionFile = asObject({
  airbitzFeeWanted: asNumber,
  meta: asObject({
    amountFeeAirBitzSatoshi: asNumber,
    balance: asNumber,
    fee: asNumber,

    // Metadata:
    amountCurrency: asNumber,
    bizId: asNumber,
    category: asString,
    name: asString,
    notes: asString,

    // Obsolete/moved fields:
    attributes: asNumber,
    amountSatoshi: asNumber,
    amountFeeMinersSatoshi: asNumber,
    airbitzFee: asNumber
  }),
  ntxid: asString,
  state: asObject({
    creationDate: asNumber,
    internal: asBoolean,
    malleableTxId: asString
  })
})

export const asLegacyAddressFile = asObject({
  seq: asNumber, // index
  address: asString,
  state: asObject({
    recycleable: asOptional(asBoolean, true),
    creationDate: asOptional(asNumber, 0)
  }),
  meta: asObject({
    amountSatoshi: asOptional(asNumber, 0) // requestAmount
    // TODO: Normal EdgeMetadata
  }).withRest
})

export const asLegacyMapFile = asMap(
  asObject({
    timestamp: asNumber,
    txidHash: asString
  })
)

/**
 * Public keys cached in the wallet's local storage.
 */
export const asPublicKeyFile = asObject({
  walletInfo: asObject({
    id: asString,
    keys: asJsonObject,
    type: asString
  })
})

export const asWalletFiatFile = asObject({
  fiat: asOptional(asString),
  num: asOptional(asNumber)
})

export const asWalletNameFile = asObject({
  walletName: asEither(asString, asNull)
})
