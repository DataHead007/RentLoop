/**
 * 交易板块 / 渠道校验与规范化（唯一写入入口供 API / queries 使用）
 */
import type { BusinessPlate, CreatorChannel } from '@/lib/types/businessPlate'

export type TransactionPlateInput = {
  business_plate: BusinessPlate
  creator_channel?: CreatorChannel | null
}

export function normalizeTransactionPlateInput(input: {
  business_plate?: unknown
  creator_channel?: unknown
  /** 兼容旧字段（迁移过渡期）：映射到 plate + channel */
  business_line?: unknown
}): TransactionPlateInput {
  let plate = input.business_plate as BusinessPlate | undefined
  let channel = (input.creator_channel as CreatorChannel | null | undefined) ?? null

  if (!plate && input.business_line != null) {
    const bl = String(input.business_line)
    if (bl === 'rental') plate = 'rental'
    else if (bl === 'badminton') plate = 'badminton'
    else if (bl === 'youtube') {
      plate = 'creator'
      channel = 'youtube'
    } else if (bl === 'wechat_video') {
      plate = 'creator'
      channel = 'wechat_video'
    }
  }

  if (!plate || !['rental', 'badminton', 'creator'].includes(plate)) {
    plate = 'rental'
  }

  if (plate !== 'creator') {
    channel = null
  } else if (!channel || !['youtube', 'wechat_video', 'xiaohongshu'].includes(channel)) {
    throw new Error('自媒体流水必须选择渠道（YouTube / 微信视频号 / 小红书）')
  }

  return { business_plate: plate, creator_channel: channel }
}
