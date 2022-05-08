









import { addHiddenProperties } from '../../util/util.js'






function makeLogMethod(
  onLog,
  type,
  source
) {
  return function log() {
    let message = ''
    for (let i = 0; i < arguments.length; ++i) {
      const arg = arguments[i]
      if (i > 0) message += ' '
      message += typeof arg === 'string' ? arg : JSON.stringify(arg, null, 2)
    }

    onLog({ message, source, time: new Date(), type })
  }
}

export function defaultOnLog(event) {
  const prettyDate = event.time
    .toISOString()
    .replace(/.*(\d\d-\d\d)T(\d\d:\d\d:\d\d).*/, '$1 $2')
  console.info(`${prettyDate} ${event.source}: ${event.message}`)
}

export function filterLogs(
  backend,
  getSettings
) {
  function onLog(event) {
    const { sources, defaultLogLevel } = getSettings()

    const logLevel =
      sources[event.source] != null ? sources[event.source] : defaultLogLevel

    switch (event.type) {
      case 'info':
        if (logLevel === 'info') backend.onLog(event)
        break
      case 'warn':
        if (logLevel === 'info' || logLevel === 'warn') backend.onLog(event)
        break
      case 'error':
        if (logLevel !== 'silent') backend.onLog(event)
        break
    }
  }
  return { ...backend, onLog }
}

export function makeLog(backend, source) {
  const { onLog, crashReporter } = backend

  return addHiddenProperties(makeLogMethod(onLog, 'info', source), {
    breadcrumb(message, metadata) {
      const time = new Date()
      if (crashReporter != null) {
        crashReporter.logBreadcrumb({ message, metadata, source, time })
      } else {
        message = `${message} ${JSON.stringify(metadata, null, 2)}`
        onLog({ message, source, time, type: 'warn' })
      }
    },
    crash(error, metadata) {
      const time = new Date()
      if (crashReporter != null) {
        crashReporter.logCrash({ error, metadata, source, time })
      } else {
        const message = `${String(error)} ${JSON.stringify(metadata, null, 2)}`
        onLog({ message, source, time, type: 'error' })
      }
    },
    warn: makeLogMethod(onLog, 'warn', source),
    error: makeLogMethod(onLog, 'error', source)
  })
}
