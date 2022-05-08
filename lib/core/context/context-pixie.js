// 

import { combinePixies, stopUpdates } from 'redux-pixies'
import { close, update } from 'yaob'



import { makeContextApi } from './context-api.js'





export const context = combinePixies({
  api(ai) {
    return {
      destroy() {
        close(ai.props.output.context.api)
      },
      update() {
        ai.onOutput(makeContextApi(ai))
        return stopUpdates
      }
    }
  },

  watcher(ai) {
    let lastLocalUsers, lastPaused, lastLogSettings

    return () => {
      if (
        lastLocalUsers !== ai.props.state.login.localUsers ||
        lastPaused !== ai.props.state.paused ||
        lastLogSettings !== ai.props.state.logSettings
      ) {
        lastLocalUsers = ai.props.state.login.localUsers
        lastPaused = ai.props.state.paused
        lastLogSettings = ai.props.state.logSettings
        if (ai.props.output.context.api != null) {
          update(ai.props.output.context.api)
        }
      }
    }
  }
})
