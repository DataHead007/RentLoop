'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Loader2, Plus, Trash2, ChevronsUpDown } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import {
  BADMINTON_SERVICE_TYPES,
  BADMINTON_INCOME_CATEGORIES,
  BADMINTON_EXPENSE_CATEGORIES,
} from '@/lib/constants/badminton'
import { formatCurrency } from '@/lib/utils/format'
import type { Customer, Order } from '@/lib/types/database'
import { localCache } from '@/lib/storage/localCache'

type LineType = 'income' | 'expense'

interface LineRow {
  line_type: LineType
  category: string
  amount: string
  notes: string
}

interface BadmintonOrderFormProps {
  orderId?: string
  onSuccess?: () => void
  /** 加载失败、取消新建时返回的列表路径 */
  listRedirectPath?: string
}

export function BadmintonOrderForm({ orderId, onSuccess, listRedirectPath = '/orders' }: BadmintonOrderFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(!!orderId)
  const [submitting, setSubmitting] = useState(false)
  const [customer_name, setCustomer_name] = useState('')
  const [customer_phone, setCustomer_phone] = useState('')
  const [customer_email, setCustomer_email] = useState('')
  const [service_type, setService_type] = useState<string>('')
  const [location, setLocation] = useState('')
  const [service_date, setService_date] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [service_start_time, setService_start_time] = useState('')
  const [service_end_time, setService_end_time] = useState('')
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'>('pending')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineRow[]>([
    { line_type: 'income', category: '', amount: '', notes: '' },
  ])
  const createIdempotencyKeyRef = useRef<string | null>(null)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [customersLoading, setCustomersLoading] = useState(false)
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false)
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setCustomersLoading(true)
      try {
        const res = await fetch('/api/customers')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && Array.isArray(data)) setCustomers(data as Customer[])
      } catch {
        // 列表失败仍可手填客户
      } finally {
        if (!cancelled) setCustomersLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (orderId) {
      loadOrder()
    }
  }, [orderId])

  async function loadOrder() {
    try {
      setLoading(true)
      const res = await fetch(`/api/orders/${orderId}`)
      if (!res.ok) throw new Error('加载订单失败')
      const order: Order = await res.json()
      if ((order as any).order_type !== 'badminton') {
        throw new Error('此订单不是羽毛球订单')
      }
      setCustomer_name(order.customer_name)
      setCustomer_phone(order.customer_phone || '')
      setCustomer_email(order.customer_email || '')
      setSelectedCustomerId(order.customer_id ?? null)
      setService_type((order as any).service_type || '')
      setLocation((order as any).location || '')
      setService_date((order as any).service_date || order.start_date)
      setService_start_time((order as any).service_start_time || '')
      setService_end_time((order as any).service_end_time || '')
      setStatus(order.status)
      setNotes(order.notes || '')
      const badmintonLines = (order as any).badminton_order_lines as any[] | undefined
      if (badmintonLines && badmintonLines.length > 0) {
        setLines(
          badmintonLines.map((l: any) => ({
            line_type: l.line_type,
            category: l.category || '',
            amount: String(Math.abs(Number(l.amount)) || 0),
            notes: l.notes || '',
          }))
        )
      }
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : '加载订单失败')
      router.push(listRedirectPath)
    } finally {
      setLoading(false)
    }
  }

  const addLine = () => {
    setLines((prev) => [...prev, { line_type: 'income', category: '', amount: '', notes: '' }])
  }

  const removeLine = (i: number) => {
    if (lines.length <= 1) return
    const removedLine = lines[i]
    if (!removedLine) return
    setLines((prev) => prev.filter((_, idx) => idx !== i))
    toast('收支明细已删除', {
      action: {
        label: '撤销',
        onClick: () => {
          setLines((prev) => {
            const restored = [...prev]
            restored.splice(i, 0, removedLine)
            return restored
          })
        },
      },
    })
  }

  const updateLine = (i: number, field: keyof LineRow, value: string) => {
    setLines((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      if (field === 'line_type') next[i].category = ''
      return next
    })
  }

  const incomeTotal = lines
    .filter((l) => l.line_type === 'income')
    .reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
  const expenseTotal = lines
    .filter((l) => l.line_type === 'expense')
    .reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
  const netTotal = incomeTotal - expenseTotal

  const filteredCustomers = useMemo(() => {
    const q = customerSearchQuery.trim().toLowerCase().replace(/\s+/g, '')
    const list = !q
      ? customers
      : customers.filter((c) => {
          const name = c.name.toLowerCase()
          const phone = (c.phone || '').replace(/\s+/g, '')
          const email = (c.email || '').toLowerCase()
          return name.includes(q) || phone.includes(q) || email.includes(q)
        })
    return list.slice(0, 200)
  }, [customers, customerSearchQuery])

  const selectedCustomer = useMemo(
    () => (selectedCustomerId ? customers.find((c) => c.id === selectedCustomerId) : undefined),
    [customers, selectedCustomerId]
  )

  function applyCustomerSelection(c: Customer) {
    setSelectedCustomerId(c.id)
    setCustomer_name(c.name)
    setCustomer_phone(c.phone?.trim() || '')
    setCustomer_email(c.email?.trim() || '')
    setCustomerPickerOpen(false)
    setCustomerSearchQuery('')
  }

  function clearCustomerLink() {
    setSelectedCustomerId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customer_name.trim() || !service_type || !location.trim() || !service_date) {
      alert('请填写客户名称、服务类型、地点、服务日期')
      return
    }
    const validLines = lines
      .map((l) => ({
        line_type: l.line_type as 'income' | 'expense',
        category: l.category.trim(),
        amount: parseFloat(l.amount) || 0,
        notes: l.notes.trim() || null,
      }))
      .filter((l) => l.category && l.amount > 0)
    if (validLines.length === 0) {
      alert('请至少添加一笔有效的收支明细（类别 + 金额 > 0）')
      return
    }

    setSubmitting(true)
    try {
      if (!orderId) {
        if (!createIdempotencyKeyRef.current) {
          createIdempotencyKeyRef.current =
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`
        }
      }

      const url = orderId ? `/api/orders/${orderId}` : '/api/orders'
      const method = orderId ? 'PATCH' : 'POST'
      const payload = orderId
        ? {
            customer_name: customer_name.trim(),
            customer_phone: customer_phone.trim() || null,
            customer_email: customer_email.trim() || null,
            customer_id: selectedCustomerId,
            service_type,
            location: location.trim(),
            service_date,
            service_start_time: service_start_time.trim() || null,
            service_end_time: service_end_time.trim() || null,
            status,
            notes: notes.trim() || null,
            badminton_order_lines: validLines,
          }
        : {
            order_type: 'badminton',
            customer_name: customer_name.trim(),
            customer_phone: customer_phone.trim() || null,
            customer_email: customer_email.trim() || null,
            ...(selectedCustomerId ? { customer_id: selectedCustomerId } : {}),
            service_type,
            location: location.trim(),
            service_date,
            service_start_time: service_start_time.trim() || null,
            service_end_time: service_end_time.trim() || null,
            status: 'pending',
            notes: notes.trim() || null,
            badminton_order_lines: validLines,
            idempotency_key: createIdempotencyKeyRef.current!,
          }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || (orderId ? '更新失败' : '创建失败'))
      }
      if (!orderId) {
        createIdempotencyKeyRef.current = null
      }
      const order = await res.json()
      
      // 清除订单缓存，确保跳转后列表获取最新数据
      await localCache.clear('orders').catch(console.error)
      // 触发自定义事件，通知其他页面刷新统计数据（包括客户管理）
      window.dispatchEvent(new CustomEvent('orderUpdated'))
      // 同时使用 localStorage 通知其他标签页
      localStorage.setItem('orderUpdated', Date.now().toString())
      
      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/orders/${order.id}`)
      }
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : (orderId ? '更新失败，请重试' : '创建失败，请重试'))
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>客户与服务信息</CardTitle>
          <CardDescription>填写客户及本次服务的基本信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customer_name">客户姓名 *</Label>
              <div className="flex gap-2">
                <Input
                  id="customer_name"
                  className="flex-1 min-w-0"
                  value={customer_name}
                  onChange={(e) => setCustomer_name(e.target.value)}
                  placeholder="可手填，或从列表选择已有客户"
                />
                <Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      title="从客户列表选择"
                      disabled={customersLoading && customers.length === 0}
                    >
                      {customersLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ChevronsUpDown className="h-4 w-4" />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[min(100vw-2rem,22rem)] p-0" align="start">
                    <div className="border-b p-2">
                      <Input
                        placeholder="搜索姓名、电话、邮箱…"
                        value={customerSearchQuery}
                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1">
                      {filteredCustomers.length === 0 ? (
                        <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                          {customers.length === 0 ? '暂无客户档案，请直接输入姓名' : '无匹配客户'}
                        </p>
                      ) : (
                        filteredCustomers.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className={cn(
                              'flex w-full flex-col gap-0.5 rounded-md px-2 py-2 text-left text-sm hover:bg-muted',
                              selectedCustomerId === c.id && 'bg-muted'
                            )}
                            onClick={() => applyCustomerSelection(c)}
                          >
                            <span className="font-medium">{c.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {[c.phone, c.email].filter(Boolean).join(' · ') || '无电话/邮箱'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              羽毛球累计净额 {formatCurrency(c.badminton_total_amount ?? 0)} ·{' '}
                              {c.badminton_order_count ?? 0} 笔
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              {selectedCustomerId && (
                <p className="text-xs text-muted-foreground">
                  已关联客户档案
                  {selectedCustomer
                    ? ` · 历史羽毛球净额 ${formatCurrency(selectedCustomer.badminton_total_amount ?? 0)}（${
                        selectedCustomer.badminton_order_count ?? 0
                      } 笔，不含本单未保存金额）`
                    : null}
                </p>
              )}
              {selectedCustomerId ? (
                <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={clearCustomerLink}>
                  清除档案关联（改由系统按姓名/电话自动合并建档）
                </Button>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_phone">电话</Label>
              <Input
                id="customer_phone"
                value={customer_phone}
                onChange={(e) => setCustomer_phone(e.target.value)}
                placeholder="手机号"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer_email">邮箱</Label>
            <Input
              id="customer_email"
              type="email"
              value={customer_email}
              onChange={(e) => setCustomer_email(e.target.value)}
              placeholder="email@example.com"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>服务类型 *</Label>
              <Select value={service_type} onValueChange={setService_type}>
                <SelectTrigger>
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent>
                  {BADMINTON_SERVICE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">地点 *</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="如 XX 体育馆"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="service_date">服务日期 *</Label>
              <Input
                id="service_date"
                type="date"
                value={service_date}
                onChange={(e) => setService_date(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service_start_time">开始时间</Label>
              <Input
                id="service_start_time"
                type="time"
                value={service_start_time}
                onChange={(e) => setService_start_time(e.target.value)}
                placeholder="19:00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service_end_time">结束时间</Label>
              <Input
                id="service_end_time"
                type="time"
                value={service_end_time}
                onChange={(e) => setService_end_time(e.target.value)}
                placeholder="21:00"
              />
            </div>
          </div>
          {orderId && (
            <div className="space-y-2">
              <Label>订单状态</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">待确认</SelectItem>
                  <SelectItem value="confirmed">已确认</SelectItem>
                  <SelectItem value="in_progress">进行中</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="cancelled">已取消</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="notes">备注</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="可选"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>收支明细</CardTitle>
          <CardDescription>收入：教练费、陪练费、比赛奖金；支出：场地费、停车费、比赛报名费</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {lines.map((line, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
              <div className="w-24 space-y-1">
                <Label className="text-xs">类型</Label>
                <Select
                  value={line.line_type}
                  onValueChange={(v) => updateLine(i, 'line_type', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">收入</SelectItem>
                    <SelectItem value="expense">支出</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-36 space-y-1">
                <Label className="text-xs">类别</Label>
                <Select
                  value={line.category}
                  onValueChange={(v) => updateLine(i, 'category', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择" />
                  </SelectTrigger>
                  <SelectContent>
                    {line.line_type === 'income'
                      ? BADMINTON_INCOME_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))
                      : BADMINTON_EXPENSE_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-28 space-y-1">
                <Label className="text-xs">金额</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={line.amount}
                  onChange={(e) => updateLine(i, 'amount', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="flex-1 min-w-[120px] space-y-1">
                <Label className="text-xs">备注</Label>
                <Input
                  value={line.notes}
                  onChange={(e) => updateLine(i, 'notes', e.target.value)}
                  placeholder="可选"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeLine(i)}
                disabled={lines.length <= 1}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="mr-2 h-4 w-4" />
            添加一笔收支
          </Button>
          <div className="flex flex-wrap gap-4 border-t pt-4">
            <span className="text-sm text-muted-foreground">收入合计：{formatCurrency(incomeTotal)}</span>
            <span className="text-sm text-muted-foreground">支出合计：{formatCurrency(expenseTotal)}</span>
            <span className="font-medium">净收入：{formatCurrency(netTotal)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {orderId ? '更新订单' : '创建羽毛球订单'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => (orderId ? router.push(`/orders/${orderId}`) : router.push(listRedirectPath))}
        >
          取消
        </Button>
      </div>
    </form>
  )
}
