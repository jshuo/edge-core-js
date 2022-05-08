// 

import { uncleaner } from 'cleaners'

import {
  asChangeRecovery2Payload,
  asQuestionChoicesPayload,
  asRecovery2InfoPayload
} from '../../types/server-cleaners.js'




import { decrypt, decryptText, encrypt } from '../../util/crypto/crypto.js'
import { hmacSha256 } from '../../util/crypto/hashes.js'
import { utf8 } from '../../util/encoding.js'

import { applyKit, serverLogin } from './login.js'
import { loginFetch } from './login-fetch.js'
import { fixUsername, getStash } from './login-selectors.js'


const wasChangeRecovery2Payload = uncleaner(asChangeRecovery2Payload)

function recovery2Id(recovery2Key, username) {
  const data = utf8.parse(fixUsername(username))
  return hmacSha256(data, recovery2Key)
}

function recovery2Auth(
  recovery2Key,
  answers
) {
  return answers.map(answer => {
    const data = utf8.parse(answer)
    return hmacSha256(data, recovery2Key)
  })
}

/**
 * Logs a user in using recovery answers.
 * @return A `Promise` for the new root login.
 */
export async function loginRecovery2(
  ai,
  recovery2Key,
  username,
  answers,
  opts
) {
  const stashTree = getStash(ai, username)

  // Request:
  const request = {
    recovery2Id: recovery2Id(recovery2Key, username),
    recovery2Auth: recovery2Auth(recovery2Key, answers)
  }
  return serverLogin(ai, stashTree, stashTree, opts, request, async reply => {
    if (reply.recovery2Box == null) {
      throw new Error('Missing data for recovery v2 login')
    }
    return decrypt(reply.recovery2Box, recovery2Key)
  })
}

/**
 * Fetches the questions for a login
 * @param username string
 * @param recovery2Key an ArrayBuffer recovery key
 * @param Question array promise
 */
export function getQuestions2(
  ai,
  recovery2Key,
  username
) {
  const request = {
    recovery2Id: recovery2Id(recovery2Key, username)
    // "otp": null
  }
  return loginFetch(ai, 'POST', '/v2/login', request).then(reply => {
    const { question2Box } = asRecovery2InfoPayload(reply)
    if (question2Box == null) {
      throw new Error('Login has no recovery questions')
    }

    // Decrypt the questions:
    return JSON.parse(decryptText(question2Box, recovery2Key))
  })
}

export async function changeRecovery(
  ai,
  accountId,
  questions,
  answers
) {
  const { loginTree, username } = ai.props.state.accounts[accountId]

  const kit = makeRecovery2Kit(ai, loginTree, username, questions, answers)
  await applyKit(ai, loginTree, kit)
}

export async function deleteRecovery(
  ai,
  accountId
) {
  const { loginTree } = ai.props.state.accounts[accountId]

  const kit = {
    serverMethod: 'DELETE',
    serverPath: '/v2/login/recovery2',
    stash: {
      recovery2Key: undefined
    },
    login: {
      recovery2Key: undefined
    },
    loginId: loginTree.loginId
  }
  await applyKit(ai, loginTree, kit)
}

/**
 * Creates the data needed to attach recovery questions to a login.
 */
export function makeRecovery2Kit(
  ai,
  login,
  username,
  questions,
  answers
) {
  const { io } = ai.props
  if (!Array.isArray(questions)) {
    throw new TypeError('Questions must be an array of strings')
  }
  if (!Array.isArray(answers)) {
    throw new TypeError('Answers must be an array of strings')
  }

  const { loginId, loginKey, recovery2Key = io.random(32) } = login
  const question2Box = encrypt(
    io,
    utf8.parse(JSON.stringify(questions)),
    recovery2Key
  )
  const recovery2Box = encrypt(io, loginKey, recovery2Key)
  const recovery2KeyBox = encrypt(io, recovery2Key, loginKey)

  return {
    serverPath: '/v2/login/recovery2',
    server: wasChangeRecovery2Payload({
      recovery2Id: recovery2Id(recovery2Key, username),
      recovery2Auth: recovery2Auth(recovery2Key, answers),
      recovery2Box,
      recovery2KeyBox,
      question2Box
    }),
    stash: {
      recovery2Key
    },
    login: {
      recovery2Key
    },
    loginId
  }
}

export async function listRecoveryQuestionChoices(
  ai
) {
  return asQuestionChoicesPayload(
    await loginFetch(ai, 'POST', '/v1/questions', {})
  )
}
