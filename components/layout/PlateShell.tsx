import { cn } from '@/lib/utils'

type PlateShellProps = {
  children: React.ReactNode
  className?: string
}

/** 业务板块（租赁/羽毛球/自媒体）页面统一外边距：顶格贴导航栏下沿，仅保留必要呼吸间距 */
export function PlateShell({ children, className }: PlateShellProps) {
  return (
    <div
      className={cn(
        'container mx-auto min-w-0 max-w-full px-3 pt-3 pb-4 sm:px-4 md:px-6 md:pt-4 md:pb-6',
        className
      )}
    >
      {children}
    </div>
  )
}
