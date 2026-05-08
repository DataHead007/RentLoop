/* RentLoop 最小 PWA Service Worker
 * - 仅 install/activate，不拦截 fetch，避免 Next 动态页缓存导致数据过期
 * - 满足「可安装 Web App」基础能力；后续若要离线再扩展 caches
 */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
