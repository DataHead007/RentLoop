# Storage 上传权限问题修复说明

## 问题
上传发货照片时出现"没有上传权限"错误。

## 解决方案

### 方案 1：使用 Service Role Key（推荐，已实现）

已更新代码使用服务端 Supabase 客户端（service_role key），可以绕过 RLS 策略限制。

**需要配置环境变量：**

1. 在 Supabase Dashboard 中获取 Service Role Key：
   - 进入 Supabase Dashboard
   - 点击 **Settings** → **API**
   - 找到 **service_role** key（注意：这是敏感密钥，不要暴露给前端）

2. 在项目根目录的 `.env.local` 文件中添加：
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

3. 重启开发服务器：
   ```bash
   npm run dev
   ```

### 方案 2：配置 Storage 权限策略（备选）

如果不想使用 service_role key，可以执行 SQL 脚本配置权限策略：

1. 在 Supabase Dashboard 中打开 **SQL Editor**
2. 执行 `supabase/setup_storage_permissions.sql` 中的 SQL 脚本

## 验证

配置完成后，尝试重新上传发货照片，应该可以成功上传。

如果仍然失败，请检查：
- ✅ `serial-numbers` bucket 是否已创建
- ✅ `SUPABASE_SERVICE_ROLE_KEY` 环境变量是否正确配置
- ✅ 开发服务器是否已重启
