// AI Generated code centralize typed backend environment configuration
type BackendEnv = Readonly<{
  DATABASE_URL: string
  REDIS_URL: string
  PORT: number
}>

const readRequired = (name: string): string => {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is required`)
  }

  return value
}

const readPort = (): number => {
  const rawPort = process.env.PORT?.trim() || '3000'
  const port = Number(rawPort)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535')
  }

  return port
}

export const env: BackendEnv = {
  DATABASE_URL: readRequired('DATABASE_URL'),
  REDIS_URL: readRequired('REDIS_URL'),
  PORT: readPort(),
}

