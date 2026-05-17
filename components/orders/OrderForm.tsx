'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { formatDateShort, formatCurrency } from '@/lib/utils/format'
import { calculateRentalAmount } from '@/lib/utils/availability'
import { cn } from '@/lib/utils'
import type { Item } from '@/lib/types/database'

interface OrderFormData {
  item_id: string
  customer_name: string
  customer_phone: string
  customer_email: string
  start_date: Date | undefined
  end_date: Date | undefined
  daily_rate: number
  deposit: number
  notes: string
}

interface OrderFormProps {
  itemId?: string
  onSuccess?: () => void
}

export function OrderForm({ itemId, onSuccess }: OrderFormProps) {
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<OrderFormData>({
    item_id: itemId || '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    start_date: undefined,
    end_date: undefined,
    daily_rate: 0,
    deposit: 0,
    notes: '',
  })

  useEffect(() => {
    loadItems()
  }, [])

  useEffect(() => {
    if (formData.start_date && formData.end_date && formData.daily_rate > 0) {
      const { totalAmount } = calculateRentalAmount(
        formData.start_date,
        formData.end_date,
        formData.daily_rate
      )
      // 可以在 UI 中显示计算出的总金额
    }
  }, [formData.start_date, formData.end_date, formData.daily_rate])

  async function loadItems() {
    try {
      const response = await fetch('/api/items')
      if (!response.ok) throw new Error('Failed to fetch items')
      const data = await response.json()
      setItems(data.filter((item: Item) => item.status === 'available'))
    } catch (error) {
      console.error('Failed to load items:', error)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!formData.item_id || !formData.start_date || !formData.end_date) {
      alert('请填写所有必填字段')
      return
    }

    if (formData.end_date < formData.start_date!) {
      alert('结束日期不能早于开始日期')
      return
    }

    setLoading(true)
    try {
      const { totalAmount } = calculateRentalAmount(
        formData.start_date!,
        formData.end_date!,
        formData.daily_rate || 0
      )

      const orderData = {
        item_id: formData.item_id,
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone || null,
        customer_email: formData.customer_email || null,
        start_date: formData.start_date!.toISOString().split('T')[0],
        end_date: formData.end_date!.toISOString().split('T')[0],
        daily_rate: formData.daily_rate,
        total_amount: totalAmount,
        deposit: formData.deposit || 0,
        notes: formData.notes || null,
        status: 'pending' as const,
      }

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      })

      if (!response.ok) throw new Error('Failed to create order')

      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/orders')
      }
    } catch (error) {
      console.error('Failed to create order:', error)
      alert('创建订单失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const selectedItem = items.find((item) => item.id === formData.item_id)
  const { days, totalAmount } = formData.start_date && formData.end_date && formData.daily_rate > 0
    ? calculateRentalAmount(formData.start_date, formData.end_date, formData.daily_rate)
    : { days: 0, totalAmount: 0 }

  return (
    <form onSubmit={handleSubmit} className="min-w-0 space-y-5 sm:space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>订单信息</CardTitle>
          <CardDescription>填写订单基本信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item_id">选择设备 *</Label>
            <Select
              value={formData.item_id}
              onValueChange={(value) => setFormData({ ...formData, item_id: value })}
              disabled={!!itemId}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择设备" />
              </SelectTrigger>
              <SelectContent>
                  {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                    {item.brand && item.model && ` (${item.brand} ${item.model})`}
                    {'category' in item && item.category && ` - ${(item.category as any).name}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                    onSelect={(date) => setFormData({ ...formData, start_date: date })}
                    disabled={(date) => date < new Date()}
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
                    onSelect={(date) => setFormData({ ...formData, end_date: date })}
                    disabled={(date) => 
                      date < new Date() || 
                      !!(formData.start_date && date < formData.start_date)
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="daily_rate">日租金 (¥) *</Label>
              <Input
                id="daily_rate"
                type="number"
                step="0.01"
                value={formData.daily_rate || ''}
                onChange={(e) => setFormData({ ...formData, daily_rate: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deposit">押金 (¥)</Label>
              <Input
                id="deposit"
                type="number"
                step="0.01"
                value={formData.deposit || ''}
                onChange={(e) => setFormData({ ...formData, deposit: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>
          </div>

          {days > 0 && (
            <div className="rounded-lg bg-muted p-4">
              <div className="flex justify-between text-sm">
                <span>租赁天数：</span>
                <span className="font-medium">{days} 天</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span>总金额：</span>
                <span className="text-lg font-semibold tabular-nums">{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>客户信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customer_name">客户姓名 *</Label>
            <Input
              id="customer_name"
              value={formData.customer_name}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              placeholder="请输入客户姓名"
              required
            />
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
            <Label htmlFor="notes">备注</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="订单备注信息"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4">
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
          创建订单
        </Button>
      </div>
    </form>
  )
}
