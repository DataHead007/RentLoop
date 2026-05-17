// 数据库类型定义

import type { BusinessPlate, CreatorChannel } from '@/lib/types/businessPlate'

export interface Category {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface Item {
  id: string
  category_id: string
  name: string
  short_name: string | null
  brand: string | null
  model: string | null
  serial_number: string | null
  purchase_price: number
  purchase_date: string | null
  purchase_invoice_url: string | null
  sold_price: number | null // 出售价格（如果资产已出售）
  sale_date: string | null // 出售日期（如果资产已出售）
  mount: string | null // 镜头卡口类型
  status: 'available' | 'rented' | 'in_use' | 'maintenance' | 'retired' | 'sold'
  notes: string | null
  created_at: string
  updated_at: string
  category?: Category
}

export interface ItemWithStats extends Item {
  total_revenue: number
  net_profit: number
  total_days_rented: number
  /** 账面条目口径：(净收益 / (购置 + 其他支出)) × 100，与「回本进度」不同 */
  roi: number
  /** 相对有效购置价的经营回本比例（%），可超过 100（经营收入 − 非购置支出）/ 购置 × 100 */
  payback_progress_pct: number
  /** 经营累计净额已超过有效购置价的部分（购置已回本后的盈余） */
  payback_excess_amount: number
  /** 相对买价尚未通过经营收回的金额 */
  payback_remaining: number
  /** 融资放款入账合计（购置被贷款覆盖部分） */
  financing_disbursement_total: number
  /** 购置中自付现金部分 = 有效购置价 − 融资放款 */
  owner_equity_purchase: number
  /** 经营累计净额 = 经营口径收入 − 非购置、非还本支出（不含设备购买） */
  operating_surplus: number
  /** 有效购置价（来自交易「设备购买」或 items.purchase_price） */
  effective_purchase_cost: number
  /** 进行中融资剩余本金合计（记法 A：仅融资表，不由租金冲减） */
  financing_principal_remaining: number
}

export interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  total_orders: number
  total_amount: number
  /** 仅羽毛球订单：各单 total_amount（净值）之和与笔数；由 getCustomers 从订单表聚合 */
  badminton_total_amount?: number
  badminton_order_count?: number
  first_order_date: string | null
  last_order_date: string | null
  created_at: string
  updated_at: string
  /** getCustomer 等接口展开，非 customers 表字段 */
  orders?: Order[]
}

export type OrderType = 'rental' | 'badminton'
export type BadmintonServiceType = '教学' | '陪打' | '比赛' | '组织活动'
export type BadmintonIncomeCategory = '教练费' | '陪练费' | '比赛奖金'
export type BadmintonExpenseCategory = '场地费' | '停车费' | '比赛报名费'

export interface BadmintonOrderLine {
  id: string
  order_id: string
  line_type: 'income' | 'expense'
  category: string
  amount: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  order_number: string | null
  order_type: OrderType
  customer_id: string | null
  customer_name: string
  customer_phone: string | null
  customer_email: string | null
  customer_address: string | null
  start_date: string
  end_date: string
  total_amount: number // 总租金（不含物流）或羽毛球订单净额
  total_deposit: number // 总押金（租赁）
  total_shipping_cost: number // 物流费用（租赁）
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
  checkout_snapshot_url: string | null
  checkin_snapshot_url: string | null
  notes: string | null
  /** 创建订单时客户端生成的幂等键；网络失败后重试应携带同一键，避免重复插入 */
  idempotency_key?: string | null
  created_at: string
  updated_at: string
  // 羽毛球副业
  service_type?: string | null
  location?: string | null
  service_date?: string | null
  service_start_time?: string | null
  service_end_time?: string | null
  // 关联数据
  customer?: Customer
  order_items?: OrderItem[]
  game_accounts?: OrderGameAccount[]
  third_party_rentals?: ThirdPartyRental[]
  shipping_fees?: ShippingFee[]
  badminton_order_lines?: BadmintonOrderLine[]
}

export interface OrderItem {
  id: string
  order_id: string
  item_id: string | null
  quantity: number
  daily_rate: number
  subtotal: number
  deposit: number
  notes: string | null // 订单项备注
  fee_rate: number | null // 手续费率（0.6% 或 1.6%）
  net_amount: number | null // 实际租金（扣除手续费后）
  device_id?: string | null // 绑定的设备ID（当item_id是游戏账号时使用）
  account_binding_type?: 'primary' | 'non_primary' | null // 账号绑定类型
  created_at: string
  updated_at: string
  item?: Item // 主资产（通过 item_id）
  device?: Item // 绑定的设备（通过 device_id）
}

export interface GameAccount {
  id: string
  account_name: string
  platform: string
  login_email: string | null
  login_password: string | null
  current_device_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
  current_device?: Item
}

export interface OrderGameAccount {
  id: string
  order_id: string
  game_account_id: string
  created_at: string
  game_account?: GameAccount
}

export interface ThirdPartyRental {
  id: string
  order_id: string
  game_name: string
  rental_cost: number
  deposit: number
  platform?: string | null
  provider?: string | null
  provider_order_id?: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ShippingFee {
  id: string
  order_id: string
  shipping_type: 'outbound' | 'return' | 'pickup'
  shipping_company: string | null
  tracking_number: string | null
  amount: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  order_id: string | null
  item_id: string | null
  type: 'income' | 'expense'
  amount: number
  category: string | null
  description: string | null
  transaction_date: string
  auto_created: boolean
  /** 租赁 | 羽毛球 | 自媒体 */
  business_plate: BusinessPlate
  /** 仅自媒体板块有值 */
  creator_channel: CreatorChannel | null
  created_at: string
  updated_at: string
  order?: Order
  item?: Item
}

/** 购置融资借款（MVP：1:1 绑定资产，先息后本，还款手动确认并写入 transactions） */
export interface FinancingLoan {
  id: string
  item_id: string
  title: string | null
  principal_total: number
  principal_remaining: number
  annual_rate_percent: number
  repayment_day_of_month: number
  start_date: string
  status: 'active' | 'closed'
  notes: string | null
  created_at: string
  updated_at: string
  item?: Item & { category?: Category }
}

export interface FinancingLoanPayment {
  id: string
  loan_id: string
  payment_date: string
  interest_amount: number
  principal_amount: number
  interest_transaction_id: string | null
  principal_transaction_id: string | null
  note: string | null
  created_at: string
}

// 交易变更追踪事件
export interface TransactionChangeEvent {
  id: string
  created_at: string
  action: 'insert' | 'update' | 'delete'
  transaction_id: string | null
  item_id: string | null
  order_id: string | null
  type_before: string | null
  type_after: string | null
  amount_before: number | null
  amount_after: number | null
  category: string | null
  auto_created: boolean
  delta_income: number
  delta_expense: number
  delta_net_profit: number
  reason: string | null
  description: string | null
  summary: string | null
  // 关联数据（可选，用于前端展示）
  item?: Item
  order?: Order
}

// 账号绑定记录
export interface ItemAccountBinding {
  id: string
  account_item_id: string // 游戏账号ID
  device_item_id: string | null // 设备ID（可为NULL，表示单独租赁）
  binding_type: 'primary' | 'non_primary' | null // 绑定类型（主认证/非主认证）
  bind_start_date: string // 绑定开始日期
  bind_end_date: string | null // 绑定结束日期（NULL表示当前绑定）
  order_id: string | null // 关联的订单ID
  order_item_id: string | null // 关联的订单项ID
  created_at: string
  updated_at: string
  // 关联数据
  account_item?: Item // 游戏账号资产
  device_item?: Item // 绑定的设备资产
  order?: Order // 关联的订单
}
