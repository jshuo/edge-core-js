

 // @ts-delete



















/**
 * Schedule a repeating task, with the specified gap between runs.
 */
export function makePeriodicTask(
  task,
  msGap,
  opts = {}
) {
  const { onError = (e) => {} } = opts

  // A started task will keep bouncing between running & waiting.
  // The `running` flag will be true in the running state,
  // and `timeout` will have a value in the waiting state.
  let running = false
  let timeout

  function startRunning() {
    timeout = undefined
    if (!out.started) return
    running = true
    new Promise(resolve => resolve(task()))
      .catch(onError)
      .then(startWaiting, startWaiting)
  }

  function startWaiting() {
    running = false
    if (!out.started) return
    timeout = setTimeout(startRunning, msGap)
  }

  const out = {
    started: false,

    start(opts = {}) {
      const { wait = false } = opts
      out.started = true
      if (!running && timeout == null) wait ? startWaiting() : startRunning()
    },

    stop() {
      out.started = false
      if (timeout != null) {
        clearTimeout(timeout)
        timeout = undefined
      }
    }
  }
  return out
}
