-- ============================================
-- 客户档案表创建和迁移
-- 从订单表自动生成客户档案
-- ============================================

-- 1. 创建客户档案表
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT, -- 客户备注（如VIP、信用等级等）
  total_orders INTEGER DEFAULT 0, -- 总订单数（缓存字段，用于快速统计）
  total_amount DECIMAL(10, 2) DEFAULT 0, -- 累计消费金额（缓存字段）
  first_order_date DATE, -- 首次下单日期
  last_order_date DATE, -- 最近下单日期
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建唯一索引（允许 NULL，但非 NULL 值必须唯一）
-- 手机号唯一索引（部分索引，只对非 NULL 值创建唯一约束）
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_unique ON customers(phone) 
WHERE phone IS NOT NULL;

-- 邮箱唯一索引（部分索引，只对非 NULL 值创建唯一约束）
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_unique ON customers(email) 
WHERE email IS NOT NULL;

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- 3. 为订单表添加 customer_id 字段
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- 4. 创建更新时间戳触发器
CREATE TRIGGER update_customers_updated_at 
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. 从现有订单生成客户档案
-- 按客户姓名+电话+邮箱的组合去重，生成客户档案
INSERT INTO customers (name, phone, email, first_order_date, last_order_date, total_orders, total_amount)
SELECT 
  customer_name as name,
  customer_phone as phone,
  customer_email as email,
  MIN(start_date) as first_order_date,
  MAX(start_date) as last_order_date,
  COUNT(*) as total_orders,
  SUM(total_amount) as total_amount
FROM orders
WHERE customer_name IS NOT NULL AND customer_name != ''
GROUP BY customer_name, customer_phone, customer_email;

-- 注意：由于 UNIQUE 索引只在非 NULL 值上生效，可能仍会有重复
-- 后续可以通过应用层逻辑（findOrCreateCustomer）处理去重

-- 6. 为现有订单关联 customer_id
-- 先通过手机号匹配
UPDATE orders o
SET customer_id = c.id
FROM customers c
WHERE o.customer_id IS NULL
  AND o.customer_phone IS NOT NULL
  AND o.customer_phone = c.phone;

-- 再通过邮箱匹配（未匹配上的订单）
UPDATE orders o
SET customer_id = c.id
FROM customers c
WHERE o.customer_id IS NULL
  AND o.customer_email IS NOT NULL
  AND o.customer_email = c.email;

-- 最后通过姓名匹配（手机号和邮箱都为空的订单）
UPDATE orders o
SET customer_id = c.id
FROM customers c
WHERE o.customer_id IS NULL
  AND o.customer_name = c.name
  AND o.customer_phone IS NULL
  AND o.customer_email IS NULL
  AND c.phone IS NULL
  AND c.email IS NULL;

-- 7. 验证迁移结果
DO $$
DECLARE
  customer_count INTEGER;
  order_count INTEGER;
  linked_order_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO customer_count FROM customers;
  SELECT COUNT(*) INTO order_count FROM orders WHERE customer_name IS NOT NULL AND customer_name != '';
  SELECT COUNT(*) INTO linked_order_count FROM orders WHERE customer_id IS NOT NULL;
  
  RAISE NOTICE '✅ 客户档案迁移完成';
  RAISE NOTICE '   生成客户档案数: %', customer_count;
  RAISE NOTICE '   订单总数: %', order_count;
  RAISE NOTICE '   已关联订单数: %', linked_order_count;
END $$;
