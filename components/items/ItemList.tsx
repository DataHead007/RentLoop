'use client'

import { useEffect, useState, useMemo, useCallback, memo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { formatCurrency } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { ItemListMobileCard } from './ItemListMobileCard'

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
    let totalROI = 0
    let itemsWithROI = 0

    items.forEach(item => {
      // 统计各状态数量
      if (item.status in statusCounts) {
        statusCounts[item.status as keyof typeof statusCounts]++
      }

      // 计算总净收益
      totalNetProfit += item.net_profit || 0

      // 计算平均 ROI
      if (item.roi !== undefined && item.roi !== null) {
        totalROI += item.roi
        itemsWithROI++
      }
    })

    const averageROI = itemsWithROI > 0 ? totalROI / itemsWithROI : 0
    const availableCount = statusCounts.available
    const rentedCount = statusCounts.rented + statusCounts.in_use
    const soldCount = statusCounts.sold

    return {
      statusCounts,
      totalNetProfit,
      averageROI,
      availableCount,
      rentedCount,
      soldCount,
      totalCount: items.length,
    }
  }, [items])

  // 筛选逻辑
  const filteredItems = useMemo(() => {
    const filtered = items.filter(item => {
      // 品类筛选
      if (categoryFilter !== 'all' && item.category?.name !== categoryFilter) {
        return false
      }

      // 状态筛选
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false
      }

      // 搜索筛选：匹配设备名称、品牌、型号
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesName = item.name.toLowerCase().includes(query)
        const matchesBrand = item.brand?.toLowerCase().includes(query) || false
        const matchesModel = item.model?.toLowerCase().includes(query) || false
        if (!matchesName && !matchesBrand && !matchesModel) {
          return false
        }
      }

      return true
    })

    // 判断是否处于"未经筛选"状态
    const isUnfiltered = !searchQuery && statusFilter === 'all' && categoryFilter === 'all'

    if (isUnfiltered) {
      // 未经筛选：已售出资产排最后，各自按价值排序
      return filtered.sort((a, b) => {
        // 先判断是否已售出：已售出的排在后面
        const aSold = a.status === 'sold'
        const bSold = b.status === 'sold'
        
        if (aSold !== bSold) {
          return aSold ? 1 : -1 // 已售出的排后面（aSold为true时返回1，排在后面）
        }
        
        // 同一组内（都是已售出或都不是已售出）按价值降序排序
        const priceA = a.purchase_price || 0
        const priceB = b.purchase_price || 0
        return priceB - priceA // 降序：高价值在前
      })
    } else {
      // 有筛选条件：按状态优先级 + 品类 + 购买成本排序
      const statusPriority: Record<string, number> = {
        'available': 1,
        'rented': 2,
        'in_use': 3,
        'maintenance': 4,
        'retired': 5,
        'sold': 6,
      }

      return filtered.sort((a, b) => {
        // 1. 按状态优先级排序（如果状态筛选不是"全部"）
        if (statusFilter === 'all') {
          const statusA = statusPriority[a.status] || 999
          const statusB = statusPriority[b.status] || 999
          if (statusA !== statusB) {
            return statusA - statusB
          }
        }

        // 2. 按品类排序（如果品类筛选不是"全部"）
        if (categoryFilter === 'all') {
          const categoryA = a.category?.name || ''
          const categoryB = b.category?.name || ''
          if (categoryA !== categoryB) {
            return categoryA.localeCompare(categoryB, 'zh-CN')
          }
        }

        // 3. 按购买成本降序排序
        const priceA = a.purchase_price || 0
        const priceB = b.purchase_price || 0
        return priceB - priceA
      })
    }
  }, [items, searchQuery, statusFilter, categoryFilter])

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
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">资产档案</h2>
            <p className="text-muted-foreground">管理你的租赁设备库存</p>
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
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">资产档案</h2>
          <p className="text-muted-foreground">管理你的租赁设备库存</p>
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* 资产总值卡片 */}
          <Card className="hover:shadow-lg transition-shadow">
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
                  <div className="text-2xl font-bold">
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
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">资产数量</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalCount} 件
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                可用 {stats.availableCount} | 出租中 {stats.rentedCount} | 已售出 {stats.soldCount}
              </p>
            </CardContent>
          </Card>

          {/* 总净收益卡片 */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总净收益</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold",
                stats.totalNetProfit >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {formatCurrency(stats.totalNetProfit)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                所有资产的净收益总和
              </p>
            </CardContent>
          </Card>

          {/* 平均 ROI 卡片 */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">平均 ROI</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold",
                stats.averageROI >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {stats.averageROI >= 0 ? '+' : ''}{stats.averageROI.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                所有资产的平均投资回报率
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 筛选区域 */}
      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>筛选</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. 品类筛选 - 最粗粒度，最先选择 */}
              <div className="space-y-2">
                <Label htmlFor="category">品类</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="全部品类" />
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
              </div>
              
              {/* 2. 状态筛选 - 中等粒度，进一步筛选 */}
              <div className="space-y-2">
                <Label htmlFor="status">状态</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="全部状态" />
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
              </div>
              
              {/* 3. 搜索 - 最细粒度，精确查找 */}
              <div className="space-y-2">
                <Label htmlFor="search">搜索</Label>
                <Input
                  id="search"
                  placeholder="搜索设备名称、品牌、型号..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            {(searchQuery || statusFilter !== 'all' || categoryFilter !== 'all') && (
              <div className="mt-4 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  共找到 {filteredItems.length} 条记录
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('')
                    setStatusFilter('all')
                    setCategoryFilter('all')
                  }}
                >
                  清除筛选
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
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
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>资产列表</CardTitle>
            <CardDescription>共 {items.length} 件设备{filteredItems.length !== items.length ? `，筛选后显示 ${filteredItems.length} 件` : ''}</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 px-4 pb-6 pt-0 sm:px-6">
            {filteredItems.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">没有找到匹配的资产</div>
            ) : (
              <>
                <div className="space-y-3 lg:hidden">
                  {filteredItems.map((item, index) => (
                    <ItemListMobileCard
                      key={item.id}
                      item={item}
                      index={index}
                      getCategoryIcon={getCategoryIcon}
                      getStatusBadgeVariant={getStatusBadgeVariant}
                      getStatusLabel={getStatusLabel}
                      onDelete={(it) => {
                        setItemToDelete(it)
                        setDeleteDialogOpen(true)
                      }}
                    />
                  ))}
                </div>
                <div className="hidden lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">序号</TableHead>
                        <TableHead>设备名称</TableHead>
                        <TableHead>品类</TableHead>
                        <TableHead>序列号</TableHead>
                        <TableHead>购买成本</TableHead>
                        <TableHead>总收入</TableHead>
                        <TableHead>净收益</TableHead>
                        <TableHead>ROI</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                        <TableHead className="text-right">删除</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((item, index) => {
                        const roiPercent = item.roi || 0
                        const roiDisplay = `${roiPercent >= 0 ? '+' : ''}${roiPercent.toFixed(1)}%`

                        return (
                          <TableRow key={item.id}>
                            <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {getCategoryIcon(item.category?.name) && (
                                  <span className="flex-shrink-0">{getCategoryIcon(item.category?.name)}</span>
                                )}
                                <div>
                                  <div>{item.name}</div>
                                  {item.brand && item.model && (
                                    <div className="text-sm text-muted-foreground">
                                      {item.brand} {item.model}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{item.category?.name || '-'}</TableCell>
                            <TableCell>
                              <code className="rounded bg-muted px-2 py-1 text-xs">{item.serial_number || '未设置'}</code>
                            </TableCell>
                            <TableCell>{formatCurrency(item.purchase_price)}</TableCell>
                            <TableCell>{formatCurrency(item.total_revenue || 0)}</TableCell>
                            <TableCell
                              className={cn(
                                'font-medium',
                                (item.net_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                              )}
                            >
                              {formatCurrency(item.net_profit || 0)}
                            </TableCell>
                            <TableCell>
                              <div className="min-w-[150px] space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className={roiPercent >= 0 ? 'text-green-600' : 'text-red-600'}>{roiDisplay}</span>
                                  <TrendingUp
                                    className={`h-4 w-4 ${roiPercent >= 0 ? 'text-green-600' : 'rotate-180 text-red-600'}`}
                                  />
                                </div>
                                <Progress value={Math.min(Math.max(roiPercent, 0), 100)} className="h-2" />
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={getStatusBadgeVariant(item.status)}>{getStatusLabel(item.status)}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/items/${item.id}`}>查看</Link>
                              </Button>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setItemToDelete(item)
                                  setDeleteDialogOpen(true)
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
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
