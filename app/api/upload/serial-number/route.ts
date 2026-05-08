import { NextResponse } from 'next/server'
import { uploadSerialNumberImage } from '@/lib/supabase/storage'
import { apiError } from '@/lib/api/response'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const orderId = formData.get('orderId') as string
    const type = formData.get('type') as 'checkout' | 'checkin'

    if (!file || !orderId || !type) {
      return apiError('INVALID_REQUEST', 'Missing required fields', 400)
    }

    const url = await uploadSerialNumberImage(file, orderId, type)
    return NextResponse.json({ url })
  } catch (error: any) {
    console.error('Error uploading image:', error)
    
    // 返回更详细的错误信息
    const errorMessage = error?.message || error?.error || '上传图片失败'
    const errorDetails = error?.details || error?.hint || ''
    
    return apiError(
      error?.code || error?.statusCode || 'SERIAL_IMAGE_UPLOAD_FAILED',
      errorDetails ? `${errorMessage} (${errorDetails})` : errorMessage,
      500
    )
  }
}
