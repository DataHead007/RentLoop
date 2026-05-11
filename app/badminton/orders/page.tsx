import { OrderList } from '@/components/orders/OrderList'

export default function BadmintonOrdersPage() {
  return (
    <div className="container mx-auto min-w-0 max-w-full py-8">
      <OrderList module="badminton" />
    </div>
  )
}
