// 

import { mergeDisklets, navigateDisklet } from 'disklet'

import { base16 } from 'rfc4648'


import { sha256 } from '../../util/crypto/hashes.js'
import { base58 } from '../../util/encoding.js'
import { encryptDisklet } from './encrypt-disklet.js'





const CHANGESET_MAX_ENTRIES = 100






/**
 * Sets up the back-end folders needed to emulate Git on disk.
 * You probably don't want this.
 */
export function makeRepoPaths(
  io,
  syncKey,
  dataKey
) {
  const baseDisklet = navigateDisklet(
    io.disklet,
    'repos/' + base58.stringify(sha256(sha256(syncKey)))
  )
  const changesDisklet = navigateDisklet(baseDisklet, 'changes')
  const dataDisklet = navigateDisklet(baseDisklet, 'data')
  const disklet = encryptDisklet(
    io,
    dataKey,
    mergeDisklets(changesDisklet, dataDisklet)
  )

  return {
    dataKey,
    syncKey,

    baseDisklet,
    changesDisklet,
    dataDisklet,
    disklet
  }
}

export function loadRepoStatus(
  paths
) {
  const fallback = { lastSync: 0, lastHash: undefined }
  return paths.baseDisklet
    .getText('status.json')
    .then(text => ({ lastSync: 0, ...JSON.parse(text) }))
    .catch(e => fallback)
}

/**
 * This will save a change-set into the local storage.
 * This function ignores folder-level deletes and overwrites,
 * but those can't happen under the current rules anyhow.
 */
export async function saveChanges(
  disklet,
  changes
) {
  await Promise.all(
    Object.keys(changes).map(path => {
      const json = changes[path]
      return json != null
        ? disklet.setText(path, JSON.stringify(json))
        : disklet.delete(path)
    })
  )
}

/**
 * Synchronizes the local store with the remote server.
 */
export async function syncRepo(
  syncClient,
  paths,
  status
) {
  const { changesDisklet, dataDisklet, syncKey } = paths

  const ourChanges


 = await deepListWithLimit(changesDisklet).then(paths => {
    return Promise.all(
      paths.map(async path => ({
        path,
        json: JSON.parse(await changesDisklet.getText(path))
      }))
    )
  })

  const syncKeyEncoded = base16.stringify(syncKey).toLowerCase()

  // Send a read request if no changes present locally, otherwise bundle the
  // changes with the a update request.
  const reply = await (() => {
    // Read the repo if no changes present locally.
    if (ourChanges.length === 0) {
      return syncClient.readRepo(syncKeyEncoded, status.lastHash)
    }

    // Write local changes to the repo.
    const changes = {}
    for (const change of ourChanges) {
      changes[change.path] = change.json
    }
    return syncClient.updateRepo(syncKeyEncoded, status.lastHash, { changes })
  })()

  // Make the request:
  const { changes = {}, hash } = reply

  // Save the incoming changes into our `data` folder:
  await saveChanges(dataDisklet, changes)

  // Delete any changed keys (since the upload is done):
  await Promise.all(
    ourChanges.map(change => changesDisklet.delete(change.path))
  )

  // Update the repo status:
  status.lastSync = Date.now() / 1000
  if (hash != null) status.lastHash = hash
  return await paths.baseDisklet
    .setText('status.json', JSON.stringify(status))
    .then(() => ({ status, changes }))
}

/**
 * Lists all files in a disklet, recursively up to a limit.
 * Returns a list of full paths.
 */
async function deepListWithLimit(
  disklet,
  path = '',
  limit = CHANGESET_MAX_ENTRIES
) {
  const list = await disklet.list(path)
  const paths = Object.keys(list).filter(path => list[path] === 'file')
  const folders = Object.keys(list).filter(path => list[path] === 'folder')

  // Loop over folders to get subpaths
  for (const folder of folders) {
    if (paths.length >= limit) break
    const remaining = limit - paths.length
    const subpaths = await deepListWithLimit(disklet, folder, remaining)
    paths.push(...subpaths.slice(0, remaining))
  }

  return paths
}
