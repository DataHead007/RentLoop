import { NextResponse } from 'next/server'
import { uploadInvoice } from '@/lib/supabase/storage'
import { apiError } from '@/lib/api/response'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return apiError('INVALID_REQUEST', 'No file provided', 400)
    }

    // 验证文件类型（只允许图片和 PDF）
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/pdf',
    ]
    
    if (!allowedTypes.includes(file.type)) {
      return apiError('INVALID_FILE_TYPE', '不支持的文件类型，仅支持图片（JPEG、PNG、WebP）和 PDF 文件', 400)
    }

    // 验证文件大小（最大 10MB）
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return apiError('FILE_TOO_LARGE', '文件大小超过限制，最大支持 10MB', 400)
    }

    const url = await uploadInvoice(file)
    return NextResponse.json({ url })
  } catch (error) {
    console.error('Error uploading invoice:', error)
    return apiError('INVOICE_UPLOAD_FAILED', '上传发票失败，请重试', 500)
  }
}
