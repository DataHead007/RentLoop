'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, Loader2, Plus, X, Trash2, ChevronDown, ChevronUp, Copy, ImageIcon } from 'lucide-react'
import { formatDateShort, formatCurrency, formatDateToLocalString } from '@/lib/utils/format'
import { calculateRentalAmount } from '@/lib/utils/availability'
import { localCache } from '@/lib/storage/localCache'
import { getSiliconflowApiKey } from '@/lib/settings/storageKeys'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { Item, Order } from '@/lib/types/database'

/** 带占用信息的资产（API 返回） */
interface ItemWithOccupancy extends Item {
  occupancyInfo?: { available: boolean; conflictPeriods?: { startDate: string; endDate: string }[] }
}

interface OrderItemForm {
  item_id: string
  subtotal: number // 总租金（用户输入）
  fee_rate: number | null // 手续费率（null 表示使用自动判断）
  deposit: number
  quantity: number
  notes: string
  device_id?: string // 绑定的设备ID（当item_id是游戏账号时使用）
  account_binding_type?: 'primary' | 'non_primary' // 账号绑定类型
}

interface ThirdPartyRentalForm {
  game_name: string
  platform: string
  rental_start_date: Date | undefined
  rental_end_date: Date | undefined
  rental_cost: number
  deposit: number
  provider: string
  provider_order_id: string
  provider_link: string
  notes: string
}

interface ShippingFeeForm {
  shipping_type: 'outbound' | 'return' | 'pickup'
  amount: number
  shipping_company: string
  tracking_number: string
  shipping_date: Date | undefined
  notes: string
}

interface OrderFormData {
  customer_name: string
  customer_phone: string
  customer_email: string
  customer_address: string
  start_date: Date | undefined
  end_date: Date | undefined
  notes: string
  order_items: OrderItemForm[]
  third_party_rentals: ThirdPartyRentalForm[]
  shipping_fees: ShippingFeeForm[]
}

interface OrderFormProps {
  orderId?: string // 可选的订单 ID，如果提供则进入编辑模式
  onSuccess?: () => void
  /** 创建/更新成功后跳转的列表路径（未传 onSuccess 时生效），默认全部订单 */
  afterSubmitRedirect?: string
}

// 解析客户信息的工具函数（基于手机号分隔）
function parseCustomerInfo(text: string): {
  name: string
  phone: string
  email: string
  address: string
} {
  const result = {
    name: '',
    phone: '',
    email: '',
    address: '',
  }
  
  if (!text || !text.trim()) return result
  
  // 先提取邮箱（如果有）
  const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g
  const emailMatch = text.match(emailRegex)
  if (emailMatch && emailMatch[0]) {
    result.email = emailMatch[0].trim()
    text = text.replace(emailMatch[0], '') // 移除已匹配的邮箱
  }
  
  // 查找手机号（11位，1开头，可能包含空格、横线）
  const phoneRegex = /1[3-9]\d[\s-]?\d{4}[\s-]?\d{4}/
  const phoneMatch = text.match(phoneRegex)
  
  if (phoneMatch && phoneMatch[0]) {
    // 找到手机号，以其为分隔符
    const phoneIndex = phoneMatch.index!
    const phoneNumber = phoneMatch[0].replace(/[\s-]/g, '') // 清理格式
    
    result.phone = phoneNumber
    
    // 手机号前面的部分是姓名
    const namePart = text.substring(0, phoneIndex).trim()
    if (namePart) {
      // 提取姓名（通常是最开始的1-10个中文字符，移除多余空格）
      const nameMatch = namePart.match(/^[\u4e00-\u9fa5]+/)
      if (nameMatch) {
        result.name = nameMatch[0].trim()
      } else {
        // 如果没有匹配到中文，取整个前面部分
        result.name = namePart.split(/\s+/)[0].trim()
      }
    }
    
    // 手机号后面的部分是地址
    const addressPart = text.substring(phoneIndex + phoneMatch[0].length).trim()
    if (addressPart) {
      result.address = addressPart
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }
  } else {
    // 没有找到手机号，尝试其他方式
    // 尝试固定电话
    const landlineRegex = /0\d{2,3}[\s-]?\d{7,8}/
    const landlineMatch = text.match(landlineRegex)
    
    if (landlineMatch && landlineMatch[0]) {
      const phoneIndex = landlineMatch.index!
      const phoneNumber = landlineMatch[0].replace(/[\s-]/g, '')
      
      result.phone = phoneNumber
      
      // 电话前面的部分作为姓名
      const namePart = text.substring(0, phoneIndex).trim()
      if (namePart) {
        const nameMatch = namePart.match(/^[\u4e00-\u9fa5]+/)
        result.name = nameMatch ? nameMatch[0].trim() : namePart.split(/\s+/)[0].trim()
      }
      
      // 电话后面的部分作为地址
      const addressPart = text.substring(phoneIndex + landlineMatch[0].length).trim()
      if (addressPart) {
        result.address = addressPart
          .replace(/\n+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      }
    } else {
      // 完全没有电话号码，尝试按空格分隔
      const parts = text.trim().split(/\s+/)
      if (parts.length >= 2) {
        // 第一部分可能是姓名
        const nameMatch = parts[0].match(/^[\u4e00-\u9fa5]+/)
        if (nameMatch) {
          result.name = nameMatch[0]
          // 剩余部分作为地址
          result.address = parts.slice(1).join(' ')
        } else {
          // 如果没有中文姓名，整个作为姓名
          result.name = parts[0]
          if (parts.length > 1) {
            result.address = parts.slice(1).join(' ')
          }
        }
      } else {
        // 只有一个部分，作为姓名
        result.name = text.trim()
      }
    }
  }
  
  return result
}

export function OrderFormV2({ orderId, onSuccess, afterSubmitRedirect = '/orders' }: OrderFormProps) {
  const router = useRouter()
  const [items, setItems] = useState<ItemWithOccupancy[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(!!orderId) // 编辑模式需要加载数据
  const [openThirdParty, setOpenThirdParty] = useState(false)
  const [openShipping, setOpenShipping] = useState(false)
  const [openNotes, setOpenNotes] = useState(false)
  const [openQuickInput, setOpenQuickInput] = useState(true)
  const [quickInputTab, setQuickInputTab] = useState<'text' | 'image'>('image')
  const [quickInputText, setQuickInputText] = useState('')
  const [quickInputImage, setQuickInputImage] = useState<string | null>(null)
  const [quickInputMimeType, setQuickInputMimeType] = useState<string>('image/png')
  const [isParsingOrder, setIsParsingOrder] = useState(false)
  const [aiToastMessage, setAiToastMessage] = useState<string | null>(null)
  const [monthlyOrderCount, setMonthlyOrderCount] = useState<number | null>(null) // 当月订单数量
  const [existingOrderStatus, setExistingOrderStatus] = useState<Order['status'] | null>(null) // 编辑时保留原订单状态
  const [formData, setFormData] = useState<OrderFormData>({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    customer_address: '',
    start_date: undefined,
    end_date: undefined,
    notes: '',
    order_items: [],
    third_party_rentals: [],
    shipping_fees: [],
  })

  /** 新建订单时同一次「提交意图」复用同一幂等键，避免网络失败后重试产生重复订单 */
  const createIdempotencyKeyRef = useRef<string | null>(null)

  useEffect(() => {
    loadMonthlyOrderCount()
    if (orderId) {
      loadOrder()
    } else {
      loadItems(undefined, formData.start_date, formData.end_date, undefined)
    }
  }, [orderId])

  useEffect(() => {
    if (formData.start_date && formData.end_date) {
      const includeIds = orderId ? formData.order_items?.map((i) => i.item_id).filter(Boolean) : undefined
      loadItems(includeIds, formData.start_date, formData.end_date, orderId || undefined)
    }
  }, [formData.start_date?.getTime(), formData.end_date?.getTime()])

  // 加载当月订单数量（用于自动判断费率）
  async function loadMonthlyOrderCount() {
    try {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
      
      const response = await fetch(
        `/api/orders?startDate=${startOfMonth.toISOString().split('T')[0]}&endDate=${endOfMonth.toISOString().split('T')[0]}`
      )
      if (response.ok) {
        const orders = await response.json()
        setMonthlyOrderCount(orders.length)
      }
    } catch (error) {
      console.error('Failed to load monthly order count:', error)
    }
  }

  // 获取推荐费率（根据当月订单数量）
  function getRecommendedFeeRate(): number {
    if (monthlyOrderCount === null) return 0.006 // 默认 0.6%
    return monthlyOrderCount > 10 ? 0.016 : 0.006 // 超过10单用1.6%，否则0.6%
  }

  // 计算实际租金
  function calculateNetAmount(subtotal: number, feeRate: number | null): number {
    if (feeRate === null || feeRate === undefined) {
      feeRate = getRecommendedFeeRate()
    }
    return Math.round(subtotal * (1 - feeRate) * 100) / 100
  }

  async function loadOrder() {
    if (!orderId) return
    try {
      setInitialLoading(true)
      const response = await fetch(`/api/orders/${orderId}`)
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        const detail = (err as { errorDetail?: { message?: string } }).errorDetail?.message
        const message =
          detail ||
          (err as { message?: string; error?: string }).message ||
          (err as { error?: string }).error ||
          '加载订单失败'
        throw new Error(message)
      }
      const order = await response.json()
      setExistingOrderStatus(order.status ?? null)

      // 转换订单数据为表单数据
      const startDate = order.start_date ? new Date(order.start_date) : undefined
      const endDate = order.end_date ? new Date(order.end_date) : undefined
      
      setFormData({
        customer_name: order.customer_name || '',
        customer_phone: order.customer_phone || '',
        customer_email: order.customer_email || '',
        customer_address: order.customer_address || '',
        start_date: startDate,
        end_date: endDate,
        notes: order.notes || '',
        order_items: order.order_items?.map((item: any) => ({
          item_id: item.item_id || '',
          subtotal: item.subtotal || 0,
          fee_rate: item.fee_rate || null,
          deposit: item.deposit || 0,
          quantity: item.quantity || 1,
          notes: item.notes || '',
          device_id: item.device_id || undefined,
          account_binding_type: item.account_binding_type || undefined,
        })) || [],
        third_party_rentals: order.third_party_rentals?.map((rental: any) => ({
          game_name: rental.game_name || '',
          platform: rental.platform || '',
          rental_start_date: rental.rental_start_date ? new Date(rental.rental_start_date) : undefined,
          rental_end_date: rental.rental_end_date ? new Date(rental.rental_end_date) : undefined,
          rental_cost: rental.rental_cost || 0,
          deposit: rental.deposit || 0,
          provider: rental.provider || '',
          provider_order_id: rental.provider_order_id || '',
          provider_link: rental.provider_link || '',
          notes: rental.notes || '',
        })) || [],
        shipping_fees: order.shipping_fees?.map((fee: any) => ({
          shipping_type: fee.shipping_type || 'outbound',
          amount: fee.amount || 0,
          shipping_company: fee.shipping_company || '',
          tracking_number: fee.tracking_number || '',
          shipping_date: fee.shipping_date ? new Date(fee.shipping_date) : undefined,
          notes: fee.notes || '',
        })) || [],
      })
      
      const orderItemIds = order.order_items
        ?.map((item: any) => item.item_id)
        .filter((id: string) => id && id.trim() !== '') || []

      await loadItems(orderItemIds, order.start_date, order.end_date, orderId)
    } catch (error) {
      console.error('Failed to load order:', error)
      alert('加载订单失败，请重试')
    } finally {
      setInitialLoading(false)
    }
  }

  async function loadItems(
    includeItemIds?: string[],
    startDate?: Date | string,
    endDate?: Date | string,
    excludeOrderId?: string
  ) {
    try {
      const startStr = startDate instanceof Date ? formatDateToLocalString(startDate) : startDate
      const endStr = endDate instanceof Date ? formatDateToLocalString(endDate) : endDate

      let url = '/api/items'
      if (startStr && endStr) {
        const params = new URLSearchParams({ startDate: startStr, endDate: endStr, includeOccupied: 'true' })
        if (excludeOrderId) params.set('excludeOrderId', excludeOrderId)
        url = `/api/items?${params.toString()}`
      }

      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch items')
      const data = await response.json()

      const validItems = (Array.isArray(data) ? data : []).filter((item: Item) =>
        item?.id && typeof item.id === 'string' && item.id.trim() !== ''
      )

      // 有日期且 includeOccupied 时返回含 occupancyInfo 的数据，不按 status 过滤（需展示使用中资产）
      let filteredItems =
        startStr && endStr && validItems.some((i: Item & { occupancyInfo?: unknown }) => (i as any).occupancyInfo)
          ? validItems
          : validItems.filter((item: Item) =>
              item.status === 'available' || item.status === 'retired'
            )

      if (includeItemIds && includeItemIds.length > 0) {
        const validIncludeIds = includeItemIds.filter((id): id is string =>
          !!id && typeof id === 'string' && id.trim() !== ''
        )
        const includedItems = validItems.filter((item: Item) =>
          validIncludeIds.includes(item.id)
        )
        const existingIds = new Set(filteredItems.map((i: Item) => i.id))
        const additionalItems = includedItems.filter((item: Item) =>
          !existingIds.has(item.id)
        )
        filteredItems = [...filteredItems, ...additionalItems]
      }

      setItems(filteredItems)
    } catch (error) {
      console.error('Failed to load items:', error)
    }
  }

  async function addOrderItem() {
    const includeIds = formData.order_items?.map((i) => i.item_id).filter(Boolean)
    await loadItems(includeIds, formData.start_date, formData.end_date, orderId || undefined)
    const prev = formData.order_items[formData.order_items.length - 1]
    const newItem: OrderItemForm = {
      item_id: '',
      subtotal: 0,
      fee_rate: prev?.fee_rate ?? 0.006,
      deposit: prev?.deposit ?? 0,
      quantity: prev?.quantity ?? 1,
      notes: '',
      device_id: undefined,
      account_binding_type: undefined,
    }
    setFormData({
      ...formData,
      order_items: [...formData.order_items, newItem],
    })
  }

  function removeOrderItem(index: number) {
    const removedItem = formData.order_items[index]
    if (!removedItem) return
    const nextItems = formData.order_items.filter((_, i) => i !== index)
    setFormData({
      ...formData,
      order_items: nextItems,
    })
    toast('订单项已删除', {
      action: {
        label: '撤销',
        onClick: () => {
          setFormData((prev) => {
            const restored = [...prev.order_items]
            restored.splice(index, 0, removedItem)
            return { ...prev, order_items: restored }
          })
        },
      },
    })
  }

  function updateOrderItem(index: number, updates: Partial<OrderItemForm>) {
    const newItems = [...formData.order_items]
    newItems[index] = { ...newItems[index], ...updates }
    
    // 如果更改了 item_id，且新选择的不是游戏账号，清除 device_id 和 account_binding_type
    if (updates.item_id !== undefined) {
      const selectedItem = items.find(i => i.id === updates.item_id)
      if (!selectedItem || !isGameAccount(selectedItem)) {
        newItems[index].device_id = undefined
        newItems[index].account_binding_type = undefined
      }
    }
    
    setFormData({ ...formData, order_items: newItems })
  }

  // 在指定索引之后插入新的订单项（继承上一项的 fee_rate、deposit、quantity）
  async function insertOrderItemAfter(index: number) {
    const includeIds = formData.order_items?.map((i) => i.item_id).filter(Boolean)
    await loadItems(includeIds, formData.start_date, formData.end_date, orderId || undefined)
    const prev = formData.order_items[index]
    const newItems = [...formData.order_items]
    newItems.splice(index + 1, 0, {
      item_id: '',
      subtotal: 0,
      fee_rate: prev?.fee_rate ?? 0.006,
      deposit: prev?.deposit ?? 0,
      quantity: prev?.quantity ?? 1,
      notes: '',
      device_id: undefined,
      account_binding_type: undefined,
    })
    setFormData({
      ...formData,
      order_items: newItems,
    })
    
    // 滚动到新添加的订单项（可选，提升用户体验）
    setTimeout(() => {
      const element = document.querySelector(`[data-order-item-index="${index + 1}"]`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)
  }

  // 复制上一项：在当前项之后插入新项，继承上一项的 fee_rate、deposit、quantity，item_id 置空
  async function copyFromPrevious(index: number) {
    if (index <= 0) return
    const prev = formData.order_items[index - 1]
    const includeIds = formData.order_items?.map((i) => i.item_id).filter(Boolean)
    await loadItems(includeIds, formData.start_date, formData.end_date, orderId || undefined)
    const newItems = [...formData.order_items]
    newItems.splice(index + 1, 0, {
      item_id: '',
      subtotal: 0,
      fee_rate: prev?.fee_rate ?? 0.006,
      deposit: prev?.deposit ?? 0,
      quantity: prev?.quantity ?? 1,
      notes: '',
      device_id: undefined,
      account_binding_type: undefined,
    })
    setFormData({ ...formData, order_items: newItems })
    setTimeout(() => {
      const el = document.querySelector(`[data-order-item-index="${index + 1}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  // 批量应用费率到所有订单项
  function applyBatchFeeRate(rate: number | null) {
    setFormData({
      ...formData,
      order_items: formData.order_items.map((item) => ({ ...item, fee_rate: rate })),
    })
  }

  function addThirdPartyRental() {
    setFormData({
      ...formData,
      third_party_rentals: [
        ...formData.third_party_rentals,
        {
          game_name: '',
          platform: '',
          rental_start_date: formData.start_date,
          rental_end_date: formData.end_date,
          rental_cost: 0,
          deposit: 0,
          provider: 'taobao',
          provider_order_id: '',
          provider_link: '',
          notes: '',
        },
      ],
    })
  }

  function removeThirdPartyRental(index: number) {
    const removedRental = formData.third_party_rentals[index]
    if (!removedRental) return
    const nextRentals = formData.third_party_rentals.filter((_, i) => i !== index)
    setFormData({
      ...formData,
      third_party_rentals: nextRentals,
    })
    toast('第三方租赁明细已删除', {
      action: {
        label: '撤销',
        onClick: () => {
          setFormData((prev) => {
            const restored = [...prev.third_party_rentals]
            restored.splice(index, 0, removedRental)
            return { ...prev, third_party_rentals: restored }
          })
        },
      },
    })
  }

  function updateThirdPartyRental(index: number, updates: Partial<ThirdPartyRentalForm>) {
    const newRentals = [...formData.third_party_rentals]
    newRentals[index] = { ...newRentals[index], ...updates }
    setFormData({ ...formData, third_party_rentals: newRentals })
  }

  function addShippingFee() {
    setFormData({
      ...formData,
      shipping_fees: [
        ...formData.shipping_fees,
        {
          shipping_type: 'outbound',
          amount: 0,
          shipping_company: '',
          tracking_number: '',
          shipping_date: formData.start_date,
          notes: '',
        },
      ],
    })
  }

  function removeShippingFee(index: number) {
    const removedFee = formData.shipping_fees[index]
    if (!removedFee) return
    const nextFees = formData.shipping_fees.filter((_, i) => i !== index)
    setFormData({
      ...formData,
      shipping_fees: nextFees,
    })
    toast('物流费用明细已删除', {
      action: {
        label: '撤销',
        onClick: () => {
          setFormData((prev) => {
            const restored = [...prev.shipping_fees]
            restored.splice(index, 0, removedFee)
            return { ...prev, shipping_fees: restored }
          })
        },
      },
    })
  }

  function updateShippingFee(index: number, updates: Partial<ShippingFeeForm>) {
    const newFees = [...formData.shipping_fees]
    newFees[index] = { ...newFees[index], ...updates }
    setFormData({ ...formData, shipping_fees: newFees })
  }

  // 计算总金额和押金
  // 注意：item.subtotal 是单个物品的总租金（日租金 × 天数），需要乘以 quantity 才是该订单项的总金额
  function calculateTotals() {
    let totalAmount = 0 // 总租金（仅订单项收入，不包含第三方租赁成本和物流费用）
    let totalDeposit = 0
    let totalShippingCost = 0 // 物流费用（单独计算）
    let totalThirdPartyCost = 0 // 第三方转租实际成本（与交易「转租支出」一致，计入利润）
    let totalThirdPartySupplierDeposit = 0 // 付供应商押金（可退，不计入客户总押金，也不计入订单页利润）

    formData.order_items.forEach((item) => {
      if (item.item_id && item.subtotal > 0) {
        totalAmount += item.subtotal * item.quantity
        totalDeposit += item.deposit * item.quantity
      }
    })

    formData.third_party_rentals.forEach((rental) => {
      totalThirdPartyCost += rental.rental_cost || 0
      totalThirdPartySupplierDeposit += rental.deposit || 0
    })

    formData.shipping_fees.forEach((fee) => {
      totalShippingCost += fee.amount || 0
    })

    return { totalAmount, totalDeposit, totalShippingCost, totalThirdPartyCost, totalThirdPartySupplierDeposit }
  }

  // 计算日租金（作为参考指标）
  function calculateDailyRate(subtotal: number, days: number): number {
    if (days > 0 && subtotal > 0) {
      return Math.round((subtotal / days) * 100) / 100 // 保留两位小数
    }
    return 0
  }

  // 判断资产是否是游戏账号
  const isGameAccount = (item: Item): boolean => {
    if (!item.category?.name) return false
    const categoryName = item.category.name.trim()
    // 检查品类名称中是否包含"数字版游戏"或"游戏账号"
    return categoryName.includes('数字版游戏') || 
           categoryName.includes('游戏账号') ||
           false
  }

  // 获取设备类型的资产（用于绑定到游戏账号）
  const getDeviceItems = (currentOrderItem?: OrderItemForm): Item[] => {
    const baseItems = items.filter(item => 
      item?.id && 
      typeof item.id === 'string' && 
      item.id.trim() !== '' &&
      !isGameAccount(item) && // 排除游戏账号本身
      (item.status === 'available' || item.status === 'retired')
    )
    
    // 如果当前订单项已绑定了设备，也要包含该设备（即使它是 rented 状态）
    // 这样在编辑订单时，已绑定的设备仍然会显示在下拉列表中
    if (currentOrderItem?.device_id) {
      const boundDevice = items.find(item => item.id === currentOrderItem.device_id)
      if (boundDevice && !baseItems.find(item => item.id === boundDevice.id)) {
        return [...baseItems, boundDevice]
      }
    }
    
    return baseItems
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.customer_name || !formData.start_date || !formData.end_date) {
      alert('请填写客户姓名和租赁日期')
      return
    }

    if (formData.order_items.length === 0) {
      alert('请至少添加一个订单项')
      return
    }

    if (formData.end_date < formData.start_date!) {
      alert('结束日期不能早于开始日期')
      return
    }

    setLoading(true)
    try {
      const { totalAmount, totalDeposit, totalShippingCost, totalThirdPartyCost, totalThirdPartySupplierDeposit } = calculateTotals()

      // 计算租赁天数
      const { days } = calculateRentalAmount(
        formData.start_date!,
        formData.end_date!,
        1
      )

      // 准备订单项数据
      // 过滤掉没有选择设备的订单项，并将空字符串转换为 null
      const orderItems = formData.order_items
        .filter((item) => item.item_id && item.item_id.trim() !== '') // 过滤掉空 item_id
        .map((item) => {
          // 从总租金计算日租金（作为参考指标）
          const daily_rate = calculateDailyRate(item.subtotal, days)
          
          // 确定手续费率（如果为 null，使用自动判断的费率）
          const feeRate = item.fee_rate !== null ? item.fee_rate : getRecommendedFeeRate()
          
          // 计算实际租金（扣除手续费后）
          const netAmount = calculateNetAmount(item.subtotal, feeRate)
          
          return {
            item_id: item.item_id || null, // 确保空字符串转换为 null
            daily_rate: daily_rate, // 计算出的日租金（参考值）
            subtotal: item.subtotal, // 用户输入的总租金
            fee_rate: feeRate, // 手续费率
            net_amount: netAmount, // 实际租金（扣除手续费后）
            deposit: item.deposit,
            quantity: item.quantity,
            notes: item.notes || null,
            device_id: item.device_id || null,
            account_binding_type: item.account_binding_type || null,
          }
        })
      
      // 如果过滤后没有有效的订单项，提示用户
      if (orderItems.length === 0) {
        alert('请至少添加一个有效的订单项（已选择设备）')
        setLoading(false)
        return
      }

      // 检查是否有档期冲突的资产，若有则需用户确认
      let allowOverlap = false
      if (!orderId) {
        const conflictNames: string[] = []
        for (const oi of orderItems) {
          if (!oi.item_id) continue
          const it = items.find((i) => i.id === oi.item_id) as ItemWithOccupancy | undefined
          if (it?.occupancyInfo && !it.occupancyInfo.available) {
            conflictNames.push(it.name)
          }
        }
        if (conflictNames.length > 0) {
          const confirmed = window.confirm(
            `以下资产档期冲突：${conflictNames.join('、')}。确定仍要创建订单？`
          )
          if (!confirmed) {
            setLoading(false)
            return
          }
          allowOverlap = true
        }
      }

      // 准备第三方租赁数据（使用本地日期序列化，避免 UTC 错日）
      const thirdPartyRentals = formData.third_party_rentals.map((rental) => ({
        game_name: rental.game_name,
        platform: rental.platform || null,
        rental_start_date: rental.rental_start_date ? formatDateToLocalString(rental.rental_start_date) : '',
        rental_end_date: rental.rental_end_date ? formatDateToLocalString(rental.rental_end_date) : '',
        extended_end_date: null,
        rental_cost: rental.rental_cost,
        deposit: rental.deposit,
        extension_cost: 0,
        deposit_returned: false,
        provider: rental.provider || null,
        provider_order_id: rental.provider_order_id || null,
        provider_link: rental.provider_link || null,
        notes: rental.notes || null,
      }))

      // 准备物流费用数据（使用本地日期序列化）
      const shippingFees = formData.shipping_fees.map((fee) => ({
        shipping_type: fee.shipping_type,
        amount: fee.amount,
        shipping_company: fee.shipping_company || null,
        tracking_number: fee.tracking_number || null,
        shipping_date: fee.shipping_date ? formatDateToLocalString(fee.shipping_date) : null,
        notes: fee.notes || null,
      }))

      if (!orderId) {
        if (!createIdempotencyKeyRef.current) {
          createIdempotencyKeyRef.current =
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`
        }
      }

      const orderData = {
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone || null,
        customer_email: formData.customer_email || null,
        customer_address: formData.customer_address || null,
        start_date: formatDateToLocalString(formData.start_date!),
        end_date: formatDateToLocalString(formData.end_date!),
        total_amount: totalAmount, // 总租金（不包含物流费用）
        total_deposit: totalDeposit,
        total_shipping_cost: totalShippingCost, // 物流费用（单独记录）
        status: (orderId ? (existingOrderStatus ?? 'pending') : 'pending') as Order['status'],
        notes: formData.notes || null,
        order_items: orderItems,
        third_party_rentals: thirdPartyRentals,
        shipping_fees: shippingFees,
        ...(allowOverlap && { allowOverlap: true }),
        ...(!orderId && createIdempotencyKeyRef.current
          ? { idempotency_key: createIdempotencyKeyRef.current }
          : {}),
      }

      const url = orderId ? `/api/orders/${orderId}` : '/api/orders'
      const method = orderId ? 'PATCH' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to ${orderId ? 'update' : 'create'} order`)
      }

      if (!orderId) {
        createIdempotencyKeyRef.current = null
      }

      // 清除订单缓存，确保跳转后列表获取最新数据
      await localCache.clear('orders').catch(console.error)
      // 触发自定义事件，通知其他页面刷新统计数据
      window.dispatchEvent(new CustomEvent('orderUpdated'))
      // 同时使用 localStorage 通知其他标签页
      localStorage.setItem('orderUpdated', Date.now().toString())
      
      if (onSuccess) {
        onSuccess()
      } else {
        router.push(afterSubmitRedirect)
      }
    } catch (error) {
      console.error(`Failed to ${orderId ? 'update' : 'create'} order:`, error)
      alert(error instanceof Error ? error.message : `${orderId ? '更新' : '创建'}订单失败，请重试`)
    } finally {
      setLoading(false)
    }
  }

  /** 根据名称匹配资产：精确匹配 -> 包含 -> 模糊 */
  function matchItemByName(itemName: string): ItemWithOccupancy | null {
    if (!itemName?.trim()) return null
    const q = itemName.trim().toLowerCase()
    // 1. 精确匹配（不区分大小写）
    const exact = items.find((i) => i.name.toLowerCase() === q)
    if (exact) return exact
    // 2. 包含匹配
    const contains = items.find(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.brand && i.brand.toLowerCase().includes(q)) ||
        (i.model && i.model.toLowerCase().includes(q))
    )
    if (contains) return contains
    // 3. 模糊：名称包含关键词
    const keywords = q.split(/\s+/).filter(Boolean)
    const fuzzy = items.find((i) => {
      const combined = [i.name, i.brand, i.model].filter(Boolean).join(' ').toLowerCase()
      return keywords.some((k) => combined.includes(k))
    })
    return fuzzy ?? null
  }

  async function handleParseOrder() {
    const hasText = !!quickInputText?.trim()
    const hasImage = !!quickInputImage
    if (!hasText && !hasImage) {
      setAiToastMessage('请输入文字或上传图片')
      setTimeout(() => setAiToastMessage(null), 3000)
      return
    }
    setIsParsingOrder(true)
    setAiToastMessage(null)
    try {
      const itemNames = items.map((i) => i.name)
      const apiKey = getSiliconflowApiKey()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (apiKey) headers['X-SiliconFlow-Api-Key'] = apiKey
      const res = await fetch('/api/ai/parse-order', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: hasText ? quickInputText.trim() : undefined,
          imageBase64: hasImage ? quickInputImage : undefined,
          imageMimeType: hasImage ? quickInputMimeType : undefined,
          itemNames,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const err = data?.error || '解析失败'
        setAiToastMessage(err)
        setTimeout(() => setAiToastMessage(null), 4000)
        return
      }
      const unmapped: string[] = []
      const newOrderItems: OrderItemForm[] = []
      const parsedItems = Array.isArray(data.items) ? data.items : []
      for (const p of parsedItems) {
        const name = (p?.item_name ?? p?.name ?? '').toString().trim()
        const days = typeof p.days === 'number' ? p.days : 1
        const dailyRate = typeof p.daily_rate === 'number' ? p.daily_rate : 0
        const subtotal = typeof p.subtotal === 'number' ? p.subtotal : dailyRate * days
        const deposit = typeof p.deposit === 'number' ? p.deposit : 0
        const matched = matchItemByName(name)
        if (!matched) {
          unmapped.push(name)
          continue
        }
        newOrderItems.push({
          item_id: matched.id,
          subtotal: Math.max(0, subtotal),
          fee_rate: null,
          deposit: Math.max(0, deposit),
          quantity: 1,
          notes: '',
        })
      }
      const rate = getRecommendedFeeRate()
      const orderItemsWithRate = newOrderItems.map((o) => ({ ...o, fee_rate: rate }))
      const startDate = data.start_date
        ? new Date(data.start_date)
        : formData.start_date ?? new Date()
      const endDate = data.end_date
        ? new Date(data.end_date)
        : formData.end_date ?? new Date()
      setFormData((prev) => ({
        ...prev,
        customer_name: data.customer_name ?? prev.customer_name,
        customer_phone: data.customer_phone ?? prev.customer_phone,
        customer_email: data.customer_email ?? prev.customer_email,
        customer_address: data.customer_address ?? prev.customer_address,
        start_date: startDate,
        end_date: endDate,
        notes: data.notes ?? prev.notes,
        order_items: orderItemsWithRate,
      }))
      if (unmapped.length > 0) {
        setAiToastMessage(`未找到：${unmapped.join('、')}`)
        setTimeout(() => setAiToastMessage(null), 4000)
      } else {
        setAiToastMessage('解析并填充成功')
        setTimeout(() => setAiToastMessage(null), 2000)
      }
      setQuickInputText('')
      setQuickInputImage(null)
    } catch (err) {
      setAiToastMessage(err instanceof Error ? err.message : '解析失败，请重试')
      setTimeout(() => setAiToastMessage(null), 4000)
    } finally {
      setIsParsingOrder(false)
    }
  }

  // 处理客户姓名输入框的粘贴事件
  const handleCustomerNamePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const files = e.clipboardData.files
    const pastedText = e.clipboardData.getData('text')

    // 粘贴的是图片：用 AI 解析客户信息
    if (files?.length > 0) {
      const file = Array.from(files).find((f) => f.type.startsWith('image/'))
      if (file) {
        e.preventDefault()
        const reader = new FileReader()
        reader.onload = async () => {
          const base64 = (reader.result as string)?.replace(/^data:image\/\w+;base64,/, '') || ''
          const mimeType = file.type || 'image/png'
          try {
            const apiKey = getSiliconflowApiKey()
            const headers: Record<string, string> = { 'Content-Type': 'application/json' }
            if (apiKey) headers['X-SiliconFlow-Api-Key'] = apiKey
            const res = await fetch('/api/ai/parse-customer', {
              method: 'POST',
              headers,
              body: JSON.stringify({ imageBase64: base64, imageMimeType: mimeType }),
            })
            const data = await res.json()
            if (res.ok && data) {
              setFormData((prev) => ({
                ...prev,
                customer_name: data.name ?? prev.customer_name,
                customer_phone: data.phone ?? prev.customer_phone,
                customer_email: data.email ?? prev.customer_email,
                customer_address: data.address ?? prev.customer_address,
              }))
              setAiToastMessage('已从图片解析客户信息')
              setTimeout(() => setAiToastMessage(null), 2000)
            } else {
              setAiToastMessage(data?.error || '解析失败')
              setTimeout(() => setAiToastMessage(null), 3000)
            }
          } catch {
            setAiToastMessage('解析失败，请重试')
            setTimeout(() => setAiToastMessage(null), 3000)
          }
        }
        reader.readAsDataURL(file)
        return
      }
    }

    // 文本：先用正则解析
    if (pastedText.length > 20 || pastedText.includes('\n') || /\d{11}/.test(pastedText)) {
      e.preventDefault()
      let parsed = parseCustomerInfo(pastedText)
      // 正则未解析出姓名或电话时，尝试 LLM
      if ((!parsed.name || !parsed.phone) && pastedText.trim()) {
        try {
          const apiKey = getSiliconflowApiKey()
          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
          if (apiKey) headers['X-SiliconFlow-Api-Key'] = apiKey
          const res = await fetch('/api/ai/parse-customer', {
            method: 'POST',
            headers,
            body: JSON.stringify({ text: pastedText.trim() }),
          })
          const data = await res.json()
          if (res.ok && data) {
            parsed = {
              name: data.name ?? parsed.name,
              phone: data.phone ?? parsed.phone,
              email: data.email ?? parsed.email,
              address: data.address ?? parsed.address,
            }
          }
        } catch {
          // 保留正则结果
        }
      }
      setFormData((prev) => {
        const updated = { ...prev }
        if (parsed.name && !prev.customer_name) updated.customer_name = parsed.name
        if (parsed.phone && !prev.customer_phone) updated.customer_phone = parsed.phone
        if (parsed.email && !prev.customer_email) updated.customer_email = parsed.email
        if (parsed.address && !prev.customer_address) updated.customer_address = parsed.address
        return updated
      })
    }
  }

  const { totalAmount, totalDeposit, totalShippingCost, totalThirdPartyCost, totalThirdPartySupplierDeposit } = calculateTotals()
  const { days } = formData.start_date && formData.end_date
    ? calculateRentalAmount(formData.start_date, formData.end_date, 1)
    : { days: 0 }

  if (initialLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">加载订单数据中...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-0 space-y-5 sm:space-y-6">
      {/* 客户信息和租赁日期 */}
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
          <CardDescription>
            提示：可在"客户姓名"字段粘贴包含姓名、电话、地址的完整信息，系统会自动解析并填充到相应字段
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          {aiToastMessage && (
            <Alert variant={aiToastMessage.includes('未找到') ? 'destructive' : 'default'} className="py-2">
              <AlertDescription>{aiToastMessage}</AlertDescription>
            </Alert>
          )}
          <Collapsible open={openQuickInput} onOpenChange={setOpenQuickInput}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
                <span>快捷录入（支持文字或图片）</span>
                {openQuickInput ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-3">
              <div className="flex gap-2 border-b pb-2">
                <Button
                  type="button"
                  variant={quickInputTab === 'text' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setQuickInputTab('text')}
                >
                  文字
                </Button>
                <Button
                  type="button"
                  variant={quickInputTab === 'image' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setQuickInputTab('image')}
                >
                  图片
                </Button>
              </div>
              {quickInputTab === 'text' ? (
                <Textarea
                  placeholder="粘贴或输入订单文字，如：张三 13812345678 租 A7M4 3天 日租200"
                  value={quickInputText}
                  onChange={(e) => setQuickInputText(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              ) : (
                <div className="space-y-2">
                  <div
                    className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground text-sm"
                    onPaste={(ev) => {
                      const files = ev.clipboardData.files
                      const file = Array.from(files).find((f) => f.type.startsWith('image/'))
                      if (file) {
                        ev.preventDefault()
                        const reader = new FileReader()
                        reader.onload = () => {
                          const dataUrl = reader.result as string
                          setQuickInputImage(dataUrl.replace(/^data:image\/\w+;base64,/, ''))
                          setQuickInputMimeType(file.type || 'image/png')
                        }
                        reader.readAsDataURL(file)
                      }
                    }}
                    onDragOver={(ev) => ev.preventDefault()}
                    onDrop={(ev) => {
                      ev.preventDefault()
                      const file = ev.dataTransfer.files?.[0]
                      if (file?.type.startsWith('image/')) {
                        const reader = new FileReader()
                        reader.onload = () => {
                          const dataUrl = reader.result as string
                          setQuickInputImage(dataUrl.replace(/^data:image\/\w+;base64,/, ''))
                          setQuickInputMimeType(file.type || 'image/png')
                        }
                        reader.readAsDataURL(file)
                      }
                    }}
                  >
                    {quickInputImage ? (
                      <div className="flex flex-col items-center gap-2">
                        <img
                          src={`data:${quickInputMimeType};base64,${quickInputImage}`}
                          alt="订单截图"
                          className="max-h-32 object-contain"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setQuickInputImage(null)
                          }}
                        >
                          清除图片
                        </Button>
                      </div>
                    ) : (
                      <>
                        <ImageIcon className="mx-auto h-8 w-8 mb-2" />
                        <p>粘贴或拖拽图片到这里</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="quick-input-file"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = () => {
                          const dataUrl = reader.result as string
                          setQuickInputImage(dataUrl.replace(/^data:image\/\w+;base64,/, ''))
                          setQuickInputMimeType(file.type || 'image/png')
                        }
                        reader.readAsDataURL(file)
                      }
                      e.target.value = ''
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => document.getElementById('quick-input-file')?.click()}
                  >
                    选择图片
                  </Button>
                </div>
              )}
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={handleParseOrder}
                disabled={isParsingOrder || (!quickInputText?.trim() && !quickInputImage)}
              >
                {isParsingOrder ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                解析并填充
              </Button>
            </CollapsibleContent>
          </Collapsible>

          <div className="space-y-2">
            <Label htmlFor="customer_name">客户姓名 *</Label>
            <Input
              id="customer_name"
              value={formData.customer_name}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              onPaste={handleCustomerNamePaste}
              placeholder="请输入客户姓名（或粘贴包含姓名、电话、地址的完整信息）"
              required
            />
            <p className="text-xs text-muted-foreground">
              支持粘贴完整信息，系统会自动识别并填充到对应字段（格式：姓名 手机号 地址）
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customer_phone">联系电话</Label>
              <Input
                id="customer_phone"
                type="tel"
                value={formData.customer_phone}
                onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                placeholder="请输入联系电话"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_email">电子邮箱</Label>
              <Input
                id="customer_email"
                type="email"
                value={formData.customer_email}
                onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                placeholder="请输入电子邮箱"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_address">客户地址</Label>
            <Textarea
              id="customer_address"
              value={formData.customer_address}
              onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
              placeholder="请输入客户地址"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_date">开始日期 *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.start_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.start_date ? (
                      formatDateShort(formData.start_date)
                    ) : (
                      <span>选择开始日期</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.start_date}
                    onSelect={(date) => {
                      if (!date) return
                      setFormData((prev) => ({ ...prev, start_date: date }))
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">结束日期 *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.end_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.end_date ? (
                      formatDateShort(formData.end_date)
                    ) : (
                      <span>选择结束日期</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.end_date}
                    onSelect={(date) => {
                      if (!date) return
                      setFormData((prev) => ({ ...prev, end_date: date }))
                    }}
                    disabled={(date) =>
                      formData.start_date ? date < formData.start_date : false
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {days > 0 && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              租赁天数：<span className="font-medium">{days} 天</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 订单项（设备/配件） */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <CardTitle>订单项（设备/配件/游戏账号）*</CardTitle>
                <CardDescription>添加要出租的设备、配件或游戏账号</CardDescription>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                {formData.order_items.length > 0 && (
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <span className="shrink-0 text-sm text-muted-foreground">批量费率：</span>
                    <Select
                      onValueChange={(v) => {
                        const rate = v === 'auto' ? null : v === '0' ? 0 : v === '0.6' ? 0.006 : v === '1.6' ? 0.016 : 0.01
                        applyBatchFeeRate(rate)
                      }}
                    >
                      <SelectTrigger className="min-w-0 w-full sm:w-36">
                        <SelectValue placeholder="选择费率" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">自动</SelectItem>
                        <SelectItem value="0">0%</SelectItem>
                        <SelectItem value="0.6">0.6%</SelectItem>
                        <SelectItem value="1.6">1.6%</SelectItem>
                        <SelectItem value="custom">自定义 1%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button type="button" variant="outline" size="sm" className="w-full shrink-0 sm:w-auto" onClick={addOrderItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  添加
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          {formData.order_items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              还没有添加订单项，请点击上方"添加"按钮
            </div>
          ) : (
            formData.order_items.map((item, index) => {
              const selectedItem = items.find((i) => i.id === item.item_id)
              const isSelectedGameAccount = selectedItem ? isGameAccount(selectedItem) : false
              const deviceItems = getDeviceItems(item) // 传入当前订单项，以便包含已绑定的设备
              const { days } = formData.start_date && formData.end_date
                ? calculateRentalAmount(formData.start_date, formData.end_date, 1)
                : { days: 0 }
              const calculatedDailyRate = calculateDailyRate(item.subtotal, days)

              return (
                <div key={index} data-order-item-index={index} className="space-y-3 sm:space-y-4 rounded-lg border p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">订单项 #{index + 1}</h4>
                    <div className="flex items-center gap-1">
                      {index > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => copyFromPrevious(index)}
                          title="复制上一项的费率、押金、数量"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOrderItem(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>选择资产 *</Label>
                    <Select
                      value={item.item_id && item.item_id.trim() !== '' ? item.item_id : undefined}
                      onValueChange={(value) => {
                        updateOrderItem(index, {
                          item_id: value,
                        })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择资产（设备、配件或游戏账号）" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const validItems = items.filter(
                            (i) => i?.id && typeof i.id === 'string' && i.id.trim() !== ''
                          )
                          const hasOccupancyInfo = validItems.some((i) => (i as ItemWithOccupancy).occupancyInfo)
                          if (hasOccupancyInfo) {
                            const available = validItems.filter(
                              (i) => !(i as ItemWithOccupancy).occupancyInfo || (i as ItemWithOccupancy).occupancyInfo?.available
                            )
                            const occupied = validItems.filter(
                              (i) => (i as ItemWithOccupancy).occupancyInfo && !(i as ItemWithOccupancy).occupancyInfo?.available
                            )
                            const fmt = (s: string) => {
                              const [y, m, d] = s.split('-')
                              return `${parseInt(m!, 10)}月${parseInt(d!, 10)}日`
                            }
                            return (
                              <>
                                {available.length > 0 && (
                                  <SelectGroup>
                                    <SelectLabel>空闲</SelectLabel>
                                    {available.map((i) => (
                                      <SelectItem key={i.id} value={i.id}>
                                        {i.name}
                                        {i.brand && i.model && ` (${i.brand} ${i.model})`}
                                        {i.category && ` - ${i.category.name}`}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                )}
                                {occupied.length > 0 && (
                                  <SelectGroup>
                                    <SelectLabel>使用中（档期冲突）</SelectLabel>
                                    {occupied.map((i) => {
                                      const info = (i as ItemWithOccupancy).occupancyInfo
                                      const hint = info?.conflictPeriods?.length
                                        ? info.conflictPeriods.map((p) => `${fmt(p.startDate)}-${fmt(p.endDate)}`).join('、')
                                        : ''
                                      return (
                                        <SelectItem key={i.id} value={i.id}>
                                          {i.name}
                                          {i.brand && i.model && ` (${i.brand} ${i.model})`}
                                          {i.category && ` - ${i.category.name}`}
                                          {hint && ` [${hint}]`}
                                        </SelectItem>
                                      )
                                    })}
                                  </SelectGroup>
                                )}
                              </>
                            )
                          }
                          return validItems.map((i) => (
                            <SelectItem key={i.id} value={i.id}>
                              {i.name}
                              {i.brand && i.model && ` (${i.brand} ${i.model})`}
                              {i.category && ` - ${i.category.name}`}
                            </SelectItem>
                          ))
                        })()}
                      </SelectContent>
                    </Select>
                    {(() => {
                      const sel = items.find((i) => i.id === item.item_id) as ItemWithOccupancy | undefined
                      if (!sel?.occupancyInfo || sel.occupancyInfo.available) return null
                      const periods = sel.occupancyInfo.conflictPeriods || []
                      const hint = periods.length
                        ? periods.map((p) => `${p.startDate} - ${p.endDate}`).join('、')
                        : ''
                      return (
                        <Alert variant="destructive" className="mt-2">
                          <AlertDescription>
                            该资产档期冲突：{hint || '已被其他订单占用'}。确定仍要使用可提交订单。
                          </AlertDescription>
                        </Alert>
                      )
                    })()}
                  </div>

                  {/* 如果是游戏账号，显示设备绑定选项 */}
                  {isSelectedGameAccount && (
                    <div className="space-y-4 p-3 bg-muted rounded-lg">
                      <Label className="text-sm font-medium">游戏账号绑定设置</Label>
                      
                      <div className="space-y-2">
                        <Label>绑定设备（可选）</Label>
                        <Select
value={item.device_id && item.device_id.trim() !== '' ? item.device_id : '__none__'}
                            onValueChange={(value) => {
                            updateOrderItem(index, {
                              device_id: value === '__none__' ? undefined : value,
                              // 如果取消设备绑定，也清除权限类型
                              account_binding_type: value ? item.account_binding_type : undefined,
                            })
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择设备（可选，单独租赁账号时不选）" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">单独租赁（不绑定设备）</SelectItem>
                            {deviceItems.map((device) => (
                              <SelectItem key={device.id} value={device.id}>
                                {device.name}
                                {device.brand && device.model && ` (${device.brand} ${device.model})`}
                                {device.category && ` - ${device.category.name}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 如果选择了设备，显示权限类型选择 */}
                      {item.device_id && (
                        <div className="space-y-2">
                          <Label>绑定类型 *</Label>
                          <Select
                            value={item.account_binding_type || undefined}
                            onValueChange={(value: 'primary' | 'non_primary') => {
                              updateOrderItem(index, {
                                account_binding_type: value,
                              })
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="选择绑定类型" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="primary">主认证（Primary）</SelectItem>
                              <SelectItem value="non_primary">非主认证（Non-Primary）</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            主认证：可离线游戏；非主认证：需要账号在线才能游戏
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="min-w-0 space-y-2">
                      <Label>总租金 (¥) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.subtotal || ''}
                        onChange={(e) =>
                          updateOrderItem(index, {
                            subtotal: parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder="0.00"
                      />
                      <p className="text-xs text-muted-foreground">
                        单个物品的总租金（日租金 × 天数）
                      </p>
                    </div>

                    <div className="min-w-0 space-y-2">
                      <Label>实际租金 (¥)</Label>
                      <div className="h-10 px-3 py-2 rounded-md border bg-muted flex items-center font-medium">
                        {formatCurrency(calculateNetAmount(item.subtotal || 0, item.fee_rate) * item.quantity)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        扣除手续费后（已乘以数量）
                      </p>
                    </div>

                    <div className="min-w-0 space-y-2">
                      <Label>数量</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity || 1}
                        onChange={(e) =>
                          updateOrderItem(index, {
                            quantity: parseInt(e.target.value) || 1,
                          })
                        }
                      />
                    </div>

                    <div className="min-w-0 space-y-2">
                      <Label>押金 (¥)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.deposit || ''}
                        onChange={(e) =>
                          updateOrderItem(index, {
                            deposit: parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* 手续费率选择 */}
                  <div className="space-y-2">
                    <Label>手续费率</Label>
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                      <Select
                        value={item.fee_rate === null ? 'auto' : item.fee_rate === 0 ? '0' : item.fee_rate === 0.006 ? '0.6' : item.fee_rate === 0.016 ? '1.6' : 'custom'}
                        onValueChange={(value) => {
                          let feeRate: number | null = null
                          if (value === 'auto') {
                            feeRate = null
                          } else if (value === '0') {
                            feeRate = 0
                          } else if (value === '0.6') {
                            feeRate = 0.006
                          } else if (value === '1.6') {
                            feeRate = 0.016
                          } else if (value === 'custom') {
                            feeRate = 0.01  // 1% 作为自定义默认值，与预设 0.6%/1.6% 区分
                          }
                          updateOrderItem(index, { fee_rate: feeRate })
                        }}
                      >
                        <SelectTrigger className="min-w-0 w-full sm:w-56">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">
                            自动判断 ({getRecommendedFeeRate() === 0.006 ? '0.6%' : '1.6%'})
                            {monthlyOrderCount !== null && ` - 本月${monthlyOrderCount}单`}
                          </SelectItem>
                          <SelectItem value="0">0% (无手续费)</SelectItem>
                          <SelectItem value="0.6">0.6% (标准费率)</SelectItem>
                          <SelectItem value="1.6">1.6% (高级费率)</SelectItem>
                          <SelectItem value="custom">自定义费率</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {/* 自定义费率输入（选择自定义且费率不是预设值时才显示） */}
                      {(item.fee_rate !== null && item.fee_rate !== 0 && item.fee_rate !== 0.006 && item.fee_rate !== 0.016) && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.0001"
                            min="0"
                            max="100"
                            className="min-w-0 w-full max-w-[10rem] sm:w-32"
                            value={((item.fee_rate || 0) * 100).toFixed(4)}
                            onChange={(e) => {
                              const percentValue = parseFloat(e.target.value) || 0
                              const rate = Math.min(1, Math.max(0, percentValue / 100)) // 限制在 0-1 之间
                              updateOrderItem(index, { fee_rate: rate })
                            }}
                            placeholder="0.0000"
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      )}
                      
                      {/* 显示当前使用的费率（如果不是自动） */}
                      {item.fee_rate !== null && (
                        <span className="text-sm text-muted-foreground">
                          使用费率: {((item.fee_rate || 0) * 100).toFixed(2)}%
                        </span>
                      )}
                    </div>
                    {item.fee_rate === null && (
                      <p className="text-xs text-muted-foreground">
                        将根据本月订单数量自动选择费率（{monthlyOrderCount !== null && monthlyOrderCount > 10 ? '本月超过10单，使用1.6%' : '本月不超过10单，使用0.6%'}）
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="min-w-0 space-y-2">
                      <Label>总租金小计</Label>
                      <div className="h-10 px-3 py-2 rounded-md border bg-muted flex items-center font-medium">
                        {formatCurrency(item.subtotal * item.quantity)}
                      </div>
                    </div>
                    <div className="min-w-0 space-y-2">
                      <Label>实际租金小计</Label>
                      <div className="h-10 px-3 py-2 rounded-md border bg-muted flex items-center font-medium text-green-600">
                        {formatCurrency(calculateNetAmount(item.subtotal || 0, item.fee_rate) * item.quantity)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>日租金（参考）</Label>
                    <div className="h-10 px-3 py-2 rounded-md border bg-muted flex items-center text-sm text-muted-foreground">
                      {calculatedDailyRate > 0 ? formatCurrency(calculatedDailyRate) : '-'}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>备注</Label>
                    <Input
                      value={item.notes}
                      onChange={(e) =>
                        updateOrderItem(index, { notes: e.target.value })
                      }
                      placeholder="备注信息"
                    />
                  </div>

                  {/* 在当前订单项下方添加新订单项按钮 */}
                  <div className="pt-2 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => insertOrderItemAfter(index)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      添加下一个设备
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* 第三方租赁（从淘宝租游戏）- 默认折叠 */}
      <Collapsible open={openThirdParty} onOpenChange={setOpenThirdParty}>
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CollapsibleTrigger asChild>
                <button type="button" className="flex flex-1 items-center gap-2 text-left min-w-0">
                  {openThirdParty ? (
                    <ChevronUp className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <CardTitle>第三方租赁 ({formData.third_party_rentals.length})</CardTitle>
                    <CardDescription>记录从淘宝等平台租的游戏</CardDescription>
                  </div>
                </button>
              </CollapsibleTrigger>
              <Button type="button" variant="outline" size="sm" className="w-full shrink-0 sm:w-auto" onClick={addThirdPartyRental}>
                <Plus className="mr-2 h-4 w-4" />
                添加
              </Button>
            </div>
          </CardHeader>
          <CollapsibleContent>
        <CardContent className="space-y-3 sm:space-y-4">
          {formData.third_party_rentals.map((rental, index) => (
            <div key={index} className="space-y-3 sm:space-y-4 rounded-lg border p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">第三方租赁 #{index + 1}</h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeThirdPartyRental(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>游戏名称 *</Label>
                  <Input
                    value={rental.game_name}
                    onChange={(e) =>
                      updateThirdPartyRental(index, { game_name: e.target.value })
                    }
                    placeholder="游戏名称"
                  />
                </div>

                <div className="space-y-2">
                  <Label>平台</Label>
                  <Input
                    value={rental.platform}
                    onChange={(e) =>
                      updateThirdPartyRental(index, { platform: e.target.value })
                    }
                    placeholder="PS5 / Xbox / Switch"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>租赁成本 (¥) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={rental.rental_cost || ''}
                    onChange={(e) =>
                      updateThirdPartyRental(index, {
                        rental_cost: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>押金（付给供应商）(¥)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={rental.deposit || ''}
                    onChange={(e) =>
                      updateThirdPartyRental(index, {
                        deposit: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>供应商</Label>
                  <Select
                    value={rental.provider}
                    onValueChange={(value) =>
                      updateThirdPartyRental(index, { provider: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="taobao">淘宝</SelectItem>
                      <SelectItem value="other">其他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>第三方订单号</Label>
                  <Input
                    value={rental.provider_order_id}
                    onChange={(e) =>
                      updateThirdPartyRental(index, { provider_order_id: e.target.value })
                    }
                    placeholder="订单号"
                  />
                </div>

                <div className="space-y-2">
                  <Label>供应商链接</Label>
                  <Input
                    type="url"
                    value={rental.provider_link}
                    onChange={(e) =>
                      updateThirdPartyRental(index, { provider_link: e.target.value })
                    }
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>备注</Label>
                <Input
                  value={rental.notes}
                  onChange={(e) =>
                    updateThirdPartyRental(index, { notes: e.target.value })
                  }
                  placeholder="备注信息"
                />
              </div>
            </div>
          ))}
        </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* 物流费用 - 默认折叠 */}
      <Collapsible open={openShipping} onOpenChange={setOpenShipping}>
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CollapsibleTrigger asChild>
                <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  {openShipping ? (
                    <ChevronUp className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <CardTitle>物流费用 ({formData.shipping_fees.length})</CardTitle>
                    <CardDescription>记录发货、退货等物流费用</CardDescription>
                  </div>
                </button>
              </CollapsibleTrigger>
              <Button type="button" variant="outline" size="sm" className="w-full shrink-0 sm:w-auto" onClick={addShippingFee}>
                <Plus className="mr-2 h-4 w-4" />
                添加
              </Button>
            </div>
          </CardHeader>
          <CollapsibleContent>
        <CardContent className="space-y-3 sm:space-y-4">
          {formData.shipping_fees.map((fee, index) => (
            <div key={index} className="space-y-3 sm:space-y-4 rounded-lg border p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">物流费用 #{index + 1}</h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeShippingFee(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>类型 *</Label>
                  <Select
                    value={fee.shipping_type}
                    onValueChange={(value: 'outbound' | 'return' | 'pickup') =>
                      updateShippingFee(index, { shipping_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="outbound">发货</SelectItem>
                      <SelectItem value="return">退货</SelectItem>
                      <SelectItem value="pickup">自提</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>费用金额 (¥) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={fee.amount || ''}
                    onChange={(e) =>
                      updateShippingFee(index, {
                        amount: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>物流公司</Label>
                  <Input
                    value={fee.shipping_company}
                    onChange={(e) =>
                      updateShippingFee(index, { shipping_company: e.target.value })
                    }
                    placeholder="顺丰、中通等"
                  />
                </div>

                <div className="space-y-2">
                  <Label>快递单号</Label>
                  <Input
                    value={fee.tracking_number}
                    onChange={(e) =>
                      updateShippingFee(index, { tracking_number: e.target.value })
                    }
                    placeholder="快递单号"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>备注</Label>
                <Input
                  value={fee.notes}
                  onChange={(e) =>
                    updateShippingFee(index, { notes: e.target.value })
                  }
                  placeholder="备注信息"
                />
              </div>
            </div>
          ))}
        </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* 金额汇总 */}
      {(totalAmount > 0 || totalDeposit > 0 || totalShippingCost > 0 || totalThirdPartyCost > 0 || totalThirdPartySupplierDeposit > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>金额汇总</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-base sm:text-lg">
              <span className="min-w-0 shrink text-muted-foreground">总租金</span>
              <span className="font-semibold tabular-nums">{formatCurrency(totalAmount)}</span>
            </div>
            {totalShippingCost > 0 && (
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-base sm:text-lg">
                <span className="min-w-0 shrink text-muted-foreground">物流费用</span>
                <span className="font-medium tabular-nums">{formatCurrency(totalShippingCost)}</span>
              </div>
            )}
            {totalThirdPartyCost > 0 && (
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-base sm:text-lg">
                <span className="min-w-0 shrink text-muted-foreground">第三方转租成本</span>
                <span className="font-medium tabular-nums">{formatCurrency(totalThirdPartyCost)}</span>
              </div>
            )}
            {totalThirdPartySupplierDeposit > 0 && (
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-base sm:text-lg">
                <span className="min-w-0 shrink text-muted-foreground">付供应商押金（可退）</span>
                <span className="font-medium tabular-nums text-muted-foreground">{formatCurrency(totalThirdPartySupplierDeposit)}</span>
              </div>
            )}
            {(totalThirdPartyCost > 0 || totalThirdPartySupplierDeposit > 0) && (
              <p className="text-xs text-muted-foreground -mt-1">
                可退押金不计入客户总押金，也不计入订单列表「利润」成本
              </p>
            )}
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 border-t pt-2 text-base sm:text-lg">
              <span className="min-w-0 shrink font-medium">总押金（客户）</span>
              <span className="font-semibold tabular-nums">{formatCurrency(totalDeposit)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 备注 - 默认折叠 */}
      <Collapsible open={openNotes} onOpenChange={setOpenNotes}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer">
              <CardTitle>备注（可选）</CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="订单备注信息"
                rows={3}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* 提交按钮 */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => router.back()}
          disabled={loading}
        >
          取消
        </Button>
        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {orderId ? '更新订单' : '创建订单'}
        </Button>
      </div>
    </form>
  )
}
