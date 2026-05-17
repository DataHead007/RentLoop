import type { Item } from '@/lib/types/database'

/**
 * P5-4：售出信息与 `status=sold` 单一路径——由服务端与「设备出售」自动流水对齐。
 * - 有有效出售价 + 出售日期 → 强制 `sold`（除非显式设为 retired / maintenance）。
 * - 已售出但本次更新后不再有有效出售信息 → 默认回到 `available`（未显式传 status 时）。
 */
export function normalizeItemLiquidationPatch(
  body: Partial<Item>,
  oldItem: Item | null
): Partial<Item> {
  const next: Partial<Item> = { ...body }

  const sold_price =
    body.sold_price !== undefined ? body.sold_price : (oldItem?.sold_price ?? null)
  const sale_date =
    body.sale_date !== undefined ? body.sale_date : (oldItem?.sale_date ?? null)

  const hasSaleInfo = !!(sold_price && Number(sold_price) > 0 && sale_date)

  if (hasSaleInfo) {
    if (body.status !== 'retired' && body.status !== 'maintenance') {
      next.status = 'sold'
    }
  } else if (oldItem?.status === 'sold' && !hasSaleInfo && body.status === undefined) {
    next.status = 'available'
  }

  return next
}
