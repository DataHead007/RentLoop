-- 为资产表添加昵称/简称字段，用于在订单列表等场景显示短名字

ALTER TABLE items
ADD COLUMN IF NOT EXISTS short_name TEXT;

COMMENT ON COLUMN items.short_name IS '昵称或简称，在订单列表等处优先显示';
