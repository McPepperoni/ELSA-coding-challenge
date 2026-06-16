// AI Generated code <PURPOSE>: return consistent JSON HTTP errors from REST routes
import type { Context } from 'hono'

export type HttpStatus = 400 | 401 | 403 | 404 | 409 | 500 | 503

export class HttpError extends Error {
  readonly status: HttpStatus
  readonly code: string

  constructor(status: HttpStatus, code: string, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}

export const httpError = (status: HttpStatus, code: string, message: string): HttpError =>
  new HttpError(status, code, message)

export const writeError = (c: Context, error: HttpError): Response =>
  c.json(
    {
      error: {
        code: error.code,
        message: error.message,
      },
    },
    error.status,
  )

export const handleRouteError = (error: Error, c: Context): Response => {
  if (error instanceof HttpError) {
    return writeError(c, error)
  }

  console.error(error)
  return writeError(c, httpError(500, 'internal_error', 'An unexpected error occurred'))
}
