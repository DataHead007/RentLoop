-- 订单幂等键：同一键重复 POST 时返回已有订单，避免网络断连（如 ECONNRESET）后重试产生重复订单
-- 在 Supabase SQL Editor 或迁移流程中执行一次即可

ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key text;

-- 仅对非空键唯一；允许多条 idempotency_key 为 NULL 的历史订单
CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_unique
  ON orders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
