// AI Generated code <PURPOSE>: generate and verify unguessable REST access tokens
import { createHash, randomBytes, randomInt } from 'node:crypto'

const QUIZ_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const QUIZ_CODE_LENGTH = 8
const TOKEN_BYTES = 32

export type TokenService = Readonly<{
  generateQuizCode: () => string
  generateToken: () => string
  hashToken: (token: string) => string
}>

export const defaultTokenService: TokenService = {
  generateQuizCode() {
    let code = ''

    for (let index = 0; index < QUIZ_CODE_LENGTH; index += 1) {
      code += QUIZ_CODE_ALPHABET[randomInt(QUIZ_CODE_ALPHABET.length)]
    }

    return code
  },

  generateToken() {
    return randomBytes(TOKEN_BYTES).toString('base64url')
  },

  hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex')
  },
}

export const extractBearerToken = (authorizationHeader: string | undefined): string | null => {
  if (!authorizationHeader) {
    return null
  }

  const parts = authorizationHeader.trim().split(/\s+/)
  const [scheme, token] = parts

  if (parts.length !== 2 || scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }

  return token
}
