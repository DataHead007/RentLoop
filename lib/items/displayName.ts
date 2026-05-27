/** 列表等场景优先显示的简称；未设置时回退全名 */
export function getItemListDisplayName(item: {
  name: string
  short_name?: string | null
}): string {
  const short = item.short_name?.trim()
  return short || item.name
}

export function hasItemShortName(item: { short_name?: string | null }): boolean {
  return Boolean(item.short_name?.trim())
}
