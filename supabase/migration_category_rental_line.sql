-- 品类表：租赁业务线（游戏机 / 摄影摄像 / 音响 / 照片打印机等）
-- 与 transactions.business_plate（租赁/羽毛球/自媒体板块）无关

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS rental_line TEXT;

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_rental_line_check;

ALTER TABLE categories
  ADD CONSTRAINT categories_rental_line_check
  CHECK (
    rental_line IS NULL
    OR rental_line IN (
      'game_console',
      'photo_video',
      'audio',
      'photo_printer',
      'other',
      'uncategorized'
    )
  );

COMMENT ON COLUMN categories.rental_line IS '租赁资产品类业务线：game_console/photo_video/audio/photo_printer/other';

-- 按品类名称回填（可在品类管理中再微调）
UPDATE categories SET rental_line = 'photo_printer'
WHERE rental_line IS NULL
  AND (name ILIKE '%照片打印%' OR (name ILIKE '%打印%' AND name ILIKE '%照片%'));

UPDATE categories SET rental_line = 'audio'
WHERE rental_line IS NULL
  AND (
    name ILIKE '%麦克风%'
    OR name ILIKE '%音频%'
    OR name ILIKE '%音响%'
    OR name ILIKE '%音箱%'
    OR name ILIKE '%mic%'
    OR name ILIKE '%audio%'
  );

UPDATE categories SET rental_line = 'photo_video'
WHERE rental_line IS NULL
  AND (
    name ILIKE '%镜头%'
    OR name ILIKE '%相机%'
    OR name ILIKE '%摄像%'
    OR name ILIKE '%camera%'
    OR name ILIKE '%lens%'
  );

UPDATE categories SET rental_line = 'game_console'
WHERE rental_line IS NULL
  AND (
    name ILIKE '%游戏%'
    OR name ILIKE '%ps5%'
    OR name ILIKE '%playstation%'
    OR name ILIKE '%switch%'
    OR name ILIKE '%xbox%'
    OR name ILIKE '%主机%'
    OR name ILIKE '%游戏机%'
    OR name ILIKE '%手柄%'
    OR name ILIKE '%卡带%'
    OR name ILIKE '%光盘%'
  );

UPDATE categories SET rental_line = 'other'
WHERE rental_line IS NULL;

CREATE INDEX IF NOT EXISTS idx_categories_rental_line ON categories(rental_line);
