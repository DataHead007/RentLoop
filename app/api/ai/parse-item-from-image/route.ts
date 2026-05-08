import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api/response'
import { resolveSiliconflowApiKey, siliconflowChatMultimodal } from '@/lib/ai/siliconflow'

type ParsedItem = {
  name?: string
  brand?: string
  model?: string
  category_hint?: string
  serial_number?: string
  purchase_price_hint?: number
  notes?: string
  confidence?: number
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

  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : ''
  const imageMimeType = typeof body.imageMimeType === 'string' ? body.imageMimeType : 'image/jpeg'

  if (!imageBase64.trim()) {
    return apiError('INVALID_REQUEST', '请提供图片数据', 400)
  }

  const prompt = `你是资产录入助手。请根据图片内容（商品图、铭牌、发票截图等）提取可用于资产管理的字段。

请严格输出 JSON，不要包含 markdown 代码块或其他解释。
无法识别的字段可省略。

输出格式：
{
  "name": "建议资产名称（如 Sony A7M4 机身）",
  "brand": "品牌",
  "model": "型号",
  "category_hint": "品类建议（如 相机机身/镜头/麦克风/游戏主机/显示器）",
  "serial_number": "序列号（若可见）",
  "purchase_price_hint": 1234.56,
  "notes": "补充信息",
  "confidence": 0.0
}

要求：
1) confidence 范围 0~1；
2) purchase_price_hint 仅保留数字；
3) 若无法判断，宁可省略字段。`

  try {
    const output = await siliconflowChatMultimodal(apiKey, {
      imageBase64,
      imageMimeType,
      text: prompt,
    })

    if (!output) return NextResponse.json({})

    const parsed = parseJsonObject(output)
    if (!parsed) return apiError('AI_RESPONSE_INVALID', 'AI 返回格式无效，请重试', 500)

    const data: ParsedItem = {
      name: typeof parsed.name === 'string' ? parsed.name.trim() : undefined,
      brand: typeof parsed.brand === 'string' ? parsed.brand.trim() : undefined,
      model: typeof parsed.model === 'string' ? parsed.model.trim() : undefined,
      category_hint: typeof parsed.category_hint === 'string' ? parsed.category_hint.trim() : undefined,
      serial_number: typeof parsed.serial_number === 'string' ? parsed.serial_number.trim() : undefined,
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
    console.error('[AI parse-item-from-image]', error)
    return apiError(
      'AI_PARSE_ITEM_IMAGE_FAILED',
      error instanceof Error ? error.message : '图片识别失败，请重试',
      500
    )
  }
}
