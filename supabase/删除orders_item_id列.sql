-- 删除 orders 表的 item_id 列
-- 注意：执行此 SQL 前，确保所有现有订单数据已迁移到 order_items 表

-- 1. 删除索引（如果存在）
DROP INDEX IF EXISTS idx_orders_item_id;

-- 2. 删除外键约束（PostgreSQL 会自动处理，但为了安全先检查）
-- 注意：如果外键约束存在，需要先删除约束
DO $$
BEGIN
  -- 尝试删除外键约束（如果存在）
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'orders_item_id_fkey' 
    AND table_name = 'orders'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_item_id_fkey;
  END IF;
END $$;

-- 3. 删除 item_id 列
ALTER TABLE orders DROP COLUMN IF EXISTS item_id;

-- 4. 同时删除其他不再需要的旧字段（如果存在）
ALTER TABLE orders DROP COLUMN IF EXISTS daily_rate;

-- 验证：检查 orders 表结构
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'orders' 
-- ORDER BY ordinal_position;
