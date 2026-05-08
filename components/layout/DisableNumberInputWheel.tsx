'use client'

import { useEffect } from 'react'

/**
 * 在数字输入框上滚动滚轮/触控板时，浏览器会增减数值，极易误触。
 * 在捕获阶段拦截发生在 number 输入上的 wheel，禁止改值（仍可键盘输入）。
 */
export function DisableNumberInputWheel() {
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const t = e.target
      if (!(t instanceof Element)) return
      const input = t.closest('input[type="number"]')
      if (input) e.preventDefault()
    }
    document.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => document.removeEventListener('wheel', onWheel, { capture: true })
  }, [])
  return null
}
