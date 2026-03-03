/** localStorage keys for client-side settings */
export const STORAGE_KEYS = {
  geminiApiKey: 'rentloop_gemini_api_key',
  apiBaseUrl: 'rentloop_api_base_url',
} as const

export function getGeminiApiKey(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_KEYS.geminiApiKey)
}
