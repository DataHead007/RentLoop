-- 为 items 表添加卡口（mount）字段
-- 用于镜头类设备的卡口类型（如 Canon EF、Nikon F、Sony E 等）

ALTER TABLE items 
ADD COLUMN IF NOT EXISTS mount TEXT;

-- 添加注释说明
COMMENT ON COLUMN items.mount IS '卡口类型，主要用于镜头类设备（如 Canon EF、Nikon F、Sony E 等）';
