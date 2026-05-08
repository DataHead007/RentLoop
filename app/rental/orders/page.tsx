import { OrderList } from '@/components/orders/OrderList'

export default function RentalOrdersPage() {
  return (
    <div className="container mx-auto py-8">
      <OrderList module="rental" />
    </div>
  )
}
