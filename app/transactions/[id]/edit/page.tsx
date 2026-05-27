import { TransactionForm } from '@/components/transactions/TransactionForm'

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="container mx-auto min-w-0 w-full max-w-3xl px-3 pt-3 pb-4 sm:px-4 md:px-6 md:pt-4 md:pb-6">
      <TransactionForm transactionId={id} />
    </div>
  )
}
