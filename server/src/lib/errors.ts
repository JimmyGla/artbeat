import { Response } from 'express'

export interface ApiError {
  error: string
  status: number
}

/**
 * Send a consistent JSON error response.
 * Usage: return apiError(res, 404, 'City not found')
 */
export const apiError = (res: Response, status: number, error: string): void => {
  res.status(status).json({ error, status } satisfies ApiError)
}