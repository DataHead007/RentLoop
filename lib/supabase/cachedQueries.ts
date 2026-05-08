/**
 * 带本地缓存的数据查询层
 * 优先从本地缓存读取（快），后台从 Supabase 同步（确保数据最新）
 */

import { localCache, type CacheTable } from '@/lib/storage/localCache'
import type { Item, ItemWithStats, Order, Customer, Category } from '@/lib/types/database'
import { 
  getItems as getItemsFromSupabase,
  getItemsWithStats as getItemsWithStatsFromSupabase,
  getOrders as getOrdersFromSupabase,
  getOrder as getOrderFromSupabase,
  getCustomers as getCustomersFromSupabase,
  getCategories as getCategoriesFromSupabase,
} from './queries'

/**
 * 同步间隔（毫秒）
 */
const SYNC_INTERVAL: Record<CacheTable, number> = {
  items: 30000,      // 30秒
  orders: 10000,     // 10秒
  customers: 60000,  // 60秒
  categories: 300000, // 5分钟（品类变化较少）
  transactions: 30000, // 30秒
}

/**
 * 从 Supabase 同步数据到本地缓存
 */
async function syncFromSupabase<T extends { id: string }>(
  table: CacheTable,
  fetchFn: () => Promise<T[]>
): Promise<T[]> {
  try {
    // 标记正在同步
    if (localCache.isSyncing(table)) {
      // 如果正在同步，返回本地缓存
      return await localCache.get<T>(table)
    }

    localCache.setSyncing(table, true)
    
    // 从 Supabase 获取最新数据
    const data = await fetchFn()
    
    // 保存到本地缓存
    await localCache.set(table, data)
    
    console.log(`[LocalCache] Synced ${table}: ${data.length} items`)
    
    return data
  } catch (error) {
    const errorInfo = error instanceof Error
      ? { message: error.message, stack: error.stack, name: error.name }
      : { raw: error, json: (() => { try { return JSON.stringify(error) } catch { return '[unserializable]' } })() }
    console.error(`[LocalCache] Failed to sync ${table}:`, errorInfo)
    // 同步失败时返回本地缓存
    return await localCache.get<T>(table)
  } finally {
    localCache.setSyncing(table, false)
  }
}

/**
 * 获取资产列表（带缓存）
 */
export async function getItemsCached(): Promise<Item[]> {
  // 1. 先尝试从本地缓存读取（快）
  const cached = await localCache.get<Item>('items')
  
  // 2. 如果有缓存数据，立即返回（不阻塞）
  if (cached.length > 0) {
    // 后台检查是否需要同步（不阻塞返回）
    localCache.shouldSync('items', SYNC_INTERVAL.items).then(shouldSync => {
      if (shouldSync && !localCache.isSyncing('items')) {
        // 后台同步（异步，不等待）
        syncFromSupabase('items', getItemsFromSupabase).catch(console.error)
      }
    }).catch(console.error)
    
    return cached
  }
  
  // 3. 如果没有缓存，从 Supabase 获取并缓存
  return await syncFromSupabase('items', getItemsFromSupabase)
}

/**
 * 获取带统计的资产列表（带缓存）
 */
export async function getItemsWithStatsCached(): Promise<ItemWithStats[]> {
  // 注意：统计数据是动态计算的，不能直接缓存
  // 但我们仍然可以缓存基础数据，然后计算统计
  
  // 1. 先获取基础数据（从缓存）
  const items = await getItemsCached()
  
  // 2. 从 Supabase 获取统计数据（因为统计数据需要实时计算）
  // 这里我们可以优化：只获取统计数据，基础数据用缓存的
  // 但为了简单，暂时还是调用完整的方法
  // TODO: 未来可以拆分：缓存基础数据，单独计算统计
  
  // 检查是否需要同步基础数据
  const shouldSync = await localCache.shouldSync('items', SYNC_INTERVAL.items)
  if (shouldSync && !localCache.isSyncing('items')) {
    // 后台同步基础数据
    syncFromSupabase('items', getItemsFromSupabase).catch(console.error)
  }
  
  // 目前先返回完整的数据（包含统计）
  // 因为 getItemsWithStats 内部会批量查询，性能也还可以
  try {
    return await getItemsWithStatsFromSupabase()
  } catch (error) {
    console.error('[LocalCache] Failed to get items with stats, using cached items:', error)
    // 如果失败，返回缓存的 base items（不包含统计）
    return items.map(item => ({
      ...item,
      total_revenue: 0,
      net_profit: 0,
      total_days_rented: 0,
      roi: 0,
    }))
  }
}

/**
 * 获取订单列表（带缓存）
 */
export async function getOrdersCached(
  startDate?: string,
  endDate?: string,
  orderType?: 'rental' | 'badminton' | 'all'
): Promise<Order[]> {
  const useFilter = !!(startDate || endDate || (orderType && orderType !== 'all'))
  if (useFilter) {
    return getOrdersFromSupabase({ startDate, endDate, orderType: orderType || 'all' })
  }

  const cached = await localCache.get<Order>('orders')
  
  // 2. 如果有缓存数据，立即返回（确保按创建时间降序排序）
  if (cached.length > 0) {
    // 确保缓存数据也按创建时间降序排序（与 Supabase 查询一致）
    const sorted = [...cached].sort((a, b) => {
      const timeA = new Date(a.created_at).getTime()
      const timeB = new Date(b.created_at).getTime()
      return timeB - timeA // 降序：新的在前
    })
    
    // 后台检查是否需要同步
    localCache.shouldSync('orders', SYNC_INTERVAL.orders).then(shouldSync => {
      if (shouldSync && !localCache.isSyncing('orders')) {
        syncFromSupabase('orders', () => getOrdersFromSupabase({})).catch(console.error)
      }
    }).catch(console.error)
    
    return sorted
  }
  
  // 3. 如果没有缓存，从 Supabase 获取并缓存
  return await syncFromSupabase('orders', () => getOrdersFromSupabase({}))
}

/**
 * 获取订单详情（带缓存）
 */
export async function getOrderCached(id: string): Promise<Order | null> {
  // 1. 先尝试从本地缓存读取
  const cached = await localCache.getById<Order>('orders', id)
  
  if (cached) {
    // 后台检查是否需要同步
    localCache.shouldSync('orders', SYNC_INTERVAL.orders).then(shouldSync => {
      if (shouldSync && !localCache.isSyncing('orders')) {
        syncFromSupabase('orders', () => getOrdersFromSupabase({})).catch(console.error)
      }
    }).catch(console.error)
    
    return cached
  }
  
  // 2. 如果没有缓存，从 Supabase 获取
  const order = await getOrderFromSupabase(id)
  
  // 3. 如果获取到，缓存它
  if (order) {
    await localCache.put('orders', order)
  }
  
  return order
}

/**
 * 获取客户列表（带缓存）
 */
export async function getCustomersCached(): Promise<Customer[]> {
  const cached = await localCache.get<Customer>('customers')
  
  if (cached.length > 0) {
    localCache.shouldSync('customers', SYNC_INTERVAL.customers).then(shouldSync => {
      if (shouldSync && !localCache.isSyncing('customers')) {
        syncFromSupabase('customers', getCustomersFromSupabase).catch(console.error)
      }
    }).catch(console.error)
    
    return cached
  }
  
  return await syncFromSupabase('customers', getCustomersFromSupabase)
}

/**
 * 获取品类列表（带缓存）
 */
export async function getCategoriesCached(): Promise<Category[]> {
  const cached = await localCache.get<Category>('categories')
  
  if (cached.length > 0) {
    localCache.shouldSync('categories', SYNC_INTERVAL.categories).then(shouldSync => {
      if (shouldSync && !localCache.isSyncing('categories')) {
        syncFromSupabase('categories', getCategoriesFromSupabase).catch(console.error)
      }
    }).catch(console.error)
    
    return cached
  }
  
  return await syncFromSupabase('categories', getCategoriesFromSupabase)
}

/**
 * 更新本地缓存（在创建/更新/删除后调用）
 */
export async function updateCache(table: CacheTable, data: any): Promise<void> {
  if (data && data.id) {
    await localCache.put(table, data)
  }
}

/**
 * 从本地缓存删除（在删除操作后调用）
 */
export async function deleteFromCache(table: CacheTable, id: string): Promise<void> {
  await localCache.delete(table, id)
}

/**
 * 强制同步（手动触发）
 */
export async function forceSync(table: CacheTable): Promise<void> {
  switch (table) {
    case 'items':
      await syncFromSupabase('items', getItemsFromSupabase)
      break
    case 'orders':
      await syncFromSupabase('orders', () => getOrdersFromSupabase())
      break
    case 'customers':
      await syncFromSupabase('customers', getCustomersFromSupabase)
      break
    case 'categories':
      await syncFromSupabase('categories', getCategoriesFromSupabase)
      break
    default:
      console.warn(`[LocalCache] Unknown table: ${table}`)
  }
}
