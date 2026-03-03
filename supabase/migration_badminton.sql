-- ============================================
-- 羽毛球副业：业务线、订单、收支明细
-- ============================================

-- 1. orders 表：订单类型与羽毛球字段
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'rental'
  CHECK (order_type IN ('rental', 'badminton'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_type TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_date DATE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_start_time TIME;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_end_time TIME;

CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);
COMMENT ON COLUMN orders.order_type IS 'rental=租赁, badminton=羽毛球副业';
COMMENT ON COLUMN orders.service_type IS '羽毛球: 教学|陪打|比赛|组织活动';
COMMENT ON COLUMN orders.location IS '羽毛球: 场地/地点';
COMMENT ON COLUMN orders.service_date IS '羽毛球: 服务日期';
COMMENT ON COLUMN orders.service_start_time IS '羽毛球: 开始时间';
COMMENT ON COLUMN orders.service_end_time IS '羽毛球: 结束时间';

-- 2. transactions 表：业务线
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS business_line TEXT DEFAULT 'rental'
  CHECK (business_line IN ('rental', 'badminton'));
UPDATE transactions SET business_line = 'rental' WHERE business_line IS NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_business_line ON transactions(business_line);
COMMENT ON COLUMN transactions.business_line IS 'rental=租赁, badminton=羽毛球副业';

-- 3. 羽毛球订单收支明细表
CREATE TABLE IF NOT EXISTS badminton_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  line_type TEXT NOT NULL CHECK (line_type IN ('income', 'expense')),
  category TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT positive_amount CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_badminton_order_lines_order_id ON badminton_order_lines(order_id);
COMMENT ON TABLE badminton_order_lines IS '羽毛球订单收支明细。收入: 教练费|陪练费|比赛奖金; 支出: 场地费|停车费|比赛报名费';

CREATE TRIGGER update_badminton_order_lines_updated_at
  BEFORE UPDATE ON badminton_order_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
