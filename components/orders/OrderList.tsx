'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Calendar, Plus, Trash2, DollarSign, Shield, Package, Aperture, Camera, Gamepad2, Joystick, Headphones, Monitor, Smartphone, Mic, Truck, Loader2, RotateCcw, Sparkles, TrendingUp, MapPin } from 'lucide-react'
import type { Order } from '@/lib/types/database'
import Link from 'next/link'
import { formatCurrency, formatDateShort, getDaysUntilStart, getDaysUntilEnd, getDateRangeForPreset } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { getSiliconflowApiKey } from '@/lib/settings/storageKeys'
import { ShippingDialog } from './ShippingDialog'
import { apiFetch, ApiFetchError } from '@/lib/api/fetcher'

type ShipSuggestion = {
  recommendShipBy: string
  suggestedExpress: string
  reason?: string
  distanceCategory?: string
  sfDays?: number
  standardDays?: number
}

type OrderTypeTab = 'all' | 'rental' | 'badminton'
type DatePreset = 'all' | 'week' | 'month' | 'last_month' | 'next_month' | 'year'

export type OrderListModule = 'hub' | 'rental' | 'badminton'

type OrderListProps = {
  /** hub：全部/租赁/羽毛球可切换；rental/badminton：仅该模块列表 */
  module?: OrderListModule
}

export function OrderList({ module = 'hub' }: OrderListProps) {
  const [orderTypeTab, setOrderTypeTab] = useState<OrderTypeTab>('all')
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [shippingDialogOrder, setShippingDialogOrder] = useState<Order | null>(null)
  const [quickCompleteOrder, setQuickCompleteOrder] = useState<Order | null>(null)
  const [quickCompleting, setQuickCompleting] = useState(false)
  const [rollbackOrder, setRollbackOrder] = useState<Order | null>(null)
  const [rollingBack, setRollingBack] = useState(false)
  // AI 推荐发货：订单 ID -> 推荐结果（在列表直接展示）
  const [shipSuggestions, setShipSuggestions] = useState<Record<string, ShipSuggestion>>({})
  const [shipSuggestionLoadingId, setShipSuggestionLoadingId] = useState<string | null>(null)

  const { mutate: globalMutate } = useSWRConfig()

  const effectiveOrderTypeTab: OrderTypeTab =
    module === 'rental' ? 'rental' : module === 'badminton' ? 'badminton' : orderTypeTab

  const newOrderHref =
    module === 'rental' ? '/rental/orders/new' : module === 'badminton' ? '/badminton/orders/new' : '/orders/new'

  const ordersKey = useMemo(() => {
    const params = new URLSearchParams()
    params.set('orderType', effectiveOrderTypeTab)
    if (datePreset !== 'all') {
      const range = getDateRangeForPreset(datePreset)
      params.set('startDate', range.startDate)
      params.set('endDate', range.endDate)
    }
    return `/api/orders?${params.toString()}`
  }, [effectiveOrderTypeTab, datePreset])

  const {
    data: orders = [],
    isLoading: loading,
    mutate: mutateOrders,
  } = useSWR<Order[]>(ordersKey, (key) => apiFetch<Order[]>(key), {
    keepPreviousData: true,
  })

  // 根据品类返回对应的图标
  const getCategoryIcon = (categoryName: string | undefined | null) => {
    if (!categoryName) return null
    
    const name = categoryName.toLowerCase()
    
    // 相机相关（优先匹配，避免和镜头混淆）
    if (name.includes('相机') || name.includes('camera') || name.includes('摄像机')) {
      return <Camera className="h-5 w-5 text-blue-500" />
    }
    
    // 镜头相关
    if (name.includes('镜头') || name.includes('lens')) {
      return <Aperture className="h-5 w-5 text-blue-500" />
    }
    
    // 麦克风相关（优先匹配）
    if (name.includes('麦克风') || name.includes('mic') || name.includes('microphone') || name.includes('音频') || name.includes('audio')) {
      return <Mic className="h-5 w-5 text-purple-500" />
    }
    
    // 游戏主机相关
    if (name.includes('ps5') || name.includes('playstation') || name.includes('主机') || name.includes('游戏机') || name.includes('switch')) {
      return <Gamepad2 className="h-5 w-5 text-blue-600" />
    }
    
    // 游戏账号相关
    if (name.includes('游戏账号') || name.includes('数字版游戏')) {
      return <Joystick className="h-5 w-5 text-purple-500" />
    }
    
    // 耳机相关
    if (name.includes('耳机') || name.includes('headphone') || name.includes('earphone')) {
      return <Headphones className="h-5 w-5 text-green-500" />
    }
    
    // 显示器相关
    if (name.includes('显示器') || name.includes('monitor') || name.includes('屏幕')) {
      return <Monitor className="h-5 w-5 text-orange-500" />
    }
    
    // 手机相关
    if (name.includes('手机') || name.includes('phone') || name.includes('mobile')) {
      return <Smartphone className="h-5 w-5 text-pink-500" />
    }
    
    // 默认图标
    return <Package className="h-4 w-4 text-gray-500" />
  }

  // 对订单进行排序：
  // 1) 待发货（pending/confirmed）最优先
  // 2) 进行中（in_progress）其次：按租赁到期日（end_date）升序，越早到期越靠前，便于催还
  // 3) 已完成/已取消最后
  // 待发货组内按创建时间倒序；已完成组内按更新时间倒序
  const sortedOrders = useMemo(() => {
    const waitingShipmentOrders = orders.filter(
      (o) => o.status === 'pending' || o.status === 'confirmed'
    )
    const inProgressOrders = orders.filter((o) => o.status === 'in_progress')
    const completedOrders = orders.filter(
      (o) => o.status === 'completed' || o.status === 'cancelled'
    )

    const sortByCreatedAtDesc = (a: Order, b: Order) => {
      const timeA = new Date(a.created_at).getTime()
      const timeB = new Date(b.created_at).getTime()
      return timeB - timeA
    }

    const sortByUpdatedAtDesc = (a: Order, b: Order) => {
      const timeA = new Date(a.updated_at).getTime()
      const timeB = new Date(b.updated_at).getTime()
      return timeB - timeA
    }

    /** 待收货：租赁用 end_date；羽毛球用 service_date；无日期排最后 */
    const sortInProgressByReturnDateAsc = (a: Order, b: Order) => {
      const endKey = (o: Order) => {
        const raw =
          o.order_type === 'badminton'
            ? (o.service_date ?? o.end_date ?? '')
            : (o.end_date ?? '')
        const day = String(raw).split('T')[0]
        const t = new Date(day).getTime()
        return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY
      }
      const diff = endKey(a) - endKey(b)
      if (diff !== 0) return diff
      return sortByCreatedAtDesc(a, b)
    }

    waitingShipmentOrders.sort(sortByCreatedAtDesc)
    inProgressOrders.sort(sortInProgressByReturnDateAsc)
    completedOrders.sort(sortByUpdatedAtDesc)

    return [...waitingShipmentOrders, ...inProgressOrders, ...completedOrders]
  }, [orders])

  // 计算统计信息 - 优化版本，减少多次 filter
  const stats = useMemo(() => {
    let totalAmount = 0
    let totalDeposit = 0  // 只统计未退还的押金（进行中+已确认）
    let returnedDeposit = 0  // 已退还的押金（已完成+已取消）
    let pendingAmount = 0   // 待发货/待确认
    let inProgressAmount = 0
    let completedAmount = 0
    let cancelledAmount = 0
    let totalCost = 0  // 物流 + 第三方租赁等成本
    let totalIncome = 0    // 订单金额视为收入

    const statusCounts = {
      pending: 0,
      confirmed: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    }

    orders.forEach(order => {
      const amount = order.total_amount || 0
      const deposit = order.total_deposit || 0
      const status = order.status

      totalAmount += amount
      totalIncome += amount

      const shipping = Number(order.total_shipping_cost) || 0
      // 利润成本：第三方只计实际租赁成本；付供应商押金可退，不计入利润
      const thirdPartyCost = (order.third_party_rentals || []).reduce(
        (sum, r) => sum + (r.rental_cost ?? 0),
        0
      )
      totalCost += shipping + thirdPartyCost

      if (status === 'in_progress' || status === 'confirmed') {
        totalDeposit += deposit
      } else if (status === 'completed' || status === 'cancelled') {
        returnedDeposit += deposit
      }

      if (statusCounts.hasOwnProperty(status)) {
        statusCounts[status as keyof typeof statusCounts]++
      }

      if (status === 'pending' || status === 'confirmed') {
        pendingAmount += amount
      } else if (status === 'in_progress') {
        inProgressAmount += amount
      } else if (status === 'completed') {
        completedAmount += amount
      } else if (status === 'cancelled') {
        cancelledAmount += amount
      }
    })

    const profit = totalIncome - totalCost

    return {
      totalAmount,
      totalDeposit,
      returnedDeposit,
      statusCounts,
      pendingAmount,
      inProgressAmount,
      completedAmount,
      cancelledAmount,
      totalOrders: orders.length,
      totalIncome,
      totalCost,
      profit,
    }
  }, [orders])

  // 监听订单更新事件，强制同步并刷新列表（如从订单详情返回、跨标签页更新等）
  useEffect(() => {
    const handleOrderUpdated = async () => {
      await mutateOrders()
    }
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'orderUpdated') handleOrderUpdated()
    }
    window.addEventListener('orderUpdated', handleOrderUpdated)
    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('orderUpdated', handleOrderUpdated)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [mutateOrders])

  const toastError = useCallback((err: unknown, fallback: string) => {
    const message = err instanceof ApiFetchError ? err.message : err instanceof Error ? err.message : fallback
    const code = err instanceof ApiFetchError ? err.code : undefined
    toast.error(message, code ? { description: code } : undefined)
  }, [])

  const revalidateDashboards = useCallback(async () => {
    // 交易统计、资产统计等看板：静默刷新（不影响当前列表交互）
    await globalMutate((key) => typeof key === 'string' && key.startsWith('/api/transactions/stats'))
    await globalMutate((key) => typeof key === 'string' && key.startsWith('/api/items/assets-value'))
  }, [globalMutate])

  const handleDelete = useCallback(async () => {
    if (!orderToDelete) return

    setDeleting(true)
    try {
      await mutateOrders(
        async (current) => {
          await apiFetch(`/api/orders?id=${orderToDelete.id}`, {
            method: 'DELETE',
          })
          return (current || []).filter((o) => o.id !== orderToDelete.id)
        },
        {
          optimisticData: (current) => (current || []).filter((o) => o.id !== orderToDelete.id),
          rollbackOnError: true,
          revalidate: true,
          populateCache: true,
        }
      )

      setDeleteDialogOpen(false)
      setOrderToDelete(null)

      await revalidateDashboards()

      // 通知其他页面/标签页刷新
      window.dispatchEvent(new CustomEvent('orderUpdated'))
      localStorage.setItem('orderUpdated', Date.now().toString())
    } catch (error) {
      console.error('Failed to delete order:', error)
      toastError(error, '删除失败，请重试')
    } finally {
      setDeleting(false)
    }
  }, [orderToDelete, mutateOrders, toastError, revalidateDashboards])

  const patchOrderStatus = useCallback(
    async (orderId: string, status: string) => {
      await apiFetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
    },
    []
  )

  const handleQuickComplete = useCallback(async () => {
    if (!quickCompleteOrder) return
    setQuickCompleting(true)
    try {
      await mutateOrders(
        async (current) => {
          await patchOrderStatus(quickCompleteOrder.id, 'completed')
          return (current || []).map((o) => (o.id === quickCompleteOrder.id ? ({ ...o, status: 'completed' } as Order) : o))
        },
        {
          optimisticData: (current) =>
            (current || []).map((o) => (o.id === quickCompleteOrder.id ? ({ ...o, status: 'completed' } as Order) : o)),
          rollbackOnError: true,
          revalidate: true,
          populateCache: true,
        }
      )
      setQuickCompleteOrder(null)
    } catch (error) {
      console.error('Quick complete failed:', error)
      toastError(error, '收货失败，请重试')
    } finally {
      setQuickCompleting(false)
      await revalidateDashboards()
      window.dispatchEvent(new CustomEvent('orderUpdated'))
      localStorage.setItem('orderUpdated', Date.now().toString())
    }
  }, [quickCompleteOrder, mutateOrders, patchOrderStatus, toastError, revalidateDashboards])

  const handleRollback = useCallback(async () => {
    if (!rollbackOrder) return
    setRollingBack(true)
    try {
      await mutateOrders(
        async (current) => {
          await patchOrderStatus(rollbackOrder.id, 'in_progress')
          return (current || []).map((o) => (o.id === rollbackOrder.id ? ({ ...o, status: 'in_progress' } as Order) : o))
        },
        {
          optimisticData: (current) =>
            (current || []).map((o) => (o.id === rollbackOrder.id ? ({ ...o, status: 'in_progress' } as Order) : o)),
          rollbackOnError: true,
          revalidate: true,
          populateCache: true,
        }
      )
      setRollbackOrder(null)
    } catch (error) {
      console.error('Rollback failed:', error)
      toastError(error, '回退失败，请重试')
    } finally {
      setRollingBack(false)
      await revalidateDashboards()
      window.dispatchEvent(new CustomEvent('orderUpdated'))
      localStorage.setItem('orderUpdated', Date.now().toString())
    }
  }, [rollbackOrder, mutateOrders, patchOrderStatus, toastError, revalidateDashboards])

  const handleShippingSuccess = useCallback(async () => {
    setShippingDialogOrder(null)
    await mutateOrders()
    await revalidateDashboards()
    window.dispatchEvent(new CustomEvent('orderUpdated'))
    localStorage.setItem('orderUpdated', Date.now().toString())
  }, [mutateOrders, revalidateDashboards])

  const fetchShipSuggestion = useCallback(async (order: Order) => {
    const address = order.customer_address?.trim()
    if (!address) return
    setShipSuggestionLoadingId(order.id)
    try {
      const apiKey = getSiliconflowApiKey()
      const res = await fetch('/api/ai/suggest-ship-date', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'X-SiliconFlow-Api-Key': apiKey } : {}),
        },
        body: JSON.stringify({
          origin: '上海市',
          destinationAddress: address,
          startDate: order.start_date,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '获取推荐失败')
      setShipSuggestions((prev) => ({ ...prev, [order.id]: data }))
    } catch (e) {
      toastError(e, '获取推荐失败')
    } finally {
      setShipSuggestionLoadingId(null)
    }
  }, [toastError])

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending':
      case 'confirmed':
        return 'secondary'
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

  const getStatusLabel = (status: string, isBadminton = false) => {
    if (isBadminton) {
      const badmintonLabels: Record<string, string> = {
        pending: '待上课',
        confirmed: '待上课', // 兼容历史订单
        in_progress: '进行中',
        completed: '已完成',
        cancelled: '已取消',
      }
      return badmintonLabels[status] || status
    }

    const rentalLabels: Record<string, string> = {
      pending: '待发货',
      confirmed: '待发货', // 兼容历史订单
      in_progress: '待收货',
      completed: '已完成',
      cancelled: '已取消',
    }
    return rentalLabels[status] || status
  }

  const isBadmintonOnlyView = effectiveOrderTypeTab === 'badminton'

  // 整行背景色：按状态区分（颜色更明显）
  const getRowBackgroundClass = (status: string, isUrgent: boolean) => {
    // 悬停不改变背景，仅用左侧主色边框提示当前行
    const hoverHint = 'border-l-4 border-l-transparent hover:border-l-primary/80'
    if (isUrgent) return 'bg-orange-200/90 hover:!bg-orange-200/90 ' + hoverHint
    switch (status) {
      case 'pending':
      case 'confirmed':
        return 'bg-blue-100 hover:!bg-blue-100 ' + hoverHint
      case 'in_progress':
        return 'bg-amber-100 hover:!bg-amber-100 ' + hoverHint
      case 'completed':
        return 'bg-green-100 hover:!bg-green-100 ' + hoverHint
      case 'cancelled':
        return 'bg-slate-200/80 hover:!bg-slate-200/80 ' + hoverHint
      default:
        return hoverHint
    }
  }

  const getStatusBadgeClassName = (status: string) => {
    switch (status) {
      case 'pending':
      case 'confirmed':
        return 'bg-blue-200 text-blue-900 border-blue-300'
      case 'in_progress':
        return 'bg-amber-200 text-amber-900 border-amber-300'
      default:
        return ''
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {module === 'rental' ? '租赁订单' : module === 'badminton' ? '羽毛球副业订单' : '全部订单'}
          </h2>
          <p className="text-muted-foreground">
            {module === 'rental'
              ? '设备租赁、游戏账号等'
              : module === 'badminton'
                ? '教学、陪打、比赛、活动'
                : '租赁与羽毛球订单汇总；日常可从导航进入各业务模块'}
          </p>
          {module === 'rental' && (
            <p className="mt-1 text-sm text-muted-foreground">
              <Link href="/badminton/orders" className="underline underline-offset-2 hover:text-foreground">
                羽毛球订单
              </Link>
              <span className="mx-2">·</span>
              <Link href="/orders" className="underline underline-offset-2 hover:text-foreground">
                全部订单
              </Link>
            </p>
          )}
          {module === 'badminton' && (
            <p className="mt-1 text-sm text-muted-foreground">
              <Link href="/rental/orders" className="underline underline-offset-2 hover:text-foreground">
                租赁订单
              </Link>
              <span className="mx-2">·</span>
              <Link href="/orders" className="underline underline-offset-2 hover:text-foreground">
                全部订单
              </Link>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {module === 'hub' && (
            <div className="flex rounded-lg border bg-muted/50 p-0.5">
              {(['all', 'rental', 'badminton'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setOrderTypeTab(tab)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    orderTypeTab === tab ? 'bg-background shadow' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab === 'all' ? '全部' : tab === 'rental' ? '租赁' : '羽毛球'}
                </button>
              ))}
            </div>
          )}
          <Button asChild>
            <Link href={newOrderHref}>
              <Plus className="mr-2 h-4 w-4" />
              新建订单
            </Link>
          </Button>
        </div>
      </div>

      {/* 时间范围筛选 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">时间范围：</span>
        <div className="flex rounded-lg border bg-muted/50 p-0.5">
          {(['all', 'week', 'month', 'last_month', 'next_month', 'year'] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setDatePreset(preset)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                datePreset === preset ? 'bg-background shadow' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {preset === 'all'
                ? '全部'
                : preset === 'week'
                  ? '本周'
                  : preset === 'month'
                    ? '本月'
                    : preset === 'last_month'
                      ? '上月'
                      : preset === 'next_month'
                        ? '下月'
                        : '本年'}
            </button>
          ))}
        </div>
      </div>

      {/* 统计卡片区域 */}
      {orders.length > 0 && (
        <div className={`grid gap-4 md:grid-cols-2 ${stats.returnedDeposit > 0 ? 'lg:grid-cols-6' : 'lg:grid-cols-5'}`}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">订单总金额</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</div>
              <p className="text-xs text-muted-foreground">共 {stats.totalOrders} 个订单</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总押金（未退还）</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalDeposit)}</div>
              <p className="text-xs text-muted-foreground">
                待发货 + 待收货订单押金（{stats.statusCounts.in_progress + stats.statusCounts.confirmed} 个订单）
              </p>
            </CardContent>
          </Card>

          {stats.returnedDeposit > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">已退还押金</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-muted-foreground">{formatCurrency(stats.returnedDeposit)}</div>
                <p className="text-xs text-muted-foreground">
                  已完成 + 已取消订单押金（{stats.statusCounts.completed + stats.statusCounts.cancelled} 个订单）
                </p>
              </CardContent>
            </Card>
          )}

          {(stats.pendingAmount > 0 || stats.statusCounts.pending + stats.statusCounts.confirmed > 0) && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">待发货订单金额</CardTitle>
                <Truck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.pendingAmount)}</div>
                <p className="text-xs text-muted-foreground">
                  待发货（{stats.statusCounts.pending + stats.statusCounts.confirmed} 个订单）
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">待收货订单金额</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.inProgressAmount)}</div>
              <p className="text-xs text-muted-foreground">
                待收货（{stats.statusCounts.in_progress} 个订单）
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">已完成订单金额</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.completedAmount)}</div>
              <p className="text-xs text-muted-foreground">
                已完成 {stats.statusCounts.completed} 个订单
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">利润（收入－成本）</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={cn('text-2xl font-bold', stats.profit >= 0 ? 'text-green-600' : 'text-red-600')}>
                {formatCurrency(stats.profit)}
              </div>
              <p className="text-xs text-muted-foreground">
                收入 {formatCurrency(stats.totalIncome)} － 成本（物流+第三方转租，不含可退押金）{formatCurrency(stats.totalCost)}
              </p>
            </CardContent>
          </Card>

          {stats.cancelledAmount > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">已取消订单金额</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-muted-foreground">{formatCurrency(stats.cancelledAmount)}</div>
                <p className="text-xs text-muted-foreground">
                  已取消 {stats.statusCounts.cancelled} 个订单
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">暂无订单</h3>
                <p className="text-muted-foreground">开始创建你的第一个订单吧</p>
              </div>
              <Button asChild>
                <Link href={newOrderHref}>
                  <Plus className="mr-2 h-4 w-4" />
                  新建订单
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>订单列表</CardTitle>
            <CardDescription>共 {orders.length} 个订单</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>类型</TableHead>
                  <TableHead>订单编号</TableHead>
                  <TableHead>{isBadmintonOnlyView ? '服务' : '设备/服务'}</TableHead>
                  <TableHead>客户</TableHead>
                  <TableHead>{isBadmintonOnlyView ? '上课时间' : '日期'}</TableHead>
                  <TableHead>总金额</TableHead>
                  {!isBadmintonOnlyView && <TableHead>押金</TableHead>}
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedOrders.map((order) => {
                  const isBadminton = (order as any).order_type === 'badminton'
                  const orderItems = order.order_items || []
                  const itemCount = orderItems.length
                  const firstItem = orderItems[0]?.item
                  const categoryIcon = getCategoryIcon(firstItem?.category?.name)
                  const daysUntilStart = getDaysUntilStart(order.start_date)
                  const daysUntilEnd = getDaysUntilEnd(order.end_date)
                  const isUrgent = !isBadminton && order.status === 'in_progress' && daysUntilStart < 0 && daysUntilEnd >= 0 && daysUntilEnd <= 2
                  const st = (order as any).service_start_time
                  const et = (order as any).service_end_time
                  const timeRange = st && et ? ` ${String(st).slice(0, 5)}–${String(et).slice(0, 5)}` : ''

                  return (
                    <TableRow
                      key={order.id}
                      className={cn(getRowBackgroundClass(order.status, isUrgent))}
                    >
                      <TableCell>
                        <Badge variant={isBadminton ? 'secondary' : 'outline'} className={isBadminton ? 'bg-emerald-100 text-emerald-800' : ''}>
                          {isBadminton ? '羽毛球' : '租赁'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {order.order_number || order.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        {isBadminton ? (
                          <div>
                            <div className="font-medium">{(order as any).service_type || '-'}</div>
                            <div className="text-sm text-muted-foreground">{(order as any).location || '-'}</div>
                          </div>
                        ) : firstItem ? (
                          <div className="flex items-center gap-2">
                            {categoryIcon && <span className="flex-shrink-0">{categoryIcon}</span>}
                            <div>
                              <div className="font-medium">{firstItem.short_name?.trim() || firstItem.name}</div>
                              {firstItem.category && <div className="text-sm text-muted-foreground">{firstItem.category.name}</div>}
                              {itemCount > 1 && <div className="text-xs text-muted-foreground mt-1">等 {itemCount} 项</div>}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div>{order.customer_name}</div>
                          {order.customer_phone && <div className="text-xs text-muted-foreground">{order.customer_phone}</div>}
                          {!isBadminton && order.customer_address?.trim() && (
                            <div className="pt-0.5 relative inline-block group">
                              <button
                                type="button"
                                aria-label="查看详细地址"
                                className="inline-flex items-center text-muted-foreground hover:text-foreground focus-visible:text-foreground cursor-help"
                              >
                                <MapPin className="h-3.5 w-3.5" />
                              </button>
                              <div
                                role="tooltip"
                                className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-72 rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md group-hover:block group-focus-within:block"
                              >
                                <div className="font-medium mb-1">客户地址</div>
                                <div className="break-words whitespace-normal leading-relaxed text-muted-foreground">
                                  {order.customer_address}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isBadminton ? (
                          <span className="text-sm">
                            {formatDateShort((order as any).service_date || order.start_date)}{timeRange}
                          </span>
                        ) : (
                          (() => {
                            const isNotShipped = (order.status === 'pending' || order.status === 'confirmed') && daysUntilStart >= 0
                            const isInProgress = order.status === 'in_progress' && daysUntilStart < 0 && daysUntilEnd >= 0
                            const isCompleted = order.status === 'completed' || order.status === 'cancelled' || daysUntilEnd < 0
                            return (
                              <div className="space-y-1">
                                {isNotShipped ? (
                                  <>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Truck className="h-4 w-4 text-blue-500 shrink-0" />
                                      <span className={cn('text-sm font-medium', daysUntilStart <= 3 && 'text-blue-600')}>
                                        开始: {formatDateShort(order.start_date)}
                                      </span>
                                      {daysUntilStart >= 0 && (
                                        <Badge variant="secondary" className={cn(daysUntilStart <= 3 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700')}>
                                          {daysUntilStart === 0 ? '今天' : `还有${daysUntilStart}天`}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Package className="h-4 w-4 text-orange-500 shrink-0" />
                                      <span className="text-sm font-medium">结束: {formatDateShort(order.end_date)}</span>
                                    </div>
                                    {order.customer_address?.trim() && (
                                      <div className="pt-1.5 mt-1.5 border-t border-border/60">
                                        {shipSuggestions[order.id] ? (
                                          <div className="text-xs text-foreground">
                                            <span className="font-medium">建议最晚 {shipSuggestions[order.id].recommendShipBy} 发货</span>
                                            <span className="text-muted-foreground ml-1">（{shipSuggestions[order.id].suggestedExpress}）</span>
                                          </div>
                                        ) : (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                                            onClick={() => fetchShipSuggestion(order)}
                                            disabled={shipSuggestionLoadingId === order.id}
                                          >
                                            {shipSuggestionLoadingId === order.id ? (
                                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                            ) : (
                                              <Sparkles className="h-3.5 w-3.5 mr-1" />
                                            )}
                                            AI 推荐发货
                                          </Button>
                                        )}
                                      </div>
                                    )}
                                  </>
                                ) : isInProgress ? (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Package className="h-4 w-4 text-orange-500 shrink-0" />
                                    <span className={cn('text-sm font-medium', daysUntilEnd <= 2 && 'text-red-600', daysUntilEnd > 2 && daysUntilEnd <= 7 && 'text-orange-600')}>
                                      结束: {formatDateShort(order.end_date)}
                                    </span>
                                    {daysUntilEnd <= 7 && (
                                      <Badge variant={daysUntilEnd <= 2 ? 'destructive' : 'secondary'} className={daysUntilEnd > 2 ? 'bg-orange-100 text-orange-700' : ''}>
                                        {daysUntilEnd === 0 ? '今天到期' : `还有${daysUntilEnd}天到期`}
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-sm text-muted-foreground">
                                    {formatDateShort(order.start_date)} – {formatDateShort(order.end_date)}
                                  </div>
                                )}
                              </div>
                            )
                          })()
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(order.total_amount)}</TableCell>
                      {!isBadmintonOnlyView && (
                        <TableCell>{order.total_deposit > 0 ? formatCurrency(order.total_deposit) : '-'}</TableCell>
                      )}
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(order.status)} className={getStatusBadgeClassName(order.status)}>
                          {getStatusLabel(order.status, isBadminton)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {!isBadminton && (order.status === 'pending' || order.status === 'confirmed') && (
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => setShippingDialogOrder(order)}
                            >
                              <Truck className="mr-1 h-3.5 w-3.5" />
                              快速发货
                            </Button>
                          )}
                          {!isBadminton && order.status === 'in_progress' && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => setQuickCompleteOrder(order)}
                            >
                              <Package className="mr-1 h-3.5 w-3.5" />
                              快速收货
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/orders/${order.id}`}>查看</Link>
                          </Button>
                          {order.status === 'completed' && !isBadminton && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground"
                              onClick={() => {
                                setRollbackOrder(order)
                              }}
                            >
                              <RotateCcw className="mr-1 h-3.5 w-3.5" />
                              回退
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => { setOrderToDelete(order); setDeleteDialogOpen(true) }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {shippingDialogOrder && (
        <ShippingDialog
          order={shippingDialogOrder}
          open={!!shippingDialogOrder}
          onOpenChange={(open) => !open && setShippingDialogOrder(null)}
          onSuccess={handleShippingSuccess}
        />
      )}

      <AlertDialog open={!!quickCompleteOrder} onOpenChange={(open) => !open && !quickCompleting && setQuickCompleteOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>快速收货</AlertDialogTitle>
            <AlertDialogDescription>
              确定将订单「{quickCompleteOrder?.customer_name}」标记为已完成？将自动生成交易记录，设备状态将恢复为可用。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={quickCompleting}>取消</AlertDialogCancel>
            <Button onClick={() => handleQuickComplete()} disabled={quickCompleting}>
              {quickCompleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  处理中...
                </>
              ) : (
                '确认收货'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除订单 "{orderToDelete?.customer_name}" 的订单吗？
              <br />
              <span className="text-destructive font-medium">
                此操作无法撤销。
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? '删除中...' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!rollbackOrder} onOpenChange={(open) => !open && !rollingBack && setRollbackOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认回退</AlertDialogTitle>
            <AlertDialogDescription>
              确定要将订单「{rollbackOrder?.customer_name}」从已完成回退到待收货吗？这将删除该订单已生成的自动交易记录。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rollingBack}>取消</AlertDialogCancel>
            <Button onClick={() => handleRollback()} disabled={rollingBack} variant="secondary">
              {rollingBack ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  处理中...
                </>
              ) : (
                '确认回退'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
