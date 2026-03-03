-- 为 transactions 表添加 item_id 字段
-- 用于关联资产，支持记录资产的历史收入

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES items(id) ON DELETE SET NULL;

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_transactions_item_id ON transactions(item_id);

-- 添加注释说明
COMMENT ON COLUMN transactions.item_id IS '关联的资产ID，用于记录资产的历史收入（非订单相关的收入）';
