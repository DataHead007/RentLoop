/** 硅基流动 OpenAI 兼容 API，用于 Qwen3-VL 等多模态模型 */

const DEFAULT_BASE = 'https://api.siliconflow.cn/v1'
const DEFAULT_MODEL = 'Qwen/Qwen3-VL-32B-Instruct'

export type SiliconflowContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }

export function resolveSiliconflowApiKey(
  request: Request,
  body: Record<string, unknown>
): string | null {
  const headerKey = request.headers.get('X-SiliconFlow-Api-Key')
  const bodyKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : ''
  return headerKey?.trim() || process.env.SILICONFLOW_API_KEY?.trim() || bodyKey || null
}

function getBaseUrl(): string {
  const raw = process.env.SILICONFLOW_API_BASE_URL?.trim() || DEFAULT_BASE
  return raw.replace(/\/$/, '')
}

function getModel(): string {
  return process.env.SILICONFLOW_VL_MODEL?.trim() || DEFAULT_MODEL
}

/** 纯文本 user 消息 */
export async function siliconflowChatText(apiKey: string, userText: string): Promise<string> {
  return siliconflowChat(apiKey, userText)
}

/**
 * 多模态：可选图片 + 文本（先图后文，与常见 VL API 一致）
 */
export async function siliconflowChatMultimodal(
  apiKey: string,
  options: {
    imageBase64?: string
    imageMimeType?: string
    text: string
  }
): Promise<string> {
  const { imageBase64, imageMimeType, text } = options
  if (!imageBase64?.trim()) {
    return siliconflowChat(apiKey, text)
  }
  const mime = imageMimeType || 'image/png'
  const raw = imageBase64.replace(/^data:image\/\w+;base64,/, '')
  const url = `data:${mime};base64,${raw}`
  const content: SiliconflowContentPart[] = [
    { type: 'image_url', image_url: { url, detail: 'high' } },
    { type: 'text', text },
  ]
  return siliconflowChat(apiKey, content)
}

async function siliconflowChat(
  apiKey: string,
  userContent: string | SiliconflowContentPart[]
): Promise<string> {
  const base = getBaseUrl()
  const model = getModel()
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: userContent }],
      temperature: 0.2,
      max_tokens: 4096,
    }),
  })

  const rawText = await res.text()
  if (!res.ok) {
    let msg = rawText
    try {
      const j = JSON.parse(rawText) as { error?: { message?: string }; message?: string }
      msg = j?.error?.message || j?.message || rawText
    } catch {
      /* keep raw */
    }
    throw new Error(msg || `硅基流动请求失败 (${res.status})`)
  }

  let data: { choices?: Array<{ message?: { content?: string | null } }> }
  try {
    data = JSON.parse(rawText) as typeof data
  } catch {
    throw new Error('硅基流动返回非 JSON')
  }
  const out = data.choices?.[0]?.message?.content
  return typeof out === 'string' ? out.trim() : ''
}
