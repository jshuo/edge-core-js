const _jsxFileName = "src/react-native.js";// 

import { makeReactNativeDisklet } from 'disklet'
import * as React from 'react'
import { base64 } from 'rfc4648'
import { bridgifyObject } from 'yaob'

import { defaultOnLog } from './core/log/log.js'
import { parseReply } from './core/login/login-fetch.js'
import { EdgeCoreBridge } from './io/react-native/react-native-webview.js'




import { asMessagesPayload } from './types/server-cleaners.js'
import {



  NetworkError
} from './types/types.js'
import { timeout } from './util/promise.js'

export { makeFakeIo } from './core/fake/fake-io.js'
export * from './types/types.js'

function onErrorDefault(e) {
  console.error(e)
}

let warningShown = false

export function MakeEdgeContext(props) {
  const {
    allowDebugging,
    debug,
    nativeIo,
    pluginUris = [],
    onError = onErrorDefault,
    onLoad,
    ...rest
  } = props
  if (onLoad == null) {
    throw new TypeError('No onLoad passed to MakeEdgeContext')
  }
  if (props.options != null && !warningShown) {
    warningShown = true
    console.warn(
      'The MakeEdgeContext options prop is deprecated - just pass the context options as normal props.'
    )
  }
  const options = { ...props.options, ...rest }
  const { crashReporter, onLog = defaultOnLog } = options

  return (
    React.createElement(EdgeCoreBridge, {
      allowDebugging: allowDebugging,
      debug: debug,
      onError: onError,
      onLoad: (clientIo, root) =>
        root
          .makeEdgeContext(
            clientIo,
            bridgifyNativeIo(nativeIo),
            bridgifyLogBackend({ crashReporter, onLog }),
            pluginUris,
            options
          )
          .then(onLoad)
      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 56}}
    )
  )
}

export function MakeFakeEdgeWorld(props) {
  const {
    allowDebugging,
    crashReporter,
    debug,
    nativeIo,
    pluginUris = [],

    onError = onErrorDefault,
    onLoad,
    onLog = defaultOnLog
  } = props
  if (onLoad == null) {
    throw new TypeError('No onLoad passed to MakeFakeEdgeWorld')
  }

  return (
    React.createElement(EdgeCoreBridge, {
      allowDebugging: allowDebugging,
      debug: debug,
      onError: onError,
      onLoad: (clientIo, root) =>
        root
          .makeFakeEdgeWorld(
            clientIo,
            bridgifyNativeIo(nativeIo),
            bridgifyLogBackend({ crashReporter, onLog }),
            pluginUris,
            props.users
          )
          .then(onLoad)
      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 92}}
    )
  )
}

function bridgifyNativeIo(nativeIo = {}) {
  const out = {}
  for (const key of Object.keys(nativeIo)) {
    out[key] = bridgifyObject(nativeIo[key])
  }
  return out
}

function bridgifyLogBackend(backend) {
  if (backend.crashReporter != null) bridgifyObject(backend.crashReporter)
  return bridgifyObject(backend)
}

/**
 * Fetches any login-related messages for all the users on this device.
 */
export async function fetchLoginMessages(
  apiKey
) {
  const disklet = makeReactNativeDisklet()

  // Load the login stashes from disk:
  const loginMap = {} // loginId -> username
  const listing = await disklet.list('logins')
  const files = await Promise.all(
    Object.keys(listing)
      .filter(path => listing[path] === 'file')
      .map(path => disklet.getText(path).catch(() => '{}'))
  )
  for (const text of files) {
    try {
      const { username, loginId } = JSON.parse(text)
      if (loginId == null || username == null) continue
      loginMap[loginId] = username
    } catch (e) {}
  }

  const uri = 'https://auth.airbitz.co/api/v2/messages'
  const opts = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      authorization: `Token ${apiKey}`
    },
    body: JSON.stringify({ loginIds: Object.keys(loginMap) })
  }

  return timeout(
    window.fetch(uri, opts),
    30000,
    new NetworkError('Could not reach the auth server: timeout')
  ).then(response => {
    if (!response.ok) {
      throw new Error(`${uri} return status code ${response.status}`)
    }

    return response.json().then(json => {
      const clean = asMessagesPayload(parseReply(json))
      const out = {}
      for (const message of clean) {
        const { loginId, ...rest } = message
        const id = base64.stringify(loginId)
        const username = loginMap[id]
        if (username != null) out[username] = { ...rest, loginId: id }
      }
      return out
    })
  })
}
