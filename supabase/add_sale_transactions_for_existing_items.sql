-- 为历史已售出资产补齐“设备出售”收入交易记录
-- 目的：
-- 1) 让 transactions 成为财务统计的唯一真相来源（Single Source of Truth）
-- 2) 避免在统计中从 items.sold_price 兜底造成的“双口径”
--
-- 执行前建议：
-- - 先在 Supabase 里备份数据（或至少导出 transactions / items）
--
-- 执行内容：
-- A. 对 items 表里已填写 sold_price + sale_date 的资产，如果 transactions 中不存在对应的“设备出售”收入，则自动插入一条收入交易
-- B. （可选但建议）将自动创建的“设备采购”支出类别统一为“设备购买”，避免分类口径分裂

-- A) 回填设备出售收入交易（防重复）
INSERT INTO transactions (
  item_id,
  order_id,
  type,
  amount,
  category,
  description,
  transaction_date,
  auto_created
)
SELECT
  i.id AS item_id,
  NULL AS order_id,
  'income' AS type,
  i.sold_price AS amount,
  '设备出售' AS category,
  (i.name || ' 设备出售') AS description,
  i.sale_date AS transaction_date,
  TRUE AS auto_created
FROM items i
WHERE i.sold_price IS NOT NULL
  AND i.sold_price > 0
  AND i.sale_date IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM transactions t
    WHERE t.item_id = i.id
      AND t.type = 'income'
      AND t.category = '设备出售'
  );

-- B) 统一自动创建的购买支出类别（可选但建议）
UPDATE transactions
SET
  category = '设备购买',
  description = REPLACE(COALESCE(description, ''), '设备采购', '设备购买')
WHERE auto_created = TRUE
  AND type = 'expense'
  AND category = '设备采购';

