'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Minus, 
  Edit, 
  Trash2, 
  CalendarIcon, 
  X, 
  Sparkles,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Activity
} from 'lucide-react'
import type { TransactionChangeEvent } from '@/lib/types/database'
import Link from 'next/link'
import { formatCurrency, formatDateShort } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ChangeEventListMobileCard } from './ChangeEventListMobileCard'

interface ChangeEventStats {
  totalDeltaIncome: number
  totalDeltaExpense: number
  totalDeltaNetProfit: number
  totalEvents: number
  insertCount: number
  updateCount: number
  deleteCount: number
  autoCreatedCount: number
  manualCount: number
}

type DateRangePreset = 'today' | 'week' | 'month' | 'all' | 'custom'

export function ChangeEventList() {
  const [events, setEvents] = useState<TransactionChangeEvent[]>([])
  const [stats, setStats] = useState<ChangeEventStats>({
    totalDeltaIncome: 0,
    totalDeltaExpense: 0,
    totalDeltaNetProfit: 0,
    totalEvents: 0,
    insertCount: 0,
    updateCount: 0,
    deleteCount: 0,
    autoCreatedCount: 0,
    manualCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  
  // 筛选状态
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('all')
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [autoCreatedFilter, setAutoCreatedFilter] = useState<string>('all')
  
  // 计算日期范围
  const getDateRange = (preset: DateRangePreset) => {
    const now = new Date()
    let start: Date
    let end: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    switch (preset) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        start = new Date(now)
        start.setDate(now.getDate() - 7)
        break
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'all':
        return { start: undefined, end: undefined }
      default:
        return { start: undefined, end: undefined }
    }
    
    return { start, end }
  }

  // 当预设改变时，更新日期范围
  useEffect(() => {
    if (dateRangePreset !== 'custom') {
      const range = getDateRange(dateRangePreset)
      setStartDate(range.start)
      setEndDate(range.end)
    }
  }, [dateRangePreset])

  // 主数据加载
  useEffect(() => {
    if (dateRangePreset !== 'custom' || (startDate && endDate)) {
      Promise.all([loadEvents(), loadStats()]).catch(console.error)
    }
  }, [dateRangePreset, startDate, endDate, actionFilter, autoCreatedFilter])

  async function loadEvents() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      
      if (startDate) {
        params.append('startDate', format(startDate, 'yyyy-MM-dd'))
      }
      if (endDate) {
        params.append('endDate', format(endDate, 'yyyy-MM-dd'))
      }
      if (actionFilter !== 'all') {
        params.append('action', actionFilter)
      }
      if (autoCreatedFilter !== 'all') {
        params.append('autoCreated', autoCreatedFilter)
      }
      params.append('limit', '200')
      
      const response = await fetch(`/api/change-events?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch events')
      
      const data = await response.json()
      setEvents(data.events || [])
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Failed to load events:', error)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  async function loadStats() {
    try {
      const params = new URLSearchParams()
      
      if (startDate) {
        params.append('startDate', format(startDate, 'yyyy-MM-dd'))
      }
      if (endDate) {
        params.append('endDate', format(endDate, 'yyyy-MM-dd'))
      }
      
      const response = await fetch(`/api/change-events/stats?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch stats')
      
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const handleResetFilters = () => {
    setDateRangePreset('all')
    setActionFilter('all')
    setAutoCreatedFilter('all')
    setStartDate(undefined)
    setEndDate(undefined)
  }

  const hasActiveFilters = actionFilter !== 'all' || autoCreatedFilter !== 'all' || dateRangePreset !== 'all'

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'insert':
        return (
          <Badge variant="success" className="gap-1">
            <Plus className="h-3 w-3" />
            新增
          </Badge>
        )
      case 'update':
        return (
          <Badge variant="outline" className="gap-1">
            <Edit className="h-3 w-3" />
            修改
          </Badge>
        )
      case 'delete':
        return (
          <Badge variant="destructive" className="gap-1">
            <Trash2 className="h-3 w-3" />
            删除
          </Badge>
        )
      default:
        return <Badge variant="secondary">{action}</Badge>
    }
  }

  const formatDelta = (value: number, type: 'income' | 'expense' | 'net') => {
    if (value === 0) return <span className="text-muted-foreground">-</span>
    
    const isPositive = value > 0
    const color = type === 'net' 
      ? (isPositive ? 'text-green-600' : 'text-red-600')
      : (type === 'income' 
          ? (isPositive ? 'text-green-600' : 'text-red-600')
          : (isPositive ? 'text-red-600' : 'text-green-600'))
    
    return (
      <span className={cn('font-medium', color)}>
        {isPositive ? '+' : ''}{formatCurrency(value)}
      </span>
    )
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return format(date, 'MM-dd HH:mm:ss')
  }

  if (loading && events.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">加载中...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">变更追踪</h2>
          <p className="text-sm text-muted-foreground sm:text-base">追踪收入、支出和净利润的每一次变化</p>
        </div>
        <Button variant="outline" className="w-full shrink-0 sm:w-auto" onClick={() => { loadEvents(); loadStats(); }}>
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">收入变化</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-semibold tabular-nums",
              stats.totalDeltaIncome >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {stats.totalDeltaIncome >= 0 ? '+' : ''}{formatCurrency(stats.totalDeltaIncome)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">支出变化</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-semibold tabular-nums",
              stats.totalDeltaExpense > 0 ? "text-red-600" : "text-green-600"
            )}>
              {stats.totalDeltaExpense > 0 ? '+' : ''}{formatCurrency(stats.totalDeltaExpense)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">净利润变化</CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-semibold tabular-nums",
              stats.totalDeltaNetProfit >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {stats.totalDeltaNetProfit >= 0 ? '+' : ''}{formatCurrency(stats.totalDeltaNetProfit)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">变更次数</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{stats.totalEvents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              新增 {stats.insertCount} / 修改 {stats.updateCount} / 删除 {stats.deleteCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 筛选条件 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* 时间范围预设 */}
            <div className="space-y-2">
              <Label>时间范围</Label>
              <Select value={dateRangePreset} onValueChange={(value) => setDateRangePreset(value as DateRangePreset)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">今天</SelectItem>
                  <SelectItem value="week">最近7天</SelectItem>
                  <SelectItem value="month">本月</SelectItem>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="custom">自定义</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 自定义日期范围 */}
            {dateRangePreset === 'custom' && (
              <>
                <div className="space-y-2">
                  <Label>开始日期</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, 'yyyy-MM-dd') : '选择日期'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-2">
                  <Label>结束日期</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, 'yyyy-MM-dd') : '选择日期'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}

            {/* 操作类型筛选 */}
            <div className="space-y-2">
              <Label>操作类型</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="insert">新增</SelectItem>
                  <SelectItem value="update">修改</SelectItem>
                  <SelectItem value="delete">删除</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 来源筛选 */}
            <div className="space-y-2">
              <Label>来源</Label>
              <Select value={autoCreatedFilter} onValueChange={setAutoCreatedFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="true">自动生成</SelectItem>
                  <SelectItem value="false">手动操作</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                <X className="mr-2 h-4 w-4" />
                清除筛选
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 事件列表 */}
      {events.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">暂无变更记录</h3>
                <p className="text-muted-foreground">
                  {hasActiveFilters ? '当前筛选条件下没有变更记录' : '还没有任何交易变更记录'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>变更记录</CardTitle>
            <CardDescription>共 {total} 条记录，显示最近 {events.length} 条</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 px-4 pb-6 pt-0 sm:px-6">
            <div className="space-y-3 lg:hidden">
              {events.map((event) => (
                <ChangeEventListMobileCard key={event.id} event={event} />
              ))}
            </div>
            <div className="hidden min-w-0 lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">时间</TableHead>
                    <TableHead className="w-[80px]">操作</TableHead>
                    <TableHead>摘要</TableHead>
                    <TableHead className="w-[100px]">类别</TableHead>
                    <TableHead className="w-[100px] text-right">收入Δ</TableHead>
                    <TableHead className="w-[100px] text-right">支出Δ</TableHead>
                    <TableHead className="w-[100px] text-right">净利润Δ</TableHead>
                    <TableHead className="w-[80px]">来源</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-mono text-xs">{formatDateTime(event.created_at)}</TableCell>
                      <TableCell>{getActionBadge(event.action)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm">{event.summary || '-'}</span>
                          {event.description && (
                            <span className="max-w-[200px] truncate text-xs text-muted-foreground">
                              {event.description}
                            </span>
                          )}
                          <div className="flex gap-2 text-xs">
                            {event.order_id && (
                              <Link href={`/orders/${event.order_id}`} className="text-primary hover:underline">
                                订单 {event.order_id.slice(0, 8)}...
                              </Link>
                            )}
                            {event.item_id && (
                              <Link href={`/items/${event.item_id}`} className="text-primary hover:underline">
                                资产 {event.item_id.slice(0, 8)}...
                              </Link>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{event.category || '-'}</span>
                      </TableCell>
                      <TableCell className="text-right">{formatDelta(event.delta_income, 'income')}</TableCell>
                      <TableCell className="text-right">{formatDelta(event.delta_expense, 'expense')}</TableCell>
                      <TableCell className="text-right">{formatDelta(event.delta_net_profit, 'net')}</TableCell>
                      <TableCell>
                        {event.auto_created ? (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Sparkles className="h-3 w-3" />
                            自动
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            手动
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
