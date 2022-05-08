// 

import { uncleaner } from 'cleaners'




/**
 * A wrapper that knows how to load and save JSON files,
 * with parsing, stringifying, and cleaning.
 */





export function makeJsonFile(cleaner) {
  const wasData = uncleaner(cleaner)
  return {
    async load(disklet, path) {
      try {
        return cleaner(JSON.parse(await disklet.getText(path)))
      } catch (e) {}
    },
    async save(disklet, path, data) {
      await disklet.setText(path, JSON.stringify(wasData(data)))
    }
  }
}

/**
 * A cleaner for something that must be an object,
 * but we don't care about the keys inside:
 */
export const asJsonObject = raw => {
  if (raw == null || typeof raw !== 'object') {
    throw new TypeError('Expected a JSON object')
  }
  return raw
}
