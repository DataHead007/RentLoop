/**
 * 性能监控工具
 * 用于测量和记录前端操作、API 请求等性能指标
 */

export interface PerformanceStats {
  count: number
  min: number
  max: number
  avg: number
  median: number
  p95: number
  p99: number
}

export class PerformanceMonitor {
  private static metrics: Map<string, number[]> = new Map()
  
  /**
   * 记录前端操作耗时
   */
  static measureClient<T>(name: string, fn: () => T | Promise<T>): T | Promise<T> {
    const start = performance.now()
    const result = fn()
    
    if (result instanceof Promise) {
      return result.then((value) => {
        const duration = performance.now() - start
        this.recordMetric(`client:${name}`, duration)
        return value
      }) as Promise<T>
    } else {
      const duration = performance.now() - start
      this.recordMetric(`client:${name}`, duration)
      return result
    }
  }
  
  /**
   * 记录 API 请求响应时间
   */
  static async measureAPI(name: string, fetchFn: () => Promise<Response>) {
    const start = performance.now()
    try {
      const response = await fetchFn()
      const duration = performance.now() - start
      this.recordMetric(`api:${name}`, duration)
      
      // 获取响应大小（如果可用）
      const contentLength = response.headers.get('content-length')
      const size = contentLength ? parseInt(contentLength, 10) : null
      
      return {
        response,
        duration,
        size
      }
    } catch (error) {
      const duration = performance.now() - start
      this.recordMetric(`api:${name}:error`, duration)
      throw error
    }
  }
  
  /**
   * 记录自定义指标
   */
  static record(name: string, duration: number) {
    this.recordMetric(name, duration)
  }
  
  /**
   * 开始一个计时器，返回结束函数
   */
  static startTimer(name: string): () => number {
    const start = performance.now()
    return () => {
      const duration = performance.now() - start
      this.recordMetric(name, duration)
      return duration
    }
  }
  
  /**
   * 记录指标到内存
   */
  private static recordMetric(name: string, duration: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    const records = this.metrics.get(name)!
    records.push(duration)
    
    // 只保留最近 1000 次记录
    if (records.length > 1000) {
      records.shift()
    }
    
    // 在开发环境下输出到控制台
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`)
    }
  }
  
  /**
   * 获取指定指标的统计信息
   */
  static getStats(name: string): PerformanceStats | null {
    const records = this.metrics.get(name)
    if (!records || records.length === 0) return null
    
    const sorted = [...records].sort((a, b) => a - b)
    const sum = records.reduce((a, b) => a + b, 0)
    
    return {
      count: records.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / records.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1],
      p99: sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1]
    }
  }
  
  /**
   * 获取所有指标的统计信息
   */
  static getAllStats(): Record<string, PerformanceStats> {
    const stats: Record<string, PerformanceStats> = {}
    this.metrics.forEach((records, name) => {
      const stat = this.getStats(name)
      if (stat) {
        stats[name] = stat
      }
    })
    return stats
  }
  
  /**
   * 获取指定指标的所有原始数据
   */
  static getRawData(name: string): number[] | null {
    return this.metrics.get(name) || null
  }
  
  /**
   * 清除指定指标的数据
   */
  static clear(name?: string) {
    if (name) {
      this.metrics.delete(name)
    } else {
      this.metrics.clear()
    }
  }
  
  /**
   * 导出所有指标为 JSON（用于保存基线数据）
   */
  static export(): string {
    return JSON.stringify(this.getAllStats(), null, 2)
  }
  
  /**
   * 从 JSON 导入指标（用于加载基线数据）
   */
  static import(json: string): void {
    try {
      const stats = JSON.parse(json) as Record<string, PerformanceStats>
      // 注意：导入的是统计信息，不是原始数据，所以只能用于对比
      // 如果需要保存原始数据，应该导出原始数组
      console.log('[Performance] Baseline loaded:', Object.keys(stats).length, 'metrics')
    } catch (error) {
      console.error('[Performance] Failed to import baseline:', error)
    }
  }
  
  /**
   * 导出原始数据（用于完整保存和恢复）
   */
  static exportRaw(): string {
    const data: Record<string, number[]> = {}
    this.metrics.forEach((records, name) => {
      data[name] = records
    })
    return JSON.stringify(data, null, 2)
  }
  
  /**
   * 从原始数据导入
   */
  static importRaw(json: string): void {
    try {
      const data = JSON.parse(json) as Record<string, number[]>
      Object.entries(data).forEach(([name, records]) => {
        this.metrics.set(name, records)
      })
      console.log('[Performance] Raw data loaded:', Object.keys(data).length, 'metrics')
    } catch (error) {
      console.error('[Performance] Failed to import raw data:', error)
    }
  }
}

// 在浏览器全局对象上暴露，方便在控制台使用
if (typeof window !== 'undefined') {
  (window as any).PerformanceMonitor = PerformanceMonitor
  ;(window as any).getPerformanceStats = () => {
    const stats = PerformanceMonitor.getAllStats()
    console.table(
      Object.entries(stats).map(([key, value]) => ({
        操作: key,
        次数: value.count,
        平均: `${value.avg.toFixed(2)}ms`,
        最小: `${value.min.toFixed(2)}ms`,
        最大: `${value.max.toFixed(2)}ms`,
        中位数: `${value.median.toFixed(2)}ms`,
        P95: `${value.p95.toFixed(2)}ms`,
        P99: `${value.p99.toFixed(2)}ms`
      }))
    )
    return stats
  }
}
