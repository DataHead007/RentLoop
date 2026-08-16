import type { ItemRentalScheduleEntry } from '@/lib/items/itemRentalSchedule'

/** 列表展示用状态（不改数据库 items.status） */
export const ITEM_LIST_STATUS_BOOKED = 'booked' as const

export type ItemListDisplayStatusKey =
  | 'rented'
  | typeof ITEM_LIST_STATUS_BOOKED
  | 'available'
  | 'in_use'
  | 'maintenance'
  | 'retired'
  | 'sold'

/** 在营资产列表分组顺序：出租中 → 已预订 → 可用 */
export const ITEM_LIST_DISPLAY_STATUS_ORDER_ACTIVE = [
  'rented',
  ITEM_LIST_STATUS_BOOKED,
  'available',
  'in_use',
  'maintenance',
  'retired',
] as const satisfies readonly ItemListDisplayStatusKey[]

export const ITEM_LIST_DISPLAY_STATUS_ORDER = [
  ...ITEM_LIST_DISPLAY_STATUS_ORDER_ACTIVE,
  'sold',
] as const satisfies readonly ItemListDisplayStatusKey[]

export const ITEM_LIST_DISPLAY_STATUS_LABELS: Record<ItemListDisplayStatusKey, string> = {
  rented: '出租中',
  booked: '已预订',
  available: '可用',
  in_use: '使用中',
  maintenance: '维护中',
  retired: '已退役',
  sold: '已售出',
}

export const ITEM_LIST_DISPLAY_STATUS_BADGE_VARIANTS: Record<
  ItemListDisplayStatusKey,
  'default' | 'secondary' | 'success' | 'warning'
> = {
  rented: 'default',
  booked: 'warning',
  available: 'success',
  in_use: 'default',
  maintenance: 'warning',
  retired: 'secondary',
  sold: 'secondary',
}

export function hasActiveRentalSchedule(
  schedules?: ItemRentalScheduleEntry[]
): boolean {
  return schedules?.some((s) => s.status === 'in_progress') ?? false
}

export function hasUpcomingRentalBooking(
  schedules?: ItemRentalScheduleEntry[]
): boolean {
  return (
    schedules?.some((s) => s.status === 'pending' || s.status === 'confirmed') ??
    false
  )
}

/** 根据库内状态 + 租赁档期推导列表展示状态 */
export function resolveItemListDisplayStatusKey(
  itemStatus: string,
  schedules?: ItemRentalScheduleEntry[]
): string {
  if (
    itemStatus === 'sold' ||
    itemStatus === 'maintenance' ||
    itemStatus === 'retired' ||
    itemStatus === 'in_use'
  ) {
    return itemStatus
  }

  if (itemStatus === 'rented' || hasActiveRentalSchedule(schedules)) {
    return 'rented'
  }

  if (itemStatus === 'available' && hasUpcomingRentalBooking(schedules)) {
    return ITEM_LIST_STATUS_BOOKED
  }

  return itemStatus
}

export function getItemListDisplayStatusLabel(statusKey: string): string {
  return (
    ITEM_LIST_DISPLAY_STATUS_LABELS[statusKey as ItemListDisplayStatusKey] ?? statusKey
  )
}

export function getItemListDisplayStatusBadgeVariant(
  statusKey: string
): 'default' | 'secondary' | 'success' | 'warning' {
  return (
    ITEM_LIST_DISPLAY_STATUS_BADGE_VARIANTS[statusKey as ItemListDisplayStatusKey] ??
    'secondary'
  )
}
