-- ============================================
-- YouTube频道：业务线扩展
-- ============================================

-- 扩展 business_line 支持 YouTube 频道
-- 注意：PostgreSQL 的约束名可能是自动生成的，先尝试删除可能存在的约束
DO $$
BEGIN
  -- 尝试删除可能存在的约束（如果存在）
  ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_business_line_check;
  ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_business_line_check1;
  -- 如果约束名不同，可能需要手动查询：SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'transactions' AND constraint_type = 'CHECK';
EXCEPTION
  WHEN OTHERS THEN
    -- 如果约束不存在，忽略错误
    NULL;
END $$;

-- 添加新的约束，包含 youtube
ALTER TABLE transactions ADD CONSTRAINT transactions_business_line_check 
  CHECK (business_line IN ('rental', 'badminton', 'youtube'));

COMMENT ON COLUMN transactions.business_line IS 'rental=租赁, badminton=羽毛球副业, youtube=YouTube频道';
