/**
 * 本地缓存管理器
 * 使用 IndexedDB 存储数据，提供快速本地访问
 * Supabase 仍然是唯一真实数据源
 */

const DB_NAME = 'rentloop_cache'
const DB_VERSION = 1

export type CacheTable = 'items' | 'orders' | 'customers' | 'categories' | 'transactions'

interface CacheMetadata {
  lastSync: number // 最后同步时间戳
  version: number // 数据版本号
}

class LocalCacheManager {
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null
  private syncStatus: Map<CacheTable, boolean> = new Map()

  /**
   * 初始化 IndexedDB
   */
  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        console.error('[LocalCache] Failed to open IndexedDB:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        console.log('[LocalCache] IndexedDB initialized')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // 创建对象存储（表）
        const tables: CacheTable[] = ['items', 'orders', 'customers', 'categories', 'transactions']
        
        tables.forEach(table => {
          if (!db.objectStoreNames.contains(table)) {
            const store = db.createObjectStore(table, { keyPath: 'id' })
            // 创建索引用于快速查询
            store.createIndex('updated_at', 'updated_at', { unique: false })
            store.createIndex('created_at', 'created_at', { unique: false })
          }
        })

        // 创建元数据存储
        if (!db.objectStoreNames.contains('_metadata')) {
          db.createObjectStore('_metadata', { keyPath: 'key' })
        }
      }
    })

    return this.initPromise
  }

  /**
   * 确保数据库已初始化
   */
  private async ensureInit(): Promise<void> {
    if (!this.db) {
      await this.init()
    }
  }

  /**
   * 从本地缓存读取数据
   */
  async get<T>(table: CacheTable): Promise<T[]> {
    await this.ensureInit()
    
    if (!this.db) {
      return []
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([table], 'readonly')
      const store = transaction.objectStore(table)
      const request = store.getAll()

      request.onsuccess = () => {
        const items = request.result || []
        // 移除元数据字段，只返回数据
        const data = items.map((item: any) => {
          const { _cached_at, ...rest } = item
          return rest
        })
        resolve(data as T[])
      }

      request.onerror = () => {
        console.error(`[LocalCache] Failed to read from ${table}:`, request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 获取单个记录
   */
  async getById<T>(table: CacheTable, id: string): Promise<T | null> {
    await this.ensureInit()
    
    if (!this.db) {
      return null
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([table], 'readonly')
      const store = transaction.objectStore(table)
      const request = store.get(id)

      request.onsuccess = () => {
        const item = request.result
        if (!item) {
          resolve(null)
          return
        }
        // 移除元数据字段
        const { _cached_at, ...rest } = item
        resolve(rest as T)
      }

      request.onerror = () => {
        console.error(`[LocalCache] Failed to read ${table}:${id}:`, request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 保存数据到本地缓存
   */
  async set<T extends { id: string }>(table: CacheTable, items: T[]): Promise<void> {
    await this.ensureInit()
    
    if (!this.db) {
      return
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([table], 'readwrite')
      const store = transaction.objectStore(table)

      // 清空现有数据
      store.clear()

      // 添加新数据（带缓存时间戳）
      let count = 0
      if (items.length === 0) {
        resolve()
        return
      }

      items.forEach(item => {
        const itemWithMetadata = {
          ...item,
          _cached_at: Date.now()
        }
        const request = store.put(itemWithMetadata)
        
        request.onsuccess = () => {
          count++
          if (count === items.length) {
            // 更新元数据
            this.updateMetadata(table).then(() => resolve()).catch(reject)
          }
        }

        request.onerror = () => {
          console.error(`[LocalCache] Failed to write to ${table}:`, request.error)
          reject(request.error)
        }
      })
    })
  }

  /**
   * 添加或更新单个记录
   */
  async put<T extends { id: string }>(table: CacheTable, item: T): Promise<void> {
    await this.ensureInit()
    
    if (!this.db) {
      return
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([table], 'readwrite')
      const store = transaction.objectStore(table)
      
      const itemWithMetadata = {
        ...item,
        _cached_at: Date.now()
      }
      
      const request = store.put(itemWithMetadata)

      request.onsuccess = () => {
        this.updateMetadata(table).then(() => resolve()).catch(reject)
      }

      request.onerror = () => {
        console.error(`[LocalCache] Failed to put ${table}:${item.id}:`, request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 删除单个记录
   */
  async delete(table: CacheTable, id: string): Promise<void> {
    await this.ensureInit()
    
    if (!this.db) {
      return
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([table], 'readwrite')
      const store = transaction.objectStore(table)
      const request = store.delete(id)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        console.error(`[LocalCache] Failed to delete ${table}:${id}:`, request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 更新元数据
   */
  private async updateMetadata(table: CacheTable): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['_metadata'], 'readwrite')
      const store = transaction.objectStore('_metadata')
      
      const metadata: CacheMetadata = {
        lastSync: Date.now(),
        version: Date.now() // 使用时间戳作为版本号
      }
      
      const request = store.put({ key: table, ...metadata })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 获取最后同步时间
   */
  async getLastSync(table: CacheTable): Promise<number | null> {
    await this.ensureInit()
    
    if (!this.db) {
      return null
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['_metadata'], 'readonly')
      const store = transaction.objectStore('_metadata')
      const request = store.get(table)

      request.onsuccess = () => {
        const metadata = request.result as CacheMetadata | undefined
        resolve(metadata?.lastSync || null)
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  /**
   * 清除指定表的数据
   */
  async clear(table: CacheTable): Promise<void> {
    await this.ensureInit()
    
    if (!this.db) {
      return
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([table], 'readwrite')
      const store = transaction.objectStore(table)
      const request = store.clear()

      request.onsuccess = () => {
        // 清除元数据
        const metadataTransaction = this.db!.transaction(['_metadata'], 'readwrite')
        const metadataStore = metadataTransaction.objectStore('_metadata')
        metadataStore.delete(table)
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  /**
   * 清除所有缓存
   */
  async clearAll(): Promise<void> {
    await this.ensureInit()
    
    if (!this.db) {
      return
    }

    const tables: CacheTable[] = ['items', 'orders', 'customers', 'categories', 'transactions']
    await Promise.all(tables.map(table => this.clear(table)))
    console.log('[LocalCache] All cache cleared')
  }

  /**
   * 检查是否需要同步（基于时间）
   */
  async shouldSync(table: CacheTable, maxAge: number = 30000): Promise<boolean> {
    const lastSync = await this.getLastSync(table)
    if (!lastSync) {
      return true // 从未同步过
    }
    
    const age = Date.now() - lastSync
    return age > maxAge // 超过 maxAge 毫秒需要同步
  }

  /**
   * 标记正在同步
   */
  setSyncing(table: CacheTable, syncing: boolean): void {
    this.syncStatus.set(table, syncing)
  }

  /**
   * 检查是否正在同步
   */
  isSyncing(table: CacheTable): boolean {
    return this.syncStatus.get(table) || false
  }
}

// 单例模式
export const localCache = new LocalCacheManager()

// 在页面加载时初始化
if (typeof window !== 'undefined') {
  localCache.init().catch(error => {
    console.error('[LocalCache] Initialization failed:', error)
  })
}
