-- 为transactions表添加auto_created字段
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS auto_created BOOLEAN DEFAULT FALSE;
