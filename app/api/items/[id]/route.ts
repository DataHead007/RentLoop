import { NextResponse } from 'next/server'
import { updateItem, getItem, createTransaction, getTransactions } from '@/lib/supabase/queries'
import { supabase } from '@/lib/supabase/client'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const { getItemWithStats } = await import('@/lib/supabase/queries')
    const item = await getItemWithStats(id)
    if (!item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      )
    }
    return NextResponse.json(item)
  } catch (error) {
    console.error('Error fetching item:', error)
    return NextResponse.json(
      { error: 'Failed to fetch item' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    
    // 获取旧资产信息（用于判断是否需要更新交易）
    const oldItem = await getItem(id)
    
    const item = await updateItem(id, body)
    
    // 注意：本地缓存更新在客户端组件中处理
    
    // 如果购买价格或购买日期发生变化，更新购买交易记录
    const purchasePriceChanged = body.purchase_price !== undefined && 
                                 body.purchase_price !== oldItem?.purchase_price
    const purchaseDateChanged = body.purchase_date !== undefined && 
                                body.purchase_date !== oldItem?.purchase_date
    
    if ((purchasePriceChanged || purchaseDateChanged) && item.purchase_price && item.purchase_price > 0) {
      try {
        const purchaseCategories = new Set(['设备采购', '设备购买'])
        // 查找是否已存在购买交易记录
        const transactions = await getTransactions()
        const existingPurchaseTx = transactions.find(
          tx => tx.item_id === id && 
                tx.type === 'expense' && 
                purchaseCategories.has(tx.category || '') &&
                tx.auto_created === true
        )
        
        if (existingPurchaseTx) {
          // 更新现有交易记录
          // 确保金额是负数（支出类型）
          const purchaseAmount = item.purchase_price > 0 ? -Math.abs(item.purchase_price) : item.purchase_price
          const { error: updateError } = await supabase
            .from('transactions')
            .update({
              amount: purchaseAmount,
              transaction_date: item.purchase_date || existingPurchaseTx.transaction_date,
              category: '设备购买',
              description: `${item.name} 设备购买`,
            })
            .eq('id', existingPurchaseTx.id)
          
          if (updateError) {
            console.error('Failed to update purchase transaction:', updateError)
            throw updateError
          }
        } else {
          // 创建新的购买交易记录
          if (item.purchase_date) {
            // 确保金额是负数（支出类型）
            const purchaseAmount = item.purchase_price > 0 ? -Math.abs(item.purchase_price) : item.purchase_price
            await createTransaction({
              item_id: item.id,
              order_id: null,
              type: 'expense',
              amount: purchaseAmount,
              category: '设备购买',
              description: `${item.name} 设备购买`,
              transaction_date: item.purchase_date,
              auto_created: true,
            })
          }
        }
      } catch (transactionError) {
        console.error('Failed to sync purchase transaction:', transactionError)
        // 不影响资产更新
      }
    }
    
    // 如果售出价格或售出日期发生变化，更新售出交易记录
    const soldPriceChanged = body.sold_price !== undefined && 
                            body.sold_price !== oldItem?.sold_price
    const saleDateChanged = body.sale_date !== undefined && 
                           body.sale_date !== oldItem?.sale_date
    const hadSaleInfo = oldItem?.sold_price && oldItem.sold_price > 0 && oldItem.sale_date
    const hasSaleInfo = item.sold_price && item.sold_price > 0 && item.sale_date
    
    // 获取所有交易记录以查找售出交易
    const allTransactions = await getTransactions()
    const existingSaleTx = allTransactions.find(
      tx => tx.item_id === id && 
            tx.type === 'income' && 
            tx.category === '设备出售' &&
            tx.auto_created === true
    )
    
    // 如果有售出信息
    if (hasSaleInfo) {
      // 如果售出信息发生变化，或者首次添加售出信息（原来没有现在有了）
      if (soldPriceChanged || saleDateChanged || (!hadSaleInfo && hasSaleInfo)) {
        try {
          if (existingSaleTx) {
            // 更新现有售出交易记录
            await supabase
              .from('transactions')
              .update({
                amount: item.sold_price,
                transaction_date: item.sale_date,
                description: `${item.name} 设备出售`,
              })
              .eq('id', existingSaleTx.id)
          } else {
            // 创建新的售出交易记录
            await createTransaction({
              item_id: item.id,
              order_id: null,
              type: 'income',
              amount: item.sold_price!,
              category: '设备出售',
              description: `${item.name} 设备出售`,
              transaction_date: item.sale_date!,
              auto_created: true,
            })
          }
        } catch (transactionError) {
          console.error('Failed to sync sale transaction:', transactionError)
          // 不影响资产更新
        }
      }
    } else if (hadSaleInfo && !hasSaleInfo) {
      // 如果售出信息被清除（原来有现在没有了），删除对应的交易记录
      if (existingSaleTx) {
        try {
          await supabase
            .from('transactions')
            .delete()
            .eq('id', existingSaleTx.id)
        } catch (transactionError) {
          console.error('Failed to delete sale transaction:', transactionError)
          // 不影响资产更新
        }
      }
    }
    
    return NextResponse.json(item)
  } catch (error: any) {
    console.error('Error updating item:', error)
    
    // 提供更详细的错误信息
    let errorMessage = '更新资产失败，请重试'
    
    if (error?.message) {
      errorMessage = error.message
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
