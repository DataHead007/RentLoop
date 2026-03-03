import type { Order } from '../types/database'

/**
 * 检查日期范围是否与已有订单冲突
 */
export function isDateRangeAvailable(
  startDate: Date,
  endDate: Date,
  existingOrders: Order[],
  excludeOrderId?: string
): boolean {
  const start = startDate.getTime()
  const end = endDate.getTime()

  return !existingOrders.some((order) => {
    // 排除当前正在编辑的订单
    if (excludeOrderId && order.id === excludeOrderId) {
      return false
    }

    // 只检查已确认或进行中的订单
    if (!['confirmed', 'in_progress'].includes(order.status)) {
      return false
    }

    const orderStart = new Date(order.start_date).getTime()
    const orderEnd = new Date(order.end_date).getTime()

    // 检查是否有日期重叠
    return !(end < orderStart || start > orderEnd)
  })
}

/**
 * 获取某个设备的所有已占用日期
 */
export function getBookedDates(orders: Order[]): Date[] {
  const bookedDates: Date[] = []

  orders
    .filter((order) => ['confirmed', 'in_progress'].includes(order.status))
    .forEach((order) => {
      const start = new Date(order.start_date)
      const end = new Date(order.end_date)

      const currentDate = new Date(start)
      while (currentDate <= end) {
        bookedDates.push(new Date(currentDate))
        currentDate.setDate(currentDate.getDate() + 1)
      }
    })

  return bookedDates
}

/**
 * 计算租赁天数和总金额
 */
export function calculateRentalAmount(
  startDate: Date,
  endDate: Date,
  dailyRate: number
): { days: number; totalAmount: number } {
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  // 计算天数（包含起始和结束日期）
  const diffTime = end.getTime() - start.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

  const totalAmount = diffDays * dailyRate

  return {
    days: diffDays,
    totalAmount: Math.round(totalAmount * 100) / 100, // 保留两位小数
  }
}
