-- 为 items 表添加 'in_use' 状态
-- 用于标识配套资产（如游戏光盘），不产生直接租金收入但正在使用中

ALTER TABLE items 
DROP CONSTRAINT IF EXISTS items_status_check;

ALTER TABLE items 
ADD CONSTRAINT items_status_check 
CHECK (status IN ('available', 'rented', 'in_use', 'maintenance', 'retired', 'sold'));
