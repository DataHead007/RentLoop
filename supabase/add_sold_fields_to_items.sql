-- 为 items 表添加出售信息字段
-- 用于记录资产的出售价格和出售日期，支持计算净收益和完整的 ROI

ALTER TABLE items 
ADD COLUMN IF NOT EXISTS sold_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS sale_date DATE;

-- 添加注释说明
COMMENT ON COLUMN items.sold_price IS '出售价格（如果资产已出售）';
COMMENT ON COLUMN items.sale_date IS '出售日期（如果资产已出售）';
