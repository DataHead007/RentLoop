-- MVP：购置融资（一笔借款严格对应一件资产，先息后本 + 手动确认还款 → 写入 transactions）

CREATE TABLE IF NOT EXISTS financing_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  title TEXT,
  principal_total NUMERIC(12, 2) NOT NULL CHECK (principal_total > 0),
  principal_remaining NUMERIC(12, 2) NOT NULL CHECK (principal_remaining >= 0),
  annual_rate_percent NUMERIC(8, 4) NOT NULL CHECK (annual_rate_percent >= 0),
  repayment_day_of_month INT NOT NULL CHECK (repayment_day_of_month >= 1 AND repayment_day_of_month <= 28),
  start_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT financing_loans_principal_remaining_le_total CHECK (principal_remaining <= principal_total)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_financing_loans_one_active_per_item
  ON financing_loans (item_id)
  WHERE (status = 'active');

CREATE INDEX IF NOT EXISTS idx_financing_loans_item_id ON financing_loans (item_id);
CREATE INDEX IF NOT EXISTS idx_financing_loans_status ON financing_loans (status);

CREATE TABLE IF NOT EXISTS financing_loan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES financing_loans(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  interest_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (interest_amount >= 0),
  principal_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (principal_amount >= 0),
  interest_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  principal_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT financing_loan_payments_some_amount CHECK (interest_amount > 0 OR principal_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_financing_loan_payments_loan_id ON financing_loan_payments (loan_id);

CREATE TRIGGER update_financing_loans_updated_at
  BEFORE UPDATE ON financing_loans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE financing_loans IS 'MVP：资产购置借款，1:1 绑定 item；年化利率与还款日仅作记录，利息金额以手动确认为准';
COMMENT ON TABLE financing_loan_payments IS 'MVP：每次确认还款一条记录，并关联生成的 expense transactions';
