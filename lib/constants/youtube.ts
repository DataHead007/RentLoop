export const YOUTUBE_INCOME_CATEGORIES = ['广告收入', '会员收入', '打赏', '其他收入'] as const
export const YOUTUBE_EXPENSE_CATEGORIES = ['设备采购', '剪辑软件', '推广费用', '门票费用', '住宿费用', '交通费用', '其他支出'] as const

export type YoutubeIncomeCategory = (typeof YOUTUBE_INCOME_CATEGORIES)[number]
export type YoutubeExpenseCategory = (typeof YOUTUBE_EXPENSE_CATEGORIES)[number]
