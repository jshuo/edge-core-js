




import { hmacSha256 } from '../../util/crypto/hashes.js'
import { base58, utf8 } from '../../util/encoding.js'

import { encryptDisklet } from './encrypt-disklet.js'

export function getStorageWalletLastChanges(
  state,
  walletId
) {
  return state.storageWallets[walletId].lastChanges
}

export function getStorageWalletDisklet(
  state,
  walletId
) {
  return state.storageWallets[walletId].paths.disklet
}

export function getStorageWalletLocalDisklet(
  state,
  walletId
) {
  return state.storageWallets[walletId].localDisklet
}

export function makeStorageWalletLocalEncryptedDisklet(
  state,
  walletId,
  io
) {
  return encryptDisklet(
    io,
    state.storageWallets[walletId].paths.dataKey,
    state.storageWallets[walletId].localDisklet
  )
}

export function hashStorageWalletFilename(
  state,
  walletId,
  data
) {
  const dataKey = state.storageWallets[walletId].paths.dataKey
  return base58.stringify(hmacSha256(utf8.parse(data), dataKey))
}
