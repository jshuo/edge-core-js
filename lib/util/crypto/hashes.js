// 

import hashjs from 'hash.js'

export function hmacSha1(data, key) {
  const hmac = hashjs.hmac(hashjs.sha1, key)
  return Uint8Array.from(hmac.update(data).digest())
}

export function hmacSha256(data, key) {
  const hmac = hashjs.hmac(hashjs.sha256, key)
  return Uint8Array.from(hmac.update(data).digest())
}

export function hmacSha512(data, key) {
  const hmac = hashjs.hmac(hashjs.sha512, key)
  return Uint8Array.from(hmac.update(data).digest())
}

export function sha256(data) {
  const hash = hashjs.sha256()
  return Uint8Array.from(hash.update(data).digest())
}
