import { NextResponse } from 'next/server'
import { uploadSerialNumberImage } from '@/lib/supabase/storage'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const orderId = formData.get('orderId') as string
    const type = formData.get('type') as 'checkout' | 'checkin'

    if (!file || !orderId || !type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const url = await uploadSerialNumberImage(file, orderId, type)
    return NextResponse.json({ url })
  } catch (error: any) {
    console.error('Error uploading image:', error)
    
    // 返回更详细的错误信息
    const errorMessage = error?.message || error?.error || '上传图片失败'
    const errorDetails = error?.details || error?.hint || ''
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails,
        // 如果是 Supabase Storage 错误，提供更多信息
        code: error?.code || error?.statusCode || 'UNKNOWN_ERROR'
      },
      { status: 500 }
    )
  }
}
