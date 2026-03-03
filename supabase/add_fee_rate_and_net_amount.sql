-- 为 order_items 表添加手续费率和实际租金字段
-- 用于支持平台手续费计算和 ROI 准确统计

-- 1. 添加手续费率字段（DECIMAL(5,4) 可以存储 0.0000 到 99.9999）
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS fee_rate DECIMAL(5,4) DEFAULT 0.006;

-- 2. 添加实际租金字段（扣除手续费后的金额）
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS net_amount DECIMAL(10,2);

-- 3. 为已有数据计算 net_amount（如果 subtotal 和 fee_rate 存在）
-- net_amount = subtotal * (1 - fee_rate)
UPDATE order_items
SET net_amount = ROUND(subtotal * (1 - COALESCE(fee_rate, 0.006)), 2)
WHERE net_amount IS NULL AND subtotal IS NOT NULL;

-- 4. 创建索引（如果需要按费率查询）
CREATE INDEX IF NOT EXISTS idx_order_items_fee_rate ON order_items(fee_rate);

-- 5. 显示更新结果
SELECT 
  COUNT(*) as total_items,
  COUNT(net_amount) as items_with_net_amount,
  SUM(COALESCE(net_amount, 0)) as total_net_amount
FROM order_items;
