-- RentLoop V2 数据迁移脚本
-- 将现有订单数据迁移到新的 order_items 表结构

-- 步骤 1: 迁移现有订单数据到 order_items 表
INSERT INTO order_items (order_id, item_id, daily_rate, subtotal, deposit, quantity, notes, created_at, updated_at)
SELECT 
  id as order_id,
  item_id,
  daily_rate,
  total_amount as subtotal,
  COALESCE(deposit, 0) as deposit,
  1 as quantity,
  notes,
  created_at,
  updated_at
FROM orders
WHERE item_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 步骤 2: 生成订单编号（为现有订单）
UPDATE orders
SET order_number = 'ORD-' || TO_CHAR(created_at, 'YYYYMMDD') || '-' || LPAD((ROW_NUMBER() OVER (ORDER BY created_at))::TEXT, 6, '0')
WHERE order_number IS NULL;

-- 注意：在确认数据迁移成功后，可以执行以下命令删除 orders 表的 item_id 列
-- ALTER TABLE orders DROP COLUMN IF EXISTS item_id;
