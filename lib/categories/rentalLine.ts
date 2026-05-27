/** 租赁板块内资产品类所属业务线（与 transactions 的 business_plate 无关） */
export const RENTAL_LINES = [
  'game_console',
  'photo_video',
  'audio',
  'photo_printer',
  'other',
  'uncategorized',
] as const

export type RentalLine = (typeof RENTAL_LINES)[number]

export const RENTAL_LINE_LABEL: Record<RentalLine, string> = {
  game_console: '游戏机',
  photo_video: '摄影摄像',
  audio: '音响设备',
  photo_printer: '照片打印机',
  other: '其他',
  uncategorized: '未分类',
}

export const RENTAL_LINE_ORDER: RentalLine[] = [
  'photo_video',
  'game_console',
  'audio',
  'photo_printer',
  'other',
  'uncategorized',
]

export const RENTAL_LINE_OPTIONS = RENTAL_LINE_ORDER.filter((l) => l !== 'uncategorized').map(
  (value) => ({
    value,
    label: RENTAL_LINE_LABEL[value],
  })
)

export function isRentalLine(value: string): value is RentalLine {
  return (RENTAL_LINES as readonly string[]).includes(value)
}

/** 根据品类名称推断业务线（迁移回填 & 未设置时的兜底） */
export function inferRentalLineFromCategoryName(categoryName: string): RentalLine {
  const n = categoryName.toLowerCase()

  if (n.includes('照片打印') || (n.includes('打印') && n.includes('照片'))) {
    return 'photo_printer'
  }
  if (n.includes('打印机') && !n.includes('游戏')) {
    return 'photo_printer'
  }

  if (
    n.includes('麦克风') ||
    n.includes('mic') ||
    n.includes('microphone') ||
    n.includes('音频') ||
    n.includes('audio') ||
    n.includes('音响') ||
    n.includes('音箱') ||
    n.includes('耳机')
  ) {
    return 'audio'
  }

  if (
    n.includes('镜头') ||
    n.includes('lens') ||
    n.includes('相机') ||
    n.includes('camera') ||
    n.includes('摄像机') ||
    n.includes('摄像')
  ) {
    return 'photo_video'
  }

  if (
    n.includes('游戏') ||
    n.includes('ps5') ||
    n.includes('playstation') ||
    n.includes('switch') ||
    n.includes('xbox') ||
    n.includes('主机') ||
    n.includes('游戏机') ||
    n.includes('手柄') ||
    n.includes('卡带') ||
    n.includes('光盘')
  ) {
    return 'game_console'
  }

  if (categoryName === '未分类' || !categoryName.trim()) {
    return 'uncategorized'
  }

  return 'other'
}

export function getRentalLineForCategory(
  category: { name: string; rental_line?: string | null } | null | undefined
): RentalLine {
  if (!category?.name) return 'uncategorized'
  if (category.rental_line && isRentalLine(category.rental_line)) {
    return category.rental_line
  }
  return inferRentalLineFromCategoryName(category.name)
}

export function getRentalLineLabel(line: RentalLine): string {
  return RENTAL_LINE_LABEL[line]
}

/** 同业务线内品类排序权重 */
export function withinRentalLineSortKey(categoryName: string, line: RentalLine): number {
  const n = categoryName.toLowerCase()
  if (line === 'photo_video') {
    if (n.includes('相机') && !n.includes('镜头')) return 10
    if (n.includes('镜头') || n.includes('lens')) return 20
    return 40
  }
  if (line === 'game_console') {
    if (
      n.includes('主机') ||
      n.includes('游戏机') ||
      n.includes('ps5') ||
      n.includes('switch') ||
      n.includes('xbox')
    ) {
      return 10
    }
    if (n.includes('账号') || n.includes('数字版')) return 20
    if (n.includes('手柄')) return 25
    if (n.includes('卡带') || n.includes('光盘')) return 30
    if (n.includes('游戏')) return 35
    return 40
  }
  if (line === 'audio') return 10
  if (line === 'photo_printer') return 10
  return 100
}
