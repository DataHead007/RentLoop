'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import useSWR, { useSWRConfig } from 'swr'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CheckinDialog } from './CheckinDialog'
import { ShippingDialog } from './ShippingDialog'
import { ArrowLeft, Package, User, DollarSign, Camera, ShoppingBag, Truck, Hash, CheckCircle2, Loader2, Edit, RotateCcw, Calendar as CalendarLucide, Pencil, Check, X } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Order } from '@/lib/types/database'
import { formatCurrency, formatDateShort, getDaysUntilStart, getDaysUntilEnd } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { apiFetch, ApiFetchError } from '@/lib/api/fetcher'

export function OrderDetail() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string
  const [checkinDialogOpen, setCheckinDialogOpen] = useState(false)
  const [shippingDialogOpen, setShippingDialogOpen] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [confirmStatus, setConfirmStatus] = useState<{ label: string; status: Order['status']; warning?: string } | null>(null)
  // 就地编辑：当前正在编辑的区块
  const [editingBlock, setEditingBlock] = useState<'customer' | 'dates' | 'badminton-service' | null>(null)
  const [savingBlock, setSavingBlock] = useState<'customer' | 'dates' | 'badminton-service' | null>(null)
  // 客户+备注区块草稿
  const [draftCustomer, setDraftCustomer] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    customer_address: '',
    notes: '',
  })
  // 日期区块草稿（租赁：start/end；羽毛球：service_date + time）
  const [draftDates, setDraftDates] = useState<{
    start_date?: string
    end_date?: string
    service_date?: string
    service_start_time?: string
    service_end_time?: string
  }>({})
  // 订单项就地编辑：当前编辑的行 id 及草稿
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [savingItemId, setSavingItemId] = useState<string | null>(null)
  const [draftItem, setDraftItem] = useState<{ quantity: number; daily_rate: number; deposit: number; notes: string }>({
    quantity: 1,
    daily_rate: 0,
    deposit: 0,
    notes: '',
  })
  // 第三方租赁就地编辑
  const [editingRentalId, setEditingRentalId] = useState<string | null>(null)
  const [savingRentalId, setSavingRentalId] = useState<string | null>(null)
  const [draftRental, setDraftRental] = useState<{
    game_name: string
    rental_cost: number
    deposit: number
    platform: string
    provider: string
    provider_order_id: string
    notes: string
  }>({ game_name: '', rental_cost: 0, deposit: 0, platform: '', provider: '', provider_order_id: '', notes: '' })
  // 物流费用就地编辑
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null)
  const [savingFeeId, setSavingFeeId] = useState<string | null>(null)
  const [draftFee, setDraftFee] = useState<{
    shipping_type: 'outbound' | 'return' | 'pickup'
    shipping_company: string
    tracking_number: string
    amount: number
    notes: string
  }>({ shipping_type: 'outbound', shipping_company: '', tracking_number: '', amount: 0, notes: '' })
  // 羽毛球服务信息就地编辑
  const [draftBadmintonService, setDraftBadmintonService] = useState<{ service_type: string; location: string }>({ service_type: '', location: '' })

  const orderKey = useMemo(() => `/api/orders/${orderId}`, [orderId])
  const { mutate: globalMutate } = useSWRConfig()

  const {
    data: order,
    isLoading: loading,
    mutate: mutateOrder,
  } = useSWR<Order>(orderKey, (key) => apiFetch<Order>(key), {
    keepPreviousData: true,
  })

  useEffect(() => {
    const onOrderUpdated = () => mutateOrder()
    window.addEventListener('orderUpdated', onOrderUpdated)
    return () => window.removeEventListener('orderUpdated', onOrderUpdated)
  }, [mutateOrder])

  const toastError = useCallback((err: unknown, fallback: string) => {
    const message = err instanceof ApiFetchError ? err.message : err instanceof Error ? err.message : fallback
    const code = err instanceof ApiFetchError ? err.code : undefined
    toast.error(message, code ? { description: code } : undefined)
  }, [])

  const revalidateDashboards = useCallback(async () => {
    await globalMutate((key) => typeof key === 'string' && key.startsWith('/api/transactions/stats'))
    await globalMutate((key) => typeof key === 'string' && key.startsWith('/api/items/assets-value'))
  }, [globalMutate])

  const revalidateOrdersLists = useCallback(async () => {
    await globalMutate((key) => typeof key === 'string' && key.startsWith('/api/orders?'))
  }, [globalMutate])

  /** 就地编辑：仅更新订单主表字段（客户、日期、备注等），不碰 order_items/shipping */
  async function patchOrderFields(payload: Record<string, unknown>) {
    if (!orderId) return
    if (!order) {
      await apiFetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      await mutateOrder()
    } else {
      const snapshot = order
      await mutateOrder(
        async (current) => {
          await apiFetch(`/api/orders/${orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          const base = current ?? snapshot
          return { ...base, ...(payload as any) } as Order
        },
        {
          optimisticData: (current) => {
            const base = current ?? snapshot
            return { ...base, ...(payload as any) } as Order
          },
          rollbackOnError: true,
          revalidate: true,
          populateCache: true,
        }
      )
    }
    await revalidateDashboards()
    await revalidateOrdersLists()
    window.dispatchEvent(new CustomEvent('orderUpdated'))
    localStorage.setItem('orderUpdated', Date.now().toString())
  }

  function startEditCustomer() {
    if (!order) return
    setDraftCustomer({
      customer_name: order.customer_name || '',
      customer_phone: order.customer_phone || '',
      customer_email: order.customer_email || '',
      customer_address: order.customer_address || '',
      notes: order.notes || '',
    })
    setEditingBlock('customer')
  }

  function startEditDates() {
    if (!order) return
    const o = order as Order & { service_date?: string; service_start_time?: string; service_end_time?: string }
    if (isBadminton) {
      const sd = o.service_date || order.start_date || ''
      setDraftDates({
        service_date: sd ? sd.split('T')[0] : '',
        service_start_time: o.service_start_time ?? '',
        service_end_time: o.service_end_time ?? '',
      })
    } else {
      setDraftDates({
        start_date: order.start_date ? order.start_date.split('T')[0] : '',
        end_date: order.end_date ? order.end_date.split('T')[0] : '',
      })
    }
    setEditingBlock('dates')
  }

  async function updateOrderStatus(newStatus: Order['status']) {
    if (!order) return

    setUpdatingStatus(true)
    try {
      const snapshot = order
      await mutateOrder(
        async (current) => {
          await apiFetch(`/api/orders/${order.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
          })
          const base = current ?? snapshot
          return { ...base, status: newStatus } as Order
        },
        {
          optimisticData: (current) => {
            const base = current ?? snapshot
            return { ...base, status: newStatus } as Order
          },
          rollbackOnError: true,
          revalidate: true,
          populateCache: true,
        }
      )
      await revalidateDashboards()
      await revalidateOrdersLists()
      window.dispatchEvent(new CustomEvent('orderUpdated'))
      localStorage.setItem('orderUpdated', Date.now().toString())
    } catch (error) {
      console.error('Failed to update order status:', error)
      toastError(error, '更新状态失败，请重试')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const isBadminton = (order as any)?.order_type === 'badminton'

  const getNextStatusAction = (): { label: string; status: Order['status'] } | null => {
    if (!order) return null
    
    // 羽毛球订单：简化流程，只有「完成」
    if (isBadminton) {
      if (order.status === 'pending' || order.status === 'confirmed' || order.status === 'in_progress') {
        return { label: '完成', status: 'completed' }
      }
      return null
    }
    
    // 租赁订单：已合并 pending 和 confirmed，直接 pending → 开始发货
    switch (order.status) {
      case 'pending':
      case 'confirmed': // 兼容历史订单
        return { label: '开始发货', status: 'in_progress' }
      case 'in_progress':
        return null // 只能收货，不能通过状态更新
      case 'completed':
        return null
      case 'cancelled':
        return null
      default:
        return null
    }
  }

  // 获取可以回退到的上一个状态
  const getPreviousStatusAction = (): { label: string; status: Order['status'] } | null => {
    if (!order) return null
    
    // 羽毛球订单：只有「回退到待处理」
    if (isBadminton) {
      if (order.status === 'completed') {
        return { label: '回退到待处理', status: 'pending' }
      }
      return null
    }
    
    // 租赁订单：已合并 pending 和 confirmed，in_progress 回退到 pending
    switch (order.status) {
      case 'completed':
        return { label: '回退到进行中', status: 'in_progress' }
      case 'in_progress':
        return { label: '回退到待发货', status: 'pending' }
      case 'confirmed': // 兼容历史订单，回退到 pending
        return { label: '回退到待发货', status: 'pending' }
      case 'pending':
      case 'cancelled':
        return null // 不能再回退
      default:
        return null
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'secondary'
      case 'confirmed':
        return 'default'
      case 'in_progress':
        return 'default'
      case 'completed':
        return 'success'
      case 'cancelled':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: '待发货',
      confirmed: '待发货', // 兼容历史订单，与 pending 合并
      in_progress: '待收货',
      completed: '已完成',
      cancelled: '已取消',
    }
    return labels[status] || status
  }

  const canCheckin = !isBadminton && order?.status === 'in_progress'

  type TimelineStep = { key: string; label: string }
  type TimelineData = { steps: TimelineStep[]; current: number; cancelled: boolean }

  const getTimelineSteps = (): TimelineData => {
    if (!order) return { steps: [], current: 0, cancelled: false }

    if (isBadminton) {
      const steps = [
        { key: 'pending', label: '待上课' },
        { key: 'in_progress', label: '进行中' },
        { key: 'completed', label: '已完成' },
      ]
      const current =
        order.status === 'cancelled'
          ? 0
          : order.status === 'completed'
            ? 2
            : order.status === 'in_progress'
              ? 1
              : 0
      return { steps, current, cancelled: order.status === 'cancelled' }
    }

    const steps = [
      { key: 'pending', label: '待发货' },
      { key: 'in_progress', label: '待收货' },
      { key: 'completed', label: '已完成' },
    ]
    const current =
      order.status === 'cancelled'
        ? 0
        : order.status === 'completed'
          ? 2
          : order.status === 'in_progress'
            ? 1
            : 0
    return { steps, current, cancelled: order.status === 'cancelled' }
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

  if (!order) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <p className="text-muted-foreground">订单不存在</p>
            <Button onClick={() => router.push('/orders')} className="mt-4">
              返回订单列表
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">订单详情</h2>
            <p className="text-muted-foreground">
              {order.order_number ? `订单编号: ${order.order_number}` : `订单 ID: ${order.id.slice(0, 8)}...`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant={getStatusBadgeVariant(order.status)}>
            {getStatusLabel(order.status)}
          </Badge>
          <Button 
            variant="outline"
            onClick={() => router.push(`/orders/${order.id}/edit`)}
          >
            <Edit className="mr-2 h-4 w-4" />
            编辑
          </Button>
          {/* 回退按钮 */}
          {getPreviousStatusAction() && (
            <Button 
              variant="outline"
              onClick={() => {
                const previousAction = getPreviousStatusAction()!
                setConfirmStatus({
                  label: previousAction.label,
                  status: previousAction.status,
                  warning:
                    order.status === 'completed'
                      ? '这将删除已生成的自动交易记录。'
                      : undefined,
                })
              }}
              disabled={updatingStatus}
            >
              {updatingStatus ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              {getPreviousStatusAction()!.label}
            </Button>
          )}
          {/* 前进按钮 */}
          {getNextStatusAction() && (
            <Button 
              onClick={() => {
                const nextAction = getNextStatusAction()
                // 羽毛球订单：直接更新状态，不打开对话框
                // 租赁订单：如果是「开始发货」，打开发货对话框
                if (!isBadminton && nextAction && nextAction.status === 'in_progress') {
                  setShippingDialogOpen(true)
                } else {
                  updateOrderStatus(nextAction!.status)
                }
              }}
              disabled={updatingStatus}
            >
              {updatingStatus ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              {getNextStatusAction()!.label}
            </Button>
          )}
          {canCheckin && (
            <Button onClick={() => setCheckinDialogOpen(true)}>
              <Camera className="mr-2 h-4 w-4" />
              收货
            </Button>
          )}
        </div>
      </div>

      {(() => {
        const timeline = getTimelineSteps()
        if (!timeline.steps.length) return null

        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">订单进度</CardTitle>
              <CardDescription>
                {timeline.cancelled ? '当前订单已取消（流程中止）' : '当前订单所处阶段'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 md:gap-4">
                {timeline.steps.map((step, index) => {
                  const done = index <= timeline.current && !timeline.cancelled
                  const isCurrent = index === timeline.current && !timeline.cancelled
                  return (
                    <div key={step.key} className="flex items-center flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            'inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium',
                            done ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30 text-muted-foreground'
                          )}
                        >
                          {index + 1}
                        </span>
                        <span className={cn('text-sm truncate', isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                          {step.label}
                        </span>
                      </div>
                      {index < timeline.steps.length - 1 && (
                        <div className={cn('mx-2 h-0.5 flex-1', done ? 'bg-primary/70' : 'bg-muted')} />
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* 订单项列表 / 羽毛球收支明细 */}
      {(() => {
        const badmintonLines = (order as any).badminton_order_lines as any[] | undefined

        if (isBadminton) {
          return (
            <Card>
              <CardHeader>
                <CardTitle>服务信息</CardTitle>
                <CardDescription>羽毛球副业订单详情</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-sm text-muted-foreground">服务类型</Label>
                    <p className="font-medium">{(order as any).service_type || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">地点</Label>
                    <p className="font-medium">{(order as any).location || '-'}</p>
                  </div>
                </div>
                {badmintonLines && badmintonLines.length > 0 && (
                  <div>
                    <Label className="text-sm text-muted-foreground mb-2 block">收支明细</Label>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>类型</TableHead>
                          <TableHead>类别</TableHead>
                          <TableHead>金额</TableHead>
                          <TableHead>备注</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {badmintonLines.map((line: any) => (
                          <TableRow key={line.id}>
                            <TableCell>
                              <Badge variant={line.line_type === 'income' ? 'success' : 'destructive'}>
                                {line.line_type === 'income' ? '收入' : '支出'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{line.category}</TableCell>
                            <TableCell className={cn('font-medium', line.line_type === 'income' ? 'text-green-600' : 'text-red-600')}>
                              {line.line_type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(Number(line.amount) || 0))}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{line.notes || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="mt-4 flex gap-4 text-sm">
                      <span className="text-muted-foreground">
                        收入合计：<span className="font-medium text-green-600">
                          {formatCurrency(
                            badmintonLines
                              .filter((l: any) => l.line_type === 'income')
                              .reduce((s: number, l: any) => s + (Math.abs(Number(l.amount)) || 0), 0)
                          )}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        支出合计：<span className="font-medium text-red-600">
                          {formatCurrency(
                            badmintonLines
                              .filter((l: any) => l.line_type === 'expense')
                              .reduce((s: number, l: any) => s + (Math.abs(Number(l.amount)) || 0), 0)
                          )}
                        </span>
                      </span>
                      <span className="font-medium">
                        净收入：{formatCurrency(order.total_amount)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        }

        return (
          <Card>
            <CardHeader>
              <CardTitle>订单项</CardTitle>
              <CardDescription>本订单包含的设备/配件，可点击行末编辑修改数量、日租金、押金、备注</CardDescription>
            </CardHeader>
            <CardContent>
              {order.order_items && order.order_items.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>设备名称</TableHead>
                      <TableHead>品类</TableHead>
                      <TableHead>日租金</TableHead>
                      <TableHead>数量</TableHead>
                      <TableHead>押金</TableHead>
                      <TableHead>小计</TableHead>
                      <TableHead>备注</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.order_items.map((item) => {
                      const isEditing = editingItemId === item.id
                      const isSaving = savingItemId === item.id
                      const itemNotes = item.notes
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {(item.item?.short_name?.trim() || item.item?.name) ?? '-'}
                            {item.item?.brand && item.item?.model && (
                              <div className="text-sm text-muted-foreground">
                                {item.item.brand} {item.item.model}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{item.item?.category?.name || '-'}</TableCell>
                          {isEditing ? (
                            <>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  className="w-24"
                                  value={draftItem.daily_rate}
                                  onChange={(e) => setDraftItem((d) => ({ ...d, daily_rate: Number(e.target.value) || 0 }))}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={1}
                                  className="w-16"
                                  value={draftItem.quantity}
                                  onChange={(e) => setDraftItem((d) => ({ ...d, quantity: Math.max(1, Number(e.target.value) || 1) }))}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  className="w-24"
                                  value={draftItem.deposit}
                                  onChange={(e) => setDraftItem((d) => ({ ...d, deposit: Number(e.target.value) || 0 }))}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{formatCurrency(item.subtotal)}</TableCell>
                              <TableCell>
                                <Input
                                  className="min-w-[80px]"
                                  value={draftItem.notes}
                                  onChange={(e) => setDraftItem((d) => ({ ...d, notes: e.target.value }))}
                                  placeholder="备注"
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    disabled={isSaving}
                                    onClick={async () => {
                                      setSavingItemId(item.id)
                                      try {
                                        const res = await fetch(`/api/orders/${orderId}/order-items/${item.id}`, {
                                          method: 'PATCH',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            quantity: draftItem.quantity,
                                            daily_rate: draftItem.daily_rate,
                                            deposit: draftItem.deposit,
                                            notes: draftItem.notes || null,
                                          }),
                                        })
                                        if (!res.ok) {
                                          const err = await res.json().catch(() => ({}))
                                          throw new Error((err as { error?: string }).error || '保存失败')
                                        }
                                        await mutateOrder()
                                        await revalidateDashboards()
                                        await revalidateOrdersLists()
                                        window.dispatchEvent(new CustomEvent('orderUpdated'))
                                        localStorage.setItem('orderUpdated', Date.now().toString())
                                        setEditingItemId(null)
                                      } catch (e) {
                                        toastError(e, '保存失败')
                                      } finally {
                                        setSavingItemId(null)
                                      }
                                    }}
                                  >
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingItemId(null)}
                                    disabled={isSaving}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell>{formatCurrency(item.daily_rate)}</TableCell>
                              <TableCell>{item.quantity}</TableCell>
                              <TableCell>{formatCurrency(item.deposit)}</TableCell>
                              <TableCell className="font-medium">{formatCurrency(item.subtotal)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{itemNotes ?? '-'}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" onClick={() => {
                                  setDraftItem({
                                    quantity: item.quantity,
                                    daily_rate: item.daily_rate,
                                    deposit: item.deposit,
                                    notes: itemNotes ?? '',
                                  })
                                  setEditingItemId(item.id)
                                }}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground">暂无订单项</p>
              )}
            </CardContent>
          </Card>
        )
      })()}

      <div className="grid gap-6 md:grid-cols-2">
        {(() => {
          const serviceDate = (order as any).service_date || order.start_date
          const startTime = (order as any).service_start_time
          const endTime = (order as any).service_end_time
          const timeRange = startTime && endTime ? ` ${String(startTime).slice(0, 5)}–${String(endTime).slice(0, 5)}` : ''

          if (isBadminton) {
            if (editingBlock === 'dates') {
              return (
                <>
                  <Card className="border-2 md:col-span-2">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <CalendarLucide className="h-5 w-5 text-blue-600" />
                        服务日期与时间段
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label>服务日期</Label>
                          <Input
                            type="date"
                            value={draftDates.service_date || ''}
                            onChange={(e) => setDraftDates((d) => ({ ...d, service_date: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>开始时间</Label>
                          <Input
                            type="time"
                            value={draftDates.service_start_time || ''}
                            onChange={(e) => setDraftDates((d) => ({ ...d, service_start_time: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>结束时间</Label>
                          <Input
                            type="time"
                            value={draftDates.service_end_time || ''}
                            onChange={(e) => setDraftDates((d) => ({ ...d, service_end_time: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={savingBlock === 'dates'}
                          onClick={async () => {
                            setSavingBlock('dates')
                            try {
                              const sd = draftDates.service_date || (order as any).service_date || order.start_date
                              await patchOrderFields({
                                service_date: sd,
                                service_start_time: draftDates.service_start_time || null,
                                service_end_time: draftDates.service_end_time || null,
                                start_date: sd,
                                end_date: sd,
                              })
                              setEditingBlock(null)
                            } catch (e) {
                              toastError(e, '保存失败')
                            } finally {
                              setSavingBlock(null)
                            }
                          }}
                        >
                          {savingBlock === 'dates' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                          保存
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingBlock(null)} disabled={savingBlock === 'dates'}>
                          <X className="h-4 w-4 mr-1" />
                          取消
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )
            }
            return (
              <>
                <Card className="border-2">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CalendarLucide className="h-5 w-5 text-blue-600" />
                      服务日期
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={startEditDates}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold mb-1">{formatDateShort(serviceDate)}</div>
                    {timeRange && <p className="text-sm text-muted-foreground">时间段：{timeRange}</p>}
                  </CardContent>
                </Card>
                <Card className="border-2">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Package className="h-5 w-5 text-orange-600" />
                      服务信息
                    </CardTitle>
                    {editingBlock !== 'badminton-service' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDraftBadmintonService({
                            service_type: (order as any).service_type || '',
                            location: (order as any).location || '',
                          })
                          setEditingBlock('badminton-service')
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {editingBlock === 'badminton-service' ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>服务类型</Label>
                          <Input
                            value={draftBadmintonService.service_type}
                            onChange={(e) => setDraftBadmintonService((d) => ({ ...d, service_type: e.target.value }))}
                            placeholder="如 教学、陪打"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>地点</Label>
                          <Input
                            value={draftBadmintonService.location}
                            onChange={(e) => setDraftBadmintonService((d) => ({ ...d, location: e.target.value }))}
                            placeholder="场地地点"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={savingBlock === 'badminton-service'}
                            onClick={async () => {
                              setSavingBlock('badminton-service')
                              try {
                                await patchOrderFields({
                                  service_type: draftBadmintonService.service_type || null,
                                  location: draftBadmintonService.location || null,
                                })
                                setEditingBlock(null)
                              } catch (e) {
                                toastError(e, '保存失败')
                              } finally {
                                setSavingBlock(null)
                              }
                            }}
                          >
                            {savingBlock === 'badminton-service' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                            保存
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingBlock(null)} disabled={savingBlock === 'badminton-service'}>
                            <X className="h-4 w-4 mr-1" />
                            取消
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">服务类型</Label>
                          <p className="font-medium">{(order as any).service_type || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">地点</Label>
                          <p className="font-medium">{(order as any).location || '-'}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )
          }

          const daysUntilStart = getDaysUntilStart(order.start_date)
          const daysUntilEnd = getDaysUntilEnd(order.end_date)
          const isNotShipped = (order.status === 'pending' || order.status === 'confirmed') && daysUntilStart >= 0
          const isShipped = order.status === 'in_progress' || daysUntilStart < 0
          const isInProgress = order.status === 'in_progress' && daysUntilStart < 0 && daysUntilEnd >= 0
          const isCompleted = order.status === 'completed' || order.status === 'cancelled' || daysUntilEnd < 0

          if (editingBlock === 'dates') {
            return (
              <>
                <Card className={cn('border-2 md:col-span-2')}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Truck className="h-5 w-5 text-blue-600" />
                      发货与归还日期
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>发货日期</Label>
                        <Input
                          type="date"
                          value={draftDates.start_date || ''}
                          onChange={(e) => setDraftDates((d) => ({ ...d, start_date: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>归还日期</Label>
                        <Input
                          type="date"
                          value={draftDates.end_date || ''}
                          onChange={(e) => setDraftDates((d) => ({ ...d, end_date: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={savingBlock === 'dates'}
                        onClick={async () => {
                          setSavingBlock('dates')
                          try {
                            await patchOrderFields({
                              start_date: draftDates.start_date || order.start_date,
                              end_date: draftDates.end_date || order.end_date,
                            })
                            setEditingBlock(null)
                          } catch (e) {
                            toastError(e, '保存失败')
                          } finally {
                            setSavingBlock(null)
                          }
                        }}
                      >
                        {savingBlock === 'dates' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                        保存
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingBlock(null)} disabled={savingBlock === 'dates'}>
                        <X className="h-4 w-4 mr-1" />
                        取消
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )
          }

          return (
            <>
              <Card
                className={cn(
                  'border-2 transition-colors',
                  isNotShipped && daysUntilStart <= 3 && 'border-blue-500 bg-blue-50/50',
                  isShipped && 'border-green-500 bg-green-50/50',
                  isNotShipped && daysUntilStart > 3 && 'border-border',
                  (order.status === 'completed' || order.status === 'cancelled') && 'border-gray-300 bg-gray-50'
                )}
              >
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Truck className="h-5 w-5 text-blue-600" />
                    发货日期
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={startEditDates}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold mb-1">{formatDateShort(order.start_date)}</div>
                  {isNotShipped ? (
                    <p className="text-sm text-blue-700">
                      {daysUntilStart === 0 ? '今天需要发货' : `还有 ${daysUntilStart} 天开始`}
                    </p>
                  ) : isShipped ? (
                    <p className="text-sm text-green-600">已发货</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {order.status === 'completed' ? '已完成' : order.status === 'cancelled' ? '已取消' : '已开始'}
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card
                className={cn(
                  'border-2 transition-colors',
                  isInProgress && daysUntilEnd <= 3 && 'border-orange-500 bg-orange-50/50',
                  isCompleted && 'border-gray-300 bg-gray-50',
                  isInProgress && daysUntilEnd > 3 && 'border-border',
                  isNotShipped && 'border-border'
                )}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="h-5 w-5 text-orange-600" />
                    归还日期
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold mb-1">{formatDateShort(order.end_date)}</div>
                  {isInProgress ? (
                    <p className={cn('text-sm', daysUntilEnd <= 2 ? 'text-red-600 font-semibold' : 'text-orange-700')}>
                      {daysUntilEnd === 0 ? '今天到期，需要催还' : `还有 ${daysUntilEnd} 天到期`}
                    </p>
                  ) : isNotShipped ? (
                    <p className="text-sm text-muted-foreground">租赁期限结束日期</p>
                  ) : isCompleted ? (
                    <p className="text-sm text-muted-foreground">
                      {order.status === 'completed' ? '已完成' : order.status === 'cancelled' ? '已取消' : '已结束'}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">未开始</p>
                  )}
                </CardContent>
              </Card>
            </>
          )
        })()}

        {/* 订单金额汇总 */}
        <Card>
          <CardHeader>
            <CardTitle>订单信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">金额汇总</p>
                {isBadminton ? (
                  <p className="font-medium">
                    净收入: {formatCurrency(order.total_amount)}
                  </p>
                ) : (
                  <>
                    <p className="font-medium">
                      总租金: {formatCurrency(order.total_amount)}
                    </p>
                    {order.total_shipping_cost > 0 && (
                      <p className="text-sm text-muted-foreground">
                        物流费用: {formatCurrency(order.total_shipping_cost)}
                      </p>
                    )}
                    {order.third_party_rentals && order.third_party_rentals.length > 0 && (() => {
                      const rentalCostSum = order.third_party_rentals.reduce((sum, r) => sum + (r.rental_cost || 0), 0)
                      const supplierDepositSum = order.third_party_rentals.reduce((sum, r) => sum + (r.deposit || 0), 0)
                      if (rentalCostSum <= 0 && supplierDepositSum <= 0) return null
                      return (
                        <>
                          {rentalCostSum > 0 && (
                            <p className="text-sm text-muted-foreground">
                              第三方转租成本: {formatCurrency(rentalCostSum)}
                            </p>
                          )}
                          {supplierDepositSum > 0 && (
                            <p className="text-sm text-muted-foreground">
                              付供应商押金（可退）: {formatCurrency(supplierDepositSum)}
                            </p>
                          )}
                        </>
                      )
                    })()}
                    {order.total_deposit > 0 && (
                      <p className="text-sm">
                        总押金（客户）: {formatCurrency(order.total_deposit)}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 客户信息 + 备注（就地编辑） */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>客户信息</CardTitle>
            {editingBlock !== 'customer' && (
              <Button variant="ghost" size="sm" onClick={startEditCustomer}>
                <Pencil className="h-4 w-4 mr-1" />
                编辑
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {editingBlock === 'customer' ? (
              <>
                <div className="space-y-2">
                  <Label>姓名</Label>
                  <Input
                    value={draftCustomer.customer_name}
                    onChange={(e) => setDraftCustomer((d) => ({ ...d, customer_name: e.target.value }))}
                    placeholder="客户姓名"
                  />
                </div>
                <div className="space-y-2">
                  <Label>联系电话</Label>
                  <Input
                    value={draftCustomer.customer_phone}
                    onChange={(e) => setDraftCustomer((d) => ({ ...d, customer_phone: e.target.value }))}
                    placeholder="手机号"
                  />
                </div>
                <div className="space-y-2">
                  <Label>电子邮箱</Label>
                  <Input
                    type="email"
                    value={draftCustomer.customer_email}
                    onChange={(e) => setDraftCustomer((d) => ({ ...d, customer_email: e.target.value }))}
                    placeholder="选填"
                  />
                </div>
                {!isBadminton && (
                  <div className="space-y-2">
                    <Label>地址</Label>
                    <Input
                      value={draftCustomer.customer_address}
                      onChange={(e) => setDraftCustomer((d) => ({ ...d, customer_address: e.target.value }))}
                      placeholder="选填"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>订单备注</Label>
                  <Textarea
                    value={draftCustomer.notes}
                    onChange={(e) => setDraftCustomer((d) => ({ ...d, notes: e.target.value }))}
                    placeholder="选填"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={savingBlock === 'customer'}
                    onClick={async () => {
                      setSavingBlock('customer')
                      try {
                        await patchOrderFields({
                          customer_name: draftCustomer.customer_name,
                          customer_phone: draftCustomer.customer_phone || null,
                          customer_email: draftCustomer.customer_email || null,
                          customer_address: draftCustomer.customer_address || null,
                          notes: draftCustomer.notes || null,
                        })
                        setEditingBlock(null)
                      } catch (e) {
                        toastError(e, '保存失败')
                      } finally {
                        setSavingBlock(null)
                      }
                    }}
                  >
                    {savingBlock === 'customer' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                    保存
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingBlock(null)}
                    disabled={savingBlock === 'customer'}
                  >
                    <X className="h-4 w-4 mr-1" />
                    取消
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">姓名</p>
                    <p className="font-medium">{order.customer_name || '-'}</p>
                  </div>
                </div>
                {order.customer_phone && (
                  <div>
                    <p className="text-sm text-muted-foreground">联系电话</p>
                    <p className="font-medium">{order.customer_phone}</p>
                  </div>
                )}
                {order.customer_email && (
                  <div>
                    <p className="text-sm text-muted-foreground">电子邮箱</p>
                    <p className="font-medium">{order.customer_email}</p>
                  </div>
                )}
                {!isBadminton && order.customer_address && (
                  <div>
                    <p className="text-sm text-muted-foreground">地址</p>
                    <p className="font-medium">{order.customer_address}</p>
                  </div>
                )}
                {order.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">备注</p>
                    <p className="font-medium">{order.notes}</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>


        {/* 第三方租赁（就地编辑） */}
        {order.third_party_rentals && order.third_party_rentals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                第三方租赁
              </CardTitle>
              <CardDescription>可点击行内编辑修改游戏名、金额、平台、供应商等</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.third_party_rentals.map((rental) => {
                const isEditing = editingRentalId === rental.id
                const isSaving = savingRentalId === rental.id
                return (
                  <div key={rental.id} className="p-3 border rounded-lg space-y-2">
                    {isEditing ? (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>游戏名称</Label>
                            <Input
                              value={draftRental.game_name}
                              onChange={(e) => setDraftRental((d) => ({ ...d, game_name: e.target.value }))}
                              placeholder="游戏名称"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>租赁成本</Label>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              value={draftRental.rental_cost}
                              onChange={(e) => setDraftRental((d) => ({ ...d, rental_cost: Number(e.target.value) || 0 }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>押金（付给供应商）</Label>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              value={draftRental.deposit}
                              onChange={(e) => setDraftRental((d) => ({ ...d, deposit: Number(e.target.value) || 0 }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>平台</Label>
                            <Input
                              value={draftRental.platform}
                              onChange={(e) => setDraftRental((d) => ({ ...d, platform: e.target.value }))}
                              placeholder="如 PS5"
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label>供应商</Label>
                            <Input
                              value={draftRental.provider}
                              onChange={(e) => setDraftRental((d) => ({ ...d, provider: e.target.value }))}
                              placeholder="如 taobao"
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label>第三方订单号</Label>
                            <Input
                              value={draftRental.provider_order_id}
                              onChange={(e) => setDraftRental((d) => ({ ...d, provider_order_id: e.target.value }))}
                              placeholder="选填"
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label>备注</Label>
                            <Input
                              value={draftRental.notes}
                              onChange={(e) => setDraftRental((d) => ({ ...d, notes: e.target.value }))}
                              placeholder="选填"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            disabled={isSaving}
                            onClick={async () => {
                              setSavingRentalId(rental.id)
                              try {
                                const res = await fetch(`/api/orders/${orderId}/third-party-rentals/${rental.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    game_name: draftRental.game_name,
                                    rental_cost: draftRental.rental_cost,
                                    deposit: draftRental.deposit,
                                    platform: draftRental.platform || null,
                                    provider: draftRental.provider || null,
                                    provider_order_id: draftRental.provider_order_id || null,
                                    notes: draftRental.notes || null,
                                  }),
                                })
                                if (!res.ok) {
                                  const err = await res.json().catch(() => ({}))
                                  throw new Error((err as { error?: string }).error || '保存失败')
                                }
                                await mutateOrder()
                                await revalidateDashboards()
                                await revalidateOrdersLists()
                                window.dispatchEvent(new CustomEvent('orderUpdated'))
                                localStorage.setItem('orderUpdated', Date.now().toString())
                                setEditingRentalId(null)
                              } catch (e) {
                                toastError(e, '保存失败')
                              } finally {
                                setSavingRentalId(null)
                              }
                            }}
                          >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                            保存
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingRentalId(null)} disabled={isSaving}>
                            <X className="h-4 w-4 mr-1" />
                            取消
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{rental.game_name}</p>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <p className="font-medium">{formatCurrency(rental.rental_cost)}</p>
                              {rental.deposit > 0 && (
                                <p className="text-sm text-muted-foreground">
                                  付供应商押金: {formatCurrency(rental.deposit)}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDraftRental({
                                  game_name: rental.game_name || '',
                                  rental_cost: rental.rental_cost ?? 0,
                                  deposit: rental.deposit ?? 0,
                                  platform: rental.platform ?? '',
                                  provider: rental.provider ?? '',
                                  provider_order_id: rental.provider_order_id ?? '',
                                  notes: rental.notes ?? '',
                                })
                                setEditingRentalId(rental.id)
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {rental.platform && <p>平台: {rental.platform}</p>}
                          {rental.provider && <p>供应商: {rental.provider === 'taobao' ? '淘宝' : rental.provider}</p>}
                          {rental.provider_order_id && <p>第三方订单号: {rental.provider_order_id}</p>}
                          {rental.notes && <p>备注: {rental.notes}</p>}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* 物流费用（就地编辑） */}
        {order.shipping_fees && order.shipping_fees.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                物流费用
              </CardTitle>
              <CardDescription>可点击行末编辑修改类型、物流公司、单号、金额、备注</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>类型</TableHead>
                    <TableHead>物流公司</TableHead>
                    <TableHead>快递单号</TableHead>
                    <TableHead>金额</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.shipping_fees.map((fee) => {
                    const isEditing = editingFeeId === fee.id
                    const isSaving = savingFeeId === fee.id
                    return (
                      <TableRow key={fee.id}>
                        {isEditing ? (
                          <>
                            <TableCell>
                              <Select
                                value={draftFee.shipping_type}
                                onValueChange={(v: 'outbound' | 'return' | 'pickup') => setDraftFee((d) => ({ ...d, shipping_type: v }))}
                              >
                                <SelectTrigger className="w-[100px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="outbound">发货</SelectItem>
                                  <SelectItem value="return">退货</SelectItem>
                                  <SelectItem value="pickup">自提</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                className="w-28"
                                value={draftFee.shipping_company}
                                onChange={(e) => setDraftFee((d) => ({ ...d, shipping_company: e.target.value }))}
                                placeholder="物流公司"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="w-32 font-mono text-sm"
                                value={draftFee.tracking_number}
                                onChange={(e) => setDraftFee((d) => ({ ...d, tracking_number: e.target.value }))}
                                placeholder="单号"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                className="w-24"
                                value={draftFee.amount}
                                onChange={(e) => setDraftFee((d) => ({ ...d, amount: Number(e.target.value) || 0 }))}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="min-w-[80px]"
                                value={draftFee.notes}
                                onChange={(e) => setDraftFee((d) => ({ ...d, notes: e.target.value }))}
                                placeholder="备注"
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  disabled={isSaving}
                                  onClick={async () => {
                                    setSavingFeeId(fee.id)
                                    try {
                                      const res = await fetch(`/api/orders/${orderId}/shipping-fees/${fee.id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          shipping_type: draftFee.shipping_type,
                                          shipping_company: draftFee.shipping_company || null,
                                          tracking_number: draftFee.tracking_number || null,
                                          amount: draftFee.amount,
                                          notes: draftFee.notes || null,
                                        }),
                                      })
                                      if (!res.ok) {
                                        const err = await res.json().catch(() => ({}))
                                        throw new Error((err as { error?: string }).error || '保存失败')
                                      }
                                      await mutateOrder()
                                      await revalidateDashboards()
                                      await revalidateOrdersLists()
                                      window.dispatchEvent(new CustomEvent('orderUpdated'))
                                      localStorage.setItem('orderUpdated', Date.now().toString())
                                      setEditingFeeId(null)
                                    } catch (e) {
                                      toastError(e, '保存失败')
                                    } finally {
                                      setSavingFeeId(null)
                                    }
                                  }}
                                >
                                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingFeeId(null)} disabled={isSaving}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell>
                              {fee.shipping_type === 'outbound' ? '发货' :
                               fee.shipping_type === 'return' ? '退货' : '自提'}
                            </TableCell>
                            <TableCell>{fee.shipping_company || '-'}</TableCell>
                            <TableCell className="font-mono text-sm">{fee.tracking_number || '-'}</TableCell>
                            <TableCell className="font-medium">{formatCurrency(fee.amount)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{fee.notes || '-'}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setDraftFee({
                                    shipping_type: fee.shipping_type || 'outbound',
                                    shipping_company: fee.shipping_company ?? '',
                                    tracking_number: fee.tracking_number ?? '',
                                    amount: fee.amount ?? 0,
                                    notes: fee.notes ?? '',
                                  })
                                  setEditingFeeId(fee.id)
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* 序列号照片 */}
        {(order.checkout_snapshot_url || order.checkin_snapshot_url) && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>序列号核对</CardTitle>
              <CardDescription>设备序列号照片记录</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {order.checkout_snapshot_url && (
                  <div>
                    <p className="text-sm font-medium mb-2">发货时序列号照片</p>
                    <div className="relative w-full h-64 border rounded-lg overflow-hidden bg-muted">
                      <Image
                        src={order.checkout_snapshot_url}
                        alt="发货时序列号"
                        fill
                        className="object-contain"
                      />
                    </div>
                  </div>
                )}
                {order.checkin_snapshot_url && (
                  <div>
                    <p className="text-sm font-medium mb-2">收货时序列号照片</p>
                    <div className="relative w-full h-64 border rounded-lg overflow-hidden bg-muted">
                      <Image
                        src={order.checkin_snapshot_url}
                        alt="收货时序列号"
                        fill
                        className="object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 发货对话框 - 仅租赁订单 */}
      {!isBadminton && (
        <ShippingDialog
          order={order}
          open={shippingDialogOpen}
          onOpenChange={setShippingDialogOpen}
          onSuccess={async () => {
            await mutateOrder()
            await revalidateDashboards()
            await revalidateOrdersLists()
            window.dispatchEvent(new CustomEvent('orderUpdated'))
            localStorage.setItem('orderUpdated', Date.now().toString())
          }}
        />
      )}

      {/* 收货对话框 - 仅租赁订单 */}
      {!isBadminton && (
        <CheckinDialog
          order={order}
          open={checkinDialogOpen}
          onOpenChange={setCheckinDialogOpen}
          onSuccess={async () => {
            await mutateOrder()
            await revalidateDashboards()
            await revalidateOrdersLists()
            window.dispatchEvent(new CustomEvent('orderUpdated'))
            localStorage.setItem('orderUpdated', Date.now().toString())
          }}
        />
      )}

      <AlertDialog open={!!confirmStatus} onOpenChange={(open) => !open && !updatingStatus && setConfirmStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认操作</AlertDialogTitle>
            <AlertDialogDescription>
              确定要执行「{confirmStatus?.label}」吗？
              {confirmStatus?.warning ? <span className="block mt-2 text-destructive">{confirmStatus.warning}</span> : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updatingStatus}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={updatingStatus}
              onClick={() => {
                if (!confirmStatus) return
                void updateOrderStatus(confirmStatus.status)
                setConfirmStatus(null)
              }}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
