

 // @ts-delete

// How often to run jobs from the queue
let QUEUE_RUN_DELAY = 500

// How many jobs to run from the queue on each cycle
let QUEUE_JOBS_PER_RUN = 3







const updateQueue = []
let timeout

export function enableTestMode() {
  QUEUE_JOBS_PER_RUN = 99
  QUEUE_RUN_DELAY = 1
}

export function pushUpdate(update) {
  if (updateQueue.length <= 0) {
    startQueue()
  }
  let didUpdate = false
  for (const u of updateQueue) {
    if (u.id === update.id && u.action === update.action) {
      u.updateFunc = update.updateFunc
      didUpdate = true
      break
    }
  }
  if (!didUpdate) {
    updateQueue.push(update)
  }
}

export function removeIdFromQueue(id) {
  for (let i = 0; i < updateQueue.length; i++) {
    const update = updateQueue[i]
    if (id === update.id) {
      updateQueue.splice(i, 1)
      break
    }
  }
  if (updateQueue.length <= 0 && timeout != null) {
    clearTimeout(timeout)
  }
}

function startQueue() {
  timeout = setTimeout(() => {
    const numJobs = Math.min(QUEUE_JOBS_PER_RUN, updateQueue.length)
    for (let i = 0; i < numJobs; i++) {
      const u = updateQueue.shift()
      if (u != null) u.updateFunc()
    }
    if (updateQueue.length > 0) {
      startQueue()
    }
  }, QUEUE_RUN_DELAY)
}
