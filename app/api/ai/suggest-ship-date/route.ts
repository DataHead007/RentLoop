import { NextResponse } from 'next/server'
import { resolveSiliconflowApiKey, siliconflowChatText } from '@/lib/ai/siliconflow'
import { apiError } from '@/lib/api/response'

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

  const { origin = '上海市', destinationAddress, startDate } = body as {
    origin?: string
    destinationAddress?: string
    startDate?: string
  }

  if (!destinationAddress || typeof destinationAddress !== 'string' || !destinationAddress.trim()) {
    return apiError('INVALID_REQUEST', '请提供收货地址', 400)
  }

  if (!startDate || typeof startDate !== 'string') {
    return apiError('INVALID_REQUEST', '请提供订单开始日期（客户需在开始日前一天收到）', 400)
  }

  try {
    const prompt = `你是一个从上海发货的租赁商家助手。根据「发货地」与「收货地址」估算物流距离和时效，并推荐最晚发货日期。

**发货地**：${origin}
**收货地址**：${destinationAddress}
**订单开始日**：${startDate}（租赁开始日）
**重要**：客户需在「订单开始日的前一天」收到货物，以便当天可用。即最晚送达日 = 开始日 - 1 天。

请按以下规则估算：
1. 距离分类：同城（上海市内）、江浙沪、省内（华东邻省）、跨省、偏远（新疆/西藏/内蒙古等）
2. 顺丰时效：同城/江浙沪约1天，省内/邻省1-2天，跨省2-3天，偏远3-5天
3. 普通快递（中通/圆通/韵达）：江浙沪1-2天，其他一般3-5天，偏远5-7天
4. 建议最晚发货日 = (订单开始日 - 1 天) - 在途天数（顺丰或普通快递取你推荐的那种），即要保证「发货日 + 在途天数 ≤ 开始日 - 1」。且建议发货日不晚于今天之后

请严格按照以下 JSON 格式输出，不要包含任何其他文字、markdown 或解释。只输出纯 JSON 对象。

输出格式：
{"distanceCategory":"同城|江浙沪|省内|跨省|偏远","sfDays":顺丰预估天数整数,"standardDays":普通快递预估天数整数,"recommendShipBy":"YYYY-MM-DD","suggestedExpress":"顺丰|普通快递","reason":"一句话说明理由"}

请只输出有效 JSON。`

    const output = await siliconflowChatText(apiKey, prompt)

    if (!output) {
      return apiError('AI_NO_RESULT', 'AI 未返回有效结果，请重试', 500)
    }

    let parsed: {
      distanceCategory?: string
      sfDays?: number
      standardDays?: number
      recommendShipBy?: string
      suggestedExpress?: string
      reason?: string
    }
    try {
      const jsonMatch = output.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch ? jsonMatch[0] : output
      parsed = JSON.parse(jsonStr)
    } catch {
      return apiError('AI_RESPONSE_INVALID', 'AI 返回格式无效，请重试', 500)
    }

    return NextResponse.json({
      distanceCategory: parsed.distanceCategory ?? '跨省',
      sfDays: typeof parsed.sfDays === 'number' ? parsed.sfDays : 2,
      standardDays: typeof parsed.standardDays === 'number' ? parsed.standardDays : 4,
      recommendShipBy: parsed.recommendShipBy ?? startDate,
      suggestedExpress: parsed.suggestedExpress ?? '顺丰',
      reason: parsed.reason ?? '根据距离与时效推荐',
    })
  } catch (error) {
    console.error('[AI suggest-ship-date]', error)
    return apiError('AI_SUGGEST_SHIP_DATE_FAILED', error instanceof Error ? error.message : '获取推荐失败，请重试', 500)
  }
}
