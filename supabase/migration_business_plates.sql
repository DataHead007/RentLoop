-- 三大板块 + 自媒体二级渠道（替换原 transactions.business_line 四枚举）
-- 执行前请备份。迁移后应用代码使用 business_plate + creator_channel。

-- 1. 新增列
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS business_plate TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS creator_channel TEXT;

-- 2. 按旧 business_line 回填（若该列仍存在）；否则仅补默认 rental
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transactions'
      AND column_name = 'business_line'
  ) THEN
    UPDATE transactions SET business_plate = CASE
      WHEN COALESCE(business_line, 'rental') = 'rental' THEN 'rental'
      WHEN business_line = 'badminton' THEN 'badminton'
      WHEN business_line IN ('youtube', 'wechat_video') THEN 'creator'
      ELSE 'rental'
    END
    WHERE business_plate IS NULL;

    UPDATE transactions SET creator_channel = CASE
      WHEN business_line = 'youtube' THEN 'youtube'
      WHEN business_line = 'wechat_video' THEN 'wechat_video'
      ELSE NULL
    END;
  END IF;
END $$;

UPDATE transactions SET business_plate = 'rental' WHERE business_plate IS NULL;

ALTER TABLE transactions ALTER COLUMN business_plate SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN business_plate SET DEFAULT 'rental';

-- 3. 自媒体必须有渠道（回填后不应存在 creator 而无渠道）
UPDATE transactions
SET creator_channel = 'youtube'
WHERE business_plate = 'creator' AND creator_channel IS NULL;

-- 4. 删除旧约束与列
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_business_line_check;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_business_line_check1;
ALTER TABLE transactions DROP COLUMN IF EXISTS business_line;

-- 5. 新约束
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_business_plate_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_business_plate_check
  CHECK (business_plate IN ('rental', 'badminton', 'creator'));

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_creator_channel_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_creator_channel_check
  CHECK (
    (business_plate = 'creator' AND creator_channel IN ('youtube', 'wechat_video', 'xiaohongshu'))
    OR (business_plate <> 'creator' AND creator_channel IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_transactions_business_plate ON transactions(business_plate);
CREATE INDEX IF NOT EXISTS idx_transactions_plate_channel ON transactions(business_plate, creator_channel);

COMMENT ON COLUMN transactions.business_plate IS 'rental=租赁 | badminton=羽毛球 | creator=自媒体';
COMMENT ON COLUMN transactions.creator_channel IS '仅 creator：youtube | wechat_video | xiaohongshu';

-- 6. 替换统计 RPC（参数改为板块 + 可选渠道）
DROP FUNCTION IF EXISTS public.get_transaction_summary(DATE, DATE, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_transaction_summary(DATE, DATE, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_transaction_summary(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_business_plate TEXT DEFAULT NULL,
  p_creator_channel TEXT DEFAULT NULL
)
RETURNS TABLE (
  business_plate TEXT,
  creator_channel TEXT,
  type TEXT,
  category TEXT,
  total_amount NUMERIC,
  tx_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    t.business_plate,
    t.creator_channel,
    t.type,
    COALESCE(t.category, '其他') AS category,
    SUM(CASE WHEN t.type = 'expense' THEN ABS(t.amount) ELSE t.amount END) AS total_amount,
    COUNT(*) AS tx_count
  FROM transactions t
  WHERE
    (p_start_date IS NULL OR t.transaction_date >= p_start_date)
    AND (p_end_date IS NULL OR t.transaction_date <= p_end_date)
    AND (p_type IS NULL OR t.type = p_type)
    AND (p_category IS NULL OR t.category = p_category)
    AND (p_business_plate IS NULL OR t.business_plate = p_business_plate)
    AND (p_creator_channel IS NULL OR t.creator_channel IS NOT DISTINCT FROM p_creator_channel)
  GROUP BY t.business_plate, t.creator_channel, t.type, COALESCE(t.category, '其他');
$$;

COMMENT ON FUNCTION public.get_transaction_summary(DATE, DATE, TEXT, TEXT, TEXT, TEXT)
IS '按条件聚合交易统计（按 business_plate / creator_channel / type / category 分组）';
