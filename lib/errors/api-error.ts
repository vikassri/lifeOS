export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function safeError(err: unknown): { message: string } {
  if (err instanceof ApiError) {
    return { message: err.message }
  }
  // Never expose internal error details
  return { message: 'An unexpected error occurred' }
}

export function createErrorResponse(status: number, message: string): Response {
  return Response.json({ error: message }, { status })
}
