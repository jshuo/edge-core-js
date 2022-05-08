// 











export function makeNativeBridge(
  doCall
) {
  const list = makePendingList()
  return {
    call(name, ...args) {
      return new Promise((resolve, reject) => {
        doCall(list.add({ resolve, reject }), name, args)
      })
    },
    resolve(id, value) {
      list.grab(id).resolve(value)
    },
    reject(id, message) {
      list.grab(id).reject(new Error(message))
    }
  }
}

/**
 * A pending call into native code.
 */













function makePendingList() {
  const dummyCall = { resolve() {}, reject() {} }
  let lastId = 0

  if (typeof Map !== 'undefined') {
    // Better map-based version:
    const map = new Map()
    return {
      add(call) {
        const id = ++lastId
        map.set(id, call)
        return id
      },
      grab(id) {
        const call = map.get(id)
        if (call == null) return dummyCall
        map.delete(id)
        return call
      }
    }
  }

  // Slower object-based version:
  const map = {}
  return {
    add(call) {
      const id = ++lastId
      map[String(id)] = call
      return id
    },
    grab(id) {
      const call = map[String(id)]
      if (call == null) return dummyCall
      delete map[String(id)]
      return call
    }
  }
}
