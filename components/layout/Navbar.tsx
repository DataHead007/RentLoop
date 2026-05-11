'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import {
  Package,
  Calendar,
  Tag,
  Receipt,
  Activity,
  Users,
  Link2,
  Settings,
  LayoutList,
  Menu,
  X,
  ScrollText,
} from 'lucide-react'

const navigation = [
  { name: '资产', href: '/items', icon: Package },
  { name: '租赁订单', href: '/rental/orders', icon: Calendar },
  { name: '羽毛球订单', href: '/badminton/orders', icon: Activity },
  { name: '全部订单', href: '/orders', icon: LayoutList },
  { name: '客户管理', href: '/customers', icon: Users },
  { name: '账号绑定', href: '/account-bindings', icon: Link2 },
  { name: '交易记录', href: '/transactions', icon: Receipt },
  { name: '变更追踪', href: '/change-events', icon: ScrollText },
  { name: '品类管理', href: '/categories', icon: Tag },
  { name: '设置', href: '/settings', icon: Settings },
]

export function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileOpen])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  const linkClass = (isActive: boolean) =>
    cn(
      'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
      isActive
        ? 'bg-accent text-accent-foreground'
        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
    )

  const mobileMenu =
    mounted && mobileOpen ? (
      <>
        <button
          type="button"
          className="fixed inset-0 z-[100] bg-black/50 lg:hidden"
          aria-label="关闭菜单"
          onClick={() => setMobileOpen(false)}
        />
        <div
          className="fixed inset-y-0 right-0 z-[110] flex w-[min(20rem,88vw)] flex-col border-l bg-background shadow-xl lg:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          role="dialog"
          aria-modal="true"
          aria-label="主导航"
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-semibold">导航</span>
            <button
              type="button"
              className="rounded-md p-2 text-muted-foreground hover:bg-accent"
              aria-label="关闭"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain p-3">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={linkClass(isActive)}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </>
    ) : null

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* safe-area 与行内 padding 同一层，避免「只有顶 padding」导致内容视觉上贴顶 */}
      <div className="relative z-[120] container flex items-center gap-3 bg-background/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] md:px-6">
        <Link
          href="/rental/orders"
          className="flex h-10 shrink-0 items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Package className="h-5 w-5 shrink-0" />
          <span className="font-bold text-lg leading-none">RentLoop</span>
        </Link>

        <div className="hidden flex-1 items-center justify-end gap-1 lg:flex lg:flex-wrap lg:justify-end">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            const Icon = item.icon
            return (
              <Link key={item.name} href={item.href} className={linkClass(isActive)}>
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </div>

        <button
          type="button"
          className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-foreground lg:hidden"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? '关闭菜单' : '打开菜单'}
          onClick={() => setMobileOpen((o) => !o)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileMenu ? createPortal(mobileMenu, document.body) : null}
    </nav>
  )
}
