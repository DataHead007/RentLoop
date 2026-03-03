-- 交易变更追踪表（用于追踪净利润变化）
-- 每次 transactions 表发生增删改，自动记录一条事件

-- 1. 创建追踪表
CREATE TABLE IF NOT EXISTS transaction_change_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 操作类型
  action TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  
  -- 关联信息
  transaction_id UUID, -- 被操作的交易ID（delete时可能已不存在）
  item_id UUID,        -- 关联的资产ID
  order_id UUID,       -- 关联的订单ID
  
  -- 交易属性（变更前后）
  type_before TEXT,    -- 变更前的类型 (income/expense)
  type_after TEXT,     -- 变更后的类型
  amount_before DECIMAL(10, 2), -- 变更前的金额
  amount_after DECIMAL(10, 2),  -- 变更后的金额
  category TEXT,       -- 交易类别
  auto_created BOOLEAN DEFAULT FALSE, -- 是否自动创建的交易
  
  -- 增量（关键字段：用于快速统计净利润变化）
  delta_income DECIMAL(10, 2) DEFAULT 0,     -- 收入变化量（正=增加）
  delta_expense DECIMAL(10, 2) DEFAULT 0,    -- 支出变化量（正=支出增加）
  delta_net_profit DECIMAL(10, 2) DEFAULT 0, -- 净利润变化量
  
  -- 描述信息
  reason TEXT,         -- 变更原因（order_completed, order_rollback, manual_edit, item_sold_sync 等）
  description TEXT,    -- 原交易描述
  summary TEXT         -- 一行可读摘要
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_tce_created_at ON transaction_change_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tce_transaction_id ON transaction_change_events(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tce_item_id ON transaction_change_events(item_id);
CREATE INDEX IF NOT EXISTS idx_tce_order_id ON transaction_change_events(order_id);
CREATE INDEX IF NOT EXISTS idx_tce_action ON transaction_change_events(action);
CREATE INDEX IF NOT EXISTS idx_tce_auto_created ON transaction_change_events(auto_created);

-- 3. 创建 trigger 函数
CREATE OR REPLACE FUNCTION log_transaction_change()
RETURNS TRIGGER AS $$
DECLARE
  v_delta_income DECIMAL(10, 2) := 0;
  v_delta_expense DECIMAL(10, 2) := 0;
  v_delta_net DECIMAL(10, 2) := 0;
  v_summary TEXT;
  v_reason TEXT;
  v_type_before TEXT;
  v_type_after TEXT;
  v_amount_before DECIMAL(10, 2);
  v_amount_after DECIMAL(10, 2);
  v_transaction_id UUID;
  v_item_id UUID;
  v_order_id UUID;
  v_category TEXT;
  v_auto_created BOOLEAN;
  v_description TEXT;
BEGIN
  -- 根据操作类型计算 delta
  IF TG_OP = 'INSERT' THEN
    v_transaction_id := NEW.id;
    v_item_id := NEW.item_id;
    v_order_id := NEW.order_id;
    v_type_after := NEW.type;
    v_amount_after := NEW.amount;
    v_category := NEW.category;
    v_auto_created := COALESCE(NEW.auto_created, FALSE);
    v_description := NEW.description;
    
    IF NEW.type = 'income' THEN
      v_delta_income := NEW.amount;
    ELSE
      v_delta_expense := ABS(NEW.amount);
    END IF;
    v_delta_net := v_delta_income - v_delta_expense;
    
    -- 生成摘要
    IF v_auto_created THEN
      v_reason := 'auto_create';
      v_summary := '自动创建: ' || COALESCE(v_category, '') || ' ' || 
                   CASE WHEN NEW.type = 'income' THEN '+' ELSE '-' END || 
                   ABS(NEW.amount)::TEXT;
    ELSE
      v_reason := 'manual_create';
      v_summary := '手动创建: ' || COALESCE(v_category, '') || ' ' || 
                   CASE WHEN NEW.type = 'income' THEN '+' ELSE '-' END || 
                   ABS(NEW.amount)::TEXT;
    END IF;
    
  ELSIF TG_OP = 'UPDATE' THEN
    v_transaction_id := NEW.id;
    v_item_id := NEW.item_id;
    v_order_id := NEW.order_id;
    v_type_before := OLD.type;
    v_type_after := NEW.type;
    v_amount_before := OLD.amount;
    v_amount_after := NEW.amount;
    v_category := NEW.category;
    v_auto_created := COALESCE(NEW.auto_created, FALSE);
    v_description := NEW.description;
    
    -- 计算变更前的影响
    IF OLD.type = 'income' THEN
      v_delta_income := v_delta_income - OLD.amount;
    ELSE
      v_delta_expense := v_delta_expense - ABS(OLD.amount);
    END IF;
    
    -- 计算变更后的影响
    IF NEW.type = 'income' THEN
      v_delta_income := v_delta_income + NEW.amount;
    ELSE
      v_delta_expense := v_delta_expense + ABS(NEW.amount);
    END IF;
    
    v_delta_net := v_delta_income - v_delta_expense;
    v_reason := 'manual_edit';
    v_summary := '修改: ' || COALESCE(v_category, '') || ' ' || 
                 OLD.amount::TEXT || ' → ' || NEW.amount::TEXT;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_transaction_id := OLD.id;
    v_item_id := OLD.item_id;
    v_order_id := OLD.order_id;
    v_type_before := OLD.type;
    v_amount_before := OLD.amount;
    v_category := OLD.category;
    v_auto_created := COALESCE(OLD.auto_created, FALSE);
    v_description := OLD.description;
    
    IF OLD.type = 'income' THEN
      v_delta_income := -OLD.amount;
    ELSE
      v_delta_expense := -ABS(OLD.amount);
    END IF;
    v_delta_net := v_delta_income - v_delta_expense;
    
    IF v_auto_created THEN
      v_reason := 'auto_delete';
      v_summary := '自动删除: ' || COALESCE(v_category, '') || ' ' || 
                   CASE WHEN OLD.type = 'income' THEN '-' ELSE '+' END || 
                   ABS(OLD.amount)::TEXT;
    ELSE
      v_reason := 'manual_delete';
      v_summary := '手动删除: ' || COALESCE(v_category, '') || ' ' || 
                   CASE WHEN OLD.type = 'income' THEN '-' ELSE '+' END || 
                   ABS(OLD.amount)::TEXT;
    END IF;
  END IF;
  
  -- 插入事件记录
  INSERT INTO transaction_change_events (
    action,
    transaction_id,
    item_id,
    order_id,
    type_before,
    type_after,
    amount_before,
    amount_after,
    category,
    auto_created,
    delta_income,
    delta_expense,
    delta_net_profit,
    reason,
    description,
    summary
  ) VALUES (
    LOWER(TG_OP),
    v_transaction_id,
    v_item_id,
    v_order_id,
    v_type_before,
    v_type_after,
    v_amount_before,
    v_amount_after,
    v_category,
    v_auto_created,
    v_delta_income,
    v_delta_expense,
    v_delta_net,
    v_reason,
    v_description,
    v_summary
  );
  
  -- 返回
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. 创建 trigger（在 transactions 表上）
DROP TRIGGER IF EXISTS trg_log_transaction_change ON transactions;
CREATE TRIGGER trg_log_transaction_change
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION log_transaction_change();

-- 5. 添加注释
COMMENT ON TABLE transaction_change_events IS '交易变更追踪表：记录每次交易的增删改，用于追踪净利润变化';
COMMENT ON COLUMN transaction_change_events.delta_income IS '收入变化量（正数=收入增加）';
COMMENT ON COLUMN transaction_change_events.delta_expense IS '支出变化量（正数=支出增加）';
COMMENT ON COLUMN transaction_change_events.delta_net_profit IS '净利润变化量（= delta_income - delta_expense）';
