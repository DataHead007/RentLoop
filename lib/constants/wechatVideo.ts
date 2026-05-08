export const WECHAT_VIDEO_INCOME_CATEGORIES = [
  '创作分成',
  '流量激励',
  '直播收入',
  '打赏与礼物',
  '带货佣金',
  '付费内容或课程',
  '活动或任务奖励',
  '其他收入',
] as const

export const WECHAT_VIDEO_EXPENSE_CATEGORIES = [
  '拍摄设备与配件',
  '道具与耗材',
  '投流与推广',
  '软件与会员',
  '场地与交通',
  '其他支出',
] as const

export type WechatVideoIncomeCategory = (typeof WECHAT_VIDEO_INCOME_CATEGORIES)[number]
export type WechatVideoExpenseCategory = (typeof WECHAT_VIDEO_EXPENSE_CATEGORIES)[number]
