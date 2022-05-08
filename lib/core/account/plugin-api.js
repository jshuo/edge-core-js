 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } }// 

import { Bridgeable, bridgifyObject } from 'yaob'











import { uniqueStrings } from '../currency/wallet/enabled-tokens.js'
import { getCurrencyTools } from '../plugins/plugins-selectors.js'

import {
  changePluginUserSettings,
  changeSwapSettings
} from './account-files.js'
import { getTokenId } from './custom-tokens.js'

const emptyTokens = {}

/**
 * Access to an individual currency plugin's methods.
 */
export class CurrencyConfig extends Bridgeable {
  
  
  

  

  constructor(ai, accountId, pluginId) {
    super()
    this._ai = ai
    this._accountId = accountId
    this._pluginId = pluginId

    const { otherMethods } = ai.props.state.plugins.currency[pluginId]
    if (otherMethods != null) {
      bridgifyObject(otherMethods)
      this.otherMethods = otherMethods
    } else {
      this.otherMethods = {}
    }
  }

  get currencyInfo() {
    return this._ai.props.state.plugins.currency[this._pluginId].currencyInfo
  }

  get allTokens() {
    const { state } = this._ai.props
    const { _accountId: accountId, _pluginId: pluginId } = this
    return state.accounts[accountId].allTokens[pluginId]
  }

  get builtinTokens() {
    const { state } = this._ai.props
    const { _accountId: accountId, _pluginId: pluginId } = this
    return state.accounts[accountId].builtinTokens[pluginId]
  }

  get customTokens() {
    const { state } = this._ai.props
    const { _accountId: accountId, _pluginId: pluginId } = this
    return _nullishCoalesce(state.accounts[accountId].customTokens[pluginId], () => ( emptyTokens))
  }

  async addCustomToken(token) {
    const { _accountId: accountId, _ai: ai, _pluginId: pluginId } = this
    const tokenId = await getTokenId(ai, pluginId, token)

    ai.props.dispatch({
      type: 'ACCOUNT_CUSTOM_TOKEN_ADDED',
      payload: { accountId, pluginId, tokenId, token }
    })
    return tokenId
  }

  async changeCustomToken(tokenId, token) {
    const { _accountId: accountId, _ai: ai, _pluginId: pluginId } = this
    const oldToken =
      ai.props.state.accounts[accountId].customTokens[pluginId][tokenId]
    if (oldToken == null) {
      throw new Error(`There is no token with id "${tokenId}"`)
    }
    const newTokenId = await getTokenId(ai, pluginId, token)
    ai.props.dispatch({
      type: 'ACCOUNT_CUSTOM_TOKEN_ADDED',
      payload: { accountId, pluginId, tokenId: newTokenId, token }
    })

    // Do we need to tweak enabled tokens?
    if (oldToken.currencyCode !== token.currencyCode) {
      const { wallets } = ai.props.state.currency
      for (const walletId of Object.keys(wallets)) {
        const walletState = wallets[walletId]
        if (
          walletState.accountId !== accountId ||
          walletState.pluginId !== pluginId ||
          walletState.enabledTokens.indexOf(oldToken.currencyCode) < 0
        ) {
          continue
        }

        // We rely on redux to check for actual differences,
        // and to trigger the matching disk & engine updates if needed:
        ai.props.dispatch({
          type: 'CURRENCY_WALLET_ENABLED_TOKENS_CHANGED',
          payload: {
            walletId,
            currencyCodes: uniqueStrings(
              [...walletState.enabledTokens, token.currencyCode],
              [oldToken.currencyCode]
            )
          }
        })
      }
    }

    // Remove the old token if the tokenId changed:
    if (newTokenId !== tokenId) {
      ai.props.dispatch({
        type: 'ACCOUNT_CUSTOM_TOKEN_REMOVED',
        payload: { accountId, pluginId, tokenId }
      })
    }
  }

  async removeCustomToken(tokenId) {
    const { _accountId: accountId, _ai: ai, _pluginId: pluginId } = this

    ai.props.dispatch({
      type: 'ACCOUNT_CUSTOM_TOKEN_REMOVED',
      payload: { accountId, pluginId, tokenId }
    })
  }

  get userSettings() {
    const accountState = this._ai.props.state.accounts[this._accountId]
    return accountState.userSettings[this._pluginId]
  }

  async changeUserSettings(settings) {
    await changePluginUserSettings(
      this._ai,
      this._accountId,
      this._pluginId,
      settings
    )
  }

  async importKey(
    userInput,
    opts = {}
  ) {
    const tools = await getCurrencyTools(this._ai, this._pluginId)

    if (tools.importPrivateKey == null) {
      throw new Error('This wallet does not support importing keys')
    }
    const keys = await tools.importPrivateKey(userInput, opts.keyOptions)
    return { ...keys, imported: true }
  }
}

export class SwapConfig extends Bridgeable {
  
  
  

  constructor(ai, accountId, pluginId) {
    super()
    this._ai = ai
    this._accountId = accountId
    this._pluginId = pluginId
  }

  get enabled() {
    const { swapSettings } = this._ai.props.state.accounts[this._accountId]
    const { enabled = true } =
      swapSettings[this._pluginId] != null ? swapSettings[this._pluginId] : {}
    return enabled
  }

  get needsActivation() {
    const plugin = this._ai.props.state.plugins.swap[this._pluginId]
    if (plugin.checkSettings == null) return false

    const accountState = this._ai.props.state.accounts[this._accountId]
    const settings = accountState.userSettings[this._pluginId] || {}
    return !!plugin.checkSettings(settings).needsActivation
  }

  get swapInfo() {
    return this._ai.props.state.plugins.swap[this._pluginId].swapInfo
  }

  get userSettings() {
    const accountState = this._ai.props.state.accounts[this._accountId]
    return accountState.userSettings[this._pluginId]
  }

  async changeEnabled(enabled) {
    const account = this._ai.props.state.accounts[this._accountId]
    return changeSwapSettings(this._ai, this._accountId, this._pluginId, {
      ...account.swapSettings[this._pluginId],
      enabled
    })
  }

  async changeUserSettings(settings) {
    await changePluginUserSettings(
      this._ai,
      this._accountId,
      this._pluginId,
      settings
    )
  }
}
