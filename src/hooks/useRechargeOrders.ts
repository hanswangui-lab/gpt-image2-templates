import { useState, useEffect, useCallback } from 'react'
import type { RechargeOrder } from '../types'
import { getMyRechargeOrders } from '../services/rechargeApi'

export function useRechargeOrders(userId: string | undefined) {
  const [orders, setOrders] = useState<RechargeOrder[]>([])
  const [loading, setLoading] = useState(false)

  const loadOrders = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const data = await getMyRechargeOrders()
      setOrders(data as RechargeOrder[])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  return { orders, loading, reload: loadOrders }
}
