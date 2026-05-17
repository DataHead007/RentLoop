'use client'

import { AppSidebar } from '@/components/layout/AppSidebar'
import { Navbar } from '@/components/layout/Navbar'
import { SidebarProvider } from '@/components/layout/SidebarContext'

export function AppChrome({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen min-w-0 flex-col">
        <Navbar />
        <div className="flex min-h-0 min-w-0 flex-1">
          <AppSidebar />
          <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
