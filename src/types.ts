export type TemplateItem = {
  id: string
  title: string
  category: string
  categoryLabel: string
  description: string
  tags: string[]
  prompt: string
  gradient: string
  accent: string
  previewTitle: string
  image?: string
  sourceLabel?: string
  sourceUrl?: string
  githubUrl?: string
}

export type UserProfile = {
  id: string
  user_id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
  disabled: boolean
  last_sign_in_at: string | null
  created_at: string
}

export type CreditPack = {
  id: string
  name: string
  credits: number
  price_cents: number
  bonus_credits: number
  is_active: boolean
  sort_order: number
}

export type CreditTransaction = {
  id: string
  user_id: string
  amount: number
  type: 'subscription_renew' | 'purchase' | 'bonus' | 'usage' | 'refund' | 'admin_grant' | 'signup_bonus' | 'expiry'
  reference_type: string | null
  reference_id: string | null
  balance_after: number
  created_at: string
}

export type GeneratedImage = {
  id: string
  user_id: string
  template_id: string | null
  prompt: string
  params: Record<string, unknown>
  image_url: string | null
  thumbnail_url: string | null
  storage_path: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error_message: string | null
  created_at: string
}

export type GenerateParams = {
  prompt: string
  aspectRatio: '1:1' | '4:3' | '3:4' | '16:9' | '9:16'
  size: '1024x1024' | '1792x1024' | '1024x1792'
}

export type AdminUser = {
  row_num: number
  user_id: string
  username: string
  email: string
  disabled: boolean
  total_recharge_cents: number
  balance: number
  created_at: string
  last_sign_in_at: string | null
}

export type RechargeOrder = {
  id: string
  user_id: string
  credits: number
  amount_cents: number
  afdian_order_id: string | null
  proof_screenshot_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_note: string | null
  created_at: string
  updated_at: string
}
