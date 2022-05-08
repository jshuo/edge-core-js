// 

import { makeLocalStorageDisklet } from 'disklet'






import { scrypt } from '../../util/crypto/scrypt.js'

/**
 * Extracts the io functions we need from the browser.
 */
export function makeBrowserIo() {
  if (typeof window === 'undefined') {
    throw new Error('No `window` object')
  }
  if (window.crypto == null || window.crypto.getRandomValues == null) {
    throw new Error('No secure random number generator in this browser')
  }

  return {
    // Crypto:
    random: size => {
      const out = new Uint8Array(size)
      window.crypto.getRandomValues(out)
      return out
    },
    scrypt,

    // Local io:
    console,
    disklet: makeLocalStorageDisklet(window.localStorage, {
      prefix: 'airbitz'
    }),

    // Networking:
    fetch(uri, opts) {
      return window.fetch(uri, opts)
    }
  }
}
