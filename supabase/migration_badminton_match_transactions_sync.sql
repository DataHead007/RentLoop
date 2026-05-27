-- ============================================
-- 比赛记录 ↔ 羽毛球交易：关联字段（自动同步用）
-- 依赖：badminton_match_records 表、transactions.business_plate
-- ============================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS badminton_match_record_id UUID
  REFERENCES badminton_match_records(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_transactions_badminton_match_record_id
  ON transactions(badminton_match_record_id)
  WHERE badminton_match_record_id IS NOT NULL;

COMMENT ON COLUMN transactions.badminton_match_record_id IS '关联羽毛球个人参赛记录；auto_created 交易由比赛保存时同步';
