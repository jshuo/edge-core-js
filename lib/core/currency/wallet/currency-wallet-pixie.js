 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } }


import {


  combinePixies,
  filterPixie,
  stopUpdates
} from 'redux-pixies'
import { update } from 'yaob'









import { makeJsonFile } from '../../../util/file-helpers.js'
import { makePeriodicTask } from '../../../util/periodic-task.js'
import { snooze } from '../../../util/snooze.js'
import { makeTokenInfo } from '../../account/custom-tokens.js'
import { makeLog } from '../../log/log.js'
import { getCurrencyTools } from '../../plugins/plugins-selectors.js'
import { toApiInput } from '../../root-pixie.js'
import {
  addStorageWallet,
  syncStorageWallet
} from '../../storage/storage-actions.js'
import {
  getStorageWalletLocalDisklet,
  makeStorageWalletLocalEncryptedDisklet
} from '../../storage/storage-selectors.js'
import { makeCurrencyWalletApi } from './currency-wallet-api.js'
import {
  makeCurrencyWalletCallbacks,
  watchCurrencyWallet
} from './currency-wallet-callbacks.js'
import { asPublicKeyFile } from './currency-wallet-cleaners.js'
import { changeEnabledTokens, loadAllFiles } from './currency-wallet-files.js'
import {

  initialEnabledTokens
} from './currency-wallet-reducer.js'
import { uniqueStrings } from './enabled-tokens.js'














const PUBLIC_KEY_CACHE = 'publicKey.json'
const publicKeyFile = makeJsonFile(asPublicKeyFile)

export const walletPixie = combinePixies({
  // Creates the engine for this wallet:
  engine: (input) => async () => {
    const { state, walletId, walletState } = input.props
    const { accountId, pluginId, walletInfo } = walletState
    const plugin = state.plugins.currency[pluginId]

    try {
      // Start the data sync:
      const ai = toApiInput(input)
      await addStorageWallet(ai, walletInfo)

      // Grab the freshly-synced repos:
      const { state } = input.props
      const walletLocalDisklet = getStorageWalletLocalDisklet(
        state,
        walletInfo.id
      )
      const walletLocalEncryptedDisklet = makeStorageWalletLocalEncryptedDisklet(
        state,
        walletInfo.id,
        input.props.io
      )

      // Derive the public keys:
      const tools = await getCurrencyTools(ai, pluginId)
      const publicWalletInfo = await getPublicWalletInfo(
        walletInfo,
        walletLocalDisklet,
        tools
      )
      const mergedWalletInfo = {
        id: walletInfo.id,
        type: walletInfo.type,
        keys: { ...walletInfo.keys, ...publicWalletInfo.keys }
      }
      input.props.dispatch({
        type: 'CURRENCY_WALLET_PUBLIC_INFO',
        payload: { walletInfo: publicWalletInfo, walletId }
      })

      // Start the engine:
      const accountState = state.accounts[accountId]
      const engine = await plugin.makeCurrencyEngine(mergedWalletInfo, {
        callbacks: makeCurrencyWalletCallbacks(input),

        // Wallet-scoped IO objects:
        log: makeLog(
          input.props.logBackend,
          `${plugin.currencyInfo.currencyCode}-${walletInfo.id.slice(0, 2)}`
        ),
        walletLocalDisklet,
        walletLocalEncryptedDisklet,

        // User settings:
        customTokens: _nullishCoalesce(accountState.customTokens[pluginId], () => ( {})),
        enabledTokenIds: input.props.walletState.enabledTokenIds,
        userSettings: _nullishCoalesce(accountState.userSettings[pluginId], () => ( {}))
      })
      input.props.dispatch({
        type: 'CURRENCY_ENGINE_CHANGED_SEEDS',
        payload: {
          displayPrivateSeed: engine.getDisplayPrivateSeed(),
          displayPublicSeed: engine.getDisplayPublicSeed(),
          walletId
        }
      })
      input.onOutput(engine)

      // Grab initial state:
      const { currencyCode } = plugin.currencyInfo
      const balance = engine.getBalance({ currencyCode })
      const height = engine.getBlockHeight()
      input.props.dispatch({
        type: 'CURRENCY_ENGINE_CHANGED_BALANCE',
        payload: { balance, currencyCode, walletId }
      })
      input.props.dispatch({
        type: 'CURRENCY_ENGINE_CHANGED_HEIGHT',
        payload: { height, walletId }
      })
      if (engine.getStakingStatus != null) {
        engine.getStakingStatus().then(stakingStatus => {
          input.props.dispatch({
            type: 'CURRENCY_ENGINE_CHANGED_STAKING',
            payload: { stakingStatus, walletId }
          })
        })
      }
    } catch (error) {
      input.props.onError(error)
      input.props.dispatch({
        type: 'CURRENCY_ENGINE_FAILED',
        payload: { error, walletId }
      })
    }

    // Reload our data from disk:
    loadAllFiles(input).catch(e => input.props.onError(e))

    // Fire callbacks when our state changes:
    watchCurrencyWallet(input)

    return stopUpdates
  },

  // Creates the API object:
  walletApi: (input) => async () => {
    const { walletOutput, walletState } = input.props
    if (walletOutput == null) return
    const { engine } = walletOutput
    const { nameLoaded, pluginId, publicWalletInfo } = walletState
    if (engine == null || publicWalletInfo == null || !nameLoaded) return
    const tools = await getCurrencyTools(toApiInput(input), pluginId)

    const currencyWalletApi = makeCurrencyWalletApi(
      input,
      engine,
      tools,
      publicWalletInfo
    )
    input.onOutput(currencyWalletApi)

    return stopUpdates
  },

  // Starts & stops the engine for this wallet:
  engineStarted: filterPixie(
    (input) => {
      let startupPromise

      return {
        update() {
          const { log, walletId, walletOutput, walletState } = input.props
          if (walletOutput == null) return
          const { engine, walletApi } = walletOutput
          if (
            walletApi == null ||
            !walletState.fiatLoaded ||
            !walletState.fileNamesLoaded ||
            walletState.engineStarted
          ) {
            return
          }

          if (engine != null && startupPromise == null) {
            log(`${walletId} startEngine`)
            input.props.dispatch({
              type: 'CURRENCY_ENGINE_STARTED',
              payload: { walletId }
            })

            // Turn synchronous errors into promise rejections:
            startupPromise = Promise.resolve()
              .then(() => engine.startEngine())
              .catch(e => input.props.onError(e))
          }
        },

        destroy() {
          const { log, walletId, walletOutput } = input.props
          if (walletOutput == null) return
          const { engine } = walletOutput

          if (engine != null && startupPromise != null) {
            log(`${walletId} killEngine`)

            // Wait for `startEngine` to finish if that is still going:
            startupPromise
              .then(() => engine.killEngine())
              .catch(e => input.props.onError(e))
              .then(() =>
                input.props.dispatch({
                  type: 'CURRENCY_ENGINE_STOPPED',
                  payload: { walletId }
                })
              )
              .catch(() => {})
          }
        }
      }
    },
    props =>
      props.state.paused || props.walletState.paused ? undefined : props
  ),

  syncTimer: filterPixie(
    (input) => {
      async function doSync() {
        const { walletId } = input.props
        await syncStorageWallet(toApiInput(input), walletId)
      }

      // We don't report sync failures, since that could be annoying:
      const task = makePeriodicTask(doSync, 30 * 1000)

      return {
        update() {
          const { state, walletId, walletOutput } = input.props
          if (walletOutput == null) return

          // Start once the wallet has loaded & finished its initial sync:
          if (
            state.storageWallets[walletId] != null &&
            state.storageWallets[walletId].status.lastSync > 0
          ) {
            task.start({ wait: true })
          }
        },

        destroy() {
          task.stop()
        }
      }
    },
    props =>
      props.state.paused || props.walletState.paused ? undefined : props
  ),

  /**
   * Watches for changes to the token state, and writes those to disk.
   *
   * The pixie system ensures that multiple `update` calls will not occur
   * at once. This way, if the GUI makes dozens of quick token changes,
   * we will consolidate those down to a single write to disk.
   */
  tokenSaver(input) {
    let lastEnabledTokens = initialEnabledTokens

    return async function update() {
      const { enabledTokens } = input.props.walletState
      if (enabledTokens !== lastEnabledTokens && enabledTokens != null) {
        await changeEnabledTokens(input, enabledTokens).catch(error =>
          input.props.onError(error)
        )
        await snooze(100) // Rate limiting
      }
      lastEnabledTokens = enabledTokens
    }
  },

  watcher(input) {
    let lastState
    let lastSettings = {}
    let lastTokens = {}
    let lastEnabledTokens = initialEnabledTokens

    return async () => {
      const { state, walletState, walletOutput } = input.props
      if (walletState == null || walletOutput == null) return
      const { engine, walletApi } = walletOutput
      const { accountId, pluginId } = walletState
      const accountState = state.accounts[accountId]

      // Update API object:
      if (lastState !== walletState && walletApi != null) {
        update(walletApi)
      }
      lastState = walletState

      // Update engine settings:
      const userSettings = _nullishCoalesce(accountState.userSettings[pluginId], () => ( lastSettings))
      if (lastSettings !== userSettings && engine != null) {
        engine.changeUserSettings(userSettings)
      }
      lastSettings = userSettings

      // Update the custom tokens:
      const customTokens = _nullishCoalesce(accountState.customTokens[pluginId], () => ( lastTokens))
      if (lastTokens !== customTokens && engine != null) {
        if (engine.changeCustomTokens != null) {
          engine.changeCustomTokens(customTokens)
        } else {
          for (const tokenId of Object.keys(customTokens)) {
            const token = customTokens[tokenId]
            if (token === lastTokens[tokenId]) continue
            const tokenInfo = makeTokenInfo(token)
            if (tokenInfo == null) continue
            await engine
              .addCustomToken({ ...tokenInfo, ...token })
              .catch(e => input.props.onError(e))
          }
        }
      }
      lastTokens = customTokens

      // Update enabled tokens:
      const { enabledTokens } = walletState
      if (lastEnabledTokens !== enabledTokens && engine != null) {
        if (engine.changeEnabledTokenIds != null) {
          await engine
            .changeEnabledTokenIds(walletState.enabledTokenIds)
            .catch(e => input.props.onError(e))
        } else {
          await engine
            .disableTokens(uniqueStrings(lastEnabledTokens, enabledTokens))
            .catch(e => input.props.onError(e))
          await engine
            .enableTokens(uniqueStrings(enabledTokens, lastEnabledTokens))
            .catch(e => input.props.onError(e))
        }
      }
      lastEnabledTokens = enabledTokens
    }
  }
})

/**
 * Attempts to load/derive the wallet public keys.
 */
async function getPublicWalletInfo(
  walletInfo,
  disklet,
  tools
) {
  // Try to load the cache:
  const publicKeyCache = await publicKeyFile.load(disklet, PUBLIC_KEY_CACHE)
  if (publicKeyCache != null) return publicKeyCache.walletInfo

  // Derive the public keys:
  let publicKeys = {}
  try {
    publicKeys = await tools.derivePublicKey(walletInfo)
  } catch (e) {}
  const publicWalletInfo = {
    id: walletInfo.id,
    type: walletInfo.type,
    keys: publicKeys
  }

  // Save the cache if it's not empty:
  if (Object.keys(publicKeys).length > 0) {
    await publicKeyFile.save(disklet, PUBLIC_KEY_CACHE, {
      walletInfo: publicWalletInfo
    })
  }

  return publicWalletInfo
}
