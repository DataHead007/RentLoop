'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Transaction, Order, Item } from '@/lib/types/database'
import type { BusinessPlate, CreatorChannel } from '@/lib/types/businessPlate'
import { BUSINESS_PLATES, PLATE_LABEL, CHANNEL_LABEL, CREATOR_CHANNELS } from '@/lib/types/businessPlate'
import {
  BADMINTON_INCOME_CATEGORIES,
  BADMINTON_EXPENSE_CATEGORIES,
} from '@/lib/constants/badminton'
import {
  YOUTUBE_INCOME_CATEGORIES,
  YOUTUBE_EXPENSE_CATEGORIES,
} from '@/lib/constants/youtube'
import {
  WECHAT_VIDEO_INCOME_CATEGORIES,
  WECHAT_VIDEO_EXPENSE_CATEGORIES,
} from '@/lib/constants/wechatVideo'
import {
  XIAOHONGSHU_INCOME_CATEGORIES,
  XIAOHONGSHU_EXPENSE_CATEGORIES,
} from '@/lib/constants/xiaohongshu'

interface TransactionFormProps {
  transactionId?: string
  orderId?: string // 可选：从订单页面创建交易时传入
  itemId?: string // 可选：从资产页面创建交易时传入
  /** 新建时默认板块 */
  defaultPlate?: BusinessPlate
  /** 自媒体默认渠道（仅 plate=creator 时） */
  defaultCreatorChannel?: CreatorChannel | null
}

export function TransactionForm({
  transactionId,
  orderId,
  itemId,
  defaultPlate = 'rental',
  defaultCreatorChannel = null,
}: TransactionFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [date, setDate] = useState<Date>(new Date())
  
  const [formData, setFormData] = useState({
    order_id: orderId || '',
    item_id: itemId || '',
    type: 'income' as 'income' | 'expense',
    amount: '',
    category: '',
    description: '',
    transaction_date: format(new Date(), 'yyyy-MM-dd'),
    business_plate: defaultPlate,
    creator_channel: defaultPlate === 'creator' ? defaultCreatorChannel ?? 'youtube' : null,
  })
  
  // 金额输入框的状态（用于公式计算）
  const [amountInput, setAmountInput] = useState('')
  const [amountError, setAmountError] = useState<string | null>(null)

  useEffect(() => {
    if (transactionId) {
      loadTransaction()
    } else if (orderId) {
      // 从订单创建交易时，预填充一些信息
      loadOrder()
    } else if (itemId) {
      // 从资产创建交易时，预填充资产信息
      loadItem()
    }
  }, [transactionId, orderId, itemId])

  useEffect(() => {
    if (orderId || itemId) {
      setFormData((prev) => ({
        ...prev,
        business_plate: 'rental',
        creator_channel: null,
      }))
    }
  }, [orderId, itemId])

  // 单独的 effect 用于加载资产列表
  useEffect(() => {
    if (!transactionId) {
      loadItems()
    }
  }, [transactionId])
  
  // 同步 amountInput 和 formData.amount
  useEffect(() => {
    setAmountInput(formData.amount)
  }, [formData.amount])

  async function loadTransaction() {
    try {
      setLoading(true)
      const response = await fetch(`/api/transactions/${transactionId}`)
      if (!response.ok) throw new Error('Failed to fetch transaction')
      const data: Transaction = await response.json()
      const amountStr = data.amount.toString()
      setFormData({
        order_id: data.order_id || '',
        item_id: data.item_id || '',
        type: data.type,
        amount: amountStr,
        category: data.category || '',
        description: data.description || '',
        transaction_date: data.transaction_date,
        business_plate: data.business_plate ?? 'rental',
        creator_channel: data.creator_channel ?? null,
      })
      setAmountInput(amountStr)
      setDate(new Date(data.transaction_date))
    } catch (error) {
      console.error('Failed to load transaction:', error)
      alert('加载交易记录失败')
    } finally {
      setLoading(false)
    }
  }

  async function loadItems() {
    try {
      const response = await fetch('/api/items')
      if (!response.ok) return
      const data = await response.json()
      // 过滤掉无效的项（id 为空或无效）
      const validItems = data.filter((item: Item) => 
        item?.id && typeof item.id === 'string' && item.id.trim() !== ''
      )
      setItems(validItems)
    } catch (error) {
      console.error('Failed to load items:', error)
    }
  }

  async function loadItem() {
    try {
      const response = await fetch(`/api/items/${itemId}`)
      if (!response.ok) return
      const data: Item = await response.json()
      // 预填充资产相关信息（仅在初始化时设置默认值）
      setFormData(prev => ({
        ...prev,
        item_id: data.id,
        // 如果用户还没有手动修改过类型，才设置默认值
        ...(prev.type === 'income' && !prev.category ? {
          category: '租金收入',
          description: `${data.name} 历史收入`,
        } : {})
      }))
    } catch (error) {
      console.error('Failed to load item:', error)
    }
  }

  async function loadOrder() {
    try {
      const response = await fetch(`/api/orders/${orderId}`)
      if (!response.ok) return
      const data: Order = await response.json()
      // 预填充订单相关信息
      const amountStr = data.total_amount.toString()
      setFormData(prev => ({
        ...prev,
        order_id: data.id,
        type: 'income',
        amount: amountStr,
        category: '租金收入',
        description: `订单 ${data.order_number || data.id.slice(0, 8)} 租金收入`,
        transaction_date: data.end_date,
      }))
      setAmountInput(amountStr)
      setDate(new Date(data.end_date))
    } catch (error) {
      console.error('Failed to load order:', error)
    }
  }

  // 计算数学表达式（支持括号、负数、多个运算符）
  const calculateExpression = (expression: string): { success: boolean; result?: number; error?: string } => {
    try {
      // 去掉开头的等号
      let expr = expression.trim().replace(/^=/, '').trim()
      
      if (!expr) {
        return { success: false, error: '公式不能为空' }
      }
      
      // 验证表达式只包含数字、运算符、括号、小数点、空格
      if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
        return { success: false, error: '公式包含非法字符' }
      }
      
      // 移除所有空格
      expr = expr.replace(/\s/g, '')
      
      // 验证括号匹配
      let bracketCount = 0
      for (const char of expr) {
        if (char === '(') bracketCount++
        if (char === ')') bracketCount--
        if (bracketCount < 0) {
          return { success: false, error: '括号不匹配' }
        }
      }
      if (bracketCount !== 0) {
        return { success: false, error: '括号不匹配' }
      }
      
      // 验证表达式格式（不允许连续运算符，除了负数）
      // 更宽松的验证：确保以数字、负号或括号开始，以数字或括号结束
      if (!/^[-]?[0-9(]/.test(expr) || !/[0-9)]$/.test(expr)) {
        return { success: false, error: '公式格式不正确' }
      }
      
      // 使用 Function 构造器安全计算（已验证输入只包含数学表达式）
      const result = new Function('return ' + expr)()
      
      if (typeof result !== 'number' || !isFinite(result)) {
        return { success: false, error: '计算结果无效' }
      }
      
      // 保留两位小数
      const roundedResult = Math.round(result * 100) / 100
      
      return { success: true, result: roundedResult }
    } catch (error) {
      return { success: false, error: '公式计算失败，请检查格式' }
    }
  }
  
  // 处理金额输入变化
  const handleAmountChange = (value: string) => {
    setAmountInput(value)
    setAmountError(null)
    
    // 如果输入以 = 开头，尝试计算（实时预览错误，但不立即替换）
    if (value.trim().startsWith('=')) {
      const calc = calculateExpression(value)
      if (!calc.success) {
        setAmountError(calc.error || '公式格式错误')
      } else {
        setAmountError(null)
      }
    } else {
      setAmountError(null)
      // 实时更新 formData.amount（非公式输入）
      setFormData({ ...formData, amount: value })
    }
  }
  
  // 处理失去焦点时计算并替换
  const handleAmountBlur = () => {
    if (amountInput.trim().startsWith('=')) {
      const calc = calculateExpression(amountInput)
      if (calc.success && calc.result !== undefined) {
        // 替换为计算结果
        const result = calc.result.toString()
        setAmountInput(result)
        setFormData({ ...formData, amount: result })
        setAmountError(null)
      } else {
        // 显示错误，不替换
        setAmountError(calc.error || '公式格式错误')
      }
    } else {
      // 非公式输入，直接更新
      setFormData({ ...formData, amount: amountInput })
      setAmountError(null)
    }
  }
  
  // 处理回车键计算
  const handleAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && amountInput.trim().startsWith('=')) {
      e.preventDefault()
      handleAmountBlur()
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    // 如果输入框中有公式，先计算
    let finalAmount = amountInput
    if (amountInput.trim().startsWith('=')) {
      const calc = calculateExpression(amountInput)
      if (!calc.success || calc.result === undefined) {
        alert(calc.error || '公式格式错误，请修正后再提交')
        setAmountError(calc.error || '公式格式错误')
        return
      }
      finalAmount = calc.result.toString()
      setAmountInput(finalAmount)
      setFormData({ ...formData, amount: finalAmount })
    }
    
    const amountValue = parseFloat(finalAmount)
    
    // 根据交易类型验证金额
    if (!finalAmount || isNaN(amountValue)) {
      alert('请输入有效的金额')
      return
    }
    
    if (formData.type === 'income' && amountValue <= 0) {
      alert('收入金额必须大于0')
      return
    }
    
    if (formData.type === 'expense' && amountValue >= 0) {
      alert('支出金额必须小于0（负数）')
      return
    }

    if (formData.business_plate === 'creator' && !formData.creator_channel) {
      alert('请选择自媒体渠道')
      return
    }

    setSubmitting(true)
    try {
      // 对于支出类型，确保金额是负数
      const processedAmount = formData.type === 'expense' 
        ? (amountValue > 0 ? -Math.abs(amountValue) : amountValue)
        : amountValue
      
      const payload = {
        ...formData,
        order_id: formData.order_id || null,
        item_id: formData.item_id || null,
        amount: processedAmount,
        category: formData.category || null,
        description: formData.description || null,
        transaction_date: format(date, 'yyyy-MM-dd'),
        business_plate: formData.business_plate,
        creator_channel:
          formData.business_plate === 'creator' ? formData.creator_channel : null,
      }

      const url = transactionId ? `/api/transactions/${transactionId}` : '/api/transactions'
      const method = transactionId ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        let message = '保存失败'
        try {
          const data: unknown = await response.json()
          if (typeof data === 'object' && data !== null && 'error' in data) {
            const maybeError = (data as { error?: unknown }).error
            if (typeof maybeError === 'string' && maybeError.trim()) message = maybeError
          }
        } catch {
          // ignore JSON parse errors; keep default message
        }
        throw new Error(message)
      }

      window.dispatchEvent(new CustomEvent('transactionUpdated'))
      localStorage.setItem('transactionUpdated', Date.now().toString())

      // 如果是从资产详情页创建的，跳转回资产详情页；否则跳转到交易记录列表
      if (itemId) {
        router.push(`/items/${itemId}`)
      } else {
        router.push('/transactions')
      }
    } catch (error) {
      console.error('Failed to save transaction:', error)
      alert(error instanceof Error ? error.message : '保存失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">加载中...</div>
        </CardContent>
      </Card>
    )
  }

  const getCategories = (): { income: string[]; expense: string[] } => {
    const plate = formData.business_plate
    const ch = formData.creator_channel
    if (plate === 'badminton') {
      return {
        income: [...BADMINTON_INCOME_CATEGORIES, '其他收入'],
        expense: [...BADMINTON_EXPENSE_CATEGORIES, '其他支出'],
      }
    }
    if (plate === 'creator' && ch === 'youtube') {
      return {
        income: [...YOUTUBE_INCOME_CATEGORIES],
        expense: [...YOUTUBE_EXPENSE_CATEGORIES],
      }
    }
    if (plate === 'creator' && ch === 'wechat_video') {
      return {
        income: [...WECHAT_VIDEO_INCOME_CATEGORIES],
        expense: [...WECHAT_VIDEO_EXPENSE_CATEGORIES],
      }
    }
    if (plate === 'creator' && ch === 'xiaohongshu') {
      return {
        income: [...XIAOHONGSHU_INCOME_CATEGORIES],
        expense: [...XIAOHONGSHU_EXPENSE_CATEGORIES],
      }
    }
    return {
      income: ['租金收入', '押金收入', '配件出售收入', '赔偿收入', '融资放款入账', '其他收入'],
      expense: ['设备购买', '维护费用', '物流费用', '物流支出', '转租支出', '融资成本', '归还借款本金', '其他支出'],
    }
  }
  const categories = getCategories()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{transactionId ? '编辑交易记录' : '新建交易记录'}</CardTitle>
        <CardDescription>
          {transactionId ? '修改交易记录信息' : '记录收入或支出'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="min-w-0 space-y-5 sm:space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>板块 *</Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-2">
                  <Select
                    value={formData.business_plate}
                    onValueChange={(value: BusinessPlate) =>
                      setFormData({
                        ...formData,
                        business_plate: value,
                        creator_channel:
                          value === 'creator' ? formData.creator_channel ?? 'youtube' : null,
                        category: '',
                      })
                    }
                    disabled={!!orderId || !!itemId}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUSINESS_PLATES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {PLATE_LABEL[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formData.business_plate === 'creator' ? (
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label className="text-muted-foreground">自媒体渠道 *</Label>
                    <Select
                      value={formData.creator_channel ?? 'youtube'}
                      onValueChange={(value: CreatorChannel) =>
                        setFormData({ ...formData, creator_channel: value, category: '' })
                      }
                      disabled={!!orderId || !!itemId}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CREATOR_CHANNELS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {CHANNEL_LABEL[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
              {(orderId || itemId) && (
                <p className="text-xs text-muted-foreground">从订单/资产创建的交易固定为租赁板块</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">类型 *</Label>
              <Select
                value={formData.type}
                onValueChange={(value: 'income' | 'expense') =>
                  setFormData({ ...formData, type: value, category: '' })
                }
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">收入</SelectItem>
                  <SelectItem value="expense">支出</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">金额 (¥) *</Label>
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => handleAmountChange(e.target.value)}
                onBlur={handleAmountBlur}
                onKeyDown={handleAmountKeyDown}
                placeholder={formData.type === 'expense' ? '-0.00 或 =100+200' : '0.00 或 =100+200'}
                className={cn(amountError && 'border-red-500')}
                required
              />
              {amountError && (
                <p className="text-xs text-red-500">{amountError}</p>
              )}
              {formData.type === 'expense' && !amountError && (
                <p className="text-xs text-muted-foreground">
                  支出金额请输入负数，例如：-300 或 =-100+50
                </p>
              )}
              {!amountError && (
                <p className="text-xs text-muted-foreground">
                  支持公式计算，例如：=100+200、=(100+200)*2、=-100+200
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">类别</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="选择类别（可选）" />
                </SelectTrigger>
                <SelectContent>
                  {categories[formData.type].map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.type === 'income' && !orderId && (
              <div className="space-y-2">
                <Label htmlFor="item_id">关联资产（可选）</Label>
                <Select
                  value={formData.item_id || undefined}
                  onValueChange={(value) => setFormData({ ...formData, item_id: value || '' })}
                >
                  <SelectTrigger id="item_id">
                    <SelectValue placeholder="选择资产（可选，用于历史收入）" />
                  </SelectTrigger>
                  <SelectContent>
                    {items
                      .filter((item) => {
                        // 确保 id 存在且不是空字符串
                        return item?.id && typeof item.id === 'string' && item.id.trim() !== ''
                      })
                      .map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} {item.category?.name ? `(${item.category.name})` : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {formData.item_id && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormData({ ...formData, item_id: '' })}
                    className="mt-1 text-xs"
                  >
                    清除选择
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="transaction_date">交易日期 *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !date && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, 'yyyy-MM-dd') : '选择日期'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(selectedDate) => {
                      if (selectedDate) {
                        setDate(selectedDate)
                        setFormData({
                          ...formData,
                          transaction_date: format(selectedDate, 'yyyy-MM-dd'),
                        })
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="交易描述（可选）"
              rows={3}
            />
          </div>

          {(orderId || itemId) && (
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">
                {orderId && `此交易记录关联到订单：${orderId.slice(0, 8)}...`}
                {itemId && `此交易记录关联到资产：${items.find(i => i.id === itemId)?.name || itemId.slice(0, 8)}...`}
              </p>
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => router.back()}>
              取消
            </Button>
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {transactionId ? '保存修改' : '创建交易记录'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
