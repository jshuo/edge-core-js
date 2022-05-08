// 

import { navigateDisklet } from 'disklet'












import { makeLog } from '../log/log.js'









const allPlugins = {}
let allPluginsLocked = false
const onPluginsAdded = []
const onPluginsLocked = []

/**
 * Adds plugins to the core.
 */
export function addEdgeCorePlugins(plugins) {
  if (allPluginsLocked) {
    throw new Error('The Edge core plugin list has already been locked')
  }

  // Save the new plugins:
  for (const pluginId in plugins) {
    allPlugins[pluginId] = plugins[pluginId]
  }

  // Update already-booted contexts:
  for (const f of onPluginsAdded) f(plugins)
}

/**
 * Finalizes the core plugin list, so no further plugins are expected.
 */
export function lockEdgeCorePlugins() {
  allPluginsLocked = true
  for (const f of onPluginsLocked) f()
}

/**
 * Subscribes a context object to the core plugin list.
 */
export function watchPlugins(
  ios,
  logBackend,
  pluginsInit,
  dispatch
) {
  const { io, nativeIo } = ios

  function pluginsAdded(plugins) {
    const out = {}

    for (const pluginId in plugins) {
      const plugin = plugins[pluginId]
      const log = makeLog(logBackend, pluginId)
      const initOptions = pluginsInit[pluginId]
      if (!initOptions) continue

      // Figure out what kind of object this is:
      try {
        if (typeof plugin === 'function') {
          const opts = {
            initOptions: typeof initOptions === 'object' ? initOptions : {},
            io,
            log,
            nativeIo,
            pluginDisklet: navigateDisklet(io.disklet, 'plugins/' + pluginId)
          }
          out[pluginId] = plugin(opts)
        } else if (typeof plugin === 'object' && plugin != null) {
          out[pluginId] = plugin
        } else {
          throw new TypeError(
            `Plugins must be functions or objects, got ${typeof plugin}`
          )
        }
      } catch (error) {
        // Show the error but keep going:
        log.error(error)
      }
    }

    dispatch({ type: 'CORE_PLUGINS_ADDED', payload: out })
  }

  function pluginsLocked() {
    dispatch({ type: 'CORE_PLUGINS_LOCKED', payload: pluginsInit })
  }

  // Add any plugins currently available:
  pluginsAdded(allPlugins)
  if (allPluginsLocked) pluginsLocked()

  // Save the callbacks:
  onPluginsAdded.push(pluginsAdded)
  onPluginsLocked.push(pluginsLocked)

  return () => {
    onPluginsAdded.filter(f => f !== pluginsAdded)
    onPluginsLocked.filter(f => f !== pluginsLocked)
  }
}
