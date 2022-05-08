 function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }// 

import { asMaybe, asObject, asString } from 'cleaners'









import { makeJsonFile } from '../../util/file-helpers.js'
import {
  getCurrencyTools,
  maybeFindCurrencyPluginId
} from '../plugins/plugins-selectors.js'

import { getStorageWalletDisklet } from '../storage/storage-selectors.js'
import { asCustomTokensFile, asGuiSettingsFile } from './account-cleaners.js'

const customTokensFile = makeJsonFile(asCustomTokensFile)
const guiSettingsFile = makeJsonFile(asGuiSettingsFile)
const CUSTOM_TOKENS_FILE = 'CustomTokens.json'
const GUI_SETTINGS_FILE = 'Settings.json'

/**
 * The `networkLocation` field is untyped,
 * but many currency plugins will put a contract address in there.
 */
const asMaybeContractLocation = asMaybe(
  asObject({
    contractAddress: asString
  })
)

/**
 * We need to validate the token before we can add it.
 *
 * If the plugin has a `getTokenId` method, just use that.
 *
 * Otherwise, we need to call `EdgeCurrencyEngine.addCustomToken`
 * to validate the contract address, and then guess the tokenId from that.
 */
export async function getTokenId(
  ai,
  pluginId,
  token
) {
  // The normal code path:
  const tools = await getCurrencyTools(ai, pluginId)
  if (tools.getTokenId != null) {
    return await tools.getTokenId(token)
  }

  // Find an engine (any engine) to validate our token:
  const engine = findEngine(ai, pluginId)
  if (engine == null) {
    throw new Error(
      'A wallet must exist before adding tokens to a legacy currency plugin'
    )
  }

  // Validate the token:
  const tokenInfo = makeTokenInfo(token)
  if (tokenInfo == null) {
    throw new Error(
      'A token must have a contract address to be added to a legacy currency plugin'
    )
  }
  engine.addCustomToken({ ...tokenInfo, ...token })

  return contractToTokenId(tokenInfo.contractAddress)
}

export function contractToTokenId(contractAddress) {
  return contractAddress.toLowerCase().replace(/^0x/, '')
}

export function upgradeTokenInfo(info) {
  const { currencyCode, currencyName, contractAddress, multiplier } = info

  return {
    currencyCode,
    denominations: [{ multiplier, name: currencyCode }],
    displayName: currencyName,
    networkLocation: { contractAddress }
  }
}

function upgradeMetaTokens(metaTokens) {
  const out = {}
  for (const metaToken of metaTokens) {
    const { contractAddress } = metaToken
    if (contractAddress == null) continue
    out[contractToTokenId(contractAddress)] = {
      currencyCode: metaToken.currencyCode,
      denominations: metaToken.denominations,
      displayName: metaToken.currencyName,
      networkLocation: { contractAddress: metaToken.contractAddress }
    }
  }
  return out
}

export function makeMetaToken(token) {
  const { currencyCode, displayName, denominations, networkLocation } = token
  const cleanLocation = asMaybeContractLocation(networkLocation)

  return {
    currencyCode,
    currencyName: displayName,
    denominations,
    contractAddress: _optionalChain([cleanLocation, 'optionalAccess', _ => _.contractAddress])
  }
}

export function makeMetaTokens(tokens = {}) {
  const out = []
  for (const tokenId of Object.keys(tokens)) {
    out.push(makeMetaToken(tokens[tokenId]))
  }
  return out
}

export function makeTokenInfo(token) {
  const { currencyCode, displayName, denominations, networkLocation } = token
  const cleanLocation = asMaybeContractLocation(networkLocation)
  if (cleanLocation == null) return

  return {
    currencyCode,
    currencyName: displayName,
    multiplier: denominations[0].multiplier,
    contractAddress: cleanLocation.contractAddress
  }
}

export async function loadBuiltinTokens(
  ai,
  accountId
) {
  const { dispatch, state } = ai.props

  // Load builtin tokens:
  await Promise.all(
    Object.keys(state.plugins.currency).map(async pluginId => {
      const plugin = state.plugins.currency[pluginId]
      const tokens =
        plugin.getBuiltinTokens == null
          ? upgradeMetaTokens(plugin.currencyInfo.metaTokens)
          : await plugin.getBuiltinTokens()
      dispatch({
        type: 'ACCOUNT_BUILTIN_TOKENS_LOADED',
        payload: { accountId, pluginId, tokens }
      })
    })
  )
}

function findEngine(ai, pluginId) {
  for (const walletId of Object.keys(ai.props.state.currency.wallets)) {
    const walletOutput = ai.props.output.currency.wallets[walletId]
    if (
      walletOutput != null &&
      walletOutput.engine != null &&
      ai.props.state.currency.wallets[walletId].pluginId === pluginId
    ) {
      return walletOutput.engine
    }
  }
}

async function loadGuiTokens(
  ai,
  accountId
) {
  const { state } = ai.props
  const { accountWalletInfo } = state.accounts[accountId]
  const disklet = getStorageWalletDisklet(state, accountWalletInfo.id)

  const file = await guiSettingsFile.load(disklet, GUI_SETTINGS_FILE)
  if (file == null) return {}

  const out = {}
  for (const guiToken of file.customTokens) {
    if (!guiToken.isVisible) continue

    // Find the plugin:
    const pluginId = maybeFindCurrencyPluginId(
      state.plugins.currency,
      guiToken.walletType
    )
    if (pluginId == null) continue
    if (out[pluginId] == null) out[pluginId] = {}

    // Add it to the list:
    const tokenId = contractToTokenId(guiToken.contractAddress)
    out[pluginId][tokenId] = {
      currencyCode: guiToken.currencyCode,
      denominations: guiToken.denominations,
      displayName: guiToken.currencyName,
      networkLocation: {
        contractAddress: guiToken.contractAddress
      }
    }
  }
  return out
}

export async function loadCustomTokens(
  ai,
  accountId
) {
  const { dispatch, state } = ai.props
  const { accountWalletInfo } = state.accounts[accountId]
  const disklet = getStorageWalletDisklet(state, accountWalletInfo.id)

  // Load the file:
  const file = await customTokensFile.load(disklet, CUSTOM_TOKENS_FILE)
  if (file == null) return loadGuiTokens(ai, accountId)
  const { customTokens } = file

  dispatch({
    type: 'ACCOUNT_CUSTOM_TOKENS_LOADED',
    payload: { accountId, customTokens }
  })
  return customTokens
}

export async function saveCustomTokens(
  ai,
  accountId
) {
  const { state } = ai.props
  const { accountWalletInfo } = state.accounts[accountId]
  const disklet = getStorageWalletDisklet(state, accountWalletInfo.id)
  const { customTokens } = ai.props.state.accounts[accountId]

  // Refresh the file:
  const file = await customTokensFile.load(disklet, CUSTOM_TOKENS_FILE)
  customTokensFile.save(disklet, CUSTOM_TOKENS_FILE, { ...file, customTokens })
}
