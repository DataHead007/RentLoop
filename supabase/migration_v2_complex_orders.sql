-- RentLoop V2 数据库迁移
-- 支持多设备订单、数字账号、第三方租赁等功能

-- ============================================
-- 1. 创建新表
-- ============================================

-- 订单项表（支持一个订单包含多个设备/配件）
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  daily_rate DECIMAL(10, 2) NOT NULL, -- 该项的日租金
  subtotal DECIMAL(10, 2) NOT NULL, -- 该项小计（日租金 × 天数）
  deposit DECIMAL(10, 2) DEFAULT 0, -- 该项押金
  quantity INTEGER DEFAULT 1, -- 数量（如2个手柄）
  notes TEXT, -- 备注（如"带数字版游戏"）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 数字版游戏账号表
CREATE TABLE IF NOT EXISTS game_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_name TEXT NOT NULL, -- 游戏名称
  platform TEXT NOT NULL, -- 'ps5' | 'xbox' | 'switch' | 'other'
  account_type TEXT NOT NULL CHECK (account_type IN ('primary', 'non_primary')), -- 主认证/非认证
  current_device_id UUID REFERENCES items(id) ON DELETE SET NULL, -- 当前登录的设备
  login_date DATE, -- 登录日期
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance')),
  notes TEXT, -- 账号信息、密码等备注
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 账号设备绑定历史表（记录账号登录历史）
CREATE TABLE IF NOT EXISTS account_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_account_id UUID NOT NULL REFERENCES game_accounts(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  binding_type TEXT NOT NULL CHECK (binding_type IN ('primary', 'non_primary')), -- 主认证/非认证
  bind_start_date DATE NOT NULL, -- 绑定开始日期
  bind_end_date DATE, -- 绑定结束日期（NULL表示当前绑定）
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL, -- 关联的订单
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 订单与数字账号关联表
CREATE TABLE IF NOT EXISTS order_game_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  game_account_id UUID NOT NULL REFERENCES game_accounts(id) ON DELETE RESTRICT,
  binding_id UUID REFERENCES account_bindings(id) ON DELETE SET NULL, -- 关联的绑定记录
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 第三方游戏租赁表（记录从淘宝等平台租游戏的信息）
CREATE TABLE IF NOT EXISTS third_party_rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  game_name TEXT NOT NULL, -- 游戏名称
  platform TEXT, -- 平台
  rental_start_date DATE NOT NULL, -- 租赁开始日期
  rental_end_date DATE NOT NULL, -- 租赁结束日期
  extended_end_date DATE, -- 延期后的结束日期
  rental_cost DECIMAL(10, 2) NOT NULL, -- 租赁成本
  deposit DECIMAL(10, 2) DEFAULT 0, -- 押金
  extension_cost DECIMAL(10, 2) DEFAULT 0, -- 延期费用
  deposit_returned BOOLEAN DEFAULT FALSE, -- 押金是否退回
  provider TEXT, -- 供应商（如'taobao'）
  provider_order_id TEXT, -- 第三方订单号
  provider_link TEXT, -- 供应商链接
  notes TEXT, -- 备注（延期说明等）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_rental_dates CHECK (rental_end_date >= rental_start_date)
);

-- 物流费用表
CREATE TABLE IF NOT EXISTS shipping_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  shipping_type TEXT NOT NULL CHECK (shipping_type IN ('outbound', 'return', 'pickup')), -- 发货/退货/自提
  amount DECIMAL(10, 2) NOT NULL, -- 费用金额
  shipping_company TEXT, -- 物流公司（非必填）
  tracking_number TEXT, -- 快递单号（非必填）
  shipping_date DATE, -- 发货/退货日期
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. 修改 orders 表
-- ============================================

-- 备份现有数据（如果需要）
-- 注意：由于 orders 表结构变化较大，需要先处理数据迁移

-- 添加新字段到 orders 表（保留原有字段以便数据迁移）
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number TEXT UNIQUE; -- 订单编号
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_shipping_cost DECIMAL(10, 2) DEFAULT 0; -- 总物流成本

-- 创建订单编号生成函数（可选，用于自动生成订单号）
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
BEGIN
  new_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('order_seq')::TEXT, 6, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- 创建序列用于订单编号（如果不存在）
CREATE SEQUENCE IF NOT EXISTS order_seq START 1;

-- ============================================
-- 3. 创建索引
-- ============================================

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_item_id ON order_items(item_id);
CREATE INDEX IF NOT EXISTS idx_game_accounts_device_id ON game_accounts(current_device_id);
CREATE INDEX IF NOT EXISTS idx_game_accounts_status ON game_accounts(status);
CREATE INDEX IF NOT EXISTS idx_account_bindings_account_id ON account_bindings(game_account_id);
CREATE INDEX IF NOT EXISTS idx_account_bindings_device_id ON account_bindings(device_id);
CREATE INDEX IF NOT EXISTS idx_account_bindings_order_id ON account_bindings(order_id);
CREATE INDEX IF NOT EXISTS idx_order_game_accounts_order_id ON order_game_accounts(order_id);
CREATE INDEX IF NOT EXISTS idx_order_game_accounts_account_id ON order_game_accounts(game_account_id);
CREATE INDEX IF NOT EXISTS idx_third_party_rentals_order_id ON third_party_rentals(order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_fees_order_id ON shipping_fees(order_id);

-- ============================================
-- 4. 创建触发器
-- ============================================

-- order_items 更新时间戳
CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- game_accounts 更新时间戳
CREATE TRIGGER update_game_accounts_updated_at BEFORE UPDATE ON game_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- account_bindings 更新时间戳
CREATE TRIGGER update_account_bindings_updated_at BEFORE UPDATE ON account_bindings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- third_party_rentals 更新时间戳
CREATE TRIGGER update_third_party_rentals_updated_at BEFORE UPDATE ON third_party_rentals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- shipping_fees 更新时间戳
CREATE TRIGGER update_shipping_fees_updated_at BEFORE UPDATE ON shipping_fees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. 数据迁移说明
-- ============================================
-- 
-- 重要：在运行此迁移之前，需要先迁移现有订单数据
-- 
-- 迁移步骤：
-- 1. 为每个现有订单创建一个 order_items 记录，将原来的 item_id 迁移过去
-- 2. 删除 orders 表的 item_id 列（在确认数据迁移成功后）
-- 
-- 数据迁移 SQL（需要手动执行）：
-- 
-- INSERT INTO order_items (order_id, item_id, daily_rate, subtotal, deposit, quantity)
-- SELECT 
--   id as order_id,
--   item_id,
--   daily_rate,
--   total_amount as subtotal,
--   deposit,
--   1 as quantity
-- FROM orders
-- WHERE item_id IS NOT NULL;
--
-- 迁移完成后，可以删除 orders.item_id 列：
-- ALTER TABLE orders DROP COLUMN IF EXISTS item_id;
--
