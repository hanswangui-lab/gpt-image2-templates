import { supabase } from '../lib/supabase'
import type { UserProfile, CreditTransaction, GeneratedImage } from '../types'

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data as UserProfile | null
}

export async function updateProfile(userId: string, updates: Partial<UserProfile>): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export async function getCreditHistory(userId: string): Promise<CreditTransaction[]> {
  const { data } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  return (data as CreditTransaction[]) ?? []
}

export async function getGeneratedImages(userId: string): Promise<GeneratedImage[]> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('generated_images')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
  return (data as GeneratedImage[]) ?? []
}

export async function deleteGeneratedImage(imageId: string): Promise<void> {
  const { error } = await supabase
    .from('generated_images')
    .delete()
    .eq('id', imageId)
  if (error) throw new Error(error.message)
}
