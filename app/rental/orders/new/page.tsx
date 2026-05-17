import Link from 'next/link'
import { OrderFormV2 } from '@/components/orders/OrderFormV2'

export default function NewRentalOrderPage() {
  return (
    <div className="container mx-auto min-w-0 w-full max-w-5xl px-3 py-4 sm:px-4 md:px-6 md:py-8">
      <div className="mb-6">
        <Link href="/rental/orders" className="text-sm text-muted-foreground hover:underline">
          ← 返回租赁订单
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">新建租赁订单</h1>
        <p className="text-muted-foreground">设备租赁、游戏账号等</p>
      </div>
      <OrderFormV2 afterSubmitRedirect="/rental/orders" />
    </div>
  )
}
