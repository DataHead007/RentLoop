import { createClient } from '@supabase/supabase-js'
import { supabase } from './client' // 导入原来的客户端作为回退

// 服务端 Supabase 客户端（使用 service_role key，绕过 RLS）
// 仅在服务端 API 路由中使用
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// 如果 service_role key 存在，使用它；否则回退到 anon key
export const supabaseServer = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : supabase // 回退到原来的客户端（需要策略配置）

// 如果 service_role key 未配置，输出警告
if (!supabaseServiceRoleKey && process.env.NODE_ENV !== 'production') {
  console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY 未配置，使用 anon key。需要配置 Storage 权限策略才能上传文件。')
}
