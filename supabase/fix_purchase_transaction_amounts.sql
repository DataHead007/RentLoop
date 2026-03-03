-- 修复设备采购交易记录的金额（确保支出类型的金额是负数）
-- 此脚本会将所有"设备采购"类型的支出交易记录的金额改为负数

UPDATE transactions
SET amount = -ABS(amount)
WHERE type = 'expense' 
  AND category = '设备采购'
  AND amount > 0;  -- 只修复正数的记录

-- 显示修复结果
SELECT 
  COUNT(*) as fixed_count,
  SUM(ABS(amount)) as total_amount
FROM transactions
WHERE type = 'expense' 
  AND category = '设备采购'
  AND amount < 0;  -- 修复后应该是负数
