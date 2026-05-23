import { useState, useEffect, useCallback } from 'react'
import { checkIsAdmin, getPendingRecharges } from '../services/adminApi'
import type { RechargeOrder } from '../types'

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [pendingOrders, setPendingOrders] = useState<RechargeOrder[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const admin = await checkIsAdmin()
      setIsAdmin(admin)
      if (admin) {
        const orders = await getPendingRecharges()
        setPendingOrders(orders as RechargeOrder[])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { isAdmin, pendingOrders, loading, reload: load }
}
