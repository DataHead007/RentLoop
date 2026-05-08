-- 交易统计聚合 RPC
-- 将 /api/transactions/stats 的聚合逻辑下推到数据库层

CREATE OR REPLACE FUNCTION public.get_transaction_summary(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_business_line TEXT DEFAULT NULL
)
RETURNS TABLE (
  business_line TEXT,
  type TEXT,
  category TEXT,
  total_amount NUMERIC,
  tx_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    t.business_line,
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
    AND (p_business_line IS NULL OR t.business_line = p_business_line)
  GROUP BY t.business_line, t.type, COALESCE(t.category, '其他');
$$;

COMMENT ON FUNCTION public.get_transaction_summary(DATE, DATE, TEXT, TEXT, TEXT)
IS '按条件聚合交易统计（按 business_line/type/category 分组）';
