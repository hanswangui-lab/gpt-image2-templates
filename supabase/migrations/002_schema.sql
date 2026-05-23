-- 用户资料表
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 订阅计划表
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('monthly', 'yearly')),
  price_cents integer NOT NULL,
  credits_per_month integer NOT NULL,
  features jsonb NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 积分包表
CREATE TABLE IF NOT EXISTS public.credit_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credits integer NOT NULL,
  price_cents integer NOT NULL,
  bonus_credits integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 用户订阅表
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_subscriptions_user ON public.user_subscriptions(user_id);

-- 积分流水表
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  type text NOT NULL CHECK (type IN ('subscription_renew', 'purchase', 'bonus', 'usage', 'refund', 'admin_grant', 'signup_bonus')),
  reference_type text,
  reference_id text,
  balance_after integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_transactions_user ON public.credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_created ON public.credit_transactions(user_id, created_at DESC);

-- 支付订单表
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_type text NOT NULL CHECK (order_type IN ('subscription', 'credit_pack')),
  product_id uuid NOT NULL,
  amount_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  yipay_order_id text,
  payment_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE INDEX idx_payment_orders_user ON public.payment_orders(user_id);

-- 生成图片表
CREATE TABLE IF NOT EXISTS public.generated_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id text,
  prompt text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}',
  image_url text,
  thumbnail_url text,
  storage_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_generated_images_user ON public.generated_images(user_id);
CREATE INDEX idx_generated_images_created ON public.generated_images(user_id, created_at DESC);

-- ============================================================
-- 新用户触发器：见 003_recharge.sql（含 username 支持和最新积分策略）
-- ============================================================

-- ============================================================
-- RLS 策略
-- ============================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;

-- user_profiles: 用户读写自己的
DROP POLICY IF EXISTS "Users manage own profile" ON public.user_profiles;
CREATE POLICY "Users manage own profile" ON public.user_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- user_subscriptions: 用户只读自己的
DROP POLICY IF EXISTS "Users read own subscriptions" ON public.user_subscriptions;
CREATE POLICY "Users read own subscriptions" ON public.user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- credit_transactions: 用户只读自己的
DROP POLICY IF EXISTS "Users read own transactions" ON public.credit_transactions;
CREATE POLICY "Users read own transactions" ON public.credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- payment_orders: 用户只读自己的
DROP POLICY IF EXISTS "Users read own payment orders" ON public.payment_orders;
CREATE POLICY "Users read own payment orders" ON public.payment_orders
  FOR SELECT USING (auth.uid() = user_id);

-- generated_images: 用户可读写删除自己的
DROP POLICY IF EXISTS "Users manage own images" ON public.generated_images;
CREATE POLICY "Users manage own images" ON public.generated_images
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- subscription_plans: 所有人可读
DROP POLICY IF EXISTS "Anyone read plans" ON public.subscription_plans;
CREATE POLICY "Anyone read plans" ON public.subscription_plans
  FOR SELECT USING (true);

-- credit_packs: 所有人可读
DROP POLICY IF EXISTS "Anyone read packs" ON public.credit_packs;
CREATE POLICY "Anyone read packs" ON public.credit_packs
  FOR SELECT USING (true);

-- ============================================================
-- 种子数据：订阅计划
-- ============================================================

INSERT INTO public.subscription_plans (name, slug, type, price_cents, credits_per_month, features, sort_order)
VALUES
  (
    '月度会员',
    'monthly',
    'monthly',
    2990,
    300,
    '["每月 300 积分", "高清图像生成", "无水印下载", "优先队列"]',
    1
  ),
  (
    '年度会员',
    'yearly',
    'yearly',
    29900,
    300,
    '["每月 300 积分（共 3600）", "高清图像生成", "无水印下载", "优先队列", "专属客服"]',
    2
  )
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 种子数据：积分包
-- ============================================================

INSERT INTO public.credit_packs (name, credits, price_cents, bonus_credits, sort_order)
VALUES
  ('基础包', 100, 990, 0, 1),
  ('进阶包', 250, 1990, 50, 2),
  ('超值包', 700, 4990, 200, 3)
ON CONFLICT DO NOTHING;
