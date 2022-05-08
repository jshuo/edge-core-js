// 

import { makeContext, makeFakeWorld } from './core/core.js'
import { defaultOnLog } from './core/log/log.js'
import { makeBrowserIo } from './io/browser/browser-io.js'








export { makeBrowserIo }
export {
  addEdgeCorePlugins,
  closeEdge,
  lockEdgeCorePlugins,
  makeFakeIo
} from './core/core.js'
export * from './types/types.js'

export function makeEdgeContext(
  opts
) {
  const { crashReporter, onLog = defaultOnLog } = opts
  return makeContext(
    { io: makeBrowserIo(), nativeIo: {} },
    { crashReporter, onLog },
    opts
  )
}

export function makeFakeEdgeWorld(
  users = [],
  opts = {}
) {
  const { crashReporter, onLog = defaultOnLog } = opts
  return Promise.resolve(
    makeFakeWorld(
      { io: makeBrowserIo(), nativeIo: {} },
      { crashReporter, onLog },
      users
    )
  )
}
