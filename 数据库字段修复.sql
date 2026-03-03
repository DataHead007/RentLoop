-- 修复 orders 表缺少的字段
-- 如果遇到 "Could not find the 'total_deposit' column" 错误，执行此 SQL

-- 添加缺失的字段到 orders 表
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS total_deposit DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS total_shipping_cost DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS order_number TEXT UNIQUE;

-- 如果 orders 表已经有 deposit 字段（旧字段），可以迁移数据
-- UPDATE orders SET total_deposit = COALESCE(deposit, 0) WHERE total_deposit = 0 AND deposit IS NOT NULL;
