import { NextResponse } from 'next/server'

export interface ApiErrorBody {
  success: false
  // backward compatibility for old frontend handlers
  error: string
  errorDetail: {
    code: string
    message: string
  }
}

export function apiError(code: string, message: string, status = 500) {
  const body: ApiErrorBody = {
    success: false,
    error: message,
    errorDetail: { code, message },
  }
  return NextResponse.json(body, { status })
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  )
}
