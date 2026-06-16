// AI Generated code <PURPOSE>: parse REST JSON request bodies and primitive fields
import type { Context } from 'hono'

import { httpError } from './errors.js'

export type JsonRecord = Record<string, unknown>

export const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const readJsonBody = async (c: Context): Promise<unknown> => {
  try {
    return await c.req.json()
  } catch {
    throw httpError(400, 'invalid_json', 'Request body must be valid JSON')
  }
}

export const stringField = (record: JsonRecord, field: string): string =>
  typeof record[field] === 'string' ? record[field] : ''

export const numberField = (record: JsonRecord, field: string): number =>
  typeof record[field] === 'number' ? record[field] : Number.NaN

export const optionalNumberField = (record: JsonRecord, field: string): number | null => {
  const value = record[field]
  if (value === undefined || value === null) {
    return null
  }

  return typeof value === 'number' ? value : Number.NaN
}

export const arrayField = (record: JsonRecord, field: string): unknown[] =>
  Array.isArray(record[field]) ? record[field] : []
