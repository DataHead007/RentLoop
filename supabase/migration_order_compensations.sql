-- 订单赔偿记录（按订单项分配，保存时同步写入 transactions）
CREATE TABLE IF NOT EXISTS order_compensations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('income', 'expense')),
  category TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  reason TEXT,
  allocation_method TEXT CHECK (allocation_method IN ('manual', 'rent_ratio', 'purchase_ratio')),
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  transaction_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_compensations_order_id ON order_compensations(order_id);
CREATE INDEX IF NOT EXISTS idx_order_compensations_transaction_id ON order_compensations(transaction_id);
