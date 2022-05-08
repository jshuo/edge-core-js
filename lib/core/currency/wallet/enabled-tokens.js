 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } }






function flipTokenMap(
  tokens
) {
  const out = {}
  for (const tokenId of Object.keys(tokens)) {
    const token = tokens[tokenId]
    out[token.currencyCode] = tokenId
  }
  return out
}

export function currencyCodesToTokenIds(
  builtinTokens = {},
  customTokens = {},
  currencyInfo,
  currencyCodes
) {
  const builtinIds = flipTokenMap(builtinTokens)
  const customIds = flipTokenMap(customTokens)

  const out = []
  for (const currencyCode of currencyCodes) {
    const tokenId = _nullishCoalesce(customIds[currencyCode], () => ( builtinIds[currencyCode]))
    if (tokenId != null) out.push(tokenId)
  }
  return out
}

export function tokenIdsToCurrencyCodes(
  builtinTokens = {},
  customTokens = {},
  currencyInfo,
  tokenIds
) {
  const out = []
  for (const tokenId of tokenIds) {
    const token = _nullishCoalesce(customTokens[tokenId], () => ( builtinTokens[tokenId]))
    if (token != null) out.push(token.currencyCode)
  }
  return out
}

/**
 * Returns the unique items of an array,
 * optionally removing the items in `omit`.
 */
export function uniqueStrings(array, omit = []) {
  const table = {}
  for (const item of omit) table[item] = true

  const out = []
  for (const item of array) {
    if (table[item]) continue
    table[item] = true
    out.push(item)
  }
  return out
}
