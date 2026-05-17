import { CustomerList } from '@/components/customers/CustomerList'

export default function CustomersPage() {
  return (
    <div className="container mx-auto min-w-0 max-w-full px-3 py-4 sm:px-4 md:px-6 md:py-8">
      <CustomerList />
    </div>
  )
}
