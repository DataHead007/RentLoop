import Link from 'next/link'
import { BadmintonOrderForm } from '@/components/orders/BadmintonOrderForm'

export default function NewBadmintonOrderPage() {
  return (
    <div className="container mx-auto min-w-0 w-full max-w-5xl px-3 py-4 sm:px-4 md:px-6 md:py-8">
      <div className="mb-6">
        <Link href="/badminton/orders" className="text-sm text-muted-foreground hover:underline">
          ← 返回羽毛球订单
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">新建羽毛球订单</h1>
        <p className="text-muted-foreground">教学、陪打、比赛、活动</p>
      </div>
      <BadmintonOrderForm listRedirectPath="/badminton/orders" />
    </div>
  )
}
