/**
 * 数据一致性日志工具
 * 用于记录和对比不同 API 的查询结果，帮助发现数据不一致问题
 */

interface QueryEntry {
  api: string
  time: number
  result: any
  metadata?: Record<string, any>
}

export class DataConsistencyLogger {
  private static queries: Map<string, QueryEntry[]> = new Map()

  /**
   * 记录查询结果
   */
  static logQuery(
    apiName: string,
    queryKey: string,
    result: any,
    metadata?: Record<string, any>
  ) {
    const timestamp = Date.now()
    const logEntry: QueryEntry = {
      api: apiName,
      time: timestamp,
      result,
      metadata,
    }

    // 存储查询结果（保留最近的 10 次查询）
    if (!this.queries.has(queryKey)) {
      this.queries.set(queryKey, [])
    }
    const entries = this.queries.get(queryKey)!
    entries.push(logEntry)
    if (entries.length > 10) {
      entries.shift() // 只保留最近的 10 次
    }

    // 输出详细日志
    const resultCount = Array.isArray(result) ? result.length : 1
    console.log(`[${apiName}] Query: ${queryKey}`, {
      timestamp: new Date(timestamp).toISOString(),
      resultCount,
      metadata,
      sample: Array.isArray(result) && result.length > 0 ? result[0] : result,
    })

    // 检查数据一致性
    this.checkConsistency(queryKey)
  }

  /**
   * 检查数据一致性
   */
  private static checkConsistency(queryKey: string) {
    const entries = this.queries.get(queryKey) || []
    if (entries.length < 2) return

    // 对比最近的两次查询
    const sortedEntries = [...entries].sort((a, b) => b.time - a.time)
    const [latest, previous] = sortedEntries
    const latestData = latest.result
    const previousData = previous.result

    // 深度对比
    if (!this.deepEqual(latestData, previousData)) {
      const diff = this.getDiff(latestData, previousData)
      console.warn(`⚠️ [DATA INCONSISTENCY] Query "${queryKey}" returned different results:`, {
        latest: {
          api: latest.api,
          time: new Date(latest.time).toISOString(),
          count: Array.isArray(latestData) ? latestData.length : 1,
        },
        previous: {
          api: previous.api,
          time: new Date(previous.time).toISOString(),
          count: Array.isArray(previousData) ? previousData.length : 1,
        },
        diff,
      })
    }
  }

  /**
   * 深度对比两个对象
   */
  private static deepEqual(a: any, b: any): boolean {
    if (a === b) return true

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false
      for (let i = 0; i < a.length; i++) {
        if (!this.deepEqual(a[i], b[i])) return false
      }
      return true
    }

    if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
      const keysA = Object.keys(a)
      const keysB = Object.keys(b)
      if (keysA.length !== keysB.length) return false

      for (const key of keysA) {
        if (!keysB.includes(key)) return false
        if (!this.deepEqual(a[key], b[key])) return false
      }
      return true
    }

    return false
  }

  /**
   * 获取两个对象的差异
   */
  private static getDiff(a: any, b: any): any {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) {
        return { lengthMismatch: { a: a.length, b: b.length } }
      }

      const diff: any[] = []
      for (let i = 0; i < a.length; i++) {
        if (!this.deepEqual(a[i], b[i])) {
          // 输出完整的差异对象，而不是 [Object]
          diff.push({ 
            index: i, 
            a: JSON.parse(JSON.stringify(a[i])), // 深拷贝，确保输出完整
            b: JSON.parse(JSON.stringify(b[i])) 
          })
        }
      }
      return diff.length > 0 ? diff : null
    }

    if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
      const diff: Record<string, any> = {}
      const allKeys = new Set([...Object.keys(a), ...Object.keys(b)])

      for (const key of allKeys) {
        if (!this.deepEqual(a[key], b[key])) {
          diff[key] = { a: a[key], b: b[key] }
        }
      }

      return Object.keys(diff).length > 0 ? diff : null
    }

    return { a, b }
  }

  /**
   * 清空所有查询记录
   */
  static clear() {
    this.queries.clear()
  }

  /**
   * 获取指定查询的所有记录
   */
  static getQueryHistory(queryKey: string): QueryEntry[] {
    return this.queries.get(queryKey) || []
  }
}
