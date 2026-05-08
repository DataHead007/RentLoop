export type ApiErrorBody = {
  success: false
  error: string
  errorDetail?: {
    code: string
    message: string
  }
}

export class ApiFetchError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiFetchError'
    this.status = status
    this.code = code
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function readErrorMessage(body: unknown): { message: string; code?: string } {
  if (isRecord(body)) {
    const error = body.error
    const errorDetail = body.errorDetail
    if (typeof errorDetail === 'object' && errorDetail !== null) {
      const code = (errorDetail as any).code
      const message = (errorDetail as any).message
      if (typeof message === 'string' && message.trim()) return { message, code: typeof code === 'string' ? code : undefined }
    }
    if (typeof error === 'string' && error.trim()) return { message: error }
  }
  return { message: '请求失败，请重试' }
}

/**
 * 统一前端 fetcher：
 * - 兼容旧接口：直接返回 JSON（例如 orders GET 返回数组）
 * - 兼容新协议：{ success: true, data }
 * - 错误统一抛 ApiFetchError（优先解析 errorDetail/message）
 */
export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (!res.ok) {
    const { message, code } = readErrorMessage(body)
    throw new ApiFetchError(message, res.status, code)
  }

  if (isRecord(body) && body.success === true && 'data' in body) {
    return (body as { data: T }).data
  }
  return body as T
}

