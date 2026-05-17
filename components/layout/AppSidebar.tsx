'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Activity,
  ArrowRightLeft,
  Calendar,
  ChartColumn,
  ChevronDown,
  Film,
  History,
  Landmark,
  LayoutList,
  Link2,
  Package,
  Receipt,
  ScrollText,
  Settings,
  Sparkles,
  Tag,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useSidebar } from '@/components/layout/SidebarContext'

function pathnameMatchesPlate(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function navLinkActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function rentalSubActive(pathname: string, href: string) {
  if (href === '/rental/financing') {
    return (
      pathnameMatchesPlate(pathname, '/rental/financing') ||
      pathnameMatchesPlate(pathname, '/financing-loans')
    )
  }
  return navLinkActive(pathname, href)
}

function isRentalSectionPath(pathname: string) {
  return (
    pathnameMatchesPlate(pathname, '/rental') ||
    pathnameMatchesPlate(pathname, '/customers') ||
    pathnameMatchesPlate(pathname, '/account-bindings') ||
    pathnameMatchesPlate(pathname, '/financing-loans') ||
    pathnameMatchesPlate(pathname, '/categories') ||
    pathnameMatchesPlate(pathname, '/orders') ||
    pathnameMatchesPlate(pathname, '/change-events') ||
    pathnameMatchesPlate(pathname, '/alm/rental-exclusions')
  )
}

function isBadmintonSectionPath(pathname: string) {
  return pathnameMatchesPlate(pathname, '/badminton')
}

function isCreatorSectionPath(pathname: string) {
  return pathnameMatchesPlate(pathname, '/creator')
}

const RENTAL_SUB_NAV = [
  { name: '资产', href: '/rental/items', icon: Package },
  { name: '租赁订单', href: '/rental/orders', icon: Calendar },
  { name: '租赁交易', href: '/rental/transactions', icon: ArrowRightLeft },
  { name: '全部订单', href: '/orders', icon: LayoutList },
  { name: '客户管理', href: '/customers', icon: Users },
  { name: '账号绑定', href: '/account-bindings', icon: Link2 },
  { name: '购置融资', href: '/rental/financing', icon: Landmark },
  { name: '品类管理', href: '/categories', icon: Tag },
  { name: '变更追踪', href: '/change-events', icon: History },
  { name: 'ALM 未计入明细', href: '/alm/rental-exclusions', icon: ScrollText },
] as const

const BADMINTON_SUB_NAV = [
  { name: '羽毛球订单', href: '/badminton/orders', icon: Calendar },
  { name: '羽毛球交易', href: '/badminton/transactions', icon: ArrowRightLeft },
] as const

const CREATOR_SUB_NAV = [
  { name: '自媒体交易', href: '/creator/transactions', icon: Film },
] as const

export function AppSidebar() {
  const pathname = usePathname()
  const { collapsed, mobileOpen, setMobileOpen } = useSidebar()

  const [desktop, setDesktop] = useState(false)
  const [rentalOpen, setRentalOpen] = useState(false)
  const [badmintonOpen, setBadmintonOpen] = useState(false)
  const [creatorOpen, setCreatorOpen] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const fn = () => setDesktop(mq.matches)
    fn()
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  useEffect(() => {
    setRentalOpen(isRentalSectionPath(pathname))
  }, [pathname])

  useEffect(() => {
    setBadmintonOpen(isBadmintonSectionPath(pathname))
  }, [pathname])

  useEffect(() => {
    setCreatorOpen(isCreatorSectionPath(pathname))
  }, [pathname])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname, setMobileOpen])

  useEffect(() => {
    if (!mobileOpen || desktop) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileOpen, desktop])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen, setMobileOpen])

  /** 桌面端收起侧栏时不占位、不展示图标栏（与顶栏切换重复）；移动端不受影响 */
  const desktopCollapsed = collapsed && desktop

  const linkClass = (isActive: boolean) =>
    cn(
      'flex items-center gap-3 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
      isActive
        ? 'bg-muted font-medium text-foreground'
        : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
    )

  const asideWidth = desktopCollapsed ? 'lg:w-0' : 'lg:w-56'

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[205] bg-black/50 lg:hidden"
          aria-label="关闭导航"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        aria-hidden={desktopCollapsed || undefined}
        className={cn(
          'flex flex-col border-r border-border/50 bg-background transition-[transform,width] duration-200',
          'fixed bottom-0 left-0 top-16 z-[220] w-[min(18rem,88vw)] lg:static lg:top-auto lg:z-0 lg:flex lg:h-full lg:w-auto lg:translate-x-0',
          asideWidth,
          desktopCollapsed && 'lg:min-w-0 lg:overflow-hidden lg:border-0 lg:p-0',
          !mobileOpen && '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center justify-between border-b border-border/40 px-3 py-2.5 lg:hidden">
          <span className="text-sm font-semibold tracking-tight">导航</span>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            aria-label="关闭"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!(desktop && desktopCollapsed) ? (
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain p-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
            <Link
              href="/transactions"
              className={linkClass(navLinkActive(pathname, '/transactions'))}
              onClick={() => setMobileOpen(false)}
            >
              <Receipt className="h-4 w-4 shrink-0" />
              <span>总览</span>
            </Link>

            <Collapsible open={rentalOpen} onOpenChange={setRentalOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    linkClass(isRentalSectionPath(pathname)),
                    'w-full justify-between text-left'
                  )}
                  aria-expanded={rentalOpen}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <ChartColumn className="h-4 w-4 shrink-0" />
                    <span>租赁</span>
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                      rentalOpen && 'rotate-180'
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden">
                <div className="ml-2.5 mt-0.5 space-y-0.5 border-l border-border/60 pl-2.5">
                  {RENTAL_SUB_NAV.map((item) => {
                    const Icon = item.icon
                    const active = rentalSubActive(pathname, item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(linkClass(active), 'pl-1')}
                        onClick={() => setMobileOpen(false)}
                      >
                        <Icon className="h-4 w-4 shrink-0 opacity-90" />
                        <span>{item.name}</span>
                      </Link>
                    )
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={badmintonOpen} onOpenChange={setBadmintonOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    linkClass(isBadmintonSectionPath(pathname)),
                    'w-full justify-between text-left'
                  )}
                  aria-expanded={badmintonOpen}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Activity className="h-4 w-4 shrink-0" />
                    <span>羽毛球</span>
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                      badmintonOpen && 'rotate-180'
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden">
                <div className="ml-2.5 mt-0.5 space-y-0.5 border-l border-border/60 pl-2.5">
                  {BADMINTON_SUB_NAV.map((item) => {
                    const Icon = item.icon
                    const active = navLinkActive(pathname, item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(linkClass(active), 'pl-1')}
                        onClick={() => setMobileOpen(false)}
                      >
                        <Icon className="h-4 w-4 shrink-0 opacity-90" />
                        <span>{item.name}</span>
                      </Link>
                    )
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={creatorOpen} onOpenChange={setCreatorOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    linkClass(isCreatorSectionPath(pathname)),
                    'w-full justify-between text-left'
                  )}
                  aria-expanded={creatorOpen}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Sparkles className="h-4 w-4 shrink-0" />
                    <span>自媒体</span>
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                      creatorOpen && 'rotate-180'
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden">
                <div className="ml-2.5 mt-0.5 space-y-0.5 border-l border-border/60 pl-2.5">
                  {CREATOR_SUB_NAV.map((item) => {
                    const Icon = item.icon
                    const active = navLinkActive(pathname, item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(linkClass(active), 'pl-1')}
                        onClick={() => setMobileOpen(false)}
                      >
                        <Icon className="h-4 w-4 shrink-0 opacity-90" />
                        <span>{item.name}</span>
                      </Link>
                    )
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Link
              href="/settings"
              className={linkClass(navLinkActive(pathname, '/settings'))}
              onClick={() => setMobileOpen(false)}
            >
              <Settings className="h-4 w-4 shrink-0" />
              <span>设置</span>
            </Link>
        </nav>
        ) : null}
      </aside>
    </>
  )
}
