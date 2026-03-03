import { supabaseServer } from './server'

/**
 * 上传序列号照片到 Supabase Storage
 */
export async function uploadSerialNumberImage(
  file: File,
  orderId: string,
  type: 'checkout' | 'checkin'
): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${orderId}_${type}_${Date.now()}.${fileExt}`
  const filePath = `serial-numbers/${fileName}`

  // 使用服务端客户端（service_role key）绕过 RLS 策略
  const { data, error: uploadError } = await supabaseServer.storage
    .from('serial-numbers')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    // 检查是否使用了 service_role key
    const usingServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY
    
    // 提供更详细的错误信息
    console.error('Supabase Storage upload error:', {
      message: uploadError.message,
      statusCode: uploadError.statusCode,
      error: uploadError.error,
      usingServiceRole,
    })
    
    const errorMsg = uploadError.message || ''
    
    // 如果 bucket 不存在
    if (errorMsg.includes('Bucket not found') || errorMsg.includes('The resource was not found') || errorMsg.includes('not found')) {
      throw new Error('存储桶不存在，请在 Supabase Dashboard 中创建名为 "serial-numbers" 的 Storage bucket')
    }
    
    // 如果是权限问题
    if (errorMsg.includes('new row violates row-level security policy') || errorMsg.includes('permission denied') || errorMsg.includes('Forbidden') || errorMsg.includes('401') || errorMsg.includes('403')) {
      if (!usingServiceRole) {
        throw new Error('没有上传权限。请执行以下操作之一：\n1. 在 .env.local 中配置 SUPABASE_SERVICE_ROLE_KEY\n2. 或者在 Supabase Dashboard 的 SQL Editor 中执行 setup_storage_permissions.sql 脚本配置权限策略')
      } else {
        throw new Error('没有上传权限，请检查 SUPABASE_SERVICE_ROLE_KEY 是否正确配置')
      }
    }
    
    if (errorMsg.includes('File size')) {
      throw new Error('文件过大，请尝试压缩图片后重新上传')
    }
    
    throw new Error(uploadError.message || '上传失败')
  }

  // 获取公共 URL（使用服务端客户端）
  const { data: urlData } = supabaseServer.storage
    .from('serial-numbers')
    .getPublicUrl(filePath)

  return urlData.publicUrl
}

/**
 * 删除序列号照片
 */
export async function deleteSerialNumberImage(filePath: string): Promise<void> {
  // 从 URL 中提取文件路径
  const pathMatch = filePath.match(/serial-numbers\/(.+)$/)
  if (!pathMatch) {
    throw new Error('Invalid file path')
  }

  const { error } = await supabaseServer.storage
    .from('serial-numbers')
    .remove([pathMatch[1]])

  if (error) {
    throw error
  }
}

/**
 * 上传发票文件到 Supabase Storage
 */
export async function uploadInvoice(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const filePath = `invoices/${fileName}`

  const { error: uploadError } = await supabaseServer.storage
    .from('invoices')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    throw uploadError
  }

  // 获取公共 URL
  const { data } = supabaseServer.storage
    .from('invoices')
    .getPublicUrl(filePath)

  return data.publicUrl
}

/**
 * 删除发票文件
 */
export async function deleteInvoice(filePath: string): Promise<void> {
  // 从 URL 中提取文件路径
  const pathMatch = filePath.match(/invoices\/(.+)$/)
  if (!pathMatch) {
    throw new Error('Invalid file path')
  }

  const { error } = await supabaseServer.storage
    .from('invoices')
    .remove([pathMatch[1]])

  if (error) {
    throw error
  }
}
