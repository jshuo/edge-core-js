// 

import {


  combinePixies,
  stopUpdates
} from 'redux-pixies'
import { base16 } from 'rfc4648'


import { utf8 } from '../../util/encoding.js'











/**
 * Prevents a function from running in parallel.
 * The currently-running operation must finish before the new one starts.
 */
function serialize(
  f
) {
  let lastTask = Promise.resolve()
  return function serialize(...args) {
    const onDone = () => f.apply(this, args)
    const out = lastTask.then(onDone, onDone)
    lastTask = out
    return out
  }
}

export function calcSnrpForTarget(
  salt,
  benchMs,
  targetMs
) {
  const snrp = {
    salt_hex: salt,
    n: 16384,
    r: 8,
    p: 1
  }

  if (benchMs === 0) {
    snrp.n = 131072
    snrp.r = 8
    snrp.p = 64
    return snrp
  }

  let timeUsed = benchMs // Estimated time in ms the current setting will take on current device

  //
  // Add additional r value first. This increases memory usage
  // Each additional increment of 'r' is approximately a linear increase in time.
  //
  const STARTING_R = 8
  const MAX_R = 8
  const REMAINING_R = MAX_R - STARTING_R
  const perRValue = benchMs / STARTING_R // The amount of ms delay each increment of 'r' creates
  let addR = (targetMs - timeUsed) / perRValue
  addR = addR > 0 ? addR : 0
  if (addR > REMAINING_R) {
    addR = REMAINING_R
  }
  addR = Math.floor(addR)
  snrp.r = STARTING_R + addR
  timeUsed += addR * perRValue

  //
  // Add additional N value in powers of 2. Each power of 2 doubles the amount of time it takes
  // to calculate the hash
  //
  let nPow = 14 // 2^14 = 16384 which is the minimum safe N value

  // Iteratively calculate the amount of additional N values we can add
  // Max out at N = 17
  let addN = (targetMs - timeUsed) / timeUsed
  addN = addN > 0 ? addN : 0
  if (addN > 3) {
    addN = 3
  }
  addN = Math.floor(addN)
  nPow += addN >= 0 ? addN : 0
  timeUsed += addN * timeUsed

  snrp.n = Math.pow(2, nPow)

  //
  // Add additional p value which increases parallelization factor
  // Max out at p = 64
  //
  let addP = (targetMs - timeUsed) / timeUsed
  addP = addP > 0 ? addP : 0
  if (addP > 64) {
    addP = 64
  }
  addP = Math.floor(addP)
  snrp.p = addP >= 1 ? addP : 1
  timeUsed += addP * timeUsed

  return snrp
}

export const scrypt = combinePixies({
  makeSnrp: (input) => () => {
    const { io, log } = input.props
    let benchmark

    function makeSnrp(targetMs) {
      // Run the benchmark if needed:
      if (benchmark == null) {
        benchmark = input.props.output.scrypt
          .timeScrypt(utf8.parse('1reallyJunkiePasswordToCheck'), {
            salt_hex: base16.parse(
              'b5865ffb9fa7b3bfe4b2384d47ce831ee22a4a9d5c34c7ef7d21467cc758f81b'
            ),
            n: 16384,
            r: 8,
            p: 1
          })
          .then(result => result.time)
      }

      // Calculate an SNRP value:
      return benchmark.then(benchMs => {
        const snrp = calcSnrpForTarget(io.random(32), benchMs, targetMs)
        log(
          `snrp for ${targetMs}ms target: ${snrp.n} ${snrp.r} ${snrp.p} based on ${benchMs}ms benchmark`
        )
        return snrp
      })
    }

    input.onOutput(makeSnrp)
    return stopUpdates
  },

  timeScrypt: (input) => () => {
    const { io, log } = input.props

    // Find the best timer on this platform:
    const getTime =
      typeof window !== 'undefined' &&
      window.performance &&
      typeof window.performance.now === 'function'
        ? () => window.performance.now()
        : () => Date.now()

    // Performs an scrypt calculation, recording the elapsed time:
    function timeScrypt(
      data,
      snrp,
      dklen = 32
    ) {
      const salt = snrp.salt_hex
      const startTime = getTime()
      log(`starting scrypt n=${snrp.n} r=${snrp.r} p=${snrp.p}`)
      return io.scrypt(data, salt, snrp.n, snrp.r, snrp.p, dklen).then(hash => {
        const time = getTime() - startTime
        log(`finished scrypt n=${snrp.n} r=${snrp.r} p=${snrp.p} in ${time}ms`)
        return { hash, time }
      })
    }

    // We only allow one scrypt calculation to occur at once:
    input.onOutput(serialize(timeScrypt))
    return stopUpdates
  }
})
