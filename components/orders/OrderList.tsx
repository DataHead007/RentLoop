'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
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
import { Calendar, Plus, Trash2, DollarSign, Shield, Package, Aperture, Camera, Gamepad2, Joystick, Headphones, Monitor, Smartphone, Mic, Truck, Loader2, RotateCcw } from 'lucide-react'
import type { Order } from '@/lib/types/database'
import Link from 'next/link'
import { formatCurrency, formatDateShort, getDaysUntilStart, getDaysUntilEnd, getDateRangeForPreset } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { PerformanceMonitor } from '@/lib/utils/performance'
import { ShippingDialog } from './ShippingDialog'

type OrderTypeTab = 'all' | 'rental' | 'badminton'
type DatePreset = 'all' | 'week' | 'month' | 'year'

export function OrderList() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [orderTypeTab, setOrderTypeTab] = useState<OrderTypeTab>('all')
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [shippingDialogOrder, setShippingDialogOrder] = useState<Order | null>(null)
  const [quickCompleteOrder, setQuickCompleteOrder] = useState<Order | null>(null)
  const [quickCompleting, setQuickCompleting] = useState(false)

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

  // 对订单进行排序：未完成的在前，已完成的在后，各按创建时间降序
  const sortedOrders = useMemo(() => {
    const activeOrders = orders.filter(o => 
      o.status !== 'completed' && o.status !== 'cancelled'
    )
    const completedOrders = orders.filter(o => 
      o.status === 'completed' || o.status === 'cancelled'
    )
    
    // 对每组按创建时间降序排序
    const sortByCreatedAt = (a: Order, b: Order) => {
      const timeA = new Date(a.created_at).getTime()
      const timeB = new Date(b.created_at).getTime()
      return timeB - timeA // 降序：新的在前
    }
    
    activeOrders.sort(sortByCreatedAt)
    completedOrders.sort(sortByCreatedAt)
    
    // 未完成的在前，已完成的在后
    return [...activeOrders, ...completedOrders]
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
    
    // 使用 reduce 一次遍历完成所有统计，而不是多次 filter
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
      
      // 押金统计：只统计未退还的押金（进行中+已确认）
      // 已完成和已取消的订单押金视为已退还
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
    }
  }, [orders])

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true)
      const { getOrdersCached } = await import('@/lib/supabase/cachedQueries')
      const startTime = performance.now()
      const ot = orderTypeTab === 'all' ? undefined : orderTypeTab
      const range = datePreset === 'all' ? undefined : getDateRangeForPreset(datePreset)
      const data = await getOrdersCached(range?.startDate, range?.endDate, ot)
      PerformanceMonitor.record('api:orders:list', performance.now() - startTime)
      setOrders(data)
    } catch (error) {
      console.error('Failed to load orders:', error)
    } finally {
      setLoading(false)
    }
  }, [orderTypeTab, datePreset])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  // 监听订单更新事件，强制同步并刷新列表（如从订单详情返回、跨标签页更新等）
  useEffect(() => {
    const handleOrderUpdated = async () => {
      try {
        const { forceSync } = await import('@/lib/supabase/cachedQueries')
        await forceSync('orders')
        await loadOrders()
      } catch (err) {
        console.error('Failed to refresh orders on orderUpdated:', err)
      }
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
  }, [loadOrders])

  const handleDelete = useCallback(async () => {
    if (!orderToDelete) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/orders?id=${orderToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '删除失败')
      }

      // 从本地缓存删除
      const { deleteFromCache } = await import('@/lib/supabase/cachedQueries')
      await deleteFromCache('orders', orderToDelete.id).catch(console.error)

      await loadOrders()
      setDeleteDialogOpen(false)
      setOrderToDelete(null)
      
      // 触发自定义事件，通知其他页面刷新统计数据
      window.dispatchEvent(new CustomEvent('orderUpdated'))
      // 同时使用 localStorage 通知其他标签页
      localStorage.setItem('orderUpdated', Date.now().toString())
    } catch (error) {
      console.error('Failed to delete order:', error)
      alert(error instanceof Error ? error.message : '删除失败，请重试')
    } finally {
      setDeleting(false)
    }
  }, [orderToDelete, loadOrders])

  const handleQuickComplete = useCallback(async () => {
    if (!quickCompleteOrder) return
    setQuickCompleting(true)
    try {
      const response = await fetch(`/api/orders/${quickCompleteOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || '收货失败')
      }
      await loadOrders()
      setQuickCompleteOrder(null)
      window.dispatchEvent(new CustomEvent('orderUpdated'))
      localStorage.setItem('orderUpdated', Date.now().toString())
    } catch (error) {
      console.error('Quick complete failed:', error)
      alert(error instanceof Error ? error.message : '收货失败，请重试')
    } finally {
      setQuickCompleting(false)
    }
  }, [quickCompleteOrder, loadOrders])

  const handleShippingSuccess = useCallback(async () => {
    setShippingDialogOrder(null)
    try {
      const { forceSync } = await import('@/lib/supabase/cachedQueries')
      await forceSync('orders')
      await loadOrders()
    } finally {
      window.dispatchEvent(new CustomEvent('orderUpdated'))
      localStorage.setItem('orderUpdated', Date.now().toString())
    }
  }, [loadOrders])

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
      confirmed: '待发货', // 兼容历史订单
      in_progress: '进行中',
      completed: '已完成',
      cancelled: '已取消',
    }
    return labels[status] || status
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
          <h2 className="text-3xl font-bold tracking-tight">订单管理</h2>
          <p className="text-muted-foreground">租赁订单与羽毛球副业订单</p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button asChild>
            <Link href="/orders/new">
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
          {(['all', 'week', 'month', 'year'] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setDatePreset(preset)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                datePreset === preset ? 'bg-background shadow' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {preset === 'all' ? '全部' : preset === 'week' ? '本周' : preset === 'month' ? '本月' : '本年'}
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
                进行中 + 已确认订单押金（{stats.statusCounts.in_progress + stats.statusCounts.confirmed} 个订单）
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
                <CardTitle className="text-sm font-medium">待确认/待发货订单金额</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.pendingAmount)}</div>
                <p className="text-xs text-muted-foreground">
                  待发货 + 已确认（{stats.statusCounts.pending + stats.statusCounts.confirmed} 个订单）
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">进行中订单金额</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.inProgressAmount)}</div>
              <p className="text-xs text-muted-foreground">
                进行中 {stats.statusCounts.in_progress} 个订单
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
                <Link href="/orders/new">
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
                  <TableHead>设备/服务</TableHead>
                  <TableHead>客户</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead>总金额</TableHead>
                  <TableHead>押金</TableHead>
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
                      className={cn(isUrgent && 'bg-orange-50/50')}
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
                              <div className="font-medium">{firstItem.name}</div>
                              {firstItem.category && <div className="text-sm text-muted-foreground">{firstItem.category.name}</div>}
                              {itemCount > 1 && <div className="text-xs text-muted-foreground mt-1">等 {itemCount} 项</div>}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>{order.customer_name}</div>
                          {(order.customer_phone || order.customer_email) && (
                            <div className="text-xs text-muted-foreground">
                              {[order.customer_phone, order.customer_email].filter(Boolean).join(' · ')}
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
                      <TableCell>{order.total_deposit > 0 ? formatCurrency(order.total_deposit) : '-'}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(order.status)}>{getStatusLabel(order.status)}</Badge>
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
                                if (confirm('确定要回退订单状态吗？这将删除已生成的交易记录。')) {
                                  fetch(`/api/orders/${order.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ status: 'in_progress' }),
                                  }).then((r) => {
                                    if (r.ok) {
                                      loadOrders()
                                      window.dispatchEvent(new CustomEvent('orderUpdated'))
                                      localStorage.setItem('orderUpdated', Date.now().toString())
                                    } else {
                                      r.json().then((e) => alert(e.error || '回退失败'))
                                    }
                                  }).catch((e) => alert(e.message || '回退失败'))
                                }
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
    </div>
  )
}
