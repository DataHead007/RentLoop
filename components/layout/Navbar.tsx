'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Menu, Package, PanelLeft, PanelLeftClose, X } from 'lucide-react'
import { useSidebar } from '@/components/layout/SidebarContext'

export function Navbar() {
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebar()
  const [desktop, setDesktop] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const fn = () => setDesktop(mq.matches)
    fn()
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  const handleNavToggle = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
      toggleCollapsed()
    } else {
      setMobileOpen(!mobileOpen)
    }
  }

  const ToggleIcon = !desktop ? (
    mobileOpen ? (
      <X className="h-5 w-5" />
    ) : (
      <Menu className="h-5 w-5" />
    )
  ) : collapsed ? (
    <PanelLeft className="h-5 w-5" />
  ) : (
    <PanelLeftClose className="h-5 w-5" />
  )

  return (
    <nav className="sticky top-0 z-[210] w-full shrink-0 border-b border-border/50 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <div className="relative flex min-h-12 min-w-0 items-center gap-2 px-3 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] sm:px-4 lg:min-h-0 lg:px-6">
        <button
          type="button"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:h-8 lg:w-8"
          aria-expanded={mobileOpen}
          aria-label={desktop ? (collapsed ? '展开导航侧栏' : '收起导航侧栏') : mobileOpen ? '关闭导航' : '打开导航'}
          onClick={handleNavToggle}
        >
          {ToggleIcon}
        </button>

        <Link
          href="/rental/items"
          className="flex min-w-0 shrink items-center gap-2 transition-opacity hover:opacity-80"
        >
          <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-[15px] font-semibold leading-none tracking-tight">RentLoop</span>
        </Link>
      </div>
    </nav>
  )
}
