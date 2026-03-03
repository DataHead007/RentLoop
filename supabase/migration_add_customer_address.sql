-- ============================================
-- 添加客户地址字段
-- ============================================

-- 1. 为 orders 表添加 customer_address 字段
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS customer_address TEXT;

-- 2. 验证迁移
DO $$
BEGIN
  RAISE NOTICE '✅ 客户地址字段迁移完成';
  RAISE NOTICE '   已为 orders 表添加 customer_address 字段';
END $$;
