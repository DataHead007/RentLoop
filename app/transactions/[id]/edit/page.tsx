import { TransactionForm } from '@/components/transactions/TransactionForm'

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="container mx-auto min-w-0 w-full max-w-3xl px-4 py-8 sm:px-6">
      <TransactionForm transactionId={id} />
    </div>
  )
}
