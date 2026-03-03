# Supabase Storage 设置说明

## 1. 创建 Storage Bucket

在 Supabase 项目中：

1. 进入 **Storage** 页面
2. 点击 **New bucket**
3. 创建名为 `serial-numbers` 的 bucket
4. 设置为 **Public bucket**（可选，如果希望直接访问图片）

## 2. 设置存储策略（可选）

如果需要控制访问权限，可以在 SQL Editor 中执行：

```sql
-- 允许任何人读取（如果是公开的）
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'serial-numbers' );

-- 允许认证用户上传
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'serial-numbers' AND
  auth.role() = 'authenticated'
);

-- 允许认证用户删除
CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'serial-numbers' AND
  auth.role() = 'authenticated'
);
```

## 3. 验证设置

确保 bucket 名称与代码中的一致：
- 代码中使用的 bucket 名称：`serial-numbers`
- 文件路径格式：`serial-numbers/{orderId}_{type}_{timestamp}.{ext}`
