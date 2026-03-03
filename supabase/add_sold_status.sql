-- 添加 'sold' 状态到 items 表
-- 将 status 约束更新为包含 'sold'

ALTER TABLE items 
DROP CONSTRAINT IF EXISTS items_status_check;

ALTER TABLE items 
ADD CONSTRAINT items_status_check 
CHECK (status IN ('available', 'rented', 'maintenance', 'retired', 'sold'));
