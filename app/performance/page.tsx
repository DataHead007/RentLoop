'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PerformanceMonitor, type PerformanceStats } from '@/lib/utils/performance'
import { Download, Upload, Trash2, TrendingUp, TrendingDown, RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react'
import { forceSync } from '@/lib/supabase/cachedQueries'
import type { CacheTable } from '@/lib/storage/localCache'

interface SyncStatus {
  table: string
  localCount: number
  supabaseCount: number
  isSynced: boolean
  isSyncing: boolean
  lastSync: string | null
  syncAge: number | null
  syncError: string | null
}

export default function PerformancePage() {
  const [stats, setStats] = useState<Record<string, PerformanceStats>>({})
  const [baseline, setBaseline] = useState<Record<string, PerformanceStats> | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus[]>([])
  const [loadingSyncStatus, setLoadingSyncStatus] = useState(false)
  const [syncingTable, setSyncingTable] = useState<string | null>(null)
  
  // 加载同步状态（客户端检查本地缓存并对比）
  async function loadSyncStatus() {
    try {
      setLoadingSyncStatus(true)
      
      // 1. 获取 Supabase 数据（从 API）
      const response = await fetch('/api/sync-status')
      if (!response.ok) throw new Error('Failed to fetch sync status')
      const data = await response.json()
      
      // 2. 获取本地缓存数据（在客户端）
      const { localCache } = await import('@/lib/storage/localCache')
      
      const statusWithLocal = await Promise.all(
        data.status.map(async (supabaseStatus: any) => {
          // 获取本地缓存数量
          const localData = await localCache.get(supabaseStatus.table)
          const localCount = localData.length
          
          // 获取最后同步时间
          const lastSync = await localCache.getLastSync(supabaseStatus.table)
          const isSyncing = localCache.isSyncing(supabaseStatus.table)
          
          // 计算同步状态
          const isSynced = localCount === supabaseStatus.supabaseCount && !supabaseStatus.syncError
          const syncAge = lastSync ? Date.now() - lastSync : null
          const syncAgeSeconds = syncAge ? Math.floor(syncAge / 1000) : null
          
          return {
            ...supabaseStatus,
            localCount,
            isSynced,
            isSyncing,
            lastSync: lastSync ? new Date(lastSync).toISOString() : null,
            syncAge: syncAgeSeconds,
          }
        })
      )
      
      setSyncStatus(statusWithLocal)
    } catch (error) {
      console.error('Failed to load sync status:', error)
    } finally {
      setLoadingSyncStatus(false)
    }
  }

  // 手动强制同步
  async function handleForceSync(table: CacheTable) {
    try {
      setSyncingTable(table)
      await forceSync(table)
      // 等待一小段时间让同步完成
      await new Promise(resolve => setTimeout(resolve, 500))
      // 重新加载状态
      await loadSyncStatus()
    } catch (error) {
      console.error(`Failed to sync ${table}:`, error)
      alert(`同步 ${table} 失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setSyncingTable(null)
    }
  }

  useEffect(() => {
    // 立即加载一次
    setStats(PerformanceMonitor.getAllStats())
    loadSyncStatus()
    
    // 加载保存的基线
    const savedBaseline = localStorage.getItem('performance-baseline')
    if (savedBaseline) {
      try {
        setBaseline(JSON.parse(savedBaseline))
      } catch (e) {
        console.error('Failed to load baseline:', e)
      }
    }
    
    // 每 2 秒更新一次统计数据
    const statsInterval = setInterval(() => {
      setStats(PerformanceMonitor.getAllStats())
    }, 2000)
    
    // 每 10 秒更新一次同步状态
    const syncInterval = setInterval(() => {
      loadSyncStatus()
    }, 10000)
    
    return () => {
      clearInterval(statsInterval)
      clearInterval(syncInterval)
    }
  }, [])
  
  function saveBaseline() {
    const currentStats = PerformanceMonitor.getAllStats()
    setBaseline(currentStats)
    localStorage.setItem('performance-baseline', PerformanceMonitor.export())
    localStorage.setItem('performance-baseline-raw', PerformanceMonitor.exportRaw())
    alert('基线已保存！现在可以进行优化，然后回来对比效果。')
  }
  
  function loadBaseline() {
    const saved = localStorage.getItem('performance-baseline')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setBaseline(parsed)
        PerformanceMonitor.import(saved)
        alert('基线已加载！')
      } catch (e) {
        alert('加载基线失败：' + (e instanceof Error ? e.message : '未知错误'))
      }
    } else {
      alert('没有找到保存的基线数据')
    }
  }
  
  function clearStats() {
    if (confirm('确定要清除所有性能数据吗？基线数据不会被清除。')) {
      PerformanceMonitor.clear()
      setStats({})
    }
  }
  
  function exportData() {
    const data = {
      stats: PerformanceMonitor.getAllStats(),
      raw: PerformanceMonitor.exportRaw(),
      timestamp: new Date().toISOString()
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `performance-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  function compare(baseline: Record<string, PerformanceStats>, current: Record<string, PerformanceStats>) {
    const result: Record<string, {
      baseline: string
      current: string
      improvement: string
      faster: boolean
      count: number
    }> = {}
    
    Object.keys(current).forEach(key => {
      const currentStat = current[key]
      const baselineStat = baseline[key]
      
      if (baselineStat) {
        const improvement = ((baselineStat.avg - currentStat.avg) / baselineStat.avg * 100)
        result[key] = {
          baseline: baselineStat.avg.toFixed(2),
          current: currentStat.avg.toFixed(2),
          improvement: `${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`,
          faster: improvement > 0,
          count: currentStat.count
        }
      }
    })
    
    return result
  }
  
  const comparison = baseline && stats ? compare(baseline, stats) : null
  const statEntries = Object.entries(stats).sort((a, b) => b[1].count - a[1].count)
  
  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">性能监控</h2>
        <p className="text-muted-foreground">实时监控和对比性能指标</p>
      </div>

      {/* 操作按钮 */}
      <Card>
        <CardHeader>
          <CardTitle>操作</CardTitle>
          <CardDescription>保存基线数据以对比优化效果</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveBaseline} className="gap-2">
              <Download className="h-4 w-4" />
              保存基线（优化前）
            </Button>
            <Button onClick={loadBaseline} variant="outline" className="gap-2">
              <Upload className="h-4 w-4" />
              加载基线
            </Button>
            <Button onClick={clearStats} variant="outline" className="gap-2">
              <Trash2 className="h-4 w-4" />
              清除数据
            </Button>
            <Button onClick={exportData} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              导出数据
            </Button>
          </div>
          {baseline && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>基线已加载：</strong>
                已加载 {Object.keys(baseline).length} 个指标的基线数据
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 对比结果 */}
      {comparison && Object.keys(comparison).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>对比结果（vs 基线）</CardTitle>
            <CardDescription>显示当前性能与基线的对比，绿色表示改善，红色表示变慢</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(comparison)
                .sort((a, b) => {
                  const aImprovement = parseFloat(a[1].improvement.replace('%', ''))
                  const bImprovement = parseFloat(b[1].improvement.replace('%', ''))
                  return bImprovement - aImprovement
                })
                .map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{key}</div>
                      <div className="text-sm text-muted-foreground">
                        执行次数: {value.count}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">基线</div>
                        <div className="font-mono">{value.baseline}ms</div>
                      </div>
                      <div className="text-lg">→</div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">当前</div>
                        <div className="font-mono">{value.current}ms</div>
                      </div>
                      <div className="text-right min-w-[100px]">
                        <div className="text-sm text-muted-foreground">改善</div>
                        <Badge 
                          variant={value.faster ? "default" : "destructive"}
                          className="gap-1"
                        >
                          {value.faster ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {value.improvement}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 当前指标 */}
      <Card>
        <CardHeader>
          <CardTitle>当前性能指标</CardTitle>
          <CardDescription>
            实时更新的性能统计数据，按执行次数排序
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无性能数据，访问其他页面进行操作后数据会显示在这里
            </div>
          ) : (
            <div className="space-y-4">
              {statEntries.map(([key, value]) => (
                <div key={key} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-medium">{key}</div>
                    <Badge variant="outline">执行 {value.count} 次</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">平均</div>
                      <div className="font-mono font-medium">{value.avg.toFixed(2)}ms</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">最小</div>
                      <div className="font-mono">{value.min.toFixed(2)}ms</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">最大</div>
                      <div className="font-mono">{value.max.toFixed(2)}ms</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">中位数</div>
                      <div className="font-mono">{value.median.toFixed(2)}ms</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">P95</div>
                      <div className="font-mono">{value.p95.toFixed(2)}ms</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">P99</div>
                      <div className="font-mono">{value.p99.toFixed(2)}ms</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>1. 保存基线：</strong>
            在进行任何优化之前，先访问各个页面（资产列表、订单列表等），让系统收集性能数据，然后点击"保存基线"。
          </p>
          <p>
            <strong>2. 进行优化：</strong>
            实施性能优化代码后，再次访问相同的页面。
          </p>
          <p>
            <strong>3. 查看对比：</strong>
            回到这个页面，系统会自动显示优化前后的对比结果。绿色表示性能提升，红色表示变慢。
          </p>
          <p>
            <strong>4. 控制台工具：</strong>
            在浏览器控制台可以使用 <code className="bg-muted px-1 rounded">getPerformanceStats()</code> 查看表格形式的统计数据。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
