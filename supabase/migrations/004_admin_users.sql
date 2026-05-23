-- 004_admin_users.sql: Admin user management (list, disable, delete)
-- Run via Supabase SQL Editor

-- 1. Add columns to user_profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz;

-- 2. RPC: Record login timestamp
CREATE OR REPLACE FUNCTION rpc_record_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.user_profiles
  SET last_sign_in_at = now()
  WHERE user_id = auth.uid();
END;
$$;

-- 3. RPC: Admin list all users with sequential IDs
CREATE OR REPLACE FUNCTION rpc_admin_list_users()
RETURNS TABLE(
  row_num bigint,
  user_id uuid,
  username text,
  email text,
  disabled boolean,
  total_recharge_cents bigint,
  balance integer,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
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
  SELECT
    ROW_NUMBER() OVER (ORDER BY au.created_at) - 1 AS row_num,
    au.id AS user_id,
    COALESCE(up.username, split_part(au.email, '@', 1)) AS username,
    au.email::text,
    COALESCE(up.disabled, false) AS disabled,
    COALESCE((
      SELECT SUM(ro.amount_cents)::bigint
      FROM public.recharge_orders ro
      WHERE ro.user_id = au.id AND ro.status = 'approved'
    ), 0) AS total_recharge_cents,
    COALESCE(uc.balance, 0) AS balance,
    au.created_at,
    up.last_sign_in_at
  FROM auth.users au
  LEFT JOIN public.user_profiles up ON up.user_id = au.id
  LEFT JOIN public.user_credits uc ON uc.user_id = au.id
  ORDER BY au.created_at;
END;
$$;

-- 4. RPC: Admin disable/enable a user
CREATE OR REPLACE FUNCTION rpc_admin_disable_user(p_user_id uuid, p_disabled boolean)
RETURNS void
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

  UPDATE public.user_profiles
  SET disabled = p_disabled
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.user_profiles (user_id, disabled) VALUES (p_user_id, p_disabled);
  END IF;
END;
$$;
