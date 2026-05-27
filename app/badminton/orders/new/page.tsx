import Link from 'next/link'
import { BadmintonOrderForm } from '@/components/orders/BadmintonOrderForm'

export default function NewBadmintonOrderPage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-4">
        <Link href="/badminton/orders" className="text-sm text-muted-foreground hover:underline">
          ← 返回羽毛球订单
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">新建羽毛球订单</h1>
        <p className="text-sm text-muted-foreground">教学、陪打、比赛、活动</p>
      </div>
      <BadmintonOrderForm listRedirectPath="/badminton/orders" />
    </div>
  )
}
