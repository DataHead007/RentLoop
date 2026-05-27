'use client'

import { Fragment, useEffect, useState, useMemo, useCallback, memo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { Package, Plus, TrendingUp, Trash2, Aperture, Camera, Gamepad2, Joystick, Headphones, Monitor, Smartphone, Mic, DollarSign, Loader2 } from 'lucide-react'
import type { ItemWithStats } from '@/lib/types/database'
import Link from 'next/link'
import { clampPaybackForBar, formatCurrency } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { ItemListMobileCard } from './ItemListMobileCard'
import { ItemListShortNameEditor } from './ItemListShortNameEditor'
import {
  getRentalLineForCategory,
  getRentalLineLabel,
  RENTAL_LINE_OPTIONS,
} from '@/lib/categories/rentalLine'
import { buildItemListDisplay, type ItemCategoryGroup } from '@/lib/items/itemListGrouping'
import {
  ItemListRowContextBadges,
  ItemListSectionBreadcrumb,
  ItemListSoldDivider,
  ItemListStatusHeader,
} from '@/components/items/ItemListSectionHeaders'

export function ItemList() {
  const searchParams = useSearchParams()
  const [items, setItems] = useState<ItemWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<ItemWithStats | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [rentalLineFilter, setRentalLineFilter] = useState<string>('all')
  const [assetsValue, setAssetsValue] = useState<{ totalPurchasePrice: number; assetCount: number } | null>(null)
  const [loadingAssetsValue, setLoadingAssetsValue] = useState(false)

  // 从 URL 参数读取品类筛选
  useEffect(() => {
    const categoryFromUrl = searchParams?.get('category')
    if (categoryFromUrl) {
      setCategoryFilter(categoryFromUrl)
    }
  }, [searchParams])

  const loadItems = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const res = await fetch('/api/items', { cache: 'no-store' })
      if (!res.ok) {
        throw new Error('加载资产列表失败')
      }
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to load items:', error)
      setError(error instanceof Error ? error.message : '加载资产列表失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const loadAssetsValue = useCallback(async () => {
    try {
      setLoadingAssetsValue(true)
      const response = await fetch('/api/items/assets-value')
      if (!response.ok) {
        throw new Error('Failed to fetch assets value')
      }
      const data = await response.json()
      setAssetsValue({
        totalPurchasePrice: Number(data.totalPurchasePrice) || 0,
        assetCount: Number(data.assetCount) || 0,
      })
    } catch (error) {
      console.error('Failed to load assets value:', error)
      setAssetsValue({
        totalPurchasePrice: 0,
        assetCount: 0,
      })
    } finally {
      setLoadingAssetsValue(false)
    }
  }, [])

  useEffect(() => {
    if (items.length > 0) {
      loadAssetsValue()
    }
  }, [items.length, loadAssetsValue])

  // 监听订单/交易更新事件，刷新资产统计（订单完成、快速收货等会创建交易记录）
  useEffect(() => {
    const handleUpdated = () => {
      loadItems().then(() => loadAssetsValue())
    }
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'orderUpdated' || e.key === 'transactionUpdated') handleUpdated()
    }
    window.addEventListener('orderUpdated', handleUpdated)
    window.addEventListener('transactionUpdated', handleUpdated)
    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('orderUpdated', handleUpdated)
      window.removeEventListener('transactionUpdated', handleUpdated)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [loadItems, loadAssetsValue])

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
    return <Package className="h-5 w-5 text-gray-500" />
  }

  const handleDelete = useCallback(async () => {
    if (!itemToDelete) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/items?id=${itemToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '删除失败')
      }

      // 从本地缓存删除
      const { deleteFromCache } = await import('@/lib/supabase/cachedQueries')
      await deleteFromCache('items', itemToDelete.id).catch(console.error)

      await loadItems()
      setDeleteDialogOpen(false)
      setItemToDelete(null)
    } catch (error) {
      console.error('Failed to delete item:', error)
      alert(error instanceof Error ? error.message : '删除失败，请重试')
    } finally {
      setDeleting(false)
    }
  }, [itemToDelete, loadItems])

  // 使用 useMemo 缓存状态映射，避免每次渲染都重新创建对象
  const statusBadgeVariants = useMemo(() => ({
    available: 'success',
    rented: 'default',
    in_use: 'default',
    maintenance: 'warning',
    retired: 'secondary',
    sold: 'secondary',
  } as const), [])

  const statusLabels = useMemo(() => ({
    available: '可用',
    rented: '出租中',
    in_use: '使用中',
    maintenance: '维护中',
    retired: '已退役',
    sold: '已售出',
  } as const), [])

  const getStatusBadgeVariant = useCallback((status: string) => {
    return statusBadgeVariants[status as keyof typeof statusBadgeVariants] || 'secondary'
  }, [statusBadgeVariants])

  const getStatusLabel = useCallback((status: string) => {
    return statusLabels[status as keyof typeof statusLabels] || status
  }, [statusLabels])

  // 获取所有唯一品类
  const categories = useMemo(() => {
    const categorySet = new Set<string>()
    items.forEach(item => {
      if (item.category?.name) {
        categorySet.add(item.category.name)
      }
    })
    return Array.from(categorySet).sort()
  }, [items])

  // 计算统计信息
  const stats = useMemo(() => {
    const statusCounts = {
      available: 0,
      rented: 0,
      in_use: 0,
      maintenance: 0,
      retired: 0,
      sold: 0,
    }

    let totalNetProfit = 0
    let totalPaybackProgress = 0

    items.forEach(item => {
      // 统计各状态数量
      if (item.status in statusCounts) {
        statusCounts[item.status as keyof typeof statusCounts]++
      }

      // 计算总净收益
      totalNetProfit += item.net_profit || 0

      totalPaybackProgress += item.payback_progress_pct ?? 0
    })

    const averagePaybackProgress = items.length > 0 ? totalPaybackProgress / items.length : 0
    const availableCount = statusCounts.available
    const rentedCount = statusCounts.rented + statusCounts.in_use
    const soldCount = statusCounts.sold

    return {
      statusCounts,
      totalNetProfit,
      averagePaybackProgress,
      availableCount,
      rentedCount,
      soldCount,
      totalCount: items.length,
    }
  }, [items])

  const applyListFilters = useCallback(
    (source: ItemWithStats[], opts?: { includeRentalLine?: boolean }) => {
      return source.filter((item) => {
        if (opts?.includeRentalLine !== false && rentalLineFilter !== 'all') {
          const line = getRentalLineForCategory(item.category)
          if (line !== rentalLineFilter) return false
        }
        if (categoryFilter !== 'all' && item.category?.name !== categoryFilter) {
          return false
        }
        if (statusFilter !== 'all' && item.status !== statusFilter) {
          return false
        }
        if (searchQuery) {
          const query = searchQuery.toLowerCase()
        const matchesName = item.name.toLowerCase().includes(query)
        const matchesShort = item.short_name?.toLowerCase().includes(query) || false
        const matchesBrand = item.brand?.toLowerCase().includes(query) || false
        const matchesModel = item.model?.toLowerCase().includes(query) || false
        if (!matchesName && !matchesShort && !matchesBrand && !matchesModel) {
            return false
          }
        }
        return true
      })
    },
    [rentalLineFilter, categoryFilter, statusFilter, searchQuery]
  )

  const filteredItems = useMemo(
    () => applyListFilters(items),
    [items, applyListFilters]
  )

  /** 导航条计数：不受业务线筛选影响，便于切换 */
  const itemsForNav = useMemo(
    () => applyListFilters(items, { includeRentalLine: false }),
    [items, applyListFilters]
  )

  const listDisplay = useMemo(
    () =>
      buildItemListDisplay(filteredItems, {
        statusFilter,
        groupByStatusFirst: rentalLineFilter !== 'all',
      }),
    [filteredItems, statusFilter, rentalLineFilter]
  )

  const useStatusFirstLayout =
    listDisplay.statusFirstSections != null && listDisplay.statusFirstSections.length > 0

  const showFamilyOnRow =
    rentalLineFilter === 'all' &&
    categoryFilter === 'all' &&
    statusFilter === 'all' &&
    listDisplay.sections.length > 1
  const showCategoryOnRow = categoryFilter === 'all'
  const showStatusOnRow = statusFilter === 'all' && !useStatusFirstLayout
  const showStatusSectionHeaders = statusFilter === 'all' && useStatusFirstLayout
  const showSoldSection =
    listDisplay.soldCount > 0 && (statusFilter === 'all' || statusFilter === 'sold')

  const navDisplay = useMemo(
    () => buildItemListDisplay(itemsForNav, { statusFilter: 'all' }),
    [itemsForNav]
  )

  const breadcrumbSegments = useMemo(() => {
    const segments: {
      label: string
      count: number
      sectionKey: string
      muted?: boolean
    }[] = navDisplay.sections.map((s) => ({
      label: s.familyLabel,
      count: s.itemCount,
      sectionKey: s.family,
    }))
    if (navDisplay.soldCount > 0) {
      segments.push({
        label: '已售出',
        count: navDisplay.soldCount,
        muted: true,
        sectionKey: 'sold',
      })
    }
    return segments
  }, [navDisplay])

  const showBreadcrumb = breadcrumbSegments.length > 1

  const activeBreadcrumbKey =
    statusFilter === 'sold' ? 'sold' : rentalLineFilter !== 'all' ? rentalLineFilter : null

  const handleShortNameSaved = useCallback((itemId: string, shortName: string | null) => {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, short_name: shortName } : it))
    )
  }, [])

  const handleBreadcrumbSelect = useCallback((sectionKey: string) => {
    if (sectionKey === 'sold') {
      if (statusFilter === 'sold' && rentalLineFilter === 'all') {
        setStatusFilter('all')
      } else {
        setRentalLineFilter('all')
        setCategoryFilter('all')
        setStatusFilter('sold')
      }
      return
    }
    if (rentalLineFilter === sectionKey && statusFilter !== 'sold') {
      setRentalLineFilter('all')
    } else {
      setRentalLineFilter(sectionKey)
      setStatusFilter('all')
    }
  }, [rentalLineFilter, statusFilter])

  const getRentalLineLabelForItem = (item: ItemWithStats) =>
    getRentalLineLabel(getRentalLineForCategory(item.category))

  const getItemSubtitle = (item: ItemWithStats) => {
    const parts = [item.brand, item.model].filter(Boolean).join(' ')
    if (!parts && !item.serial_number) return undefined
    return parts + (item.serial_number ? ` · ${item.serial_number}` : '')
  }

  const renderTableRow = (
    item: ItemWithStats,
    opts?: { sold?: boolean; familyLabel?: string }
  ) => {
    const paybackPct = item.payback_progress_pct ?? 0
    const paybackDisplay = `${paybackPct.toFixed(1)}%`
    const netProfit = item.net_profit || 0
    const muted = opts?.sold
    const familyLabel = opts?.familyLabel ?? getRentalLineLabelForItem(item)

    return (
      <TableRow
        key={item.id}
        className={cn(
          'border-0 border-b border-zinc-100 bg-white hover:bg-zinc-50/50',
          muted && 'opacity-80'
        )}
      >
        <TableCell className="py-5 pl-4 pr-2">
          <ItemListRowContextBadges
            familyLabel={familyLabel}
            categoryName={item.category?.name || '未分类'}
            statusLabel={getStatusLabel(item.status)}
            showFamily={showFamilyOnRow}
            showCategory={showCategoryOnRow}
            showStatus={showStatusOnRow}
            sold={muted}
          />
          <div className="flex items-start gap-2.5">
            {getCategoryIcon(item.category?.name) ? (
              <span className="mt-0.5 shrink-0 opacity-70">{getCategoryIcon(item.category?.name)}</span>
            ) : null}
            <ItemListShortNameEditor
              itemId={item.id}
              fullName={item.name}
              shortName={item.short_name}
              subtitle={getItemSubtitle(item)}
              onSaved={(shortName) => handleShortNameSaved(item.id, shortName)}
              showDetailLink={false}
            />
          </div>
        </TableCell>
        <TableCell className="py-5 text-right align-top">
          <div
            className={cn(
              'text-lg font-semibold tabular-nums tracking-tight',
              netProfit > 0 ? 'text-emerald-600' : netProfit < 0 ? 'text-red-600' : 'text-zinc-400'
            )}
          >
            {formatCurrency(netProfit)}
          </div>
          <p className="mt-0.5 text-[10px] text-zinc-400">净收益</p>
        </TableCell>
        <TableCell className="py-5 align-top">
          <div className="min-w-0 max-w-[9rem] space-y-1.5">
            <div className="flex items-center justify-between gap-1 text-sm">
              <span
                className={cn(
                  'font-medium tabular-nums',
                  paybackPct >= 100
                    ? 'text-emerald-600'
                    : paybackPct > 0
                      ? 'text-foreground'
                      : 'text-zinc-400'
                )}
              >
                {paybackDisplay}
              </span>
              {paybackPct >= 100 ? (
                <span className="text-[10px] text-emerald-600">已回本</span>
              ) : null}
            </div>
            <Progress
              value={clampPaybackForBar(paybackPct)}
              className={cn('h-1', paybackPct >= 100 && '[&>*]:bg-emerald-500')}
            />
          </div>
        </TableCell>
        <TableCell className="py-5 tabular-nums text-sm text-zinc-500 align-top">
          {formatCurrency(item.purchase_price)}
        </TableCell>
        <TableCell className="py-5 tabular-nums text-sm text-zinc-500 align-top">
          {formatCurrency(item.total_revenue || 0)}
        </TableCell>
        <TableCell className="py-5 align-top">
          <Badge variant={getStatusBadgeVariant(item.status)} className="font-normal">
            {getStatusLabel(item.status)}
          </Badge>
        </TableCell>
        <TableCell className="py-5 pr-2 text-right align-top">
          <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
            <Link href={`/items/${item.id}`}>详情</Link>
          </Button>
        </TableCell>
        <TableCell className="py-5 pr-4 text-right align-top">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              setItemToDelete(item)
              setDeleteDialogOpen(true)
            }}
          >
            <Trash2 className="h-3.5 w-3.5 text-zinc-400 hover:text-destructive" />
          </Button>
        </TableCell>
      </TableRow>
    )
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

  if (error) {
    return (
      <div className="space-y-5 sm:space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight">资产档案</h2>
            <p className="text-sm text-muted-foreground">管理你的租赁设备库存</p>
          </div>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <p className="text-destructive font-medium">{error}</p>
              <Button onClick={loadItems} variant="outline">
                重试
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">资产档案</h2>
          <p className="text-sm text-muted-foreground">管理你的租赁设备库存</p>
        </div>
        <Button asChild className="w-full shrink-0 sm:w-auto">
          <Link href="/items/new">
            <Plus className="mr-2 h-4 w-4" />
            新增资产
          </Link>
        </Button>
      </div>

      {/* 统计卡片区域 */}
      {items.length > 0 && (
        <div className="grid gap-2.5 sm:gap-3 md:grid-cols-2 lg:grid-cols-4">
          {/* 资产总值卡片 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">资产总值</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingAssetsValue ? (
                <div className="flex items-center justify-center h-20">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="text-xl font-semibold tabular-nums tracking-tight">
                    {assetsValue ? formatCurrency(assetsValue.totalPurchasePrice) : '--'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {assetsValue ? `共 ${assetsValue.assetCount} 件未售出资产` : '计算中...'}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* 资产数量卡片 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">资产数量</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold tabular-nums tracking-tight">
                {stats.totalCount} 件
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                可用 {stats.availableCount} | 出租中 {stats.rentedCount} | 已售出 {stats.soldCount}
              </p>
            </CardContent>
          </Card>

          {/* 总净收益卡片 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总净收益</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-xl font-semibold tabular-nums tracking-tight",
                stats.totalNetProfit >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {formatCurrency(stats.totalNetProfit)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                所有资产的净收益总和
              </p>
            </CardContent>
          </Card>

          {/* 平均回本进度 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">平均回本进度</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  'text-xl font-semibold tabular-nums tracking-tight',
                  stats.averagePaybackProgress >= 100 ? 'text-green-600' : 'text-foreground'
                )}
              >
                {stats.averagePaybackProgress.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                各资产回本比例（%）算术平均，可超过 100
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Package className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">暂无资产</h3>
                <p className="text-muted-foreground">开始添加你的第一件设备吧</p>
              </div>
              <Button asChild>
                <Link href="/items/new">
                  <Plus className="mr-2 h-4 w-4" />
                  新增资产
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="min-w-0 overflow-hidden border-zinc-200/80 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-3 py-3 sm:px-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 shrink-0">
                <h3 className="text-sm font-semibold tracking-tight text-foreground">资产组合</h3>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {filteredItems.length} 件
                  {filteredItems.length !== items.length ? ` / 共 ${items.length} 件` : ''}
                  · 按净收益与回本排序浏览
                </p>
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:max-w-2xl lg:justify-end">
                <Input
                  id="search"
                  placeholder="搜索名称、品牌、型号…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 min-w-0 flex-1 basis-[140px] border-zinc-200 bg-white text-sm shadow-none sm:min-w-[180px]"
                />
                <Select value={rentalLineFilter} onValueChange={setRentalLineFilter}>
                  <SelectTrigger
                    id="rental_line"
                    className="h-8 w-full min-w-0 border-zinc-200 bg-white text-xs shadow-none sm:w-[108px]"
                  >
                    <SelectValue placeholder="业务线" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部业务线</SelectItem>
                    {RENTAL_LINE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger
                    id="category"
                    className="h-8 w-full min-w-0 border-zinc-200 bg-white text-xs shadow-none sm:w-[120px]"
                  >
                    <SelectValue placeholder="品类" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部品类</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger
                    id="status"
                    className="h-8 w-full min-w-0 border-zinc-200 bg-white text-xs shadow-none sm:w-[108px]"
                  >
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="available">可用</SelectItem>
                    <SelectItem value="rented">出租中</SelectItem>
                    <SelectItem value="in_use">使用中</SelectItem>
                    <SelectItem value="maintenance">维护中</SelectItem>
                    <SelectItem value="retired">已退役</SelectItem>
                    <SelectItem value="sold">已售出</SelectItem>
                  </SelectContent>
                </Select>
                {(searchQuery || statusFilter !== 'all' || categoryFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 px-2 text-xs text-zinc-500"
                    onClick={() => {
                      setSearchQuery('')
                      setStatusFilter('all')
                      setCategoryFilter('all')
                    }}
                  >
                    清除
                  </Button>
                )}
              </div>
            </div>
          </div>
          {showBreadcrumb ? (
            <div className="border-b border-zinc-100">
              <ItemListSectionBreadcrumb
                segments={breadcrumbSegments}
                activeSectionKey={activeBreadcrumbKey}
                onSelectSection={handleBreadcrumbSelect}
              />
            </div>
          ) : null}
          <CardContent className="min-w-0 p-0">
            {filteredItems.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">没有找到匹配的资产</div>
            ) : (
              <>
                <div className="divide-y divide-zinc-100 bg-white lg:hidden">
                  {(() => {
                    const renderMobileItems = (
                      categories: ItemCategoryGroup[],
                      opts?: { sold?: boolean; familyLabel?: string }
                    ) =>
                      categories.flatMap((category) =>
                        category.statusGroups.flatMap((statusGroup) =>
                          statusGroup.items.map((item) => (
                            <ItemListMobileCard
                              key={item.id}
                              item={item}
                              muted={opts?.sold}
                              familyLabel={opts?.familyLabel ?? getRentalLineLabelForItem(item)}
                              showFamily={showFamilyOnRow}
                              showCategory={showCategoryOnRow}
                              showStatus={showStatusOnRow}
                              getCategoryIcon={getCategoryIcon}
                              getStatusBadgeVariant={getStatusBadgeVariant}
                              getStatusLabel={getStatusLabel}
                              onDelete={(it) => {
                                setItemToDelete(it)
                                setDeleteDialogOpen(true)
                              }}
                              onShortNameSaved={handleShortNameSaved}
                            />
                          ))
                        )
                      )

                    const renderMobileBody = () => {
                      if (useStatusFirstLayout && listDisplay.statusFirstSections) {
                        return listDisplay.statusFirstSections.map((statusSection) => (
                          <div key={statusSection.status} className="border-b border-zinc-100 last:border-0">
                            {showStatusSectionHeaders ? (
                              <ItemListStatusHeader
                                statusLabel={getStatusLabel(statusSection.status)}
                                count={statusSection.itemCount}
                              />
                            ) : null}
                            {renderMobileItems(statusSection.categories)}
                          </div>
                        ))
                      }
                      return listDisplay.sections.map((section) => (
                        <div key={section.family}>
                          {renderMobileItems(section.categories, {
                            familyLabel: section.familyLabel,
                          })}
                        </div>
                      ))
                    }

                    return (
                      <>
                        {renderMobileBody()}
                        {showSoldSection ? (
                          <div>
                            <ItemListSoldDivider count={listDisplay.soldCount} />
                            {renderMobileItems(listDisplay.soldCategories, { sold: true })}
                          </div>
                        ) : null}
                      </>
                    )
                  })()}
                </div>
                <div className="hidden bg-white lg:block">
                  <Table className="bg-white [&_tr]:border-0">
                    <TableHeader>
                      <TableRow className="border-0 border-b border-zinc-100 bg-white hover:bg-white">
                        <TableHead className="h-9 border-0 bg-white py-2 pl-4 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                          设备
                        </TableHead>
                        <TableHead className="h-9 border-0 bg-white py-2 text-right text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                          净收益
                        </TableHead>
                        <TableHead className="h-9 border-0 bg-white py-2 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                          回本
                        </TableHead>
                        <TableHead className="h-9 border-0 bg-white py-2 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                          成本
                        </TableHead>
                        <TableHead className="h-9 border-0 bg-white py-2 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                          收入
                        </TableHead>
                        <TableHead className="h-9 border-0 bg-white py-2 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                          状态
                        </TableHead>
                        <TableHead className="h-9 border-0 bg-white py-2 text-right text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                          操作
                        </TableHead>
                        <TableHead className="h-9 w-10 border-0 bg-white py-2 pr-4" />
                      </TableRow>
                    </TableHeader>
                    <TableBody className="bg-white [&_tr:last-child]:border-b">
                      {(() => {
                        const renderTableItems = (
                          categories: ItemCategoryGroup[],
                          opts?: { sold?: boolean; familyLabel?: string }
                        ) =>
                          categories.flatMap((category) =>
                            category.statusGroups.flatMap((statusGroup) =>
                              statusGroup.items.map((item) =>
                                renderTableRow(item, {
                                  sold: opts?.sold,
                                  familyLabel: opts?.familyLabel,
                                })
                              )
                            )
                          )

                        const renderTableBody = () => {
                          if (useStatusFirstLayout && listDisplay.statusFirstSections) {
                            return listDisplay.statusFirstSections.flatMap((statusSection) => [
                              showStatusSectionHeaders ? (
                                <TableRow
                                  key={`status-${statusSection.status}`}
                                  className="border-0 bg-zinc-50/50 hover:bg-zinc-50/50"
                                >
                                  <TableCell colSpan={8} className="py-2">
                                    <ItemListStatusHeader
                                      statusLabel={getStatusLabel(statusSection.status)}
                                      count={statusSection.itemCount}
                                    />
                                  </TableCell>
                                </TableRow>
                              ) : null,
                              ...renderTableItems(statusSection.categories),
                            ])
                          }
                          return listDisplay.sections.map((section) => (
                            <Fragment key={section.family}>
                              {renderTableItems(section.categories, {
                                familyLabel: section.familyLabel,
                              })}
                            </Fragment>
                          ))
                        }

                        return (
                          <>
                            {renderTableBody()}
                            {showSoldSection ? (
                              <>
                                <TableRow className="border-0 hover:bg-white">
                                  <TableCell colSpan={8} className="p-0">
                                    <ItemListSoldDivider count={listDisplay.soldCount} />
                                  </TableCell>
                                </TableRow>
                                {renderTableItems(listDisplay.soldCategories, { sold: true })}
                              </>
                            ) : null}
                          </>
                        )
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除设备 "{itemToDelete?.name}" 吗？
              <br />
              <span className="text-destructive font-medium">
                注意：如果该设备下还有订单，将无法删除。
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
