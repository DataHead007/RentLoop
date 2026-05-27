-- ============================================
-- 羽毛球：个人参赛记录（与订单/交易独立，二期可同步交易）
-- ============================================

CREATE TABLE IF NOT EXISTS badminton_match_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  location TEXT NOT NULL,
  event_time TIME,
  discipline TEXT NOT NULL,
  discipline_other TEXT,
  result TEXT,
  registration_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  prize_mode TEXT NOT NULL DEFAULT 'none'
    CHECK (prize_mode IN ('none', 'cash', 'in_kind', 'both')),
  prize_cash DECIMAL(10, 2),
  prize_in_kind_desc TEXT,
  prize_in_kind_value DECIMAL(10, 2),
  reflection TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT badminton_match_registration_fee_nonneg CHECK (registration_fee >= 0),
  CONSTRAINT badminton_match_prize_cash_nonneg CHECK (prize_cash IS NULL OR prize_cash >= 0),
  CONSTRAINT badminton_match_prize_in_kind_value_nonneg CHECK (prize_in_kind_value IS NULL OR prize_in_kind_value >= 0)
);

CREATE INDEX IF NOT EXISTS idx_badminton_match_records_event_date
  ON badminton_match_records(event_date DESC);

COMMENT ON TABLE badminton_match_records IS '羽毛球个人参赛记录：名称、时间地点、项目、成绩、报名费、奖金/奖品估值、心得';
COMMENT ON COLUMN badminton_match_records.prize_mode IS 'none|cash|in_kind|both';
COMMENT ON COLUMN badminton_match_records.prize_in_kind_value IS '奖品主观估值，计入个人统计净利';

CREATE TRIGGER update_badminton_match_records_updated_at
  BEFORE UPDATE ON badminton_match_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
