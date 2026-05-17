/** 三大板块（租赁 / 羽毛球 / 自媒体） */
export type BusinessPlate = 'rental' | 'badminton' | 'creator'

/** 自媒体二级渠道（仅 business_plate = creator 时有效） */
export type CreatorChannel = 'youtube' | 'wechat_video' | 'xiaohongshu'

export const CREATOR_CHANNELS: readonly CreatorChannel[] = ['youtube', 'wechat_video', 'xiaohongshu']

export const BUSINESS_PLATES: readonly BusinessPlate[] = ['rental', 'badminton', 'creator']

export const PLATE_LABEL: Record<BusinessPlate, string> = {
  rental: '租赁',
  badminton: '羽毛球',
  creator: '自媒体',
}

export const CHANNEL_LABEL: Record<CreatorChannel, string> = {
  youtube: 'YouTube',
  wechat_video: '微信视频号',
  xiaohongshu: '小红书',
}
