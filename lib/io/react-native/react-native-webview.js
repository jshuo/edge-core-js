const _jsxFileName = "src/io/react-native/react-native-webview.js";// 

import '../../client-side.js'

import * as React from 'react'
import { requireNativeComponent } from 'react-native'

import { bridgifyObject } from 'yaob'

import { NetworkError } from '../../types/types.js'





import { makeYaobCallbacks } from './yaob-callbacks.js'








/**
 * Launches the Edge core worker in a WebView and returns its API.
 */
export class EdgeCoreBridge extends React.Component {
  

  constructor(props) {
    super(props)
    const { onError, onLoad } = props

    // Set up the native IO objects:
    const clientIo = bridgifyObject({
      // Networking:
      fetchCors
    })

    // Set up the YAOB bridge:
    this.callbacks = makeYaobCallbacks((root) => {
      onLoad(clientIo, root).catch(onError)
    })
  }

  render() {
    const { allowDebugging = false, debug = false, onError } = this.props

    return (
      React.createElement(NativeWebView, {
        ref: this.callbacks.setRef,
        allowDebugging: debug || allowDebugging,
        source: debug ? 'http://localhost:8080/edge-core.js' : null,
        style: { opacity: 0, position: 'absolute', height: 1, width: 1 },
        onMessage: this.callbacks.handleMessage,
        onScriptError: event => {
          if (onError != null) {
            onError(new Error(`Cannot load "${event.nativeEvent.source}"`))
          }
        }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 51}}
      )
    )
  }
}

const NativeWebView = requireNativeComponent(
  'EdgeCoreWebView'
)

/**
 * Turns XMLHttpRequest headers into a more JSON-like structure.
 */
function extractHeaders(headers) {
  const pairs = headers.split('\r\n')

  const out = {}
  for (const pair of pairs) {
    const index = pair.indexOf(': ')
    if (index < 0) continue
    out[pair.slice(0, index).toLowerCase()] = pair.slice(index + 2)
  }
  return out
}

/**
 * Fetches data from the React Native side, where CORS doesn't apply.
 */
function fetchCors(
  uri,
  opts = {}
) {
  const { body, headers = {}, method = 'GET' } = opts

  return new Promise((resolve, reject) => {
    const xhr = new window.XMLHttpRequest()

    // Event handlers:
    function handleError() {
      reject(new NetworkError(`Could not reach ${uri}`))
    }

    function handleLoad() {
      const headers = xhr.getAllResponseHeaders()
      resolve({
        body: xhr.response,
        headers: extractHeaders(headers == null ? '' : headers),
        status: xhr.status
      })
    }

    // Set up the request:
    xhr.open(method, uri, true)
    xhr.responseType = 'arraybuffer'
    xhr.onerror = handleError
    xhr.ontimeout = handleError
    xhr.onload = handleLoad
    for (const name of Object.keys(headers)) {
      xhr.setRequestHeader(name, headers[name])
    }
    xhr.send(body)
  })
}
