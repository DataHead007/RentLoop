-- ============================================
-- 微信视频号：业务线扩展
-- ============================================

DO $$
BEGIN
  ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_business_line_check;
  ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_business_line_check1;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

ALTER TABLE transactions ADD CONSTRAINT transactions_business_line_check
  CHECK (business_line IN ('rental', 'badminton', 'youtube', 'wechat_video'));

COMMENT ON COLUMN transactions.business_line IS 'rental=租赁, badminton=羽毛球副业, youtube=YouTube频道, wechat_video=微信视频号';
