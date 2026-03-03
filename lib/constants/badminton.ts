export const BADMINTON_SERVICE_TYPES = ['教学', '陪打', '比赛', '组织活动'] as const
export const BADMINTON_INCOME_CATEGORIES = ['教练费', '陪练费', '比赛奖金'] as const
export const BADMINTON_EXPENSE_CATEGORIES = ['场地费', '停车费', '比赛报名费'] as const

export type BadmintonServiceType = (typeof BADMINTON_SERVICE_TYPES)[number]
export type BadmintonIncomeCategory = (typeof BADMINTON_INCOME_CATEGORIES)[number]
export type BadmintonExpenseCategory = (typeof BADMINTON_EXPENSE_CATEGORIES)[number]
