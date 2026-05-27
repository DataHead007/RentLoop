import { TransactionForm } from '@/components/transactions/TransactionForm'
import type { BusinessPlate, CreatorChannel } from '@/lib/types/businessPlate'

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{
    itemId?: string
    orderId?: string
    businessPlate?: string
    creatorChannel?: string
    /** @deprecated 兼容旧链接 */
    businessLine?: string
  }>
}) {
  const { itemId, orderId, businessPlate, creatorChannel, businessLine } = await searchParams

  let defaultPlate: BusinessPlate = 'rental'
  let defaultCreatorChannel: CreatorChannel | null = null

  if (businessPlate === 'rental' || businessPlate === 'badminton' || businessPlate === 'creator') {
    defaultPlate = businessPlate
  } else if (businessLine === 'badminton') {
    defaultPlate = 'badminton'
  } else if (businessLine === 'youtube') {
    defaultPlate = 'creator'
    defaultCreatorChannel = 'youtube'
  } else if (businessLine === 'wechat_video') {
    defaultPlate = 'creator'
    defaultCreatorChannel = 'wechat_video'
  }

  if (defaultPlate === 'creator') {
    if (creatorChannel === 'youtube' || creatorChannel === 'wechat_video' || creatorChannel === 'xiaohongshu') {
      defaultCreatorChannel = creatorChannel
    }
  }

  return (
    <div className="container mx-auto min-w-0 w-full max-w-3xl px-3 pt-3 pb-4 sm:px-4 md:px-6 md:pt-4 md:pb-6">
      <TransactionForm
        itemId={itemId}
        orderId={orderId}
        defaultPlate={defaultPlate}
        defaultCreatorChannel={defaultCreatorChannel}
      />
    </div>
  )
}
