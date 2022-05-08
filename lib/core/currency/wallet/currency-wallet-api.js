 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } }// 

import { add, div, lte, mul, sub } from 'biggystring'

import { bridgifyObject, onMethod, watchMethod } from 'yaob'

























import { mergeDeeply } from '../../../util/util.js'
import {
  contractToTokenId,
  makeMetaTokens,
  upgradeTokenInfo
} from '../../account/custom-tokens.js'
import { toApiInput } from '../../root-pixie.js'
import { makeStorageWalletApi } from '../../storage/storage-api.js'
import { getCurrencyMultiplier } from '../currency-selectors.js'
import { makeCurrencyWalletCallbacks } from './currency-wallet-callbacks.js'
import {

  asEdgeTxSwap,
  packMetadata,
  unpackMetadata
} from './currency-wallet-cleaners.js'
import { dateFilter, searchStringFilter } from './currency-wallet-export.js'
import {
  loadTxFiles,
  renameCurrencyWallet,
  setCurrencyWalletFiat,
  setCurrencyWalletTxMetadata,
  setupNewTxMetadata
} from './currency-wallet-files.js'


import { tokenIdsToCurrencyCodes, uniqueStrings } from './enabled-tokens.js'

const fakeMetadata = {
  bizId: 0,
  category: '',
  exchangeAmount: {},
  name: '',
  notes: ''
}

// The EdgeTransaction.spendTargets type, but non-null:


/**
 * Creates an `EdgeCurrencyWallet` API object.
 */
export function makeCurrencyWalletApi(
  input,
  engine,
  tools,
  publicWalletInfo
) {
  const ai = toApiInput(input)
  const { accountId, pluginId, walletInfo } = input.props.walletState
  const plugin = input.props.state.plugins.currency[pluginId]

  const storageWalletApi = makeStorageWalletApi(ai, walletInfo)

  const fakeCallbacks = makeCurrencyWalletCallbacks(input)

  let otherMethods = {}
  if (engine.otherMethods != null) {
    otherMethods = engine.otherMethods
    bridgifyObject(otherMethods)
  }

  function lockdown() {
    if (ai.props.state.hideKeys) {
      throw new Error('Not available when `hideKeys` is enabled')
    }
  }

  const out = {
    on: onMethod,
    watch: watchMethod,

    // Data store:
    get id() {
      return storageWalletApi.id
    },
    get type() {
      return storageWalletApi.type
    },
    get keys() {
      lockdown()
      return storageWalletApi.keys
    },
    publicWalletInfo,
    get disklet() {
      return storageWalletApi.disklet
    },
    get localDisklet() {
      return storageWalletApi.localDisklet
    },
    async sync() {
      await storageWalletApi.sync()
    },

    // Wallet keys:
    get displayPrivateSeed() {
      lockdown()
      return input.props.walletState.displayPrivateSeed
    },
    get displayPublicSeed() {
      return input.props.walletState.displayPublicSeed
    },

    // Wallet name:
    get name() {
      return input.props.walletState.name
    },
    async renameWallet(name) {
      await renameCurrencyWallet(input, name)
    },

    // Currency info:
    get currencyConfig() {
      const { accountApi } = input.props.output.accounts[accountId]
      return accountApi.currencyConfig[pluginId]
    },
    get currencyInfo() {
      return plugin.currencyInfo
    },
    async validateMemo(memo) {
      if (tools.validateMemo == null) return { passed: true }
      return await tools.validateMemo(memo)
    },
    async nativeToDenomination(
      nativeAmount,
      currencyCode
    ) {
      const multiplier = getCurrencyMultiplier(
        { [pluginId]: input.props.state.plugins.currency[pluginId] },
        input.props.state.accounts[accountId].customTokens[pluginId],
        currencyCode
      )
      return div(nativeAmount, multiplier, multiplier.length)
    },
    async denominationToNative(
      denominatedAmount,
      currencyCode
    ) {
      const multiplier = getCurrencyMultiplier(
        { [pluginId]: input.props.state.plugins.currency[pluginId] },
        input.props.state.accounts[accountId].customTokens[pluginId],
        currencyCode
      )
      return mul(denominatedAmount, multiplier)
    },

    // Fiat currency option:
    get fiatCurrencyCode() {
      return input.props.walletState.fiat
    },
    async setFiatCurrencyCode(fiatCurrencyCode) {
      await setCurrencyWalletFiat(input, fiatCurrencyCode)
    },

    // Chain state:
    get balances() {
      return input.props.walletState.balances
    },

    get blockHeight() {
      return input.props.walletState.height
    },

    get syncRatio() {
      return input.props.walletState.syncRatio
    },

    // Running state:
    get paused() {
      return input.props.walletState.paused
    },
    async changePaused(paused) {
      input.props.dispatch({
        type: 'CURRENCY_WALLET_CHANGED_PAUSED',
        payload: { walletId: input.props.walletId, paused }
      })
    },

    // Tokens:
    get enabledTokenIds() {
      return input.props.walletState.enabledTokenIds
    },

    async changeEnabledTokenIds(tokenIds) {
      const { dispatch, state, walletId, walletState } = input.props
      const { builtinTokens, customTokens } = state.accounts[accountId]
      const { currencyInfo } = walletState

      dispatch({
        type: 'CURRENCY_WALLET_ENABLED_TOKENS_CHANGED',
        payload: {
          walletId,
          currencyCodes: uniqueStrings(
            tokenIdsToCurrencyCodes(
              builtinTokens[pluginId],
              customTokens[pluginId],
              currencyInfo,
              tokenIds
            )
          )
        }
      })
    },

    // Deprecated tokens:
    async changeEnabledTokens(currencyCodes) {
      const { dispatch, walletId } = input.props

      dispatch({
        type: 'CURRENCY_WALLET_ENABLED_TOKENS_CHANGED',
        payload: { walletId, currencyCodes: uniqueStrings(currencyCodes) }
      })
    },

    async enableTokens(currencyCodes) {
      const { dispatch, walletId, walletState } = input.props

      dispatch({
        type: 'CURRENCY_WALLET_ENABLED_TOKENS_CHANGED',
        payload: {
          walletId,
          currencyCodes: uniqueStrings([
            ...walletState.enabledTokens,
            ...currencyCodes
          ])
        }
      })
    },

    async disableTokens(currencyCodes) {
      const { dispatch, walletId, walletState } = input.props

      dispatch({
        type: 'CURRENCY_WALLET_ENABLED_TOKENS_CHANGED',
        payload: {
          walletId,
          currencyCodes: uniqueStrings(walletState.enabledTokens, currencyCodes)
        }
      })
    },

    async getEnabledTokens() {
      return input.props.walletState.enabledTokens
    },

    async addCustomToken(tokenInfo) {
      const token = upgradeTokenInfo(tokenInfo)
      const tokenId = contractToTokenId(tokenInfo.contractAddress)

      // Ask the plugin to validate this:
      if (tools.getTokenId != null) {
        await tools.getTokenId(token)
      } else {
        // This is not ideal, since the pixie will add it too:
        await engine.addCustomToken({ ...token, ...tokenInfo })
      }

      ai.props.dispatch({
        type: 'ACCOUNT_CUSTOM_TOKEN_ADDED',
        payload: { accountId, pluginId, tokenId, token }
      })
    },

    // Transactions:
    async getNumTransactions(
      opts = {}
    ) {
      return engine.getNumTransactions(opts)
    },

    async getTransactions(
      opts = {}
    ) {
      const { currencyCode = plugin.currencyInfo.currencyCode } = opts

      let state = input.props.walletState
      if (!state.gotTxs[currencyCode]) {
        const txs = await engine.getTransactions({
          currencyCode: opts.currencyCode
        })
        fakeCallbacks.onTransactionsChanged(txs)
        input.props.dispatch({
          type: 'CURRENCY_ENGINE_GOT_TXS',
          payload: {
            walletId: input.props.walletId,
            currencyCode
          }
        })
        state = input.props.walletState
      }

      // Txid array of all txs
      const txids = state.txids
      // Merged tx data from metadata files and blockchain data
      const txs = state.txs
      const { startIndex = 0, startEntries = txids.length } = opts
      // Decrypted metadata files
      const files = state.files
      // A sorted list of transaction based on chronological order
      // these are tx id hashes merged between blockchain and cache some tx id hashes
      // some may have been dropped by the blockchain
      const sortedTransactions = state.sortedTransactions.sortedList
      // create map of tx id hashes to their order (cardinality)
      const mappedUnfilteredIndexes = {}
      sortedTransactions.forEach((item, index) => {
        mappedUnfilteredIndexes[item] = index
      })
      // we need to make sure that after slicing, the total txs number is equal to opts.startEntries
      // slice, verify txs in files, if some are dropped and missing, do it again recursively
      let searchedTxs = 0
      let counter = 0
      const out = []
      while (searchedTxs < startEntries) {
        // take a slice from sorted transactions that begins at current index and goes until however many are left
        const slicedTransactions = sortedTransactions.slice(
          startIndex + startEntries * counter,
          startIndex + startEntries * (counter + 1)
        )

        // break loop if slicing starts beyond length of array
        if (slicedTransactions.length === 0) break

        // filter the transactions
        const missingTxIdHashes = slicedTransactions.filter(txidHash => {
          // remove any that do not have a file
          return !files[txidHash]
        })
        // load files into state
        const missingFiles = await loadTxFiles(input, missingTxIdHashes)
        Object.assign(files, missingFiles)
        // give txs the unfilteredIndex

        for (const txidHash of slicedTransactions) {
          const file = files[txidHash]
          if (file == null) continue
          const tempTx = txs[file.txid]
          // skip irrelevant transactions - txs that are not in the files (dropped)
          if (
            !tempTx ||
            (!tempTx.nativeAmount[currencyCode] &&
              !tempTx.networkFee[currencyCode])
          ) {
            // exit block if there is no transaction or no amount / no fee
            continue
          }
          const tx = {
            ...tempTx,
            unfilteredIndex: mappedUnfilteredIndexes[txidHash]
          }
          // add this tx / file to the output
          const edgeTx = combineTxWithFile(input, tx, file, currencyCode)
          if (searchStringFilter(edgeTx, opts) && dateFilter(edgeTx, opts)) {
            out.push(edgeTx)
          }
          searchedTxs++
        }
        counter++
      }
      return out
    },

    async getReceiveAddress(
      opts = {}
    ) {
      const freshAddress = await engine.getFreshAddress(opts)
      const receiveAddress = {
        metadata: fakeMetadata,
        nativeAmount: '0',
        publicAddress: freshAddress.publicAddress,
        legacyAddress: freshAddress.legacyAddress,
        segwitAddress: freshAddress.segwitAddress
      }
      return receiveAddress
    },

    async saveReceiveAddress(
      receiveAddress
    ) {
      // TODO: Address metadata
    },

    async lockReceiveAddress(
      receiveAddress
    ) {
      // TODO: Address metadata
    },

    async makeSpend(spendInfo) {
      const { currencyInfo } = input.props.walletState
      const {
        currencyCode = currencyInfo.currencyCode,
        privateKeys,
        spendTargets = [],
        noUnconfirmed = false,
        networkFeeOption = 'standard',
        customNetworkFee,
        rbfTxid,
        metadata,
        swapData,
        otherParams
      } = spendInfo

      const cleanTargets = []
      const savedTargets = []
      for (const target of spendTargets) {
        const { publicAddress, nativeAmount = '0', otherParams = {} } = target
        if (publicAddress == null) continue

        // Handle legacy spenders:
        let { memo = target.uniqueIdentifier } = target
        if (memo == null && typeof otherParams.uniqueIdentifier === 'string') {
          memo = otherParams.uniqueIdentifier
        }

        // Support legacy currency plugins:
        if (memo != null) {
          otherParams.uniqueIdentifier = memo
        }

        cleanTargets.push({
          memo,
          nativeAmount,
          otherParams,
          publicAddress,
          uniqueIdentifier: memo
        })
        savedTargets.push({
          currencyCode,
          memo,
          nativeAmount,
          publicAddress,
          uniqueIdentifier: memo
        })
      }

      if (cleanTargets.length === 0) {
        throw new TypeError('The spend has no destination')
      }
      if (privateKeys != null) {
        throw new TypeError('Only sweepPrivateKeys takes private keys')
      }

      const tx = await engine.makeSpend({
        currencyCode,
        spendTargets: cleanTargets,
        noUnconfirmed,
        networkFeeOption,
        customNetworkFee,
        rbfTxid,
        metadata,
        otherParams
      })
      tx.networkFeeOption = networkFeeOption
      tx.requestedCustomFee = customNetworkFee
      tx.spendTargets = savedTargets
      if (metadata != null) tx.metadata = metadata
      if (swapData != null) tx.swapData = asEdgeTxSwap(swapData)
      if (input.props.state.login.deviceDescription != null)
        tx.deviceDescription = input.props.state.login.deviceDescription

      return tx
    },

    async sweepPrivateKeys(spendInfo) {
      if (!engine.sweepPrivateKeys) {
        return Promise.reject(
          new Error('Sweeping this currency is not supported.')
        )
      }
      return engine.sweepPrivateKeys(spendInfo)
    },

    async signTx(tx) {
      return engine.signTx(tx)
    },

    async broadcastTx(tx) {
      return engine.broadcastTx(tx)
    },

    async saveTx(tx) {
      await setupNewTxMetadata(input, tx)
      await engine.saveTx(tx)
      fakeCallbacks.onTransactionsChanged([tx])
    },

    get stakingStatus() {
      return input.props.walletState.stakingStatus
    },

    async resyncBlockchain() {
      ai.props.dispatch({
        type: 'CURRENCY_ENGINE_CLEARED',
        payload: { walletId: input.props.walletId }
      })
      await engine.resyncBlockchain()
    },

    async dumpData() {
      return await engine.dumpData()
    },

    async getPaymentProtocolInfo(
      paymentProtocolUrl
    ) {
      if (!engine.getPaymentProtocolInfo) {
        throw new Error(
          "'getPaymentProtocolInfo' is not implemented on wallets of this type"
        )
      }
      return engine.getPaymentProtocolInfo(paymentProtocolUrl)
    },

    async saveTxMetadata(
      txid,
      currencyCode,
      metadata
    ) {
      await setCurrencyWalletTxMetadata(
        input,
        txid,
        currencyCode,
        packMetadata(metadata, input.props.walletState.fiat),
        fakeCallbacks
      )
    },

    async getMaxSpendable(spendInfo) {
      if (typeof engine.getMaxSpendable === 'function') {
        return await engine.getMaxSpendable(spendInfo)
      }
      const { currencyCode, networkFeeOption, customNetworkFee } = spendInfo
      const balance = engine.getBalance({ currencyCode })

      // Copy all the spend targets, setting the amounts to 0
      // but keeping all other information so we can get accurate fees:
      const spendTargets = spendInfo.spendTargets.map(spendTarget => {
        return { ...spendTarget, nativeAmount: '0' }
      })

      // The range of possible values includes `min`, but not `max`.
      function getMax(min, max) {
        const diff = sub(max, min)
        if (lte(diff, '1')) {
          return Promise.resolve(min)
        }
        const mid = add(min, div(diff, '2'))

        // Try the average:
        spendTargets[0].nativeAmount = mid
        return engine
          .makeSpend({
            currencyCode,
            spendTargets,
            networkFeeOption,
            customNetworkFee
          })
          .then(good => getMax(mid, max))
          .catch(bad => getMax(min, mid))
      }

      return getMax('0', add(balance, '1'))
    },

    async parseUri(uri, currencyCode) {
      return tools.parseUri(
        uri,
        currencyCode,
        makeMetaTokens(
          input.props.state.accounts[accountId].customTokens[pluginId]
        )
      )
    },

    async encodeUri(options) {
      return tools.encodeUri(
        options,
        makeMetaTokens(
          input.props.state.accounts[accountId].customTokens[pluginId]
        )
      )
    },

    otherMethods
  }
  bridgifyObject(out)

  return out
}

export function combineTxWithFile(
  input,
  tx,
  file,
  currencyCode
) {
  const wallet = input.props.walletOutput.walletApi
  const walletCurrency = input.props.walletState.currencyInfo.currencyCode
  const walletFiat = input.props.walletState.fiat

  const flowHack = tx
  const { unfilteredIndex } = flowHack

  // Copy the tx properties to the output:
  const out = {
    blockHeight: tx.blockHeight,
    date: tx.date,
    ourReceiveAddresses: tx.ourReceiveAddresses,
    signedTx: tx.signedTx,
    txid: tx.txid,
    otherParams: { ...tx.otherParams, unfilteredIndex },

    amountSatoshi: Number(_nullishCoalesce(tx.nativeAmount[currencyCode], () => ( '0'))),
    nativeAmount: _nullishCoalesce(tx.nativeAmount[currencyCode], () => ( '0')),
    networkFee: _nullishCoalesce(tx.networkFee[currencyCode], () => ( '0')),
    parentNetworkFee: tx.networkFee[walletCurrency],
    currencyCode,
    wallet,
    metadata: {}
  }

  // If we have a file, use it to override the defaults:
  if (file != null) {
    if (file.creationDate < out.date) out.date = file.creationDate

    const merged = mergeDeeply(
      file.currencies[walletCurrency],
      file.currencies[currencyCode]
    )
    if (merged.metadata != null) {
      out.metadata = {
        ...out.metadata,
        ...unpackMetadata(merged.metadata, walletFiat)
      }
    }

    if (file.feeRateRequested != null) {
      if (typeof file.feeRateRequested === 'string') {
        out.networkFeeOption = file.feeRateRequested
      } else {
        out.networkFeeOption = 'custom'
        out.requestedCustomFee = file.feeRateRequested
      }
    }
    out.feeRateUsed = file.feeRateUsed

    if (file.payees != null) {
      out.spendTargets = file.payees.map(payee => ({
        currencyCode: payee.currency,
        memo: payee.tag,
        nativeAmount: payee.amount,
        publicAddress: payee.address,
        uniqueIdentifier: payee.tag
      }))
    }

    if (file.swap != null) out.swapData = asEdgeTxSwap(file.swap)
    if (typeof file.secret === 'string') out.txSecret = file.secret
    if (file.deviceDescription != null)
      out.deviceDescription = file.deviceDescription
  }

  return out
}
