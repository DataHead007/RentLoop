-- 为所有已有资产补上购买支出交易记录
-- 此脚本会检查每个资产，如果满足以下条件则创建购买交易：
-- 1. 有购买价格（purchase_price > 0）
-- 2. 还没有对应的购买交易记录
-- 3. 有购买日期（purchase_date），如果没有则使用创建日期

INSERT INTO transactions (item_id, order_id, type, amount, category, description, transaction_date, auto_created, created_at, updated_at)
SELECT 
  i.id as item_id,
  NULL as order_id,
  'expense' as type,
  -i.purchase_price as amount, -- 负数表示支出
  '设备采购' as category,
  i.name || ' 设备采购' as description,
  COALESCE(i.purchase_date, i.created_at::date) as transaction_date, -- 如果没有购买日期，使用创建日期
  true as auto_created,
  NOW() as created_at,
  NOW() as updated_at
FROM items i
WHERE 
  i.purchase_price > 0
  -- 检查是否已存在购买交易记录
  AND NOT EXISTS (
    SELECT 1 
    FROM transactions t 
    WHERE t.item_id = i.id 
      AND t.type = 'expense' 
      AND t.category = '设备采购'
      AND t.auto_created = true
  );

-- 显示插入结果
SELECT 
  COUNT(*) as inserted_count,
  SUM(ABS(amount)) as total_purchase_amount
FROM transactions
WHERE category = '设备采购' 
  AND auto_created = true
  AND created_at >= NOW() - INTERVAL '1 minute';
