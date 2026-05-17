/**
 * 判断是否为「未执行 business_plate / get_transaction_summary 迁移」导致的错误，
 * 用于 API 返回 400 + 明确提示，避免笼统 500。
 */
export function isPlateMigrationMissingFromDbError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const anyErr = err as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown }
  const message = typeof anyErr.message === 'string' ? anyErr.message : ''
  const details = typeof anyErr.details === 'string' ? anyErr.details : ''
  const hint = typeof anyErr.hint === 'string' ? anyErr.hint : ''
  const blob = `${message}\n${details}\n${hint}`.toLowerCase()

  if (
    blob.includes('get_transaction_summary') &&
    (blob.includes('could not find') || blob.includes('function'))
  ) {
    return true
  }
  if (blob.includes('p_business_plate') || blob.includes('p_creator_channel')) return true
  if (blob.includes('business_plate') && (blob.includes('does not exist') || blob.includes('schema cache'))) {
    return true
  }
  if (blob.includes('creator_channel') && (blob.includes('does not exist') || blob.includes('schema cache'))) {
    return true
  }
  if (blob.includes('business_line') && blob.includes('does not exist')) return true
  return false
}
