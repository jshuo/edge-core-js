// 

import Transaction from 'ethereumjs-tx'
import { privateToAddress, toChecksumAddress } from 'ethereumjs-util'



/**
 * This function needs to live inside the webpack bundle
 * to produce the right `Buffer` type.
 */
function hexToBuffer(hex) {
  return Buffer.from(hex.replace(/^0x/, ''), 'hex')
}

export function ethereumKeyToAddress(key) {
  try {
    const addressBytes = privateToAddress(hexToBuffer(key))
    return toChecksumAddress(addressBytes.toString('hex'))
  } catch (e) {
    return 'invalid_private_key'
  }
}

export function signEthereumTransaction(
  ethereumKey,
  transaction
) {
  const tx = new Transaction(transaction)
  tx.sign(hexToBuffer(ethereumKey))
  return tx.serialize().toString('hex')
}
