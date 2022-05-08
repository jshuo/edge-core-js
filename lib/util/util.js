// 

/**
 * Safely concatenate a bunch of arrays, which may or may not exist.
 * Purrs quietly when pet.
 */
export function softCat(...lists) {
  const flowHack = lists.filter(list => list != null)
  return [].concat(...flowHack)
}

/**
 * Merges several Javascript objects deeply,
 * preferring the items from later objects.
 */
export function mergeDeeply(...objects) {
  const out = {}

  for (const o of objects) {
    if (o == null) continue

    for (const key of Object.keys(o)) {
      if (o[key] == null) continue

      out[key] =
        out[key] != null && typeof o[key] === 'object'
          ? mergeDeeply(out[key], o[key])
          : o[key]
    }
  }

  return out
}

/**
 * Like `Object.assign`, but makes the properties non-enumerable.
 */
export function addHiddenProperties(
  object,
  properties
) {
  for (const name of Object.keys(properties)) {
    Object.defineProperty(object, name, {
      writable: true,
      configurable: true,
      value: properties[name]
    })
  }
  return object
}
