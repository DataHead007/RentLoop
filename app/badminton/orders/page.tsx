import { OrderList } from '@/components/orders/OrderList'

export default function BadmintonOrdersPage() {
  return (
    <div className="container mx-auto py-8">
      <OrderList module="badminton" />
    </div>
  )
}
