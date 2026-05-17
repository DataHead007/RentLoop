import type { BusinessPlate, CreatorChannel } from '@/lib/types/businessPlate'

/** 交易列表 / 统计用的组合筛选（一条状态即可驱动 UI） */
export type TransactionScopeFilter =
  | 'all'
  | 'rental'
  | 'badminton'
  | 'creator'
  | 'creator:youtube'
  | 'creator:wechat_video'
  | 'creator:xiaohongshu'

export function scopeToQueryParams(scope: TransactionScopeFilter): URLSearchParams {
  const p = new URLSearchParams()
  if (scope === 'all') return p
  if (scope === 'rental') {
    p.set('businessPlate', 'rental')
    return p
  }
  if (scope === 'badminton') {
    p.set('businessPlate', 'badminton')
    return p
  }
  if (scope === 'creator') {
    p.set('businessPlate', 'creator')
    return p
  }
  if (scope.startsWith('creator:')) {
    const ch = scope.slice('creator:'.length) as CreatorChannel
    p.set('businessPlate', 'creator')
    p.set('creatorChannel', ch)
    return p
  }
  return p
}

export function queryParamsToScope(
  businessPlate: string | null,
  creatorChannel: string | null
): TransactionScopeFilter {
  if (!businessPlate || businessPlate === 'all') return 'all'
  if (businessPlate === 'rental') return 'rental'
  if (businessPlate === 'badminton') return 'badminton'
  if (businessPlate === 'creator') {
    if (creatorChannel && ['youtube', 'wechat_video', 'xiaohongshu'].includes(creatorChannel)) {
      return `creator:${creatorChannel}` as TransactionScopeFilter
    }
    return 'creator'
  }
  return 'all'
}

export const SCOPE_LABEL: Record<TransactionScopeFilter, string> = {
  all: '全部',
  rental: '租赁',
  badminton: '羽毛球',
  creator: '自媒体',
  'creator:youtube': 'YouTube',
  'creator:wechat_video': '微信视频号',
  'creator:xiaohongshu': '小红书',
}

export const SCOPE_ORDER: TransactionScopeFilter[] = [
  'all',
  'rental',
  'badminton',
  'creator',
  'creator:youtube',
  'creator:wechat_video',
  'creator:xiaohongshu',
]
