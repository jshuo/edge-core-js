// @flow

import { type ReturnType } from '../types/types.js' // @ts-delete

type PeriodicTaskOptions = {
  // Handles any errors that the task throws or rejects with:
  onError?: (error: mixed) => void
}

type StartOptions = {
  // True to start in the waiting state, skipping the first run:
  wait?: boolean
}

export type PeriodicTask = {
  start(opts?: StartOptions): void,
  stop(): void,

  // True once start is called, false after stop is called:
  +started: boolean
}

/**
 * Schedule a repeating task, with the specified gap between runs.
 */
export function makePeriodicTask(
  task: () => Promise<void> | void,
  msGap: number,
  opts: PeriodicTaskOptions = {}
): PeriodicTask {
  const { onError = (e: mixed) => {} } = opts

  // A started task will keep bouncing between running & waiting.
  // The `running` flag will be true in the running state,
  // and `timeout` will have a value in the waiting state.
  let running = false
  let timeout: ReturnType<typeof setTimeout> | void

  function startRunning(): void {
    timeout = undefined
    if (!out.started) return
    running = true
    new Promise(resolve => resolve(task()))
      .catch(onError)
      .then(startWaiting, startWaiting)
  }

  function startWaiting(): void {
    running = false
    if (!out.started) return
    timeout = setTimeout(startRunning, msGap)
  }

  const out = {
    started: false,

    start(opts: StartOptions = {}): void {
      const { wait = false } = opts
      out.started = true
      if (!running && timeout == null) wait ? startWaiting() : startRunning()
    },

    stop(): void {
      out.started = false
      if (timeout != null) {
        clearTimeout(timeout)
        timeout = undefined
      }
    }
  }
  return out
}
