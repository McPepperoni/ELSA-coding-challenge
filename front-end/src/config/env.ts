// AI Generated code centralize typed frontend environment configuration
type FrontendEnv = Readonly<{
  API_URL: string
}>

const readRequiredUrl = (name: string, value: string | undefined): string => {
  const normalized = value?.trim() || 'http://localhost:3000'

  try {
    return new URL(normalized).toString().replace(/\/$/, '')
  } catch {
    throw new Error(`${name} must be a valid URL`)
  }
}

export const env: FrontendEnv = {
  API_URL: readRequiredUrl('VITE_API_URL', import.meta.env.VITE_API_URL),
}

