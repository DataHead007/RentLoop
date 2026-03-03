import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const MODEL = 'gemini-3-flash-preview'

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 })
  }

  const headerKey = request.headers.get('X-Gemini-Api-Key')
  const bodyKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : ''
  const apiKey = headerKey?.trim() || process.env.GEMINI_API_KEY || bodyKey || null

  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI 功能未配置，请在设置页配置 Gemini API Key 或在 .env.local 中设置 GEMINI_API_KEY' },
      { status: 503 }
    )
  }

  try {
    const { text, imageBase64, imageMimeType, itemNames } = body as {
      text?: string
      imageBase64?: string
      imageMimeType?: string
      itemNames: string[]
    }

    if (!text && !imageBase64) {
      return NextResponse.json(
        { error: '请提供文字或图片' },
        { status: 400 }
      )
    }

    if (!Array.isArray(itemNames)) {
      return NextResponse.json(
        { error: 'itemNames 必须为数组' },
        { status: 400 }
      )
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: MODEL })

    const today = new Date().toISOString().split('T')[0]
    const itemList = itemNames.length > 0 ? itemNames.join('、') : '（无可用资产）'

    const prompt = `你是一个租赁订单信息抽取助手。从用户提供的文字或图片中，抽取租赁订单相关信息。

当前日期：${today}
可选资产名称列表：${itemList}

请严格按照以下 JSON 格式输出，不要包含任何其他文字、markdown 代码块或解释。只输出纯 JSON 对象。
若某个字段无法识别，则省略该字段。日期格式必须为 YYYY-MM-DD。

输出格式：
{
  "customer_name": "客户姓名",
  "customer_phone": "手机号（11位数字）",
  "customer_email": "邮箱（如有）",
  "customer_address": "地址（如有）",
  "items": [{"item_name": "资产名称或简称（尽量匹配上述列表）", "days": 天数, "daily_rate": 日租金, "subtotal": 总租金可选, "deposit": 押金可选}],
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "notes": "备注（如有）"
}

示例：
- "张三 13812345678 租了 A7M4 3天 日租200" -> {"customer_name":"张三","customer_phone":"13812345678","items":[{"item_name":"A7M4","days":3,"daily_rate":200}],"start_date":"${today}","end_date":"需根据start_date+days计算"}
- "明天到月底 李四 租镜头 日租100" -> 需要计算明天和本月最后一天作为 start_date 和 end_date

请只输出有效 JSON，不要有任何前缀或后缀。`

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []

    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: imageMimeType || 'image/png',
          data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
        },
      })
    }

    if (text?.trim()) {
      parts.push({ text: `用户输入：\n${text.trim()}\n\n${prompt}` })
    } else {
      parts.push({ text: prompt })
    }

    const result = await model.generateContent(parts)
    const response = result.response
    const output = response.text()?.trim() || ''

    if (!output) {
      return NextResponse.json({
        customer_name: undefined,
        customer_phone: undefined,
        customer_email: undefined,
        customer_address: undefined,
        items: [],
        start_date: undefined,
        end_date: undefined,
        notes: undefined,
      })
    }

    let parsed: Record<string, unknown>
    try {
      const jsonMatch = output.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch ? jsonMatch[0] : output
      parsed = JSON.parse(jsonStr) as Record<string, unknown>
    } catch {
      return NextResponse.json(
        { error: 'AI 返回格式无效，请重试' },
        { status: 500 }
      )
    }

    const startDate = parsed.start_date as string | undefined
    const endDate = parsed.end_date as string | undefined
    const items = parsed.items as Array<{ item_name: string; days?: number; daily_rate?: number; subtotal?: number; deposit?: number }> | undefined

    if (startDate && !endDate && Array.isArray(items) && items.length > 0 && items[0].days) {
      const start = new Date(startDate)
      const days = items[0].days
      const end = new Date(start)
      end.setDate(end.getDate() + days - 1)
      parsed.end_date = end.toISOString().split('T')[0]
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('[AI parse-order]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '解析失败，请重试' },
      { status: 500 }
    )
  }
}
