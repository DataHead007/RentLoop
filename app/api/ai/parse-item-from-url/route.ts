import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api/response'
import { resolveSiliconflowApiKey, siliconflowChatText } from '@/lib/ai/siliconflow'

type ParsedItem = {
  name?: string
  brand?: string
  model?: string
  category_hint?: string
  purchase_price_hint?: number
  notes?: string
  confidence?: number
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function pickMeta(html: string, key: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    'i'
  )
  const m = html.match(re)
  return m?.[1]?.trim() || ''
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0]) as Record<string, unknown>
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return apiError('INVALID_REQUEST', '无效的请求体', 400)
  }

  const apiKey = resolveSiliconflowApiKey(request, body)
  if (!apiKey) {
    return apiError(
      'AI_NOT_CONFIGURED',
      'AI 功能未配置，请在设置页配置硅基流动 API Key，或在 .env.local 中设置 SILICONFLOW_API_KEY',
      503
    )
  }

  const url = typeof body.url === 'string' ? body.url.trim() : ''
  if (!url) return apiError('INVALID_REQUEST', '请提供商品链接', 400)

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
    if (!/^https?:$/.test(parsedUrl.protocol)) {
      return apiError('INVALID_REQUEST', '仅支持 http/https 链接', 400)
    }
  } catch {
    return apiError('INVALID_REQUEST', '链接格式无效', 400)
  }

  try {
    const res = await fetch(parsedUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 RentLoopBot/1.0',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) {
      return apiError('URL_FETCH_FAILED', `无法读取链接内容（${res.status}）`, 400)
    }

    const html = await res.text()
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim()
    const ogTitle = pickMeta(html, 'og:title')
    const description = pickMeta(html, 'description')
    const ogDescription = pickMeta(html, 'og:description')
    const plain = stripHtml(html).slice(0, 5000)

    const prompt = `你是资产录入助手。请根据以下商品页面信息，提取资产录入字段。
来源 URL: ${parsedUrl.toString()}
页面标题: ${title || '(空)'}
OG 标题: ${ogTitle || '(空)'}
页面描述: ${description || '(空)'}
OG 描述: ${ogDescription || '(空)'}
正文摘要: ${plain || '(空)'}

请严格输出 JSON，不要包含 markdown 代码块或解释。无法确定可省略。
输出格式：
{
  "name": "建议资产名称",
  "brand": "品牌",
  "model": "型号",
  "category_hint": "品类建议",
  "purchase_price_hint": 1234.56,
  "notes": "来源站点/关键信息",
  "confidence": 0.0
}
要求：
1) confidence 范围 0~1；
2) purchase_price_hint 仅保留数字；
3) 如链接非商品页，尽量从标题提取 name。`

    const output = await siliconflowChatText(apiKey, prompt)
    if (!output) return NextResponse.json({})

    const parsed = parseJsonObject(output)
    if (!parsed) return apiError('AI_RESPONSE_INVALID', 'AI 返回格式无效，请重试', 500)

    const data: ParsedItem = {
      name: typeof parsed.name === 'string' ? parsed.name.trim() : undefined,
      brand: typeof parsed.brand === 'string' ? parsed.brand.trim() : undefined,
      model: typeof parsed.model === 'string' ? parsed.model.trim() : undefined,
      category_hint: typeof parsed.category_hint === 'string' ? parsed.category_hint.trim() : undefined,
      purchase_price_hint:
        typeof parsed.purchase_price_hint === 'number'
          ? parsed.purchase_price_hint
          : typeof parsed.purchase_price_hint === 'string'
            ? Number(parsed.purchase_price_hint.replace(/[^\d.]/g, '')) || undefined
            : undefined,
      notes: typeof parsed.notes === 'string' ? parsed.notes.trim() : undefined,
      confidence:
        typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(1, parsed.confidence))
          : undefined,
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[AI parse-item-from-url]', error)
    return apiError(
      'AI_PARSE_ITEM_URL_FAILED',
      error instanceof Error ? error.message : '链接解析失败，请重试',
      500
    )
  }
}
