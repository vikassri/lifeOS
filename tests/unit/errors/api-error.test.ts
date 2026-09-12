import { describe, it, expect } from 'vitest'
import { ApiError, safeError, createErrorResponse } from '@/lib/errors/api-error'

describe('ApiError', () => {
  it('is an instance of Error', () => {
    const err = new ApiError(400, 'Bad request')
    expect(err).toBeInstanceOf(Error)
    expect(err.statusCode).toBe(400)
    expect(err.message).toBe('Bad request')
  })
})

describe('safeError', () => {
  it('returns generic message for unknown errors', () => {
    expect(safeError(new Error('DB password is abc123')).message)
      .toBe('An unexpected error occurred')
  })
  it('returns ApiError message for ApiError', () => {
    expect(safeError(new ApiError(403, 'Forbidden')).message).toBe('Forbidden')
  })
})

describe('createErrorResponse', () => {
  it('returns a Response with correct status and JSON body', async () => {
    const res = createErrorResponse(401, 'Unauthorized')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: 'Unauthorized' })
  })
})
