import { TransactionForm } from '@/components/transactions/TransactionForm'

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="container mx-auto py-8">
      <TransactionForm transactionId={id} />
    </div>
  )
}
