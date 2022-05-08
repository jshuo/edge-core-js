// 

import { bridgifyObject, onMethod } from 'yaob'






import { getExchangeRate } from './exchange-selectors.js'

const biasDefaults = {
  edgeRates: 0.15,
  nomics: 0.1,
  coincap: -0.05,
  coinbase: -0.1,
  coinmonitor: -0.2,
  wazirx: -0.15,
  constantRate: -0.25
}

/**
 * Creates an unwrapped exchange cache API object.
 */
export function makeExchangeCache(ai) {
  const out = {
    on: onMethod,

    async convertCurrency(
      fromCurrency,
      toCurrency,
      amount = 1,
      opts = {}
    ) {
      const { biases = biasDefaults } = opts

      function getPairCost(
        source,
        age,
        inverse
      ) {
        // The age curve goes from 0 to 1, with 1 being infinitely old.
        // The curve reaches half way (0.5) at 30 seconds in:
        const ageCurve = age / (30 + age)
        const bias = biases[source] != null ? biases[source] : 0
        return ageCurve + bias + (inverse ? 1.1 : 1)
      }

      const rate = getExchangeRate(
        ai.props.state,
        fromCurrency,
        toCurrency,
        getPairCost
      )
      return amount * rate
    }
  }
  bridgifyObject(out)

  return out
}
