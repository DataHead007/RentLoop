/** localStorage keys for client-side settings */
export const STORAGE_KEYS = {
  /** 硅基流动 API Key（Qwen3-VL 等） */
  siliconflowApiKey: 'rentloop_siliconflow_api_key',
  apiBaseUrl: 'rentloop_api_base_url',
} as const

export function getSiliconflowApiKey(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_KEYS.siliconflowApiKey)
}
