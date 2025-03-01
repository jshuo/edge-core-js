// @flow

import { type EdgeRateHint } from '../../types/types.js'
import { type RootState } from '../root-reducer.js'
import { addHint } from './exchange-pixie.js'
import { type ExchangePair, type ExchangeRoutes } from './exchange-reducer.js'

export type GetPairCost = (
  source: string,
  age: number,
  inverse: boolean
) => number

/**
 * A path from one currency to another results in both a rate and a total cost.
 */
type ExchangeRate = { rate: number, cost: number }

/**
 * Common data for the recursive exchange-rate search.
 */
type ExchangeSearch = {
  now: number,
  routes: ExchangeRoutes,
  pairs: ExchangePair[],
  toCurrency: string,
  getPairCost: GetPairCost,

  // The search overwrites this as it finds better rates:
  bestRate: ExchangeRate
}

/**
 * Recursively searches for the best exchange rate.
 */
function searchRoutes(
  search: ExchangeSearch,
  fromCurrency: string,
  parentRate: ExchangeRate,
  blacklist: { [currency: string]: true }
): void {
  // If we reach our target, we are done:
  if (fromCurrency === search.toCurrency) {
    search.bestRate = parentRate
  }

  // Never re-visit the same currency:
  blacklist = { ...blacklist }
  blacklist[fromCurrency] = true

  // Iterate over all the currencies we can convert to from here:
  for (const currency of Object.keys(search.routes[fromCurrency])) {
    // Skip this currency if it is on the blacklist:
    if (blacklist[currency]) continue

    // Of all the pairs that bring us to this currency, find the best one:
    let ourRate: ExchangeRate = { rate: 0, cost: Infinity }
    const indices = search.routes[fromCurrency][currency]
    for (const i of indices) {
      const pair = search.pairs[i]
      const inverse = pair.fromCurrency !== fromCurrency
      const cost =
        parentRate.cost +
        search.getPairCost(pair.source, search.now - pair.timestamp, inverse)

      // Save this rate if it has a better score:
      if (cost < ourRate.cost) {
        const rate = inverse
          ? parentRate.rate / pair.rate
          : parentRate.rate * pair.rate
        ourRate = { rate, cost }
      }
    }

    // Only recurse if we have a better score:
    if (ourRate.cost < search.bestRate.cost) {
      searchRoutes(search, currency, ourRate, blacklist)
    }
  }
}

function isFiatCode(currencyCode: string): boolean {
  return /^iso:/.test(currencyCode)
}

/**
 * Create routes to USD if no deep routes to fiat exist. Helpful for hard
 * coded crypto/crypto exchange rates.
 */
function createDeepFiatRoutes(
  search: ExchangeSearch,
  fromCurrency: string
): void {
  const newHints: EdgeRateHint[] = []
  for (const fromRoute of Object.keys(search.routes[fromCurrency])) {
    for (const deepRoute of Object.keys(search.routes[fromRoute])) {
      if (isFiatCode(deepRoute)) return
      newHints.push({ fromCurrency: fromRoute, toCurrency: 'iso:USD' })
    }
  }
  newHints.forEach(hint => addHint(hint.fromCurrency, hint.toCurrency))
}

/**
 * Looks up the best available exchange rate.
 * @param {*} getPairCost a function that assigns scores to currency pairs.
 * Higher scores are worse. The scores add, so longer paths have higher costs
 * than shorter paths. The signature is `(source, age, inverse) => cost`.
 */
export function getExchangeRate(
  state: RootState,
  fromCurrency: string,
  toCurrency: string,
  getPairCost: GetPairCost
): number {
  const { routes, pairs } = state.exchangeCache.rates
  const search: ExchangeSearch = {
    now: Date.now() / 1000,
    routes,
    pairs,
    toCurrency,
    getPairCost,
    bestRate: { rate: 0, cost: Infinity }
  }

  // Only search if the endpoints exist:
  if (search.routes[fromCurrency] && search.routes[toCurrency]) {
    searchRoutes(search, fromCurrency, { rate: 1, cost: 0 }, {})
    if (!isFiatCode(fromCurrency)) createDeepFiatRoutes(search, fromCurrency)
  } else {
    addHint(fromCurrency, toCurrency)
  }

  return search.bestRate.rate
}
