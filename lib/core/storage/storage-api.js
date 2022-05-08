





import { syncStorageWallet } from './storage-actions.js'
import {
  getStorageWalletDisklet,
  getStorageWalletLocalDisklet
} from './storage-selectors.js'










export function makeStorageWalletApi(
  ai,
  walletInfo
) {
  const { id, type, keys } = walletInfo

  return {
    // Broken-out key info:
    id,
    type,
    keys,

    // Folders:
    get disklet() {
      return getStorageWalletDisklet(ai.props.state, id)
    },

    get localDisklet() {
      return getStorageWalletLocalDisklet(ai.props.state, id)
    },

    async sync() {
      await syncStorageWallet(ai, id)
    }
  }
}
