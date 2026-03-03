-- ============================================
-- Supabase Storage 权限策略配置
-- 用于 serial-numbers bucket 的上传和访问
-- ============================================

-- 1. 确保 bucket 存在（如果不存在，需要先在 Dashboard 中创建）
-- 注意：这里只是检查，实际创建需要在 Dashboard 中完成

-- 2. 删除可能存在的旧策略（避免冲突）
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow service role full access" ON storage.objects;

-- 3. 允许所有人读取（公开访问）
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'serial-numbers' );

-- 4. 允许认证用户上传（通过 API 路由上传时使用）
-- 注意：如果使用 service_role key，这个策略可能不需要，但保留以防万一
CREATE POLICY "Allow authenticated upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'serial-numbers'
);

-- 5. 允许认证用户更新
CREATE POLICY "Allow authenticated update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'serial-numbers' )
WITH CHECK ( bucket_id = 'serial-numbers' );

-- 6. 允许认证用户删除
CREATE POLICY "Allow authenticated delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'serial-numbers' );

-- ============================================
-- 说明：
-- 1. 如果使用 service_role key（服务端），这些策略可能不需要
--    但配置它们可以确保即使使用 anon key 也能工作
-- 2. 如果仍然遇到权限问题，检查：
--    - Supabase Dashboard → Storage → serial-numbers bucket 是否存在
--    - Storage → Policies 中是否启用了 RLS
--    - 代码中使用的是 service_role key 还是 anon key
-- ============================================

