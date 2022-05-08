// 

import { asObject, asString } from 'cleaners'
import { justFiles, justFolders } from 'disklet'
import { bridgifyObject } from 'yaob'


import { makeJsonFile } from '../../util/file-helpers.js'

import {
  getStorageWalletDisklet,
  hashStorageWalletFilename
} from '../storage/storage-selectors.js'

/**
 * Each data store folder has a "Name.json" file with this format.
 */
const storeIdFile = makeJsonFile(
  asObject({
    name: asString
  })
)

/**
 * The items saved in a data store have this format.
 */
const storeItemFile = makeJsonFile(
  asObject({
    key: asString,
    data: asString
  })
)

export function makeDataStoreApi(
  ai,
  accountId
) {
  const { accountWalletInfo } = ai.props.state.accounts[accountId]
  const disklet = getStorageWalletDisklet(ai.props.state, accountWalletInfo.id)

  // Path manipulation:
  const hashName = (data) =>
    hashStorageWalletFilename(ai.props.state, accountWalletInfo.id, data)
  const getStorePath = (storeId) =>
    `Plugins/${hashName(storeId)}`
  const getItemPath = (storeId, itemId) =>
    `${getStorePath(storeId)}/${hashName(itemId)}.json`

  const out = {
    async deleteItem(storeId, itemId) {
      await disklet.delete(getItemPath(storeId, itemId))
    },

    async deleteStore(storeId) {
      await disklet.delete(getStorePath(storeId))
    },

    async listItemIds(storeId) {
      const itemIds = []
      const paths = justFiles(await disklet.list(getStorePath(storeId)))
      await Promise.all(
        paths.map(async path => {
          const clean = await storeItemFile.load(disklet, path)
          if (clean != null) itemIds.push(clean.key)
        })
      )
      return itemIds
    },

    async listStoreIds() {
      const storeIds = []
      const paths = justFolders(await disklet.list('Plugins'))
      await Promise.all(
        paths.map(async path => {
          const clean = await storeIdFile.load(disklet, `${path}/Name.json`)
          if (clean != null) storeIds.push(clean.name)
        })
      )
      return storeIds
    },

    async getItem(storeId, itemId) {
      const clean = await storeItemFile.load(
        disklet,
        getItemPath(storeId, itemId)
      )
      if (clean == null) throw new Error(`No item named "${itemId}"`)
      return clean.data
    },

    async setItem(
      storeId,
      itemId,
      value
    ) {
      // Set up the plugin folder, if needed:
      const namePath = `${getStorePath(storeId)}/Name.json`
      const clean = await storeIdFile.load(disklet, namePath)
      if (clean == null) {
        await storeIdFile.save(disklet, namePath, { name: storeId })
      } else if (clean.name !== storeId) {
        throw new Error(`Warning: folder name doesn't match for ${storeId}`)
      }

      // Set up the actual item:
      await storeItemFile.save(disklet, getItemPath(storeId, itemId), {
        key: itemId,
        data: value
      })
    }
  }
  bridgifyObject(out)

  return out
}
