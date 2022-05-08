


import { bridgifyObject } from 'yaob'

import { asEdgeBox } from '../../types/server-cleaners.js'

import { decrypt, decryptText, encrypt } from '../../util/crypto/crypto.js'
import { utf8 } from '../../util/encoding.js'

export function encryptDisklet(
  io,
  dataKey,
  disklet
) {
  const out = {
    delete(path) {
      return disklet.delete(path)
    },

    getData(path) {
      return disklet
        .getText(path)
        .then(text => asEdgeBox(JSON.parse(text)))
        .then(box => decrypt(box, dataKey))
    },

    getText(path) {
      return disklet
        .getText(path)
        .then(text => asEdgeBox(JSON.parse(text)))
        .then(box => decryptText(box, dataKey))
    },

    list(path) {
      return disklet.list(path)
    },

    setData(path, data) {
      const dataCast = data // Work around `Uint8Array.from` flow bug
      return disklet.setText(
        path,
        JSON.stringify(encrypt(io, Uint8Array.from(dataCast), dataKey))
      )
    },

    setText(path, text) {
      return this.setData(path, utf8.parse(text))
    }
  }
  bridgifyObject(out)
  return out
}
