import { TransactionForm } from '@/components/transactions/TransactionForm'
import type { BusinessLine } from '@/lib/types/database'

const BUSINESS_LINES: readonly BusinessLine[] = ['rental', 'badminton', 'youtube', 'wechat_video']

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ itemId?: string; orderId?: string; businessLine?: string }>
}) {
  const { itemId, orderId, businessLine } = await searchParams
  const defaultBusinessLine =
    businessLine && (BUSINESS_LINES as readonly string[]).includes(businessLine)
      ? (businessLine as BusinessLine)
      : undefined

  return (
    <div className="container mx-auto min-w-0 w-full max-w-3xl px-4 py-8 sm:px-6">
      <TransactionForm itemId={itemId} orderId={orderId} defaultBusinessLine={defaultBusinessLine} />
    </div>
  )
}
