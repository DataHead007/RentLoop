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
    const { text, imageBase64, imageMimeType } = body as {
      text?: string
      imageBase64?: string
      imageMimeType?: string
    }

    if (!text && !imageBase64) {
      return NextResponse.json(
        { error: '请提供文字或图片' },
        { status: 400 }
      )
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: MODEL })

    const prompt = `从用户提供的文字或图片中，抽取客户信息：姓名、电话、邮箱、地址。

请严格按照以下 JSON 格式输出，不要包含任何其他文字、markdown 或解释。只输出纯 JSON 对象。
若某个字段无法识别，则省略该字段。电话保留纯数字。

输出格式：
{"name":"姓名","phone":"11位手机号或固话","email":"邮箱","address":"地址"}

示例：
- "张三 微信同号 13812345678 北京市朝阳区xxx" -> {"name":"张三","phone":"13812345678","address":"北京市朝阳区xxx"}
- 名片/聊天截图 -> 根据图片内容抽取

请只输出有效 JSON。`

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
    const output = result.response.text()?.trim() || ''

    if (!output) {
      return NextResponse.json({ name: undefined, phone: undefined, email: undefined, address: undefined })
    }

    let parsed: { name?: string; phone?: string; email?: string; address?: string }
    try {
      const jsonMatch = output.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch ? jsonMatch[0] : output
      parsed = JSON.parse(jsonStr) as { name?: string; phone?: string; email?: string; address?: string }
    } catch {
      return NextResponse.json(
        { error: 'AI 返回格式无效，请重试' },
        { status: 500 }
      )
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('[AI parse-customer]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '解析失败，请重试' },
      { status: 500 }
    )
  }
}
