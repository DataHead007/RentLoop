'use client'

import { useEffect } from 'react'

/**
 * 生产环境注册根路径 sw.js（与 public/sw.js 对应）
 * 开发环境不注册，避免与 HMR 冲突
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        /* 忽略：非 HTTPS 或浏览器策略导致失败 */
      })
    }

    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])

  return null
}
