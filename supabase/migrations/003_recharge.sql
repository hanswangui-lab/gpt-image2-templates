-- 003_recharge.sql: 完整初始化（充值系统 + 用户角色 + 用户名支持 + 基础表）
-- 可独立执行，所有 IF NOT EXISTS 保证幂等

-- ============================================================
-- 0. 基础表（如果 002 没执行过，这里兜底创建）
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  username text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username ON public.user_profiles(username) WHERE username IS NOT NULL;

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
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON public.credit_transactions(user_id, created_at DESC);

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
CREATE INDEX IF NOT EXISTS idx_generated_images_user ON public.generated_images(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_images_created ON public.generated_images(user_id, created_at DESC);

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

-- ============================================================
-- 1. 基础 RPC（如果 001 没执行过，这里兜底创建）
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_consume_credits(credit_user_id uuid, credit_amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_balance integer;
BEGIN
  SELECT balance INTO current_balance
  FROM public.user_credits
  WHERE user_id = credit_user_id
  FOR UPDATE;

  IF NOT FOUND OR current_balance < credit_amount THEN
    RETURN false;
  END IF;

  UPDATE public.user_credits
  SET balance = balance - credit_amount
  WHERE user_id = credit_user_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_add_credits(credit_user_id uuid, credit_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (credit_user_id, credit_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET balance = public.user_credits.balance + credit_amount;
END;
$$;

-- ============================================================
-- 2. 添加 user_profiles.username 字段（如果表已存在但缺少此列）
-- ============================================================
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username ON public.user_profiles(username) WHERE username IS NOT NULL;

-- 2. 更新 handle_new_user 触发器以支持 username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_balance integer;
BEGIN
  INSERT INTO public.user_profiles (user_id, display_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );

  INSERT INTO public.user_credits (user_id, balance)
  VALUES (NEW.id, 3)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance FROM public.user_credits WHERE user_id = NEW.id;
  INSERT INTO public.credit_transactions (user_id, amount, type, balance_after)
  VALUES (NEW.id, 3, 'signup_bonus', v_balance);

  RETURN NEW;
END;
$$;

-- 3. 用户角色表
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. 充值订单表（爱发电手动审核）
CREATE TABLE IF NOT EXISTS public.recharge_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credits integer NOT NULL,
  amount_cents integer NOT NULL,
  afdian_order_id text,
  proof_screenshot_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_id uuid REFERENCES auth.users(id),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recharge_orders_user ON public.recharge_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_recharge_orders_status ON public.recharge_orders(status);

-- 5. RPC: 用户提交充值申请
CREATE OR REPLACE FUNCTION rpc_submit_recharge(
  p_credits integer,
  p_amount_cents integer,
  p_afdian_order_id text,
  p_proof_screenshot_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  INSERT INTO public.recharge_orders (user_id, credits, amount_cents, afdian_order_id, proof_screenshot_url)
  VALUES (auth.uid(), p_credits, p_amount_cents, p_afdian_order_id, p_proof_screenshot_url)
  RETURNING id INTO v_order_id;
  RETURN v_order_id;
END;
$$;

-- 6. RPC: Admin审批充值
CREATE OR REPLACE FUNCTION rpc_admin_approve_recharge(
  p_order_id uuid,
  p_approved boolean,
  p_admin_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order record;
  v_is_admin boolean;
BEGIN
  SELECT (role = 'admin') INTO v_is_admin
  FROM public.user_roles
  WHERE user_id = auth.uid();

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Permission denied: admin required';
  END IF;

  SELECT * INTO v_order FROM public.recharge_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status != 'pending' THEN
    RAISE EXCEPTION 'Order already processed';
  END IF;

  IF p_approved THEN
    UPDATE public.recharge_orders
    SET status = 'approved', admin_id = auth.uid(), admin_note = p_admin_note, updated_at = now()
    WHERE id = p_order_id;

    PERFORM rpc_add_credits(v_order.user_id, v_order.credits);
  ELSE
    UPDATE public.recharge_orders
    SET status = 'rejected', admin_id = auth.uid(), admin_note = p_admin_note, updated_at = now()
    WHERE id = p_order_id;
  END IF;
END;
$$;

-- 7. RPC: 检查当前用户是否 admin
CREATE OR REPLACE FUNCTION rpc_is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- 8. RPC: Admin 获取待审核充值列表
CREATE OR REPLACE FUNCTION rpc_get_pending_recharges()
RETURNS SETOF public.recharge_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT (role = 'admin') INTO v_is_admin
  FROM public.user_roles
  WHERE user_id = auth.uid();

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Permission denied: admin required';
  END IF;

  RETURN QUERY
  SELECT * FROM public.recharge_orders
  WHERE status = 'pending'
  ORDER BY created_at DESC;
END;
$$;

-- 9. RLS: recharge_orders
ALTER TABLE public.recharge_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own recharge orders" ON public.recharge_orders;
CREATE POLICY "Users manage own recharge orders" ON public.recharge_orders
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all recharge orders" ON public.recharge_orders;
CREATE POLICY "Admins read all recharge orders" ON public.recharge_orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 10. RLS: user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own role" ON public.user_roles;
CREATE POLICY "Users read own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all roles" ON public.user_roles;
CREATE POLICY "Admins read all roles" ON public.user_roles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
