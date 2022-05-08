// 

import { gt, lt } from 'biggystring'
import { bridgifyObject } from 'yaob'

import {




  asMaybeInsufficientFundsError,
  asMaybePendingFundsError,
  asMaybeSwapAboveLimitError,
  asMaybeSwapBelowLimitError,
  asMaybeSwapCurrencyError,
  asMaybeSwapPermissionError
} from '../../types/types.js'
import { fuzzyTimeout } from '../../util/promise.js'


/**
 * Fetch quotes from all plugins, and pick the best one.
 */
export async function fetchSwapQuote(
  ai,
  accountId,
  request,
  opts = {}
) {
  const { preferPluginId, disabled = {}, promoCodes = {} } = opts
  const { log } = ai.props

  const account = ai.props.state.accounts[accountId]
  const { swapSettings, userSettings } = account
  const swapPlugins = ai.props.state.plugins.swap

  log.warn(
    'Requesting swap quotes for: ',
    {
      ...request,
      fromWallet: request.fromWallet.id,
      toWallet: request.toWallet.id
    },
    { preferPluginId, promoCodes }
  )

  // Invoke all the active swap plugins:
  const promises = []
  for (const pluginId of Object.keys(swapPlugins)) {
    const { enabled = true } =
      swapSettings[pluginId] != null ? swapSettings[pluginId] : {}

    // Start request:
    if (!enabled || disabled[pluginId]) continue
    promises.push(
      swapPlugins[pluginId]
        .fetchSwapQuote(request, userSettings[pluginId], {
          promoCode: promoCodes[pluginId]
        })
        .then(
          quote => {
            log.warn(`${pluginId} gave swap quote:`, quote)
            return quote
          },
          error => {
            log.warn(`${pluginId} gave swap error: ${String(error)}`)
            throw error
          }
        )
    )
  }
  if (promises.length < 1) throw new Error('No swap providers enabled')

  // Wait for the results, with error handling:
  return fuzzyTimeout(promises, 20000).then(
    quotes => {
      // Find the cheapest price:
      const bestQuote = pickBestQuote(quotes, preferPluginId, promoCodes)
      log.warn(
        `${promises.length} swap quotes requested, ${quotes.length} resolved, picked ${bestQuote.pluginId}.`
      )

      // Close unused quotes:
      for (const quote of quotes) {
        if (quote !== bestQuote) quote.close().catch(() => undefined)
      }
      return bridgifyObject(bestQuote)
    },
    (errors) => {
      log.warn(`All ${promises.length} swap quotes rejected.`)
      throw pickBestError(errors)
    }
  )
}

/**
 * Picks the best quote out of the available choices.
 * Exported so we can unit-test it.
 */
export function pickBestQuote(
  quotes,
  preferPluginId,
  promoCodes
) {
  return quotes.reduce((a, b) => {
    // Always return quotes from the preferred provider:
    if (a.pluginId === preferPluginId) return a
    if (b.pluginId === preferPluginId) return b

    // Prioritize providers with active promo codes:
    const aHasPromo = promoCodes[a.pluginId] != null
    const bHasPromo = promoCodes[b.pluginId] != null
    if (aHasPromo && !bHasPromo) return a
    if (!aHasPromo && bHasPromo) return b

    // Prioritize accurate quotes over estimates:
    const { isEstimate: aIsEstimate = true } = a
    const { isEstimate: bIsEstimate = true } = b
    if (aIsEstimate && !bIsEstimate) return b
    if (!aIsEstimate && bIsEstimate) return a

    // Prefer the best rate:
    const aRate = Number(a.toNativeAmount) / Number(a.fromNativeAmount)
    const bRate = Number(b.toNativeAmount) / Number(b.fromNativeAmount)
    return bRate > aRate ? b : a
  })
}

/**
 * Picks the best error out of the available choices.
 */
function pickBestError(errors) {
  return errors.reduce((a, b) => {
    // Return the highest-ranked error:
    const diff = rankError(a) - rankError(b)
    if (diff > 0) return a
    if (diff < 0) return b

    // Same ranking, so use amounts to distinguish:
    const aBelow = asMaybeSwapBelowLimitError(a)
    const bBelow = asMaybeSwapBelowLimitError(b)
    if (aBelow != null && bBelow != null) {
      return lt(aBelow.nativeMin, bBelow.nativeMin) ? aBelow : bBelow
    }
    const aAbove = asMaybeSwapAboveLimitError(a)
    const bAbove = asMaybeSwapAboveLimitError(b)
    if (aAbove != null && bAbove != null) {
      return gt(aAbove.nativeMax, bAbove.nativeMax) ? aAbove : bAbove
    }

    // Otherwise, just pick one:
    return a
  })
}

/**
 * Ranks different error codes by priority.
 */
function rankError(error) {
  if (error == null) return 0
  if (asMaybeInsufficientFundsError(error) != null) return 6
  if (asMaybePendingFundsError(error) != null) return 6
  if (asMaybeSwapBelowLimitError(error) != null) return 5
  if (asMaybeSwapAboveLimitError(error) != null) return 4
  if (asMaybeSwapPermissionError(error) != null) return 3
  if (asMaybeSwapCurrencyError(error) != null) return 2
  return 1
}
