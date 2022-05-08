








/**
 * Finds the currency plugin that can handle a particular wallet type,
 * or throws an error if there is none.
 */
export function findCurrencyPluginId(
  plugins,
  walletType
) {
  const pluginId = maybeFindCurrencyPluginId(plugins, walletType)
  if (pluginId == null) {
    throw new Error(
      `Cannot find a currency plugin for wallet type ${walletType}`
    )
  }
  return pluginId
}

/**
 * Finds the currency plugin that can handle a particular wallet type,
 * or `undefined` if there is none.
 */
export function maybeFindCurrencyPluginId(
  plugins,
  walletType
) {
  return Object.keys(plugins).find(
    pluginId => plugins[pluginId].currencyInfo.walletType === walletType
  )
}

/**
 * Finds the currency tools for a particular wallet type,
 * loading them if needed.
 */
export function getCurrencyTools(
  ai,
  pluginId
) {
  const { dispatch, state } = ai.props

  // Already loaded / loading:
  const tools = state.plugins.currencyTools[pluginId]
  if (tools != null) return tools

  // Never touched, so start the load:
  const plugin = state.plugins.currency[pluginId]
  const promise = plugin.makeCurrencyTools()
  dispatch({
    type: 'CURRENCY_TOOLS_LOADED',
    payload: { pluginId, tools: promise }
  })
  return promise
}

/**
 * Waits for the plugins to load,
 * then validates that all plugins are present.
 */
export async function waitForPlugins(ai) {
  await ai.waitFor((props) => {
    const { init, locked } = props.state.plugins
    if (!locked) return

    const { currency, rate, swap } = props.state.plugins
    const missingPlugins = []
    for (const pluginId in init) {
      if (
        !!init[pluginId] &&
        currency[pluginId] == null &&
        rate[pluginId] == null &&
        swap[pluginId] == null
      ) {
        missingPlugins.push(pluginId)
      }
    }
    if (missingPlugins.length > 0) {
      throw new Error(
        'The following plugins are missing or failed to load: ' +
          missingPlugins.join(', ')
      )
    }

    return true
  })
}
