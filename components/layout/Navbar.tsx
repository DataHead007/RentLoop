'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Package, Calendar, Tag, Receipt, Activity, Users, Link2, Gauge, Settings } from 'lucide-react'

const navigation = [
  { name: '资产', href: '/items', icon: Package },
  { name: '订单', href: '/orders', icon: Calendar },
  { name: '客户管理', href: '/customers', icon: Users },
  { name: '账号绑定', href: '/account-bindings', icon: Link2 },
  { name: '交易记录', href: '/transactions', icon: Receipt },
  { name: '变更追踪', href: '/change-events', icon: Activity },
  { name: '性能监控', href: '/performance', icon: Gauge },
  { name: '品类管理', href: '/categories', icon: Tag },
  { name: '设置', href: '/settings', icon: Settings },
]

export function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link
          href="/orders"
          className="mr-6 flex items-center space-x-2 hover:opacity-80 transition-opacity"
        >
          <Package className="h-5 w-5" />
          <span className="font-bold text-lg">RentLoop</span>
        </Link>
        
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <div className="flex items-center space-x-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== '/' && pathname.startsWith(item.href))
                const Icon = item.icon
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline-block">{item.name}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
