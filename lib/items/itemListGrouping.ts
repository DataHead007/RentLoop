import type { ItemWithStats } from '@/lib/types/database'
import {
  getRentalLineForCategory,
  getRentalLineLabel,
  inferRentalLineFromCategoryName,
  RENTAL_LINE_ORDER,
  withinRentalLineSortKey,
  type RentalLine,
} from '@/lib/categories/rentalLine'

/** 列表内状态分组顺序：出租中优先，便于一眼看到在租资产 */
export const ITEM_STATUS_ORDER_ACTIVE = [
  'rented',
  'available',
  'in_use',
  'maintenance',
  'retired',
] as const

export const ITEM_STATUS_ORDER = [...ITEM_STATUS_ORDER_ACTIVE, 'sold'] as const

const STATUS_PRIORITY: Record<string, number> = Object.fromEntries(
  ITEM_STATUS_ORDER.map((status, index) => [status, index + 1])
)

/** @deprecated 使用 RentalLine；保留别名减少扩散改动 */
export type CategoryFamily = RentalLine

export const CATEGORY_FAMILY_LABEL: Record<RentalLine, string> = Object.fromEntries(
  RENTAL_LINE_ORDER.map((line) => [line, getRentalLineLabel(line)])
) as Record<RentalLine, string>

export type ItemStatusGroup = {
  status: string
  items: ItemWithStats[]
}

export type ItemCategoryGroup = {
  categoryName: string
  /** 业务线 */
  family: RentalLine
  statusGroups: ItemStatusGroup[]
  itemCount: number
}

export type ItemListFamilySection = {
  family: RentalLine
  familyLabel: string
  categories: ItemCategoryGroup[]
  itemCount: number
}

/** 单业务线筛选：先按状态分段，段内再按品类 */
export type ItemListStatusSection = {
  status: string
  categories: ItemCategoryGroup[]
  itemCount: number
}

export type ItemListDisplay = {
  /** 在营资产：按业务线 → 品类 → 状态 */
  sections: ItemListFamilySection[]
  /** 单业务线筛选时为 true，列表应先渲染 statusFirstSections */
  statusFirstSections: ItemListStatusSection[] | null
  /** 全部已售出（列表最底部） */
  soldCategories: ItemCategoryGroup[]
  soldCount: number
}

const UNCATEGORIZED = '未分类'

export function getCategoryFamily(categoryName: string): RentalLine {
  return inferRentalLineFromCategoryName(categoryName)
}

function getLineForItem(item: ItemWithStats): RentalLine {
  return getRentalLineForCategory(item.category ?? { name: UNCATEGORIZED, rental_line: null })
}

function compareCategoryNames(a: string, b: string, lineA?: RentalLine, lineB?: RentalLine): number {
  const famA = lineA ?? inferRentalLineFromCategoryName(a)
  const famB = lineB ?? inferRentalLineFromCategoryName(b)
  const familyDiff = RENTAL_LINE_ORDER.indexOf(famA) - RENTAL_LINE_ORDER.indexOf(famB)
  if (familyDiff !== 0) return familyDiff

  const withinDiff = withinRentalLineSortKey(a, famA) - withinRentalLineSortKey(b, famB)
  if (withinDiff !== 0) return withinDiff

  return a.localeCompare(b, 'zh-CN')
}

/** 同一状态组内：净收益高者优先，再品类、购买成本 */
export function compareItemsWithinStatus(a: ItemWithStats, b: ItemWithStats): number {
  const profitDiff = (b.net_profit || 0) - (a.net_profit || 0)
  if (profitDiff !== 0) return profitDiff

  const line = getLineForItem(a)
  const catA = a.category?.name || UNCATEGORIZED
  const catB = b.category?.name || UNCATEGORIZED
  const catCmp = compareCategoryNames(catA, catB, line, getLineForItem(b))
  if (catCmp !== 0) return catCmp

  return (b.purchase_price || 0) - (a.purchase_price || 0)
}

/** 默认全览：业务线 → 状态 → 净收益 → 品类 */
export function compareItemsForList(a: ItemWithStats, b: ItemWithStats): number {
  const lineA = getLineForItem(a)
  const lineB = getLineForItem(b)
  const lineDiff = RENTAL_LINE_ORDER.indexOf(lineA) - RENTAL_LINE_ORDER.indexOf(lineB)
  if (lineDiff !== 0) return lineDiff

  const statusA = STATUS_PRIORITY[a.status] ?? 999
  const statusB = STATUS_PRIORITY[b.status] ?? 999
  if (statusA !== statusB) return statusA - statusB

  const within = compareItemsWithinStatus(a, b)
  if (within !== 0) return within

  return 0
}

function sortStatusGroups(category: ItemCategoryGroup) {
  category.statusGroups.sort(
    (a, b) => (STATUS_PRIORITY[a.status] ?? 999) - (STATUS_PRIORITY[b.status] ?? 999)
  )
}

function groupByCategory(
  items: ItemWithStats[],
  includeStatuses: readonly string[],
  sortFn: (a: ItemWithStats, b: ItemWithStats) => number
): ItemCategoryGroup[] {
  const allowed = new Set(includeStatuses)
  const sorted = [...items].filter((i) => allowed.has(i.status)).sort(sortFn)

  const result: ItemCategoryGroup[] = []

  for (const item of sorted) {
    const categoryName = item.category?.name || UNCATEGORIZED
    let category = result.find((c) => c.categoryName === categoryName)
    if (!category) {
      category = {
        categoryName,
        family: getLineForItem(item),
        statusGroups: [],
        itemCount: 0,
      }
      result.push(category)
    }

    let statusGroup = category.statusGroups.find((g) => g.status === item.status)
    if (!statusGroup) {
      statusGroup = { status: item.status, items: [] }
      category.statusGroups.push(statusGroup)
    }

    statusGroup.items.push(item)
    category.itemCount += 1
  }

  for (const category of result) {
    sortStatusGroups(category)
  }

  return result
}

function buildStatusFirstSections(activeItems: ItemWithStats[]): ItemListStatusSection[] {
  const sections: ItemListStatusSection[] = []

  for (const status of ITEM_STATUS_ORDER_ACTIVE) {
    const statusItems = activeItems.filter((i) => i.status === status)
    if (statusItems.length === 0) continue

    const categories = groupByCategory(statusItems, [status], compareItemsWithinStatus)
    sections.push({
      status,
      categories,
      itemCount: statusItems.length,
    })
  }

  return sections
}

function bucketIntoLineSections(categories: ItemCategoryGroup[]): ItemListFamilySection[] {
  const sections: ItemListFamilySection[] = []

  for (const line of RENTAL_LINE_ORDER) {
    const inLine = categories.filter((c) => c.family === line)
    if (inLine.length === 0) continue
    sections.push({
      family: line,
      familyLabel: getRentalLineLabel(line),
      categories: inLine,
      itemCount: inLine.reduce((sum, c) => sum + c.itemCount, 0),
    })
  }

  return sections
}

export function buildItemListDisplay(
  items: ItemWithStats[],
  options?: { statusFilter?: string; groupByStatusFirst?: boolean }
): ItemListDisplay {
  const statusFilter = options?.statusFilter ?? 'all'
  const groupByStatusFirst = options?.groupByStatusFirst ?? false

  if (statusFilter === 'sold') {
    const soldCategories = groupByCategory(items, ['sold'], compareItemsWithinStatus)
    const soldCount = soldCategories.reduce((s, c) => s + c.itemCount, 0)
    return { sections: [], statusFirstSections: null, soldCategories, soldCount }
  }

  const activeItems =
    statusFilter === 'all' ? items.filter((i) => i.status !== 'sold') : items.filter((i) => i.status === statusFilter)

  const activeStatuses =
    statusFilter === 'all' ? ITEM_STATUS_ORDER_ACTIVE : ([statusFilter] as readonly string[])

  if (groupByStatusFirst && activeItems.length > 0) {
    const statusFirstSections = buildStatusFirstSections(activeItems)
    const soldCategories =
      statusFilter === 'all' ? groupByCategory(items.filter((i) => i.status === 'sold'), ['sold'], compareItemsWithinStatus) : []
    const soldCount = soldCategories.reduce((sum, c) => sum + c.itemCount, 0)
    return { sections: [], statusFirstSections, soldCategories, soldCount }
  }

  const activeCategories = groupByCategory(activeItems, activeStatuses, compareItemsForList)
  const sections = bucketIntoLineSections(activeCategories)

  const soldCategories =
    statusFilter === 'all'
      ? groupByCategory(items.filter((i) => i.status === 'sold'), ['sold'], compareItemsWithinStatus)
      : []

  const soldCount = soldCategories.reduce((sum, c) => sum + c.itemCount, 0)

  return { sections, statusFirstSections: null, soldCategories, soldCount }
}

/** @deprecated 使用 buildItemListDisplay */
export function groupItemsByCategoryAndStatus(items: ItemWithStats[]): ItemCategoryGroup[] {
  const display = buildItemListDisplay(items)
  if (display.statusFirstSections) {
    return display.statusFirstSections.flatMap((s) => s.categories)
  }
  return [...display.sections.flatMap((s) => s.categories), ...display.soldCategories]
}
