import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { UserProfile } from '../types'
import { getBalance } from '../services/creditApi'

export type AuthUser = User | null
export type Credits = { total: number; used: number; balance: number }

export const useAuth = () => {
  const [user, setUser] = useState<AuthUser>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [credits, setCredits] = useState<number>(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === 'SIGNED_IN') setShowAuth(false)
    })

    return () => authListener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setCredits(0)
      setIsAdmin(false)
      return
    }
    loadCredits()
    loadProfile()
    loadAdminStatus()
    recordLogin()
  }, [user])

  const loadCredits = async () => {
    if (!user) return
    try {
      const balance = await getBalance()
      setCredits(balance)
    } catch (err: any) {
      console.error('[loadCredits]', err.message)
    }
  }

  const loadProfile = async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user!.id)
      .single()
    const profile = data as UserProfile | null
    setProfile(profile)
    if (profile?.disabled) {
      alert('您的账户已被禁用，请联系管理员。')
      signOut()
    }
  }

  const consumeCredits = async (amount: number, refType?: string, refId?: string) => {
    if (!user) return false
    const { data, error } = await supabase.rpc('rpc_consume_credits', {
      credit_user_id: user.id,
      credit_amount: amount,
      credit_reference_type: refType || 'usage',
      credit_reference_id: refId || null,
    })
    if (error || !data) return false
    await loadCredits()
    return true
  }

  const loadAdminStatus = async () => {
    const { data } = await supabase.rpc('rpc_is_admin')
    setIsAdmin(data === true)
  }

  const recordLogin = async () => {
    try { await supabase.rpc('rpc_record_login') } catch {}
  }

  const refreshCredits = async () => {
    await loadCredits()
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setCredits(0)
    setIsAdmin(false)
  }

  return { user, profile, credits, isAdmin, loading, showAuth, setShowAuth, authMode, setAuthMode, consumeCredits, refreshCredits, signOut }
}
