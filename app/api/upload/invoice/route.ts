import { NextResponse } from 'next/server'
import { uploadInvoice } from '@/lib/supabase/storage'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
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
      return NextResponse.json(
        { error: '不支持的文件类型，仅支持图片（JPEG、PNG、WebP）和 PDF 文件' },
        { status: 400 }
      )
    }

    // 验证文件大小（最大 10MB）
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: '文件大小超过限制，最大支持 10MB' },
        { status: 400 }
      )
    }

    const url = await uploadInvoice(file)
    return NextResponse.json({ url })
  } catch (error) {
    console.error('Error uploading invoice:', error)
    return NextResponse.json(
      { error: '上传发票失败，请重试' },
      { status: 500 }
    )
  }
}
